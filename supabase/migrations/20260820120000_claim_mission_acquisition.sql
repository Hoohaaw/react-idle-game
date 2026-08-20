-- claim_mission: gains lifetime-stat increments + newly-unlocked-character writes (docs/superpowers/
-- specs/2026-08-20-character-acquisition-design.md §5b/§6/§10). The calling Edge Function
-- (mission-claim) computes both from data it already has (the gold reward + mission duration it's
-- about to grant, and which characterDefs it evaluated as newly-satisfied) — this migration only
-- adds the atomic WRITE of those two things into the SAME transaction as everything claim_mission
-- already does.
--
-- p_lifetime_stats: { "<key>": <amount to ADD> } — same atomic-increment pattern the existing
-- p_currencies/p_resources loops already use (jsonb_set + coalesce(...,0) + value).
--
-- p_newly_unlocked: charKeys to set into unlocked_characters, ADDITIVE-ONLY — a key already present
-- is left untouched (spec §10: a retried/duplicate call must not re-fire the surprise reveal). The
-- function tracks which keys IT actually set (as opposed to found already-present) and returns them
-- as `actually_unlocked` — the Edge Function only includes THOSE in the newlyUnlocked response, not
-- the full p_newly_unlocked list, so a duplicate/retried claim never re-surfaces an old reveal.
--
-- Preserves every existing behavior of claim_mission VERBATIM — double-claim guard, char updates,
-- loot upsert, currency/resource wallet increments, map-progress advancement. Only the two new
-- blocks are added, right before the final RETURN.
--
-- Signature verified against the LATEST claim_mission definition in the repo at time of writing
-- (20260713090000_map_progression.sql — grepped every "create or replace function
-- public.claim_mission" across supabase/migrations/*.sql; no later migration redefines it).
drop function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean);

create or replace function public.claim_mission(
  p_player          uuid,
  p_run_id          uuid,
  p_char_updates    jsonb,
  p_loot            jsonb,
  p_currencies      jsonb,
  p_resources       jsonb,
  p_map_key         text    default null,
  p_stage           int     default null,
  p_won             boolean default false,
  p_lifetime_stats  jsonb   default '{}'::jsonb,
  p_newly_unlocked  text[]  default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_party uuid[];
  v_char  jsonb;
  v_loot  jsonb;
  v_key   text;
  v_val   numeric;
  v_already boolean;
  v_actually_unlocked text[] := '{}';
begin
  -- Double-claim guard + free the party: an atomic conditional delete. Only one concurrent caller can
  -- match the row, and only once now() >= ends_at. Anyone else gets NOT FOUND -> the whole tx aborts.
  delete from public.mission_runs
   where id = p_run_id and player_id = p_player and now() >= ends_at
   returning party into v_party;
  if not found then
    raise exception 'claim_mission: not claimable (already claimed, not owned, or not finished)';
  end if;

  -- Per-character level / xp / current_hp (Edge Function computed these).
  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level      = (v_char->>'level')::int,
           xp         = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player;
  end loop;

  -- Loot -> stack into inventory (one stack per item+rarity).
  for v_loot in select * from jsonb_array_elements(coalesce(p_loot, '[]'::jsonb))
  loop
    insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
    values (p_player, v_loot->>'item_def_id', v_loot->>'rarity', (v_loot->>'quantity')::int)
    on conflict (player_id, item_def_id, rarity)
      do update set quantity = public.player_inventory.quantity + excluded.quantity;
  end loop;

  -- Currencies + resources: add each amount into the JSONB wallet on profiles.
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_currencies, '{}'::jsonb))
  loop
    update public.profiles
       set currencies = jsonb_set(currencies, array[v_key],
             to_jsonb(coalesce((currencies->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_resources, '{}'::jsonb))
  loop
    update public.profiles
       set resources = jsonb_set(resources, array[v_key],
             to_jsonb(coalesce((resources->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  -- Map progression: advance highestStageCleared on win only (ADR-0034).
  -- greatest() ensures replaying a cleared stage never regresses progress.
  -- Skipped for legacy missions without a map/stage (null-guarded — jsonb_set
  -- with a null path element would raise).
  if p_won and p_map_key is not null and p_stage is not null then
    update public.profiles
       set map_progress = jsonb_set(
             map_progress,
             array[p_map_key],
             to_jsonb(greatest(coalesce((map_progress ->> p_map_key)::int, 0), p_stage))
           )
     where player_id = p_player;
  end if;

  -- Lifetime stats: atomic increments (same pattern as currencies/resources above).
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  -- Newly-unlocked characters: additive-only. Only report keys THIS call actually set, so a
  -- retried/duplicate call never re-fires the surprise reveal (spec §10).
  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    select (unlocked_characters ? v_key) into v_already
      from public.profiles where player_id = p_player;
    if not coalesce(v_already, false) then
      update public.profiles
         set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
       where player_id = p_player;
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
  end loop;

  return jsonb_build_object('claimed', true, 'party', v_party, 'actually_unlocked', v_actually_unlocked);
end;
$$;

-- Re-issue grants (same policy as the original: service_role only; revoke from everyone else).
revoke all on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) to service_role;
