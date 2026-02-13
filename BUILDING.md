# Building mscl

This document provides instructions for building and testing mscl locally.

## Prerequisites

- **Node.js** - LTS version (18.x or 20.x recommended)
- **npm** or **pnpm** - Package manager

## Steps

### 1. Clone the Repository

```bash
git clone https://github.com/amagyar/mscl.git
cd mscl
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

This bundles the CLI using [tsup](https://tsup.egoist.dev/) (powered by esbuild) into a single file in the `dist/` directory.

### 4. Link for Local Testing

```bash
npm link
```

This creates a global symlink so you can run `mscl` from any directory.

### 5. Test in a Repository

```bash
cd /path/to/your/repo
mscl -f CHANGELOG.md
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Bundle with tsup |
| `npm run dev` | Watch mode for development |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Project Structure

```
mscl/
├── src/
│   ├── cli.ts         # CLI entry point
│   ├── dedup.ts       # Deduplication logic
│   ├── formatter.ts   # Markdown generation
│   ├── git.ts         # Git operations
│   ├── index.ts       # Binary entry point
│   ├── parser.ts      # Version/commit parsing
│   ├── remote.ts      # Remote URL parsing
│   └── writer.ts      # File output
├── tests/             # Test files
│   ├── dedup.test.ts
│   ├── formatter.test.ts
│   ├── git.test.ts
│   ├── parser.test.ts
│   └── remote.test.ts
├── dist/              # Bundled output
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## Unlinking

To remove the global symlink:

```bash
npm unlink -g mscl
```

## Troubleshooting

### Build Errors

Ensure you're using a compatible Node.js version:

```bash
node --version  # Should be 18.x or higher
```

### Permission Errors

If you encounter permission errors with `npm link`, you may need to fix npm permissions or use sudo (not recommended).

### Tests Failing

Ensure all dependencies are installed:

```bash
rm -rf node_modules
npm install
```
