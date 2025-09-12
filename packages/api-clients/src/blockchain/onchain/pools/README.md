# V3 Pool Analyzer

This module provides comprehensive analysis functionality for Uniswap V3 and PancakeSwap V3 pools, focusing on the BSC network. It uses a pure function design without class instantiation and integrates CoinGecko price data.

## Features

- ✅ Get pool address by token0, token1, and fee
- ✅ Get pool basic information (token ratio, liquidity, price, etc.)
- ✅ Analyze tick and liquidity distribution
- ✅ Calculate pool price from sqrtPriceX96
- ✅ **NEW**: Calculate maximum swap amount to reach next tick using TickMath
- ✅ **NEW**: Get token amounts and USD values for both upward and downward directions
- ✅ **NEW**: Analyze liquidity distribution and price impact for tick transitions
- ✅ Support Uniswap V3 and PancakeSwap V3 on BSC network
- ✅ Integrate CoinGecko real-time price data
- ✅ Configurable Factory address and RPC URL
- ✅ Pure function design, stateless
- ✅ Complete TypeScript type support

## Quick Start

### Installation

```bash
npm install @dex-ai/api-clients
```

### Basic Usage

```typescript
import {
  getPoolAddress,
  getPoolBaseInfo,
  getTickLiquidityDistribution,
  getPoolPrice,
} from "@dex-ai/api-clients";

// 1. Get pool address (using default configuration)
const usdtAddress =
  "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`;
const busdAddress =
  "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as `0x${string}`;
const fee = 500; // 0.05%

const poolAddress = await getPoolAddress(usdtAddress, busdAddress, fee);
console.log(`Pool address: ${poolAddress}`);

// 2. Get pool basic information (including real-time price data)
const poolInfo = await getPoolBaseInfo(poolAddress as `0x${string}`);
console.log(`Total liquidity: $${poolInfo.totalUSD.toFixed(2)}`);
console.log(`Token0 price: $${poolInfo.token0.priceUSD.toFixed(6)}`);
console.log(`Token1 price: $${poolInfo.token1.priceUSD.toFixed(6)}`);

// 3. Get tick and liquidity distribution
const distribution = await getTickLiquidityDistribution(
  poolAddress as `0x${string}`,
  10, // Get 10 ticks before and after current tick
);

// 4. Calculate pool price
const priceInfo = await getPoolPrice(poolAddress as `0x${string}`);
console.log(`Price ratio: ${priceInfo.priceRatio.toFixed(8)}`);
```

## Configuration Options

### Method 1: Using Predefined Configuration Keys

```typescript
// Use PancakeSwap V3 on BSC
const poolAddress = await getPoolAddress(
  usdtAddress,
  busdAddress,
  fee,
  "pancakeswap-v3-bsc",
);

// Use Uniswap V3 on BSC
const poolInfo = await getPoolBaseInfo(
  poolAddress as `0x${string}`,
  "uniswap-v3-bsc",
);
```

### Method 2: Using Custom Configuration

```typescript
const customConfig = {
  rpcUrl: "https://bsc-dataseed.binance.org",
  factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  chainId: 56,
  dexName: "Custom PancakeSwap V3",
  version: "v3",
  chainName: "Binance Smart Chain",
};

