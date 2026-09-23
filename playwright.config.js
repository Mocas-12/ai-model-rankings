const { defineConfig } = require("@playwright/test");

// 端口用 TEST_PORT 覆盖；默认 8938，避开本机常驻服务与 photochange 的 8931
const PORT = Number(process.env.TEST_PORT) || 8938;

module.exports = defineConfig({
  testDir: "tests",
  timeout: 60000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 960 },
  },
  webServer: {
    command: "node tests/static-server.mjs",
    port: PORT,
    env: { TEST_PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
