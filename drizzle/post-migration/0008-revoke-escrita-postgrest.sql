-- S1 (auditoria 2026-10): o app nunca usa o PostgREST. Todo acesso passa pelo
-- Drizzle no servidor, com o role postgres. Com a anon key pública e o próprio
-- JWT, a policy `own_row` deixava o profissional fazer PATCH em is_admin e
-- subscription_status. A escrita fica fechada para os roles do PostgREST.
-- O SELECT continua, filtrado pela RLS. Idempotente.

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
