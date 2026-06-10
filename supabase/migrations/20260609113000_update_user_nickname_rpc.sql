-- =========================================================================
-- Futebol Milhão - Migração: Customização de Apelido (Google Login)
-- =========================================================================

-- 1. Adicionar coluna username_customized se não existir
ALTER TABLE public.fm_perfis ADD COLUMN IF NOT EXISTS username_customized boolean default false;

-- 2. Atualizar usuários legados:
-- Se o username for igual à primeira parte do email, consideramos que o apelido
-- foi gerado automaticamente (não customizado). Caso contrário, marcamos como customizado.
UPDATE public.fm_perfis
SET username_customized = CASE 
  WHEN email IS NOT NULL AND username = split_part(email, '@', 1) THEN false
  ELSE true
END
WHERE username_customized IS NULL;

-- 3. Atualizar a trigger function handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Se for usuário anônimo, NÃO cria perfil automaticamente
  -- O perfil será criado via RPC register_visitor()
  IF new.is_anonymous = true THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.fm_perfis (auth_id, username, full_name, email, role, username_customized)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'name',
    new.email,
    'player',
    (new.raw_user_meta_data->>'username' IS NOT NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atualizar a chave estrangeira de preferências de notificações para cascade
ALTER TABLE public.fm_preferencias_notificacoes
DROP CONSTRAINT IF EXISTS fm_notification_prefs_username_fkey;

ALTER TABLE public.fm_preferencias_notificacoes
ADD CONSTRAINT fm_notification_prefs_username_fkey
FOREIGN KEY (username) REFERENCES public.fm_perfis(username)
ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Criar a RPC segura no Postgres para atualizar o apelido do usuário
CREATE OR REPLACE FUNCTION public.update_user_nickname(
  p_new_username text,
  p_new_full_name text,
  p_new_phone text
)
RETURNS void AS $$
DECLARE
  v_old_username text;
  v_old_username_key text;
  v_new_username_key text;
  v_auth_id uuid;
BEGIN
  -- 1. Obter ID do usuário autenticado
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado. Usuário não autenticado.';
  END IF;

  -- 2. Obter o username atual
  SELECT username INTO v_old_username
  FROM public.fm_perfis
  WHERE auth_id = v_auth_id;

  IF v_old_username IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado para o usuário atual.';
  END IF;

  -- 3. Validar novo username
  -- Remover espaços extras e verificar tamanho
  p_new_username := trim(p_new_username);
  
  IF length(p_new_username) < 3 OR length(p_new_username) > 20 THEN
    RAISE EXCEPTION 'O apelido deve ter entre 3 e 20 caracteres.';
  END IF;

  -- Verificar caracteres válidos (apenas letras, números, pontos e sublinhados)
  IF p_new_username !~ '^[a-zA-Z0-9._]+$' THEN
    RAISE EXCEPTION 'O apelido pode conter apenas letras, números, pontos (.) e sublinhados (_).';
  END IF;

  -- 4. Se o username mudou, validar unicidade e fazer update em todos os relacionamentos
  IF v_old_username <> p_new_username THEN
    -- Verificar se novo username já existe
    IF EXISTS (SELECT 1 FROM public.fm_perfis WHERE username = p_new_username) THEN
      RAISE EXCEPTION 'Este apelido já está em uso por outro jogador.';
    END IF;

    v_old_username_key := lower(v_old_username);
    v_new_username_key := lower(p_new_username);

    -- a. Atualizar tabela principal de perfis
    UPDATE public.fm_perfis
    SET username = p_new_username,
        full_name = p_new_full_name,
        phone = p_new_phone,
        username_customized = true,
        updated_at = now()
    WHERE auth_id = v_auth_id;

    -- b. Atualizar estatísticas de jogadores
    UPDATE public.fm_estatisticas_jogadores
    SET username = p_new_username
    WHERE username = v_old_username;

    -- c. Atualizar sorteios de jogadores
    UPDATE public.fm_sorteios_jogadores
    SET player_username = p_new_username
    WHERE player_username = v_old_username;

    -- d. Atualizar votos de partidas (candidatos e eleitores)
    UPDATE public.fm_votos_partidas
    SET voter_username = p_new_username
    WHERE voter_username = v_old_username;

    UPDATE public.fm_votos_partidas
    SET candidate_username = p_new_username
    WHERE candidate_username = v_old_username;

    -- e. Atualizar JSONB de jogadores nas partidas
    UPDATE public.fm_partidas
    SET players = (
      SELECT jsonb_agg(
        CASE 
          WHEN lower(elem->>'username') = v_old_username_key OR elem->>'username' = v_old_username THEN elem || jsonb_build_object('username', p_new_username)
          ELSE elem
        END
      )
      FROM jsonb_array_elements(players) AS elem
    )
    WHERE players @> jsonb_build_array(jsonb_build_object('username', v_old_username));

    -- f. Atualizar JSONB de histórico de sorteios nas partidas (team_draws)
    UPDATE public.fm_partidas
    SET team_draws = (
      team_draws - v_old_username_key
    ) || jsonb_build_object(
      v_new_username_key, 
      (team_draws->v_old_username_key) || jsonb_build_object('username', p_new_username)
    )
    WHERE team_draws ? v_old_username_key;

  ELSE
    -- Se o username não mudou, apenas atualiza full_name e phone
    UPDATE public.fm_perfis
    SET full_name = p_new_full_name,
        phone = p_new_phone,
        username_customized = true,
        updated_at = now()
    WHERE auth_id = v_auth_id;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
