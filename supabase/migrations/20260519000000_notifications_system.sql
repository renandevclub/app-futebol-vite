-- ============================================================================
-- MIGRATION: Sistema de Notificações Push (OneSignal + Supabase)
-- Data: 2026-05-19
-- Objetivo: Tabelas, preferências e triggers para notificações automáticas
-- ============================================================================

-- 1. Extensão pg_net (HTTP client para triggers chamarem APIs externas)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Tabela de logs de notificações enviadas
CREATE TABLE IF NOT EXISTS public.fm_notifications (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    match_id TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT,
    data JSONB,
    sent_by TEXT,
    onesignal_external_id TEXT,
    onesignal_notification_id TEXT,
    segment TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_notifications_type ON public.fm_notifications(type);
CREATE INDEX IF NOT EXISTS idx_fm_notifications_match_id ON public.fm_notifications(match_id);
CREATE INDEX IF NOT EXISTS idx_fm_notifications_created ON public.fm_notifications(created_at DESC);

ALTER TABLE public.fm_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications visiveis por usuarios autenticados"
    ON public.fm_notifications FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Apenas admins podem inserir notificacoes"
    ON public.fm_notifications FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.fm_profiles
            WHERE auth_id = auth.uid() AND role = 'admin'
        )
    );

-- 3. Tabela de preferências de notificação por usuário
CREATE TABLE IF NOT EXISTS public.fm_notification_prefs (
    username TEXT PRIMARY KEY REFERENCES public.fm_profiles(username) ON DELETE CASCADE,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    match_confirm BOOLEAN NOT NULL DEFAULT true,
    new_player BOOLEAN NOT NULL DEFAULT true,
    team_complete BOOLEAN NOT NULL DEFAULT true,
    draw_started BOOLEAN NOT NULL DEFAULT true,
    schedule_change BOOLEAN NOT NULL DEFAULT true,
    payment_reminder BOOLEAN NOT NULL DEFAULT true,
    match_result BOOLEAN NOT NULL DEFAULT true,
    ranking_update BOOLEAN NOT NULL DEFAULT true,
    voting_open BOOLEAN NOT NULL DEFAULT true,
    admin_notices BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fm_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios leem suas proprias prefs"
    ON public.fm_notification_prefs FOR SELECT
    USING (
        username = (
            SELECT username FROM public.fm_profiles
            WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios atualizam suas proprias prefs"
    ON public.fm_notification_prefs FOR UPDATE
    USING (
        username = (
            SELECT username FROM public.fm_profiles
            WHERE auth_id = auth.uid()
        )
    )
    WITH CHECK (
        username = (
            SELECT username FROM public.fm_profiles
            WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios inserem suas proprias prefs"
    ON public.fm_notification_prefs FOR INSERT
    WITH CHECK (
        username = (
            SELECT username FROM public.fm_profiles
            WHERE auth_id = auth.uid()
        )
    );

COMMENT ON TABLE public.fm_notifications IS 'Log de notificacoes push enviadas via OneSignal';
COMMENT ON TABLE public.fm_notification_prefs IS 'Preferencias de notificacao por usuario';

-- ============================================================================
-- 4. Função auxiliar: monta payload e loga notificação
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fm_log_notification(
    p_type TEXT,
    p_match_id TEXT DEFAULT NULL,
    p_title TEXT DEFAULT '',
    p_body TEXT DEFAULT '',
    p_url TEXT DEFAULT NULL,
    p_data JSONB DEFAULT NULL,
    p_sent_by TEXT DEFAULT 'system',
    p_segment TEXT DEFAULT 'All'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO public.fm_notifications (type, match_id, title, body, url, data, sent_by, segment, status)
    VALUES (p_type, p_match_id, p_title, p_body, p_url, p_data, p_sent_by, p_segment, 'sent')
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- ============================================================================
-- 5. TRIGGER: Partida Confirmada → notifica todos os jogadores
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_match_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_title TEXT;
    v_body TEXT;
    v_url TEXT;
    v_player_count INTEGER;
BEGIN
    IF (OLD.status IS DISTINCT FROM 'CONFIRMADA' AND NEW.status = 'CONFIRMADA') THEN
        v_player_count := jsonb_array_length(NEW.players);
        v_title := 'Partida Confirmada! ⚽';
        v_body := format(
            '%s - %s • %s às %s • %s jogadores confirmados',
            COALESCE(NEW.title, 'Futebol'),
            NEW.location,
            NEW.date,
            NEW.time,
            v_player_count
        );
        v_url := 'pages/details.html';

        PERFORM public.fm_log_notification(
            'partida_confirmada',
            NEW.id,
            v_title,
            v_body,
            v_url,
            jsonb_build_object('matchId', NEW.id, 'location', NEW.location, 'date', NEW.date, 'time', NEW.time),
            'system',
            'All'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_confirmed ON public.fm_matches;
CREATE TRIGGER trg_notify_match_confirmed
    AFTER UPDATE ON public.fm_matches
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_match_confirmed();

-- ============================================================================
-- 6. TRIGGER: Partida Encerrada → notifica resultado / votação aberta
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_match_ended()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_title TEXT;
    v_body TEXT;
    v_url TEXT;
BEGIN
    IF (OLD.status IS DISTINCT FROM 'ENCERRADA' AND NEW.status = 'ENCERRADA') THEN
        v_title := 'Partida Encerrada! 🏁';
        v_body := format(
            '%s - %s • A votação de Craque e Perna de Pau está aberta!',
            COALESCE(NEW.title, 'Futebol'),
            NEW.location
        );
        v_url := 'pages/details.html';

        PERFORM public.fm_log_notification(
            'resultado_partida',
            NEW.id,
            v_title,
            v_body,
            v_url,
            jsonb_build_object('matchId', NEW.id, 'location', NEW.location, 'votingDeadline', NEW.voting_deadline),
            'system',
            'All'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_ended ON public.fm_matches;
CREATE TRIGGER trg_notify_match_ended
    AFTER UPDATE ON public.fm_matches
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_match_ended();

-- ============================================================================
-- 7. TRIGGER: Alteração de horário/data → notifica jogadores
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_schedule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_title TEXT;
    v_body TEXT;
    v_url TEXT;
BEGIN
    IF (OLD.status IN ('CONFIRMADA', 'AGENDADA')) AND
       (OLD.date IS DISTINCT FROM NEW.date OR OLD.time IS DISTINCT FROM NEW.time OR OLD.location IS DISTINCT FROM NEW.location) THEN

        v_title := 'Alteração na Partida 📅';
        v_body := format(
            '%s - %s • Nova data/hora: %s às %s',
            COALESCE(NEW.title, 'Futebol'),
            NEW.location,
            NEW.date,
            NEW.time
        );
        v_url := 'pages/details.html';

        PERFORM public.fm_log_notification(
            'alteracao_horario',
            NEW.id,
            v_title,
            v_body,
            v_url,
            jsonb_build_object('matchId', NEW.id, 'date', NEW.date, 'time', NEW.time, 'location', NEW.location),
            'system',
            'All'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_schedule_change ON public.fm_matches;
CREATE TRIGGER trg_notify_schedule_change
    AFTER UPDATE ON public.fm_matches
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_schedule_change();

-- ============================================================================
-- 8. RPC: Enviar notificação (chamada pelo frontend ou edge function)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fm_send_notification(
    p_type TEXT,
    p_match_id TEXT DEFAULT NULL,
    p_title TEXT DEFAULT '',
    p_body TEXT DEFAULT '',
    p_url TEXT DEFAULT NULL,
    p_data JSONB DEFAULT NULL,
    p_sent_by TEXT DEFAULT 'system',
    p_external_user_ids TEXT[] DEFAULT NULL,
    p_included_segments TEXT[] DEFAULT ARRAY['All']
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_notification_id BIGINT;
    v_result JSONB;
BEGIN
    v_notification_id := public.fm_log_notification(
        p_type, p_match_id, p_title, p_body, p_url, p_data, p_sent_by,
        CASE WHEN p_external_user_ids IS NOT NULL THEN array_to_string(p_external_user_ids, ',') ELSE 'All' END
    );

    v_result := jsonb_build_object(
        'success', true,
        'notification_id', v_notification_id,
        'type', p_type
    );

    RETURN v_result;
END;
$$;
