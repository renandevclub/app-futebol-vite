// ===== PLACAR AO VIVO - ESPECTADOR PÚBLICO =====
// Sincronização em tempo real com administração
// Sem autenticação - acesso público

import { createRealtimeSubscription } from '../../hooks/use-realtime-channel.js';
import { buildLiveScoreHistoryHtml } from '../../modules/live-score/history-render.js';
import {
    buildPublicCardsListHtml,
    buildPublicGoalsListHtml,
} from '../../modules/live-score/public-events-render.js';
import {
    buildStandingsTableHtml,
    renderStandingsCompetitionOptions,
} from '../../components/ui/standings-render.js';
import {
    getCurrentLiveScoreMatch,
    getLiveScoreHistoryCompetitions,
    getLiveScoreHistoryDetails,
    getStandingsByMatch,
    getStandingsCompetitions,
} from '../../services/live-score.service.js';

class PlacarEspectadorPublico {
    constructor() {
        this.partidaAtual = null;
        this.cronometroInterval = null;
        this.init();
    }

    init() {
        this.bindUI();
        this.carregarDadosIniciais();
        this.setupRealtimeListeners();
    }

    bindUI() {
        this.ui = {
            statusBadge: document.getElementById('pav-status'),
            cronometro: document.getElementById('pav-cronometro'),
            nomeTime1: document.getElementById('pav-nome-time1'),
            nomeTime2: document.getElementById('pav-nome-time2'),
            placarTime1: document.getElementById('pav-placar-time1'),
            placarTime2: document.getElementById('pav-placar-time2'),
            placarCard: document.getElementById('pav-placar-card'),
            golsTime1: document.getElementById('pav-gols-time1'),
            golsTime2: document.getElementById('pav-gols-time2'),
            cartoesTime1: document.getElementById('pav-cartoes-time1'),
            cartoesTime2: document.getElementById('pav-cartoes-time2'),
            eventsSection: document.getElementById('pav-events'),
            cartoesSection: document.getElementById('pav-cartoes-section'),
            historicoLista: document.getElementById('pav-historico-lista'),
            historicoSelect: document.getElementById('pav-historico-select'),
            noMatchMsg: document.getElementById('pav-no-match'),
            matchContent: document.getElementById('pav-match-content'),

            // Classificação (Standings)
            standingsSection: document.getElementById('pav-standings-section'),
            standingsSelect: document.getElementById('pav-standings-select'),
            standingsContainer: document.getElementById('pav-standings-container'),
        };
    }

    async carregarDadosIniciais() {
        const client = this.getClient();
        if (!client) return;

        const { data: partida, error } = await getCurrentLiveScoreMatch(client);

        if (error && error.code !== 'PGRST116') {
            console.error('Erro ao carregar partida:', error);
        }

        const placarAntigoT1 = this.partidaAtual?.time1_gols ?? 0;
        const placarAntigoT2 = this.partidaAtual?.time2_gols ?? 0;

        this.partidaAtual = partida;
        this.atualizarInterface(placarAntigoT1, placarAntigoT2);
        this.carregarHistorico();
        this.carregarCompeticoesStandings();
    }

    atualizarInterface(placarAntigoT1 = 0, placarAntigoT2 = 0) {
        if (!this.partidaAtual) {
            this.ui.noMatchMsg.style.display = 'block';
            this.ui.matchContent.style.display = 'none';
            this.ui.statusBadge.className = 'pav-status-badge waiting';
            this.ui.statusBadge.innerHTML = '<span class="pav-status-dot"></span> AGUARDANDO PARTIDA';
            this.ui.cronometro.textContent = '00:00';
            return;
        }

        this.ui.noMatchMsg.style.display = 'none';
        this.ui.matchContent.style.display = 'block';

        const p = this.partidaAtual;

        this.ui.nomeTime1.textContent = p.time1_nome || 'Time 1';
        this.ui.nomeTime2.textContent = p.time2_nome || 'Time 2';

        // Aplica estilo pill com cor de fundo nos nomes
        const cor1 = p.time1_color || '#60a5fa';
        const cor2 = p.time2_color || '#fb7185';
        this.ui.nomeTime1.style.cssText = `background:${cor1};color:#fff;padding:4px 12px;border-radius:20px;text-shadow:0 1px 2px rgba(0,0,0,0.3);font-weight:700;`;
        this.ui.nomeTime2.style.cssText = `background:${cor2};color:#fff;padding:4px 12px;border-radius:20px;text-shadow:0 1px 2px rgba(0,0,0,0.3);font-weight:700;`;

        const gols1 = p.time1_gols || 0;
        const gols2 = p.time2_gols || 0;
        this.ui.placarTime1.textContent = gols1;
        this.ui.placarTime2.textContent = gols2;

        if (p.cronometro_state?.rodando) {
            this.ui.statusBadge.className = 'pav-status-badge live';
            this.ui.statusBadge.innerHTML = '<span class="pav-status-dot"></span> AO VIVO';
        } else {
            this.ui.statusBadge.className = 'pav-status-badge waiting';
            this.ui.statusBadge.innerHTML = '<span class="pav-status-dot"></span> PAUSADO';
        }

        if (gols1 > placarAntigoT1) {
            this.animarGol(this.ui.placarTime1);
        }
        if (gols2 > placarAntigoT2) {
            this.animarGol(this.ui.placarTime2);
        }

        this.gerenciarCronometro();
        this.renderEventos();
    }

