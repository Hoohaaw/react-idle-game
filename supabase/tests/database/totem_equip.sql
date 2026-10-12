-- totem_equip: equip_totem/unequip_totem — no busy-check (account-level, not scoped to any
-- one character), free swap, missing-profile guard.
begin;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000001', 'totem-1@test.local', jsonb_build_object('username', 'totem_1'));

-- 1. Equipping writes active_totem_id.
select is(
  public.equip_totem('60000000-0000-0000-0000-000000000001'::uuid, 'totem-of-minor-warding'),
  'totem-of-minor-warding',
  'equip_totem writes and returns the totem id'
);

select is(
  (select active_totem_id from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  'totem-of-minor-warding',
  'active_totem_id is set on the profile row'
);

-- 2. Swapping to a different totem is free and immediate (no busy-check, no cost).
select public.equip_totem('60000000-0000-0000-0000-000000000001'::uuid, 'totem-of-swiftness');
select is(
  (select active_totem_id from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  'totem-of-swiftness',
  'swapping totems overwrites the previous one, no error'
);

-- 3. Unequipping clears it back to null.
select public.unequip_totem('60000000-0000-0000-0000-000000000001'::uuid);
select is(
  (select active_totem_id from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  null,
  'unequip_totem clears active_totem_id to null'
);

select * from finish();
rollback;
