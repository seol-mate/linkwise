import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // 기본은 node. DOM이 필요한 테스트 파일만 맨 위에 `// @vitest-environment jsdom`을 붙인다.
    // jsdom은 파일마다 새로 만들어져 비용이 크기 때문에 전체 기본값으로 쓰지 않는다.
    environment: "node",
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
});
