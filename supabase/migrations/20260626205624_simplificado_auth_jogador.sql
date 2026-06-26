-- ============================================================================
-- MIGRATION: Autenticação Simplificada do Jogador (Nome + WhatsApp Único)
-- Data: 2026-06-26
-- Objetivo: Tornar o WhatsApp o identificador único para Jogadores,
--           impedindo nomes duplicados e números associados a nomes diferentes.
-- ============================================================================

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
  v_normalized_username text;
  v_normalized_phone text;
  v_profile_id uuid;
  v_existing_id uuid;
  v_existing_username text;
  v_existing_role text;
  v_username_owner_id uuid;
  v_username_owner_phone text;
BEGIN
  -- 1. Normaliza e valida o username
  v_normalized_username := btrim(coalesce(p_username, ''));
  if length(v_normalized_username) < 2 then
    raise exception 'Nome de usuário inválido (mínimo de 2 caracteres).';
  end if;
  
  -- 2. Normaliza e valida o telefone se for fornecido
  v_normalized_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  
  -- Padroniza número de telefone celular no Brasil: remove o DDI 55 se estiver presente 
  -- e o número resultant tiver 10 ou 11 dígitos (DDD + número)
  if length(v_normalized_phone) >= 12 and left(v_normalized_phone, 2) = '55' then
    v_normalized_phone := substring(v_normalized_phone from 3);
  end if;

  -- Se o telefone não for fornecido, mas for login de jogador, deve ser obrigatório.
  -- Nota: Em chamadas de auditoria pós-login ou acesso de admin, p_phone pode ser null.
  -- Se p_phone for nulo/vazio, tentamos encontrar pelo username exato.
  if v_normalized_phone = '' then
    -- Tenta encontrar o perfil existente pelo username
    select id, role into v_profile_id, v_existing_role
    from public.fm_perfis
    where lower(username) = lower(v_normalized_username)
    limit 1;
    
    if v_profile_id is not null then
      return jsonb_build_object(
        'success', true,
        'profile_id', v_profile_id,
        'username', v_normalized_username
      );
    else
      raise exception 'O número de WhatsApp é obrigatório para o primeiro acesso.';
    end if;
  end if;

  -- 3. Verifica se já existe um jogador (role = 'player') com o mesmo telefone
  select id, username, role
  into v_existing_id, v_existing_username, v_existing_role
  from public.fm_perfis
  where (
    phone = v_normalized_phone
    or regexp_replace(phone, '\D', '', 'g') = v_normalized_phone
    or (
      length(regexp_replace(phone, '\D', '', 'g')) >= 12 
      and substring(regexp_replace(phone, '\D', '', 'g') from 3) = v_normalized_phone
    )
    or (
      length(v_normalized_phone) >= 12 
      and substring(v_normalized_phone from 3) = regexp_replace(phone, '\D', '', 'g')
    )
  ) and role = 'player'
  limit 1;

  -- 4. Se o telefone já existir no banco para um jogador
  if v_existing_id is not null then
    -- Valida se o nome informado corresponde ao nome cadastrado (case-insensitive)
    if lower(v_existing_username) = lower(v_normalized_username) then
      -- Se corresponder, atualiza o telefone para o formato limpo se necessário, e atualiza updated_at
      update public.fm_perfis
      set phone = v_normalized_phone,
          updated_at = now()
      where id = v_existing_id;
      
      return jsonb_build_object(
        'success', true,
        'profile_id', v_existing_id,
        'username', v_existing_username -- retorna o nome oficial cadastrado no banco
      );
    else
      -- Se o nome for diferente, bloqueia
      raise exception 'Esse número já está associado a outro jogador.';
    end if;
  end if;

  -- 5. Se o telefone NÃO existir, verificamos se o nome já está em uso por outro WhatsApp
  select id, phone
  into v_username_owner_id, v_username_owner_phone
  from public.fm_perfis
  where lower(username) = lower(v_normalized_username)
  limit 1;

  if v_username_owner_id is not null then
    -- Se o nome já existe e está associado a outro telefone
    raise exception 'Esse nome já está em uso.';
  end if;

  -- 6. Se o telefone e o nome estão livres, cria automaticamente o registro do jogador
  insert into public.fm_perfis (
    username,
    full_name,
    phone,
    role,
    confirmed,
    payment_status,
    username_customized
  )
  values (
    v_normalized_username,
    v_normalized_username,
    v_normalized_phone,
    'player',
    false,
    'pending',
    true
  )
  returning id into v_profile_id;

  return jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'username', v_normalized_username
  );
END;
$$;
