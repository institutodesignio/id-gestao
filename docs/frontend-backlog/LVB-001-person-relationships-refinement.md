# LVB-001 — Refinamento de Relações e Responsáveis

## Status

READY

## Priority

HIGH

## Origin

Pacotes 019 e 020 — módulo Pessoas.

## Backend dependency

Backend de Pessoas, endereços e relacionamentos implementado e validado.

---

## Objective

Melhorar a semântica e apresentação das relações entre pessoas no módulo Pessoas sem alterar os contratos backend já funcionais.

---

## Current behavior

A ficha da pessoa possui uma aba denominada:

`Vínculos e responsáveis`

Relacionamentos cadastrados podem apresentar o identificador UUID da pessoa relacionada em vez de seu nome.

A terminologia utilizada pode gerar confusão entre:

- relações pessoais;
- responsáveis legais;
- responsáveis financeiros;
- vínculos profissionais;
- Responsável Técnico.

---

## Expected behavior

A interface deve deixar claro que esta área representa relações entre pessoas e responsabilidades associadas à pessoa.

Responsabilidade Técnica institucional não deve ser apresentada como se fosse uma relação pessoal.

---

## Required changes

### 1. Terminologia

Revisar a denominação:

`Vínculos e responsáveis`

Preferência atual:

`Relações e responsáveis`

A implementação deve evitar terminologia que faça o usuário interpretar essa área como vínculo profissional com o Instituto.

### 2. Pessoa relacionada

Não apresentar UUID como identificação principal da pessoa relacionada.

Em vez de:

`Pessoa vinculada a73e9c97...`

apresentar o nome da pessoa relacionada.

Exemplo:

`Administrador Instituto Designio`

### 3. Responsabilidades

Apresentar claramente, quando aplicável:

- tipo de relação;
- responsável legal;
- responsável financeiro;
- período de vigência.

### 4. Responsabilidade Técnica

Não tratar `Responsável Técnico` como simples `person_relationship`.

Responsabilidades institucionais e técnicas terão modelagem própria.

---

## Existing API contracts

Relacionamentos:

POST `/api/v1/persons/:id/relationships`

PATCH `/api/v1/persons/:id/relationships/:relationshipId`

Detalhe da pessoa:

GET `/api/v1/persons/:id`

Pesquisa/listagem de pessoas:

GET `/api/v1/persons`

---

## Permissions

Respeitar as permissões já disponibilizadas pelo contexto autenticado.

Leitura depende das permissões correspondentes do módulo Pessoas.

Operações de alteração devem continuar respeitando as permissões existentes no backend.

---

## Do not change

Não substituir ou reimplementar sem necessidade:

- autenticação Supabase existente;
- gerenciamento de sessão;
- client HTTP central;
- React Query;
- contratos backend existentes;
- layout institucional global;
- rotas funcionais existentes.

Não criar relacionamento institucional fictício para representar Responsável Técnico.

---

## Acceptance criteria

- [ ] A aba não utiliza terminologia ambígua de vínculo profissional.
- [ ] O nome da pessoa relacionada é apresentado ao usuário.
- [ ] UUID não é utilizado como identificação visual principal.
- [ ] Tipo da relação permanece visível.
- [ ] Responsável legal é apresentado quando aplicável.
- [ ] Responsável financeiro é apresentado quando aplicável.
- [ ] Datas de início e término continuam disponíveis quando aplicáveis.
- [ ] Criação de relacionamento continua funcionando.
- [ ] Edição de relacionamento continua funcionando.
- [ ] Nenhuma alteração quebra a ficha de Pessoas.
- [ ] Responsável Técnico não é tratado como relação pessoal.

---

## Validation

Após implementação:

- [ ] Typecheck
- [ ] ESLint
- [ ] Build
- [ ] Abrir ficha de uma pessoa
- [ ] Visualizar relacionamento existente
- [ ] Criar relacionamento
- [ ] Editar relacionamento
- [ ] Confirmar exibição do nome da pessoa relacionada
- [ ] Confirmar ausência de UUID como identificação visual principal

---

## Batch

Ainda não atribuído.

Aguardar outras pendências de frontend antes de consumir uma execução dedicada no Lovable.