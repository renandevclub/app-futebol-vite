const DEFAULT_TEAM_1_COLOR = '#60a5fa';
const DEFAULT_TEAM_2_COLOR = '#fb7185';

function getSelectedTeam({ select, match }) {
  if (!select || select.style.display === 'none' || select.value === 'manual') {
    return null;
  }

  const teamIndex = Number.parseInt(select.value, 10);
  return match?.teams?.[teamIndex] || null;
}

export function resolveLiveScoreSelectedTeams({
  match,
  selectTime1,
  selectTime2,
  inputTime1Nome,
  inputTime2Nome,
}) {
  const selectedTeam1 = getSelectedTeam({ select: selectTime1, match });
  const selectedTeam2 = getSelectedTeam({ select: selectTime2, match });

  return {
    time1Nome: selectedTeam1?.name || inputTime1Nome?.value?.trim() || '',
    time2Nome: selectedTeam2?.name || inputTime2Nome?.value?.trim() || '',
    time1Color: selectedTeam1?.color || DEFAULT_TEAM_1_COLOR,
    time2Color: selectedTeam2?.color || DEFAULT_TEAM_2_COLOR,
    time1Id: selectedTeam1?.id || null,
    time2Id: selectedTeam2?.id || null,
  };
}

export function buildInitialLiveScoreLineup(match, { time1Id, time2Id }) {
  const lineup = { time1: [], time2: [] };
  const players = Array.isArray(match?.players) ? match.players : [];

  if (time1Id) {
    lineup.time1 = players
      .filter((player) => player.teamId === time1Id)
      .map((player) => ({
        nome: player.username || player.name || '',
        numero: player.number || '',
        posicao: player.posicao || '',
      }));
  }

  if (time2Id) {
    lineup.time2 = players
      .filter((player) => player.teamId === time2Id)
      .map((player) => ({
        nome: player.username || player.name || '',
        numero: player.number || '',
        posicao: player.posicao || '',
      }));
  }

  return lineup;
}

export function buildLiveScoreMatchPayload({ linkedMatch, selectedTeams }) {
  return {
    match_id: linkedMatch?.id || null,
    time1_nome: selectedTeams.time1Nome,
    time2_nome: selectedTeams.time2Nome,
    status: 'em-andamento',
    periodo: '1T',
    time1_gols: 0,
    time2_gols: 0,
    time1_cartoes_vermelhos: 0,
    time2_cartoes_vermelhos: 0,
    gols_registrados: { time1: [], time2: [] },
    cartoes_vermelhos_registrados: { time1: [], time2: [] },
    cartoes_amarelos_registrados: { time1: [], time2: [] },
    time1_color: selectedTeams.time1Color,
    time2_color: selectedTeams.time2Color,
    escalacao: buildInitialLiveScoreLineup(linkedMatch, selectedTeams),
    substituicoes: [],
    eventos_personalizados: [],
    observacoes: '',
    cronometro_state: { minutos: 7, segundos: 0, rodando: false },
    tempo_limite: 7,
    regra_dois_gols_desativada: false,
  };
}
