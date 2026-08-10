# ID Gestão — Frontend Backlog

Este diretório contém o backlog versionado de alterações necessárias no frontend do ID Gestão.

O objetivo é permitir que o backend continue evoluindo independentemente da disponibilidade do Lovable ou de outras ferramentas de frontend.

---

## Identificação

Cada item recebe um identificador sequencial:

LVB-001  
LVB-002  
LVB-003  
...

Formato recomendado do arquivo:

`LVB-XXX-descricao-curta.md`

---

## Estados

Cada item deve utilizar um dos seguintes estados:

### PENDING

Requisito identificado e ainda não executado.

### READY

Requisito suficientemente especificado e pronto para entrar em um batch.

### BATCHED

Item incluído em um `BATCH-XXX`.

### IN_PROGRESS

Execução iniciada no frontend.

### VALIDATION

Implementado e aguardando validação.

### DONE

Implementado e validado.

### BLOCKED

Existe uma dependência impedindo a execução.

---

## Estrutura mínima de um LVB

Cada item deve conter:

- Status
- Prioridade
- Origem
- Dependências
- Objetivo
- Comportamento atual
- Comportamento esperado
- Alterações necessárias
- Contratos de API envolvidos
- Permissões envolvidas
- Critérios de aceite
- Elementos que não devem ser alterados
- Validação

---

## Regra de execução

Não executar alterações isoladamente no Lovable apenas porque existe crédito disponível.

Preferir agrupamentos coerentes de alterações que representem uma capacidade funcional.

Os itens podem ser agrupados em:

`frontend-backlog/batches/BATCH-XXX.md`

---

## Segurança

O frontend nunca deve ser considerado a única camada de autorização.

Permissões utilizadas para esconder ou desabilitar componentes de interface devem corresponder às regras efetivamente protegidas pelo backend e pelas políticas de banco aplicáveis.

---

## Contratos

Quando um item depender de endpoint existente, registrar:

- método;
- rota;
- principais campos de entrada;
- principais campos de resposta;
- permissões relevantes.

Não duplicar toda a implementação backend dentro do documento.

---

## Regra para agentes

Ao executar este backlog:

1. Ler o item completo.
2. Verificar dependências.
3. Preservar funcionalidades existentes.
4. Não modificar contratos backend sem necessidade explícita.
5. Não criar permissões inexistentes.
6. Não substituir autenticação ou gerenciamento de sessão existentes sem requisito explícito.
7. Executar typecheck, lint e build quando disponíveis.
8. Registrar qualquer bloqueio encontrado.
9. Não marcar como DONE sem validar os critérios de aceite.