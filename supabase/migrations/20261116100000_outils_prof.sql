-- Phase 4 : outils du prof dans une salle.
-- Vue partagée et prise de main, crayon et marquage de mots (persistés), corrections de
-- récitation (prof et binôme), validation des versets, test « continue le verset »,
-- agrégat des erreurs pour le retour commun, récapitulatif de fin de séance.
--
-- Répartition du temps réel :
--   - traits en cours, laser et vue de chacun : canaux data LiveKit (dans la salle) ;
--   - qui a la main, crayon de l'élève, test en cours : ici (live_rooms, diffusé par Realtime) ;
--   - traits terminés, marquages, corrections, validations : ici, sous RLS.

create type public.author_role as enum ('teacher', 'peer');
create type public.annotation_kind as enum ('stroke', 'mark');
create type public.error_type as enum ('pronunciation', 'tajweed', 'haraka', 'forgotten', 'added', 'memory');
create type public.correction_status as enum ('confirmed', 'pending');
create type public.verse_result as enum ('validated', 'review');

-- ---------------------------------------------------------------------------
-- État des outils par salle et par séance
-- ---------------------------------------------------------------------------

alter table public.live_rooms
  add column student_pen boolean not null default false,
  add column leader_id uuid references public.profiles (id) on delete set null,
  add column quiz jsonb;
comment on column public.live_rooms.student_pen is 'Le prof autorise le crayon aux élèves de la salle (désactivé par défaut).';
comment on column public.live_rooms.leader_id is 'Prof qui a « pris la main » : les élèves de la salle suivent sa vue.';
comment on column public.live_rooms.quiz is 'Test « continue le verset » en cours : {student_id, verse, revealed, started_at}.';