const poolAddress = await getPoolAddress(
  usdtAddress,
  busdAddress,
  fee,
  customConfig,
);
```

### Method 3: Using Default Configuration

```typescript
// Don't pass config parameter, use default PancakeSwap V3 on BSC
const poolAddress = await getPoolAddress(usdtAddress, busdAddress, fee);
```

## API Reference

### Core Functions

#### `getPoolAddress(token0, token1, fee, config?)`

Get pool address.

```typescript
function getPoolAddress(
  token0Address: `0x${string}`,
  token1Address: `0x${string}`,
  fee: number,
  config?: V3PoolConfig | string,
): Promise<string>;
```

#### `getPoolBaseInfo(poolAddress, config?)`

Get pool basic information, including real-time price data.

```typescript
function getPoolBaseInfo(
  poolAddress: `0x${string}`,
  config?: V3PoolConfig | string,
): Promise<PoolBaseInfo>;
```

#### `getTickLiquidityDistribution(poolAddress, count, config?)`

Get tick and liquidity distribution.

```typescript
function getTickLiquidityDistribution(
  poolAddress: `0x${string}`,
  count?: number,
  config?: V3PoolConfig | string,
): Promise<LiquidityInfo[]>;
```

#### `getPoolPrice(poolAddress, config?)`

Calculate pool price.

```typescript
function getPoolPrice(
  poolAddress: `0x${string}`,
  config?: V3PoolConfig | string,
): Promise<PoolPriceInfo>;
```

#### `getTickSwapCapacity(poolAddress, config?, includeUSD?)`

Calculate the maximum swap amount to reach the next tick using TickMath. This function provides detailed information about how much of each token needs to be swapped to move to the next or previous tick, including optional USD values and price impact analysis.

```typescript
function getTickSwapCapacity(
  poolAddress: `0x${string}`,
  config?: V3PoolConfig | string,
  includeUSD?: boolean, // Optional: whether to include USD calculations (default: false)
): Promise<TickSwapCapacity>;
```

**Parameters:**

- `poolAddress`: The pool address to analyze
- `config`: Optional pool configuration (defaults to PancakeSwap V3 on BSC)
- `includeUSD`: Optional boolean to control USD calculations (default: false)

**Performance Notes:**

- When `includeUSD = false`: Faster execution, no API calls, suitable for high-frequency calculations
- When `includeUSD = true`: Slower execution, includes CoinGecko API calls, provides USD value context

### Configuration Management Functions

#### `getDexConfig(dexKey)`

Get specified DEX configuration.

```typescript
function getDexConfig(dexKey: DexConfigKey): V3PoolConfig;
```

#### `getAvailableDexConfigs()`

Get all available DEX configuration keys.

```typescript
function getAvailableDexConfigs(): DexConfigKey[];
```

#### `getDexConfigsByChainId(chainId)`

Get DEX configuration by chain ID.

```typescript
function getDexConfigsByChainId(chainId: number): DexConfigKey[];
```

#### `validateConfig(config)`

Validate if configuration is valid.

```typescript
function validateConfig(config: V3PoolConfig): boolean;
```

## Data Types

### `PoolBaseInfo`

Pool basic information, including real-time price data.

```typescript
interface PoolBaseInfo {
  poolAddress: string;
  token0: TokenPriceInfo;
  token1: TokenPriceInfo;
  currentTick: number;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tickSpacing: number;
  token0Total: number;
  token1Total: number;
  token0TotalUSD: number;
  token1TotalUSD: number;
  totalUSD: number;
  tokenRatio: {
    token0Percent: number;
    token1Percent: number;
  };
}
```

### `TokenPriceInfo`

Token information, including price data.

```typescript
interface TokenPriceInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUSD: number; // Real-time USD price
  tokenBalance: number; // Token balance
  tokenUSD: number; // Token USD value
}
```

### `PoolPriceInfo`

Pool price information.

```typescript
interface PoolPriceInfo {
  token0Price: number;
  token1Price: number;
  priceRatio: number;
  sqrtPriceX96: bigint;
}
```

### `LiquidityInfo`

Liquidity information.

```typescript
interface LiquidityInfo {
  tick: number;
  currentTick: boolean; // Whether it's the current tick
  liquidityNet: bigint;
  liquidityGross: bigint;
  token0Amount: number;
  token1Amount: number;
  token0AmountUSD: number;
  token1AmountUSD: number;
  totalUSD: number;
  initialized: boolean;
}
```

### `TickSwapCapacity`

Tick swap capacity information, providing detailed data about maximum swap amounts to reach next/previous ticks.

```typescript
interface TickSwapCapacity {
  up: SwapAmountInfo; // Upward direction (next tick)
  down: SwapAmountInfoDown; // Downward direction (previous tick)
  current: CurrentTickInfo; // Current tick state
}

interface SwapAmountInfo {
  token0Amount: number; // Amount of token0 needed
  token1Amount: number; // Amount of token1 needed
  token0AmountUSD?: number; // Optional USD value of token0 amount
  token1AmountUSD?: number; // Optional USD value of token1 amount
  nextTick: number; // Target tick number
  nextRatio: number; // Price ratio at next tick
  ratioImpact: number; // Percentage price impact
  sqrtRatioNext: string; // sqrtPriceX96 at next tick
  direction: "ratio_up"; // Direction indicator
}

interface SwapAmountInfoDown {
  token0Amount: number; // Amount of token0 needed
  token1Amount: number; // Amount of token1 needed
  token0AmountUSD?: number; // Optional USD value of token0 amount
  token1AmountUSD?: number; // Optional USD value of token1 amount
  prevTick: number; // Target tick number
  prevRatio: number; // Price ratio at previous tick
  ratioImpact: number; // Percentage price impact
  sqrtRatioPrev: string; // sqrtPriceX96 at previous tick
  direction: "ratio_down"; // Direction indicator
}

