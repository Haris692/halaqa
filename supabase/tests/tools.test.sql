-- Tests des outils du prof (phase 4) : crayon, marquages, corrections, validations, prise de main, test.
-- Scénario : prof A (classe A : élèves 1, 2, 3), prof B (classe B : élève 4).
-- Salles : salle 1 = binôme élèves 1 + 2, salle 2 = élève 3.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

create function pg_temp.signup(uid uuid, invite text) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', uid::text || '@tools.test',
          jsonb_build_object('invite', invite, 'display_name', left(uid::text, 8)), now(), now());
$$;
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_db() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.room(n int) returns uuid language sql as $$
  select id from public.live_rooms where session_id = '5e550000-0000-0000-0000-0000000000a4'
    and (case when n = 0 then kind = 'main' else kind = 'breakout' and position = n end);
$$;

insert into public.staff_invitations (code, role) values ('TOOLPRFAAA', 'teacher'), ('TOOLPRFBBB', 'teacher');
select pg_temp.signup('a0000000-0000-0000-0000-0000000000a4', 'TOOLPRFAAA');
select pg_temp.signup('b0000000-0000-0000-0000-0000000000b4', 'TOOLPRFBBB');
insert into public.classes (id, teacher_id, name, invite_code) values
  ('c0000000-0000-0000-0000-0000000000a4', 'a0000000-0000-0000-0000-0000000000a4', 'Outils A', 'TOOLCLASSA'),
  ('c0000000-0000-0000-0000-0000000000b4', 'b0000000-0000-0000-0000-0000000000b4', 'Outils B', 'TOOLCLASSB');
select pg_temp.signup('e0000000-0000-0000-0000-0000000000a1', 'TOOLCLASSA');
select pg_temp.signup('e0000000-0000-0000-0000-0000000000a2', 'TOOLCLASSA');
select pg_temp.signup('e0000000-0000-0000-0000-0000000000a3', 'TOOLCLASSA');
select pg_temp.signup('e0000000-0000-0000-0000-0000000000b4', 'TOOLCLASSB');

-- séance en cours, tout le monde dedans, deux salles
select pg_temp.act_as('a0000000-0000-0000-0000-0000000000a4');
insert into public.live_sessions (id, class_id, title, created_by, passage) values
  ('5e550000-0000-0000-0000-0000000000a4', 'c0000000-0000-0000-0000-0000000000a4', 'Outils', auth.uid(),
   '{"surah": 114, "from": 1, "to": 6}');
select public.start_session('5e550000-0000-0000-0000-0000000000a4');
select public.join_session('5e550000-0000-0000-0000-0000000000a4');
select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a1');
select public.join_session('5e550000-0000-0000-0000-0000000000a4');
select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a2');
select public.join_session('5e550000-0000-0000-0000-0000000000a4');
select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a3');
select public.join_session('5e550000-0000-0000-0000-0000000000a4');
select pg_temp.act_as('a0000000-0000-0000-0000-0000000000a4');
select public.open_rooms('5e550000-0000-0000-0000-0000000000a4', 2,
  '[["e0000000-0000-0000-0000-0000000000a1","e0000000-0000-0000-0000-0000000000a2"],["e0000000-0000-0000-0000-0000000000a3"]]', 'assigned');
select public.move_participant('5e550000-0000-0000-0000-0000000000a4', auth.uid(), pg_temp.room(1));

-- ---------------------------------------------------------------- crayon
select lives_ok($$ insert into public.annotations (id, room_id, kind, anchor, points, style) values
  ('a1000000-0000-0000-0000-000000000001', pg_temp.room(1), 'stroke', '{"kind":"word","word":"112:1:1"}', '{0,0,100,100}',
   '{"tool":"pen","color":"red","width":0.09}') $$, 'prof : dessine dans la salle');
select is((select author_role::text from public.annotations where id = 'a1000000-0000-0000-0000-000000000001'), 'teacher', 'trait : rôle fixé par la base');
select is((select cardinality(student_ids) from public.annotations where id = 'a1000000-0000-0000-0000-000000000001'), 2, 'trait : rattaché aux deux élèves présents');

