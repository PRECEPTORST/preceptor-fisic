-- Institucional: clínicas com mais de um profissional.
--
-- Camada POR CIMA do modelo atual. Aluno, plano e avaliação continuam
-- pertencendo a um professional, e as queries que filtram por professional_id
-- seguem valendo sem alteração. A organização agrupa profissionais para efeito
-- de ACESSO (membro herda a assinatura do dono), COTA (pool de gerações) e
-- COBRANÇA (uma assinatura só, na conta do dono).
--
-- Ver src/lib/server/organization.ts. Idempotente.

CREATE TABLE IF NOT EXISTS organizations (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	name text NOT NULL,
	owner_professional_id uuid NOT NULL,
	seats integer NOT NULL DEFAULT 5,
	generations_limit integer NOT NULL DEFAULT 100,
	per_member_generation_cap integer,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_invites (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
	email text NOT NULL,
	-- HASH do token, nunca o token: vazamento do banco não entrega convite
	-- utilizável.
	token_hash text NOT NULL,
	invited_by_professional_id uuid NOT NULL,
	expires_at timestamptz NOT NULL,
	accepted_at timestamptz,
	accepted_by_professional_id uuid,
	revoked_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invites_token_idx
	ON organization_invites (token_hash);
CREATE INDEX IF NOT EXISTS organization_invites_org_idx
	ON organization_invites (organization_id);

ALTER TABLE professionals
	ADD COLUMN IF NOT EXISTS organization_id uuid;

-- FKs adicionadas depois das duas tabelas existirem (dependência circular:
-- organizations aponta pro dono, professionals aponta pra organização).
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'professionals_organization_fk'
	) THEN
		ALTER TABLE professionals
			ADD CONSTRAINT professionals_organization_fk
			FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'organizations_owner_fk'
	) THEN
		ALTER TABLE organizations
			ADD CONSTRAINT organizations_owner_fk
			FOREIGN KEY (owner_professional_id) REFERENCES professionals (id) ON DELETE RESTRICT;
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS professionals_organization_idx
	ON professionals (organization_id) WHERE organization_id IS NOT NULL;
