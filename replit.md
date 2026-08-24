# Project Genesis

Project Genesis é um RPG de exploração e combate em Canvas 2D, com classes, equipamentos, missões, mapas conectados e cooperação opcional.

## Run & Operate

- `pnpm --filter @workspace/project-genesis run dev` — run the game preview
- `pnpm --filter @workspace/api-server run dev` — run the cooperation API
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/project-genesis run test:e2e` — run mobile interaction tests
- `pnpm --filter @workspace/api-server run healthcheck` — validate the cooperation API
- `SESSION_SECRET` is required for authenticated sessions.
- `CORS_ORIGIN` accepts a comma-separated production origin allowlist.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- API validation: Zod and defensive field normalization
- Frontend build: Vite
- API build: esbuild

## Where things live

- `artifacts/project-genesis/src/App.tsx` — Canvas game loop, combat, HUD and screens
- `artifacts/project-genesis/src/lib/coop.ts` — client auth, progress persistence and coop API
- `artifacts/project-genesis/src/index.css` — visual system and responsive RPG HUD
- `artifacts/api-server/src/routes/coop.ts` — authenticated progress and room endpoints
- `artifacts/project-genesis/e2e/` — mobile interaction coverage

## Architecture decisions

- Solo play remains independent from the API and uses localStorage.
- Remote progress is identified only by the authenticated server session.
- Saves are normalized field by field and rewards use one-way ledgers.
- The cooperation API uses JSON snapshots under `COOP_DATA_DIR` in development.
- Pixel assets are project-owned/re-distributable; external game assets are not copied.

## Product

The player chooses a faction and class, explores four connected biomes, fights varied enemies, collects and equips gear, completes missions, earns XP and coins, and can optionally join a cooperative room.

## User preferences

The user prefers a short update after each completed development stage with a summary of what changed.

## Gotchas

- Run frontend typecheck/unit/E2E and API tests after gameplay or persistence changes.
- Use `NODE_ENV=production pnpm --filter @workspace/project-genesis run build` for a reproducible frontend build.
- Set `CORS_ORIGIN` before exposing the API on a separate production origin.
- Do not place secrets, generated dependencies, builds or stale archives in source deliveries.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
