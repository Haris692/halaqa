-- Phase 3 — séances en direct : séance (plan, minuteur, talqîn), salles, participants,
-- mains levées, annonces, rappel général.
--
-- L'état de la séance vit ici (Supabase Realtime le diffuse) ; la visio passe par LiveKit.
-- Les élèves ne modifient que leurs propres indicateurs (main levée, activité, verset) ;
-- tout changement de salle passe par des fonctions qui vérifient les droits.

create type public.session_status as enum ('planned', 'live', 'ended');
create type public.room_kind as enum ('main', 'breakout');
create type public.participant_activity as enum ('idle', 'listening', 'reciting');

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  status public.session_status not null default 'planned',
  -- plan de séance : [{ "key": "opening" | "talqin" | "rooms" | "review" | "homework" | "custom", "title": "…", "minutes": 5 }]
  plan jsonb not null default '[]' check (jsonb_typeof(plan) = 'array'),
  tajweed_focus text check (tajweed_focus is null or char_length(tajweed_focus) <= 40),
  -- passage du jour : { "surah": 112, "from": 1, "to": 4 }
  passage jsonb check (passage is null or jsonb_typeof(passage) = 'object'),
  notes text check (notes is null or char_length(notes) <= 2000),
  current_step integer not null default 0,
  step_started_at timestamptz,
  room_mode text not null default 'assigned' check (room_mode in ('assigned', 'free')),
  -- talqîn : élève qui a la parole (les autres micros sont coupés côté serveur)
  floor_user uuid references public.profiles (id) on delete set null,
  -- verset surligné chez tout le monde
  focus_verse text check (focus_verse is null or focus_verse ~ '^[0-9]{1,3}:[0-9]{1,3}$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
create index live_sessions_class_idx on public.live_sessions (class_id, created_at desc);
-- une seule séance en cours par classe
create unique index live_sessions_one_live on public.live_sessions (class_id) where status = 'live';

create table public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  kind public.room_kind not null,
  name text not null check (char_length(name) between 1 and 40),
  position integer not null default 0,
  capacity integer not null default 2 check (capacity between 1 and 50),
  closed boolean not null default false,
  teacher_visited_at timestamptz,
  created_at timestamptz not null default now()
);
create index live_rooms_session_idx on public.live_rooms (session_id, position);
create unique index live_rooms_one_main on public.live_rooms (session_id) where kind = 'main';

