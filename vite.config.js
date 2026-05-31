/**
 * ============================================
 * Futebol Milhão - vite.config.js
 * ============================================
 *
 * ESTRATÉGIA DE CACHE:
 *
 * Este arquivo configura o Vite para:
 *
 * 1. GERAR HASHES AUTOMÁTICOS nos nomes dos
 *    arquivos JS e CSS de saída.
 *    Ex: index-a1b2c3d4.js, style-e5f6g7h8.css
 *
 * 2. O QUE É HASH?
 *    É um código único gerado a partir do
 *    conteúdo do arquivo. Se o conteúdo muda,
 *    o hash muda. Se não muda, o hash permanece
 *    igual.
 *
 * 3. POR QUE ISSO RESOLVE O CACHE?
 *    - Navegadores cacheiam arquivos por URL
 *    - Quando você atualiza o código e faz
 *      deploy, o hash muda → URL nova
 *    - Navegador vê URL nova → baixa versão nova
 *    - Sem isso, o nome do arquivo nunca muda
 *      (ex: script.js → script.js → script.js)
 *      e o navegador usa a versão em cache
 *
 * 4. MULTI-PAGE APP (MPA)
 *    Este projeto tem MÚLTIPLAS páginas HTML
 *    (não é uma SPA - Single Page App).
 *    O Vite suporta isso nativamente configurando
 *    cada HTML como entrada (entry point) no build.
 *
 * 5. VARIÁVEIS DE AMBIENTE
 *    Variáveis com prefixo VITE_ no .env são
 *    expostas ao frontend via import.meta.env.VITE_*
 *    Ex: VITE_SUPABASE_URL → import.meta.env.VITE_SUPABASE_URL
 * ============================================
 */

import { defineConfig } from "vite";
import { resolve } from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // === Pasta raiz do projeto (onde estão os HTMLs) ===
  root: ".",
  // Use caminho absoluto de raiz para deploy em hosts estáticos como Netlify.
  // Isso garante que os assets sejam solicitados de /assets/* e não sejam
  // resolvidos incorretamente por URL limpa ou rewrite do servidor.
  base: "/",

  // === Pasta de assets públicos (servidos sem processamento) ===
  // Tudo aqui é copiado para dist/ sem modificações
  publicDir: "public",

  // === Configuração do BUILD ===
  build: {
    // Pasta de saída (onde o Vite gera os arquivos prontos)
    outDir: "dist",

    // Pasta de assets dentro de dist/
    assetsDir: "assets",

    // Gerar sourcemaps? false = build mais rápido e menor
    sourcemap: false,

    // Tamanho mínimo (em KB) para extrair CSS em arquivo separado
    // 0 = sempre extrair CSS para arquivos separados
    cssMinify: true,

    rollupOptions: {
      // === MULTI-PAGE: Cada HTML é uma entrada ===
      input: {
        // Páginas da raiz
        main: resolve(__dirname, "index.html"),
        placar: resolve(__dirname, "placar-ao-vivo.html"),

        // Páginas em /pages/
        dashboard: resolve(__dirname, "pages/dashboard.html"),
        welcome: resolve(__dirname, "pages/welcome.html"),
        register: resolve(__dirname, "pages/register.html"),
        forgotPassword: resolve(__dirname, "pages/forgot-password.html"),
        resetPassword: resolve(__dirname, "pages/reset-password.html"),
        details: resolve(__dirname, "pages/details.html"),
        schedule: resolve(__dirname, "pages/schedule.html"),
        adminPlacar: resolve(__dirname, "pages/admin-placar.html"),
        financials: resolve(__dirname, "pages/financials.html"),
        profile: resolve(__dirname, "pages/profile.html"),
        payment: resolve(__dirname, "pages/payment.html"),

        // Páginas em /mini-torneio/
        mtPaginaPrincipal: resolve(
          __dirname,
          "mini-torneio/index-pagina-principal.html",
        ),
        mtAdmin: resolve(__dirname, "mini-torneio/index-admin.html"),
        mtInscreverTime: resolve(
          __dirname,
          "mini-torneio/index-inscrever-time.html",
        ),
        mtPlacarAdmin: resolve(
          __dirname,
          "mini-torneio/index-placar-administrador.html",
        ),
        mtPlacarPublico: resolve(
          __dirname,
          "mini-torneio/index-placar-publico.html",
        ),
        mtResultados: resolve(__dirname, "mini-torneio/index-resultados.html"),
        mtFinanceiro: resolve(__dirname, "mini-torneio/index-financeiro.html"),
        mtPagamentoJogadores: resolve(
          __dirname,
          "mini-torneio/index-pagamento-jogadores.html",
        ),
      },

      output: {
        // === HASH AUTOMÁTICO ===
        // [name]  = nome do entry point
        // [hash]  = hash do conteúdo (muda quando o conteúdo muda)
        // [ext]   = extensão original (.js, .css)
        entryFileNames: "assets/js/[name]-[hash].js",
        chunkFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          // CSS: mantém na pasta assets/
          if (assetInfo.name?.endsWith(".css")) {
            return "assets/css/[name]-[hash].[ext]";
          }
          // Imagens e outros assets (dos imports)
          return "assets/[name]-[hash].[ext]";
        },
      },
    },

    // Tamanho máximo de chunk antes de split (em KB)
    // 0 = sem limite (não divide chunks)
    chunkSizeWarningLimit: 1000,
  },

  // === CSS: Configurações de processamento ===
  css: {
    // Minificar CSS no build
    devSourcemap: false,
  },

  // === RESOLVE: Aliases (atalhos para imports) ===
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  // === SERVER: Configurações do dev server ===
  server: {
    port: 5173,
    open: false,
    // Permite acessar de outros dispositivos na rede (útil para testar no celular)
    host: true,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        swSrc: "sw.js",
      },
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Futebol Milhão",
        short_name: "FutMilhão",
        description: "Plataforma de organização de futebol - Futebol Milhão",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#0f172a",
        background_color: "#060913",
        lang: "pt-BR",
        categories: ["sports", "social"],
        icons: [
          {
            src: "/assets/images/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/assets/images/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/assets/images/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/assets/images/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Placar Ao Vivo",
            short_name: "Placar",
            description: "Acompanhe as partidas em tempo real",
            url: "/placar",
            icons: [{ src: "/assets/images/pwa-192.png", sizes: "192x192" }],
          },
          {
            name: "Dashboard",
            short_name: "Dashboard",
            description: "Asee seu painel de controle",
            url: "/dashboard",
            icons: [{ src: "/assets/images/pwa-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-cdn-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],
});
