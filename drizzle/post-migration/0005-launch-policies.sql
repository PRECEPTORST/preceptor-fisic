-- ════════════════════════════════════════════════════════════════════
-- Launch — policies faltantes (exercise_library, leads, feedback) +
-- índice composto do audit_log com nome único.
-- Idempotente. Aplicar via scripts/apply-post-migration.ts.
-- ════════════════════════════════════════════════════════════════════

-- ── RLS: 3 tabelas com RLS habilitado mas 0 policies ──
-- Mesmo padrão is_owner_professional do restante (0001-rls.sql / 0003-rls-perf.sql).
-- O servidor (postgres.js como owner) não passa por RLS; isto fecha a Data API.

-- exercise_library: biblioteca custom por profissional.
alter table public.exercise_library enable row level security;
drop policy if exists "own_via_professional" on public.exercise_library;
create policy "own_via_professional" on public.exercise_library
  for all using (public.is_owner_professional(professional_id))
  with check (public.is_owner_professional(professional_id));

-- leads (CRM/PII): dono via professional_id. Leads sem dono (professional_id
-- null, auto-criados no signup) ficam invisíveis via Data API — o app só os
-- acessa pelo servidor.
alter table public.leads enable row level security;
drop policy if exists "own_leads" on public.leads;
create policy "own_leads" on public.leads
  for all using (public.is_owner_professional(professional_id))
  with check (public.is_owner_professional(professional_id));

-- feedback: autor via professional_id. Guarded com to_regclass porque a
-- tabela nasce em drizzle/manual/0001-drift-reconcile.sql (o script aplica
-- manual/ antes, mas isso protege bancos bootstrapados só com db:migrate).
do $$ begin
  if to_regclass('public.feedback') is not null then
    execute 'alter table public.feedback enable row level security';
    execute 'drop policy if exists "own_feedback" on public.feedback';
    execute $p$
      create policy "own_feedback" on public.feedback
        for all using (public.is_owner_professional(professional_id))
        with check (public.is_owner_professional(professional_id));
    $p$;
  end if;
end $$;

-- ── Audit log: índice composto (action, created_at desc) ──
-- O 0003-rls-perf.sql tentava criá-lo reutilizando o nome audit_log_action_idx,
-- que a migration 0000 já criou em (action) — com IF NOT EXISTS o comando era
-- no-op silencioso e o índice composto nunca existiu. Nome único resolve.
create index if not exists audit_log_action_created_idx
  on public.audit_log(action, created_at desc);