alter table public.live_sessions add column show_summary boolean not null default false;
comment on column public.live_sessions.show_summary is 'Le prof affiche chez tous les erreurs fréquentes (retour commun).';
grant update (show_summary) on public.live_sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.annotations (
  -- identifiant choisi par le navigateur : le même en direct (LiveKit) et en base
  id uuid primary key,
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  room_id uuid not null references public.live_rooms (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_role public.author_role not null,
  kind public.annotation_kind not null,
  -- trait : ancre (mot, page ou verset) et points quantifiés [x0, y0, x1, y1, …] dans le repère de l'ancre
  anchor jsonb,
  points integer[],
  -- marquage : mots « sourate:verset:position »
  words text[],
  style jsonb not null,
  -- élèves présents dans la salle au moment du trait : eux seuls le revoient ensuite
  student_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint annotations_shape check (
    (kind = 'stroke' and anchor is not null and points is not null and words is null)
    or (kind = 'mark' and words is not null and anchor is null and points is null)
  ),
  constraint annotations_sizes check (
    coalesce(cardinality(points), 0) <= 20000
    and coalesce(cardinality(words), 1) between 1 and 300
    and pg_column_size(style) < 400
    and (anchor is null or pg_column_size(anchor) < 300)
  )
);
create index annotations_room_idx on public.annotations (room_id, created_at);
create index annotations_session_idx on public.annotations (session_id);
create index annotations_students_idx on public.annotations using gin (student_ids);

create table public.corrections (
  id uuid primary key,
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  room_id uuid references public.live_rooms (id) on delete set null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_role public.author_role not null,
  -- les marquages du binôme attendent la confirmation du prof
  status public.correction_status not null,
  word text not null check (word ~ '^[0-9]{1,3}:[0-9]{1,3}:[0-9]{1,3}$'),
  verse text generated always as (split_part(word, ':', 1) || ':' || split_part(word, ':', 2)) stored,
  error_type public.error_type not null,
  tajweed_rule text check (tajweed_rule is null or tajweed_rule ~ '^[a-z_]{1,30}$'),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index corrections_session_idx on public.corrections (session_id, student_id);
create index corrections_room_idx on public.corrections (room_id);
comment on table public.corrections is 'Erreurs de récitation relevées en séance (phase 4) ; les devoirs audio (phase 5) y ajouteront leurs corrections horodatées.';

create table public.verse_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  verse text not null check (verse ~ '^[0-9]{1,3}:[0-9]{1,3}$'),
  result public.verse_result not null,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index verse_results_session_idx on public.verse_results (session_id, student_id);

-- ---------------------------------------------------------------------------
-- Aides
-- ---------------------------------------------------------------------------

/** Salle ouverte d'une séance en cours, et sa séance. */
create function public.open_room_session(target uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.session_id from public.live_rooms r join public.live_sessions s on s.id = r.session_id
  where r.id = target and not r.closed and s.status = 'live';
$$;

create function public.in_room(target uuid, who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.live_participants p where p.room_id = target and p.user_id = who);
$$;

/** Peut dessiner ou marquer dans la salle : le prof, ou un élève présent si le prof l'autorise. */
create function public.can_annotate(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.live_rooms r
    where r.id = target and public.open_room_session(target) is not null
      and (public.teaches_session(r.session_id) or (r.student_pen and public.in_room(target, auth.uid())))
  );
$$;

/**
 * Peut relever une erreur de `student` : le prof (élève de la séance), ou son binôme
 * (même salle secondaire, pas soi-même).
 */
create function public.can_correct(target uuid, student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.live_rooms r
    join public.live_sessions s on s.id = r.session_id
    join public.class_members m on m.class_id = s.class_id and m.student_id = student
    where r.id = target and public.open_room_session(target) is not null
      and (
        public.teaches_session(r.session_id)
        or (r.kind = 'breakout' and student <> auth.uid()
            and public.in_room(target, auth.uid()) and public.in_room(target, student))
      )
  );
$$;

-- Les colonnes sensibles sont remplies par la base, jamais par le navigateur.
create function public.fill_annotation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select r.session_id into new.session_id from public.live_rooms r where r.id = new.room_id;
  new.author_id := auth.uid();
  new.author_role := (case when public.teaches_session(new.session_id) then 'teacher' else 'peer' end)::public.author_role;
  new.student_ids := coalesce((
    select array_agg(p.user_id) from public.live_participants p
    join public.live_sessions s on s.id = p.session_id
    join public.classes c on c.id = s.class_id
    where p.room_id = new.room_id and p.user_id <> c.teacher_id), '{}');
  new.created_at := now();
  return new;
end;
$$;
create trigger annotations_fill before insert on public.annotations
  for each row execute function public.fill_annotation();

create function public.fill_correction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select r.session_id into new.session_id from public.live_rooms r where r.id = new.room_id;
    new.author_id := auth.uid();
    new.created_at := now();
    if public.teaches_session(new.session_id) then
      new.author_role := 'teacher';
      new.status := 'confirmed';
    else
      new.author_role := 'peer';
      new.status := 'pending';
    end if;
  end if;
  if new.error_type <> 'tajweed' then
    new.tajweed_rule := null;
  end if;
  new.comment := nullif(btrim(new.comment), '');
  return new;
end;
$$;
create trigger corrections_fill before insert or update on public.corrections
  for each row execute function public.fill_correction();

/** Une validation met à jour le statut du verset pour l'élève (suivi de la phase 2). */
create function public.apply_verse_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s smallint := split_part(new.verse, ':', 1)::smallint;
  a smallint := split_part(new.verse, ':', 2)::smallint;
  st public.verse_status := (case when new.result = 'validated' then 'acquired' else 'review' end)::public.verse_status;
begin
  insert into public.verse_progress (student_id, surah, ayah, status, last_reviewed_at, updated_by, updated_at)
  values (new.student_id, s, a, st, now(), new.author_id, now())
  on conflict (student_id, surah, ayah) do update
    set status = excluded.status, last_reviewed_at = excluded.last_reviewed_at,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  return new;
end;
$$;
create function public.fill_verse_result()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;
create trigger verse_results_fill before insert on public.verse_results
  for each row execute function public.fill_verse_result();
create trigger verse_results_apply after insert on public.verse_results
  for each row execute function public.apply_verse_result();

/** Quand le prof change de salle, il « rend la main » dans celle qu'il quitte. */
create function public.release_leader()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.room_id is distinct from old.room_id then
    update public.live_rooms r set leader_id = null
    where r.session_id = new.session_id and r.leader_id = new.user_id and r.id is distinct from new.room_id;
  end if;
  return new;
end;
$$;
create trigger live_participants_release_leader after update of room_id on public.live_participants
  for each row execute function public.release_leader();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.annotations enable row level security;
alter table public.corrections enable row level security;
alter table public.verse_results enable row level security;
revoke all on public.annotations, public.corrections, public.verse_results from anon, authenticated;

-- annotations : l'élève revoit celles faites devant lui ; le prof voit toute sa séance
create policy "annotations lisibles" on public.annotations
  for select to authenticated
  using (public.teaches_session(session_id) or auth.uid() = any (student_ids) or author_id = auth.uid());
create policy "annotations créées dans sa salle" on public.annotations
  for insert to authenticated with check (author_id = auth.uid() and public.can_annotate(room_id));
create policy "annotations effacées par leur auteur ou le prof" on public.annotations
  for delete to authenticated using (author_id = auth.uid() or public.teaches_session(session_id));
grant select, delete on public.annotations to authenticated;
grant insert (id, room_id, kind, anchor, points, words, style) on public.annotations to authenticated;

-- corrections : l'élève voit les siennes ; le binôme voit les marquages qu'il a faits
create policy "corrections lisibles" on public.corrections
  for select to authenticated
  using (public.teaches_session(session_id) or student_id = auth.uid() or author_id = auth.uid());
create policy "corrections relevées par le prof ou le binôme" on public.corrections
  for insert to authenticated with check (author_id = auth.uid() and public.can_correct(room_id, student_id));
create policy "le prof confirme ou modifie" on public.corrections
  for update to authenticated using (public.teaches_session(session_id)) with check (public.teaches_session(session_id));
create policy "le prof annule ; le binôme retire son marquage en attente" on public.corrections
  for delete to authenticated
  using (public.teaches_session(session_id) or (author_id = auth.uid() and status = 'pending'));
grant select, delete on public.corrections to authenticated;
grant insert (id, room_id, student_id, word, error_type, tajweed_rule, comment) on public.corrections to authenticated;
grant update (status, error_type, tajweed_rule, comment) on public.corrections to authenticated;

-- validations : le prof valide ; l'élève voit les siennes
create policy "validations lisibles" on public.verse_results
  for select to authenticated using (public.teaches_session(session_id) or student_id = auth.uid());
create policy "le prof valide un verset" on public.verse_results
  for insert to authenticated
  with check (
    public.teaches_session(session_id)
    and exists (select 1 from public.live_sessions s join public.class_members m on m.class_id = s.class_id
                where s.id = verse_results.session_id and m.student_id = verse_results.student_id)
  );
grant select on public.verse_results to authenticated;
grant insert (session_id, student_id, verse, result) on public.verse_results to authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions
-- ---------------------------------------------------------------------------

/** Tableau de la salle : traits, marquages et corrections, pour qui y est (ou le prof). */
create function public.room_board(room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  rid uuid := room_board.room_id;
  sid uuid;
begin
  select r.session_id into sid from public.live_rooms r where r.id = rid;
  if sid is null or not (public.teaches_session(sid) or public.in_room(rid, auth.uid())) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'annotations', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'author_id', a.author_id, 'author_role', a.author_role, 'kind', a.kind,
        'anchor', a.anchor, 'points', a.points, 'words', a.words, 'style', a.style) order by a.created_at)
      from public.annotations a where a.room_id = rid), '[]'),
    'corrections', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at) from public.corrections c where c.room_id = rid), '[]')
  );