interface CurrentTickInfo {
  currentTick: number; // Current tick number
  currentRatio: number; // Current price ratio
  sqrtRatioCurrent: string; // Current sqrtPriceX96
  liquidityDistribution: "token0" | "token1"; // Which token has more liquidity
  ratioImpact: number; // Percentage price impact to next tick
}
```

### `V3PoolConfig`

V3 Pool configuration.

```typescript
interface V3PoolConfig {
  rpcUrl: string;
  factoryAddress: string;
  chainId: number;
  dexName: string;
  version: string;
  chainName: string;
}
```

## Supported Configurations

Current version focuses on BSC network, supporting the following configurations:

| Configuration Key    | DEX            | Network | Chain ID | Factory Address                              |
| -------------------- | -------------- | ------- | -------- | -------------------------------------------- |
| `pancakeswap-v3-bsc` | PancakeSwap V3 | BSC     | 56       | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` |
| `uniswap-v3-bsc`     | Uniswap V3     | BSC     | 56       | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |

## Price Data Integration

### CoinGecko Integration

The module integrates CoinGecko API to obtain real-time price data:

- **Stablecoins**: USDT, USDC, BUSD, DAI use fixed price 1.0
- **Other Tokens**: Get real-time prices through CoinGecko API
- **Fallback Mechanism**: If CoinGecko query fails, use default price 0.1

### Price Query Process

1. Check if it's a stablecoin → Return fixed price
2. Query CoinGecko API → Get real-time price
3. Validate price validity → Ensure price > 0
4. Record query logs → For debugging
5. Fallback to default price → Ensure system stability

## Usage Examples

### Complete Analysis Process

