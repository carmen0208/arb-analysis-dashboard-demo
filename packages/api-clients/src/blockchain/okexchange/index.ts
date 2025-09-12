/**
 * OKX DEX API Integration
 * 统一导出所有OKX DEX相关功能
 */

// 配置管理
export * from "./config";

// 认证和签名
export * from "./auth";

// DEX核心功能
export * from "./dex";

// 重新导出常用类型（为了向后兼容）
export type { SwapQuote } from "../types";

/**
 * 使用示例:
 *
 * import { createOkxDexClient, OkxDexConfig } from "@dex-ai/api-clients/blockchain/okexchange";
 *
 * const client = createOkxDexClient();
 * const quote = await client.getSwapQuote({
 *   fromTokenAddress: "0x...",
 *   toTokenAddress: "0x...",
 *   amount: "1000000000000000000"
 * });
 */
