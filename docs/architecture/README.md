# ID Gestão — Arquitetura

Este diretório contém decisões arquiteturais duráveis do ID Gestão.

O objetivo é preservar contexto técnico suficiente para que futuras implementações mantenham coerência com a plataforma existente.

---

## Princípios arquiteturais

O ID Gestão deve ser desenvolvido como uma plataforma institucional modular.

As decisões devem priorizar:

- segurança;
- isolamento de dados;
- autorização explícita;
- rastreabilidade;
- auditabilidade;
- modularidade;
- contratos de API previsíveis;
- evolução incremental;
- manutenção de longo prazo.

---

## Separação de responsabilidades

### Banco de dados

Responsável pela integridade estrutural dos dados e pelas políticas de acesso aplicáveis.

### Backend

Responsável pelas regras de aplicação, autenticação, autorização, validação, contratos HTTP e orquestração das operações.

### Frontend

Responsável pela experiência do usuário e consumo dos contratos disponibilizados pelo backend.

O frontend não substitui controles de segurança existentes no backend ou no banco.

---

## Multi-organização

Dados institucionais devem respeitar o contexto da organização autenticada.

Identificadores de organização utilizados para autorização não devem ser aceitos cegamente a partir do frontend quando puderem ser derivados do contexto autenticado.

---

## Pessoas

`persons` representa pessoas cadastradas no contexto institucional.

Relacionamentos pessoais devem ser tratados separadamente de responsabilidades institucionais.

`person_relationships` representa relações entre pessoas.

Exemplos:

- mãe;
- pai;
- filho;
- cônjuge;
- responsável;
- responsável legal;
- responsável financeiro.

Responsabilidade Técnica não deve ser modelada simplesmente como relacionamento pessoal.

---

## Responsabilidades institucionais

Funções institucionais, profissionais e técnicas devem possuir modelagem própria quando necessário.

Exemplos:

- vínculo profissional;
- função institucional;
- Responsável Técnico;
- participação em projeto;
- supervisão clínica.

Esses conceitos não devem ser misturados automaticamente com `person_relationships`.

---

## Evolução

Novas decisões arquiteturais relevantes devem ser documentadas neste diretório.

Quando uma decisão substituir outra, registrar a mudança em vez de simplesmente apagar o contexto histórico quando esse histórico for relevante para manutenção.

---

## Registros principais

Regras de unicidade que exigem substituir um registro principal, como unidade
principal de projeto e endereço principal de pessoa, pertencem ao banco de dados.
A troca deve ocorrer na mesma transação do `INSERT` ou `UPDATE` solicitado. O
backend não deve desmarcar o registro anterior em uma operação separada, pois uma
falha posterior criaria estado intermediário inconsistente.
