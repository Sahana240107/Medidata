-- Migration 0002: personal chat + lightweight project tracking for collaborations.
--
-- Your current `collaborations` table (requested_by, requested_to, message,
-- status) is enough for connect/request/invite flows, but has nowhere to
-- store a back-and-forth conversation once two people are connected, and no
-- field to track "Active Project" progress like the mockup shows.
--
-- This migration is purely additive -- nothing existing is touched or
-- renamed, so it's safe to run against your live database.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push` if
-- you've wired up the CLI) before using the Collaboration chat feature.

-- 1) Optional project metadata on an accepted collaboration.
alter table public.collaborations
  add column if not exists project_title text,
  add column if not exists progress_percent smallint not null default 0
    check (progress_percent between 0 and 100);

-- 2) Personal chat thread, one per collaboration.
create table if not exists public.collaboration_messages (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_collaboration_messages_collab
  on public.collaboration_messages (collaboration_id, created_at);

-- NOTE on `collaborations.status`: the code assumes the collaboration_status
-- enum includes at least 'requested', 'accepted', 'declined'. If your enum
-- uses different labels, update ACCEPTED_STATUS / DECLINED_STATUS in
-- backend/app/services/collaboration_service.py to match.