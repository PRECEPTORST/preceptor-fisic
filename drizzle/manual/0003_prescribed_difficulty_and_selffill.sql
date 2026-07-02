-- Migration manual: dificuldade-alvo dos exercícios + auto-preenchimento pelo aluno.
--
-- Escrita à mão porque `drizzle-kit generate` está caindo num prompt
-- interativo de rename (drift de snapshot pré-existente). Idempotente —
-- pode rodar mais de uma vez sem erro. Aplicado automaticamente por
-- `npm run db:post-migrate` (scripts/apply-post-migration.ts).

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
-- 4) Backfill: alunos pré-existentes são considerados completos — mas SÓ na
--    criação da coluna. Re-execuções não podem tocar nos NULLs legítimos
--    (alunos ainda aguardando auto-preenchimento).
DO $$
DECLARE
	coluna_nova boolean;
BEGIN
	SELECT NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'students'
			AND column_name = 'profile_completed_at'
	) INTO coluna_nova;

	ALTER TABLE "students"
		ADD COLUMN IF NOT EXISTS "profile_completed_at" timestamptz;

	IF coluna_nova THEN
		UPDATE "students"
		SET "profile_completed_at" = COALESCE("consent_accepted_at", "created_at")
		WHERE "profile_completed_at" IS NULL;
	END IF;
END $$;
