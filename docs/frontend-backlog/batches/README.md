# ID Gestão — Frontend Batches

Este diretório contém agrupamentos de itens do frontend backlog preparados para execução.

Um batch existe para reduzir retrabalho, consolidar alterações relacionadas e permitir uso eficiente das ferramentas de frontend.

---

## Identificação

Batches utilizam numeração sequencial:

BATCH-001  
BATCH-002  
BATCH-003  
...

---

## Objetivo

Um batch deve representar uma entrega coerente.

Evitar batches excessivamente pequenos que consumam uma execução apenas para mudanças cosméticas isoladas.

Também evitar batches grandes demais, com múltiplos domínios independentes e alto risco de regressão.

---

## Estrutura

Cada batch deve registrar:

- Status
- Objetivo
- Itens LVB incluídos
- Dependências
- Contexto da implementação
- Prompt/instruções de execução
- Restrições
- Critérios consolidados de aceite
- Validação
- Resultado da execução

---

## Estados

### DRAFT

Ainda recebendo itens.

### READY

Pronto para execução.

### IN_PROGRESS

Em execução.

### VALIDATION

Executado e aguardando validação.

### DONE

Executado e validado.

### BLOCKED

Não pode ser executado devido a uma dependência.

---

## Regra de conclusão

Um batch somente pode ser marcado como DONE depois que seus itens forem validados.

Os respectivos arquivos `LVB-XXX` também devem ser atualizados para refletir o resultado.