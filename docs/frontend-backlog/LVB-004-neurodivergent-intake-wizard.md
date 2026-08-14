# LVB-004 — Tela de cadastro da população neurodivergente

- Status: READY
- Prioridade: crítica
- Origem: ficha versão 1.0 de 13/08/2026 e módulos backend 7 a 11
- Dependências: API dos módulos 7 a 11 publicada

## Direção de experiência

Não reproduzir as quatro páginas como uma única tela extensa. Implementar um
assistente de sete etapas, com salvamento local temporário, indicação de progresso,
linguagem simples e revisão antes do envio. Não persistir rascunhos sensíveis no
`localStorage`; manter apenas em memória enquanto a sessão estiver aberta.

## Etapas

1. **Pessoa e território** — localizar pessoa existente ou cadastrá-la, preencher
   contato e endereço e identificar quem responde.
2. **Perfil** — situação atual, condições e existência de relatório/laudo. Não
   solicitar upload de laudo.
3. **Educação e trabalho** — escolarização, instituição, apoio escolar e trabalho.
4. **Rede e necessidades** — atendimentos atuais, espera, até cinco prioridades,
   barreira principal e recursos de acessibilidade.
5. **Responsáveis** — localizar/cadastrar cada responsável como pessoa separada e
   criar vínculo. Exigir responsável legal para menor de 18 anos.
6. **Privacidade** — apresentar versão vigente do aviso, consentimento destacado,
   pessoa que consente, assentimento e canais opcionais. Imagem e voz ficam fora.
7. **Revisão** — resumo acessível, confirmação e envio único para
   `POST /api/v1/neurodivergent-intakes/submit`.

## Regras de interface

- não prometer diagnóstico, benefício, vaga ou prioridade;
- documentos, laudos e endereço completo permanecem opcionais nesta etapa;
- permitir voltar entre etapas sem perder os dados em memória;
- impedir mais de cinco necessidades prioritárias;
- exibir explicitamente quais campos são sensíveis;
- consentimento não pode vir previamente marcado;
- comunicar que imagem e voz exigem termo separado;
- após sucesso, exibir protocolo retornado pelo banco e limpar o estado local;
- em erro, preservar os dados em memória e não criar cadastro parcial.

## Contratos complementares

- demandas: `/api/v1/care-requests`;
- indicadores: `/api/v1/indicators/neurodivergent-population`;
- direitos do titular: `/api/v1/privacy/requests`;
- revisões: `/api/v1/privacy/retention-reviews`.

## Segurança

Ocultar módulos segundo permissões, mas considerar backend e RLS como controles
efetivos. Não registrar payloads sensíveis em analytics, console, monitoramento de
sessão ou ferramentas de replay.

## Critérios de aceite

- todos os campos do PDF possuem destino explícito;
- responsável não é armazenado como texto solto;
- envio final é atômico e retorna protocolo;
- revogação de consentimento é visível no histórico;
- navegação por teclado e leitores de tela é funcional;
- mensagens mantêm o caráter voluntário, humano e não diagnóstico do Instituto.
