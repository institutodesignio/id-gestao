# LVB-002 — Projetos, unidades e pessoas

- Status: READY
- Prioridade: alta
- Origem: módulos backend 3 e 4
- Dependências: API publicada com as migrações dos módulos 3 e 4

## Objetivo

Alinhar o frontend aos contratos consolidados de projetos e cadastro institucional
de pessoas sem transferir regras de autorização ou integridade para a interface.

## Alterações necessárias

- consumir `GET /api/v1/projects/:projectId/units` para listar as unidades do projeto;
- permitir escolher uma unidade principal, sem desmarcar previamente a anterior;
- tratar `PROJECT_UNIT_CONFLICT`, `INVALID_PROJECT_DATA` e erros de permissão;
- enviar atualizações parciais de datas e exibir os erros de intervalo retornados;
- permitir marcar um endereço principal, sem desmarcar previamente o anterior;
- manter CPF/CNPJ normalizados apenas como conveniência visual, pois o backend normaliza novamente;
- não enviar `organization_id` em payloads institucionais.

## Permissões

- leitura de projeto: `project.read`;
- criação: `project.create`;
- alteração e vínculo de unidades: `project.update`;
- leitura de pessoas: `person.read`;
- criação e alteração: `person.create` e `person.update`.

## Critérios de aceite

- a troca de unidade ou endereço principal exige uma única requisição de gravação;
- usuários sem permissão não visualizam ações de edição;
- respostas 400, 403, 404 e 409 geram mensagens específicas;
- filtros e paginação da listagem de projetos são preservados;
- nenhuma decisão de organização é baseada em identificador fornecido pelo navegador.

## Não alterar

- autenticação existente;
- gerenciamento de sessão;
- regras de RLS;
- identidade visual do Instituto Designio.