    animarGol(el) {
        el.classList.add('pav-gol-animation');
        this.ui.placarCard.classList.add('gol-flash');
        setTimeout(() => {
            el.classList.remove('pav-gol-animation');
            this.ui.placarCard.classList.remove('gol-flash');
        }, 800);
    }

    gerenciarCronometro() {
        clearInterval(this.cronometroInterval);
        if (!this.partidaAtual?.cronometro_state) return;

        let { minutos, segundos, rodando } = this.partidaAtual.cronometro_state;
        this.exibirCronometro(minutos, segundos);

        if (rodando) {
            this.cronometroInterval = setInterval(() => {
                if (segundos > 0) {
                    segundos--;
                } else if (minutos > 0) {
                    minutos--;
                    segundos = 59;
                } else {
                    clearInterval(this.cronometroInterval);
                    return;
                }
                this.exibirCronometro(minutos, segundos);
            }, 1000);
        }
    }

    exibirCronometro(min, seg) {
        this.ui.cronometro.textContent =
            `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
    }

    renderEventos() {
        if (!this.partidaAtual) return;

        const gols = this.partidaAtual.gols_registrados || { time1: [], time2: [] };
        const cartoesVermelhos = this.partidaAtual.cartoes_vermelhos_registrados || { time1: [], time2: [] };
        const cartoesAmarelos = this.partidaAtual.cartoes_amarelos_registrados || { time1: [], time2: [] };

        // Gols
        const temGols = (gols.time1?.length > 0 || gols.time2?.length > 0);
        this.ui.eventsSection.style.display = temGols ? 'block' : 'none';

        if (temGols) {
            this.ui.golsTime1.innerHTML = buildPublicGoalsListHtml(gols.time1 || []);
            this.ui.golsTime2.innerHTML = buildPublicGoalsListHtml(gols.time2 || []);
        }

        // Cartões (amarelos + vermelhos)
        const todosCartoesT1 = [
            ...(cartoesVermelhos.time1 || []).map(c => ({ ...c, tipo: 'vermelho' })),
            ...(cartoesAmarelos.time1 || []).map(c => ({ ...c, tipo: 'amarelo' }))
        ];
        const todosCartoesT2 = [
            ...(cartoesVermelhos.time2 || []).map(c => ({ ...c, tipo: 'vermelho' })),
            ...(cartoesAmarelos.time2 || []).map(c => ({ ...c, tipo: 'amarelo' }))
        ];

        const temCartoes = (todosCartoesT1.length > 0 || todosCartoesT2.length > 0);
        this.ui.cartoesSection.style.display = temCartoes ? 'block' : 'none';

        if (temCartoes) {
            this.ui.cartoesTime1.innerHTML = buildPublicCardsListHtml(
                cartoesVermelhos.time1 || [],
                cartoesAmarelos.time1 || [],
            );
            this.ui.cartoesTime2.innerHTML = buildPublicCardsListHtml(
                cartoesVermelhos.time2 || [],
                cartoesAmarelos.time2 || [],
            );
        }
    }

    // === HISTÓRICO COM DROPDOWN ===
    async carregarHistorico() {
        const client = this.getClient();
        if (!client || !this.ui.historicoSelect) return;

        const { data: competitions, error } = await getLiveScoreHistoryCompetitions(client);

        if (error || !competitions || competitions.length === 0) {
            this.ui.historicoSelect.innerHTML = '<option value="">&mdash; Nenhuma partida finalizada &mdash;</option>';
            this.ui.historicoLista.innerHTML = '<p class="pav-empty-message">Nenhuma partida finalizada ainda.</p>';
            return;
        }

        this.ui.historicoSelect.innerHTML = '<option value="">&mdash; Escolha uma competi&ccedil;&atilde;o &mdash;</option>';
        competitions.forEach((competition) => {
            const option = document.createElement('option');
            option.value = competition.id;
            option.textContent = competition.label;
            this.ui.historicoSelect.appendChild(option);
        });

        this.ui.historicoSelect.addEventListener('change', () => {
            const selectedId = this.ui.historicoSelect.value;
            if (selectedId) {
                this.carregarHistoricoDetalhado(selectedId);
            } else {
                this.ui.historicoLista.innerHTML = '<p class="pav-empty-message">Selecione uma competi&ccedil;&atilde;o para ver o hist&oacute;rico detalhado.</p>';
            }
        });
    }

    async carregarHistoricoDetalhado(competicaoId) {
        const client = this.getClient();
        if (!client || !this.ui.historicoLista) return;

        const { data: history, error } = await getLiveScoreHistoryDetails(competicaoId, client);

        if (error || !history?.matches || history.matches.length === 0) {
            this.ui.historicoLista.innerHTML = '<p class="pav-empty-message">Nenhuma partida encontrada.</p>';
            return;
        }

        this.renderHistoricoDetalhado(history.matches, history.title);
    }

    renderHistoricoDetalhado(partidas, competicaoTitulo) {
        if (!this.ui.historicoLista) return;

        this.ui.historicoLista.innerHTML = buildLiveScoreHistoryHtml(partidas, competicaoTitulo, {
            variant: 'public',
        });
    }
    // === CLASSIFICAÇÃO (STANDINGS) ===
    async carregarCompeticoesStandings() {
        const client = this.getClient();
        if (!client || !this.ui.standingsSelect) return;

        const { data: competitions, error } = await getStandingsCompetitions(client);

        if (error) {
            renderStandingsCompetitionOptions(this.ui.standingsSelect, [], {
                emptyLabel: '\u2014 Nenhuma competi\u00e7\u00e3o \u2014',
            });
            return;
        }

        renderStandingsCompetitionOptions(this.ui.standingsSelect, competitions, {
            emptyLabel: '\u2014 Nenhuma competi\u00e7\u00e3o \u2014',
        });

        this.ui.standingsSelect.onchange = () => {
            const selectedId = this.ui.standingsSelect.value;
            if (selectedId) {
                this.carregarStandings(selectedId);
            } else {
                this.ui.standingsContainer.innerHTML = '<p class="pav-empty-message">Selecione uma competição para ver a classificação.</p>';
            }
        };
    }

    async carregarStandings(matchId) {
        const client = this.getClient();
        if (!client || !this.ui.standingsContainer) return;

        const { data, error } = await getStandingsByMatch(matchId, client);

        if (error || !data || data.length === 0) {
            this.ui.standingsContainer.innerHTML = '<p class="pav-empty-message">Nenhuma classificação disponível.</p>';
            return;
        }

        this.renderStandingsTable(data);
    }

    renderStandingsTable(standings) {
        if (!this.ui.standingsContainer) return;

        this.ui.standingsContainer.innerHTML = buildStandingsTableHtml(standings, {
            wrapperClass: 'pav-standings-table-wrap',
            tableClass: 'pav-standings-table',
            positionMode: 'plain',
        });
    }


    setupRealtimeListeners() {
        const client = this.getClient();
        if (!client) return;

        createRealtimeSubscription({
            client,
            channelName: 'fm-placar-publico',
            postgresChanges: [
                {
                    event: 'UPDATE',
                    table: 'fm_partidas_ao_vivo',
                    handler: (payload) => {
                        console.log('[Placar Público] Atualização recebida:', payload.eventType);

                        if (!this.partidaAtual) {
                            // Se não tinha partida, recarrega
                            this.carregarDadosIniciais();
                            return;
                        }

                        // Se é a partida sendo visualizada, sincroniza
                        if (payload.new.id === this.partidaAtual.id) {
                            const placarMudou = this.partidaAtual.time1_gols !== payload.new.time1_gols ||
                                              this.partidaAtual.time2_gols !== payload.new.time2_gols;

                            this.partidaAtual = payload.new;

                            // Renderiza a interface com animação de gol se placar mudou
                            this.atualizarInterface(
                                payload.old?.time1_gols ?? 0,
                                payload.old?.time2_gols ?? 0
                            );
                        } else if (payload.new.status === 'finalizada' && this.partidaAtual.status === 'em-andamento') {
                            // Partida acabou, recarrega para pegar nova partida se houver
                            this.carregarDadosIniciais();
                        }
                    },
                },
                {
                    event: 'INSERT',
                    table: 'fm_partidas_ao_vivo',
                    handler: (payload) => {
                        // Nova partida iniciada
                        if (!this.partidaAtual && payload.new.status === 'em-andamento') {
                            this.carregarDadosIniciais();
                        }
                    },
                },
            ],
        });

        // Canal para standings (atualiza em tempo real)
        createRealtimeSubscription({
            client,
            channelName: 'fm-standings-publico',
            postgresChanges: [{
                event: '*',
                table: 'fm_classificacao',
                handler: () => {
                    this.carregarCompeticoesStandings();
                },
            }],
        });
    }

    getClient() {
        if (typeof window !== 'undefined' && window.supabaseClient) {
            return window.supabaseClient;
        }
        if (typeof window !== 'undefined' && window.supabase?.createClient) {
            // Fallback: cria cliente com as credenciais do database.js
            return null;
        }
        return null;
    }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.initDB === 'function') {
        await window.initDB();
    }
    window.placarEspectador = new PlacarEspectadorPublico();
});
