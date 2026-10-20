alter table public.agent_tasks
  add column tool_input jsonb not null default '{}'::jsonb check (jsonb_typeof(tool_input) = 'object'),
  add column result jsonb,
  add column evidence jsonb,
  add column error_message text,
  add column attempts integer not null default 0 check (attempts between 0 and 5),
  add column started_at timestamptz,
  add column completed_at timestamptz;

alter table public.agent_tasks drop constraint if exists agent_tasks_tool_name_check;
alter table public.agent_tasks add constraint agent_tasks_tool_name_check check (tool_name = 'website.generate');

create table public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  user_id uuid not null,
  task_key text not null,
  attempt integer not null check (attempt between 1 and 5),
  tool_name text not null check (tool_name = 'website.generate'),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  output_summary jsonb,
  evidence jsonb,
  status text not null check (status in ('running', 'completed', 'failed')),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (run_id, task_key, attempt),
  foreign key (run_id, task_key, user_id) references public.agent_tasks(run_id, task_key, user_id) on delete cascade
);

create index agent_tool_calls_run_created_idx on public.agent_tool_calls(run_id, started_at);
alter table public.agent_tool_calls enable row level security;
grant select on public.agent_tool_calls to authenticated;
create policy "Users can read their own agent tool calls" on public.agent_tool_calls for select using (auth.uid() = user_id);

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
  if jsonb_typeof(p_tasks) <> 'array' or pg_catalog.jsonb_array_length(p_tasks) <> 1 then
    raise exception 'Exactly one website-generation task is supported' using errcode = '22023';
  end if;

  insert into public.agent_runs (user_id, goal, success_criteria, plan, status)
  values (auth.uid(), p_goal, p_success_criteria, p_plan, 'planned')
  returning id into v_run_id;

  insert into public.agent_tasks (run_id, user_id, task_key, title, description, tool_name, tool_input, requires_approval, status, position)
  select v_run_id, auth.uid(), task.task_key, task.title, task.description, task.tool_name, task.tool_input, false, 'pending', task.position
  from jsonb_to_recordset(p_tasks) as task(
    task_key text,
    title text,
    description text,
    tool_name text,
    tool_input jsonb,
    depends_on jsonb,
    requires_approval boolean,
    position integer
  );

  if exists (select 1 from public.agent_tasks where run_id = v_run_id and tool_name <> 'website.generate') then
    raise exception 'Unsupported tool in plan' using errcode = '22023';
  end if;

  return v_run_id;
end;
$$;

create or replace function public.queue_agent_run(p_run_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_status text;
  v_cancel_requested boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select user_id, status, cancel_requested into v_owner, v_status, v_cancel_requested
  from public.agent_runs
  where id = p_run_id
  for update;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Run not found' using errcode = '42501';
  end if;
  if v_cancel_requested then
    raise exception 'Cancellation has already been requested' using errcode = '55000';
  end if;

  if v_status = 'planned' then
    update public.agent_runs
    set status = 'queued', updated_at = pg_catalog.now()
    where id = p_run_id and user_id = auth.uid();

    update public.agent_tasks as task
    set status = 'ready', updated_at = pg_catalog.now()
    where task.run_id = p_run_id
      and task.user_id = auth.uid()
      and task.status = 'pending'
      and not exists (
        select 1
        from public.agent_task_dependencies as dependency
        where dependency.run_id = task.run_id
          and dependency.task_key = task.task_key
      );
    return 'queued';
  end if;

  if v_status = 'queued' then
    return 'queued';
  end if;

  raise exception 'Only planned runs can be started' using errcode = '55000';
end;
$$;

revoke all on function public.queue_agent_run(uuid) from public, anon;
grant execute on function public.queue_agent_run(uuid) to authenticated;

create or replace function public.request_agent_run_cancellation(p_run_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select user_id, status into v_owner, v_status
  from public.agent_runs
  where id = p_run_id
  for update;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Run not found' using errcode = '42501';
  end if;

  if v_status in ('completed', 'failed', 'blocked', 'cancelled') then
    return v_status;
  end if;
  if v_status = 'planned' then
    return 'planned';
  end if;

  update public.agent_runs
  set cancel_requested = true, updated_at = pg_catalog.now()
  where id = p_run_id and user_id = auth.uid();
  return 'cancellation_requested';
end;
$$;

revoke all on function public.request_agent_run_cancellation(uuid) from public, anon;
grant execute on function public.request_agent_run_cancellation(uuid) to authenticated;

revoke all on function public.create_agent_plan(text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_agent_plan(text, jsonb, jsonb, jsonb) to authenticated;