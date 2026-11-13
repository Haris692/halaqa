-- Phase 2 — comptes, rôles, classes, invitations, notes du professeur, statuts de versets.
--
-- Principes :
--   * RLS activée sur toutes les tables ; aucune table n'est lisible sans compte.
--   * Inscription uniquement sur invitation : le déclencheur `handle_new_user`
--     refuse toute création de compte sans code valide (code de classe → élève,
--     invitation nominative → professeur ou admin).
--   * Le rôle d'un compte ne peut pas être modifié par son propriétaire
--     (droits par colonne) : seul un admin le change, via `admin_set_role`.
--   * Les fonctions utilisées par les politiques sont `security definer` pour
--     éviter la récursion des politiques entre tables ; elles ne renvoient que
--     des booléens sur l'utilisateur courant.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('student', 'teacher', 'admin');
create type public.verse_status as enum ('new', 'learning', 'acquired', 'review');

-- ---------------------------------------------------------------------------
-- Codes d'invitation : 10 caractères sans ambiguïté (pas de 0/O, 1/I/L), ~50 bits
-- ---------------------------------------------------------------------------

create function public.gen_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(10);
  code text := '';
begin
  for i in 0..9 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  role public.app_role not null default 'student',
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Un profil par compte : nom affiché et rôle. Créé par handle_new_user.';

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  invite_code text not null unique default public.gen_invite_code(),
  invite_open boolean not null default true,
  created_at timestamptz not null default now()
);
create index classes_teacher_idx on public.classes (teacher_id);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index class_members_student_idx on public.class_members (student_id);

create table public.staff_invitations (
  code text primary key default public.gen_invite_code(),
  role public.app_role not null check (role in ('teacher', 'admin')),
  note text check (note is null or char_length(note) <= 120),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz
);
comment on table public.staff_invitations is 'Invitations à usage unique pour créer un compte professeur ou admin.';

create table public.teacher_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  surah smallint not null check (surah between 1 and 114),
  ayah smallint not null check (ayah between 1 and 286),
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, surah, ayah)
);
comment on table public.teacher_notes is 'Explications du professeur par verset, visibles par les élèves de ses classes.';
create index teacher_notes_surah_idx on public.teacher_notes (surah);

create table public.verse_progress (
  student_id uuid not null references public.profiles (id) on delete cascade,
  surah smallint not null check (surah between 1 and 114),
  ayah smallint not null check (ayah between 1 and 286),
  status public.verse_status not null,
  last_reviewed_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (student_id, surah, ayah)
);
comment on table public.verse_progress is 'Statut de chaque verset pour un élève. Absence de ligne = « nouveau ».';

-- ---------------------------------------------------------------------------
-- Fonctions d'aide pour les politiques (utilisateur courant uniquement)
-- ---------------------------------------------------------------------------

create function public.current_role_is(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (roles));
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_role_is(array['admin']::public.app_role[]);
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_role_is(array['teacher', 'admin']::public.app_role[]);
$$;

/** L'utilisateur courant est le professeur de cette classe. */
create function public.teaches_class(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.classes c where c.id = target and c.teacher_id = auth.uid());
$$;

/** L'utilisateur courant est élève de cette classe. */
create function public.member_of_class(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.class_members m where m.class_id = target and m.student_id = auth.uid());
$$;

/** L'utilisateur courant est le professeur d'une classe dont `student` est membre. */
create function public.teaches_student(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.class_members m on m.class_id = c.id
    where c.teacher_id = auth.uid() and m.student_id = student
  );
$$;

/** L'utilisateur courant est élève d'une classe de `teacher`. */
create function public.taught_by(teacher uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.class_members m on m.class_id = c.id
    where c.teacher_id = teacher and m.student_id = auth.uid()
  );
$$;

/** L'utilisateur courant et `other` sont dans une même classe (comme élèves ou prof). */
create function public.shares_class_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    where (c.teacher_id = auth.uid() or exists (select 1 from public.class_members m where m.class_id = c.id and m.student_id = auth.uid()))
      and (c.teacher_id = other or exists (select 1 from public.class_members m where m.class_id = c.id and m.student_id = other))
  );
$$;

