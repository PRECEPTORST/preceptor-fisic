-- ════════════════════════════════════════════════════════════════════
-- Sprint 6/7 — RLS audit + performance indexes
-- Idempotente. Aplicar APÓS db:migrate via scripts/apply-post-migration.ts
-- ════════════════════════════════════════════════════════════════════

-- ── RLS faltante: conversations, messages, appointments ──

alter table public.conversations enable row level security;
drop policy if exists "own_conversations" on public.conversations;
create policy "own_conversations" on public.conversations
  for all using (public.is_owner_professional(professional_id))
  with check (public.is_owner_professional(professional_id));

alter table public.messages enable row level security;
drop policy if exists "own_via_conversation" on public.messages;
create policy "own_via_conversation" on public.messages
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.is_owner_professional(c.professional_id)
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.is_owner_professional(c.professional_id)
    )
  );

alter table public.appointments enable row level security;
drop policy if exists "own_appointments" on public.appointments;
create policy "own_appointments" on public.appointments
  for all using (public.is_owner_professional(professional_id))
  with check (public.is_owner_professional(professional_id));

-- ── Performance indexes pra queries críticas ──

-- Rate limit em /gerar: COUNT em training_plans por professional + janela tempo
create index if not exists training_plans_pro_created_idx
  on public.training_plans(professional_id, created_at desc);

-- Dashboard heatmap: COUNT em training_sessions por dia
create index if not exists training_sessions_logged_date_idx
  on public.training_sessions(logged_by, session_date);

-- Streak por aluno: EXISTS em training_sessions(student_id, session_date)
create index if not exists training_sessions_student_date_idx
  on public.training_sessions(student_id, session_date desc);

-- Sessão recente logs: query getRecentSessionLogs por planId + sessionLabel
create index if not exists training_sessions_plan_label_idx
  on public.training_sessions(plan_id, session_label, session_date desc);

-- Avaliações ordenadas por data
create index if not exists physical_assessments_student_date_idx
  on public.physical_assessments(student_id, assessed_at desc);

-- Mensagens não lidas (sidebar count)
create index if not exists messages_unread_idx
  on public.messages(conversation_id, from_role, read_at)
  where read_at is null;

-- Conversations ordenadas por última mensagem
create index if not exists conversations_pro_last_msg_idx
  on public.conversations(professional_id, last_message_at desc);

-- Appointments próximos N dias (dashboard upcoming)
create index if not exists appointments_pro_starts_status_idx
  on public.appointments(professional_id, starts_at, status)
  where status <> 'cancelled';

-- Knowledge_chunks vector search (já tem ivfflat — só garantir)
-- (índice já criado em 0000_*; aqui só garantimos a extensão)
create extension if not exists vector;

-- ── Audit log ──
-- (Tabela audit_log já existe com RLS append-only no 0001-rls.sql.
--  Adicionando index pra queries de auditoria por user/action/data.)
create index if not exists audit_log_pro_created_idx
  on public.audit_log(professional_id, created_at desc);

create index if not exists audit_log_action_idx
  on public.audit_log(action, created_at desc);
