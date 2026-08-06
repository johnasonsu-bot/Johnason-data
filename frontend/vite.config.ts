import type { Connect } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { brotliCompress, gzip } from "node:zlib";
import { promisify } from "node:util";

const proxyTarget = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:45121";
const dbxProxyTarget = process.env.VITE_DBX_PROXY_TARGET || "http://127.0.0.1:45123";
const chartdbProxyTarget = process.env.VITE_CHARTDB_PROXY_TARGET || "http://127.0.0.1:45124";
const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

function dbxEntryRewriteMiddleware(): Connect.NextHandleFunction {
  return (req, _res, next) => {
    if (req.url === "/devtools/dbx/") {
      req.url = "/devtools/dbx";
    }
    next();
  };
}

function splitVendorChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    id.includes("/react/") ||
    id.includes("/react-dom/") ||
    id.includes("/react-router") ||
    id.includes("/scheduler/") ||
    id.includes("/antd/") ||
    id.includes("/@ant-design/") ||
    id.includes("/@rc-component/") ||
    id.includes("/rc-")
  ) {
    return "vendor-core";
  }
  if (id.includes("/echarts") || id.includes("/@echarts-x/") || id.includes("/zrender/")) {
    return "vendor-echarts";
  }
  if (id.includes("/mermaid/") || id.includes("/@mermaid-js/") || id.includes("/katex/") || id.includes("/dompurify/") || id.includes("/marked/")) {
    return "vendor-mermaid";
  }
  if (id.includes("/monaco-editor/") || id.includes("/@monaco-editor/")) {
    return undefined;
  }
  if (id.includes("/@tiptap/") || id.includes("/prosemirror-")) {
    return undefined;
  }
  if (id.includes("/reactflow/") || id.includes("/@reactflow/") || id.includes("/d3") || id.includes("/cytoscape")) {
    return "vendor-graph";
  }
  if (id.includes("/sql-formatter/")) {
    return "vendor-editor";
  }

  return "vendor-core";
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(path) : Promise.resolve([path]);
    }),
  );
  return files.flat();
}

function precompressAssets() {
  return {
    name: "medata-precompress-assets",
    apply: "build" as const,
    async closeBundle() {
      const distDir = join(process.cwd(), "dist");
      const files = await listFiles(distDir);
      await Promise.all(
        files
          .filter((file) => /\.(js|css|html|svg|json)$/.test(file))
          .map(async (file) => {
            const source = await readFile(file);
            if (source.length < 1024) {
              return;
            }
            const [gzipped, brotlied] = await Promise.all([
              gzipAsync(source, { level: 9 }),
              brotliCompressAsync(source),
            ]);
            await Promise.all([
              writeFile(`${file}.gz`, gzipped),
              writeFile(`${file}.br`, brotlied),
            ]);
          }),
      );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    precompressAssets(),
    {
      name: "medata-dbx-entry-rewrite",
      configureServer(server) {
        server.middlewares.use(dbxEntryRewriteMiddleware());
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: splitVendorChunk,
      },
    },
  },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
      "/runtime": {
        target: proxyTarget,
        changeOrigin: true,
      },
      "/devtools/chartdb": {
        target: chartdbProxyTarget,
        changeOrigin: true,
      },
      "/devtools": {
        target: dbxProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
