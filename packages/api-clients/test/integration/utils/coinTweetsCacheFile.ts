import * as path from "path";
import crypto from "crypto";

function buildCoinTweetsCacheKey(params: {
  query: string;
  author?: string;
  since?: string;
  until?: string;
  count?: number;
  lang?: string;
  hashtags?: string[];
}): string {
  const cacheKeyRaw = JSON.stringify(params);
  return crypto.createHash("md5").update(cacheKeyRaw).digest("hex");
}

export function getCoinTweetsCacheFile(params: {
  query: string;
  author?: string;
  since?: string;
  until?: string;
  count?: number;
  lang?: string;
  hashtags?: string[];
}): string {
  const cacheKey = buildCoinTweetsCacheKey(params);
  return path.join(process.cwd(), ".cache", "coin-tweets", `${cacheKey}.json`);
}
