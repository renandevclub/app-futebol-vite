-- =====================================================================
-- Habilita RLS e políticas de acesso para o módulo de Mini Torneio
-- Jogador autenticado: Acesso a tudo (Times, Partidas, Pagamentos), exceto Painel de Controle (Configurações e Financeiro).
-- Administrador: Acesso total a todas as tabelas.
-- =====================================================================
-- 1. Habilitar RLS nas tabelas
ALTER TABLE public.mt_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_pagamento_jogadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_financeiro ENABLE ROW LEVEL SECURITY;
-- 2. Limpar políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "mt_configuracoes_select_all" ON public.mt_configuracoes;
DROP POLICY IF EXISTS "mt_configuracoes_admin_all" ON public.mt_configuracoes;
DROP POLICY IF EXISTS "mt_financeiro_select_authenticated" ON public.mt_financeiro;
DROP POLICY IF EXISTS "mt_financeiro_admin_all" ON public.mt_financeiro;
DROP POLICY IF EXISTS "mt_times_select_all" ON public.mt_times;
DROP POLICY IF EXISTS "mt_times_all_authenticated" ON public.mt_times;
DROP POLICY IF EXISTS "mt_partidas_select_all" ON public.mt_partidas;
DROP POLICY IF EXISTS "mt_partidas_all_authenticated" ON public.mt_partidas;
DROP POLICY IF EXISTS "mt_pagamento_jogadores_select_all" ON public.mt_pagamento_jogadores;
DROP POLICY IF EXISTS "mt_pagamento_jogadores_all_authenticated" ON public.mt_pagamento_jogadores;
-- 3. Criar novas políticas de acesso
-- [mt_configuracoes] (Painel de Controle - Geral)
-- Permite leitura para qualquer visitante (público)
CREATE POLICY "mt_configuracoes_select_all" ON public.mt_configuracoes FOR
SELECT USING (true);
-- Permite gravação/alteração APENAS para administradores
CREATE POLICY "mt_configuracoes_admin_all" ON public.mt_configuracoes FOR ALL TO authenticated USING (app_private.is_fm_admin()) WITH CHECK (app_private.is_fm_admin());
-- [mt_financeiro] (Painel de Controle - Financeiro)
-- Permite leitura apenas para usuários autenticados (jogadores e admins)
CREATE POLICY "mt_financeiro_select_authenticated" ON public.mt_financeiro FOR
SELECT TO authenticated USING (true);
-- Permite gravação/alteração APENAS para administradores
CREATE POLICY "mt_financeiro_admin_all" ON public.mt_financeiro FOR ALL TO authenticated USING (app_private.is_fm_admin()) WITH CHECK (app_private.is_fm_admin());
-- [mt_times]
-- Permite leitura pública dos times
CREATE POLICY "mt_times_select_all" ON public.mt_times FOR
SELECT USING (true);
-- Permite acesso total para qualquer jogador autenticado (e admins)
CREATE POLICY "mt_times_all_authenticated" ON public.mt_times FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- [mt_partidas]
-- Permite leitura pública das partidas/placar
CREATE POLICY "mt_partidas_select_all" ON public.mt_partidas FOR
SELECT USING (true);
-- Permite acesso total para qualquer jogador autenticado (e admins)
CREATE POLICY "mt_partidas_all_authenticated" ON public.mt_partidas FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- [mt_pagamento_jogadores]
-- Permite leitura pública dos pagamentos dos jogadores
CREATE POLICY "mt_pagamento_jogadores_select_all" ON public.mt_pagamento_jogadores FOR
SELECT USING (true);
-- Permite acesso total para qualquer jogador autenticado (e admins)
CREATE POLICY "mt_pagamento_jogadores_all_authenticated" ON public.mt_pagamento_jogadores FOR ALL TO authenticated USING (true) WITH CHECK (true);