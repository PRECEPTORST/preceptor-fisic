-- Auditoria 2026-10-22 (achados 1 e 3). Idempotente.
--
-- 1) professionals: a policy `own_row` era `for all`. Com a anon key pública e o
--    próprio JWT, um profissional podia dar PATCH em is_admin,
--    subscription_status e organization_id. A 0008 já revoga a escrita do
--    PostgREST em todas as tabelas; aqui a policy vira só SELECT e o REVOKE é
--    repetido explicitamente para professionals (defesa em profundidade, caso
--    algum GRANT futuro reabra a escrita).
-- 2) organizations e organization_invites: RLS ativa sem policy (deny para
--    anon/authenticated) e sem nenhum privilégio para esses roles. O app acessa
--    só pelo servidor (Drizzle, role dono das tabelas), que não passa pela RLS.

drop policy if exists "own_row" on public.professionals;
create policy "own_row" on public.professionals
  for select using (auth_user_id = auth.uid());

revoke insert, update, delete, truncate, references, trigger
  on public.professionals from anon, authenticated;

alter table public.organizations enable row level security;
alter table public.organization_invites enable row level security;

revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_invites from anon, authenticated;
