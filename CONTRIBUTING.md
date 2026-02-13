# Contributing to mscl

Thank you for your interest in contributing to mscl! This document provides guidelines and instructions for contributing.

## Development Flow

1. **Fork** the repository
2. **Create a branch** for your changes
3. **Make your changes** following our standards
4. **Submit a Pull Request**

## Prerequisites

- Node.js (LTS version)
- npm or pnpm

## Setup

```bash
git clone https://github.com/YOUR_FORK/mscl.git
cd mscl
npm install
npm run build
npm link  # For local testing
```

## Commit Standards

**All commits must follow [Conventional Commits](https://www.conventionalcommits.org/).**

This is crucial because mscl itself parses conventional commits to generate changelogs!

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `build` - Build system changes
- `ci` - CI configuration changes
- `chore` - Other changes that don't modify src or test files
- `revert` - Revert a previous commit

### Examples

```bash
feat: add --repo flag for custom remote URL
fix(parser): handle edge case in version extraction
docs: update README with new flags
test(formatter): add tests for compare links
```

## Testing

All PRs must:

1. **Pass all tests**: `npm test`
2. **Maintain >80% code coverage**: `npm run test:coverage`

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Pull Request Checklist

- [ ] Commits follow Conventional Commits format
- [ ] All tests pass (`npm test`)
- [ ] Code coverage remains above 80%
- [ ] Documentation updated (if applicable)
- [ ] Changes are tested locally

## Code Style

- No comments unless requested
- Follow existing code conventions
- Use TypeScript strict mode

## Questions?

Open an issue for bugs, features, or questions.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
