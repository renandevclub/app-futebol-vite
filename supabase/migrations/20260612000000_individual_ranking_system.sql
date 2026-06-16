-- ============================================
-- Ranking Individual - Sistema de Pontuação
-- ============================================
-- Objetivo: Agregar pontos individuais dos jogadores
-- Fórmula: Craque +10, Gol +5, Partida Jogada +2, Perna de Pau -5, Pagamento Pendente -10

-- 1. Tabela para armazenar pontuação individual agregada
CREATE TABLE IF NOT EXISTS public.fm_ranking_individual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  auth_id UUID,
  total_points INTEGER DEFAULT 0,
  
  -- Contadores de eventos
  craque_count INTEGER DEFAULT 0,           -- Votos como melhor jogador
  gols_count INTEGER DEFAULT 0,               -- Gols marcados
  partidas_jogadas INTEGER DEFAULT 0,         -- Partidas participadas
  perna_pau_count INTEGER DEFAULT 0,          -- Votos como pior jogador
  
  -- Ranking dinâmico
  rank_position INTEGER,
  rank_updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Associação com profile
  full_name VARCHAR(255),
  avatar_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ranking_points_check CHECK (total_points >= -999)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fm_ranking_individual_rank_position
  ON public.fm_ranking_individual(rank_position);
CREATE INDEX IF NOT EXISTS idx_fm_ranking_individual_username
  ON public.fm_ranking_individual(username);
CREATE INDEX IF NOT EXISTS idx_fm_ranking_individual_total_points
  ON public.fm_ranking_individual(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_fm_ranking_individual_auth_id
  ON public.fm_ranking_individual(auth_id);

-- 2. Row Level Security
ALTER TABLE public.fm_ranking_individual ENABLE ROW LEVEL SECURITY;

-- Política de leitura: Todos podem ver o ranking
DROP POLICY IF EXISTS "fm_ranking_individual_read_public" ON public.fm_ranking_individual;
CREATE POLICY "fm_ranking_individual_read_public"
  ON public.fm_ranking_individual FOR SELECT
  USING (TRUE);

-- Política de escrita: Apenas sistema (via trigger/function) pode alterar
DROP POLICY IF EXISTS "fm_ranking_individual_write_admin" ON public.fm_ranking_individual;
CREATE POLICY "fm_ranking_individual_write_admin"
  ON public.fm_ranking_individual FOR ALL
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM fm_perfis WHERE auth_id = auth.uid() AND role = 'admin'
  ));

-- 3. Função para calcular pontos individuais de uma partida
CREATE OR REPLACE FUNCTION public.fn_calculate_individual_ranking_points()
RETURNS TRIGGER AS $$
DECLARE
  v_players JSONB[];
  v_player JSONB;
  v_player_username VARCHAR(255);
  v_best_player_votes INT;
  v_worst_player_votes INT;
  v_gols_count INT;
  v_payment_penalty INT;
  v_points INT;
