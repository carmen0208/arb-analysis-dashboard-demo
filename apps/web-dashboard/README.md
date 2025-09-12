## Query Example:

- To get the best price from pancake swap

* Local: http://localhost:3000
* Remote: https://0x-dev-ai-web-dashboard.vercel.app/api/clients/blockchain/pancake/getBestPrices

```sh
curl -X POST http://localhost:3000/api/clients/blockchain/pancake/getBestPrices \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '{
    "toTokens": [
      {
        "address": "0xc71b5f631354be6853efe9c3ab6b9590f8302e81",
        "symbol": "ZKJ"
      },
      {
        "address": "0xa0c56a8c0692bd10b3fa8f8ba79cf5332b7107f9",
        "symbol": "MERL"
      },
      {
        "address": "0x783c3f003f172c6ac5ac700218a357d2d66ee2a2",
        "symbol": "B2"
      },
      {
        "address": "0x6bdcce4a559076e37755a78ce0c06214e59e4444",
        "symbol": "B"
      }
    ]
  }' | jq
```

- Get Coin Info

```sh
curl -X POST "https://0x-dev-ai-web-dashboard.vercel.app/api/clients/blockchain/getCoinInfo" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '"CA"'
```

```sh
curl -X POST "http://localhost:3000/api/clients/blockchain/getCoinInfoBySymbol" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '"CA"' |jq
```

- Get coin price

```sh
curl -X POST "http://localhost:3000/api/clients/blockchain/getCoinPrice" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '"caila"'| jq
```

- Get coin ticker(exchanges, markets)

```sh
curl -X POST "http://localhost:3000/api/clients/blockchain/getCoinTickers" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '"la"' |jq
```

- Get Coin address

```sh
 curl -X POST "http://localhost:3000/api/clients/blockchain/getCoinAddresses" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '"caila"'| jq
```

- Get Pool Info

```sh
 curl -X POST "http://localhost:3000/api/clients/blockchain/getTokenPools" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '{"tokenAddress":"0x74da4c5f8c254dd4fb39f9804c0924f52a808318","chain":"bsc"}'| jq
```

- Fetch Social Media

```sh
curl -X POST "http://localhost:3000/api/clients/social/fetchCoinTweets" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '{"query":"binance alpha","count":3}' |jq
```

- Search Coin

```sh
curl -X POST "http://localhost:3000/api/clients/blockchain/aggregator/searchTokens" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '{"query":"ETH","limit":5}' |jq
```

- Fetch All Info At Once

```sh
curl -X POST "http://localhost:3000/api/clients/blockchain/aggregator/getTokenDetails" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-API-KEY" \
  -d '{"tokenId":"caila","chain":"0x56"}'| jq
```
