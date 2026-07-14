create extension if not exists pgcrypto;

create type public.club_role as enum ('owner','staff');
create type public.round_status as enum ('active','pending','approved','rejected');
create type public.content_kind as enum ('news','announcement','rules');

create table public.clubs (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  status text not null default 'active' check (status in ('trial','active','suspended')),
  timezone text not null default 'Europe/Amsterdam', default_language text not null default 'nl',
  supported_languages text[] not null default array['nl','en'], logo_url text, primary_color text not null default '#103f2c',
  accent_color text not null default '#c6f04d', contact_email text, phone text, address text,
  opening_hours jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.club_memberships (
  club_id uuid references public.clubs on delete cascade, user_id uuid references auth.users on delete cascade,
  role public.club_role not null, created_at timestamptz not null default now(), primary key(club_id,user_id)
);
create table public.player_accounts (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade,
  display_name text not null, initials text not null, preferred_language text not null default 'nl', active boolean not null default true,
  created_at timestamptz not null default now(), unique(club_id,id)
);
create table public.player_codes (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade,
  player_id uuid not null references public.player_accounts on delete cascade, code text not null unique, pin_hash text not null,
  must_change_pin boolean not null default true, failed_attempts integer not null default 0, locked_until timestamptz,
  last_used_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade,
  name jsonb not null, description jsonb not null default '{}', hole_count integer not null check(hole_count in (9,18)),
  active boolean not null default true, created_at timestamptz not null default now(), unique(club_id,id)
);
create table public.tee_sets (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade,
  course_id uuid not null references public.courses on delete cascade, name jsonb not null, color text not null,
  is_default boolean not null default false, unique(course_id,id)
);
create table public.holes (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade,
  course_id uuid not null references public.courses on delete cascade, tee_set_id uuid not null references public.tee_sets on delete cascade,
  number integer not null check(number between 1 and 18), par integer not null check(par between 2 and 6),
  distance_m integer not null check(distance_m > 0), name jsonb not null default '{}', description jsonb not null default '{}', image_url text,
  unique(tee_set_id,number)
);
create table public.rounds (
  id uuid primary key default gen_random_uuid(), client_id uuid not null, club_id uuid not null references public.clubs on delete cascade,
  course_id uuid not null references public.courses, tee_set_id uuid not null references public.tee_sets,
  scorer_player_id uuid not null references public.player_accounts, hole_count integer not null check(hole_count in (9,18)),
  status public.round_status not null default 'active', completed_at timestamptz, reviewed_at timestamptz,
  reviewed_by uuid references auth.users, rejection_reason text, created_at timestamptz not null default now(),
  unique(club_id,client_id)
);
create table public.round_participants (
  id uuid primary key default gen_random_uuid(), round_id uuid not null references public.rounds on delete cascade,
  club_id uuid not null references public.clubs on delete cascade, player_id uuid references public.player_accounts,
  display_name text not null, is_guest boolean not null default false, position integer not null check(position between 1 and 4),
  total_strokes integer, total_par integer, unique(round_id,position), check((is_guest and player_id is null) or (not is_guest and player_id is not null))
);
create table public.hole_scores (
  id uuid primary key default gen_random_uuid(), round_participant_id uuid not null references public.round_participants on delete cascade,
  club_id uuid not null references public.clubs on delete cascade, hole_number integer not null check(hole_number between 1 and 18),
  strokes integer not null check(strokes between 1 and 12), par_snapshot integer not null, distance_snapshot integer not null,
  unique(round_participant_id,hole_number)
);
create table public.round_reviews (
  id uuid primary key default gen_random_uuid(), round_id uuid not null references public.rounds on delete cascade,
  club_id uuid not null references public.clubs on delete cascade, reviewer_id uuid not null references auth.users,
  decision public.round_status not null check(decision in ('approved','rejected')), reason text, created_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade,
  course_id uuid references public.courses, title jsonb not null, description jsonb not null default '{}', image_url text,
  starts_at timestamptz not null, ends_at timestamptz, registration_opens_at timestamptz,
  registration_closes_at timestamptz, capacity integer check(capacity > 0), leaderboard_enabled boolean not null default false,
  published boolean not null default false, created_at timestamptz not null default now()
);
create table public.event_registrations (
  event_id uuid references public.events on delete cascade, club_id uuid not null references public.clubs on delete cascade,
  player_id uuid references public.player_accounts on delete cascade, status text not null default 'registered' check(status in ('registered','cancelled')),
  created_at timestamptz not null default now(), primary key(event_id,player_id)
);
create table public.content_items (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade,
  kind public.content_kind not null, title jsonb not null, body jsonb not null, image_url text,
  published_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now()
);
create table public.audit_log (
  id bigint generated always as identity primary key, club_id uuid references public.clubs on delete cascade,
  actor_id uuid, action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.is_club_staff(target_club uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.club_memberships where club_id=target_club and user_id=auth.uid())
$$;

alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.player_accounts enable row level security;
alter table public.courses enable row level security;
alter table public.tee_sets enable row level security;
alter table public.holes enable row level security;
alter table public.rounds enable row level security;
alter table public.round_participants enable row level security;
alter table public.hole_scores enable row level security;
alter table public.round_reviews enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.content_items enable row level security;

create policy "public active clubs" on public.clubs for select using(status='active');
create policy "staff own membership" on public.club_memberships for select using(user_id=auth.uid() or public.is_club_staff(club_id));
create policy "staff manage players" on public.player_accounts for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "public active courses" on public.courses for select using(active and exists(select 1 from public.clubs c where c.id=club_id and c.status='active'));
create policy "staff manage courses" on public.courses for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "public tees" on public.tee_sets for select using(exists(select 1 from public.courses c where c.id=course_id and c.active));
create policy "staff manage tees" on public.tee_sets for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "public holes" on public.holes for select using(exists(select 1 from public.courses c where c.id=course_id and c.active));
create policy "staff manage holes" on public.holes for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "staff manage rounds" on public.rounds for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "staff round participants" on public.round_participants for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "staff hole scores" on public.hole_scores for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "staff reviews" on public.round_reviews for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "public published events" on public.events for select using(published);
create policy "staff manage events" on public.events for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "staff event registrations" on public.event_registrations for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));
create policy "public published content" on public.content_items for select using(published_at <= now() and (expires_at is null or expires_at > now()));
create policy "staff manage content" on public.content_items for all using(public.is_club_staff(club_id)) with check(public.is_club_staff(club_id));

create view public.leaderboard_entries with (security_invoker=true) as
select r.club_id,r.course_id,r.hole_count,r.completed_at,rp.player_id,rp.display_name,rp.total_strokes,
       rp.total_strokes-rp.total_par as score_to_par
from public.rounds r join public.round_participants rp on rp.round_id=r.id
where r.status='approved' and not rp.is_guest;

create index rounds_club_status_date on public.rounds(club_id,status,completed_at desc);
create index events_club_start on public.events(club_id,starts_at);
create index content_club_publish on public.content_items(club_id,published_at desc);
