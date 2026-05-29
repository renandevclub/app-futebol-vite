# Futebol Milhão

## Visão geral do projeto

Este repositório é uma aplicação web organizada como um Multi-Page App (MPA) usando Vite.
A versão atual do projeto está centralizada em `src/` para código fonte, `pages/` para páginas HTML do app e `public/` para ativos públicos.

## Estrutura limpa atual

- `index.html`, `placar-ao-vivo.html` — entradas principais da aplicação.
- `pages/` — páginas secundárias do app (dashboard, perfil, agenda, etc.).
- `src/entries/` — arquivos de entrada Vite por página.
- `src/core/` — inicialização de página, boot, e configuração central.
- `src/components/` — componentes UI e navegação.
- `src/shared/` — utilitários e módulos de dados compartilhados.
- `src/modules/` — domínios de aplicação como notificações e sorteios.
- `src/styles/` — design system, layout e estilos específicos de página.
- `public/assets/images/` — imagens usadas no app.
- `supabase/migrations/` — migrações do banco de dados.

## Limpeza aplicada

- Removido o código legado da raiz:
  - `js/`
  - `css/`
  - `assets/`
- Removido o arquivo antigo:
  - `pages/menu.html`
- Removido o artefato Supabase obsoleto:
  - `supabase/functions/send-notification/`
- Verificado que o build do projeto ainda funciona após a limpeza com:
  - `npm run build`

## Observações

- O projeto agora está alinhado com a estrutura de build Vite atual, sem código antigo de frontend que vivia fora de `src/`.
- O `README.md` documenta a limpeza e a organização do projeto para referência futura.
- Se quiser, posso também criar uma versão condensada dessa documentação em `PROJECT_CLEANUP.md` ou revisar a lógica de notificações em `src/modules/notifications/notifications.js`.
