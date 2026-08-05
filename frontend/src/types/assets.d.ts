declare module "*.css?raw" {
  const content: string;
  export default content;
}

declare module "*.jsx" {
  import type { ComponentType } from "react";

  const Component: ComponentType<any>;
  export default Component;
}
