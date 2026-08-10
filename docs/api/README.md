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

Este documento não substitui os schemas e a implementação existentes no código.

---

## Erros

As APIs devem preferir códigos de erro estáveis e semanticamente identificáveis.

Exemplos:

`INVALID_ADDRESS_DATA`

`INVALID_RELATIONSHIP_DATA`

`PERSON_RELATIONSHIP_SELF_REFERENCE`

`RELATIONSHIP_PERSON_NOT_FOUND`

Os detalhes internos do banco ou infraestrutura não devem ser expostos desnecessariamente aos clientes da API.