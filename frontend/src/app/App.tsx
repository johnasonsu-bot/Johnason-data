import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { RouterProvider } from "react-router-dom";
import { medataAntdTheme } from "../design-system";
import { ServiceUsageLoopRunner } from "../pages/data-services/ServiceUsageLoopRunner";
import { AuthProvider } from "./providers/AuthProvider";
import { ProjectProvider } from "./providers/ProjectProvider";
import { router } from "./router";

export function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      wave={{ disabled: true }}
      theme={medataAntdTheme}
    >
      <AntdApp>
        <AuthProvider>
          <ProjectProvider>
            <ServiceUsageLoopRunner />
            <RouterProvider router={router} />
          </ProjectProvider>
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
