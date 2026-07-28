-- CPF no cadastro (cifrado) + chave de unicidade do trial.
--
-- cpf_encrypted: AES-256-GCM, reversível, pra mandar ao Asaas no checkout sem
--                precisar pedir de novo.
-- cpf_hash:      HMAC-SHA256 com UNIQUE. É o que impede a mesma pessoa abrir
--                conta nova pra ganhar outro trial. Separado da cifra porque o
--                GCM usa IV aleatório e a mesma entrada nunca gera o mesmo
--                texto cifrado.
--
-- Ver src/lib/server/cpf.ts. Idempotente.
ALTER TABLE professionals
	ADD COLUMN IF NOT EXISTS cpf_encrypted text,
	ADD COLUMN IF NOT EXISTS cpf_hash text;

-- UNIQUE parcial: as contas que já existem ficam com cpf_hash NULL e não
-- disputam a trava entre si.
CREATE UNIQUE INDEX IF NOT EXISTS professionals_cpf_hash_uidx
	ON professionals (cpf_hash)
	WHERE cpf_hash IS NOT NULL;

-- trial_started_at: início do período gratuito. Sem isso a contagem de
-- gerações usaria currentCycleStart, que retrocede UM MÊS a partir do
-- vencimento — pra um trial de 7 dias isso cai três semanas antes da conta
-- existir.
ALTER TABLE professionals
	ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