-- ---------------------------------------------------------------------------
-- Création du profil à l'inscription : invitation obligatoire
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite', '')));
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  target_class public.classes%rowtype;
  invitation public.staff_invitations%rowtype;
begin
  if v_name = '' then
    v_name := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  v_name := left(v_name, 60);

  select * into target_class from public.classes where invite_code = v_code and invite_open;
  if found then
    insert into public.profiles (id, display_name, role) values (new.id, v_name, 'student');
    insert into public.class_members (class_id, student_id) values (target_class.id, new.id);
    return new;
  end if;

  select * into invitation from public.staff_invitations
  where staff_invitations.code = v_code and used_at is null and expires_at > now()
  for update;
  if found then
    insert into public.profiles (id, display_name, role) values (new.id, v_name, invitation.role);
    update public.staff_invitations set used_by = new.id, used_at = now() where staff_invitations.code = invitation.code;
    return new;
  end if;

  raise exception 'invitation_invalide' using errcode = 'P0001', hint = 'Inscription sur invitation uniquement.';
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Horodatage et auteur des mises à jour
-- ---------------------------------------------------------------------------

create function public.touch_teacher_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger teacher_notes_touch
before update on public.teacher_notes
for each row execute function public.touch_teacher_note();

create function public.touch_verse_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.status in ('acquired', 'review') and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    new.last_reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger verse_progress_touch
before insert or update on public.verse_progress
for each row execute function public.touch_verse_progress();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.teacher_notes enable row level security;
alter table public.verse_progress enable row level security;

-- Les visiteurs sans compte n'ont accès à rien (le lecteur reste utilisable sans compte).
revoke all on public.profiles, public.classes, public.class_members, public.staff_invitations,
  public.teacher_notes, public.verse_progress from anon;

-- profiles : soi-même, les personnes de mes classes, tout pour l'admin.
create policy "profil lisible par soi, ses classes et l'admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_class_with(id) or public.is_admin());

create policy "profil modifiable par soi" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Seul le nom affiché est modifiable : le rôle passe par admin_set_role.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- classes
create policy "classe lisible par son prof, ses élèves et l'admin" on public.classes
  for select to authenticated
  using (teacher_id = auth.uid() or public.member_of_class(id) or public.is_admin());

create policy "un prof crée ses classes" on public.classes
  for insert to authenticated
  with check (teacher_id = auth.uid() and public.is_staff());

create policy "un prof modifie ses classes" on public.classes
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "un prof supprime ses classes" on public.classes
  for delete to authenticated
  using (teacher_id = auth.uid());

revoke update on public.classes from authenticated;
grant update (name, invite_open) on public.classes to authenticated;

-- class_members : on rejoint par join_class (code), on part soi-même ou le prof retire.
create policy "membres lisibles par la classe et l'admin" on public.class_members
  for select to authenticated
  using (student_id = auth.uid() or public.teaches_class(class_id) or public.member_of_class(class_id) or public.is_admin());

create policy "quitter une classe ou retirer un élève" on public.class_members
  for delete to authenticated
  using (student_id = auth.uid() or public.teaches_class(class_id));

revoke insert, update on public.class_members from authenticated;

-- staff_invitations : admin uniquement.
create policy "invitations gérées par l'admin" on public.staff_invitations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin() and created_by = auth.uid());

revoke update on public.staff_invitations from authenticated;

-- teacher_notes : le prof gère les siennes ; ses élèves les lisent.
create policy "notes lisibles par leur prof et ses élèves" on public.teacher_notes
  for select to authenticated
  using (teacher_id = auth.uid() or public.taught_by(teacher_id));

create policy "un prof écrit ses notes" on public.teacher_notes
  for insert to authenticated
  with check (teacher_id = auth.uid() and public.is_staff());

create policy "un prof modifie ses notes" on public.teacher_notes
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "un prof supprime ses notes" on public.teacher_notes
  for delete to authenticated
  using (teacher_id = auth.uid());

revoke update on public.teacher_notes from authenticated;
grant update (content) on public.teacher_notes to authenticated;

