-- Données de démonstration pour Supabase LOCAL uniquement (`npx supabase db reset`).
-- Jamais appliquées au projet hébergé. Mot de passe de tous les comptes : halaqa-demo
--   admin@halaqa.test (admin) · prof@halaqa.test (prof, classe « Groupe du jeudi »)
--   eleve1@halaqa.test … eleve5@halaqa.test (élèves de la classe)
-- Code d'invitation de la classe : DEMYC-XRS23 (lien /rejoindre/DEMYCXRS23).

insert into public.staff_invitations (code, role, note) values
  ('SEEDADMIN2', 'admin', 'démo'),
  ('SEEDPRF234', 'teacher', 'démo');

create function pg_temp.demo_user(uid uuid, mail text, invite text, display text) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', mail,
          extensions.crypt('halaqa-demo', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('invite', invite, 'display_name', display), now(), now(),
          '', '', '', '');
  -- (champs texte non nuls attendus par GoTrue)
  update auth.users set email_change_token_current = '', phone_change = '', phone_change_token = '', reauthentication_token = ''
  where id = uid;
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
          'email', now(), now(), now());
$$;

select pg_temp.demo_user('10000000-0000-0000-0000-000000000001', 'admin@halaqa.test', 'SEEDADMIN2', 'Admin');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000002', 'prof@halaqa.test', 'SEEDPRF234', 'Ustadh Karim');

insert into public.classes (id, teacher_id, name, invite_code)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Groupe du jeudi', 'DEMYCXRS23');

select pg_temp.demo_user('10000000-0000-0000-0000-000000000011', 'eleve1@halaqa.test', 'DEMYCXRS23', 'Amina');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000012', 'eleve2@halaqa.test', 'DEMYCXRS23', 'Bilal');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000013', 'eleve3@halaqa.test', 'DEMYCXRS23', 'Fatima');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000014', 'eleve4@halaqa.test', 'DEMYCXRS23', 'Youssef');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000015', 'eleve5@halaqa.test', 'DEMYCXRS23', 'Khadija');

-- Un peu de progression et une note, pour voir les écrans remplis.
insert into public.verse_progress (student_id, surah, ayah, status, updated_by)
select '10000000-0000-0000-0000-000000000011'::uuid, 1, a, 'acquired'::public.verse_status, '10000000-0000-0000-0000-000000000002'::uuid from generate_series(1, 7) a
union all
select '10000000-0000-0000-0000-000000000011', 114, a, 'acquired', '10000000-0000-0000-0000-000000000002' from generate_series(1, 6) a
union all
select '10000000-0000-0000-0000-000000000011', 112, a, 'learning', null::uuid from generate_series(1, 4) a
union all
select '10000000-0000-0000-0000-000000000011', 113, 3, 'review', '10000000-0000-0000-0000-000000000002';

insert into public.teacher_notes (teacher_id, surah, ayah, content) values
  ('10000000-0000-0000-0000-000000000002', 1, 2,
   'Al-hamdu : toute louange, au sens complet. Attention au ḥā'' (ح) de « al-ḥamdu », qui sort du milieu de la gorge.');
