-- Tests des politiques RLS de la phase 2 : `npm run test:db` (Supabase local requis).
-- Scénario : 1 admin, 2 profs (A, B), 3 élèves (1 et 2 chez A, 3 chez B), 1 inconnu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- ---------------------------------------------------------------- utilitaires
create function pg_temp.signup(uid uuid, mail text, invite text, display text) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', mail,
          jsonb_build_object('invite', invite, 'display_name', display), now(), now());
$$;
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_admin_db() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- ---------------------------------------------------------------- inscription
insert into public.staff_invitations (code, role) values ('ADMINCODE1', 'admin'), ('PROFCODEA1', 'teacher'), ('PROFCODEB1', 'teacher'),
  ('EXPIRED001', 'teacher');
update public.staff_invitations set expires_at = now() - interval '1 day' where code = 'EXPIRED001';

select pg_temp.signup('00000000-0000-0000-0000-0000000000ad', 'admin@test.fr', 'admincode1', 'Admin');
select pg_temp.signup('00000000-0000-0000-0000-0000000000a1', 'profa@test.fr', 'PROFCODEA1', 'Prof A');
select pg_temp.signup('00000000-0000-0000-0000-0000000000b1', 'profb@test.fr', 'PROFCODEB1', 'Prof B');

select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000ad'), 'admin', 'invitation admin → rôle admin (code insensible à la casse)');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'teacher', 'invitation prof → rôle prof');
select isnt((select used_at from public.staff_invitations where code = 'PROFCODEA1'), null, 'invitation marquée utilisée');

select throws_ok($$ select pg_temp.signup(gen_random_uuid(), 'x@test.fr', 'PROFCODEA1', 'Réutilisation') $$,
  'P0001', 'invitation_invalide', 'invitation de prof à usage unique');
select throws_ok($$ select pg_temp.signup(gen_random_uuid(), 'y@test.fr', 'EXPIRED001', 'Expirée') $$,
  'P0001', 'invitation_invalide', 'invitation expirée refusée');
select throws_ok($$ select pg_temp.signup(gen_random_uuid(), 'z@test.fr', '', 'Sans code') $$,
  'P0001', 'invitation_invalide', 'inscription sans invitation refusée');

-- Les profs créent leurs classes.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.classes (id, teacher_id, name, invite_code) values ('00000000-0000-0000-0000-00000000c1a5', '00000000-0000-0000-0000-0000000000a1', 'Classe A', 'CLASSEAAAA');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
insert into public.classes (id, teacher_id, name, invite_code) values ('00000000-0000-0000-0000-00000000c1b5', '00000000-0000-0000-0000-0000000000b1', 'Classe B', 'CLASSEBBBB');
select pg_temp.act_as_admin_db();

select pg_temp.signup('00000000-0000-0000-0000-000000000001', 'e1@test.fr', 'CLASSEAAAA', 'Élève 1');
select pg_temp.signup('00000000-0000-0000-0000-000000000002', 'e2@test.fr', ' classeaaaa ', 'Élève 2');
select pg_temp.signup('00000000-0000-0000-0000-000000000003', 'e3@test.fr', 'CLASSEBBBB', 'Élève 3');
select is((select count(*)::int from public.class_members where class_id = '00000000-0000-0000-0000-00000000c1a5'), 2, 'code de classe → élève inscrit dans la classe');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 'student', 'code de classe → rôle élève');

-- ---------------------------------------------------------------- anonyme
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anonyme : profils inaccessibles');
select is((select count(*)::int from public.check_invite('CLASSEAAAA')), 1, 'anonyme : vérifier un code de classe');
select is((select class_name from public.check_invite('CLASSEAAAA')), 'Classe A', 'anonyme : nom de la classe invitante');
select is((select count(*)::int from public.check_invite('INCONNU000')), 0, 'anonyme : code inconnu');
select pg_temp.act_as_admin_db();

-- ---------------------------------------------------------------- élève 1
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.profiles), 3, 'élève : voit soi, son camarade et son prof');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 0, 'élève : ne voit pas un autre prof');
select is((select count(*)::int from public.classes), 1, 'élève : ne voit que sa classe');
select is((select count(*)::int from public.class_members), 2, 'élève : voit les membres de sa classe');
select is((select count(*)::int from public.staff_invitations), 0, 'élève : pas d''accès aux invitations');

select throws_ok($$ update public.profiles set role = 'admin' where id = auth.uid() $$, '42501', null, 'élève : ne peut pas changer son rôle');
update public.profiles set display_name = 'Élève Un' where id = auth.uid();
select is((select display_name from public.profiles where id = auth.uid()), 'Élève Un', 'élève : modifie son nom');
update public.profiles set display_name = 'Piratage' where id = '00000000-0000-0000-0000-000000000002';
select pg_temp.act_as_admin_db();
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'Élève 2', 'élève : ne modifie pas le nom d''un autre');
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');

select throws_ok($$ insert into public.classes (teacher_id, name) values (auth.uid(), 'Ma classe') $$, '42501', null, 'élève : ne crée pas de classe');
select throws_ok($$ insert into public.class_members (class_id, student_id) values ('00000000-0000-0000-0000-00000000c1b5', auth.uid()) $$, '42501', null, 'élève : ne s''ajoute pas à une classe sans code');