select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a1');
select throws_ok($$ insert into public.annotations (id, room_id, kind, anchor, points, style) values
  ('a1000000-0000-0000-0000-000000000002', pg_temp.room(1), 'stroke', '{"kind":"word","word":"112:1:1"}', '{0,0}', '{}') $$,
  '42501', null, 'élève : pas de crayon sans autorisation');
select throws_ok($$ insert into public.annotations (id, room_id, kind, words, style, author_role) values
  ('a1000000-0000-0000-0000-000000000003', pg_temp.room(1), 'mark', '{112:1:1}', '{}', 'teacher') $$,
  '42501', null, 'élève : ne choisit pas son rôle');
select throws_ok($$ select public.set_room_pen(pg_temp.room(1), true) $$, '42501', null, 'élève : ne s''autorise pas le crayon');

select pg_temp.act_as('a0000000-0000-0000-0000-0000000000a4');
select public.set_room_pen(pg_temp.room(1), true);
select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a1');
select lives_ok($$ insert into public.annotations (id, room_id, kind, words, style) values
  ('a1000000-0000-0000-0000-000000000004', pg_temp.room(1), 'mark', '{112:1:2,112:1:3}', '{"kind":"highlight","color":"green"}') $$,
  'élève : marque des mots une fois autorisé');
select is((select author_role::text from public.annotations where id = 'a1000000-0000-0000-0000-000000000004'), 'peer', 'marquage de l''élève : rôle binôme');
select is((select count(*)::int from public.annotations), 2, 'élève : revoit les annotations faites devant lui');

select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a2');
delete from public.annotations where id = 'a1000000-0000-0000-0000-000000000004';
select is((select count(*)::int from public.annotations where id = 'a1000000-0000-0000-0000-000000000004'), 1, 'binôme : n''efface pas le marquage de l''autre');

select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a3');
select throws_ok($$ insert into public.annotations (id, room_id, kind, words, style) values
  ('a1000000-0000-0000-0000-000000000005', pg_temp.room(1), 'mark', '{112:1:1}', '{}') $$,
  '42501', null, 'élève d''une autre salle : ne dessine pas chez les autres');
select is((select count(*)::int from public.annotations), 0, 'élève d''une autre salle : ne voit pas leurs annotations');
select throws_ok($$ select public.room_board(pg_temp.room(1)) $$, '42501', null, 'élève d''une autre salle : pas d''accès au tableau');

select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.room_board(pg_temp.room(1)) -> 'annotations'), 2, 'élève de la salle : charge le tableau');

-- ---------------------------------------------------------------- corrections
select pg_temp.act_as('a0000000-0000-0000-0000-0000000000a4');
select lives_ok($$ insert into public.corrections (id, room_id, student_id, word, error_type, tajweed_rule, comment) values
  ('c1000000-0000-0000-0000-000000000001', pg_temp.room(1), 'e0000000-0000-0000-0000-0000000000a1', '112:1:2', 'tajweed', 'ghunna', '  ') $$,
  'prof : relève une erreur');
select is((select status::text || '/' || author_role::text || '/' || verse || '/' || coalesce(comment, '-') from public.corrections
  where id = 'c1000000-0000-0000-0000-000000000001'), 'confirmed/teacher/112:1/-', 'correction du prof : confirmée, verset déduit, commentaire vide retiré');

select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a2');
select lives_ok($$ insert into public.corrections (id, room_id, student_id, word, error_type) values
  ('c1000000-0000-0000-0000-000000000002', pg_temp.room(1), 'e0000000-0000-0000-0000-0000000000a1', '112:1:3', 'haraka') $$,
  'binôme : marque une erreur de son partenaire');
select is((select status::text from public.corrections where id = 'c1000000-0000-0000-0000-000000000002'), 'pending', 'marquage du binôme : en attente du prof');
select throws_ok($$ insert into public.corrections (id, room_id, student_id, word, error_type) values
  ('c1000000-0000-0000-0000-000000000003', pg_temp.room(1), auth.uid(), '112:1:3', 'haraka') $$,
  '42501', null, 'binôme : ne se corrige pas lui-même');
select is((select count(*)::int from public.corrections), 1, 'binôme : ne voit que les marquages qu''il a faits');

select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a3');
select throws_ok($$ insert into public.corrections (id, room_id, student_id, word, error_type) values
  ('c1000000-0000-0000-0000-000000000004', pg_temp.room(2), 'e0000000-0000-0000-0000-0000000000a1', '112:1:1', 'forgotten') $$,
  '42501', null, 'élève d''une autre salle : ne corrige pas');

