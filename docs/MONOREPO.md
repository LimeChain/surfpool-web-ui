# Surfpool Monorepo

This repository has been restructured as a monorepo using **pnpm workspaces** and **Turborepo**.

## Structure

```
surfpool-studio-ui/
├── apps/
│   ├── studio/          # Original Next.js app (your studio UI)
│   └── surfnet/         # Surfnet app
├── packages/
│   ├── ui/              # Shared UI primitives (Button, Dialog, etc.)
│   ├── svm/             # Shared SVM components (Scenarios, Widgets, etc.)
│   └── shared/          # Shared utilities, hooks, and types
```

## Getting Started

### Install Dependencies

```bash
pnpm install
```

### Development

Run all apps in development mode:
```bash
pnpm dev
```

Run specific app:
```bash
cd apps/studio && pnpm dev
# or
cd apps/surfnet && pnpm dev
```

### Building

Build all apps:
```bash
pnpm build
```

Build specific app:
```bash
pnpm build --filter=@surfpool/studio
# or
pnpm build --filter=@surfpool/surfnet
```

## Using Shared Packages

### In your apps (studio or surfnet):

```typescript
// Import UI components
import { Button, Dialog } from '@surfpool/ui';

// Import SVM components
import { ScenariosBento, CompactSlotWidget } from '@surfpool/svm';

// Import shared utilities
import { useAppConfig } from '@surfpool/shared';
```

## Next Steps

### 1. Move Components to Shared Packages

You can now gradually move components from `apps/studio/src/components` to the shared packages:

**UI Components** (to `packages/ui/src/`):
- Copy `apps/studio/src/components/catalyst/*` to `packages/ui/src/catalyst/`
- Export them in `packages/ui/src/index.ts`

**SVM Components** (to `packages/svm/src/`):
- Copy `apps/studio/src/components/svm/*` to `packages/svm/src/`
- Export them in `packages/svm/src/index.ts`

**Shared Utilities** (to `packages/shared/src/`):
- Copy `apps/studio/src/hooks/*` to `packages/shared/src/hooks/`
- Copy `apps/studio/src/lib/*` to `packages/shared/src/lib/`
- Export them in `packages/shared/src/index.ts`

### 2. Update Import Paths

After moving components, update imports in your apps:

```typescript
// Before
import { Button } from '@/components/catalyst/button';

// After
import { Button } from '@surfpool/ui';
```

### 3. Deploy Surfnet Separately

The Surfnet app (`apps/surfnet`) can be deployed independently to a different server. It will use the shared components from the packages.

## Useful Commands

```bash
# Clean all build artifacts
pnpm clean

# Run tests
pnpm test

# Lint all packages
pnpm lint

# Add dependency to specific package
pnpm --filter=@surfpool/studio add <package-name>

# Add dependency to workspace package
pnpm --filter=@surfpool/surfnet add @surfpool/ui
```

## Advantages

1. **Code Reuse**: Share components between multiple apps
2. **Type Safety**: TypeScript works across all packages
3. **Fast Builds**: Turborepo caches builds intelligently
4. **Independent Deploy**: Each app can be deployed separately
5. **Better Organization**: Clear separation of concerns

## Port Configuration

- Studio app: http://localhost:3000
- Surfnet app: http://localhost:3001
