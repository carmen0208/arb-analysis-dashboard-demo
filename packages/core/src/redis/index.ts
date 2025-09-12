import { createClient, RedisClientType } from "redis";

let redis: RedisClientType | undefined;
let redisInitPromise: Promise<RedisClientType> | undefined;

/**
 * Lazily creates and returns a singleton Redis client using the 'redis' package.
 * Ensures the client is connected before returning.
 * Throws if REDIS_URL is not set.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redis) return redis;
  if (!redisInitPromise) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error(
        "Redis environment variable (REDIS_URL) is not set for a component that requires it in production.",
      );
    }
    const client: RedisClientType = createClient({ url });
    redisInitPromise = client.connect().then(() => {
      redis = client;
      return client;
    });
  }
  return redisInitPromise;
}
