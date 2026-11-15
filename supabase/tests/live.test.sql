-- Tests des séances en direct (phase 3) : droits sur les salles, la parole, les mains levées.
-- Scénario : prof A (classe A : élèves 1, 2, 3), prof B (classe B : élève 4).
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

create function pg_temp.signup(uid uuid, invite text) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', uid::text || '@live.test',
          jsonb_build_object('invite', invite, 'display_name', left(uid::text, 8)), now(), now());
$$;
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_db() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into public.staff_invitations (code, role) values ('LIVEPRFAAA', 'teacher'), ('LIVEPRFBBB', 'teacher');
select pg_temp.signup('a0000000-0000-0000-0000-00000000000a', 'LIVEPRFAAA');
select pg_temp.signup('b0000000-0000-0000-0000-00000000000b', 'LIVEPRFBBB');
insert into public.classes (id, teacher_id, name, invite_code) values
  ('c0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'Live A', 'LIVECLASSA'),
  ('c0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'Live B', 'LIVECLASSB');
select pg_temp.signup('e0000000-0000-0000-0000-000000000001', 'LIVECLASSA');
select pg_temp.signup('e0000000-0000-0000-0000-000000000002', 'LIVECLASSA');
select pg_temp.signup('e0000000-0000-0000-0000-000000000003', 'LIVECLASSA');
select pg_temp.signup('e0000000-0000-0000-0000-000000000004', 'LIVECLASSB');

-- ---------------------------------------------------------------- préparation et ouverture
select pg_temp.act_as('a0000000-0000-0000-0000-00000000000a');
insert into public.live_sessions (id, class_id, title, plan, created_by) values
  ('5e550000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', 'Séance 1',
   '[{"key":"opening","minutes":5},{"key":"talqin","minutes":10},{"key":"rooms","minutes":30}]', auth.uid());
select lives_ok($$ select public.start_session('5e550000-0000-0000-0000-00000000000a') $$, 'prof : ouvre sa séance');
select is((select status::text from public.live_sessions where id = '5e550000-0000-0000-0000-00000000000a'), 'live', 'séance en cours');
select is((select count(*)::int from public.live_rooms where kind = 'main'), 1, 'salle principale créée');
select public.join_session('5e550000-0000-0000-0000-00000000000a');

select pg_temp.act_as('b0000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.start_session('5e550000-0000-0000-0000-00000000000a') $$, '42501', null, 'autre prof : n''ouvre pas la séance');
select throws_ok($$ insert into public.live_sessions (class_id, created_by) values ('c0000000-0000-0000-0000-00000000000a', auth.uid()) $$, '42501', null, 'autre prof : ne crée pas de séance dans la classe A');
select is((select count(*)::int from public.live_sessions), 0, 'autre prof : ne voit pas la séance');

-- ---------------------------------------------------------------- élèves
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select isnt(public.join_session('5e550000-0000-0000-0000-00000000000a'), null, 'élève : rejoint la salle principale');
select throws_ok($$ select public.start_session('5e550000-0000-0000-0000-00000000000a') $$, '42501', null, 'élève : ne pilote pas la séance');
select throws_ok($$ update public.live_sessions set status = 'ended' $$, '42501', null, 'élève : ne change pas le statut');
select throws_ok($$ update public.live_participants set room_id = null where user_id = auth.uid() $$, '42501', null, 'élève : ne change pas de salle directement');
update public.live_participants set hand_raised_at = now() where user_id = auth.uid();
select isnt((select hand_raised_at from public.live_participants where user_id = auth.uid()), null, 'élève : lève la main');
update public.live_participants set hand_raised_at = now() where user_id = 'a0000000-0000-0000-0000-00000000000a';
select pg_temp.as_db();
select is((select hand_raised_at from public.live_participants where user_id = 'a0000000-0000-0000-0000-00000000000a'), null, 'élève : ne touche pas aux indicateurs des autres');
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
select public.join_session('5e550000-0000-0000-0000-00000000000a');
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select public.join_session('5e550000-0000-0000-0000-00000000000a');
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
select throws_ok($$ select public.join_session('5e550000-0000-0000-0000-00000000000a') $$, '42501', null, 'élève d''une autre classe : refusé');
select throws_ok($$ select public.session_state('5e550000-0000-0000-0000-00000000000a') $$, '42501', null, 'élève d''une autre classe : pas d''accès à l''état');

-- ---------------------------------------------------------------- talqîn, salles, rappel
select pg_temp.act_as('a0000000-0000-0000-0000-00000000000a');
select public.set_floor('5e550000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000001');
select is((select activity::text from public.live_participants where user_id = 'e0000000-0000-0000-0000-000000000001'), 'reciting', 'talqîn : l''élève désigné récite');
select is((select activity::text from public.live_participants where user_id = 'e0000000-0000-0000-0000-000000000002'), 'listening', 'talqîn : les autres écoutent');
update public.live_participants set hand_raised_at = null where user_id = 'e0000000-0000-0000-0000-000000000001';
select is((select hand_raised_at from public.live_participants where user_id = 'e0000000-0000-0000-0000-000000000001'), null, 'prof : baisse une main levée');

select public.open_rooms('5e550000-0000-0000-0000-00000000000a', 2,
  '[["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000002"],["e0000000-0000-0000-0000-000000000003"]]', 'assigned');
select is((select count(*)::int from public.live_rooms where kind = 'breakout' and not closed), 2, 'salles : deux salles ouvertes');
select is((select count(distinct room_id)::int from public.live_participants where user_id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')), 1, 'salles : le binôme est ensemble');
select is((select floor_user from public.live_sessions where id = '5e550000-0000-0000-0000-00000000000a'), null, 'salles : la parole est rendue');

select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.choose_room('5e550000-0000-0000-0000-00000000000a',
  (select id from public.live_rooms where name = 'Salle 1' and not closed)) $$, 'P0001', 'salles_assignees', 'mode assigné : l''élève ne choisit pas sa salle');

select pg_temp.act_as('a0000000-0000-0000-0000-00000000000a');
select public.open_rooms('5e550000-0000-0000-0000-00000000000a', 1, null, 'free', 2);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.choose_room('5e550000-0000-0000-0000-00000000000a', (select id from public.live_rooms where kind = 'breakout' and not closed)) $$, 'mode libre : choisit sa salle');
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
select public.choose_room('5e550000-0000-0000-0000-00000000000a', (select id from public.live_rooms where kind = 'breakout' and not closed));
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.choose_room('5e550000-0000-0000-0000-00000000000a', (select id from public.live_rooms where kind = 'breakout' and not closed)) $$,
  'P0001', 'salle_pleine', 'mode libre : salle pleine');

select pg_temp.act_as('a0000000-0000-0000-0000-00000000000a');
select public.move_participant('5e550000-0000-0000-0000-00000000000a', auth.uid(), (select id from public.live_rooms where kind = 'breakout' and not closed));
select isnt((select teacher_visited_at from public.live_rooms where kind = 'breakout' and not closed), null, 'passage du prof enregistré');
select public.recall_all('5e550000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.live_participants where room_id <> public.main_room('5e550000-0000-0000-0000-00000000000a')), 0, 'rappel général : tous en salle principale');
insert into public.live_announcements (session_id, author_id, body) values ('5e550000-0000-0000-0000-00000000000a', auth.uid(), 'Encore 5 minutes');
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
select is(jsonb_array_length(public.session_state('5e550000-0000-0000-0000-00000000000a') -> 'announcements'), 1, 'élève : reçoit l''annonce');
select throws_ok($$ insert into public.live_announcements (session_id, author_id, body) values ('5e550000-0000-0000-0000-00000000000a', auth.uid(), 'spam') $$, '42501', null, 'élève : ne publie pas d''annonce');

select * from finish();
rollback;
