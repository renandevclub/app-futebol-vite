-- ============================================
-- Mini Torneio (Bolão) - Estrutura de Tabelas
-- ============================================

-- 1. mt_configuracoes
CREATE TABLE IF NOT EXISTS public.mt_configuracoes (
    id int8 PRIMARY KEY,
    valor_inscricao numeric DEFAULT 150.00,
    aluguel_campo numeric DEFAULT 150.00,
    quantidade_times int4 DEFAULT 3,
    tempo_cronometro int4 DEFAULT 7,
    formato_partida text DEFAULT 'tempo-e-gols',
    data_inicio_torneio timestamptz,
    premiacao jsonb DEFAULT '{"primeiro": 250, "segundo": 50, "terceiro": 0, "artilheiro": 50, "artilheiroAtivo": false}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Inserir linha de configuração inicial caso não exista
INSERT INTO public.mt_configuracoes (id, valor_inscricao, aluguel_campo, quantidade_times, tempo_cronometro, formato_partida, premiacao)
VALUES (1, 150.00, 150.00, 3, 7, 'tempo-e-gols', '{"primeiro": 250, "segundo": 50, "terceiro": 0, "artilheiro": 50, "artilheiroAtivo": false}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. mt_times
CREATE TABLE IF NOT EXISTS public.mt_times (
    id bigserial PRIMARY KEY,
    nome_time text NOT NULL,
    capitao text NOT NULL,
    telefone text NOT NULL,
    jogadores text[] NOT NULL DEFAULT '{}'::text[],
    observacoes text,
    created_at timestamptz DEFAULT now()
);

-- 3. mt_partidas
CREATE TABLE IF NOT EXISTS public.mt_partidas (
    id bigserial PRIMARY KEY,
    time1_id int8 REFERENCES public.mt_times(id) ON DELETE CASCADE,
    time2_id int8 REFERENCES public.mt_times(id) ON DELETE CASCADE,
    time1_gols int4 DEFAULT 0,
    time2_gols int4 DEFAULT 0,
    status text NOT NULL DEFAULT 'em-andamento',
    cronometro_state jsonb DEFAULT '{"minutos": 7, "segundos": 0, "rodando": false}'::jsonb,
    gols_registrados jsonb DEFAULT '{"time1": [], "time2": []}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. mt_pagamento_jogadores
CREATE TABLE IF NOT EXISTS public.mt_pagamento_jogadores (
    id bigserial PRIMARY KEY,
    time_id int8 REFERENCES public.mt_times(id) ON DELETE CASCADE,
    nome_jogador text NOT NULL,
    valor numeric NOT NULL,
    data_pagamento date NOT NULL,
    status text NOT NULL DEFAULT 'pendente',
    observacoes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 5. mt_financeiro
CREATE TABLE IF NOT EXISTS public.mt_financeiro (
    id bigserial PRIMARY KEY,
    tipo text NOT NULL, -- 'receita' ou 'despesa'
    descricao text NOT NULL,
    valor numeric NOT NULL,
    data date NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Desabilitar RLS nas novas tabelas do Mini Torneio para acesso livre do frontend
ALTER TABLE public.mt_configuracoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_times DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_partidas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_pagamento_jogadores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_financeiro DISABLE ROW LEVEL SECURITY;
