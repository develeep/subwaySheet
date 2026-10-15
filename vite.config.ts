import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // @web/* · @shared/* · @batch/* 별칭은 tsconfig.json paths 하나에서 읽는다.
  resolve: { tsconfigPaths: true },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "prototypes/**"],
    coverage: {
      provider: "v8",
      // 화면 컴포넌트는 단위 테스트하지 않는다(스펙 #2). 추천 모듈·순수 함수(web/utils)·배치·공통 형식만 잰다.
      include: ["shared/**/*.ts", "batch/**/*.ts", "web/recommend/**/*.ts", "web/utils/**/*.ts"],
      exclude: ["**/*.test.ts", "**/fixtures/**", "batch/main.ts", "batch/fetch-fast-exit.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
