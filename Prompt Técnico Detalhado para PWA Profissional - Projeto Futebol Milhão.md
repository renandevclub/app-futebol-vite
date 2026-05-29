# Prompt Técnico Detalhado para PWA Profissional - Projeto Futebol Milhão

Este documento adapta o prompt técnico abrangente para a implementação de uma Progressive Web App (PWA) profissional, especificamente para o projeto **Futebol Milhão**. O foco é integrar as funcionalidades de PWA com a estrutura existente do projeto, que utiliza **Vite** como ferramenta de build e é uma **Multi-Page Application (MPA)**, garantindo compatibilidade com **Netlify**, **Android** e **iPhone**.

## 1. `manifest.webmanifest` - Adaptação para Futebol Milhão

O arquivo `manifest.webmanifest` já está referenciado no `index.html` (`<link rel="manifest" href="/manifest.webmanifest" />`). A configuração deve ser refinada para o contexto do Futebol Milhão.

### Configurações Essenciais e Adaptações:

*   **`name` e `short_name`**: Baseado no `package.json` e `index.html`, sugere-se:
    *   `name`: "Futebol Milhão"
    *   `short_name`: "FutMilhão"
*   **`description`**: "Plataforma de organização de futebol - Futebol Milhão" (já presente no `index.html`).
*   **`start_url`**: Manter `/` como URL inicial, pois o `index.html` é a página de login.
*   **`display`**: Manter `standalone` para uma experiência de aplicativo nativo.
*   **`background_color`**: O `index.html` define `#060913` para o `body` em dark mode e `#f8fafc` para light mode. Recomenda-se usar uma cor neutra que se alinhe com o tema principal, como `#060913` ou `#0f172a` (do `theme-color` existente).
*   **`theme_color`**: O `index.html` já define `#0f172a`. Manter esta cor.
*   **`icons`**: O `index.html` já referencia `/assets/images/emblema-castor.png`. Certifique-se de gerar este ícone em diversos tamanhos (192x192, 512x512) e incluir a propriedade `purpose: "maskable"` para Android.
    *   Exemplo: `/assets/images/emblema-castor-192x192.png`, `/assets/images/emblema-castor-512x512.png`.
*   **`shortcuts`**: Considerar atalhos para funcionalidades chave como "Placar Ao Vivo", "Dashboard" ou "Agendar Partida".
*   **`screenshots`**: Adicionar screenshots da aplicação para aprimorar a experiência de instalação no Android.

### Exemplo de `manifest.webmanifest` Adaptado:

```json
{
  "name": "Futebol Milhão",
  "short_name": "FutMilhão",
  "description": "Plataforma de organização de futebol - Futebol Milhão",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#060913",
  "theme_color": "#0f172a",
  "icons": [
    {
      "src": "/assets/images/emblema-castor-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/assets/images/emblema-castor-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/assets/images/emblema-castor-maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Placar Ao Vivo",
      "short_name": "Placar",
      "description": "Acompanhe as partidas em tempo real",
      "url": "/placar-ao-vivo.html",
      "icons": [{ "src": "/assets/images/shortcut-placar.png", "sizes": "96x96" }]
    },
    {
      "name": "Dashboard",
      "short_name": "Dashboard",
      "description": "Acesse seu painel de controle",
      "url": "/pages/dashboard.html",
      "icons": [{ "src": "/assets/images/shortcut-dashboard.png", "sizes": "96x96" }]
    }
  ]
}
```

## 2. Service Worker Profissional e `vite-plugin-pwa`

Dado que o projeto utiliza Vite e é uma MPA, o `vite-plugin-pwa` é a ferramenta ideal para gerenciar o Service Worker e o cache.

### Instalação e Configuração:

1.  **Instalar `vite-plugin-pwa`**:
    ```bash
    npm install -D vite-plugin-pwa
    ```
