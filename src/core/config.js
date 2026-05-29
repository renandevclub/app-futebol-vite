/**
 * ============================================
 * Futebol Milhao - Configuracao Centralizada
 * ============================================
 *
 * ATENCAO: Este arquivo contem a chave ANON/PUBLISHABLE do Supabase.
 * Esta chave e projetada para ser publica no frontend.
 * As permissoes de acesso aos dados sao controladas via
 * Row Level Security (RLS) no banco de dados.
 *
 * == MIGRACAO VITE ==
 * As chaves vem do arquivo .env via import.meta.env.
 * O prefixo VITE_ e obrigatorio para variaveis expostas
 * ao navegador.
 *
 * IMPORTANTE: FM_CONFIG e exportado (nao apenas global)
 * para que o Rollup NAO faca tree-shaking deste modulo.
 * ============================================
 */

export const FM_CONFIG = {
  // Supabase - Chave publica (anon key). Segura para frontend.
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  },

  // Valores padrao (fallback) - os valores reais vem do banco (fm_app_config)
  defaults: {
    adminWhatsapp: '',
    whatsappGroupLink: ''
  }
};

// Expor globalmente para manter compatibilidade com codigo existente
window.FM_CONFIG = FM_CONFIG;
