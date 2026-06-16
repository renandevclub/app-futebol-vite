-- Align the current Futebol Milhao database contract before new ranking work.
-- This migration keeps older history intact and normalizes the live schema,
-- RLS policies, grants, and RPC exposure around the canonical table names.

create schema if not exists app_private;

-- Rename legacy tables only when the canonical table does not already exist.
do $$
declare
  item record;
begin
  for item in
    select *
    from (values
      ('public.fm_profiles', 'fm_perfis'),
      ('public.fm_matches', 'fm_partidas'),
      ('public.fm_player_stats', 'fm_estatisticas_jogadores'),
      ('public.fm_app_config', 'configuracoes'),
      ('public.fm_player_draws', 'fm_sorteios_jogadores'),
      ('public.fm_draw_audit_logs', 'fm_auditoria_sorteios'),
      ('public.fm_notifications', 'fm_notificacoes'),
      ('public.fm_notification_prefs', 'fm_preferencias_notificacoes'),
      ('public.fm_match_votes', 'fm_votos_partidas'),
      ('public.fm_standings', 'fm_classificacao'),
      ('public.settings', 'configuracoes')
    ) as pairs(old_table, new_table)
  loop
    if to_regclass(item.old_table) is not null
       and to_regclass('public.' || item.new_table) is null then
      execute format('alter table %s rename to %I', item.old_table, item.new_table);
    end if;
  end loop;
end;
$$;

-- If both settings and configuracoes exist, copy settings forward without
-- deleting the legacy table. Runtime code reads configuracoes only.
do $$
begin
  if to_regclass('public.settings') is not null
     and to_regclass('public.configuracoes') is not null then
    insert into public.configuracoes (key, value)
    select key, value
    from public.settings
    on conflict (key) do update
      set value = excluded.value,
          updated_at = now();
  end if;
end;
$$;

alter table if exists public.configuracoes
  add column if not exists updated_at timestamptz default now();

alter table if exists public.configuracoes
  alter column updated_at set default now();

alter table if exists public.fm_perfis
  add column if not exists phone text,
  add column if not exists confirmed boolean default false,
  add column if not exists payment_status text,
  add column if not exists avatar_url text,
  add column if not exists username_customized boolean default false;

alter table if exists public.fm_perfis
  alter column role set default 'player';

do $$
begin
  if to_regclass('public.fm_perfis') is not null then
    update public.fm_perfis
    set username_customized = false
    where username_customized is null;

    alter table public.fm_perfis
      drop constraint if exists fm_profiles_role_check,
      drop constraint if exists fm_perfis_role_check;

    alter table public.fm_perfis
      add constraint fm_perfis_role_check
      check (role in ('admin', 'player', 'visitor'));
  end if;
end;
$$;

alter table if exists public.fm_partidas
  add column if not exists players jsonb default '[]'::jsonb,
  add column if not exists votes jsonb default '{}'::jsonb,
  add column if not exists financial_summary jsonb default '{}'::jsonb,
  add column if not exists results_processed boolean default false,
  add column if not exists teams jsonb default '[]'::jsonb,
  add column if not exists team_draws jsonb default '{}'::jsonb,
  add column if not exists name text,
  add column if not exists title text;

alter table if exists public.fm_partidas
  alter column players set default '[]'::jsonb,
  alter column votes set default '{}'::jsonb,
  alter column financial_summary set default '{}'::jsonb,
  alter column results_processed set default false,
  alter column teams set default '[]'::jsonb,
  alter column team_draws set default '{}'::jsonb;

do $$
begin
  if to_regclass('public.fm_partidas') is not null then
    update public.fm_partidas
    set players = coalesce(players, '[]'::jsonb),
        votes = coalesce(votes, '{}'::jsonb),
        financial_summary = coalesce(financial_summary, '{}'::jsonb),
        results_processed = coalesce(results_processed, false),
        teams = coalesce(teams, '[]'::jsonb),
        team_draws = coalesce(team_draws, '{}'::jsonb);

    alter table public.fm_partidas
      drop constraint if exists fm_matches_teams_is_array,
      drop constraint if exists fm_partidas_teams_is_array,
      drop constraint if exists fm_matches_team_draws_is_object,
      drop constraint if exists fm_partidas_team_draws_is_object;

    alter table public.fm_partidas
      add constraint fm_partidas_teams_is_array
      check (teams is null or jsonb_typeof(teams) = 'array'),
      add constraint fm_partidas_team_draws_is_object
      check (team_draws is null or jsonb_typeof(team_draws) = 'object');
  end if;
end;
$$;