select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.corrections), 2, 'élève : voit les erreurs relevées sur lui');
update public.corrections set status = 'confirmed' where id = 'c1000000-0000-0000-0000-000000000002';
select pg_temp.act_as('a0000000-0000-0000-0000-0000000000a4');
select is((select status::text from public.corrections where id = 'c1000000-0000-0000-0000-000000000002'), 'pending', 'élève : ne confirme pas un marquage');
update public.corrections set status = 'confirmed' where id = 'c1000000-0000-0000-0000-000000000002';
select is((select status::text from public.corrections where id = 'c1000000-0000-0000-0000-000000000002'), 'confirmed', 'prof : confirme le marquage du binôme');

select pg_temp.act_as('b0000000-0000-0000-0000-0000000000b4');
select is((select count(*)::int from public.corrections), 0, 'autre prof : ne voit pas les corrections');
select pg_temp.act_as('e0000000-0000-0000-0000-0000000000b4');
select throws_ok($$ select public.session_error_summary('5e550000-0000-0000-0000-0000000000a4') $$, '42501', null, 'élève d''une autre classe : pas d''agrégat');

-- ---------------------------------------------------------------- validations, prise de main, test
select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a1');
select throws_ok($$ insert into public.verse_results (session_id, student_id, verse, result) values
  ('5e550000-0000-0000-0000-0000000000a4', auth.uid(), '112:1', 'validated') $$, '42501', null, 'élève : ne valide pas ses versets');
select throws_ok($$ select public.set_room_leader(pg_temp.room(1), true) $$, '42501', null, 'élève : ne prend pas la main');
select throws_ok($$ select public.start_quiz(pg_temp.room(1), auth.uid()) $$, '42501', null, 'élève : ne lance pas de test');

select pg_temp.act_as('a0000000-0000-0000-0000-0000000000a4');
insert into public.verse_results (session_id, student_id, verse, result) values
  ('5e550000-0000-0000-0000-0000000000a4', 'e0000000-0000-0000-0000-0000000000a1', '112:1', 'validated');
select is((select status::text from public.verse_progress where student_id = 'e0000000-0000-0000-0000-0000000000a1' and surah = 112 and ayah = 1),
  'acquired', 'validation : le verset passe « acquis »');
select is(public.start_quiz(pg_temp.room(1), 'e0000000-0000-0000-0000-0000000000a1'), '112:1', 'test : verset tiré parmi ceux appris');
select alike(public.start_quiz(pg_temp.room(2), 'e0000000-0000-0000-0000-0000000000a3'), '114:%', 'test : sinon dans le passage du jour');

select public.set_room_leader(pg_temp.room(1), true);
select public.move_participant('5e550000-0000-0000-0000-0000000000a4', auth.uid(), pg_temp.room(2));
select is((select leader_id from public.live_rooms where id = pg_temp.room(1)), null, 'prise de main : rendue quand le prof change de salle');

-- ---------------------------------------------------------------- agrégat, récapitulatif, fin
select is((public.session_error_summary('5e550000-0000-0000-0000-0000000000a4') ->> 'total')::int, 2, 'agrégat : erreurs confirmées seulement');
select is(jsonb_array_length(public.session_recap('5e550000-0000-0000-0000-0000000000a4') -> 'students'), 3, 'récapitulatif du prof : chaque élève');
select pg_temp.act_as('e0000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.session_recap('5e550000-0000-0000-0000-0000000000a4') -> 'students'), 1, 'récapitulatif de l''élève : le sien seulement');
select throws_ok($$ select public.clear_board(pg_temp.room(1)) $$, '42501', null, 'élève : n''efface pas tout');

select pg_temp.act_as('a0000000-0000-0000-0000-0000000000a4');
select public.end_session('5e550000-0000-0000-0000-0000000000a4');
select throws_ok($$ insert into public.annotations (id, room_id, kind, words, style) values
  ('a1000000-0000-0000-0000-000000000006', pg_temp.room(0), 'mark', '{112:1:1}', '{}') $$,
  '42501', null, 'séance terminée : plus d''annotation');

select * from finish();
rollback;
