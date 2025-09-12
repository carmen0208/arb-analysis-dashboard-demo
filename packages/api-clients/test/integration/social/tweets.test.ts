import { describe, it, expect } from "vitest";
// import crypto from "crypto";
import { fetchCoinTweets, UnifiedTweet } from "../../../src/social/twitter";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { getCoinTweetsCacheFile } from "../utils/coinTweetsCacheFile";

// 测试参数（请确保 .env 配置正确，避免频繁请求同一关键词）
const baseParams = {
  query: "bitcoin",
  count: 3,
};

function deleteCoinTweetsCache(params: any) {
  const cacheFile = getCoinTweetsCacheFile(params);
  if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
}

describe("fetchCoinTweets integration", () => {
  // it("generate api key", () => {
  //   logger.info(crypto.randomBytes(32).toString("hex"));
  // });
  it("should fetch unified tweets by keyword", async () => {
    const params = baseParams;
    const tweets = await fetchCoinTweets(params);
    expect(Array.isArray(tweets)).toBe(true);
    expect(tweets.length).toBeGreaterThan(0);
    const t: UnifiedTweet = tweets[0];
    expect(typeof t.id).toBe("string");
    expect(typeof t.text).toBe("string");
    expect(typeof t.fullText).toBe("string");
    expect(typeof t.createdAt).toBe("string");
    expect(typeof t.username).toBe("string");
    expect(typeof t.userId).toBe("string");
    expect(Array.isArray(t.hashtags)).toBe(true);
    expect(Array.isArray(t.urls)).toBe(true);
    expect(typeof t.likes).toBe("number");
    expect(typeof t.retweets).toBe("number");
    expect(typeof t.replies).toBe("number");
    expect(["agent", "socialdata"]).toContain(t.source);
    expect(t.raw).toBeDefined();
    deleteCoinTweetsCache(params);
  });

  it("should fetch unified tweets by author", async () => {
    const params = { ...baseParams, author: "elonmusk" };
    const tweets = await fetchCoinTweets(params);
    expect(Array.isArray(tweets)).toBe(true);
    expect(tweets.length).toBeGreaterThan(0);
    const t: UnifiedTweet = tweets[0];
    expect(typeof t.username).toBe("string");
    expect(t.username?.toLowerCase()).toBe("elonmusk");
    deleteCoinTweetsCache(params);
  });

  it("should fetch unified tweets by hashtag", async () => {
    const params = { ...baseParams, hashtags: ["bitcoin"] };
    const tweets = await fetchCoinTweets(params);
    expect(Array.isArray(tweets)).toBe(true);
    expect(tweets.length).toBeGreaterThan(0);
    // hashtag 检查（部分推文可能未命中，宽松断言）
    expect(
      tweets.some(
        (t) =>
          Array.isArray(t.hashtags) &&
          t.hashtags.map((h) => h.toLowerCase()).includes("bitcoin"),
      ),
    ).toBe(true);
    deleteCoinTweetsCache(params);
  });

  it("should fetch unified tweets by language (if available)", async () => {
    const params = { ...baseParams, lang: "en" };
    const tweets = await fetchCoinTweets(params);
    expect(Array.isArray(tweets)).toBe(true);
    expect(tweets.length).toBeGreaterThan(0);
    // lang 字段有可能为 undefined（agent 来源），只要 socialdata 来源有 lang
    expect(tweets.some((t) => t.lang === undefined || t.lang === "en")).toBe(
      true,
    );
    deleteCoinTweetsCache(params);
  });

  it("should fetch unified tweets by time range", async () => {
    // 近两天
    const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const params = { ...baseParams, since, until };
    const tweets = await fetchCoinTweets(params);
    expect(Array.isArray(tweets)).toBe(true);
    expect(tweets.length).toBeGreaterThan(0);
    // createdAt 字段应为字符串
    expect(typeof tweets[0].createdAt).toBe("string");
    deleteCoinTweetsCache(params);
  });

  it("should hit cache on repeated query and return unified structure", async () => {
    const params = baseParams;
    const t1 = await fetchCoinTweets(params);
    const t2 = await fetchCoinTweets(params);
    expect(JSON.stringify(t1)).toBe(JSON.stringify(t2));
    expect(Array.isArray(t1)).toBe(true);
    expect(typeof t1[0].id).toBe("string");
    deleteCoinTweetsCache(params);
  });

  it("should return [] on invalid params", async () => {
    const params = { query: "", count: 2 };
    const tweets = await fetchCoinTweets(params);
    expect(Array.isArray(tweets)).toBe(true);
    expect(tweets.length).toBe(0);
    deleteCoinTweetsCache(params);
  });
});
