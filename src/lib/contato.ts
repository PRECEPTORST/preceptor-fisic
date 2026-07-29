/**
 * Canal oficial de contato do PreceptorFISIC.
 *
 * Existe porque o endereço estava escrito à mão em seis lugares (política de
 * privacidade, termos, app do aluno e notificação interna), e um deles era o
 * contato do Encarregado de Dados — documento legal. Espalhado assim, trocar
 * significava caçar ocorrência por ocorrência e esquecer alguma.
 *
 * Trocar de endereço agora é mudar aqui, ou definir PUBLIC_CONTATO_EMAIL no
 * ambiente sem tocar em código.
 *
 * Atenção: este é o canal por onde chegam pedidos de exclusão e correção de
 * dados (LGPD, art. 18). Só aponte para caixa que alguém lê de fato — prazo de
 * resposta é de 15 dias (art. 19, §1º).
 */
import { env } from '$env/dynamic/public';

export const CONTATO_EMAIL = env.PUBLIC_CONTATO_EMAIL || 'preceptorfisic@ospreceptores.com';

/** Mesmo endereço, como o Encarregado (DPO) da política de privacidade. */
export const DPO_EMAIL = CONTATO_EMAIL;
