var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { brotliCompress, gzip } from "node:zlib";
import { promisify } from "node:util";
var proxyTarget = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:46121";
var dbxProxyTarget = process.env.VITE_DBX_PROXY_TARGET || "http://127.0.0.1:45123";
var chartdbProxyTarget = process.env.VITE_CHARTDB_PROXY_TARGET || "http://127.0.0.1:45124";
var gzipAsync = promisify(gzip);
var brotliCompressAsync = promisify(brotliCompress);
function dbxEntryRewriteMiddleware() {
    return function (req, _res, next) {
        if (req.url === "/devtools/dbx/") {
            req.url = "/devtools/dbx";
        }
        next();
    };
}
function splitVendorChunk(id) {
    if (!id.includes("node_modules")) {
        return undefined;
    }
    if (id.includes("/react/") ||
        id.includes("/react-dom/") ||
        id.includes("/react-router") ||
        id.includes("/scheduler/") ||
        id.includes("/antd/") ||
        id.includes("/@ant-design/") ||
        id.includes("/@rc-component/") ||
        id.includes("/rc-")) {
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
function listFiles(dir) {
    return __awaiter(this, void 0, void 0, function () {
        var entries, files;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readdir(dir, { withFileTypes: true })];
                case 1:
                    entries = _a.sent();
                    return [4 /*yield*/, Promise.all(entries.map(function (entry) {
                            var path = join(dir, entry.name);
                            return entry.isDirectory() ? listFiles(path) : Promise.resolve([path]);
                        }))];
                case 2:
                    files = _a.sent();
                    return [2 /*return*/, files.flat()];
            }
        });
    });
}
function precompressAssets() {
    return {
        name: "medata-precompress-assets",
        apply: "build",
        closeBundle: function () {
            return __awaiter(this, void 0, void 0, function () {
                var distDir, files;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            distDir = join(process.cwd(), "dist");
                            return [4 /*yield*/, listFiles(distDir)];
                        case 1:
                            files = _a.sent();
                            return [4 /*yield*/, Promise.all(files
                                    .filter(function (file) { return /\.(js|css|html|svg|json)$/.test(file); })
                                    .map(function (file) { return __awaiter(_this, void 0, void 0, function () {
                                    var source, _a, gzipped, brotlied;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, readFile(file)];
                                            case 1:
                                                source = _b.sent();
                                                if (source.length < 1024) {
                                                    return [2 /*return*/];
                                                }
                                                return [4 /*yield*/, Promise.all([
                                                        gzipAsync(source, { level: 9 }),
                                                        brotliCompressAsync(source),
                                                    ])];
                                            case 2:
                                                _a = _b.sent(), gzipped = _a[0], brotlied = _a[1];
                                                return [4 /*yield*/, Promise.all([
                                                        writeFile("".concat(file, ".gz"), gzipped),
                                                        writeFile("".concat(file, ".br"), brotlied),
                                                    ])];
                                            case 3:
                                                _b.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); }))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
export default defineConfig({
    plugins: [
        react(),
        precompressAssets(),
        {
            name: "medata-dbx-entry-rewrite",
            configureServer: function (server) {
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
