# LVB-005 — Agenda, Documentos e Financeiro

## Estado

Backend e banco preparados sem implementação visual. O Lovable deve consumir somente as rotas oficiais descritas aqui. Não criar tabelas, RPCs, buckets, estados ou contratos paralelos.

## Regras permanentes

- Usar o token Supabase do usuário no cabeçalho `Authorization: Bearer` da API.
- Nunca expor `service_role` no frontend.
- Respeitar as permissões retornadas por `GET /api/v1/me`.
- Não exibir links de arquivos permanentes. Solicitar URL temporária de download.
- Não armazenar conteúdo clínico, documental ou financeiro no `localStorage`.
- Tratar `401` limpando imediatamente o contexto e o cache institucional.
- Usar dados fictícios em testes e homologação.

## Agenda

### Rotas

- `GET /api/v1/appointments`
- `POST /api/v1/appointments`
- `PATCH /api/v1/appointments/:id`
- `GET /api/v1/appointment-availability`
- `POST /api/v1/appointment-availability`
- `PATCH /api/v1/appointment-availability/:id`

### Telas

1. Calendário mensal, semanal e diário.
2. Lista filtrável por período, situação, projeto, beneficiário e profissional.
3. Formulário de agendamento.
4. Disponibilidade semanal do profissional.
5. Ações de confirmação, conclusão, cancelamento e falta.

### Estados oficiais

`SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.

Conflitos de horário retornam HTTP `409` com `APPOINTMENT_TIME_CONFLICT`.

## Documentos

### Rotas

- `GET/POST /api/v1/document-templates`
- `PATCH /api/v1/document-templates/:id`
- `GET/POST /api/v1/documents`
- `GET/PATCH /api/v1/documents/:id`
- `POST /api/v1/documents/:id/versions`
- `POST /api/v1/documents/:id/upload-url`
- `GET /api/v1/documents/:id/download-url`
- `POST /api/v1/documents/:id/signatures`
- `PATCH /api/v1/documents/:id/signatures/:signatureId`

### Fluxo de arquivo

1. Criar o documento.
2. Solicitar URL de upload com a próxima versão.
3. Enviar o arquivo usando o token temporário retornado.
4. Registrar a versão com nome, MIME, tamanho e SHA-256.
5. Solicitar aprovação e assinatura quando aplicável.
6. Para baixar, pedir uma URL temporária com validade de cinco minutos.

### Classificações

`INTERNAL`, `CONFIDENTIAL`, `CLINICAL`, `FINANCIAL`.

Documentos `CLINICAL` exigem também as permissões de prontuário clínico.

### Estados

`DRAFT`, `READY_FOR_APPROVAL`, `APPROVED`, `SIGNED`, `ARCHIVED`, `VOID`.

## Financeiro

As tabelas antigas `donors`, `donations` e `payment_events` continuam bloqueadas e não devem ser acessadas.

### Rotas

- `GET /api/v1/finance/setup`
- `POST /api/v1/finance/accounts`
- `POST /api/v1/finance/categories`
- `POST /api/v1/finance/cost-centers`
- `POST /api/v1/finance/budget-lines`
- `GET/POST /api/v1/finance/transactions`
- `PATCH /api/v1/finance/transactions/:id`
- `POST /api/v1/finance/transactions/:id/approve`
- `POST /api/v1/finance/transactions/:id/reconcile`
- `GET /api/v1/finance/summary?from=AAAA-MM-DD&to=AAAA-MM-DD`

### Telas

1. Visão do período: receitas, despesas, pagos e pendentes.
2. Contas financeiras.
3. Plano de categorias.
4. Centros de custo vinculados a projeto/unidade.
5. Orçamento anual por fonte de recurso.
6. Lançamentos e rateios.
7. Aprovação e conciliação.
8. Exportação para prestação de contas, em etapa visual posterior.

### Estados

- Lançamento: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PAID`, `CANCELLED`.
- Conciliação: `UNRECONCILED`, `RECONCILED`.
- Fonte: `OWN_FUNDS`, `DONATION`, `PUBLIC_GRANT`, `PRIVATE_GRANT`, `PARTNERSHIP`, `OTHER`.

## Critérios de aceite do futuro frontend

- Nenhuma chamada direta a tabelas novas.
- Menus condicionados às permissões.
- Formulários enviam apenas campos aceitos pelos schemas estritos.
- Tratamento explícito de `400`, `401`, `403`, `404` e `409`.
- Navegação por teclado, rótulos acessíveis e idioma `pt-BR`.
- Sem dados reais em preview ou testes automatizados.
- Build, lint e typecheck aprovados antes da publicação.
