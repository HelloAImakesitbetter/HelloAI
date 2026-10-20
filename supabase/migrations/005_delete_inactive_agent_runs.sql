grant delete on public.agent_runs to authenticated;

create policy "Users can delete their own inactive agent runs"
  on public.agent_runs for delete
  using (
    auth.uid() = user_id
    and status in ('planned', 'completed', 'failed', 'cancelled')
  );
