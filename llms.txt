# Surfpool - From Localnet to Mainnet

> Drop-in replacement for solana-test-validator. Simulate programs locally using Mainnet accounts.

Surfpool is a local Solana node that fetches accounts just-in-time as transactions are sent to the RPC endpoint.

## Quick Start

```bash
# Install CLI
curl -sL https://run.surfpool.run/ | bash

# Start local network
surfpool
```

Dashboard: http://localhost:18488

## Key Features

- **Mainnet Forking**: Clone accounts, programs, and token balances from Mainnet
- **Cheatcodes**: Powerful testing utilities for state manipulation
- **Infrastructure as Code**: Define deployments using txtx DSL
- **Terminal UI**: Real-time visibility into your local network
- **Full RPC Compatibility**: Drop-in replacement for solana-test-validator

## CLI Commands

```bash
surfpool start              # Start Surfnet with TUI dashboard
surfpool --help             # Show all options
```

Running `surfpool` from an Anchor or Solana program directory automatically spins up a network and scaffolds infrastructure-as-code to deploy the program(s).

---

# Resources

- Website: https://surfpool.run
- Docs: https://docs.surfpool.run
- GitHub: https://github.com/txtx/surfpool
- Discord: https://discord.gg/rqXmWsn2ja
