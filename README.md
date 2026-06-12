# The Idle Game

> _Working title — final name TBD._

A browser-based **idle / incremental RPG**. Build a roster of hand-authored characters, send them on
real-time-combat missions and gathering runs, craft and upgrade gear, spec each character through a
bespoke blessing tree, and transcend for permanent power.

> ⚠️ **Status: early work in progress** (pre-alpha). The backend is local-only and much of the game
> logic is still being built — see [`TODO.md`](./TODO.md).

---

## Highlights

- **Character development** is the headline pillar — a fixed, hand-authored roster (no duplicates), each
  with unique base stats, growth, and a **bespoke 7-row blessing tree**.
- **Real-time combat missions** where every stat matters and **missions can fail** (damage persists).
- **Gathering, crafting, gear, upgrading, account upgrades, and transcendence** round out the loop.
- **Server-authoritative & tamper-resistant** by design: players never write their own game state.

## Tech stack

**React 19 + Vite + TypeScript** (strict) SPA · **Tailwind v4** + **Framer Motion** · **Zustand** +
**TanStack Query** · **Supabase** (Postgres / Auth / Edge Functions) for player runtime · **Sanity**
(headless CMS, in-repo Studio) for authored content · **Vitest** / **Playwright** for tests.

The architecture splits **authored content** (Sanity) from **per-player runtime** (Supabase), with all
game logic in **Edge Functions**. The full picture is in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Getting started

**Prerequisites:** Node 20+, and Docker (for the local Supabase stack).

```bash
npm install
npm run dev                 # app at http://localhost:5173

# Player backend (separate terminal; needs Docker):
npx supabase start          # local Postgres/Auth/REST/Studio
npx supabase migration up   # apply DB migrations

# Authored content (Sanity Studio):
npm --prefix ./studio run dev
```

Copy [`.env.example`](./.env.example) to `.env.local` and fill in the Supabase values
(`npx supabase status` prints the local URL + publishable key). Full setup, env vars, and the
migration/typegen workflow are documented in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#8-local-development).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |
| `npm test` | Run the unit tests once (`vitest run`) |
| `npm run test:watch` | Run the unit tests in watch mode |

## Project structure

```
src/         React SPA — atomic-design components, pages, lib (logic + registries), services (planned)
studio/      Sanity Studio (authored content schema, in-repo)
supabase/    SQL migrations + (planned) Edge Functions
docs/        ARCHITECTURE.md + DECISIONS.md
```

A detailed tour is in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#4-repository-layout).

## Documentation

| Doc | What it's for |
|---|---|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | How the project is built — the developer guide |
| [`docs/DECISIONS.md`](./docs/DECISIONS.md) | Why it's built that way — the ADR decision log |
| [`TODO.md`](./TODO.md) | Roadmap / what's left to build |
| [`TECHNICAL.md`](./TECHNICAL.md) | ⚠️ **Legacy** — the old Express/Mongo prototype, kept only for carried-over game values |
