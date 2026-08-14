# ID Gestão — API

Este diretório documenta convenções e contratos relevantes da API do ID Gestão.

---

## Base

A API utiliza versionamento de rota:

/api/v1/

---

## Autenticação

Endpoints protegidos devem utilizar o mecanismo de autenticação definido pela aplicação.

O backend deve validar a identidade antes de executar operações protegidas.

---

## Contexto institucional

Operações institucionais devem utilizar o contexto derivado do usuário autenticado.

Quando `organization_id` puder ser obtido do contexto autenticado, ele não deve ser confiado a partir de valores arbitrários enviados pelo frontend.

---

## Autorização

Permissões devem ser verificadas no backend para operações protegidas.

Exemplos já utilizados no domínio de Pessoas:

- `person.read`
- `person.create`
- `person.update`

Novas permissões devem seguir nomenclatura consistente e possuir finalidade definida.

---

## Validação

Payloads e parâmetros devem ser validados antes das operações de persistência.

Erros de validação devem retornar respostas estruturadas que permitam ao frontend apresentar feedback adequado sem expor detalhes internos desnecessários.

---

## Paginação

Endpoints de listagem que possam crescer significativamente devem utilizar paginação.

Estrutura atualmente adotada:

- `page`
- `limit`
- `total`
- `totalPages`
- `hasPreviousPage`
- `hasNextPage`

---

## Soft delete

Entidades que utilizem exclusão lógica devem respeitar os campos e filtros definidos pelo domínio.

Registros logicamente excluídos não devem reaparecer em consultas normais sem requisito explícito.

---

## Pessoas

Contratos atualmente implementados incluem:

GET `/api/v1/persons`

GET `/api/v1/persons/:id`

POST `/api/v1/persons`

PATCH `/api/v1/persons/:id`

POST `/api/v1/persons/:id/addresses`

PATCH `/api/v1/persons/:id/addresses/:addressId`

POST `/api/v1/persons/:id/relationships`

PATCH `/api/v1/persons/:id/relationships/:relationshipId`

### Membros e perfis institucionais

GET `/api/v1/members`

GET `/api/v1/members/:memberId`

POST `/api/v1/members/:memberId/roles`

PATCH `/api/v1/members/:memberId/roles/:memberRoleId/end`

A leitura exige `user.read`. A atribuição e o encerramento de roles exigem
`user.manage_roles`. Operações sobre a role `ADMINISTRATOR` exigem também
`role.manage`, e o último administrador ativo da organização não pode ter sua
atribuição encerrada.

O identificador da organização não faz parte dos payloads dessas operações. O
backend deriva e valida a organização a partir do contexto autenticado.

Este documento não substitui os schemas e a implementação existentes no código.

---

## Organização e unidades

GET `/api/v1/organization`

PATCH `/api/v1/organization`

GET `/api/v1/units`

GET `/api/v1/units/:id`

POST `/api/v1/units`

PATCH `/api/v1/units/:id`

DELETE `/api/v1/units/:id`

A organização é sempre derivada do contexto autenticado. O slug institucional não
pode ser alterado pela API. Atualizações exigem `organization.update`; leitura exige
`organization.read`.

Unidades exigem as permissões `unit.read`, `unit.create`, `unit.update` e
`unit.delete`, conforme a operação. A troca de sede é atômica no banco: ao marcar
uma unidade como sede, a sede anterior é desmarcada na mesma transação. A sede não
pode ser excluída logicamente.

---

## Projetos e unidades de execução

GET `/api/v1/projects`

GET `/api/v1/projects/:id`

POST `/api/v1/projects`

PATCH `/api/v1/projects/:id`

DELETE `/api/v1/projects/:id`

GET `/api/v1/projects/:projectId/units`

POST `/api/v1/projects/:projectId/units`

PATCH `/api/v1/projects/:projectId/units/:projectUnitId`

DELETE `/api/v1/projects/:projectId/units/:projectUnitId`

As operações respeitam simultaneamente a organização autenticada, as permissões
`project.*` e os escopos de projeto e unidade. A unidade principal de um projeto é
substituída atomicamente no banco. Datas parciais de atualização são validadas
contra as datas já persistidas, impedindo intervalos invertidos.

---

## Cadastro institucional de pessoas

