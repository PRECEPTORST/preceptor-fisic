-- Migration manual: dificuldade-alvo dos exercícios + auto-preenchimento pelo aluno.
--
-- Escrita à mão porque `drizzle-kit generate` está caindo num prompt
-- interativo de rename (drift de snapshot pré-existente). Idempotente —
-- pode rodar mais de uma vez sem erro. Aplique no Supabase (SQL editor)
-- ou via `psql $DATABASE_URL -f drizzle/manual/0003_*.sql`.

-- 1) Enum de dificuldade-alvo dos exercícios prescritos.
DO $$ BEGIN
	CREATE TYPE "prescribed_difficulty" AS ENUM ('pequena', 'media', 'alta');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

-- 2) Coluna em training_preferences. Default 'media' cobre as linhas existentes.
ALTER TABLE "training_preferences"
	ADD COLUMN IF NOT EXISTS "prescribed_difficulty" "prescribed_difficulty" NOT NULL DEFAULT 'media';

-- 3) Marca temporal de quando o perfil do aluno ficou completo.
--    NULL = criado via link de auto-preenchimento e ainda não preenchido.
ALTER TABLE "students"
	ADD COLUMN IF NOT EXISTS "profile_completed_at" timestamptz;

-- 4) Backfill: alunos já existentes são considerados completos (não devem
--    aparecer como "aguardando preenchimento").
UPDATE "students"
SET "profile_completed_at" = COALESCE("consent_accepted_at", "created_at")
WHERE "profile_completed_at" IS NULL;
