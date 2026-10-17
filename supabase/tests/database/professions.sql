-- Profession system: the recipe-known gate on start_craft, learn_profession_recipe,
-- claim_profession_quest, and the claim_craft profession-XP grant
-- (docs/superpowers/specs/2026-10-16-profession-system-design.md).
begin;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data)
values ('90000000-0000-0000-0000-000000000001', 'professions-1@test.local', jsonb_build_object('username', 'professions_1'));

-- 1. start_craft rejects a profession-gated recipe the player doesn't know.
select throws_ok(
  $$ select public.start_craft('90000000-0000-0000-0000-000000000001'::uuid, 'unknown-potion', '[]'::jsonb, '[]'::jsonb, 60, 'alchemy') $$,
  'start_craft: recipe not known for this profession'
);

-- 2. start_craft with no professionKey (a generic recipe) is unaffected — still works with zero
-- reagents and succeeds.
select lives_ok(
  $$ select public.start_craft('90000000-0000-0000-0000-000000000001'::uuid, 'generic-recipe', '[]'::jsonb, '[]'::jsonb, 60) $$,
  'start_craft with no professionKey skips the recipe-known gate entirely'
);
delete from public.craft_runs where player_id = '90000000-0000-0000-0000-000000000001';

-- 3. learn_profession_recipe rejects a level too low. The player's alchemy entry is untouched
-- (absent), which now reads as level 1 (the bootstrap fix), not 0 — still too low for 5.
update public.profiles set currencies = jsonb_build_object('gold', 500) where player_id = '90000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ select public.learn_profession_recipe('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'greater-healing-potion', 100, 5) $$,
  'learn_profession_recipe: profession level too low (needs 5, has 1)'
);

-- 4. learn_profession_recipe succeeds at a level the player has, deducts gold, adds the recipe.
update public.profiles
   set professions = jsonb_build_object('alchemy', jsonb_build_object('level', 1, 'xp', 0, 'knownRecipes', '[]'::jsonb))
 where player_id = '90000000-0000-0000-0000-000000000001';
select public.learn_profession_recipe('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'minor-healing-potion', 100, 1);

select is(
  (select (currencies->>'gold')::int from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  400,
  'learn_profession_recipe deducts gold'
);

select is(
  (select professions->'alchemy'->'knownRecipes' ? 'minor-healing-potion' from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  true,
  'learn_profession_recipe adds the recipe to knownRecipes'
);

-- 5. learn_profession_recipe rejects learning the same recipe twice.
select throws_ok(
  $$ select public.learn_profession_recipe('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'minor-healing-potion', 100, 1) $$,
  'learn_profession_recipe: recipe already known'
);

-- 6. claim_profession_quest rejects a level too low.
select throws_ok(
  $$ select public.claim_profession_quest('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'alchemist-trial', 10, 'unique-elixir', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
  'claim_profession_quest: profession level too low (needs 10, has 1)'
);

-- 7. claim_profession_quest rejects a turn-in the player can't afford (level is met, but no
-- Steel owned yet) — verify-before-deduct: nothing should be spent on a rejected attempt.
select throws_ok(
  $$ select public.claim_profession_quest('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'alchemist-trial', 1, 'unique-elixir',
       jsonb_build_array(jsonb_build_object('code', 'Steel', 'quantity', 5)), '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('code', 'gold', 'quantity', 50))) $$,
  'claim_profession_quest: not enough resource Steel (have 0, need 5)'
);
select is(
  (select (currencies->>'gold')::int from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  400,
  'a rejected quest attempt deducts nothing, even the lines the player COULD afford'
);

-- 8. claim_profession_quest succeeds, deducts a mixed resource+currency cost, grants the recipe.
update public.profiles set resources = jsonb_build_object('Steel', 10) where player_id = '90000000-0000-0000-0000-000000000001';
select public.claim_profession_quest(
  '90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'alchemist-trial', 1, 'unique-elixir',
  jsonb_build_array(jsonb_build_object('code', 'Steel', 'quantity', 5)),
  '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('code', 'gold', 'quantity', 50))
);

select is(
  (select (resources->>'Steel')::int from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  5,
  'claim_profession_quest deducts the resource cost'
);

select is(
  (select professions->'alchemy'->'knownRecipes' ? 'unique-elixir' from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  true,
  'claim_profession_quest adds the reward recipe to knownRecipes'
);

-- 9. The same quest cannot be completed twice.
select throws_ok(
  $$ select public.claim_profession_quest('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'alchemist-trial', 1, 'unique-elixir', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
  'claim_profession_quest: quest already completed'
);

-- 10. The bootstrap fix: a SECOND, completely fresh player whose `professions` column is still
-- the migration's bare `{}` default (never touched, unlike player 1's `alchemy` which test 4 set
-- to level 1) can still learn a requiredLevel:1 recipe — the absent profession entry must read as
-- level 1, not 0, or no player could ever acquire a profession's first recipe.
insert into auth.users (id, email, raw_user_meta_data)
values ('90000000-0000-0000-0000-000000000002', 'professions-2@test.local', jsonb_build_object('username', 'professions_2'));
update public.profiles set currencies = jsonb_build_object('gold', 100) where player_id = '90000000-0000-0000-0000-000000000002';

select lives_ok(
  $$ select public.learn_profession_recipe('90000000-0000-0000-0000-000000000002'::uuid, 'carving', 'first-carving-recipe', 50, 1) $$,
  'a profession a player has never touched reads as level 1, not 0 — a requiredLevel:1 recipe is learnable immediately'
);

select * from finish();
rollback;