insert into public.verse_progress (student_id, surah, ayah, status) values (auth.uid(), 1, 1, 'learning');
select is((select status::text from public.verse_progress where student_id = auth.uid() and surah = 1 and ayah = 1), 'learning', 'élève : note sa progression');
-- upsert, comme l'application
insert into public.verse_progress (student_id, surah, ayah, status) values (auth.uid(), 1, 1, 'review')
  on conflict (student_id, surah, ayah) do update set student_id = excluded.student_id, surah = excluded.surah, ayah = excluded.ayah, status = excluded.status;
select is((select status::text from public.verse_progress where student_id = auth.uid() and surah = 1 and ayah = 1), 'review', 'élève : upsert de sa progression');
update public.verse_progress set status = 'learning' where student_id = auth.uid() and surah = 1 and ayah = 1;
select throws_ok($$ insert into public.verse_progress (student_id, surah, ayah, status) values (auth.uid(), 1, 1, 'acquired')
  on conflict (student_id, surah, ayah) do update set status = excluded.status $$, '42501', null, 'élève : pas d''« acquis » par upsert non plus');
select throws_ok($$ insert into public.verse_progress (student_id, surah, ayah, status) values (auth.uid(), 1, 2, 'acquired') $$, '42501', null, 'élève : ne se marque pas « acquis » lui-même');
select throws_ok($$ insert into public.verse_progress (student_id, surah, ayah, status) values ('00000000-0000-0000-0000-000000000002', 1, 1, 'learning') $$, '42501', null, 'élève : n''écrit pas la progression d''un autre');

-- Rejoindre une autre classe avec son code, puis la quitter.
select ok(public.join_class('classebbbb') is not null, 'élève : rejoint une 2e classe avec le code');
select is((select count(*)::int from public.classes), 2, 'élève : voit ses deux classes');
delete from public.class_members where class_id = '00000000-0000-0000-0000-00000000c1b5' and student_id = auth.uid();
select is((select count(*)::int from public.classes), 1, 'élève : quitte une classe');
select pg_temp.act_as_admin_db();

-- ---------------------------------------------------------------- prof A
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.verse_progress (student_id, surah, ayah, status) values ('00000000-0000-0000-0000-000000000001', 1, 2, 'acquired');
update public.verse_progress set status = 'review' where student_id = '00000000-0000-0000-0000-000000000001' and surah = 1 and ayah = 1;
select is((select count(*)::int from public.verse_progress where student_id = '00000000-0000-0000-0000-000000000001' and status in ('acquired', 'review')), 2, 'prof : valide et marque « à revoir » chez son élève');
select is((select updated_by from public.verse_progress where student_id = '00000000-0000-0000-0000-000000000001' and ayah = 2), '00000000-0000-0000-0000-0000000000a1'::uuid, 'prof : auteur de la mise à jour enregistré');
select throws_ok($$ insert into public.verse_progress (student_id, surah, ayah, status) values ('00000000-0000-0000-0000-000000000003', 1, 1, 'acquired') $$, '42501', null, 'prof : n''écrit pas chez l''élève d''un autre prof');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000003'), 0, 'prof : ne voit pas l''élève d''un autre prof');

insert into public.teacher_notes (teacher_id, surah, ayah, content) values (auth.uid(), 1, 1, 'Sens de la basmala');
select throws_ok($$ insert into public.teacher_notes (teacher_id, surah, ayah, content) values ('00000000-0000-0000-0000-0000000000b1', 1, 1, 'Usurpation') $$, '42501', null, 'prof : n''écrit pas au nom d''un autre');
select throws_ok($$ update public.classes set teacher_id = '00000000-0000-0000-0000-0000000000b1' where id = '00000000-0000-0000-0000-00000000c1a5' $$, '42501', null, 'prof : ne cède pas sa classe en douce');
select ok(public.regenerate_invite_code('00000000-0000-0000-0000-00000000c1a5') <> 'CLASSEAAAA', 'prof : régénère le code de sa classe');
select throws_ok($$ select public.regenerate_invite_code('00000000-0000-0000-0000-00000000c1b5') $$, '42501', null, 'prof : pas le code d''une autre classe');
select pg_temp.act_as_admin_db();

-- ---------------------------------------------------------------- notes vues par les élèves
select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.teacher_notes), 1, 'élève : lit les notes de son prof');
select is((select count(*)::int from public.verse_progress), 0, 'élève : ne voit pas la progression d''un camarade');
select pg_temp.act_as('00000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.teacher_notes), 0, 'élève d''un autre prof : ne lit pas ces notes');
select pg_temp.act_as_admin_db();

-- ---------------------------------------------------------------- admin
select pg_temp.act_as('00000000-0000-0000-0000-0000000000ad');
select is((select count(*)::int from public.admin_list_users() where email like '%@test.fr'), 6, 'admin : liste tous les comptes');
select lives_ok($$ select public.admin_set_role('00000000-0000-0000-0000-000000000003', 'teacher') $$, 'admin : change un rôle');
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select throws_ok($$ select * from public.admin_list_users() $$, '42501', null, 'élève : pas d''accès à la liste des comptes');
select pg_temp.act_as_admin_db();

select * from finish();
rollback;
