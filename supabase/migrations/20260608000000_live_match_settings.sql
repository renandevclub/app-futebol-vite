-- ============================================================================
-- MIGRATION: Configurações da Partida no Placar Ao Vivo
-- Data: 2026-06-08
-- Objetivo: Adicionar campos de tempo limite padrão e desativação da regra
--            de fim de jogo com 2 gols na tabela de placar ao vivo.
-- ============================================================================

-- 1. Adicionar coluna tempo_limite (duração padrão do cronômetro em minutos)
alter table public.fm_partidas_ao_vivo
    add column if not exists tempo_limite integer not null default 7;

-- 2. Adicionar coluna regra_dois_gols_desativada (desativa encerramento com 2 gols)
alter table public.fm_partidas_ao_vivo
    add column if not exists regra_dois_gols_desativada boolean not null default false;

-- 3. Comentários nas colunas
comment on column public.fm_partidas_ao_vivo.tempo_limite is
    'Duração padrão do cronômetro para esta partida (em minutos). Ex: 7, 10, 15.';

comment on column public.fm_partidas_ao_vivo.regra_dois_gols_desativada is
    'Se verdadeiro, desativa o encerramento automático da partida ao atingir 2 gols.';