O cadastro diferencia pessoa física (`INDIVIDUAL`) e pessoa jurídica
(`ORGANIZATION`) e impede combinações incompatíveis de CPF e CNPJ. Documentos são
normalizados antes da persistência e permanecem únicos dentro da organização.

O endereço principal é substituído atomicamente no banco. Relacionamentos não
aceitam autorreferência, só podem apontar para pessoas ativas da mesma organização
e validam o intervalo completo mesmo quando apenas uma das datas é alterada.

---

## Equipe de projetos

GET `/api/v1/projects/:projectId/team`

POST `/api/v1/projects/:projectId/team`

PATCH `/api/v1/projects/:projectId/team/:memberId`

DELETE `/api/v1/projects/:projectId/team/:memberId`

A leitura exige `project.read`; alterações exigem `project.manage_team`. Pessoa,
projeto e organização são conferidos no banco, impedindo vínculos entre entidades
de organizações diferentes. O encerramento preserva o histórico por exclusão lógica.

---

## Central de Supervisão Clínica

GET `/api/v1/clinical-supervision/cases`

POST `/api/v1/clinical-supervision/cases`

PATCH `/api/v1/clinical-supervision/cases/:id`

GET `/api/v1/clinical-supervision/cases/:id/sessions`

POST `/api/v1/clinical-supervision/cases/:id/sessions`

PATCH `/api/v1/clinical-supervision/cases/:id/sessions/:sessionId`

A central só aceita projetos marcados com atendimento clínico. Casos vinculam
beneficiário, projeto e, opcionalmente, Responsável Técnico. Sessões registram
supervisor, agenda, estado e notas. Leitura exige `clinical_supervision.read` e
alterações exigem `clinical_supervision.manage`, sempre combinadas ao escopo do
projeto. Responsável Técnico possui leitura e gestão transversal autorizada.

---

## Cadastro da população neurodivergente

GET `/api/v1/neurodivergent-intakes`

GET `/api/v1/neurodivergent-intakes/:id`

POST `/api/v1/neurodivergent-intakes/submit`

PATCH `/api/v1/neurodivergent-intakes/:id/consents/:consentId/revoke`

O envio final grava cadastro, perfil sensível, consentimento e revisão de retenção
na mesma transação. Uma falha em qualquer etapa desfaz toda a operação. O protocolo
é produzido pelo banco. A API não recebe `organization_id` do navegador.

Permissões: `neurodivergent_profile.read`, `neurodivergent_profile.manage`,
`consent.read` e `consent.manage`.

## Demandas e encaminhamentos

GET `/api/v1/care-requests`

POST `/api/v1/care-requests`

PATCH `/api/v1/care-requests/:id`

As demandas representam necessidades identificadas, espera, encaminhamento,
atendimento e conclusão. A fila não é inferida apenas do texto do formulário: ela
possui estado, prioridade e data de espera próprios.

## Indicadores protegidos

GET `/api/v1/indicators/neurodivergent-population?dimension=condition`

GET `/api/v1/indicators/neurodivergent-population?dimension=priority_need`

Somente grupos com pelo menos cinco registros são retornados. O endpoint não
retorna identificadores nem linhas individuais.

## Privacidade e retenção

GET `/api/v1/privacy/requests`

POST `/api/v1/privacy/requests`

PATCH `/api/v1/privacy/requests/:id`

GET `/api/v1/privacy/retention-reviews`

PATCH `/api/v1/privacy/retention-reviews/:id`

Cada consentimento ativo agenda automaticamente uma revisão para 24 meses após a
confirmação. Decisões de anonimizar ou excluir são registradas, mas a execução
destrutiva exige processo operacional próprio e não ocorre automaticamente.

---

## Erros

As APIs devem preferir códigos de erro estáveis e semanticamente identificáveis.

Exemplos:

`INVALID_ADDRESS_DATA`

`INVALID_RELATIONSHIP_DATA`

`PERSON_RELATIONSHIP_SELF_REFERENCE`

`RELATIONSHIP_PERSON_NOT_FOUND`

`MEMBER_NOT_FOUND`

`ROLE_NOT_FOUND`

`MEMBER_ROLE_ALREADY_ACTIVE`

`ROLE_ASSIGNMENT_FORBIDDEN`

`LAST_ADMINISTRATOR_ROLE_REQUIRED`

Os detalhes internos do banco ou infraestrutura não devem ser expostos desnecessariamente aos clientes da API.
