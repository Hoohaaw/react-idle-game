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

## Agent routing — when to delegate

Four project-scoped agents live in `.claude/agents/`. Delegate proactively — don't do in the
main context what an agent can do in its own.

| Agent | Delegate when… | Model |
|---|---|---|
| **explorer** | Any read-only question: "where is X", "what files use Y", "explain how Z works", architecture questions | Haiku |
| **feature-migrator** | "Migrate `<Page>` to `src/features/<feature>/`" — handles the full move end-to-end | Sonnet |
| **code-reviewer** | "Review this diff", "does this follow the ADRs", "is this safe to merge" | Sonnet |
| **db-engineer** | Writing migrations, RLS policies, Edge Function stubs, schema design | Sonnet |
| **test-writer** | "Write tests for X", "add tests to Y", "test this function", "increase coverage" | Sonnet |

**Rules for the main context:**
- Research that needs more than 2–3 lookups → **explorer**
- A self-contained migration task → **feature-migrator** (background if other work is happening)
- Any review request → **code-reviewer** (read-only, independent opinion)
- Anything touching `supabase/migrations/` or `supabase/functions/` → **db-engineer**
- Writing tests for any file → **test-writer**
- Everything else (cross-cutting changes, discussions, planning) → main context

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
- **Combat/balance changes follow the agent playbook** in [`docs/BALANCE.md`](./docs/BALANCE.md):
  one change per branch, before/after sweep evidence, a discriminating regression test, an ADR,
  and a player-guide update (`src/pages/gameStatsContent.ts`) when player-visible.
- **Characters are authored on the point-buy budget** (ADR-0031): prices + rarity budgets in
  `src/lib/characterBudget.ts`, guideline in [`docs/CHARACTERS.md`](./docs/CHARACTERS.md),
  enforced by the studio schema validation.
- **Items are authored per [`docs/ITEMS.md`](./docs/ITEMS.md)** (ADR-0043/0044): slot/rarity
  system, the rarity-scaled level-requirement gate, and the per-map universal-fill + build-defining
  identity pattern new maps extend.
- Components target ~200 lines; presentation and logic stay separate.
- **No emoji as UI icons** (design rule, 2026-07-12): real icon assets arrive later — until then,
  anywhere an icon belongs renders the `IconSlot` placeholder (`src/components/atoms/IconSlot`);
  purely decorative emoji are removed. Registry `icon` fields (e.g. `SCHOOL_DEFS`, `ROLE_STYLES`)
  may keep emoji as *data* for the future mapping, but components never render them as glyphs.
  Typographic marks (✓ ✕ + ★ → ▲▼) are fine.
