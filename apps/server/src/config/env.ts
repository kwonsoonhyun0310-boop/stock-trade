import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

export const APP_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

dotenv.config({ path: resolve(APP_ROOT, ".env"), quiet: true });
dotenv.config({ quiet: true });

const booleanString = z
  .enum(["true", "false"])
  .optional()
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  PORT: z.coerce.number().optional().default(8787),
  KIS_ENV: z.enum(["real", "demo"]).optional().default("demo"),
  KIS_BASE_URL: z.string().url().optional().default("https://openapivts.koreainvestment.com:29443"),
  KIS_APP_KEY: z.string().optional().default(""),
  KIS_APP_SECRET: z.string().optional().default(""),
  KIS_ACCOUNT_NO: z.string().optional().default(""),
  KIS_ACCOUNT_PRODUCT_CODE: z.string().optional().default("01"),
  KIS_USD_EXCHANGE_CODES: z.string().optional().default("NASD,NYSE,AMEX"),
  AUTO_SELL_ENABLED: booleanString,
  AUTO_SELL_TARGET_PERCENT: z.coerce.number().optional().default(5),
  AUTO_SELL_POLL_INTERVAL_MS: z.coerce.number().optional().default(45_000),
  CODEX_CLI_PATH: z.string().optional().default("codex"),
  CODEX_MODEL: z.string().optional().default("gpt-5.2-codex"),
  MARKET_CACHE_TTL_MS: z.coerce.number().optional().default(900_000),
  FRONTEND_ORIGIN: z.string().optional().default("http://localhost:5173")
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  kisExchangeCodes: parsedEnv.KIS_USD_EXCHANGE_CODES.split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean) as Array<"NASD" | "NYSE" | "AMEX">,
  kisConfigured:
    parsedEnv.KIS_APP_KEY.length > 0 &&
    parsedEnv.KIS_APP_SECRET.length > 0 &&
    parsedEnv.KIS_ACCOUNT_NO.length > 0
};
