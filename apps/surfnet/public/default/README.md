# Getting Started with Surfnet

## Overview

Surfnet is a testnet environment that mirrors the Solana mainnet, providing developers with a safe space to test their applications before deployment.

## Quick Start

### 1. Configure Your Wallet

Connect your Solana wallet to the Surfnet testnet:

```bash
solana config set --url http://localhost:8899
```

### 2. Request Test Tokens

Use the faucet on the right to request test SOL tokens for development.

### 3. Deploy Your Program

Deploy your Solana program to Surfnet:

```bash
solana program deploy /path/to/program.so
```

## Network Details

- **RPC Endpoint**: `http://localhost:8899`
- **WebSocket**: `ws://localhost:8900`
- **Chain ID**: `surfnet-local`
- **Block Time**: ~400ms

## Features

- **Fast Finality**: Sub-second transaction confirmation
- **Low Fees**: Minimal transaction costs for testing
- **Faucet**: Unlimited test tokens available
- **Explorer**: Full transaction and account explorer

## Developer Resources

- [Documentation](https://docs.surfnet.dev)
- [Discord Community](https://discord.gg/surfnet)
- [GitHub](https://github.com/surfnet)

## Support

Need help? Reach out to our community:
- Discord: [discord.gg/surfnet](https://discord.gg/surfnet)
- Twitter: [@surfnet_dev](https://twitter.com/surfnet_dev)
