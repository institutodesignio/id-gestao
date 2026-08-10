# ID Gestão — Documentação Técnica

Este diretório contém a documentação técnica, arquitetural e operacional do ID Gestão.

O objetivo é manter decisões, contratos, backlog e instruções de evolução versionados junto ao código-fonte.

## Princípios

A documentação deste diretório faz parte do projeto.

Alterações relevantes de arquitetura, API ou comportamento esperado do frontend devem ser registradas aqui quando aplicável.

O código implementado continua sendo a referência técnica final do comportamento atual da aplicação.

---

## Estrutura

### `architecture/`

Decisões e documentação da arquitetura do ID Gestão.

Deve registrar decisões estruturais que afetem múltiplos módulos ou a evolução futura da plataforma.

### `api/`

Documentação relacionada aos contratos da API.

Pode conter convenções, endpoints, autenticação, autorização, paginação, erros e integrações.

### `frontend-backlog/`

Backlog versionado das alterações que precisam ser realizadas no frontend.

Os itens são identificados por:

`LVB-XXX`

Exemplo:

`LVB-001-person-relationships-refinement.md`

### `frontend-backlog/batches/`

Agrupamentos de itens do backlog preparados para execução no frontend/Lovable.

Os batches são identificados por:

`BATCH-XXX`

---

## Fluxo de desenvolvimento

O fluxo preferencial do projeto é:

1. Definir a capacidade de negócio.
2. Implementar banco de dados e migrations quando necessário.
3. Implementar RLS e autorização.
4. Implementar schemas e API.
5. Executar typecheck/build.
6. Validar comportamento da API.
7. Versionar o pacote no Git.
8. Registrar impactos necessários no frontend.
9. Criar ou atualizar itens `LVB-XXX`.
10. Agrupar alterações de frontend em batches quando houver valor suficiente.
11. Executar o batch no frontend.
12. Validar o fluxo ponta a ponta.

O desenvolvimento do backend não deve ficar bloqueado pela disponibilidade de créditos ou ferramentas de frontend.

---

## Regra de rastreabilidade

Quando um pacote backend gerar impacto no frontend, esse impacto deve ser registrado no `frontend-backlog`.

Um pacote backend pode estar concluído mesmo que sua atualização visual ainda esteja pendente, desde que:

- a API esteja implementada;
- as regras de segurança estejam implementadas;
- os testes definidos para o pacote tenham sido executados;
- a pendência de frontend esteja documentada.

---

## Fonte de verdade

Não depender exclusivamente de conversas, memória ou prompts anteriores para reconstruir decisões importantes do projeto.

Decisões duráveis devem ser registradas no repositório.