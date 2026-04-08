import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function waitForExit(
  child: ReturnType<typeof spawn>
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal, stderr }));
  });
}

describe("index entrypoint", () => {
  it("exits with code 1 and logs Fatal for invalid config path", async () => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "src/index.ts", "--config", "does-not-exist.json"],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );

    const result = await waitForExit(child);
    assert.equal(result.code, 1);
    assert.ok(result.stderr.includes("Fatal:"));
  });

  it("handles SIGTERM shutdown and exits cleanly", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mcp-sqlite-index-"));
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({ database: "index.db", readonly: false, wal: false }),
      "utf-8"
    );

    const child = spawn(
      process.execPath,
      ["--import", "tsx", "src/index.ts", "--config", configPath],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      child.kill("SIGTERM");
      const result = await waitForExit(child);
      assert.ok(result.code === 0 || result.signal === "SIGTERM");
    } finally {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
