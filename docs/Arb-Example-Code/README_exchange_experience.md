# Exchange Experience Demo

This repository contains a set of TypeScript modules that demonstrate my hands-on experience with exchange-style systems.
While not a full exchange backend, these components cover the essential building blocks that real-world exchanges and trading systems rely on.

## Contents

- **Fetch Price / [binance, bybit, bitget](../../packages/api-clients/src/blockchain/)**
  - Connects to CEX via WebSocket and REST.
  - Maintains a synchronized orderbook, handling updates and consistency checks.
  - Demonstrates familiarity with high-throughput, low-latency data feeds.

- **Okx Dex - [swapOperations.ts](./Okx%20Dex%20-%20swapOperations.ts)**
  - Implements swap logic on OKX DEX.
  - Shows how to handle on-chain swap operations and integrate with decentralized exchanges.

- **[orderHandlers.ts](./orderHandlers.ts)**
  - Provides utilities for handling trade execution logic.
  - Manages orders and integrates with arbitrage or spread-based strategies.

- **[spread.ts](./spread.ts)**
  - Contains logic for spread calculations.
  - Useful in arbitrage and price efficiency monitoring across markets.

- **[Pool distribution](../../packages/api-clients/src/blockchain/onchain/pools/ticks.ts)**
  - Works with Uniswap V3 pool ticks.
  - Demonstrates understanding of concentrated liquidity, tick ranges, and how liquidity impacts price execution.

### This demo covers:

- Connect to exchanges, consume real-time data, and maintain synchronization.
- Interact with decentralized liquidity sources and execute swaps.
- Designing or integrating **execution strategies** like arbitrage or routing.
- Implement trading logic such as spread calculation and arbitrage handling.
- Analyze Uniswap V3-style liquidity distribution.

---

**Note:** Only selected portions of the code are shared for demonstration purposes. This code is meant as a **demonstration of capability** rather than a production-ready system. It is not intended to showcase engineering practices such as test coverage, deployment pipelines.
