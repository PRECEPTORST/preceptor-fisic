-- 7 dias de teste para as contas que ficaram 'inactive'.
--
-- Complemento do 0009, que cobriu só as contas em 'trial'. Estas foram
-- restringidas quando o trial infinito foi encerrado, e a decisão de reabrir
-- é do dono do produto: todo mundo que criou conta antes do trial existir
-- passa a ter os mesmos 7 dias.
--
-- Sem CPF, igual ao 0009: cpf_hash fica NULL, então elas não ocupam a trava
-- de unicidade e continuam vendo o campo de CPF no checkout.
--
-- Idempotente: o filtro exige trial_started_at IS NULL, então rodar de novo
-- não estende o prazo de quem já recebeu.
UPDATE professionals
SET
	subscription_status = 'trial',
	subscription_plan = 'trial',
	trial_started_at = now(),
	subscription_expires_at = now() + interval '7 days',
	updated_at = now()
WHERE subscription_status = 'inactive'
	AND trial_started_at IS NULL;
