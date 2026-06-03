-- Migration manual 0004: estrutura do treino (full-body / split).
-- Idempotente.

DO $$ BEGIN
	CREATE TYPE "training_split" AS ENUM ('auto', 'full_body', 'upper_lower', 'push_pull_legs');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "training_preferences"
	ADD COLUMN IF NOT EXISTS "training_split" "training_split" NOT NULL DEFAULT 'auto';
