-- ═══════════════════════════════════════════════════════════════════════════
-- AI-PM Copilot — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable pgvector extension for semantic search (change detection)
create extension if not exists vector;

-- ── PROJECTS ─────────────────────────────────────────────────────────────────
create table public.projects (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  code        text not null unique,           -- e.g. "WMP", "INV"
  description text,
  status      text default 'active' check (status in ('active', 'archived')),
  owner_id    uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── MEETINGS ─────────────────────────────────────────────────────────────────
create table public.meetings (
  id               uuid default gen_random_uuid() primary key,
  project_id       uuid references public.projects(id) on delete cascade not null,
  title            text not null,
  meeting_date     date,
  transcript_text  text,                      -- raw extracted text
  transcript_url   text,                      -- Supabase Storage URL
  file_name        text,
  status           text default 'processing' check (status in ('processing','reviewed','archived')),
  created_by       uuid references auth.users(id),
  created_at       timestamptz default now()
);

-- ── MINUTES OF MEETING ───────────────────────────────────────────────────────
create table public.moms (
  id          uuid default gen_random_uuid() primary key,
  meeting_id  uuid references public.meetings(id) on delete cascade not null,
  version     int default 1,
  content     jsonb not null,                 -- structured MOM JSON
  status      text default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at  timestamptz default now()
);

-- ── DOCUMENTS (BRD / PRD / FRD) ──────────────────────────────────────────────
create table public.documents (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid references public.projects(id) on delete cascade not null,
  type        text not null check (type in ('BRD','PRD','FRD','US_SUITE','TC_SUITE')),
  title       text not null,
  version     text default '1.0.0',
  content     jsonb default '{}',             -- full document content
  status      text default 'draft' check (status in ('draft','approved','deprecated')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── REQUIREMENTS ─────────────────────────────────────────────────────────────
create table public.requirements (
  id          uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  project_id  uuid references public.projects(id) on delete cascade not null,
  code        text not null,                  -- BR-001, BR-002 …
  title       text not null,
  description text not null,
  req_type    text default 'functional' check (req_type in ('functional','non-functional','constraint','compliance')),
  priority    text default 'medium' check (priority in ('critical','high','medium','low')),
  status      text default 'active' check (status in ('active','changed','deprecated')),
  embedding   vector(768),                    -- for semantic change detection
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── USER STORIES ─────────────────────────────────────────────────────────────
create table public.user_stories (
  id             uuid default gen_random_uuid() primary key,
  requirement_id uuid references public.requirements(id) on delete set null,
  project_id     uuid references public.projects(id) on delete cascade not null,
  code           text not null,               -- US-001, US-002 …
  role           text not null,               -- "Product Manager"
  action         text not null,               -- "upload a transcript"
  benefit        text not null,               -- "so that MOM is auto-generated"
  priority       text default 'medium' check (priority in ('critical','high','medium','low')),
  status         text default 'draft' check (status in ('draft','approved','in_progress','done')),
  created_at     timestamptz default now()
);

-- ── ACCEPTANCE CRITERIA ───────────────────────────────────────────────────────
create table public.acceptance_criteria (
  id         uuid default gen_random_uuid() primary key,
  story_id   uuid references public.user_stories(id) on delete cascade not null,
  given_step text not null,
  when_step  text not null,
  then_step  text not null,
  created_at timestamptz default now()
);

-- ── TEST CASES ────────────────────────────────────────────────────────────────
create table public.test_cases (
  id              uuid default gen_random_uuid() primary key,
  story_id        uuid references public.user_stories(id) on delete cascade not null,
  ac_id           uuid references public.acceptance_criteria(id) on delete set null,
  project_id      uuid references public.projects(id) on delete cascade not null,
  code            text not null,              -- TC-001, TC-002 …
  description     text not null,
  preconditions   text,
  steps           text,
  expected_result text not null,
  scenario_type   text default 'happy' check (scenario_type in ('happy','negative','edge')),
  status          text default 'draft' check (status in ('draft','approved','pass','fail')),
  created_at      timestamptz default now()
);

-- ── CHANGE DETECTIONS ─────────────────────────────────────────────────────────
create table public.change_detections (
  id               uuid default gen_random_uuid() primary key,
  meeting_id       uuid references public.meetings(id) on delete cascade not null,
  project_id       uuid references public.projects(id) on delete cascade not null,
  requirement_id   uuid references public.requirements(id) on delete set null,
  change_type      text not null check (change_type in ('ADDITION','MODIFICATION','DELETION','CONFLICT')),
  previous_text    text,
  proposed_text    text not null,
  source_excerpt   text,                      -- exact quote from transcript
  impact           jsonb default '{}',        -- {brd_sections:[], user_stories:[], test_cases:[]}
  confidence       int default 80,            -- AI confidence 0-100
  status           text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  reject_reason    text,
  created_at       timestamptz default now()
);

-- ── AUDIT LOG (immutable) ─────────────────────────────────────────────────────
create table public.audit_logs (
  id          uuid default gen_random_uuid() primary key,
  entity_type text not null,                  -- 'mom','document','change_detection', etc.
  entity_id   uuid not null,
  action      text not null,                  -- 'approved','rejected','modified','created'
  actor_id    uuid references auth.users(id),
  actor_email text,
  reason      text,
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

-- ── WORK ITEMS (Epics / Features / Stories / Tasks) ─────────────────────────
create table public.work_items (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid references public.projects(id) on delete cascade not null,
  parent_id   uuid references public.work_items(id) on delete set null,
  story_id    uuid references public.user_stories(id) on delete set null,
  item_type   text not null check (item_type in ('epic','feature','story','task')),
  code        text,                           -- WI-001
  title       text not null,
  description text,
  assignee    text,                           -- recommended owner name
  priority    text default 'medium' check (priority in ('critical','high','medium','low')),
  status      text default 'backlog' check (status in ('backlog','todo','in_progress','done')),
  created_at  timestamptz default now()
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
create table public.notifications (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  project_id  uuid references public.projects(id) on delete cascade,
  type        text not null,                  -- 'change_detected','approval_needed','doc_updated'
  title       text not null,
  message     text,
  link        text,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Users only see their own projects and data
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.projects         enable row level security;
alter table public.meetings         enable row level security;
alter table public.moms             enable row level security;
alter table public.documents        enable row level security;
alter table public.requirements     enable row level security;
alter table public.user_stories     enable row level security;
alter table public.acceptance_criteria enable row level security;
alter table public.test_cases       enable row level security;
alter table public.change_detections enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.work_items       enable row level security;
alter table public.notifications    enable row level security;

-- Projects: owner sees their own
create policy "Users manage own projects"
  on public.projects for all
  using (owner_id = auth.uid());

-- All child tables: accessible if user owns the parent project
create policy "Users access own project meetings"
  on public.meetings for all
  using (project_id in (select id from public.projects where owner_id = auth.uid()));

create policy "Users access own project moms"
  on public.moms for all
  using (meeting_id in (select m.id from public.meetings m
    join public.projects p on p.id = m.project_id where p.owner_id = auth.uid()));

create policy "Users access own project documents"
  on public.documents for all
  using (project_id in (select id from public.projects where owner_id = auth.uid()));

create policy "Users access own project requirements"
  on public.requirements for all
  using (project_id in (select id from public.projects where owner_id = auth.uid()));

create policy "Users access own project stories"
  on public.user_stories for all
  using (project_id in (select id from public.projects where owner_id = auth.uid()));

create policy "Users access own project ACs"
  on public.acceptance_criteria for all
  using (story_id in (select us.id from public.user_stories us
    join public.projects p on p.id = us.project_id where p.owner_id = auth.uid()));

create policy "Users access own project test cases"
  on public.test_cases for all
  using (project_id in (select id from public.projects where owner_id = auth.uid()));

create policy "Users access own project changes"
  on public.change_detections for all
  using (project_id in (select id from public.projects where owner_id = auth.uid()));

create policy "Users access own audit logs"
  on public.audit_logs for all
  using (actor_id = auth.uid());

create policy "Users access own work items"
  on public.work_items for all
  using (project_id in (select id from public.projects where owner_id = auth.uid()));

create policy "Users access own notifications"
  on public.notifications for all
  using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET for transcript uploads
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values ('transcripts', 'transcripts', false);

create policy "Users upload their own transcripts"
  on storage.objects for insert
  with check (bucket_id = 'transcripts' and auth.uid() is not null);

create policy "Users read their own transcripts"
  on storage.objects for select
  using (bucket_id = 'transcripts' and auth.uid() is not null);

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at on row change
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_projects_updated
  before update on public.projects
  for each row execute procedure public.handle_updated_at();

create trigger on_documents_updated
  before update on public.documents
  for each row execute procedure public.handle_updated_at();

create trigger on_requirements_updated
  before update on public.requirements
  for each row execute procedure public.handle_updated_at();
