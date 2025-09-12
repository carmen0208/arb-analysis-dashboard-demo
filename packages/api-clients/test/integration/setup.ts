import { config } from "dotenv";
import { resolve } from "path";
import { Octokit } from "@octokit/rest";

// Load environment variables from .env file
config({ path: resolve(__dirname, "../../.env") });

export const requiredOctokitEnvVars = [
  "GITHUB_TOKEN",
  "GITHUB_TEST_REPO_OWNER",
  "GITHUB_TEST_REPO_NAME",
] as const;

export const requiredCoinGeckoEnvVars = ["COINGECKO_API_KEY"] as const;

export function validateEnv(vars: readonly string[]) {
  const missingVars = vars.filter((name) => !process.env[name]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}\n` +
        "Please create a .env file in the packages/api-clients directory with these variables.",
    );
  }
}

export function createTestOctokit(): Octokit {
  validateEnv(requiredOctokitEnvVars);
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

export function setupCoinGecko(): void {
  validateEnv(requiredCoinGeckoEnvVars);
}

export function getYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString();
}

export const testRepoOwner = process.env.GITHUB_TEST_REPO_OWNER!;
export const testRepoName = process.env.GITHUB_TEST_REPO_NAME!;
