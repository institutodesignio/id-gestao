# Produção — ID Gestão API

## Pré-requisitos

- Node.js 22 ou imagem Docker deste repositório.
- Variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS` e `APP_PUBLIC_URL`.
- HTTPS obrigatório. A chave `service_role` pertence somente ao backend e nunca ao frontend.

## Publicação

1. Validar com `npm ci && npm run check && npm audit --omit=dev --audit-level=high`.
2. Aplicar as migrações em homologação e executar smoke tests.
3. Aplicar as mesmas migrações em produção, sem editar migrações já aplicadas.
4. Publicar a imagem Docker e apontar o health check para `/ready`.
5. Configurar `CORS_ORIGINS` somente com os domínios oficiais.
6. No Supabase Auth, configurar Site URL/callbacks e ativar proteção contra senhas comprometidas.
7. No proxy de entrada, limitar requisições por IP e por usuário, especialmente login, convite e exportação LGPD.

## Smoke tests

- `GET /health` retorna 200.
- `GET /ready` retorna 200 e confirma Supabase.
- Requisição sem token a uma rota `/api/v1/*` retorna 401.
- Administrador autorizado consegue consultar auditoria e enviar convite.
- Usuário sem `privacy.manage` não consegue exportar dados pessoais.

## Rollback

- Reimplantar a imagem imediatamente anterior.
- Migrações são progressivas; não remover colunas/tabelas durante rollback. Correções de banco devem ser novas migrações.
- Antes de mudanças destrutivas futuras, criar backup/PITR e validar restauração.

## Pendências externas obrigatórias

- Guardar segredos no cofre do provedor de hospedagem.
- Configurar domínio, TLS, observabilidade, alertas e retenção de logs.
- Conciliar o histórico de migrações com a CLI do Supabase antes do próximo ciclo de mudanças.
