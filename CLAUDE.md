# CLAUDE.md — working agreement for this repo

Project memory for Claude (and humans). Read this first, then
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the technical deep-dive and
[`docs/DECISIONS.md`](./docs/DECISIONS.md) for the ADR log.

A browser-based idle/incremental RPG. React 19 + Vite + TypeScript (strict), Zustand,
TanStack Query, Tailwind v4, Supabase (runtime) + Sanity (authored content).

---

## Git workflow — one branch, one task

**Never commit feature work straight to `master`.** Every change happens on its own
short-lived branch and merges back via a PR.

1. **Branch off `master`**, one branch per task:
   - `feature/<slug>` — new functionality or visuals
   - `fix/<slug>` — bug fixes
   - `refactor/<slug>` · `chore/<slug>` · `docs/<slug>`
2. **One logical change per branch.** Find a bug while building a feature? New `fix/` branch.
3. **Commit in small, meaningful steps** with clear messages (imperative mood, e.g.
   `feat: add mission dispatch modal`). Don't bundle unrelated changes.
4. **Open a PR to `master`**; let CI (lint) pass before merge. Don't push to `master` directly.
5. **Delete the branch after merge.** Keep branches short-lived (days, not weeks).

Before committing: `npm run lint`, `npm run build`, and `npm test` should all pass.
The **Lint** GitHub Action (`.github/workflows/lint.yml`) runs ESLint on every push and PR.

---

## Project structure — feature modules + atomic design

Two layers live side by side (see [`src/features/README.md`](./src/features/README.md)):

- **`src/components/`** — the shared, domain-agnostic UI kit, organized by atomic design
  (`atoms → molecules → organisms → templates`).
- **`src/features/<feature>/`** — everything owned by one game domain (its page,
  feature-specific components/hooks/data/types, later its store slice and data access).

**The rule:** used by one feature → lives inside it. Needed by a second feature → promote it
up to the shared layer (`src/components`, `src/hooks`, `src/lib`, `src/types`).

```
src/
├─ features/<feature>/   # missions/ is the reference; see its index.ts (public barrel)
│  ├─ components/         # feature-specific UI
│  ├─ <Feature>Page.tsx   # routed page
│  └─ index.ts            # PUBLIC API — outsiders import ONLY this
├─ components/{atoms,molecules,organisms,templates}/   # shared UI kit
├─ pages/                # not-yet-migrated routed pages (migrate incrementally)
├─ hooks/  lib/  types/  # shared hooks, framework-agnostic logic, shared types
```

### Import rules
- Use the **`@/` alias** for anything outside the current folder: `@/components/atoms/Button`,
  `@/lib/roles`, `@/features/missions`. (`@` → `src`, configured in `tsconfig.app.json` + `vite.config.ts`.)
- **Import a feature only through its barrel** (`@/features/missions`) — never reach into
  another feature's internals. Relative paths (`./components/X`) are fine within a feature.
- **Features don't depend on each other's internals.** Share via `@/lib` / `@/types` / a store.
  Keep dependencies one-directional.

### Adding a new feature
Copy the `missions/` shape: `components/`, a `<Feature>Page.tsx`, an `index.ts` barrel; add
`hooks.ts` / `data.ts` / `types.ts` / `store.ts` only when needed. Route it from `App.tsx`
via the barrel import. Do it on its own `feature/<slug>` branch.

### Migration status
Atomic design is established. **Missions** is migrated as the feature-module exemplar; the
other domains migrate **incrementally — one feature per branch** as each is next touched.
Unmigrated pages still live in `src/pages/`.

---

## Core engineering rules (don't violate — full rationale in ADRs)
- **Server-authoritative writes** (ADR-0003): clients never mutate game state; all writes go
  through Edge Functions. Every gameplay table = RLS owner-read + explicit GRANTs + no client write.
- **Compute-on-read stats** (ADR-0002): store only intent (`level`, `xp`, blessings, equipped);
  never store derived stat values.
- **Definition/instance split** (ADR-0001): authored content → Sanity; per-player runtime → Supabase.
- **Registry-driven extensibility** (ADR-0004): stats/currencies/resources are code registries +
  JSONB — adding one is a one-line change, no migration.
- **Record notable decisions** as a new numbered ADR in `docs/DECISIONS.md`; mark superseded
  entries rather than deleting them.
- Components target ~200 lines; presentation and logic stay separate.