2.  **Configurar `vite.config.js`**: Integrar o plugin e configurar o Workbox para lidar com a natureza MPA do projeto.

    ```javascript
    // vite.config.js
    import { defineConfig } from 'vite';
    import { resolve } from 'path';
    import { VitePWA } from 'vite-plugin-pwa';

    export default defineConfig({
      root: '.', // Manter a raiz do projeto
      publicDir: 'public',
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        cssMinify: true,
        rollupOptions: {
          input: {
            // Manter todas as entradas HTML existentes
            main: resolve(__dirname, 'index.html'),
            placar: resolve(__dirname, 'placar-ao-vivo.html'),
            dashboard: resolve(__dirname, 'pages/dashboard.html'),
            welcome: resolve(__dirname, 'pages/welcome.html'),
            register: resolve(__dirname, 'pages/register.html'),
            forgotPassword: resolve(__dirname, 'pages/forgot-password.html'),
            resetPassword: resolve(__dirname, 'pages/reset-password.html'),
            details: resolve(__dirname, 'pages/details.html'),
            schedule: resolve(__dirname, 'pages/schedule.html'),
            adminPlacar: resolve(__dirname, 'pages/admin-placar.html'),
            financials: resolve(__dirname, 'pages/financials.html'),
            profile: resolve(__dirname, 'pages/profile.html'),
            payment: resolve(__dirname, 'pages/payment.html'),
            mtPaginaPrincipal: resolve(__dirname, 'mini-torneio/index-pagina-principal.html'),
            mtAdmin: resolve(__dirname, 'mini-torneio/index-admin.html'),
            mtInscreverTime: resolve(__dirname, 'mini-torneio/index-inscrever-time.html'),
            mtPlacarAdmin: resolve(__dirname, 'mini-torneio/index-placar-administrador.html'),
            mtPlacarPublico: resolve(__dirname, 'mini-torneio/index-placar-publico.html'),
            mtResultados: resolve(__dirname, 'mini-torneio/index-resultados.html'),
            mtFinanceiro: resolve(__dirname, 'mini-torneio/index-financeiro.html'),
            mtPagamentoJogadores: resolve(__dirname, 'mini-torneio/index-pagamento-jogadores.html'),
          },
          output: {
            entryFileNames: 'assets/js/[name]-[hash].js',
            chunkFileNames: 'assets/js/[name]-[hash].js',
            assetFileNames: (assetInfo) => {
              if (assetInfo.name?.endsWith('.css')) {
                return 'assets/css/[name]-[hash].[ext]';
              }
              return 'assets/[name]-[hash].[ext]';
            },
          },
        },
        chunkSizeWarningLimit: 1000,
      },
      css: {
        devSourcemap: false,
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
      server: {
        port: 5173,
        open: false,
        host: true,
      },
      plugins: [
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          // Para MPA, é crucial listar todas as páginas HTML para precaching
          includeAssets: [
            'favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg',
            'index.html', 'placar-ao-vivo.html',
            'pages/dashboard.html', 'pages/welcome.html', 'pages/register.html',
            'pages/forgot-password.html', 'pages/reset-password.html', 'pages/details.html',
            'pages/schedule.html', 'pages/admin-placar.html', 'pages/financials.html',
            'pages/profile.html', 'pages/payment.html',
            'mini-torneio/index-pagina-principal.html', 'mini-torneio/index-admin.html',
            'mini-torneio/index-inscrever-time.html', 'mini-torneio/index-placar-administrador.html',
            'mini-torneio/index-placar-publico.html', 'mini-torneio/index-resultados.html',
            'mini-torneio/index-financeiro.html', 'mini-torneio/index-pagamento-jogadores.html',
          ],
          manifest: {
            // Usar o manifest adaptado da seção 1
            name: 'Futebol Milhão',
            short_name: 'FutMilhão',
            description: 'Plataforma de organização de futebol - Futebol Milhão',
            theme_color: '#0f172a',
            background_color: '#060913',
            display: 'standalone',
            icons: [
              { src: 'assets/images/emblema-castor-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: 'assets/images/emblema-castor-512x512.png', sizes: '512x512', type: 'image/png' },
              { src: 'assets/images/emblema-castor-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' }
            ]
          },
          workbox: {
            // globPatterns deve incluir todos os assets estáticos e os arquivos HTML
            globPatterns: [
              '**/*.{js,css,html,ico,png,svg,webmanifest}',
              'assets/images/*.{png,jpg,jpeg,svg,gif}', // Incluir imagens específicas
              'assets/js/*.js',
              'assets/css/*.css',
            ],
            // Estratégias de runtime caching para APIs e assets dinâmicos
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/api\.futebolmilhao\.com\/.*$/i, // Exemplo para sua API
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'api-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 // 1 hora para dados de API
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js\/.*$/i, // Cache para Supabase CDN
                handler: 'CacheFirst',
                options: {
                  cacheName: 'supabase-cdn-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
                  }
                }
              },
              {
                urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images-cache',
                  expiration: {
                    maxEntries: 60,
                    maxAgeSeconds: 60 * 60 * 24 * 7 // 7 dias para imagens
                  }
                }
              }
            ]
          }
        })
      ]
    });
    ```