alter table if exists public.fm_sorteios_jogadores
  add column if not exists released_at timestamptz,
  add column if not exists released_by text,
  add column if not exists release_reason text,
  add column if not exists draw_type text default 'linha';

alter table if exists public.fm_sorteios_jogadores
  alter column draw_type set default 'linha';

do $$
begin
  if to_regclass('public.fm_sorteios_jogadores') is not null then
    update public.fm_sorteios_jogadores
    set draw_type = 'linha'
    where draw_type is null;

    alter table public.fm_sorteios_jogadores
      drop constraint if exists fm_player_draws_draw_type_check,
      drop constraint if exists fm_sorteios_jogadores_draw_type_check;

    alter table public.fm_sorteios_jogadores
      add constraint fm_sorteios_jogadores_draw_type_check
      check (draw_type in ('linha', 'goleiro'));
  end if;
end;
$$;

-- Private authorization helpers used by policies and RPC implementations.
create or replace function app_private.has_fm_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.fm_perfis
    where role = 'admin'
  );
$$;

create or replace function app_private.is_fm_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.fm_perfis
    where auth_id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function app_private.get_current_player_username()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select username
  from public.fm_perfis
  where auth_id = (select auth.uid())
  limit 1;
$$;

-- Keep email lookup public because the username login flow depends on it.
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select email
  from public.fm_perfis
  where lower(username) = lower(trim(p_username))
  limit 1;
$$;

-- Auth trigger for normal users. Anonymous users are registered through
-- public.register_visitor after signInAnonymously.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text;
  v_base_username text;
  v_counter integer := 1;
begin
  if new.is_anonymous = true then
    return new;
  end if;

  v_base_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'jogador'
  );
  v_username := v_base_username;

  while exists (select 1 from public.fm_perfis where username = v_username) loop
    v_username := v_base_username || v_counter::text;
    v_counter := v_counter + 1;
  end loop;

  insert into public.fm_perfis (
    auth_id,
    username,
    full_name,
    email,
    phone,
    role,
    username_customized
  )
  values (
    new.id,
    v_username,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.email,
    new.raw_user_meta_data->>'phone',
    'player',
    (new.raw_user_meta_data->>'username' is not null)
  )
  on conflict (auth_id) do nothing;

  return new;
end;
$$;

create or replace function public.register_visitor(
  p_name text,
  p_phone text default null
)
returns json
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_auth_id uuid := (select auth.uid());
  v_name text := nullif(trim(p_name), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_base_username text;
  v_username text;
  v_counter integer := 1;
  v_existing public.fm_perfis%rowtype;
begin
  if v_auth_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if v_name is null or length(v_name) < 2 then
    raise exception 'Nome do visitante invalido.';
  end if;

  select *
  into v_existing
  from public.fm_perfis
  where auth_id = v_auth_id
  limit 1;

  if found then
    return json_build_object(
      'id', v_existing.id,
      'username', v_existing.username,
      'full_name', v_existing.full_name,
      'phone', v_existing.phone,
      'role', v_existing.role
    );
  end if;

  v_base_username := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '_', 'g'));
  v_base_username := trim(both '_' from v_base_username);

  if v_base_username = '' then
    v_base_username := 'visitante';
  end if;

  v_base_username := left(v_base_username, 18);
  v_username := v_base_username;

  while exists (select 1 from public.fm_perfis where username = v_username) loop
    v_username := left(v_base_username, 16) || v_counter::text;
    v_counter := v_counter + 1;
  end loop;

  insert into public.fm_perfis (
    auth_id,
    username,
    full_name,
    email,
    phone,
    role,
    username_customized
  )
  values (
    v_auth_id,
    v_username,
    v_name,
    null,
    v_phone,
    'visitor',
    true
  )
  returning * into v_existing;

  return json_build_object(
    'id', v_existing.id,
    'username', v_existing.username,
    'full_name', v_existing.full_name,
    'phone', v_existing.phone,
    'role', v_existing.role
  );
end;
$$;

-- Security definer RPCs need deterministic search paths.
do $$
begin
  if to_regprocedure('public.update_user_nickname(text,text,text)') is not null then
    execute 'alter function public.update_user_nickname(text, text, text) set search_path = public, pg_temp';
  end if;

  if to_regprocedure('public.submit_match_vote(text,text,text,text)') is not null then
    execute 'alter function public.submit_match_vote(text, text, text, text) security definer';
    execute 'alter function public.submit_match_vote(text, text, text, text) set search_path = public, pg_temp';
  end if;
end;
$$;

