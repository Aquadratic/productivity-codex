create table if not exists public.planner_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.planner_states enable row level security;

drop policy if exists "Users can read own planner state" on public.planner_states;
create policy "Users can read own planner state"
on public.planner_states
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own planner state" on public.planner_states;
create policy "Users can insert own planner state"
on public.planner_states
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own planner state" on public.planner_states;
create policy "Users can update own planner state"
on public.planner_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
