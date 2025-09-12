# DexAI - Intelligent Open Source Project Discovery & Analysis

DexAI is an AI-powered assistant that helps you discover, analyze, and contribute to high-quality open source projects in the blockchain and AI domains.

## Features

- **Discover** trending blockchain and AI projects from GitHub, social media, and on-chain data
- **Analyze** project architecture, tech stack, pain points, and contribution opportunities
- **Generate** technical evaluations, learning guides, and contribution guidelines
- **Track** your discoveries and analyses in a knowledge management system

## Project Structure

This project is organized as a monorepo using pnpm workspaces and Turborepo:

```
dex-ai/
├── agents/                         # Agent implementations
│   ├── discovery-agent/            # Project discovery and analysis agent
│   └── common/                     # Shared agent utilities
├── apps/                           # Frontend applications
│   └── web-dashboard/              # Next.js web interface
├── packages/                       # Shared libraries
│   ├── core/                       # Core functionality
│   ├── api-clients/                # External API integrations
│   ├── ai/                         # AI and LLM utilities
│   └── db/                         # Database access
├── services/                       # Backend services
│   ├── api-server/                 # REST API server
│   └── workers/                    # Background workers
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/dex-ai.git
   cd dex-ai
   ```

2. Install dependencies:
   ```
   pnpm install
   ```

3. Set up environment variables:
   ```
   cp .env.example .env.local
   ```
   Edit `.env.local` with your API keys and configuration.

4. Start the development environment:
   ```
   pnpm dev
   ```

## Development

- `pnpm build`: Build all packages and applications
- `pnpm dev`: Start development servers
- `pnpm test`: Run tests
- `pnpm lint`: Lint code

## License

MIT 