import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AnalysisSection } from "@trade/shared";
import { env } from "../../config/env.js";

const execFileAsync = promisify(execFile);

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          bullets: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string" }
          },
          confidence: {
            type: "string",
            enum: ["low", "medium", "high"]
          }
        },
        required: ["title", "summary", "bullets", "confidence"]
      }
    }
  },
  required: ["sections"]
} as const;

export class CodexCliProvider {
  async getLoginStatus(): Promise<string> {
    try {
      const { stdout, stderr } = await execFileAsync(env.CODEX_CLI_PATH, ["login", "status"], {
        timeout: 10_000
      });
      return (stdout || stderr).trim();
    } catch (error) {
      return `Unavailable: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  }

  async analyzeMarket(payload: unknown): Promise<AnalysisSection[]> {
    const workingDirectory = await mkdtemp(join(tmpdir(), "codex-market-"));
    const schemaPath = join(workingDirectory, "schema.json");
    const outputPath = join(workingDirectory, "output.json");

    const prompt = [
      "You are analyzing US equities for an informational dashboard.",
      "Use the structured market data below.",
      "Do not give personalized financial advice or tell the user what to buy.",
      "Focus on market structure, quality leaders, trend strength, and key risks.",
      "Return Korean text because the dashboard user is Korean.",
      JSON.stringify(payload, null, 2)
    ].join("\n\n");

    try {
      await writeFile(schemaPath, JSON.stringify(ANALYSIS_SCHEMA, null, 2), "utf8");

      await execFileAsync(
        env.CODEX_CLI_PATH,
        [
          "exec",
          "-m",
          env.CODEX_MODEL,
          "--skip-git-repo-check",
          "-s",
          "read-only",
          "--output-schema",
          schemaPath,
          "-o",
          outputPath,
          prompt
        ],
        {
          timeout: 180_000,
          maxBuffer: 1024 * 1024 * 4
        }
      );

      const raw = await readFile(outputPath, "utf8");
      const parsed = JSON.parse(raw) as { sections: AnalysisSection[] };
      return parsed.sections;
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  }
}