create table public.live_participants (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_id uuid references public.live_rooms (id) on delete set null,
  activity public.participant_activity not null default 'idle',
  hand_raised_at timestamptz,
  current_verse text check (current_verse is null or current_verse ~ '^[0-9]{1,3}:[0-9]{1,3}$'),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index live_participants_room_idx on public.live_participants (room_id);

create table public.live_announcements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index live_announcements_session_idx on public.live_announcements (session_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Aides pour les politiques
-- ---------------------------------------------------------------------------

create function public.teaches_session(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.live_sessions s join public.classes c on c.id = s.class_id
    where s.id = target and c.teacher_id = auth.uid()
  );
$$;

create function public.attends_session(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.live_sessions s
    join public.class_members m on m.class_id = s.class_id
    where s.id = target and m.student_id = auth.uid()
  ) or public.teaches_session(target);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.live_sessions enable row level security;
alter table public.live_rooms enable row level security;
alter table public.live_participants enable row level security;
alter table public.live_announcements enable row level security;
revoke all on public.live_sessions, public.live_rooms, public.live_participants, public.live_announcements from anon;

-- séances : lues par la classe ; préparées et modifiées par le prof
create policy "séance lisible par la classe" on public.live_sessions
  for select to authenticated using (public.teaches_class(class_id) or public.member_of_class(class_id));
create policy "le prof prépare ses séances" on public.live_sessions
  for insert to authenticated with check (public.teaches_class(class_id) and created_by = auth.uid());
create policy "le prof modifie ses séances" on public.live_sessions
  for update to authenticated using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
create policy "le prof supprime ses séances" on public.live_sessions
  for delete to authenticated using (public.teaches_class(class_id) and status <> 'live');
-- statut, salles et parole passent par les fonctions ci-dessous ; le prof édite le contenu du plan
revoke update on public.live_sessions from authenticated;
grant update (title, plan, tajweed_focus, passage, notes, focus_verse) on public.live_sessions to authenticated;

-- salles : lues par la séance ; créées et modifiées par les fonctions
create policy "salles lisibles par la séance" on public.live_rooms
  for select to authenticated using (public.attends_session(session_id));
revoke insert, update, delete on public.live_rooms from authenticated;

-- participants : lus par la séance ; chacun met à jour ses indicateurs
create policy "participants lisibles par la séance" on public.live_participants
  for select to authenticated using (public.attends_session(session_id));
create policy "chacun met à jour ses indicateurs" on public.live_participants
  for update to authenticated
  using (user_id = auth.uid() or public.teaches_session(session_id))
  with check (user_id = auth.uid() or public.teaches_session(session_id));
revoke insert, update, delete on public.live_participants from authenticated;
-- main levée (le prof peut la baisser), activité, verset en cours, signe de vie
grant update (activity, hand_raised_at, current_verse, last_seen_at) on public.live_participants to authenticated;

-- annonces : écrites par le prof, lues par la séance
create policy "annonces lisibles par la séance" on public.live_announcements
  for select to authenticated using (public.attends_session(session_id));
create policy "le prof publie des annonces" on public.live_announcements
  for insert to authenticated with check (public.teaches_session(session_id) and author_id = auth.uid());
revoke update, delete on public.live_announcements from authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions de séance
-- ---------------------------------------------------------------------------

create function public.require_teacher(target uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.teaches_session(target) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
end;
$$;

create function public.main_room(target uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.live_rooms where session_id = target and kind = 'main';
$$;

/** Le prof ouvre la séance : salle principale, première étape du plan, minuteur. */
create function public.start_session(session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := start_session.session_id;
begin
  perform public.require_teacher(sid);
  update public.live_sessions
  set status = 'live', started_at = coalesce(started_at, now()), current_step = 0, step_started_at = now(), ended_at = null
  where id = sid and status <> 'live';
  insert into public.live_rooms (session_id, kind, name, position, capacity)
  values (sid, 'main', 'Salle principale', 0, 50)
  on conflict do nothing;
end;
$$;

/** Fin de séance : tout le monde sort, la parole est rendue. */
create function public.end_session(session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := end_session.session_id;
begin
  perform public.require_teacher(sid);
  update public.live_sessions set status = 'ended', ended_at = now(), floor_user = null, focus_verse = null where id = sid;
  update public.live_rooms set closed = true where live_rooms.session_id = sid and kind = 'breakout';
  update public.live_participants set room_id = null, hand_raised_at = null where live_participants.session_id = sid;
end;
$$;

/** Rejoindre la séance en cours : salle principale, ou sa salle actuelle. */
create function public.join_session(session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := join_session.session_id;
  room uuid;
begin
  if not public.attends_session(sid) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if not exists (select 1 from public.live_sessions where id = sid and status = 'live') then
    raise exception 'seance_fermee' using errcode = 'P0001';
  end if;
  insert into public.live_participants as p (session_id, user_id, room_id)
  values (sid, auth.uid(), public.main_room(sid))
  on conflict (session_id, user_id) do update
    set last_seen_at = now(),
        room_id = coalesce(
          (select r.id from public.live_rooms r where r.id = p.room_id and not r.closed),
          public.main_room(sid))
  returning p.room_id into room;
  return room;
end;
$$;

/** Étape suivante (ou précédente) du plan ; le minuteur repart. */
create function public.set_step(session_id uuid, step integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := set_step.session_id;
begin
  perform public.require_teacher(sid);
  update public.live_sessions
  set current_step = greatest(0, least(set_step.step, greatest(jsonb_array_length(plan) - 1, 0))), step_started_at = now()
  where id = sid;
end;
$$;

/**
 * Ouvre les salles secondaires (les précédentes sont fermées).
 * `groups` : tableau de tableaux d'identifiants d'élèves, un par salle (mode « assignation ») ;
 * en mode « libre », seules les salles sont créées (`room_count`), chacun choisit la sienne.
 */
create function public.open_rooms(session_id uuid, room_count integer, groups jsonb, mode text, capacity integer default 2)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := open_rooms.session_id;
  n integer := greatest(1, least(open_rooms.room_count, 30));
  room_ids uuid[] := '{}';
  new_id uuid;
  grp jsonb;
  member text;
  idx integer := 0;
begin
  perform public.require_teacher(sid);
  if mode not in ('assigned', 'free') then
    raise exception 'mode_invalide' using errcode = 'P0001';
  end if;
  update public.live_rooms set closed = true where live_rooms.session_id = sid and kind = 'breakout' and not closed;
  update public.live_participants set room_id = public.main_room(sid)
  where live_participants.session_id = sid and room_id is not null;
  for i in 1..n loop
    insert into public.live_rooms (session_id, kind, name, position, capacity)
    values (sid, 'breakout', 'Salle ' || i, i, greatest(1, open_rooms.capacity))
    returning id into new_id;
    room_ids := room_ids || new_id;
  end loop;
  update public.live_sessions set room_mode = mode, floor_user = null where id = sid;
  if mode = 'assigned' and groups is not null and jsonb_typeof(groups) = 'array' then
    for grp in select * from jsonb_array_elements(groups) loop
      idx := idx + 1;
      exit when idx > n;
      for member in select * from jsonb_array_elements_text(grp) loop
        update public.live_participants set room_id = room_ids[idx]
        where live_participants.session_id = sid and user_id = member::uuid;
      end loop;
    end loop;
  end if;
end;
$$;

/** Le prof déplace quelqu'un (lui-même compris : c'est ainsi qu'il « passe » dans une salle). */
create function public.move_participant(session_id uuid, user_id uuid, room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := move_participant.session_id;
begin
  perform public.require_teacher(sid);
  if not exists (select 1 from public.live_rooms r where r.id = move_participant.room_id and r.session_id = sid and not r.closed) then
    raise exception 'salle_inconnue' using errcode = 'P0001';
  end if;
  update public.live_participants p set room_id = move_participant.room_id
  where p.session_id = sid and p.user_id = move_participant.user_id;
  if move_participant.user_id = auth.uid() then
    update public.live_rooms set teacher_visited_at = now() where id = move_participant.room_id;
  end if;
end;
$$;

/** En mode « libre », l'élève choisit sa salle (dans la limite des places). */
create function public.choose_room(session_id uuid, room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := choose_room.session_id;
  target public.live_rooms%rowtype;
begin
  if not public.attends_session(sid) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  select * into target from public.live_rooms r where r.id = choose_room.room_id and r.session_id = sid and not r.closed;
  if not found then
    raise exception 'salle_inconnue' using errcode = 'P0001';
  end if;
  if target.kind = 'breakout' and not exists (select 1 from public.live_sessions where id = sid and room_mode = 'free') then
    raise exception 'salles_assignees' using errcode = 'P0001';
  end if;
  if target.kind = 'breakout' and (
    select count(*) from public.live_participants p
    join public.live_sessions s on s.id = p.session_id
    join public.classes c on c.id = s.class_id
    where p.room_id = target.id and p.user_id <> auth.uid() and p.user_id <> c.teacher_id
  ) >= target.capacity then
    raise exception 'salle_pleine' using errcode = 'P0001';
  end if;
  update public.live_participants p set room_id = target.id where p.session_id = sid and p.user_id = auth.uid();
end;
$$;

/** Rappel général : tout le monde revient en salle principale, les salles se ferment. */
create function public.recall_all(session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := recall_all.session_id;
begin
  perform public.require_teacher(sid);
  update public.live_rooms set closed = true where live_rooms.session_id = sid and kind = 'breakout' and not closed;
  update public.live_participants set room_id = public.main_room(sid) where live_participants.session_id = sid and room_id is not null;
end;
$$;

/** Fermer une salle : ses occupants reviennent en salle principale. */
create function public.close_room(session_id uuid, room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := close_room.session_id;
begin
  perform public.require_teacher(sid);
  update public.live_rooms r set closed = true where r.id = close_room.room_id and r.session_id = sid and r.kind = 'breakout';
  update public.live_participants p set room_id = public.main_room(sid) where p.session_id = sid and p.room_id = close_room.room_id;
end;
$$;

/** Talqîn : donner la parole à un élève (null = la rendre à tous). */
create function public.set_floor(session_id uuid, user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := set_floor.session_id;
begin
  perform public.require_teacher(sid);
  update public.live_sessions set floor_user = set_floor.user_id where id = sid;
  update public.live_participants p set activity = (case when p.user_id = set_floor.user_id then 'reciting' else 'listening' end)::public.participant_activity
  where p.session_id = sid and set_floor.user_id is not null;
  update public.live_participants p set activity = 'idle'::public.participant_activity, hand_raised_at = case when p.user_id = set_floor.user_id then null else p.hand_raised_at end
  where p.session_id = sid and set_floor.user_id is null;
end;
$$;

/** État complet d'une séance, en un appel (rechargé à chaque changement diffusé). */
create function public.session_state(session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := session_state.session_id;
  result jsonb;
begin
  if not public.attends_session(sid) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'session', to_jsonb(s) || jsonb_build_object('class_name', c.name, 'teacher_id', c.teacher_id),
    'rooms', coalesce((select jsonb_agg(to_jsonb(r) order by r.position) from public.live_rooms r where r.session_id = sid and not r.closed), '[]'),
    'participants', coalesce((
      select jsonb_agg(to_jsonb(p) || jsonb_build_object('display_name', pr.display_name, 'is_teacher', p.user_id = c.teacher_id) order by pr.display_name)
      from public.live_participants p join public.profiles pr on pr.id = p.user_id
      where p.session_id = sid), '[]'),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', pr.id, 'display_name', pr.display_name) order by pr.display_name)
      from public.class_members m join public.profiles pr on pr.id = m.student_id where m.class_id = c.id), '[]'),
    'announcements', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from (select * from public.live_announcements la where la.session_id = sid order by la.created_at desc limit 5) a), '[]')
  ) into result
  from public.live_sessions s join public.classes c on c.id = s.class_id
  where s.id = sid;
  return result;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.teaches_session(uuid), public.attends_session(uuid), public.require_teacher(uuid), public.main_room(uuid),
  public.start_session(uuid), public.end_session(uuid), public.join_session(uuid), public.set_step(uuid, integer),
  public.open_rooms(uuid, integer, jsonb, text, integer), public.move_participant(uuid, uuid, uuid),
  public.choose_room(uuid, uuid), public.recall_all(uuid), public.close_room(uuid, uuid),
  public.set_floor(uuid, uuid), public.session_state(uuid)
to authenticated;
-- (rappel : check_invite reste appelable sans compte, cf. migration de la phase 2)
grant execute on function public.check_invite(text) to anon;

-- Diffusion des changements (Supabase Realtime) : chaque client recharge l'état de sa séance.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_sessions, public.live_rooms, public.live_participants, public.live_announcements;
  end if;
end;
$$;