end;
$$;

/** « Tout effacer » : traits et marquages de la salle (les corrections restent). */
create function public.clear_board(room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid;
begin
  select r.session_id into sid from public.live_rooms r where r.id = clear_board.room_id;
  perform public.require_teacher(sid);
  delete from public.annotations a where a.room_id = clear_board.room_id;
end;
$$;

create function public.set_room_pen(room_id uuid, allowed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid;
begin
  select r.session_id into sid from public.live_rooms r where r.id = set_room_pen.room_id;
  perform public.require_teacher(sid);
  update public.live_rooms r set student_pen = set_room_pen.allowed where r.id = set_room_pen.room_id;
end;
$$;

/** Prendre la main (les élèves suivent la vue du prof) ou la rendre. */
create function public.set_room_leader(room_id uuid, take boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid;
begin
  select r.session_id into sid from public.live_rooms r where r.id = set_room_leader.room_id;
  perform public.require_teacher(sid);
  update public.live_rooms r set leader_id = (case when set_room_leader.take then auth.uid() end)
  where r.id = set_room_leader.room_id;
end;
$$;

/**
 * Test « continue le verset » : un verset tiré au hasard parmi ceux que l'élève a déjà
 * travaillés (suivi de progression), sinon dans le passage du jour.
 */
create function public.start_quiz(room_id uuid, student_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid;
  pass jsonb;
  chosen text;
begin
  select r.session_id into sid from public.live_rooms r where r.id = start_quiz.room_id;
  perform public.require_teacher(sid);
  if not exists (select 1 from public.live_participants p where p.session_id = sid and p.user_id = start_quiz.student_id) then
    raise exception 'eleve_absent' using errcode = 'P0001';
  end if;
  select vp.surah || ':' || vp.ayah into chosen from public.verse_progress vp
  where vp.student_id = start_quiz.student_id and vp.status in ('learning', 'acquired', 'review')
  order by random() limit 1;
  if chosen is null then
    select s.passage into pass from public.live_sessions s where s.id = sid;
    if pass is not null and (pass ->> 'surah') is not null then
      chosen := (pass ->> 'surah') || ':' ||
        ((pass ->> 'from')::int + floor(random() * ((pass ->> 'to')::int - (pass ->> 'from')::int + 1))::int);
    end if;
  end if;
  if chosen is null then
    raise exception 'aucun_verset' using errcode = 'P0001';
  end if;
  update public.live_rooms r
  set quiz = jsonb_build_object('student_id', start_quiz.student_id, 'verse', chosen, 'revealed', false, 'started_at', now())
  where r.id = start_quiz.room_id;
  return chosen;
end;
$$;

create function public.reveal_quiz(room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid;
begin
  select r.session_id into sid from public.live_rooms r where r.id = reveal_quiz.room_id;
  perform public.require_teacher(sid);
  update public.live_rooms r set quiz = r.quiz || '{"revealed": true}' where r.id = reveal_quiz.room_id and r.quiz is not null;
end;
$$;

create function public.end_quiz(room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid;
begin
  select r.session_id into sid from public.live_rooms r where r.id = end_quiz.room_id;
  perform public.require_teacher(sid);
  update public.live_rooms r set quiz = null where r.id = end_quiz.room_id;
end;
$$;

/**
 * Erreurs les plus fréquentes de la séance (retour commun) : anonymes, sans nom d'élève.
 * Les marquages du binôme ne comptent qu'une fois confirmés par le prof.
 */
create function public.session_error_summary(session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := session_error_summary.session_id;
begin
  if not public.attends_session(sid) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.corrections c where c.session_id = sid and c.status = 'confirmed'),
    'by_type', coalesce((
      select jsonb_agg(jsonb_build_object('error_type', t.error_type, 'tajweed_rule', t.tajweed_rule, 'count', t.n) order by t.n desc)
      from (select c.error_type, c.tajweed_rule, count(*) as n from public.corrections c
            where c.session_id = sid and c.status = 'confirmed' group by 1, 2 order by 3 desc limit 8) t), '[]'),
    'by_word', coalesce((
      select jsonb_agg(jsonb_build_object('word', w.word, 'count', w.n, 'students', w.students) order by w.n desc, w.word)
      from (select c.word, count(*) as n, count(distinct c.student_id) as students from public.corrections c
            where c.session_id = sid and c.status = 'confirmed' group by 1 order by 2 desc, 1 limit 8) w), '[]')
  );
end;
$$;

/**
 * Récapitulatif de fin de séance : pour un élève, le sien ; pour le prof, celui de
 * chaque élève venu. Passages travaillés, corrections reçues, versets validés.
 */
create function public.session_recap(session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid uuid := session_recap.session_id;
  teacher boolean;
begin
  if not public.attends_session(sid) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  teacher := public.teaches_session(sid);
  return jsonb_build_object(
    'session', (select jsonb_build_object('id', s.id, 'title', s.title, 'status', s.status, 'started_at', s.started_at,
                  'ended_at', s.ended_at, 'passage', s.passage, 'tajweed_focus', s.tajweed_focus, 'class_name', c.name,
                  'class_id', c.id, 'teacher_name', tp.display_name)
                from public.live_sessions s join public.classes c on c.id = s.class_id
                left join public.profiles tp on tp.id = c.teacher_id where s.id = sid),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', pr.id,
        'display_name', pr.display_name,
        'corrections', coalesce((
          select jsonb_agg(jsonb_build_object('id', c.id, 'word', c.word, 'verse', c.verse, 'error_type', c.error_type,
                   'tajweed_rule', c.tajweed_rule, 'comment', c.comment, 'author_role', c.author_role, 'status', c.status)
                 order by split_part(c.word, ':', 1)::int, split_part(c.word, ':', 2)::int, split_part(c.word, ':', 3)::int)
          from public.corrections c where c.session_id = sid and c.student_id = pr.id
            and (c.status = 'confirmed' or teacher)), '[]'),
        'results', coalesce((
          select jsonb_agg(jsonb_build_object('verse', v.verse, 'result', v.result) order by v.created_at)
          from (select distinct on (vr.verse) vr.verse, vr.result, vr.created_at from public.verse_results vr
                where vr.session_id = sid and vr.student_id = pr.id order by vr.verse, vr.created_at desc) v), '[]'),
        'verses', coalesce((
          select jsonb_agg(x.verse order by split_part(x.verse, ':', 1)::int, split_part(x.verse, ':', 2)::int)
          from (select c.verse from public.corrections c where c.session_id = sid and c.student_id = pr.id
                union select vr.verse from public.verse_results vr where vr.session_id = sid and vr.student_id = pr.id) x), '[]'),
        'annotations', (select count(*) from public.annotations a where a.session_id = sid and pr.id = any (a.student_ids))
      ) order by pr.display_name)
      from public.live_participants p
      join public.live_sessions s on s.id = p.session_id
      join public.classes c on c.id = s.class_id
      join public.profiles pr on pr.id = p.user_id
      where p.session_id = sid and p.user_id <> c.teacher_id and (teacher or p.user_id = auth.uid())), '[]')
  );
end;
$$;

/** Séances terminées auxquelles l'élève a participé (liste « Mes séances »). */
create function public.my_sessions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'started_at', s.started_at, 'ended_at', s.ended_at,
           'class_name', c.name, 'corrections', (select count(*) from public.corrections k
             where k.session_id = s.id and k.student_id = auth.uid() and k.status = 'confirmed'))
         order by s.started_at desc nulls last), '[]')
  from public.live_participants p
  join public.live_sessions s on s.id = p.session_id
  join public.classes c on c.id = s.class_id
  where p.user_id = auth.uid() and s.status = 'ended' and c.teacher_id <> auth.uid();
$$;

revoke execute on function
  public.open_room_session(uuid), public.in_room(uuid, uuid), public.can_annotate(uuid), public.can_correct(uuid, uuid),
  public.fill_annotation(), public.fill_correction(), public.apply_verse_result(), public.fill_verse_result(),
  public.release_leader(), public.room_board(uuid), public.clear_board(uuid), public.set_room_pen(uuid, boolean),
  public.set_room_leader(uuid, boolean), public.start_quiz(uuid, uuid), public.reveal_quiz(uuid), public.end_quiz(uuid),
  public.session_error_summary(uuid), public.session_recap(uuid), public.my_sessions()
from public, anon;
grant execute on function
  public.open_room_session(uuid), public.in_room(uuid, uuid), public.can_annotate(uuid), public.can_correct(uuid, uuid),
  public.room_board(uuid), public.clear_board(uuid), public.set_room_pen(uuid, boolean),
  public.set_room_leader(uuid, boolean), public.start_quiz(uuid, uuid), public.reveal_quiz(uuid), public.end_quiz(uuid),
  public.session_error_summary(uuid), public.session_recap(uuid), public.my_sessions()
to authenticated;
