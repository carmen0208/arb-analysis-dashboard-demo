# OKX DEX API Client

OKX DEX API客户端的模块化实现，支持Rate Limit管理和多配置轮换。

## 📁 文件结构

```
okexchange/
├── config.ts          # 配置管理 (OkxDexConfig, 环境变量解析)
├── auth.ts            # 认证和签名 (API请求头生成)
├── dex.ts             # DEX核心功能 (swap quote主逻辑)
├── index.ts           # 统一导出
└── README.md          # 文档说明
```

## 🔧 模块说明

### `config.ts` - 配置管理

- **接口定义**: `OkxDexConfig`, `OkxDexMultiConfig`
- **环境变量解析**: 支持单配置和多配置格式
- **配置验证**: 确保必要字段完整
- **常量定义**: Rate Limit时间窗口等

### `auth.ts` - 认证和签名

- **签名生成**: OKX API请求签名逻辑
- **请求头创建**: 包含所有必要的认证信息
- **便捷函数**: 简化签名头的创建过程

### `dex.ts` - DEX核心功能

- **客户端创建**: `createOkxDexClient()`
- **Swap Quote**: 获取交换报价的主要逻辑
- **Rate Limit管理**: 自动处理API调用限制
- **工厂函数**: 特定用途的客户端创建器

## 🚀 使用方式

### 基本使用

```typescript
import { createOkxDexClient } from "./okexchange";

const client = createOkxDexClient();
const quote = await client.getSwapQuote({
  fromTokenAddress: "0x...",
  toTokenAddress: "0x...",
  amount: "1000000000000000000",
});
```

### 环境变量配置

```bash
# 单配置
OKX_ACCESS_DEX_API_KEY=your_key
OKX_ACCESS_DEX_SECRET_KEY=your_secret
OKX_ACCESS_DEX_PASSPHRASE=your_passphrase
OKX_ACCESS_DEX_PROJECT_ID=your_project_id

# 多配置 (支持轮换)
OKX_ACCESS_DEX_CONFIGS=key1:secret1:pass1:proj1,key2:secret2:pass2:proj2
```

## ⚡ Rate Limit管理

- **时间窗口**: 60秒/次调用限制
- **自动轮换**: 多配置自动切换
- **智能等待**: 主动管理冷却时间
- **状态监控**: 实时查看配置状态

## 🔄 重构历史

这个模块化结构是从单一的`dex.ts`文件重构而来：

1. **✅ 已拆分**: 配置管理 → `config.ts`
2. **✅ 已拆分**: 认证签名 → `auth.ts`
3. **✅ 已简化**: DEX核心逻辑保留在 `dex.ts`
4. **🔄 TODO**: Rate Limit管理器将移动到 `@dex-ai/core` 包

## 📋 TODO

- [ ] 将 `RateLimitWindowManager` 移动到 `@dex-ai/core`
- [ ] 完善单元测试覆盖
- [ ] 添加性能监控和指标
- [ ] 支持更多OKX API端点
