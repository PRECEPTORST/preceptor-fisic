-- Guarda a assinatura do Asaas na conta.
--
-- Até aqui só o customer era gravado (asaas_customer_id). A assinatura em si
-- vivia apenas no Asaas, então não havia como cruzar e descobrir que uma conta
-- tinha DUAS assinaturas ativas — foi exatamente o que aconteceu com o primeiro
-- cliente pagante e ninguém percebeu até alguém ir olhar webhook a webhook.
--
-- Ver src/lib/server/asaas.ts (listActiveSubscriptions). Idempotente.
ALTER TABLE professionals
	ADD COLUMN IF NOT EXISTS asaas_subscription_id text;

CREATE INDEX IF NOT EXISTS professionals_asaas_subscription_idx
	ON professionals (asaas_subscription_id)
	WHERE asaas_subscription_id IS NOT NULL;
