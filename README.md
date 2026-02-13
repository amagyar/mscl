# mscl

[![npm version](https://badge.fury.io/js/mscl.svg)](https://www.npmjs.com/package/mscl)
[![CI Build Status](https://github.com/amagyar/mscl/workflows/CI/badge.svg)](https://github.com/amagyar/mscl/actions)
[![Coverage Status](https://coveralls.io/repos/github/amagyar/mscl/badge.svg?branch=main)](https://coveralls.io/github/amagyar/mscl?branch=main)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/amagyar/mscl/badge)](https://securityscorecards.dev/viewer/?uri=github.com/amagyar/mscl)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/mscl/badge)](https://www.bestpractices.dev/projects/mscl)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A CLI tool that generates changelogs from fractured git histories using Conventional Commits.

## Features

- **Deduplication** - Handles cherry-picks, rebases, and changed SHAs by normalizing commit messages
- **Messy History Support** - Works with divergent branches, maintenance releases, and fractured histories
- **Pre-release Rollup** - Automatically rolls up pre-release commits into the next stable version
- **Rich Linking** - Links commit hashes and issue references to GitHub/GitLab
- **Breaking Changes Detection** - Detects `!` syntax and `BREAKING CHANGE:` footers
- **Tag Parsing** - Normalizes tags like `old-prefix-v1.0.0` to clean semver
- **Compare URLs** - Generates version comparison links in the changelog

## Installation

```bash
npm install -g mscl
```

## Usage

### CLI

```bash
# Generate changelog to stdout
mscl

# Write to a file
mscl -f CHANGELOG.md

# Include all commit types (not just feat/fix/perf/revert)
mscl -a -f CHANGELOG.md

# Show version
mscl -v
```

### GitHub Action

Use mscl directly in your GitHub Actions workflows:

```yaml
- name: Generate Changelog
  uses: amagyar/mscl@v1
  with:
    file: CHANGELOG.md
    verbose: false
    working-directory: .
```

**Inputs:**

| Input               | Description                                              | Required | Default        |
| ------------------- | -------------------------------------------------------- | -------- | -------------- |
| `file`              | Output file path for the changelog                       | No       | `CHANGELOG.md` |
| `verbose`           | Include all commit types (not just feat/fix/perf/revert) | No       | `false`        |
| `working-directory` | Directory to run the action in                           | No       | `.`            |

**Outputs:**

| Output      | Description                          |
| ----------- | ------------------------------------ |
| `changelog` | Path to the generated changelog file |

**Example with commit & push:**

```yaml
- name: Generate Changelog
  uses: amagyar/mscl@v1
  id: changelog

- name: Commit changelog
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add ${{ steps.changelog.outputs.changelog }}
    git commit -m "chore: update changelog"
    git push
```

## Output Format

```markdown
# Changelog

## [2.0.0](https://github.com/org/repo/compare/v2.0.0...v1.0.0) (2026-02-12)

### ⚠ BREAKING CHANGES

- **api**: rewrite authentication system ([abc1234](https://github.com/org/repo/commit/abc1234))

### Features

- **ui**: add dark mode support ([def5678](https://github.com/org/repo/commit/def5678))
- resolves [#123](https://github.com/org/repo/issues/123) ([ghi9012](https://github.com/org/repo/commit/ghi9012))

### Bug Fixes

- **core**: resolve memory leak ([jkl3456](https://github.com/org/repo/commit/jkl3456))
```

## How It Works

1. Fetches all Git tags and sorts by Semantic Versioning (ignoring chronological order)
2. Extracts version from dirty tags (e.g., `old-prefix-v1.0.0` → `1.0.0`)
3. Maintains a global `seen_commits` set for deduplication
4. Loops through tags, parsing Conventional Commits
5. Filters duplicates by normalizing commit messages
6. Rolls up pre-release commits into the next stable release
7. Generates Markdown with compare links and issue references

## Conventional Commits

This tool relies on [Conventional Commits](https://www.conventionalcommits.org/) for parsing:

```
feat: add new feature
fix(ui): resolve button overlap
feat(api)!: breaking API change
fix(core): fix bug

BREAKING CHANGE: this breaks the old API
```

## Development

See [BUILDING.md](./BUILDING.md) for build instructions.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for details.
