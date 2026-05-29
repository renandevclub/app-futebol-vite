-- Corrige a segurança da função get_email_by_username para permitir que usuários
-- anônimos busquem o e-mail correspondente ao apelido no fluxo de login.
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email
  FROM fm_perfis
  WHERE LOWER(username) = LOWER(p_username)
  LIMIT 1;
  
  RETURN v_email;
END;
$$;
