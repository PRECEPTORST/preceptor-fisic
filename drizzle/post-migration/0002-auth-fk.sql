-- FK para auth.users (schema gerenciado pelo Supabase Auth).
-- Aplicar DEPOIS do 0000_* (tabelas criadas).
alter table public.professionals
	drop constraint if exists professionals_auth_user_id_fk;

alter table public.professionals
	add constraint professionals_auth_user_id_fk
	foreign key (auth_user_id) references auth.users(id) on delete cascade;