BEGIN
  -- Só processa quando a partida é finalizada
  IF (NEW.status = 'ENCERRADA' OR (NEW.status = 'FINALIZADA' AND OLD.status != 'FINALIZADA')) THEN
    
    -- Extrai array de jogadores da partida
    v_players := COALESCE(NEW.players, ARRAY[]::JSONB[]);
    
    -- Itera sobre cada jogador
    FOREACH v_player IN ARRAY v_players LOOP
      v_player_username := (v_player->>'username')::VARCHAR(255);
      IF v_player_username IS NOT NULL THEN
        
        -- Inicia contagem de pontos
        v_points := 0;
        
        -- +2 por partida jogada
        v_points := v_points + 2;
        
        -- Conta gols (busca em gols_registrados.time1 e .time2)
        IF NEW.gols_registrados IS NOT NULL THEN
          v_gols_count := COALESCE(
            (
              SELECT COUNT(*)::INT
              FROM jsonb_array_elements(COALESCE(NEW.gols_registrados->'time1', '[]'::JSONB)) AS gol
              WHERE (gol->>'jogador')::VARCHAR(255) ILIKE v_player_username
            ),
            0
          ) + COALESCE(
            (
              SELECT COUNT(*)::INT
              FROM jsonb_array_elements(COALESCE(NEW.gols_registrados->'time2', '[]'::JSONB)) AS gol
              WHERE (gol->>'jogador')::VARCHAR(255) ILIKE v_player_username
            ),
            0
          );
          v_points := v_points + (v_gols_count * 5);
        END IF;
        
        -- +10 por Craque (best_player vote)
        IF NEW.votes IS NOT NULL THEN
          v_best_player_votes := COALESCE(
            (
              SELECT COUNT(*)::INT
              FROM jsonb_array_elements(COALESCE(NEW.votes->'best_player', '[]'::JSONB)) AS vote
              WHERE (vote->>'votado')::VARCHAR(255) ILIKE v_player_username
            ),
            0
          );
          v_points := v_points + (v_best_player_votes * 10);
          
          -- -5 por Perna de Pau (worst_player vote)
          v_worst_player_votes := COALESCE(
            (
              SELECT COUNT(*)::INT
              FROM jsonb_array_elements(COALESCE(NEW.votes->'worst_player', '[]'::JSONB)) AS vote
              WHERE (vote->>'votado')::VARCHAR(255) ILIKE v_player_username
            ),
            0
          );
          v_points := v_points - (v_worst_player_votes * 5);
        END IF;
        
        -- -10 se pagamento pendente
        v_payment_penalty := CASE WHEN (v_player->>'paid')::BOOLEAN = FALSE THEN -10 ELSE 0 END;
        v_points := v_points + v_payment_penalty;
        
        -- Upsert na tabela de ranking
        INSERT INTO public.fm_ranking_individual (
          username,
          total_points,
          craque_count,
          gols_count,
          partidas_jogadas,
          perna_pau_count,
          rank_updated_at
        ) VALUES (
          v_player_username,
          v_points,
          v_best_player_votes,
          v_gols_count,
          1,
          v_worst_player_votes,
          NOW()
        )
        ON CONFLICT (username) DO UPDATE SET
          total_points = fm_ranking_individual.total_points + v_points,
          craque_count = fm_ranking_individual.craque_count + EXCLUDED.craque_count,
          gols_count = fm_ranking_individual.gols_count + EXCLUDED.gols_count,
          partidas_jogadas = fm_ranking_individual.partidas_jogadas + EXCLUDED.partidas_jogadas,
          perna_pau_count = fm_ranking_individual.perna_pau_count + EXCLUDED.perna_pau_count,
          rank_updated_at = NOW(),
          updated_at = NOW();
      END IF;
    END LOOP;
    
    -- Recalcula posições de ranking
    PERFORM public.fn_update_ranking_positions();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para atualizar posições de ranking
CREATE OR REPLACE FUNCTION public.fn_update_ranking_positions()
RETURNS VOID AS $$
BEGIN
  UPDATE public.fm_ranking_individual
  SET rank_position = ranked.rank_position
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY total_points DESC, username ASC) as rank_position
    FROM public.fm_ranking_individual
  ) AS ranked
  WHERE fm_ranking_individual.id = ranked.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger na fm_partidas para atualizar ranking quando partida é finalizada
DROP TRIGGER IF EXISTS trg_update_individual_ranking_on_partida_finish ON public.fm_partidas;
CREATE TRIGGER trg_update_individual_ranking_on_partida_finish
  AFTER UPDATE ON public.fm_partidas
  FOR EACH ROW
  WHEN (NEW.status = 'ENCERRADA' AND OLD.status != 'ENCERRADA')
  EXECUTE FUNCTION public.fn_calculate_individual_ranking_points();

-- 6. Trigger na fm_partidas_ao_vivo para sincronizar com fm_partidas quando finaliza
DROP TRIGGER IF EXISTS trg_update_individual_ranking_on_live_finish ON public.fm_partidas_ao_vivo;
CREATE TRIGGER trg_update_individual_ranking_on_live_finish
  AFTER UPDATE ON public.fm_partidas_ao_vivo
  FOR EACH ROW
  WHEN (NEW.status = 'ENCERRADA' AND OLD.status != 'ENCERRADA')
  EXECUTE FUNCTION public.fn_calculate_individual_ranking_points();

-- 7. Grants
GRANT SELECT ON public.fm_ranking_individual TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fm_ranking_individual TO authenticated;

-- 8. Comentários
COMMENT ON TABLE public.fm_ranking_individual IS
  'Tabela de ranking individual de jogadores - agregação de pontos';
COMMENT ON COLUMN public.fm_ranking_individual.total_points IS
  'Pontuação total: Craque +10, Gol +5, Partida +2, Perna de Pau -5, Pagamento Pendente -10';
COMMENT ON FUNCTION public.fn_calculate_individual_ranking_points() IS
  'Calcula pontos individuais quando partida é finalizada';
COMMENT ON FUNCTION public.fn_update_ranking_positions() IS
  'Atualiza posições de ranking baseado em pontuação total';