```typescript
import {
  getPoolAddress,
  getPoolBaseInfo,
  getTickLiquidityDistribution,
  getPoolPrice,
  getAvailableDexConfigs,
} from "@dex-ai/api-clients";

async function analyzePool() {
  // Analyze USDT-BUSD pool
  const usdtAddress =
    "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`;
  const busdAddress =
    "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as `0x${string}`;
  const fee = 500;

  // 1. Get pool address
  const poolAddress = await getPoolAddress(usdtAddress, busdAddress, fee);

  // 2. Get basic information (including real-time price)
  const poolInfo = await getPoolBaseInfo(poolAddress as `0x${string}`);

  // 3. Get price information
  const priceInfo = await getPoolPrice(poolAddress as `0x${string}`);

  // 4. Get liquidity distribution
  const distribution = await getTickLiquidityDistribution(
    poolAddress as `0x${string}`,
    5,
  );

  return {
    poolAddress,
    poolInfo,
    priceInfo,
    distribution,
  };
}
```

### Batch Analysis of Multiple DEXes

```typescript
async function analyzeMultipleDexes() {
  const usdtAddress =
    "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`;
  const busdAddress =
    "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as `0x${string}`;
  const fee = 500;

  // Analyze all DEXes on BSC
  const bscConfigs = getAvailableDexConfigs().filter((key) =>
    key.includes("bsc"),
  );

  for (const configKey of bscConfigs) {
    console.log(`Analyzing ${configKey}...`);

    try {
      const config = getDexConfig(configKey);
      const poolAddress = await getPoolAddress(
        usdtAddress,
        busdAddress,
        fee,
        config,
      );

      const poolInfo = await getPoolBaseInfo(
        poolAddress as `0x${string}`,
        config,
      );

      console.log(`  Pool address: ${poolAddress}`);
      console.log(`  Total liquidity: $${poolInfo.totalUSD.toFixed(2)}`);
      console.log(`  Token0 price: $${poolInfo.token0.priceUSD.toFixed(6)}`);
      console.log(`  Token1 price: $${poolInfo.token1.priceUSD.toFixed(6)}\n`);
    } catch (error) {
      console.log(
        `  Analysis failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }
}
```

### Price Data Usage Example

```typescript
async function analyzeTokenPrices() {
  const poolAddress =
    "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

  const poolInfo = await getPoolBaseInfo(poolAddress);

  console.log("Token price information:");
  console.log(
    `  ${poolInfo.token0.symbol}: $${poolInfo.token0.priceUSD.toFixed(6)}`,
  );
  console.log(
    `  ${poolInfo.token1.symbol}: $${poolInfo.token1.priceUSD.toFixed(6)}`,
  );
  console.log(`  Total value: $${poolInfo.totalUSD.toFixed(2)}`);
  console.log(
    `  Ratio: ${poolInfo.tokenRatio.token0Percent.toFixed(2)}% : ${poolInfo.tokenRatio.token1Percent.toFixed(2)}%`,
  );
}
```

### Tick Swap Capacity Analysis Example

```typescript
async function analyzeTickSwapCapacity() {
  const poolAddress =
    "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

  // Example 1: Get tick swap capacity WITHOUT USD calculations (faster, no API calls)
  const swapCapacityWithoutUSD = await getTickSwapCapacity(
    poolAddress,
    undefined,
    false,
  );

  console.log("=== Without USD Calculations ===");
  console.log(`Current Tick: ${swapCapacityWithoutUSD.current.currentTick}`);
  console.log(
    `Current Ratio: ${swapCapacityWithoutUSD.current.currentRatio.toFixed(8)}`,
  );
  console.log(
    `Max Swap Token0: ${swapCapacityWithoutUSD.up.token0Amount.toFixed(6)}`,
  );
  console.log(
    `Max Swap Token1: ${swapCapacityWithoutUSD.up.token1Amount.toFixed(6)}`,
  );
  console.log(
    `USD Values: ${swapCapacityWithoutUSD.up.token0AmountUSD === undefined ? "Not calculated" : "Available"}\n`,
  );

  // Example 2: Get tick swap capacity WITH USD calculations (slower, includes API calls)
  const swapCapacityWithUSD = await getTickSwapCapacity(
    poolAddress,
    undefined,
    true,
  );

  console.log("=== With USD Calculations ===");
  console.log(`Current Tick: ${swapCapacityWithUSD.current.currentTick}`);
  console.log(
    `Current Ratio: ${swapCapacityWithUSD.current.currentRatio.toFixed(8)}`,
  );
  console.log(
    `Max Swap Token0: ${swapCapacityWithUSD.up.token0Amount.toFixed(6)} ($${swapCapacityWithUSD.up.token0AmountUSD?.toFixed(2)})`,
  );
  console.log(
    `Max Swap Token1: ${swapCapacityWithUSD.up.token1Amount.toFixed(6)} ($${swapCapacityWithUSD.up.token1AmountUSD?.toFixed(2)})`,
  );
  console.log(
    `Ratio Impact: ${swapCapacityWithUSD.up.ratioImpact.toFixed(4)}%\n`,
  );

  // Analysis insights
  console.log("=== Analysis Insights ===");
  if (swapCapacityWithUSD.current.liquidityDistribution === "token1") {
    console.log("• Liquidity mainly on token1 side - can swap token1 → token0");
    console.log("• To swap token0 → token1, need to move to next tick");
  } else {
    console.log("• Liquidity mainly on token0 side - can swap token0 → token1");
    console.log("• To swap token1 → token0, need to move to next tick");
  }

  // Performance comparison
  console.log("\n=== Performance Comparison ===");
  console.log(
    "• Without USD: Faster execution, no API calls, suitable for high-frequency calculations",
  );
  console.log(
    "• With USD: Slower execution, includes API calls, provides USD value context",
  );
}
```

## Error Handling

All functions may throw errors, it's recommended to use try-catch for error handling:

```typescript
try {
  const poolAddress = await getPoolAddress(token0, token1, fee);
  console.log(`Pool address: ${poolAddress}`);
} catch (error) {
  console.error("Failed to get pool address:", error);
  // Handle error...
}
```

## Notes

1. **Network Connection**: Ensure stable network connection to BSC RPC nodes
2. **CoinGecko API**: Price queries depend on CoinGecko API, ensure network connection is normal
3. **Rate Limiting**: CoinGecko API has rate limits, recommend controlling request frequency appropriately
4. **Price Fallback**: If real-time price cannot be obtained, the system will use default price
5. **Error Handling**: All functions may throw errors, please ensure appropriate error handling
6. **Type Safety**: Use TypeScript for complete type safety support
7. **BSC Focus**: Current version focuses on BSC network, extend configuration if other network support is needed

## Changelog

### v2.2.0

- ✅ **NEW**: Added optional USD calculation support to `getTickSwapCapacity`
- ✅ **NEW**: Added `includeUSD` parameter to control USD price fetching
- ✅ **NEW**: USD fields are now optional in `SwapAmountInfo` and `SwapAmountInfoDown` interfaces
- ✅ **NEW**: Performance optimization - skip API calls when USD not needed
- ✅ **ENHANCED**: Better performance for high-frequency calculations
- ✅ **ENHANCED**: More flexible API design for different use cases

### v2.1.0

- ✅ **NEW**: Added `getTickSwapCapacity` function for calculating maximum swap amounts to reach next/previous ticks
- ✅ **NEW**: Integrated TickMath for precise tick-to-price calculations
- ✅ **NEW**: Added comprehensive swap capacity analysis with USD values
- ✅ **NEW**: Added liquidity distribution analysis and price impact calculations
- ✅ **NEW**: Added support for both upward and downward tick transitions
- ✅ Enhanced type definitions with `TickSwapCapacity`, `SwapAmountInfo`, and related interfaces

### v2.0.0

- ✅ Simplified configuration structure, focusing on BSC network
- ✅ Integrated CoinGecko real-time price data
- ✅ Enhanced token price information structure
- ✅ Improved error handling and logging
- ✅ Optimized type definitions

## Contributing

Welcome to submit Issues and Pull Requests to improve this module.
