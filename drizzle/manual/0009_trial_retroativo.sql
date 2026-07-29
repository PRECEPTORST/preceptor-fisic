-- 7 dias de teste para quem criou conta ANTES do trial existir.
--
-- Alvo: status 'trial' sem trial_started_at. São contas do período em que
-- nada gravava subscription_expires_at, então ficaram sem acesso nenhum
-- quando o gate passou a exigir data.
--
-- NÃO inclui status 'inactive': essas foram restringidas por decisão
-- explícita quando o trial infinito foi encerrado, e reabrir seria desfazer
-- aquela decisão por conta própria.
--
-- Sem CPF de propósito: essas pessoas não passaram pelo onboarding novo. Como
-- cpf_hash fica NULL, elas não ocupam a trava de unicidade, e o campo de
-- CPF continua aparecendo pra elas no checkout (needsCpf olha cpf_encrypted).
--
-- Idempotente: rodar de novo não estende o prazo de quem já recebeu, porque
-- o filtro exige trial_started_at IS NULL.
UPDATE professionals
SET
	subscription_status = 'trial',
	subscription_plan = 'trial',
	trial_started_at = now(),
	subscription_expires_at = now() + interval '7 days',
	updated_at = now()
WHERE subscription_status = 'trial'
	AND trial_started_at IS NULL;
