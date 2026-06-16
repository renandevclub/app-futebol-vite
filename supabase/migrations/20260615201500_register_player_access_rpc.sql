-- ============================================================================
-- MIGRATION: Registro de Perfis e Auditoria de Acesso de Jogadores
-- Data: 2026-06-15
-- Objetivo: Salvar perfis e registrar o acesso de usuários a partidas
-- ============================================================================

-- 1. Atualizar Check Constraint de ações válidas em fm_auditoria_sorteios
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
        'bypass_attempt_detected',
        'user_access',
        'match_access'
    )
);

-- 2. Criar a RPC register_player_access
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
  
  -- Se um match_id for passado, insere um log correspondente na tabela fm_auditoria_sorteios
  IF p_match_id IS NOT NULL AND btrim(p_match_id) <> '' THEN
    INSERT INTO public.fm_auditoria_sorteios (
      match_id,
      player_username,
      player_key,
      action,
      details,
      user_agent
    ) VALUES (
      p_match_id,
      p_username,
      v_player_key,
      p_action,
      jsonb_build_object(
        'phone', p_phone,
        'profile_id', v_profile_id,
        'accessed_at', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ),
      p_user_agent
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'username', p_username
  );
END;
$$;

-- Concede privilégios de execução para usuários autenticados e anônimos (via REST API)
REVOKE ALL ON FUNCTION public.register_player_access(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.register_player_access(text, text, text, text, text) TO anon, authenticated;
