drop policy if exists "salon authenticated users track presence" on realtime.messages;
create policy "salon authenticated users track presence"
on realtime.messages for insert to authenticated
with check (
  realtime.topic() = 'salon-online-users'
  and realtime.messages.extension = 'presence'
  and auth.uid() is not null
);

drop policy if exists "salon super admins read presence" on realtime.messages;
create policy "salon super admins read presence"
on realtime.messages for select to authenticated
using (
  realtime.topic() = 'salon-online-users'
  and realtime.messages.extension = 'presence'
  and public.is_super_admin()
);