## 3. Cache Offline e Cache Inteligente

O `vite-plugin-pwa` com Workbox gerenciará o cache offline. A natureza MPA do projeto exige que todas as páginas HTML sejam explicitamente incluídas no precache ou gerenciadas por estratégias de runtime caching.

*   **Precache**: A configuração `includeAssets` e `globPatterns` no `vite.config.js` (exemplo acima) garante que todos os arquivos HTML, CSS, JS e imagens essenciais sejam precacheados.
*   **Estratégias de Runtime Caching**: As estratégias `StaleWhileRevalidate` e `CacheFirst` são recomendadas para APIs (como a do Supabase) e imagens, respectivamente, conforme configurado no exemplo do `vite.config.js`.

## 4. Preload de Assets

O Vite já otimiza o carregamento de módulos. Para recursos críticos não gerenciados pelo Service Worker, como fontes personalizadas ou CSS inicial, adicione tags `<link rel="preload">` diretamente no `<head>` de cada arquivo HTML relevante.

*   **Exemplo para `index.html` (e outras páginas)**:
    ```html
    <link rel="preload" href="/src/styles/core.css" as="style">
    <link rel="preload" href="/src/entries/login.js" as="script">
    <!-- Adicione outros assets críticos conforme necessário -->
    ```

## 5. Background Sync

Para funcionalidades que envolvem o envio de dados offline (ex: registro de partidas, atualizações de perfil), configure o Background Sync via Workbox.

*   **Configuração no `vite.config.js` (dentro de `workbox` options)**:
    ```javascript
    // ... dentro de workbox: {
    //   plugins: [
    //     new BackgroundSyncPlugin('fila-de-sincronizacao-futebol', {
    //       maxRetentionTime: 24 * 60 // Retém por até 24 horas
    //     })
    //   ]
    // },
    // ... e uma rota para interceptar as requisições que precisam de sync
    // registerRoute(
    //   /^https:\/\/api\.futebolmilhao\.com\/offline-data$/,
    //   new NetworkOnly({
    //     plugins: [bgSyncPlugin]
    //   }),
    //   'POST'
    // );
    ```
    *   **Nota**: A implementação do `BackgroundSyncPlugin` e `registerRoute` geralmente é feita diretamente no Service Worker gerado ou em um arquivo JS separado que o `vite-plugin-pwa` pode injetar. O exemplo acima mostra a lógica, mas a integração exata pode variar dependendo de como você estrutura seu Service Worker personalizado com o `vite-plugin-pwa`.

## 6. Instalação Nativa (Add to Home Screen)

Os requisitos básicos (HTTPS, `manifest.webmanifest` válido, Service Worker) serão atendidos com as configurações acima. O `index.html` já possui meta tags importantes.

*   **Promoção da Instalação**: Implemente a detecção do evento `beforeinstallprompt` no frontend (ex: em `src/entries/login.js` ou um script global) para oferecer um botão de instalação personalizado ao usuário.

## 7. Splash Screen

*   **Android**: O `background_color` e `icons` no `manifest.webmanifest` (seção 1) cuidarão da splash screen no Android.
*   **iPhone (iOS)**: O `index.html` já contém as meta tags essenciais (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `apple-touch-icon`).
    *   **Ação Necessária**: Gerar e adicionar as tags `<link rel="apple-touch-startup-image">` para diferentes resoluções e orientações de dispositivos iOS. Utilize uma ferramenta geradora de splash screens para iOS para facilitar este processo, garantindo que o `emblema-castor.png` seja a base.

