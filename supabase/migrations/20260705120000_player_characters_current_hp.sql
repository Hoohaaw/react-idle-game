-- player_characters.current_hp: persistent combat damage (ADR-0013).
--
-- Combat damage PERSISTS between missions — a character hurt in a fight is not auto-healed
-- (recovery = infirmary or an in-combat healer). We store an ABSOLUTE hp value, not a
-- fraction or "damage taken", so it survives gear/level changes that move max HP: the read
-- path clamps it to [0, maxHp] against the compute-on-read maximum (ADR-0002).
--
--   NULL  = "full" — never fought, or freshly healed. The read path treats null as maxHp.
--   0     = "downed" — cannot be dispatched until healed (the failure consequence + the
--           infirmary economy sink).
--
-- Only the mission-claim Edge Function (service role) ever writes this, after running the
-- server-authoritative combat sim — clients remain SELECT-only (ADR-0003).

alter table public.player_characters
  add column current_hp integer default null check (current_hp is null or current_hp >= 0);

comment on column public.player_characters.current_hp is
  'Absolute persistent HP after combat (ADR-0013). NULL = full (treated as maxHp on read); 0 = downed (cannot be dispatched until healed). Clamped to [0, maxHp] on read against the compute-on-read maximum. Written only by the mission-claim Edge Function.';
