create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (char_length(goal) between 1 and 4000),
  success_criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(success_criteria) = 'array'),
  plan jsonb not null check (jsonb_typeof(plan) = 'array'),
  status text not null default 'planned' check (status in ('planned', 'queued', 'running', 'waiting_for_approval', 'verifying', 'blocked', 'completed', 'failed', 'cancelled')),
  max_tool_calls integer not null default 10 check (max_tool_calls between 1 and 50),
  max_retries integer not null default 2 check (max_retries between 0 and 5),
  cancel_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  user_id uuid not null,
  task_key text not null check (char_length(task_key) between 1 and 80),
  title text not null check (char_length(title) between 1 and 200),
  description text not null check (char_length(description) between 1 and 2000),
  tool_name text not null check (tool_name in ('website.generate', 'seo.audit', 'seo.growth_plan', 'wordpress.create_draft')),
  requires_approval boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'ready', 'running', 'waiting_for_approval', 'verifying', 'completed', 'blocked', 'failed', 'cancelled')),
  position integer not null check (position between 0 and 19),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, task_key),
  unique (run_id, position),
  unique (run_id, task_key, user_id),
  foreign key (run_id, user_id) references public.agent_runs(id, user_id) on delete cascade
);

create table if not exists public.agent_task_dependencies (
  run_id uuid not null,
  user_id uuid not null,
  task_key text not null,
  depends_on_task_key text not null,
  created_at timestamptz not null default now(),
  primary key (run_id, task_key, depends_on_task_key),
  check (task_key <> depends_on_task_key),
  foreign key (run_id, task_key, user_id) references public.agent_tasks(run_id, task_key, user_id) on delete cascade,
  foreign key (run_id, depends_on_task_key, user_id) references public.agent_tasks(run_id, task_key, user_id) on delete cascade
);

create index if not exists agent_runs_user_created_idx on public.agent_runs(user_id, created_at desc);
create index if not exists agent_tasks_run_position_idx on public.agent_tasks(run_id, position);
create index if not exists agent_task_dependencies_run_idx on public.agent_task_dependencies(run_id);

alter table public.agent_runs enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_task_dependencies enable row level security;

grant select, insert on public.agent_runs, public.agent_tasks, public.agent_task_dependencies to authenticated;

create policy "Users can read their own agent runs" on public.agent_runs for select using (auth.uid() = user_id);
create policy "Users can create their own planned agent runs" on public.agent_runs for insert with check (auth.uid() = user_id and status = 'planned' and cancel_requested = false);
create policy "Users can read their own agent tasks" on public.agent_tasks for select using (auth.uid() = user_id);
create policy "Users can create their own pending agent tasks" on public.agent_tasks for insert with check (auth.uid() = user_id and status = 'pending' and requires_approval = (tool_name = 'wordpress.create_draft'));
create policy "Users can read their own agent task dependencies" on public.agent_task_dependencies for select using (auth.uid() = user_id);
create policy "Users can create their own agent task dependencies" on public.agent_task_dependencies for insert with check (auth.uid() = user_id);

create or replace function public.create_agent_plan(
  p_goal text,
  p_success_criteria jsonb,
  p_plan jsonb,
  p_tasks jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.agent_runs (user_id, goal, success_criteria, plan, status)
  values (auth.uid(), p_goal, p_success_criteria, p_plan, 'planned')
  returning id into v_run_id;

  insert into public.agent_tasks (run_id, user_id, task_key, title, description, tool_name, requires_approval, status, position)
  select v_run_id, auth.uid(), task.task_key, task.title, task.description, task.tool_name, task.requires_approval, 'pending', task.position
  from jsonb_to_recordset(p_tasks) as task(
    task_key text,
    title text,
    description text,
    tool_name text,
    requires_approval boolean,
    position integer
  );

  insert into public.agent_task_dependencies (run_id, user_id, task_key, depends_on_task_key)
  select v_run_id, auth.uid(), task.task_key, dependency.task_key
  from jsonb_to_recordset(p_tasks) as task(task_key text, depends_on jsonb)
  cross join lateral jsonb_array_elements_text(coalesce(task.depends_on, '[]'::jsonb)) as dependency(task_key);

  return v_run_id;
end;
$$;

grant execute on function public.create_agent_plan(text, jsonb, jsonb, jsonb) to authenticated;
