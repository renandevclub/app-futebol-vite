-- ============================================================================
-- MIGRATION: Limpeza de Funções Obsoletas Duplicadas (Ambíguas)
-- Data: 2026-06-15
-- Objetivo: Remover as assinaturas de funções antigas sobrecarregadas que
--           foram substituídas por versões com parâmetros adicionais com 
--           valores padrão (DEFAULT). Isso evita erros de ambiguidade no
--           PostgreSQL (erro "is not unique") quando chamadas com menos argumentos.
-- ============================================================================

-- 1. admin_release_player_draw e seu impl (substituído pela versão com p_release_reason text)
drop function if exists public.admin_release_player_draw(text, text);
drop function if exists app_private.admin_release_player_draw_impl(text, text);

-- 2. get_player_draw_status e seu impl (substituído pela versão com p_player_username text)
drop function if exists public.get_player_draw_status(text);
drop function if exists app_private.get_player_draw_status_impl(text);

-- 3. player_update_match e seu impl (substituído pela versão com p_player_username text)
drop function if exists public.player_update_match(text, jsonb, jsonb);
drop function if exists app_private.player_update_match_impl(text, jsonb, jsonb);

-- 4. player_withdraw_from_match e seu impl (substituído pela versão com p_player_username text)
drop function if exists public.player_withdraw_from_match(text, text);
drop function if exists app_private.player_withdraw_from_match_impl(text, text);

-- 5. player_draw_team e seu impl (substituído pela versão de 5 parâmetros com p_player_username text)
drop function if exists public.player_draw_team(text, text, text, text);
drop function if exists app_private.player_draw_team_impl(text, text, text);
drop function if exists app_private.player_draw_team_impl(text, text, text, text);