## 8. Modo Standalone

Já configurado via `display: "standalone"` no `manifest.webmanifest`.

## 9. Atualização Silenciosa

O `vite-plugin-pwa` com `registerType: 'autoUpdate'` (já no exemplo do `vite.config.js`) cuidará da atualização silenciosa do Service Worker. Implemente a notificação no frontend para informar o usuário sobre a nova versão e sugerir a recarga da página.

*   **Exemplo de notificação no frontend (em um script global ou no `main.js`)**:
    ```javascript
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Um novo Service Worker foi ativado
        console.log('Nova versão do Futebol Milhão disponível!');
        // Exibir um toast ou banner para o usuário recarregar a página
        // Ex: showUpdateNotification('Uma nova versão está disponível. Recarregue para atualizar!');
      });
    }
    ```

## 10. Estratégia Anti-Cache Antigo

*   **`vite-plugin-pwa` e Workbox**: Gerenciam automaticamente o versionamento do Service Worker e o precaching com hashes, prevenindo que o navegador use versões antigas.
*   **`skipWaiting()` e `clients.claim()`**: O `vite-plugin-pwa` geralmente configura isso por padrão para `autoUpdate`. Verifique a documentação do plugin para customizações, se necessário.
*   **`cache-control` Headers no Netlify**: Para o `sw.js` e `manifest.webmanifest`, o Netlify pode ser configurado para servir esses arquivos com `Cache-Control: no-cache` ou `max-age=0, must-revalidate` para garantir que o navegador sempre busque a versão mais recente. Isso pode ser feito via um arquivo `_headers` na raiz do seu diretório `dist`.
    ```
    # _headers
    /sw.js
      Cache-Control: no-cache
    /manifest.webmanifest
      Cache-Control: no-cache
    ```

## 11. Compatibilidade e Ferramentas - Contexto Futebol Milhão

### Vite:

*   A integração com `vite-plugin-pwa` é a chave. O projeto já utiliza o sistema de hash nos nomes dos arquivos de build (`[name]-[hash].js`, `[name]-[hash].css`), o que é fundamental para a estratégia de cache do Service Worker.

### Netlify:

*   **Implantação**: Continue implantando o projeto Vite no Netlify. Certifique-se de que o `manifest.webmanifest` e o `sw.js` (gerado pelo `vite-plugin-pwa`) estejam na raiz do diretório `dist`.
*   **HTTPS**: O Netlify já fornece HTTPS.
*   **Redirecionamentos/Rewrites**: O projeto é MPA e possui várias páginas HTML. É **essencial** configurar um arquivo `_redirects` na pasta `public` (ou `dist`) para que todas as rotas desconhecidas sejam redirecionadas para o `index.html` (ou a página de login), permitindo que o roteamento do lado do cliente funcione corretamente para as páginas internas.
    ```
    # _redirects
    /*    /index.html   200
    ```
    *   **Atenção**: Se você tiver rotas específicas que devem carregar outros HTMLs diretamente (ex: `/placar-ao-vivo` deve carregar `placar-ao-vivo.html`), você precisará ajustar o `_redirects` para lidar com essas exceções antes da regra genérica.

### Android:

*   Use o Chrome DevTools para depurar o Service Worker e o manifest. Teste a instalação e o comportamento offline.

### iPhone (iOS):

*   As meta tags já presentes no `index.html` são um bom começo. A principal tarefa é gerar as `apple-touch-startup-image` para cobrir os dispositivos iOS mais comuns.
*   Use o Safari Web Inspector para depurar em dispositivos iOS.

## Conclusão

Ao seguir este prompt adaptado, o projeto **Futebol Milhão** poderá ser transformado em uma PWA profissional, oferecendo uma experiência de usuário rápida, confiável e envolvente, com a sensação de um aplicativo nativo em diversas plataformas. A integração do `vite-plugin-pwa` é central para simplificar a gestão do Service Worker e do manifest em sua arquitetura MPA com Vite.
