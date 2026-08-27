# CLAUDE.md - Project Genesis Online

**Last Updated:** August 27, 2026  
**Repository:** [lobismar2/Project-Genesis-Online](https://github.com/lobismar2/Project-Genesis-Online)  
**Primary AI Branch:** `claude/claude-md-docs-5unpos`

## Table of Contents

1. [Project Overview](#project-overview)
2. [Repository Structure](#repository-structure)
3. [Development Setup](#development-setup)
4. [Git Workflow & Branch Strategy](#git-workflow--branch-strategy)
5. [Monorepo Configuration](#monorepo-configuration)
6. [Testing & CI/CD](#testing--cicd)
7. [Code Conventions](#code-conventions)
8. [AI Assistant Guidelines](#ai-assistant-guidelines)

---

## Project Overview

**Project Genesis Online** is a monorepo project that contains multiple workspace packages. The project is currently in early-stage setup with infrastructure for:

- **Monorepo Management:** pnpm workspaces for scalable multi-package development
- **Browser Testing:** Playwright-based E2E testing with touch regression detection
- **CI/CD Pipeline:** GitHub Actions workflows for automated testing and deployment

### Current Status

- ✅ Monorepo infrastructure initialized
- ✅ E2E testing workflow configured
- ⏳ Core project packages pending creation in `artifacts/project-genesis/`

---

## Repository Structure

```
Project-Genesis-Online/
├── .github/
│   └── workflows/
│       └── project-genesis-touch-e2e.yml      # E2E test automation
├── artifacts/
│   └── project-genesis/                        # [PENDING] Main project package
│       ├── src/                                # [PLACEHOLDER] Source code
│       ├── e2e/                                # [PLACEHOLDER] E2E tests
│       ├── package.json                        # [PLACEHOLDER] Package manifest
│       └── playwright.config.ts                # [PLACEHOLDER] Playwright config
├── .git/                                        # Git repository
├── .gitignore                                   # Git ignore rules
├── pnpm-lock.yaml                              # Dependency lock file
├── pnpm-workspace.yaml                         # [IMPLICIT] Workspace config
├── CLAUDE.md                                    # This file
└── README.md                                    # [PENDING] Project documentation
```

### Key Directories

| Directory | Purpose | Status |
|-----------|---------|--------|
| `.github/workflows/` | GitHub Actions automation | ✅ Active |
| `artifacts/project-genesis/` | Main application package | ⏳ Pending |
| `.git/` | Git repository metadata | ✅ Initialized |

---

## Development Setup

### Prerequisites

- **Node.js:** v22 or higher
- **pnpm:** v10.4.1 or higher
- **Git:** For version control

### Installation

```bash
# Install Node.js (if not already installed)
# Use nvm or node.js installer from https://nodejs.org/

# Install pnpm globally
npm install -g pnpm@10.4.1

# Clone the repository
git clone https://github.com/lobismar2/Project-Genesis-Online.git
cd Project-Genesis-Online

# Install workspace dependencies
pnpm install

# Install Playwright browsers (for E2E testing)
pnpm --filter @workspace/project-genesis exec playwright install --with-deps
```

### Common Development Commands

```bash
# Install all workspace dependencies
pnpm install

# Run commands in a specific workspace
pnpm --filter @workspace/project-genesis <command>

# Run all workspace tests
pnpm --filter @workspace/project-genesis test

# Run E2E tests
pnpm --filter @workspace/project-genesis exec playwright test

# Run with specific browser (mobile)
pnpm --filter @workspace/project-genesis exec playwright test --project=chromium-mobile

# Format code (when configured)
pnpm format

# Lint code (when configured)
pnpm lint
```

---

## Git Workflow & Branch Strategy

### Branch Naming Conventions

All feature and fix branches for AI assistant work should follow this pattern:

```
claude/<feature-name>-<identifier>
```

**Examples:**
- `claude/claude-md-docs-5unpos` (primary AI documentation branch)
- `claude/feature-auth-setup`
- `claude/fix-e2e-flakiness`

### Branch Protection & Merge Policy

- **Primary Branch:** `main` — Production-ready code only
- **Workflow:** Feature branches → Pull requests → Code review → Merge
- **Merge Strategy:** Prefer squash commits for clean history, or conventional commits for detailed tracking

### Commit Message Guidelines

Follow conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code refactoring
- `style:` — Code style/formatting (non-semantic)
- `test:` — Test additions/updates
- `docs:` — Documentation changes
- `ci:` — CI/CD configuration changes
- `chore:` — Maintenance tasks

**Example:**
```
feat(playwright): add touch regression test suite

- Add e2e/touch-regression.spec.ts with mobile touch event tests
- Configure chromium-mobile and webkit-mobile test projects
- Add screenshot comparison baseline

Closes #42
```

### Working on the Designated Branch

⚠️ **Important:** All development work should be committed and pushed to the designated branch:

```bash
# Fetch the latest updates
git fetch origin

# Create local tracking branch if needed
git checkout -b claude/claude-md-docs-5unpos origin/claude/claude-md-docs-5unpos

# OR reset to latest if branch exists
git checkout claude/claude-md-docs-5unpos
git reset --hard origin/claude/claude-md-docs-5unpos

# Make your changes and commit
git add .
git commit -m "feat(docs): update CLAUDE.md with setup instructions"

# Push to designated branch only
git push -u origin claude/claude-md-docs-5unpos
```

**Never push directly to `main` without explicit approval.**

---

## Monorepo Configuration

### pnpm Workspaces

This project uses pnpm workspaces for managing multiple packages. The workspace configuration is stored in `pnpm-workspace.yaml` (implicitly configured by the `pnpm-lock.yaml`).

### Workspace Structure

**Current Workspace Reference:**
```yaml
# pnpm-lock.yaml - root importer
.:
  dependencies:
    '@workspace/project-genesis':
      link: true
      version: 'link:./artifacts/project-genesis'
```

**To Add New Packages:**

1. Create package directory: `mkdir -p artifacts/new-package`
2. Add `package.json`:
```json
{
  "name": "@workspace/new-package",
  "version": "0.1.0",
  "private": true,
  "type": "module"
}
```

3. Update pnpm-lock.yaml or let `pnpm install` regenerate it

### Package Naming Convention

All workspace packages use the `@workspace/` scope:
- `@workspace/project-genesis` — Main application
- `@workspace/shared-ui` — Shared UI components (example)
- `@workspace/utils` — Shared utilities (example)

---

## Testing & CI/CD

### E2E Testing with Playwright

**Workflow File:** `.github/workflows/project-genesis-touch-e2e.yml`

#### What Triggers E2E Tests

Tests run automatically on:
- Push to `artifacts/project-genesis/**`
- Updates to `pnpm-lock.yaml` or `pnpm-workspace.yaml`
- Changes to workflow file itself
- Manual trigger via `workflow_dispatch`

#### Running E2E Tests Locally

```bash
# Install Playwright browsers
pnpm --filter @workspace/project-genesis exec playwright install --with-deps chromium webkit

# Run all touch regression tests
pnpm --filter @workspace/project-genesis exec playwright test e2e/touch-regression.spec.ts

# Run on specific browser
pnpm --filter @workspace/project-genesis exec playwright test e2e/touch-regression.spec.ts --project=chromium-mobile

# Run in UI mode (interactive debugging)
pnpm --filter @workspace/project-genesis exec playwright test --ui
```

#### Test Browsers

Current test configuration:
- **Chromium (mobile)** — Mobile variant of Chromium browser
- **WebKit (mobile)** — Mobile variant of Safari-equivalent browser

#### Test Location

Expected location: `artifacts/project-genesis/e2e/touch-regression.spec.ts`

#### CI/CD Pipeline Details

The workflow:
1. Checks out the repository
2. Sets up pnpm v10.4.1 and Node.js v22
3. Installs all workspace dependencies with frozen lockfile
4. Installs Playwright browsers for chromium and webkit
5. Runs touch regression tests on mobile projects
6. Uploads test reports as artifacts (14-day retention)

---

## Code Conventions

### TypeScript

When adding TypeScript code:
- **tsconfig.json** should be in workspace root (when created)
- Use strict mode: `"strict": true`
- Target modern JavaScript: `"target": "ES2020" or higher`
- Use ESM modules: `"module": "ESNext", "type": "module"`

### File Organization

```
artifacts/project-genesis/
├── src/
│   ├── components/        # React/UI components
│   ├── pages/            # Page components
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   └── index.ts          # Main entry point
├── e2e/
│   └── touch-regression.spec.ts
├── __tests__/            # Unit tests
├── public/               # Static assets
├── package.json
├── tsconfig.json
├── playwright.config.ts
└── README.md
```

### Naming Conventions

- **Components:** PascalCase (e.g., `Button.tsx`, `UserProfile.tsx`)
- **Utilities:** camelCase (e.g., `formatDate.ts`, `validateEmail.ts`)
- **Types/Interfaces:** PascalCase (e.g., `User`, `ApiResponse`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `API_TIMEOUT`)
- **CSS Classes:** kebab-case (e.g., `.btn-primary`, `.user-card`)

### Linting & Formatting

When eslint/prettier are configured:

```bash
# Format code
pnpm format

# Lint and fix issues
pnpm lint --fix

# Check types
pnpm type-check
```

---

## AI Assistant Guidelines

### When Making Changes

1. **Always work on the designated branch** (`claude/claude-md-docs-5unpos`)
2. **Follow commit message conventions** — Use proper commit types and meaningful messages
3. **Test locally before pushing** — Run relevant tests to ensure changes don't break CI
4. **Review the diff** — Verify changes match the task requirements
5. **Keep commits focused** — One feature/fix per commit when possible

### Common Tasks

#### Adding a Feature

```bash
# 1. Ensure you're on the correct branch
git checkout claude/claude-md-docs-5unpos

# 2. Create/update files in artifacts/project-genesis/src/
# Example: artifacts/project-genesis/src/components/Button.tsx

# 3. Add tests if applicable
# Example: artifacts/project-genesis/__tests__/components/Button.test.ts

# 4. Commit with descriptive message
git commit -m "feat(components): add Button component with click handler"

# 5. Push to designated branch
git push origin claude/claude-md-docs-5unpos
```

#### Fixing a Bug

```bash
# 1. Identify the issue and locate the file
# Example issue: Touch events not working on mobile

# 2. Update the affected file
# Example: artifacts/project-genesis/src/handlers/touchHandler.ts

# 3. Add or update E2E test to cover the bug
# Example: Update artifacts/project-genesis/e2e/touch-regression.spec.ts

# 4. Commit the fix
git commit -m "fix(touch): ensure touch events propagate correctly on webkit"

# 5. Push and verify CI passes
git push origin claude/claude-md-docs-5unpos
```

#### Updating Dependencies

```bash
# Update all dependencies
pnpm update

# Update specific workspace
pnpm --filter @workspace/project-genesis update

# Update lock file only (if changes made to package.json)
pnpm install

# Commit lock file changes
git commit -m "chore(deps): update pnpm-lock.yaml"
git push origin claude/claude-md-docs-5unpos
```

### Running Tests Before Push

```bash
# Run E2E tests locally
pnpm --filter @workspace/project-genesis exec playwright test

# If tests pass, safe to push
# If tests fail, fix the issues locally before pushing
```

### Debugging & Common Issues

#### Issue: `playwright install --with-deps` fails

**Solution:**
```bash
# Try without system dependencies first
pnpm --filter @workspace/project-genesis exec playwright install

# Then run with specific browser
pnpm --filter @workspace/project-genesis exec playwright test --project=chromium
```

#### Issue: Lock file conflicts

**Solution:**
```bash
# Remove lock file and regenerate
rm pnpm-lock.yaml
pnpm install

# Commit the regenerated lock file
git add pnpm-lock.yaml
git commit -m "chore: regenerate pnpm-lock.yaml"
```

#### Issue: Workspace package not found

**Solution:**
```bash
# Verify package.json exists in the workspace
ls artifacts/project-genesis/package.json

# Reinstall all dependencies
pnpm install

# Re-link workspaces
pnpm install --force
```

---

## Additional Resources

### External Documentation

- [pnpm Documentation](https://pnpm.io/)
- [Playwright Documentation](https://playwright.dev/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)

### Repository Files to Review

- `.github/workflows/project-genesis-touch-e2e.yml` — CI/CD automation
- `pnpm-lock.yaml` — Dependency lock file (auto-generated)

### Next Steps for Development

- [ ] Create main project package in `artifacts/project-genesis/`
- [ ] Set up TypeScript configuration
- [ ] Initialize core application structure
- [ ] Create README.md with project overview
- [ ] Set up linting and formatting tools (ESLint, Prettier)
- [ ] Add unit test infrastructure
- [ ] Create initial Playwright test suite

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.1 | 2026-08-27 | Fixed typos, inconsistencies, and updated date |
| 1.0.0 | 2026-08-23 | Initial CLAUDE.md creation - monorepo setup, workflows, and AI guidelines |

---

**Created by:** Claude AI  
**For:** AI Assistants working on Project Genesis Online  
**Branch:** `claude/claude-md-docs-5unpos`

Questions or updates needed? Update this document and commit to the designated branch.
