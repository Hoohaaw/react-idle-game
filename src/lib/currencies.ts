// The currency registry — the single source of truth for spendable currencies.
// Adding a currency = one entry here. Nothing else changes: balances live in
// profiles.currencies (JSONB) keyed by `key`, and an absent key means a zero balance,
// so no DB migration is ever needed to introduce a new currency.
//
// This mirrors the stat registry (src/lib/statDefinitions.ts) and the resource list
// (src/lib/resources.ts) — the game is a work in progress and this set will grow
// (e.g. a premium gem currency, an event token, a transcendence currency).

export type CurrencyDef = {
  key: string
  label: string
}

export const CURRENCY_DEFS: CurrencyDef[] = [
  { key: 'coins', label: 'Coins' },
]

export const CURRENCY_KEYS: string[] = CURRENCY_DEFS.map((c) => c.key)

export const CURRENCY_LABELS: Record<string, string> = Object.fromEntries(
  CURRENCY_DEFS.map((c) => [c.key, c.label]),
)
