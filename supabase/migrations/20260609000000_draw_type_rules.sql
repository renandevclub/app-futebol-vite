-- ============================================================================
-- MIGRATION: Separacao de Goleiro/Linha no Sorteio de Times
-- Data: 2026-06-09
-- Objetivo: Permitir que os jogadores escolham a posicao (linha ou goleiro)
--           no momento do sorteio e impor regras de capacidade por time:
--           - Maximo de 6 jogadores de linha
--           - Maximo de 1 goleiro
--           - Limite total de 7 jogadores por time (6 de linha + 1 goleiro)
-- ============================================================================

-- 1. ADICIONA COLUNA draw_type NA TABELA fm_sorteios_jogadores
alter table public.fm_sorteios_jogadores
    add column if not exists draw_type text not null default 'linha' 
    check (draw_type in ('linha', 'goleiro'));

comment on column public.fm_sorteios_jogadores.draw_type is
    'Tipo do sorteio realizado: ''linha'' para jogador de linha ou ''goleiro'' para goleiro.';

-- 2. REESCREVE A RPC PRINCIPAL DE SORTEIO COM OS PARÂMETROS ADICIONAIS
create or replace function app_private.player_draw_team_impl(
    p_match_id text,
    p_idempotency_key text default null,
    p_force_team_id text default null,
    p_draw_type text default 'linha'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_username text;
    v_player_key text;
    v_match record;
    v_existing_draw record;
    v_existing_player jsonb;
    v_teams jsonb;
    v_selected_team_id text;
    v_selected_team_name text;
    v_assignment jsonb;
    v_player_entry jsonb;
    v_updated_players jsonb;
    v_now timestamptz := now();
begin
    -- =====================================================================
    -- VALIDAÇÃO 1: Autenticação
    -- =====================================================================
    if auth.uid() is null then
        perform app_private.log_draw_event(p_match_id, null, null, 'draw_blocked_no_profile');
        raise exception 'Voce precisa estar logado para entrar em um time.';
    end if;

    -- Obtém username diretamente do banco
    v_username := app_private.get_current_player_username();
    if v_username is null or btrim(v_username) = '' then
        perform app_private.log_draw_event(p_match_id, null, null, 'draw_blocked_no_profile');
        raise exception 'Perfil de jogador nao encontrado.';
    end if;

    v_player_key := lower(btrim(v_username));

    -- Valida tipo de sorteio
    if p_draw_type not in ('linha', 'goleiro') then
        raise exception 'Tipo de sorteio invalido. Escolha "linha" ou "goleiro".';
    end if;

    -- =====================================================================
    -- VALIDAÇÃO 2: Idempotency (evita replay de requests)
    -- =====================================================================
    if p_idempotency_key is not null then
        select id, team_id, team_name, status, draw_type
        into v_existing_draw
        from public.fm_sorteios_jogadores
        where idempotency_key = p_idempotency_key 
          and fm_sorteios_jogadores.match_id = p_match_id
        limit 1;

        if found then
            perform app_private.log_draw_event(
                p_match_id, v_username, v_player_key,
                'frontend_idempotency_replay',
                jsonb_build_object(
                    'idempotency_key', p_idempotency_key,
                    'existing_draw_id', v_existing_draw.id,
                    'existing_team', v_existing_draw.team_name,
                    'draw_type', v_existing_draw.draw_type
                )
            );

            return jsonb_build_object(
                'status', case when v_existing_draw.status = 'drawn' then 'already_joined' else 'released' end,
                'assignment', jsonb_build_object(
                    'teamId', v_existing_draw.team_id,
                    'teamName', v_existing_draw.team_name,
                    'username', v_username
                ),
                'idempotent', true
            );
        end if;
    end if;

    -- =====================================================================
    -- VALIDAÇÃO 3: Partida existe + LOCK de linha para evitar race condition
    -- =====================================================================
    select *
    into v_match
    from public.fm_partidas
    where id = p_match_id
    for update;

    if not found then
        perform app_private.log_draw_event(p_match_id, v_username, v_player_key, 'draw_blocked_match_not_found');
        raise exception 'Partida nao encontrada.';
    end if;

    -- =====================================================================
    -- VALIDAÇÃO 4: Número mínimo de times (3+)
    -- =====================================================================
    if jsonb_typeof(v_match.teams) <> 'array'
        or jsonb_array_length(v_match.teams) < 3 then
        perform app_private.log_draw_event(
            p_match_id, v_username, v_player_key,
            'draw_blocked_insufficient_teams',
            jsonb_build_object('team_count', jsonb_array_length(v_match.teams))
        );
        raise exception 'O sorteio so fica disponivel com 3 ou mais times cadastrados.';
    end if;

    -- =====================================================================
    -- VALIDAÇÃO 5: Jogador JÁ tem sorteio ATIVO?
    -- =====================================================================
    select id, team_id, team_name, status, draw_type
    into v_existing_draw
    from public.fm_sorteios_jogadores
    where fm_sorteios_jogadores.match_id = p_match_id 
      and fm_sorteios_jogadores.player_key = v_player_key 
      and fm_sorteios_jogadores.status = 'drawn'
    limit 1;

    if found then
        perform app_private.log_draw_event(
            p_match_id, v_username, v_player_key,
            'draw_blocked_already_drawn',
            jsonb_build_object(
                'existing_draw_id', v_existing_draw.id,
                'existing_team', v_existing_draw.team_name,
                'existing_team_id', v_existing_draw.team_id,
                'draw_type', v_existing_draw.draw_type
            )
        );

        -- Verifica se o time ainda existe nos times da partida
        if not exists (
            select 1
            from jsonb_array_elements(v_match.teams) as team(value)
            where team.value->>'id' = v_existing_draw.team_id
        ) then
            perform app_private.log_draw_event(
                p_match_id, v_username, v_player_key,
                'draw_blocked_team_removed',
                jsonb_build_object('removed_team_id', v_existing_draw.team_id)
            );
            raise exception 'Seu time sorteado anteriormente nao esta mais cadastrado nesta partida. Procure o administrador.';
        end if;

        -- Retorna o mesmo resultado SEMPRE
        return jsonb_build_object(
            'status', 'already_joined',
            'assignment', jsonb_build_object(
                'teamId', v_existing_draw.team_id,
                'teamName', v_existing_draw.team_name,
                'username', v_username
            ),
            'draw_id', v_existing_draw.id
        );
    end if;

    -- =====================================================================
    -- SORTEIO OU ATRIBUIÇÃO DIRETA
    -- =====================================================================
    v_teams := v_match.teams;

    if p_force_team_id is not null then
        -- Atribuição direta (ex: 4o time)
        select team.value->>'id', team.value->>'name'
        into v_selected_team_id, v_selected_team_name
        from jsonb_array_elements(v_teams) as team(value)
        where team.value->>'id' = p_force_team_id 
        limit 1;
        
        if v_selected_team_id is null then
            raise exception 'Time forcado nao encontrado na partida.';
        end if;
    else
        -- SORTEIO BALANCEADO NOS 3 PRIMEIROS TIMES, COM REGRAS DE POSIÇÃO
        with team_list as (
            select 
                team.value as team_data, 
                team.value->>'id' as team_id, 
                team.value->>'name' as team_name, 
                position
            from jsonb_array_elements(v_teams) with ordinality as team(value, position)
            where coalesce(btrim(team.value->>'id'), '') <> '' 
              and coalesce(btrim(team.value->>'name'), '') <> ''
        ),
        team_counts as (
            select 
                tl.team_data, 
                tl.team_id, 
                tl.team_name, 
                tl.position, 
                coalesce(dl.linha_count, 0) as linha_count,
                coalesce(dg.goleiro_count, 0) as goleiro_count
            from team_list tl
            left join lateral (
                select count(*) as linha_count 
                from public.fm_sorteios_jogadores pd 
                where pd.match_id = p_match_id 
                  and pd.team_id = tl.team_id 
                  and pd.status = 'drawn'
                  and pd.draw_type = 'linha'
            ) dl on true
            left join lateral (
                select count(*) as goleiro_count 
                from public.fm_sorteios_jogadores pd 
                where pd.match_id = p_match_id 
                  and pd.team_id = tl.team_id 
                  and pd.status = 'drawn'
                  and pd.draw_type = 'goleiro'
            ) dg on true
        ),
        -- Filtrar apenas os 3 primeiros times e aplicar limites por posicao
        eligible_teams_all as (
            select 
                team_data, 
                team_id, 
                team_name,
                case 
                    when p_draw_type = 'linha' then linha_count
                    else goleiro_count
                end as current_count
            from team_counts
            where position <= 3
              and (
                  (p_draw_type = 'linha' and linha_count < 6)
                  or
                  (p_draw_type = 'goleiro' and goleiro_count < 1)
              )
        ),
        min_count as (
            select min(current_count) as min_val from eligible_teams_all
        ),
        eligible_teams as (
            select team_data, team_id, team_name 
            from eligible_teams_all, min_count 
            where current_count = min_count.min_val
        )
        select team_id, team_name 
        into v_selected_team_id, v_selected_team_name
        from eligible_teams 
        order by random() 
        limit 1;

        if v_selected_team_id is null then
            perform app_private.log_draw_event(
                p_match_id, v_username, v_player_key, 
                'draw_error_unexpected', 
                jsonb_build_object('reason', 'no_eligible_team_for_position', 'position', p_draw_type)
            );
            raise exception 'Nao ha vagas disponiveis para a posicao selecionada neste momento.';
        end if;
    end if;

    -- =====================================================================
    -- SALVA O SORTEIO NA TABELA (IMUTÁVEL)
    -- =====================================================================
    insert into public.fm_sorteios_jogadores (
        match_id, 
        player_username, 
        player_key, 
        team_id, 
        team_name, 
        status, 
        idempotency_key, 
        drawn_at,
        draw_type
    ) values (
        p_match_id, 
        v_username, 
        v_player_key, 
        v_selected_team_id, 
        v_selected_team_name, 
        'drawn', 
        p_idempotency_key, 
        v_now,
        p_draw_type
    )
    on conflict on constraint fm_player_draws_unique_active 
    do nothing
    returning id, team_id, team_name, draw_type into v_existing_draw;

    if v_existing_draw.id is null then
        select id, team_id, team_name, draw_type 
        into v_existing_draw 
        from public.fm_sorteios_jogadores
        where fm_sorteios_jogadores.match_id = p_match_id 
          and fm_sorteios_jogadores.player_key = v_player_key 
          and fm_sorteios_jogadores.status = 'drawn' 
        limit 1;

        if v_existing_draw.id is null then
            v_existing_draw.team_id := v_selected_team_id;
            v_existing_draw.team_name := v_selected_team_name;
            v_existing_draw.draw_type := p_draw_type;
        end if;
    end if;

    -- =====================================================================
    -- ATUALIZA O ARRAY players NO JSONB (retrocompatibilidade)
    -- =====================================================================
    select player.value 
    into v_existing_player
    from jsonb_array_elements(v_match.players) as player(value)
    where lower(btrim(player.value->>'username')) = v_player_key 
    limit 1;

    v_player_entry := jsonb_build_object(
        'username', v_username,
        'teamId', v_existing_draw.team_id,
        'teamName', v_existing_draw.team_name,
        'assignmentMode', 'draw',
        'drawType', v_existing_draw.draw_type,
        'drawnAt', to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'paid', coalesce((v_existing_player->>'paid')::boolean, false),
        'receiptSent', coalesce((v_existing_player->>'receiptSent')::boolean, false)
    );

    if v_existing_player is null then
        v_updated_players := coalesce(v_match.players, '[]'::jsonb) || v_player_entry;
    else
        select coalesce(jsonb_agg(
            case 
                when lower(btrim(player.value->>'username')) = v_player_key then v_player_entry 
                else player.value 
            end
            order by player.position
        ), '[]'::jsonb) 
        into v_updated_players
        from jsonb_array_elements(v_match.players) with ordinality as player(value, position);
    end if;

    update public.fm_partidas
    set players = v_updated_players,
        team_draws = jsonb_set(
            coalesce(team_draws, '{}'::jsonb), 
            array[v_player_key],
            jsonb_build_object(
                'teamId', v_existing_draw.team_id, 
                'teamName', v_existing_draw.team_name, 
                'username', v_username, 
                'drawnAt', to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            )
        ),
        updated_at = v_now
    where id = p_match_id;

    perform app_private.log_draw_event(
        p_match_id, v_username, v_player_key, 
        'draw_success',
        jsonb_build_object(
            'draw_id', v_existing_draw.id, 
            'team_id', v_existing_draw.team_id, 
            'team_name', v_existing_draw.team_name,
            'draw_type', v_existing_draw.draw_type
        )
    );

    v_assignment := jsonb_build_object(
        'teamId', v_existing_draw.team_id, 
        'teamName', v_existing_draw.team_name, 
        'username', v_username
    );

    return jsonb_build_object(
        'status', 'drawn', 
        'assignment', v_assignment, 
        'player', v_player_entry, 
        'draw_id', v_existing_draw.id
    );
end;
$$;

-- 3. DROP E RECRIAÇÃO DA RPC WRAPPER PÚBLICA (para mudar os parâmetros)
drop function if exists public.player_draw_team(text, text, text);
create or replace function public.player_draw_team(
    p_match_id text,
    p_idempotency_key text default null,
    p_force_team_id text default null,
    p_draw_type text default 'linha'
)
returns jsonb
language sql
security invoker
set search_path = public, app_private
as $$
    select app_private.player_draw_team_impl(p_match_id, p_idempotency_key, p_force_team_id, p_draw_type);
$$;

-- Permissões
revoke all on function public.player_draw_team(text, text, text, text) from public;
revoke all on function app_private.player_draw_team_impl(text, text, text, text) from public;
revoke execute on function public.player_draw_team(text, text, text, text) from anon;
revoke execute on function app_private.player_draw_team_impl(text, text, text, text) from anon;
grant execute on function public.player_draw_team(text, text, text, text) to authenticated;
grant execute on function app_private.player_draw_team_impl(text, text, text, text) to authenticated;


-- 4. ATUALIZA A RPC DE STATUS DE SORTEIO PARA RETORNAR O draw_type
create or replace function app_private.get_player_draw_status_impl(p_match_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
    v_username text;
    v_player_key text;
    v_draw record;
begin
    if auth.uid() is null then 
        return jsonb_build_object('authenticated', false); 
    end if;
    
    v_username := app_private.get_current_player_username();
    if v_username is null then 
        return jsonb_build_object('authenticated', false); 
    end if;
    
    v_player_key := lower(btrim(v_username));

    -- Busca o sorteio ativo
    select id, team_id, team_name, status, drawn_at, draw_type 
    into v_draw
    from public.fm_sorteios_jogadores 
    where match_id = p_match_id 
      and player_key = v_player_key 
      and status = 'drawn' 
    limit 1;

    if found then
        return jsonb_build_object(
            'authenticated', true, 
            'username', v_username, 
            'has_draw', true,
            'draw_id', v_draw.id, 
            'team_id', v_draw.team_id, 
            'team_name', v_draw.team_name, 
            'drawn_at', v_draw.drawn_at,
            'draw_type', v_draw.draw_type
        );
    end if;

    -- Verifica se já foi liberado (released)
    select id, team_id, team_name, status, draw_type 
    into v_draw 
    from public.fm_sorteios_jogadores
    where match_id = p_match_id 
      and player_key = v_player_key 
      and status = 'released' 
    order by created_at desc 
    limit 1;

    if found then
        return jsonb_build_object(
            'authenticated', true, 
            'username', v_username, 
            'has_draw', false,
            'was_released', true, 
            'last_team', v_draw.team_name,
            'draw_type', v_draw.draw_type
        );
    end if;

    return jsonb_build_object('authenticated', true, 'username', v_username, 'has_draw', false);
end;
$$;
