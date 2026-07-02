-- Migration manual 0001: reconciliação de drift (schema.ts × migrations geradas).
--
-- Produção recebeu alterações out-of-band; as migrations journaled (0000-0002)
-- param no estado antigo. Este arquivo leva um banco recém-bootstrapado
-- (`npm run db:migrate`) ao estado que schema.ts declara. Idempotente — no
-- banco vivo tudo aqui é no-op. Aplicado por `npm run db:post-migrate`
-- (drizzle/manual/*.sql roda ANTES de drizzle/post-migration/*.sql).

-- 1) professionals.is_admin — acesso ao CRM interno.
ALTER TABLE "professionals"
	ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false;

-- 2) training_sessions.duration_minutes — duração real da sessão (session-RPE).
ALTER TABLE "training_sessions"
	ADD COLUMN IF NOT EXISTS "duration_minutes" integer;

-- 3) lead_stage: a 0002 criou o funil antigo ('novo','contatado',...); o
--    schema.ts usa a jornada visitante→pagante. Recria o tipo só se ainda
--    for o antigo (detecta pela ausência do valor 'visitante').
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public' AND t.typname = 'lead_stage'
	) AND NOT EXISTS (
		SELECT 1 FROM pg_enum e
		JOIN pg_type t ON t.oid = e.enumtypid
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public' AND t.typname = 'lead_stage'
			AND e.enumlabel = 'visitante'
	) THEN
		ALTER TYPE "lead_stage" RENAME TO "lead_stage_old";
		CREATE TYPE "lead_stage" AS ENUM
			('visitante', 'cadastrou', 'ativou_aluno', 'trial', 'pagante', 'cancelado', 'perdido');
		ALTER TABLE "leads" ALTER COLUMN "stage" DROP DEFAULT;
		ALTER TABLE "leads" ALTER COLUMN "stage" TYPE "lead_stage" USING (
			CASE "stage"::text
				WHEN 'novo' THEN 'visitante'
				WHEN 'contatado' THEN 'cadastrou'
				WHEN 'convertido' THEN 'pagante'
				WHEN 'perdido' THEN 'perdido'
				ELSE 'visitante'
			END
		)::"lead_stage";
		ALTER TABLE "leads" ALTER COLUMN "stage" SET DEFAULT 'visitante';
		DROP TYPE "lead_stage_old";
	END IF;
END $$;

-- 4) leads.professional_id: dono virou opcional (leads auto-criados no signup
--    não têm dono) e a FK trocou cascade→set null. Detecta a FK pelo par
--    coluna+tabela (não pelo nome — pode divergir no banco vivo).
ALTER TABLE "leads" ALTER COLUMN "professional_id" DROP NOT NULL;

DO $$
DECLARE
	v_conname text;
	v_deltype "char";
BEGIN
	SELECT c.conname, c.confdeltype INTO v_conname, v_deltype
	FROM pg_constraint c
	JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
	WHERE c.conrelid = 'public.leads'::regclass
		AND c.contype = 'f'
		AND array_length(c.conkey, 1) = 1
		AND a.attname = 'professional_id';

	IF v_conname IS NOT NULL AND v_deltype <> 'n' THEN
		EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', v_conname);
		v_conname := NULL;
	END IF;
	IF v_conname IS NULL THEN
		ALTER TABLE "leads"
			ADD CONSTRAINT "leads_professional_id_professionals_id_fk"
			FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id")
			ON DELETE SET NULL ON UPDATE NO ACTION;
	END IF;
END $$;

-- 5) leads.subject_professional_id: aponta pro usuário já cadastrado que o
--    lead representa. NULL pra leads externos (landing/manual).
ALTER TABLE "leads"
	ADD COLUMN IF NOT EXISTS "subject_professional_id" uuid
		REFERENCES "public"."professionals"("id") ON DELETE CASCADE;

-- 6) leads.converted_student_id saiu do schema (funil agora é de profissionais,
--    não de alunos). DROP COLUMN derruba a FK junto.
ALTER TABLE "leads" DROP COLUMN IF EXISTS "converted_student_id";

-- 7) Índices do leads: os compostos por professional_id da 0002 deram lugar
--    aos simples do schema.ts.
DROP INDEX IF EXISTS "leads_pro_stage_idx";
DROP INDEX IF EXISTS "leads_pro_followup_idx";
DROP INDEX IF EXISTS "leads_pro_created_idx";
CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "leads" ("stage");
CREATE INDEX IF NOT EXISTS "leads_followup_idx" ON "leads" ("next_follow_up_at");
CREATE INDEX IF NOT EXISTS "leads_created_idx" ON "leads" ("created_at");
CREATE INDEX IF NOT EXISTS "leads_subject_pro_idx" ON "leads" ("subject_professional_id");

-- 8) feedback dos beta testers (enum + tabela + índice) — só existe em schema.ts.
DO $$ BEGIN
	CREATE TYPE "feedback_category" AS ENUM ('bug', 'sugestao', 'duvida', 'elogio', 'outro');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid REFERENCES "public"."professionals"("id") ON DELETE SET NULL,
	"author_name" text,
	"author_email" text,
	"category" "feedback_category" DEFAULT 'outro' NOT NULL,
	"message" text NOT NULL,
	"page" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "feedback_created_idx" ON "feedback" ("created_at");