-- verse_progress : l'élève et ses profs. Seul un prof marque un verset « acquis ».
create policy "progression lisible par l'élève et ses profs" on public.verse_progress
  for select to authenticated
  using (student_id = auth.uid() or public.teaches_student(student_id));

create policy "progression écrite par l'élève ou ses profs" on public.verse_progress
  for insert to authenticated
  with check (
    public.teaches_student(student_id)
    or (student_id = auth.uid() and status <> 'acquired')
  );

create policy "progression modifiée par l'élève ou ses profs" on public.verse_progress
  for update to authenticated
  using (student_id = auth.uid() or public.teaches_student(student_id))
  with check (
    public.teaches_student(student_id)
    or (student_id = auth.uid() and status <> 'acquired')
  );

revoke delete on public.verse_progress from authenticated;
revoke update on public.verse_progress from authenticated;
-- L'application écrit par upsert (insert … on conflict do update), qui exige le droit
-- de mise à jour sur toutes les colonnes envoyées ; les politiques ci-dessus limitent
-- toujours les lignes concernées. updated_by et last_reviewed_at restent gérés par le déclencheur.
grant update (student_id, surah, ayah, status) on public.verse_progress to authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions appelables par l'application
-- ---------------------------------------------------------------------------

/** Ce qu'un code d'invitation permet (sans compte) : nom de la classe ou rôle. */
create function public.check_invite(code text)
returns table (kind text, class_name text, teacher_name text, role public.app_role)
language sql
stable
security definer
set search_path = ''
as $$
  select 'class', c.name, p.display_name, 'student'::public.app_role
  from public.classes c join public.profiles p on p.id = c.teacher_id
  where c.invite_code = upper(btrim(check_invite.code)) and c.invite_open
  union all
  select 'staff', null, null, i.role
  from public.staff_invitations i
  where i.code = upper(btrim(check_invite.code)) and i.used_at is null and i.expires_at > now();
$$;

/** Un élève déjà inscrit rejoint une autre classe avec son code. */
create function public.join_class(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'non_connecte' using errcode = '42501';
  end if;
  if not public.current_role_is(array['student']::public.app_role[]) then
    raise exception 'reserve_aux_eleves' using errcode = 'P0001';
  end if;
  select id into target from public.classes where invite_code = upper(btrim(join_class.code)) and invite_open;
  if target is null then
    raise exception 'invitation_invalide' using errcode = 'P0001';
  end if;
  insert into public.class_members (class_id, student_id) values (target, auth.uid()) on conflict do nothing;
  return target;
end;
$$;

/** Le prof génère un nouveau code (l'ancien lien cesse de fonctionner). */
create function public.regenerate_invite_code(class_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh text := public.gen_invite_code();
begin
  update public.classes set invite_code = fresh
  where id = regenerate_invite_code.class_id and teacher_id = auth.uid();
  if not found then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  return fresh;
end;
$$;

/** Admin : liste des comptes avec leur e-mail (que les profs ne voient pas). */
create function public.admin_list_users()
returns table (id uuid, email text, display_name text, role public.app_role, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.created_at, u.last_sign_in_at
    from public.profiles p join auth.users u on u.id = p.id
    order by p.created_at;
end;
$$;

/** Admin : change le rôle d'un compte (pas le sien, pour ne pas perdre le dernier admin). */
create function public.admin_set_role(target uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'propre_role' using errcode = 'P0001';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

/** RGPD : suppression de son compte et de toutes ses données (cascade). */
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'non_connecte' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Les fonctions internes ne sont pas appelables directement ; seules les RPC le sont.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.current_role_is(public.app_role[]),
  public.is_admin(),
  public.is_staff(),
  public.teaches_class(uuid),
  public.member_of_class(uuid),
  public.teaches_student(uuid),
  public.taught_by(uuid),
  public.shares_class_with(uuid),
  public.join_class(text),
  public.regenerate_invite_code(uuid),
  public.admin_list_users(),
  public.admin_set_role(uuid, public.app_role),
  public.delete_my_account()
to authenticated;
grant execute on function public.check_invite(text) to anon, authenticated;
-- gen_invite_code sert de valeur par défaut aux insertions des profs/admins.
grant execute on function public.gen_invite_code() to authenticated;
