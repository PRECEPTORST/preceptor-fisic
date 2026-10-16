# Auditoria da landing: outubro de 2026

Arquivo auditado: `src/routes/+page.svelte` (2056 linhas, cerca de 1.300 delas de CSS), que é a mesma página que está no ar em staging. A reconstrução fica em `web/src/pages/landing`.

## Números conferidos no banco de produção em 16/10/2026

| Alegação da página | No banco | Situação |
|---|---|---|
| 2.040 trechos de diretrizes | 2.040 `knowledge_chunks` (de 49 fontes) | ok |
| 1.324 exercícios com vídeo | 1.324 em `exercise_catalog`, todos com `video_url` | ok |
| 23 regras clínicas | 23 `clinical_rules` ativas | ok |
| Preços e franquias | `PAYMENT_LINKS` e `PLAN_LIMITS` | ok |

## Problemas encontrados

- **Alegações sem comprovação:**
  - "a primeira plataforma brasileira" é alegação de superioridade, com risco perante o CONAR e o CDC;
  - o selo "Mais popular" no Pro não tem dado que o sustente;
  - o "Exemplo real · hipertenso" cita uma fonte de Diabetes tipo 2.
- **Contradição:** a seção de preços diz "auditoria completa desde o Essencial", mas só o Pro inclui auditoria.
- **SEO:** o JSON-LD declara preço 0, cita o público "CRM" e lista os sistemas iOS e Android.
- **Marca:** a página usa degradê no H1 e nos botões, brilhos radiais, a estrela ★ cinco vezes, glifos decorativos e um pulse infinito. Também há hex escrito direto no código.
- **Peso:** o vídeo do hero pesa 4,55 MB (mp4) ou 2,29 MB (webm) e vem com quatro camadas de sobreposição.
- **Acessibilidade:**
  - o cinza `#4d4d4d` sobre o fundo dá cerca de 2,4:1;
  - não há `:focus-visible` definido;
  - os vídeos não têm `aria-hidden`.
- **Mensagem:**
  - o CTA principal tem dois rótulos ("Testar grátis" e "Começar 7 dias grátis");
  - "15–30s" aparece três vezes e ACSM cerca de 12 vezes;
  - há jargão ("magic-link") e trechos informais ("Cadastra teu");
  - falta FAQ;
  - o rodapé tem a duplicata LGPD/Privacidade e não mostra o e-mail de contato.

## O que fica (informação-chave)

- O H1, o público (CREF/CREFITO e populações especiais) e os três revisores.
- As três dores, os três passos de como funciona e o diferencial ACSM, este com fontes coerentes.
- Os quatro planos com os valores exatos, o anual com "2 meses grátis" e o teste de 7 dias sem cartão (2 treinos por IA e até 10 alunos).
- O WhatsApp de contato, as diretrizes citadas, os textos legais e "Servidores no Brasil".

## Nova estrutura

1. Navbar
2. Hero com uma prévia real do produto, no lugar do vídeo
3. Populações e revisores
4. Problema
5. Como funciona
6. Plataforma em bento, com os números verificados
7. Preços, com a comparação recolhível
8. FAQ (nova)
9. CTA final
10. Rodapé em colunas

Um único CTA principal: "Começar 7 dias grátis". A página fica sempre escura e é pré-renderizada para SEO.

## Para o Matheus confirmar

- Se os três revisores autorizam aparecer na página, e se há link para o Lattes de cada um.
- Se o texto sobre LGPD e "dados no Brasil" bate com a infraestrutura. O banco está em `sa-east-1`: confirmado.
- A origem: a página diz "Construído em São Paulo", mas o WhatsApp tem DDD 35.
