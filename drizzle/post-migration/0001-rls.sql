-- Policies de Row Level Security (RLS) do FisioMentor.
-- Aplicar APÃ“S cada `db:migrate` (script de aplicaÃ§Ã£o virÃ¡ em M2).
-- Manter idempotente. Se renomear tabela, atualize esse arquivo.

-- Helper: verifica se o auth.uid() Ã© dono do professional_id informado.
create or replace function public.is_owner_professional(target_professional_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.professionals p
    where p.id = target_professional_id
      and p.auth_user_id = auth.uid()
  );
$$;

-- professionals: dono vÃª sÃ³ a prÃ³pria row.
alter table public.professionals enable row level security;
drop policy if exists "own_row" on public.professionals;
create policy "own_row" on public.professionals
  for all using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- students: filtrados por professional_id.
alter table public.students enable row level security;
drop policy if exists "own_students" on public.students;
create policy "own_students" on public.students
  for all using (public.is_owner_professional(professional_id))
  with check (public.is_owner_professional(professional_id));

-- health_profiles, training_preferences, physical_assessments, training_plans,
-- training_sessions, progress_records, student_drafts, training_plan_revisions:
-- filtrados por join com students.professional_id ou professional_id direto.

do $$
declare
  tbl text;
  via text;
begin
  for tbl, via in
    select unnest(array[
      'health_profiles', 'training_preferences', 'physical_assessments',
      'training_sessions', 'progress_records'
    ]), 'student'
    union all
    select unnest(array['training_plans', 'student_drafts']), 'direct'
    union all
    select unnest(array['training_plan_revisions']), 'plan'
  loop
    execute format('alter table public.%I enable row level security;', tbl);
    execute format('drop policy if exists "own_via_professional" on public.%I;', tbl);

    if via = 'direct' then
      execute format($p$
        create policy "own_via_professional" on public.%I
          for all using (public.is_owner_professional(professional_id))
          with check (public.is_owner_professional(professional_id));
      $p$, tbl);
    elsif via = 'student' then
      execute format($p$
        create policy "own_via_professional" on public.%I
          for all using (
            exists (
              select 1 from public.students s
              where s.id = %I.student_id
                and public.is_owner_professional(s.professional_id)
            )
          )
          with check (
            exists (
              select 1 from public.students s
              where s.id = %I.student_id
                and public.is_owner_professional(s.professional_id)
            )
          );
      $p$, tbl, tbl, tbl);
    elsif via = 'plan' then
      execute format($p$
        create policy "own_via_professional" on public.%I
          for all using (
            exists (
              select 1 from public.training_plans p
              where p.id = %I.plan_id
                and public.is_owner_professional(p.professional_id)
            )
          )
          with check (
            exists (
              select 1 from public.training_plans p
              where p.id = %I.plan_id
                and public.is_owner_professional(p.professional_id)
            )
          );
      $p$, tbl, tbl, tbl);
    end if;
  end loop;
end $$;

-- ai_runs: dono vÃª sÃ³ as prÃ³prias
alter table public.ai_runs enable row level security;
drop policy if exists "own_ai_runs" on public.ai_runs;
create policy "own_ai_runs" on public.ai_runs
  for all using (public.is_owner_professional(professional_id))
  with check (public.is_owner_professional(professional_id));

-- audit_log: append-only do prÃ³prio profissional, sem update/delete.
alter table public.audit_log enable row level security;
drop policy if exists "insert_own_audit" on public.audit_log;
drop policy if exists "read_own_audit" on public.audit_log;
create policy "insert_own_audit" on public.audit_log
  for insert with check (public.is_owner_professional(professional_id));
create policy "read_own_audit" on public.audit_log
  for select using (public.is_owner_professional(professional_id));

-- knowledge_sources / knowledge_chunks / clinical_rules / condition_taxonomy:
-- leitura pÃºblica autenticada (qualquer profissional logado vÃª).
alter table public.knowledge_sources enable row level security;
drop policy if exists "read_any_authed" on public.knowledge_sources;
create policy "read_any_authed" on public.knowledge_sources
  for select using (auth.role() = 'authenticated');

alter table public.knowledge_chunks enable row level security;
drop policy if exists "read_any_authed" on public.knowledge_chunks;
create policy "read_any_authed" on public.knowledge_chunks
  for select using (auth.role() = 'authenticated');

alter table public.clinical_rules enable row level security;
drop policy if exists "read_any_authed" on public.clinical_rules;
create policy "read_any_authed" on public.clinical_rules
  for select using (auth.role() = 'authenticated');

alter table public.condition_taxonomy enable row level security;
drop policy if exists "read_any_authed" on public.condition_taxonomy;
create policy "read_any_authed" on public.condition_taxonomy
  for select using (auth.role() = 'authenticated');

-- pgvector extension (idempotente)
create extension if not exists vector;

