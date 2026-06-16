-- ============================================================================
-- MIGRATION: Restaurar Auditoria Original de Sorteios
-- Data: 2026-06-15
-- Objetivo: Ajustar a tabela fm_auditoria_sorteios para registrar apenas eventos 
--           de sorteios e suas ações administrativas, removendo os registros de
--           acesso comum de visualização e garantindo que o fluxo não permita
--           duplicações.
-- ============================================================================

-- 1. Deletar registros de acessos legados na tabela de auditoria
DELETE FROM public.fm_auditoria_sorteios WHERE action IN ('user_access', 'match_access');

-- 2. Restaurar a Check Constraint de ações válidas originais para fm_auditoria_sorteios
ALTER TABLE public.fm_auditoria_sorteios DROP CONSTRAINT IF EXISTS fm_draw_audit_logs_action_check;

ALTER TABLE public.fm_auditoria_sorteios ADD CONSTRAINT fm_draw_audit_logs_action_check CHECK (
    action IN (
        'draw_success',
        'draw_blocked_already_drawn',
        'draw_blocked_no_profile',
        'draw_blocked_insufficient_teams',
        'draw_blocked_team_removed',
        'draw_blocked_match_not_found',
        'draw_error_unexpected',
        'draw_error_lock_timeout',
        'admin_release_draw',
        'admin_manual_assignment',
        'frontend_idempotency_replay',
        'bypass_attempt_detected'
    )
);

-- 3. Atualizar a RPC register_player_access para salvar somente no fm_perfis
CREATE OR REPLACE FUNCTION public.register_player_access(
  p_username text,
  p_phone text DEFAULT null,
  p_match_id text DEFAULT null,
  p_action text DEFAULT 'user_access',
  p_user_agent text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_player_key text;
  v_profile_id uuid;
BEGIN
  -- Normaliza e valida o username
  p_username := btrim(coalesce(p_username, ''));
  if p_username = '' or length(p_username) < 2 then
    raise exception 'Nome de usuario invalido (minimo 2 caracteres).';
  end if;
  
  v_player_key := lower(p_username);
  
  -- Garante a presença do usuário na tabela fm_perfis
  INSERT INTO public.fm_perfis (
    username,
    full_name,
    phone,
    role,
    confirmed,
    payment_status,
    username_customized
  )
  VALUES (
    p_username,
    p_username,
    nullif(btrim(coalesce(p_phone, '')), ''),
    'player',
    false,
    'pending',
    true
  )
  ON CONFLICT (username) DO UPDATE SET
    phone = COALESCE(nullif(btrim(coalesce(p_phone, '')), ''), public.fm_perfis.phone),
    updated_at = NOW()
  RETURNING id into v_profile_id;
  
  -- NOTA: O log de acesso na fm_auditoria_sorteios foi removido conforme solicitação do usuário.
  
  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'username', p_username
  );
END;
$$;
