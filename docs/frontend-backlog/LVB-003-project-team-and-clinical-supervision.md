# LVB-003 — Equipe de projetos e Central de Supervisão Clínica

- Status: READY
- Prioridade: alta
- Origem: módulos backend 5 e 6
- Dependências: API publicada com a migração `project_team_and_clinical_supervision`

## Objetivo

Disponibilizar no frontend a composição de equipes por projeto e a Central de
Supervisão Clínica, preservando a atuação transversal do Responsável Técnico.

## Alterações necessárias

- criar seção de equipe no detalhe do projeto;
- permitir incluir, editar, encerrar e consultar vínculos profissionais;
- criar painel da Central com filtros por projeto e estado;
- criar fluxo de abertura e acompanhamento de caso;
- criar agenda e registro de sessões de supervisão;
- esconder ações segundo `project.manage_team` e `clinical_supervision.manage`;
- não enviar `organization_id` e não duplicar no navegador as regras de escopo.

## Critérios de aceite

- equipes não aceitam pessoa de outra organização;
- casos só podem usar projetos com atendimento clínico;
- Responsável Técnico autorizado enxerga e gerencia casos nos projetos permitidos;
- estados e prioridades usam os valores documentados pela API;
- erros 400, 403, 404 e 409 possuem feedback específico.

## Não alterar

- autenticação e sessão;
- RLS e regras de autorização;
- identidade humana e institucional do Instituto Designio.
