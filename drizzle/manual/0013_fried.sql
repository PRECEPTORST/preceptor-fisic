-- Critérios de Fried no perfil de saúde, e a tag de pré-frágil na taxonomia.
--
-- Até aqui, fragilidade saía do TEXTO do diagnóstico: quem escrevesse "idoso
-- frágil" era frágil, quem escrevesse só "idoso" também era (a derivação casava
-- a palavra idoso), e `idoso_robusto` existia na taxonomia sem nunca ser
-- preenchido por ninguém. Ou seja, todo aluno de terceira idade entrava como
-- frágil e recebia as restrições de quem não é.
--
-- Agora o doutor marca os cinco critérios de Fried no cadastro e a
-- classificação sai da contagem: 0 robusto, 1 a 2 pré-frágil, 3 a 5 frágil.
-- Fried et al. (2001) e Álvarez-Bustos et al. (2026), os dois na base de
-- conhecimento.
--
-- A coluna é nullable de propósito: nulo significa "ninguém avaliou", que é
-- diferente de "avaliei e deu zero". Aluno sem avaliação não recebe tag de
-- fragilidade nenhuma. Ver `FriedCriteria` em schema.ts e `classificaFried` em
-- $lib/clinical/condition-tags.ts.
--
-- Idempotente.
ALTER TABLE health_profiles
	ADD COLUMN IF NOT EXISTS fried jsonb;

INSERT INTO condition_taxonomy (tag, label, category)
VALUES ('idoso_pre_fragil', 'Idoso pré-frágil', 'envelhecimento')
ON CONFLICT (tag) DO NOTHING;