-- Rebuild RLS policies on canonical runtime tables.
do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array[
    'configuracoes',
    'fm_auditoria_sorteios',
    'fm_classificacao',
    'fm_estatisticas_jogadores',
    'fm_notificacoes',
    'fm_partidas',
    'fm_partidas_ao_vivo',
    'fm_perfis',
    'fm_preferencias_notificacoes',
    'fm_sorteios_jogadores',
    'fm_votos_partidas'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      for policy_row in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
      end loop;
    end if;
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.configuracoes') is not null then
    execute $sql$
      create policy configuracoes_read_public
      on public.configuracoes
      for select
      to anon, authenticated
      using (true)
    $sql$;

    execute $sql$
      create policy configuracoes_insert_admin
      on public.configuracoes
      for insert
      to authenticated
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy configuracoes_update_admin
      on public.configuracoes
      for update
      to authenticated
      using ((select app_private.is_fm_admin()))
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy configuracoes_delete_admin
      on public.configuracoes
      for delete
      to authenticated
      using ((select app_private.is_fm_admin()))
    $sql$;
  end if;

  if to_regclass('public.fm_perfis') is not null then
    execute $sql$
      create policy fm_perfis_read_authenticated
      on public.fm_perfis
      for select
      to authenticated
      using (true)
    $sql$;

    execute $sql$
      create policy fm_perfis_insert_self_or_admin
      on public.fm_perfis
      for insert
      to authenticated
      with check (
        (
          auth_id = (select auth.uid())
          and role in ('player', 'visitor')
        )
        or (
          role = 'admin'
          and not (select app_private.has_fm_admin())
        )
        or (select app_private.is_fm_admin())
      )
    $sql$;

    execute $sql$
      create policy fm_perfis_update_self_or_admin
      on public.fm_perfis
      for update
      to authenticated
      using (
        auth_id = (select auth.uid())
        or (select app_private.is_fm_admin())
      )
      with check (
        (
          auth_id = (select auth.uid())
          and role in ('player', 'visitor')
        )
        or (select app_private.is_fm_admin())
      )
    $sql$;

    execute $sql$
      create policy fm_perfis_delete_admin
      on public.fm_perfis
      for delete
      to authenticated
      using ((select app_private.is_fm_admin()))
    $sql$;
  end if;

  if to_regclass('public.fm_partidas') is not null then
    execute $sql$
      create policy fm_partidas_read_public
      on public.fm_partidas
      for select
      to anon, authenticated
      using (true)
    $sql$;

    execute $sql$
      create policy fm_partidas_insert_admin
      on public.fm_partidas
      for insert
      to authenticated
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy fm_partidas_update_admin
      on public.fm_partidas
      for update
      to authenticated
      using ((select app_private.is_fm_admin()))
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy fm_partidas_delete_admin
      on public.fm_partidas
      for delete
      to authenticated
      using ((select app_private.is_fm_admin()))
    $sql$;
  end if;

  if to_regclass('public.fm_partidas_ao_vivo') is not null then
    execute $sql$
      create policy fm_partidas_ao_vivo_read_public
      on public.fm_partidas_ao_vivo
      for select
      to anon, authenticated
      using (true)
    $sql$;

    execute $sql$
      create policy fm_partidas_ao_vivo_insert_admin
      on public.fm_partidas_ao_vivo
      for insert
      to authenticated
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy fm_partidas_ao_vivo_update_admin
      on public.fm_partidas_ao_vivo
      for update
      to authenticated
      using ((select app_private.is_fm_admin()))
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy fm_partidas_ao_vivo_delete_admin
      on public.fm_partidas_ao_vivo
      for delete
      to authenticated
      using ((select app_private.is_fm_admin()))
    $sql$;
  end if;

  if to_regclass('public.fm_classificacao') is not null then
    execute $sql$
      create policy fm_classificacao_read_public
      on public.fm_classificacao
      for select
      to anon, authenticated
      using (true)
    $sql$;

    execute $sql$
      create policy fm_classificacao_insert_admin
      on public.fm_classificacao
      for insert
      to authenticated
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy fm_classificacao_update_admin
      on public.fm_classificacao
      for update
      to authenticated
      using ((select app_private.is_fm_admin()))
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy fm_classificacao_delete_admin
      on public.fm_classificacao
      for delete
      to authenticated
      using ((select app_private.is_fm_admin()))
    $sql$;
  end if;

  if to_regclass('public.fm_estatisticas_jogadores') is not null then
    execute $sql$
      create policy fm_estatisticas_jogadores_read_authenticated
      on public.fm_estatisticas_jogadores
      for select
      to authenticated
      using (true)
    $sql$;

    execute $sql$
      create policy fm_estatisticas_jogadores_insert_admin
      on public.fm_estatisticas_jogadores
      for insert
      to authenticated
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy fm_estatisticas_jogadores_update_admin
      on public.fm_estatisticas_jogadores
      for update
      to authenticated
      using ((select app_private.is_fm_admin()))
      with check ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy fm_estatisticas_jogadores_delete_admin
      on public.fm_estatisticas_jogadores
      for delete
      to authenticated
      using ((select app_private.is_fm_admin()))
    $sql$;
  end if;

  if to_regclass('public.fm_votos_partidas') is not null then
    execute $sql$
      create policy fm_votos_partidas_read_authenticated
      on public.fm_votos_partidas
      for select
      to authenticated
      using (true)
    $sql$;

    execute $sql$
      create policy fm_votos_partidas_block_direct_insert
      on public.fm_votos_partidas
      for insert
      to authenticated
      with check (false)
    $sql$;
  end if;

  if to_regclass('public.fm_sorteios_jogadores') is not null then
    execute $sql$
      create policy fm_sorteios_jogadores_read_own_or_admin
      on public.fm_sorteios_jogadores
      for select
      to authenticated
      using (
        (select app_private.is_fm_admin())
        or player_key = lower(btrim(coalesce((select app_private.get_current_player_username()), '')))
      )
    $sql$;

    execute $sql$
      create policy fm_sorteios_jogadores_block_direct_insert
      on public.fm_sorteios_jogadores
      for insert
      to authenticated
      with check (false)
    $sql$;

    execute $sql$
      create policy fm_sorteios_jogadores_block_direct_update
      on public.fm_sorteios_jogadores
      for update
      to authenticated
      using (false)
      with check (false)
    $sql$;

    execute $sql$
      create policy fm_sorteios_jogadores_block_direct_delete
      on public.fm_sorteios_jogadores
      for delete
      to authenticated
      using (false)
    $sql$;
  end if;

  if to_regclass('public.fm_auditoria_sorteios') is not null then
    execute $sql$
      create policy fm_auditoria_sorteios_read_admin
      on public.fm_auditoria_sorteios
      for select
      to authenticated
      using ((select app_private.is_fm_admin()))
    $sql$;

    execute $sql$
      create policy fm_auditoria_sorteios_block_direct_insert
      on public.fm_auditoria_sorteios
      for insert
      to authenticated
      with check (false)
    $sql$;
  end if;

  if to_regclass('public.fm_notificacoes') is not null then
    execute $sql$
      create policy fm_notificacoes_read_authenticated
      on public.fm_notificacoes
      for select
      to authenticated
      using (true)
    $sql$;

    execute $sql$
      create policy fm_notificacoes_insert_admin
      on public.fm_notificacoes
      for insert
      to authenticated
      with check ((select app_private.is_fm_admin()))
    $sql$;
  end if;

  if to_regclass('public.fm_preferencias_notificacoes') is not null then
    execute $sql$
      create policy fm_preferencias_notificacoes_read_own
      on public.fm_preferencias_notificacoes
      for select
      to authenticated
      using (username = coalesce((select app_private.get_current_player_username()), ''))
    $sql$;

    execute $sql$
      create policy fm_preferencias_notificacoes_insert_own
      on public.fm_preferencias_notificacoes
      for insert
      to authenticated
      with check (username = coalesce((select app_private.get_current_player_username()), ''))
    $sql$;

    execute $sql$
      create policy fm_preferencias_notificacoes_update_own
      on public.fm_preferencias_notificacoes
      for update
      to authenticated
      using (username = coalesce((select app_private.get_current_player_username()), ''))
      with check (username = coalesce((select app_private.get_current_player_username()), ''))
    $sql$;
  end if;
end;
$$;

-- Least-privilege grants for the Data API. RLS still controls rows.
grant usage on schema public to anon, authenticated;
grant usage on schema app_private to authenticated;
revoke usage on schema app_private from public, anon;

do $$
declare
  table_name text;
  seq_name text;
begin
  foreach table_name in array array[
    'configuracoes',
    'fm_auditoria_sorteios',
    'fm_classificacao',
    'fm_estatisticas_jogadores',
    'fm_notificacoes',
    'fm_partidas',
    'fm_partidas_ao_vivo',
    'fm_perfis',
    'fm_preferencias_notificacoes',
    'fm_sorteios_jogadores',
    'fm_votos_partidas'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    end if;
  end loop;

  if to_regclass('public.configuracoes') is not null then
    execute 'grant select on table public.configuracoes to anon, authenticated';
    execute 'grant insert, update, delete on table public.configuracoes to authenticated';
  end if;

  if to_regclass('public.fm_perfis') is not null then
    execute 'grant select, insert, update, delete on table public.fm_perfis to authenticated';
  end if;

  if to_regclass('public.fm_partidas') is not null then
    execute 'grant select on table public.fm_partidas to anon, authenticated';
    execute 'grant insert, update, delete on table public.fm_partidas to authenticated';
  end if;

  if to_regclass('public.fm_partidas_ao_vivo') is not null then
    execute 'grant select on table public.fm_partidas_ao_vivo to anon, authenticated';
    execute 'grant insert, update, delete on table public.fm_partidas_ao_vivo to authenticated';
  end if;

  if to_regclass('public.fm_classificacao') is not null then
    execute 'grant select on table public.fm_classificacao to anon, authenticated';
    execute 'grant insert, update, delete on table public.fm_classificacao to authenticated';
  end if;

  if to_regclass('public.fm_estatisticas_jogadores') is not null then
    execute 'grant select, insert, update, delete on table public.fm_estatisticas_jogadores to authenticated';
  end if;

  if to_regclass('public.fm_votos_partidas') is not null then
    execute 'grant select on table public.fm_votos_partidas to authenticated';
  end if;

  if to_regclass('public.fm_sorteios_jogadores') is not null then
    execute 'grant select on table public.fm_sorteios_jogadores to authenticated';
  end if;

  if to_regclass('public.fm_auditoria_sorteios') is not null then
    execute 'grant select on table public.fm_auditoria_sorteios to authenticated';
  end if;

  if to_regclass('public.fm_notificacoes') is not null then
    execute 'grant select, insert on table public.fm_notificacoes to authenticated';
    seq_name := pg_get_serial_sequence('public.fm_notificacoes', 'id');
    if seq_name is not null then
      execute format('grant usage, select on sequence %s to authenticated', seq_name);
    end if;
  end if;

  if to_regclass('public.fm_preferencias_notificacoes') is not null then
    execute 'grant select, insert, update on table public.fm_preferencias_notificacoes to authenticated';
  end if;
end;
$$;

-- Revoke default function exposure and grant only the RPC surface used by the app.
do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.args
    );

    if fn.schema_name = 'public'
       and fn.function_name in ('get_email_by_username', 'register_visitor') then
      execute format(
        'grant execute on function %I.%I(%s) to anon, authenticated',
        fn.schema_name,
        fn.function_name,
        fn.args
      );
    elsif fn.schema_name = 'public'
       and fn.function_name in (
         'admin_release_player_draw',
         'admin_update_match_roster',
         'fm_log_notification',
         'fm_send_notification',
         'get_open_voting_matches',
         'get_player_draw_status',
         'get_player_phone',
         'player_draw_team',
         'player_update_match',
         'player_withdraw_from_match',
         'submit_match_vote',
         'update_user_nickname'
       ) then
      execute format(
        'grant execute on function %I.%I(%s) to authenticated',
        fn.schema_name,
        fn.function_name,
        fn.args
      );
    elsif fn.schema_name = 'app_private'
       and fn.function_name in (
         'admin_release_player_draw_impl',
         'admin_update_match_roster_impl',
         'get_current_player_username',
         'get_player_draw_status_impl',
         'get_player_phone_impl',
         'has_fm_admin',
         'is_fm_admin',
         'player_draw_team_impl',
         'player_update_match_impl',
         'player_withdraw_from_match_impl'
       ) then
      execute format(
        'grant execute on function %I.%I(%s) to authenticated',
        fn.schema_name,
        fn.function_name,
        fn.args
      );
    end if;
  end loop;
end;
$$;

-- Avatar storage hardening for profile photos and the upcoming ranking.
-- Public buckets can serve object URLs without a broad SELECT/list policy.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'avatars') then
    drop policy if exists "Avatares - Controle total para usuarios autenticados" on storage.objects;
    drop policy if exists "Qualquer um pode ver avatares" on storage.objects;
    drop policy if exists avatars_owner_select on storage.objects;
    drop policy if exists avatars_owner_insert on storage.objects;
    drop policy if exists avatars_owner_update on storage.objects;
    drop policy if exists avatars_owner_delete on storage.objects;

    create policy avatars_owner_select
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'avatars'
      and name like ((select auth.uid())::text || '/%')
    );

    create policy avatars_owner_insert
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'avatars'
      and name like ((select auth.uid())::text || '/%')
    );

    create policy avatars_owner_update
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'avatars'
      and name like ((select auth.uid())::text || '/%')
    )
    with check (
      bucket_id = 'avatars'
      and name like ((select auth.uid())::text || '/%')
    );

    create policy avatars_owner_delete
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'avatars'
      and name like ((select auth.uid())::text || '/%')
    );
  end if;
end;
$$;
