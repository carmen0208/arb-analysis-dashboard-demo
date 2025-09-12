/// <reference types="jest" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimitManager } from "./rateLimitManager";

// Mock Redis client
vi.mock("./redis", () => ({
  getRedisClient: vi.fn(() => ({
    hgetall: vi.fn(),
    hset: vi.fn(),
    hdel: vi.fn(),
  })),
}));

vi.mock("./logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("RateLimitManager", () => {
  let mockRedis: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedis = {
      hgetall: vi.fn(),
      hset: vi.fn(),
      hdel: vi.fn(),
    };
    const { getRedisClient } = await import("./redis");
    (getRedisClient as any).mockReturnValue(mockRedis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with default maxWaitMs", () => {
      const configs = [{ apiKey: "test1" }, { apiKey: "test2" }];
      const manager = new RateLimitManager(configs, 1000, "test-service");

      expect(manager.getMaxWaitMs()).toBe(6000); // 1000 + 5000
    });

    it("should initialize with custom maxWaitMs", () => {
      const configs = [{ apiKey: "test1" }, { apiKey: "test2" }];
      const manager = new RateLimitManager(
        configs,
        1000,
        "test-service",
        10000,
      );

      expect(manager.getMaxWaitMs()).toBe(10000);
    });

    it("should throw error if serviceName is empty", () => {
      const configs = [{ apiKey: "test1" }];

      expect(() => {
        new RateLimitManager(configs, 1000, "");
      }).toThrow("A serviceName is required for the RateLimitManager.");
    });
  });

  describe("getConfig", () => {
    it("should return a predictable available config when none are in use", async () => {
      // Control the shuffle to be predictable by mocking Math.random
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9); // Sorts descending

      const configs = [{ apiKey: "test1" }, { apiKey: "test2" }];
      const manager = new RateLimitManager(configs, 1000, "test-service");

      mockRedis.hgetall.mockResolvedValue({});

      const config = await manager.getConfig();

      // With descending sort, shuffled indices will be [1, 0].
      // It should pick index 1 first.
      expect(config).toEqual({ apiKey: "test1" });

      // Verify Redis was called with the correct index
      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      const [, updateData] = mockRedis.hset.mock.calls[0];
      expect(updateData).toEqual({
        "0": expect.stringContaining("lastUsedTime"),
      });

      randomSpy.mockRestore();
    });

    it("should return an available config when some are in cooldown", async () => {
      // This test is deterministic because there is only one available key.
      const configs = [{ apiKey: "test1" }, { apiKey: "test2" }];
      const manager = new RateLimitManager(configs, 1000, "test-service");

      const now = Date.now();
      const oneSecondAgo = now - 500; // Still in cooldown
      const twoSecondsAgo = now - 2000; // Available

      mockRedis.hgetall.mockResolvedValue({
        "0": JSON.stringify({ lastUsedTime: oneSecondAgo }),
        "1": JSON.stringify({ lastUsedTime: twoSecondsAgo }),
      });

      const config = await manager.getConfig();

      // Only config 1 is available, so the result is predictable.
      expect(config).toEqual({ apiKey: "test2" });

      // Verify Redis was called with the correct index
      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      const [, updateData] = mockRedis.hset.mock.calls[0];
      expect(updateData).toEqual({
        "1": expect.stringContaining("lastUsedTime"),
      });
    });

    it("should return a predictable available config when multiple are available", async () => {
      // Control the shuffle to be predictable by mocking Math.random
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9); // Sorts descending

      const configs = [
        { apiKey: "test1" },
        { apiKey: "test2" },
        { apiKey: "test3" },
      ];
      const manager = new RateLimitManager(configs, 1000, "test-service");

      const now = Date.now();
      const oneSecondAgo = now - 500; // Still in cooldown
      const twoSecondsAgo = now - 2000; // Available

      mockRedis.hgetall.mockResolvedValue({
        "0": JSON.stringify({ lastUsedTime: oneSecondAgo }), // In cooldown
        "1": JSON.stringify({ lastUsedTime: twoSecondsAgo }), // Available
        // "2" not present - never used, so available
      });

      const config = await manager.getConfig();

      // With descending sort, shuffled indices will be [2, 1, 0].
      // It will check index 2 first, which is available.
      expect(config).toEqual({ apiKey: "test2" });

      // Verify Redis was called with the correct index
      expect(mockRedis.hset).toHaveBeenCalledTimes(1);
      const [, updateData] = mockRedis.hset.mock.calls[0];
      expect(updateData).toEqual({
        "1": expect.stringContaining("lastUsedTime"),
      });

      randomSpy.mockRestore();
    });

    it("should prevent infinite recursion", async () => {
      let hgetallCallCount = 0;
      vi.useFakeTimers();

      try {
        const manager = new RateLimitManager(
          [{ apiKey: "test1" }],
          1000,
          "test-service",
          5000,
        );

        mockRedis.hgetall.mockImplementation(() => {
          hgetallCallCount++;
          // Always return a key that is on cooldown relative to the current fake time
          return Promise.resolve({
            "0": JSON.stringify({ lastUsedTime: Date.now() - 500 }),
          });
        });

        const promise = manager.getConfig();

        // Run all scheduled timers. Since the waits are chained recursively,
        // this will trigger the whole sequence until the promise settles.
        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow(
          "Unable to find available configuration after 3 attempts",
        );

        // It should call hgetall for recursion depths 0, 1, and 2.
        // The check for depth 3 happens *before* hgetall is called.
        expect(hgetallCallCount).toBe(3);
      } finally {
        // This is crucial: ensure real timers are restored even if the test fails.
        vi.useRealTimers();
      }
    });

    it("should enforce maximum wait time", async () => {
      const configs = [{ apiKey: "test1" }];
      const manager = new RateLimitManager(configs, 1000, "test-service", 1000); // 1 second max wait

      const now = Date.now();
      const lastUsedTimeInFuture = now + 5000; // Key available in 5s + 1s = 6s

      mockRedis.hgetall.mockResolvedValue({
        "0": JSON.stringify({ lastUsedTime: lastUsedTimeInFuture }),
      });

      // Use a very specific regex to match the entire error message structure.
      const expectedErrorPattern =
        /^\[test-service\] Required wait time \(\d+s\) would exceed maximum allowed \(\d+s\)\. Consider adding more API configurations or increasing rate limit windows\.$/;

      await expect(manager.getConfig()).rejects.toThrow(expectedErrorPattern);
    });

    it("should throw error when no configs provided", async () => {
      const manager = new RateLimitManager([], 1000, "test-service");

      await expect(manager.getConfig()).rejects.toThrow(
        "No available configuration found.",
      );
    });
  });

  describe("getUsageStats", () => {
    it("should return correct usage statistics", async () => {
      const configs = [
        { apiKey: "test1" },
        { apiKey: "test2" },
        { apiKey: "test3" },
      ];
      const manager = new RateLimitManager(configs, 1000, "test-service");

      const now = Date.now();
      const oneSecondAgo = now - 500; // In cooldown
      const twoSecondsAgo = now - 2000; // Available

      mockRedis.hgetall.mockResolvedValue({
        "0": JSON.stringify({ lastUsedTime: oneSecondAgo }),
        "1": JSON.stringify({ lastUsedTime: twoSecondsAgo }),
        // "2" not present - never used
      });

      const stats = await manager.getUsageStats();

      expect(stats).toEqual({
        totalConfigs: 3,
        availableConfigs: 2, // config 1 and 3
        cooldownConfigs: 1, // config 0
        soonestAvailableTime: oneSecondAgo + 1000,
      });
    });

    it("should handle corrupted data gracefully", async () => {
      const configs = [{ apiKey: "test1" }, { apiKey: "test2" }];
      const manager = new RateLimitManager(configs, 1000, "test-service");

      mockRedis.hgetall.mockResolvedValue({
        "0": "invalid json",
        "1": JSON.stringify({ lastUsedTime: Date.now() - 2000 }),
      });

      const stats = await manager.getUsageStats();

      expect(stats).toEqual({
        totalConfigs: 2,
        availableConfigs: 2, // config 0 (corrupted data treated as never used) and config 1
        cooldownConfigs: 0,
        soonestAvailableTime: undefined,
      });
    });
  });

  describe("clearStaleUsageData", () => {
    it("should clear stale usage data", async () => {
      const configs = [{ apiKey: "test1" }, { apiKey: "test2" }];
      const manager = new RateLimitManager(configs, 1000, "test-service");

      const now = Date.now();
      const staleTime = now - 3000; // Older than 2x rate limit duration
      const recentTime = now - 500; // Recent

      mockRedis.hgetall.mockResolvedValue({
        "0": JSON.stringify({ lastUsedTime: staleTime }),
        "1": JSON.stringify({ lastUsedTime: recentTime }),
      });

      await manager.clearStaleUsageData();

      expect(mockRedis.hdel).toHaveBeenCalledWith(expect.any(String), "0");
    });

    it("should clear corrupted data", async () => {
      const configs = [{ apiKey: "test1" }];
      const manager = new RateLimitManager(configs, 1000, "test-service");

      mockRedis.hgetall.mockResolvedValue({
        "0": "invalid json",
      });

      await manager.clearStaleUsageData();

      expect(mockRedis.hdel).toHaveBeenCalledWith(expect.any(String), "0");
    });

    it("should do nothing when no stale data exists", async () => {
      const configs = [{ apiKey: "test1" }];
      const manager = new RateLimitManager(configs, 1000, "test-service");

      const now = Date.now();
      const recentTime = now - 500; // Recent

      mockRedis.hgetall.mockResolvedValue({
        "0": JSON.stringify({ lastUsedTime: recentTime }),
      });

      await manager.clearStaleUsageData();

      expect(mockRedis.hdel).not.toHaveBeenCalled();
    });
  });
});
