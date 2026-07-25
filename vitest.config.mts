import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: [
      {
        find: /^react$/,
        replacement: path.resolve(
          __dirname,
          "node_modules/next/dist/compiled/react/react.react-server.js"
        ),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "."),
      },
    ],
  },
});
