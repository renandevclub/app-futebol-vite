-- ============================================================================
-- MIGRATION: Correção de get_current_player_username com Argumento
-- Data: 2026-06-15
-- Objetivo: Recriar a função get_current_player_username(text) sem valores 
--           padrão (DEFAULT) para coexistir perfeitamente com a de zero argumentos
--           get_current_player_username(). Isso resolve o erro de função 
--           inexistente ("does not exist") em chamadas com argumentos ao mesmo
--           tempo que elimina a ambiguidade ("not unique") nas chamadas sem argumentos.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_private.get_current_player_username(p_override_username text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if p_override_username is not null and p_override_username <> '' then
    return p_override_username;
  end if;
  return (
    select username
    from public.fm_perfis
    where auth_id = auth.uid()
    limit 1
  );
end;
$function$;
