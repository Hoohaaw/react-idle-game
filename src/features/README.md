# `src/features/` — feature-based modules

Feature folders sit **alongside** the atomic-design component library (`src/components/`),
they don't replace it. The split:

- **`src/components/`** (atoms → molecules → organisms → templates) = the **shared,
  reusable UI kit**. Generic, domain-agnostic, used by many features. (`Button`, `Modal`,
  `RoleBadge`, `SectionLabel`, …)
- **`src/features/<feature>/`** = everything that belongs to **one game domain** and isn't
  reused elsewhere: its page, its feature-specific components, hooks, data, types, and
  (later) its store slice and data-access calls.

## The rule of thumb

> If a thing is used by **only one** feature, it lives **inside** that feature.
> The moment a **second** feature needs it, it moves **up** to the shared layer
> (`src/components`, `src/hooks`, `src/lib`, `src/types`).

This keeps shared code honestly shared and keeps feature internals private.

## Folder shape

`missions/` is the reference implementation. A feature looks like:

```
features/<feature>/
├─ components/        # feature-specific UI (not promoted to the shared kit)
├─ hooks/            # feature-specific hooks            (add when needed)
├─ data.ts           # feature data / mock fixtures       (add when needed)
├─ types.ts          # feature-local types                (add when needed)
├─ store.ts          # feature's Zustand slice            (add when needed)
├─ <Feature>Page.tsx # the routed page (composes the above)
└─ index.ts          # PUBLIC API barrel — the only thing outsiders import
```

## Import rules

- **Outsiders import the barrel only:** `import { MissionsPage } from '@/features/missions'`.
  Never reach into another feature's internals (`@/features/missions/components/...`).
- **Use the `@/` alias** for anything outside the current folder
  (`@/components/atoms/Button`, `@/lib/roles`). Relative paths (`./components/X`) are fine
  for a feature's own internals.
- **Features don't import each other's internals.** If two features need to talk, share
  through the promoted layer (`@/lib`, `@/types`) or a store — keep dependencies one-directional.

## Migration status

Established as part of the workflow/structure setup. **Missions** is migrated as the
exemplar; remaining domains (team, mines, crafting, inventory, upgrading, blessings,
transcendence, shop, statistics) migrate **incrementally** — one feature per branch,
as each is next touched. Pages not yet migrated still live in `src/pages/`.
