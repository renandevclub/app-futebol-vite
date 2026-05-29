-- ============================================================================
-- MIGRATION: Reforço de Segurança RLS e Anti-Manipulação
-- Data: 2026-05-18
-- Objetivo: Fortalecer as políticas RLS e adicionar proteções adicionais
-- ============================================================================

-- ============================================================================
-- 1. POLÍTICA RLS: Proteção de leitura de perfis (fm_profiles)
-- Jogadores podem ver seus próprios dados. Admins podem ver todos.
-- ============================================================================
alter table public.fm_profiles enable row level security;

drop policy if exists "Users can read own profile" on public.fm_profiles;
create policy "Users can read own profile" on public.fm_profiles
    for select
    using (
        auth.uid() = auth_id
        or
        exists (
            select 1 from public.fm_profiles p
            where p.auth_id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Users can update own profile" on public.fm_profiles;
create policy "Users can update own profile" on public.fm_profiles
    for update
    using (auth.uid() = auth_id)
    with check (auth.uid() = auth_id);

-- ============================================================================
-- 2. POLÍTICA RLS: Proteção de estatísticas (fm_player_stats)
-- ============================================================================
alter table public.fm_player_stats enable row level security;

drop policy if exists "Anyone can read player stats" on public.fm_player_stats;
create policy "Anyone can read player stats" on public.fm_player_stats
    for select
    using (true);

drop policy if exists "Only admins can modify player stats" on public.fm_player_stats;
create policy "Only admins can modify player stats" on public.fm_player_stats
    for all
    using (
        exists (
            select 1 from public.fm_profiles
            where auth_id = auth.uid() and role = 'admin'
        )
    )
    with check (
        exists (
            select 1 from public.fm_profiles
            where auth_id = auth.uid() and role = 'admin'
        )
    );

-- ============================================================================
-- 3. POLÍTICA RLS: Proteção de logs de atividade (fm_activity_logs)
-- ============================================================================
alter table public.fm_activity_logs enable row level security;

drop policy if exists "Admins can read activity logs" on public.fm_activity_logs;
create policy "Admins can read activity logs" on public.fm_activity_logs
    for select
    using (
        exists (
            select 1 from public.fm_profiles
            where auth_id = auth.uid() and role = 'admin'
        )
    );

drop policy if exists "Authenticated users can insert own logs" on public.fm_activity_logs;
create policy "Authenticated users can insert own logs" on public.fm_activity_logs
    for insert
    with check (auth.uid() is not null);

-- ============================================================================
-- 4. POLÍTICA RLS: Reforço em fm_matches
-- Somente admins podem alterar partidas. Todos autenticados podem ler.
-- ============================================================================
alter table public.fm_matches enable row level security;

drop policy if exists "Authenticated users can read matches" on public.fm_matches;
create policy "Authenticated users can read matches" on public.fm_matches
    for select
    using (auth.uid() is not null);

drop policy if exists "Only admins can modify matches" on public.fm_matches;
create policy "Only admins can modify matches" on public.fm_matches
    for insert
    with check (
        exists (
            select 1 from public.fm_profiles
            where auth_id = auth.uid() and role = 'admin'
        )
    );

create policy "Only admins can update matches" on public.fm_matches
    for update
    using (
        exists (
            select 1 from public.fm_profiles
            where auth_id = auth.uid() and role = 'admin'
        )
    )
    with check (
        exists (
            select 1 from public.fm_profiles
            where auth_id = auth.uid() and role = 'admin'
        )
    );

create policy "Only admins can delete matches" on public.fm_matches
    for delete
    using (
        exists (
            select 1 from public.fm_profiles
            where auth_id = auth.uid() and role = 'admin'
        )
    );

-- ============================================================================
-- 5. POLÍTICA RLS: fm_player_draws (sorteios)
-- Jogadores podem ver seus próprios sorteios. Admins podem ver todos.
-- ============================================================================
alter table public.fm_player_draws enable row level security;

drop policy if exists "Users can read own draws" on public.fm_player_draws;
create policy "Users can read own draws" on public.fm_player_draws
    for select
    using (
        player_key = (
            select lower(trim(username))
            from public.fm_profiles
            where auth_id = auth.uid()
        )
        or
        exists (
            select 1 from public.fm_profiles
            where auth_id = auth.uid() and role = 'admin'
        )
    );

-- ============================================================================
-- 6. POLÍTICA RLS: fm_standings (classificação)
-- Leitura pública. Escrita restrita a admin via trigger/function.
-- ============================================================================
alter table public.fm_standings enable row level security;

drop policy if exists "Anyone can read standings" on public.fm_standings;
create policy "Anyone can read standings" on public.fm_standings
    for select
    using (true);

-- ============================================================================
-- 7. POLÍTICA RLS: settings
-- Leitura pública para links de pagamento. Escrita só admin.
-- ============================================================================
alter table public.settings enable row level security;

drop policy if exists "Anyone can read public settings" on public.settings;
create policy "Anyone can read public settings" on public.settings
    for select
    using (true);

drop policy if exists "Only admins can modify settings" on public.settings;
create policy "Only admins can modify settings" on public.settings
    for all
    using (
        exists (
            select 1 from public.fm_profiles
            where auth_id = auth.uid() and role = 'admin'
        )
    );

-- ============================================================================
-- 8. FUNÇÃO: Registrar tentativas suspeitas de manipulação
-- ============================================================================
create or replace function public.log_suspicious_activity(
    p_action text,
    p_details text default null
)
returns void
language plpgsql
security definer
as $$
begin
    insert into public.fm_activity_logs (username, action, timestamp)
    values (
        coalesce(
            (select username from public.fm_profiles where auth_id = auth.uid()),
            'unknown'
        ),
        '[SEG] ' || p_action,
        now()
    );
end;
$$;

-- ============================================================================
-- 9. TRIGGER: Auditoria de alterações nas partidas
-- ============================================================================
create or replace function public.audit_match_changes()
returns trigger
language plpgsql
security definer
as $$
declare
    v_username text;
begin
    select username into v_username
    from public.fm_profiles
    where auth_id = auth.uid();

    if TG_OP = 'INSERT' then
        insert into public.fm_activity_logs (username, action, timestamp)
        values (v_username, '[PARTIDA] Criou: ' || NEW.title, now());
    elsif TG_OP = 'UPDATE' then
        insert into public.fm_activity_logs (username, action, timestamp)
        values (v_username, '[PARTIDA] Editou: ' || NEW.title, now());
    elsif TG_OP = 'DELETE' then
        insert into public.fm_activity_logs (username, action, timestamp)
        values (v_username, '[PARTIDA] Excluiu: ' || OLD.title, now());
    end if;

    return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_audit_matches on public.fm_matches;
create trigger trg_audit_matches
    after insert or update or delete on public.fm_matches
    for each row execute function public.audit_match_changes();

-- ============================================================================
-- 10. VALIDAÇÃO: Garantir que apenas admins podem executar funções sensíveis
-- Esta função é chamada internamente pelas RPCs de admin
-- ============================================================================
create or replace function public.assert_admin()
returns boolean
language plpgsql
security definer
as $$
declare
    v_role text;
begin
    select role into v_role
    from public.fm_profiles
    where auth_id = auth.uid();

    if v_role != 'admin' then
        perform public.log_suspicious_activity(
            'TENTATIVA_ACESSO_ADMIN',
            'Usuário tentou acessar função restrita'
        );
        raise exception 'Acesso negado: apenas administradores podem executar esta ação.';
    end if;

    return true;
end;
$$;

-- ============================================================================
-- 11. ÍNDICES para performance
-- ============================================================================
create index if not exists idx_fm_profiles_auth_id on public.fm_profiles(auth_id);
create index if not exists idx_fm_profiles_role on public.fm_profiles(role);
create index if not exists idx_fm_matches_status on public.fm_matches(status);
create index if not exists idx_fm_matches_date on public.fm_matches(date);
create index if not exists idx_fm_player_draws_match_player on public.fm_player_draws(match_id, player_key);
create index if not exists idx_fm_activity_logs_timestamp on public.fm_activity_logs(timestamp desc);
