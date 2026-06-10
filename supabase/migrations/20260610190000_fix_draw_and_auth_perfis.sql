-- ============================================================================
-- Futebol Milhão - Migração: Correção de Perfis e Sorteio de Times
-- Data: 2026-06-10
-- Objetivo:
--   1. Corrigir a inconsistência onde o sorteio buscava na tabela antiga (fm_profiles)
--      em vez da tabela ativa (fm_perfis).
--   2. Corrigir o trigger handle_new_user() para gerar usernames únicos automáticos
--      e prevenir erros na criação de contas (Google OAuth / Email).
-- ============================================================================

-- 1. Atualizar a função auxiliar de obter username para ler da fm_perfis
CREATE OR REPLACE FUNCTION app_private.get_current_player_username()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_username text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT username
    INTO v_username
    FROM public.fm_perfis
    WHERE auth_id = auth.uid()
    LIMIT 1;

    RETURN v_username;
END;
$$;

-- 2. Atualizar a função de verificação de administrador para ler da fm_perfis
CREATE OR REPLACE FUNCTION app_private.is_fm_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.fm_perfis
        WHERE auth_id = auth.uid()
          AND role = 'admin'
    );
$$;

-- 3. Atualizar política RLS da tabela fm_sorteios_jogadores para usar a tabela fm_perfis
DROP POLICY IF EXISTS "Players can view own draws" ON public.fm_sorteios_jogadores;
CREATE POLICY "Players can view own draws"
ON public.fm_sorteios_jogadores
FOR SELECT
USING (
    player_key = lower(btrim(
        (SELECT username FROM public.fm_perfis WHERE auth_id = auth.uid() LIMIT 1)
    ))
);

-- 4. Atualizar o trigger de novos cadastros para evitar conflito de username (Google/Email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_base_username text;
  v_counter integer := 1;
BEGIN
  -- Se for usuário anônimo (visitante temporário), não cria perfil
  IF new.is_anonymous = true THEN
    RETURN NEW;
  END IF;

  -- Determina o apelido base
  v_base_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  v_username := v_base_username;

  -- Loop para encontrar um username disponível e único
  WHILE EXISTS (SELECT 1 FROM public.fm_perfis WHERE username = v_username) LOOP
    v_username := v_base_username || v_counter::text;
    v_counter := v_counter + 1;
  END LOOP;

  -- Inserção na tabela oficial
  INSERT INTO public.fm_perfis (auth_id, username, full_name, email, role, username_customized)
  VALUES (
    new.id,
    v_username,
    new.raw_user_meta_data->>'name',
    new.email,
    'player',
    (new.raw_user_meta_data->>'username' IS NOT NULL)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
