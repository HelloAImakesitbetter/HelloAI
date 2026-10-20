create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  messages jsonb not null check (
    jsonb_typeof(messages) = 'array'
    and jsonb_array_length(messages) between 1 and 100
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_conversations_user_updated_idx
  on public.chat_conversations (user_id, updated_at desc);

alter table public.chat_conversations enable row level security;
grant select, insert, update, delete on public.chat_conversations to authenticated;

create policy "Users can read their own chat conversations"
  on public.chat_conversations for select
  using (auth.uid() = user_id);

create policy "Users can create their own chat conversations"
  on public.chat_conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own chat conversations"
  on public.chat_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own chat conversations"
  on public.chat_conversations for delete
  using (auth.uid() = user_id);
