// ===== PLACAR AO VIVO - ADMINISTRAÇÃO =====
import { getStoredUser } from '../../stores/session-store.js';
import { createRealtimeSubscription } from '../../hooks/use-realtime-channel.js';
import { isAdminRole } from '../../shared/constants/roles.js';
import { escapeHtml } from '../../utils/sanitize.js';
import {
    buildAdminCardsListHtml,
    buildAdminCustomEventsListHtml,
    buildAdminGoalsListHtml,
    buildAdminSubstitutionsListHtml,
} from '../../modules/live-score/admin-events-render.js';
import {
    renderAdminLineupList,
    renderAdminSuggestions,
} from './admin-lineup-render.js';
import {
    renderAdminLiveScoreHeader,
    renderAdminStatusBadge,
} from './admin-live-render.js';
import {
    buildLiveScoreMatchPayload,
    resolveLiveScoreSelectedTeams,
} from '../../modules/live-score/admin-match-state.js';
import {
    buildScheduledMatchInfoHtml,
    getScheduledMatchAutocompleteNames,
    renderLiveScoreTeamSelects,
    renderScheduledMatchOptions,
} from './admin-match-picker-render.js';
import { buildLiveScoreHistoryHtml } from '../../modules/live-score/history-render.js';
import {
    buildStandingsTableHtml,
    renderStandingsCompetitionOptions,
} from '../../components/ui/standings-render.js';
import {
    createLiveScoreMatch,
    finishLiveScoreMatch,
    getActiveLiveScoreMatch,
    getCurrentLiveScoreMatch,
    getLiveScoreHistoryCompetitions,
    getLiveScoreHistoryDetails,
    getLiveScoreScheduledMatch,
    getLiveScoreScheduledMatches,
    getStandingsByMatch,
    getStandingsCompetitions,
    updateLiveScoreMatch,
} from '../../services/live-score.service.js';

// Sistema inteligente e responsivo de gerenciamento de placar ao vivo
// Com sincronização em tempo real e carregamento automático de dados

class PlacarAdmin {
    constructor() {
        this.partidaAtual = null;
        this.matchCadastrada = null;
        this.cronometroInterval = null;
        this.autocompleteCache = { time1: [], time2: [] };
        this.init();
    }

    init() {
        this.bindUI();
        this.setupEventListeners();
        this.setupAccordion();
        this.carregarDadosIniciais();
        this.setupRealtimeListeners();
    }

    getClient() {
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof window.getSupabaseClient === 'function') return window.getSupabaseClient();
        return null;
    }

    bindUI() {
        this.ui = {
            // Config e Seleção de Partida
            configSection: document.getElementById('adm-config'),
            selectMatch: document.getElementById('adm-select-match'),
            matchInfo: document.getElementById('adm-match-info'),
            selectTime1: document.getElementById('adm-time1-select'),
            selectTime2: document.getElementById('adm-time2-select'),
            inputTime1Nome: document.getElementById('adm-time1-nome'),
            inputTime2Nome: document.getElementById('adm-time2-nome'),
            btnIniciar: document.getElementById('adm-btn-iniciar'),

            // Partida ao vivo
            liveSection: document.getElementById('adm-live'),
            statusBadge: document.getElementById('adm-status'),
            cronometro: document.getElementById('adm-cronometro'),
            btnPlayPause: document.getElementById('adm-btn-play-pause'),
            btnReset: document.getElementById('adm-btn-reset'),

            // Configurações da Partida Ao Vivo
            configMinutos: document.getElementById('adm-config-minutos'),
            configSegundos: document.getElementById('adm-config-segundos'),
            btnAplicarTempo: document.getElementById('adm-btn-aplicar-tempo'),
            configTempoLimite: document.getElementById('adm-config-tempo-limite'),
            btnSalvarTempoLimite: document.getElementById('adm-btn-salvar-tempo-limite'),
            configRegraGols: document.getElementById('adm-config-regra-gols'),

            // Período
            periodoBtn1T: document.getElementById('adm-periodo-1t'),
            periodoBtn2T: document.getElementById('adm-periodo-2t'),
            periodoBtnPR: document.getElementById('adm-periodo-pr'),

            // Placar
            nomeTime1: document.getElementById('adm-nome-time1'),
            nomeTime2: document.getElementById('adm-nome-time2'),
            placarTime1: document.getElementById('adm-placar-time1'),
            placarTime2: document.getElementById('adm-placar-time2'),
            btnPlusT1: document.getElementById('adm-plus-t1'),
            btnMinusT1: document.getElementById('adm-minus-t1'),
            btnPlusT2: document.getElementById('adm-plus-t2'),
            btnMinusT2: document.getElementById('adm-minus-t2'),

            // Escalação
            escalacaoSection: document.getElementById('adm-escalacao-section'),
            escalacaoT1: document.getElementById('adm-escalacao-t1'),
            escalacaoT2: document.getElementById('adm-escalacao-t2'),
            btnAddJogadorManual: document.getElementById('adm-btn-add-jogador-manual'),

            // Gols
            inputGolT1: document.getElementById('adm-gol-jogador-t1'),
            inputGolT2: document.getElementById('adm-gol-jogador-t2'),
            suggestGolT1: document.getElementById('adm-gol-suggest-t1'),
            suggestGolT2: document.getElementById('adm-gol-suggest-t2'),
            btnGolT1: document.getElementById('adm-btn-gol-t1'),
            btnGolT2: document.getElementById('adm-btn-gol-t2'),
            listaGolsT1: document.getElementById('adm-gols-t1'),
            listaGolsT2: document.getElementById('adm-gols-t2'),

            // Cartões
            inputCartaoT1: document.getElementById('adm-cartao-jogador-t1'),
            inputCartaoT2: document.getElementById('adm-cartao-jogador-t2'),
            suggestCartaoT1: document.getElementById('adm-cartao-suggest-t1'),
            suggestCartaoT2: document.getElementById('adm-cartao-suggest-t2'),
            btnCartaoAmareloT1: document.getElementById('adm-btn-cartao-amarelo-t1'),
            btnCartaoAmarelT2: document.getElementById('adm-btn-cartao-amarelo-t2'),
            btnCartaoVermT1: document.getElementById('adm-btn-cartao-vermelho-t1'),
            btnCartaoVermT2: document.getElementById('adm-btn-cartao-vermelho-t2'),
            listaCartoesT1: document.getElementById('adm-cartoes-t1'),
            listaCartoesT2: document.getElementById('adm-cartoes-t2'),

            // Substituições
            inputSubSaiT1: document.getElementById('adm-sub-sai-t1'),
            inputSubSaiT2: document.getElementById('adm-sub-sai-t2'),
            inputSubEntraT1: document.getElementById('adm-sub-entra-t1'),
            inputSubEntraT2: document.getElementById('adm-sub-entra-t2'),
            btnSubT1: document.getElementById('adm-btn-sub-t1'),
            btnSubT2: document.getElementById('adm-btn-sub-t2'),
            listaSubstituicoes: document.getElementById('adm-substituicoes-lista'),

            // Eventos Personalizados
            inputEvento: document.getElementById('adm-evento-texto'),
            btnEvento: document.getElementById('adm-btn-evento'),
            listaEventos: document.getElementById('adm-eventos-lista'),

            // Observações
            observacoes: document.getElementById('adm-observacoes'),
            btnSalvarObs: document.getElementById('adm-btn-salvar-obs'),

            // Finalizar
            btnFinalizar: document.getElementById('adm-btn-finalizar'),

            // Histórico
            historicoLista: document.getElementById('adm-historico-lista'),
            historicoSelect: document.getElementById('adm-historico-select'),

            // Classificação (Standings)
            standingsSection: document.getElementById('adm-standings-section'),
            standingsSelect: document.getElementById('adm-standings-select'),
            standingsContainer: document.getElementById('adm-standings-container'),

            // Modal de Jogador
            modalJogador: document.getElementById('adm-modal-jogador'),
            modalNome: document.getElementById('adm-modal-jogador-nome'),
            modalTime: document.getElementById('adm-modal-jogador-time'),
            modalConfirmar: document.getElementById('adm-modal-jogador-confirmar'),
            modalClose: document.getElementById('adm-modal-close'),
        };
    }

    setupEventListeners() {
        // Seleção de partida
        if (this.ui.selectMatch) {
            this.ui.selectMatch.addEventListener('change', () => this.selecionarPartidaCadastrada());
        }

        // Toggle de input manual para times
        const handleTeamSelect = (selectEl, inputEl) => {
            if (!selectEl) return;
            if (selectEl.value === 'manual') {
                inputEl.style.display = 'block';
                inputEl.required = true;
            } else {
                inputEl.style.display = 'none';
                inputEl.required = false;
            }
        };

        if (this.ui.selectTime1) {
            this.ui.selectTime1.addEventListener('change', (e) => handleTeamSelect(e.target, this.ui.inputTime1Nome));
        }
        if (this.ui.selectTime2) {
            this.ui.selectTime2.addEventListener('change', (e) => handleTeamSelect(e.target, this.ui.inputTime2Nome));
        }

        // Iniciar partida
        this.ui.btnIniciar.addEventListener('click', () => this.iniciarPartida());

        // Período
        this.ui.periodoBtn1T?.addEventListener('click', () => this.mudarPeriodo('1T'));
        this.ui.periodoBtn2T?.addEventListener('click', () => this.mudarPeriodo('2T'));
        this.ui.periodoBtnPR?.addEventListener('click', () => this.mudarPeriodo('PR'));

        // Cronômetro
        this.ui.btnPlayPause.addEventListener('click', () => this.toggleCronometro());
        this.ui.btnReset.addEventListener('click', () => this.resetCronometro());

        // Configurações da Partida
        this.ui.btnAplicarTempo?.addEventListener('click', () => this.aplicarTempoCronometro());
        this.ui.btnSalvarTempoLimite?.addEventListener('click', () => this.salvarTempoLimite());
        this.ui.configRegraGols?.addEventListener('change', () => this.salvarRegraDoisGols());

        // Placar
        this.ui.btnPlusT1.addEventListener('click', () => this.ajustarPlacar('time1', 1));
        this.ui.btnMinusT1.addEventListener('click', () => this.ajustarPlacar('time1', -1));
        this.ui.btnPlusT2.addEventListener('click', () => this.ajustarPlacar('time2', 1));
        this.ui.btnMinusT2.addEventListener('click', () => this.ajustarPlacar('time2', -1));

        // Gols com autocomplete
        this.ui.inputGolT1?.addEventListener('input', (e) => this.mostrarSugestoes(e, 'time1', 'gol'));
        this.ui.inputGolT2?.addEventListener('input', (e) => this.mostrarSugestoes(e, 'time2', 'gol'));
        this.ui.btnGolT1.addEventListener('click', () => this.registrarGol('time1'));
        this.ui.btnGolT2.addEventListener('click', () => this.registrarGol('time2'));

        // Cartões com autocomplete
        this.ui.inputCartaoT1?.addEventListener('input', (e) => this.mostrarSugestoes(e, 'time1', 'cartao'));
        this.ui.inputCartaoT2?.addEventListener('input', (e) => this.mostrarSugestoes(e, 'time2', 'cartao'));
        this.ui.btnCartaoAmareloT1?.addEventListener('click', () => this.registrarCartao('time1', 'amarelo'));
        this.ui.btnCartaoAmarelT2?.addEventListener('click', () => this.registrarCartao('time2', 'amarelo'));
        this.ui.btnCartaoVermT1?.addEventListener('click', () => this.registrarCartao('time1', 'vermelho'));
        this.ui.btnCartaoVermT2?.addEventListener('click', () => this.registrarCartao('time2', 'vermelho'));

        // Substituições
        this.ui.inputSubSaiT1?.addEventListener('input', (e) => this.mostrarSugestoes(e, 'time1', 'sub'));
        this.ui.inputSubSaiT2?.addEventListener('input', (e) => this.mostrarSugestoes(e, 'time2', 'sub'));
        this.ui.btnSubT1?.addEventListener('click', () => this.registrarSubstituicao('time1'));
        this.ui.btnSubT2?.addEventListener('click', () => this.registrarSubstituicao('time2'));

        // Eventos Personalizados
        this.ui.btnEvento?.addEventListener('click', () => this.adicionarEvento());
        this.ui.inputEvento?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.adicionarEvento();
        });

        // Observações
        this.ui.btnSalvarObs?.addEventListener('click', () => this.salvarObservacoes());

        // Jogador Manual
        this.ui.btnAddJogadorManual?.addEventListener('click', () => this.abrirModalJogador());
        this.ui.modalClose?.addEventListener('click', () => this.fecharModalJogador());
        this.ui.modalConfirmar?.addEventListener('click', () => this.confirmarJogadorManual());

        // Finalizar
        this.ui.btnFinalizar.addEventListener('click', () => this.finalizarPartida());
    }

    setupAccordion() {
        const headers = document.querySelectorAll('.adm-accordion-header');
        headers.forEach((header) => {
            header.addEventListener('click', (e) => {
                // Se o clique foi em um botão ou link (ex: botão de adicionar jogador manual),
                // não deve abrir ou fechar o acordeão para evitar conflitos na ação
                if (e.target.closest('button') || e.target.closest('a')) {
                    return;
                }

                const item = header.closest('.adm-accordion-item');
                if (!item) return;

                item.classList.toggle('active');
            });
        });
    }

    async carregarDadosIniciais() {
        const client = this.getClient();
        if (!client) return;

        // Carrega partida em andamento
        const { data: emAndamento, error } = await getCurrentLiveScoreMatch(client);

        if (emAndamento) {
            this.partidaAtual = emAndamento;
            // Carrega dados da partida cadastrada se vinculada
            if (this.partidaAtual.match_id) {
                await this.carregarPartidaCadastrada(this.partidaAtual.match_id);
            }
            this.mostrarLive();
        } else {
            this.mostrarConfig();
            await this.carregarPartidasCadastradas();
        }

        this.carregarHistorico();
        this.carregarCompeticoesStandings();
    }

    async carregarPartidasCadastradas() {
        const client = this.getClient();
        if (!client || !this.ui.selectMatch) return;

        const { data, error } = await getLiveScoreScheduledMatches(client);

        if (error || !data) {
            renderScheduledMatchOptions(this.ui.selectMatch, []);
            return;
        }

        renderScheduledMatchOptions(this.ui.selectMatch, data);
    }
    async selecionarPartidaCadastrada() {
        const matchId = this.ui.selectMatch?.value;
        if (!matchId) {
            this.matchCadastrada = null;
            this.ui.matchInfo.style.display = 'none';
            return;
        }

        await this.carregarPartidaCadastrada(matchId);
    }

    async carregarPartidaCadastrada(matchId) {
        const client = this.getClient();
        if (!client) return;

        const { data, error } = await getLiveScoreScheduledMatch(matchId, client);

        if (error || !data) {
            this.matchCadastrada = null;
            return;
        }

        this.matchCadastrada = data;

        if (this.ui.matchInfo) {
            this.ui.matchInfo.innerHTML = buildScheduledMatchInfoHtml(data);
            this.ui.matchInfo.style.display = 'block';
        }

        if (this.ui.selectTime1 && this.ui.selectTime2) {
            renderLiveScoreTeamSelects({
                selectTime1: this.ui.selectTime1,
                selectTime2: this.ui.selectTime2,
            }, data.teams);
        }

        if (Array.isArray(data.players)) {
            this.autocompleteCache = {
                ...this.autocompleteCache,
                ...getScheduledMatchAutocompleteNames(data),
            };
        }

        if (Array.isArray(data.teams) && data.teams.length >= 2) {
            this.matchCadastrada.teamColors = {
                time1: data.teams[0]?.color || '#60a5fa',
                time2: data.teams[1]?.color || '#fb7185',
            };
        }
    }
    mostrarConfig() {
        this.ui.configSection.classList.remove('hidden');
        this.ui.liveSection.classList.add('hidden');
    }

    mostrarLive() {
        if (!this.partidaAtual) return;
        this.ui.configSection.classList.add('hidden');
        this.ui.liveSection.classList.remove('hidden');

        const p = this.partidaAtual;
        renderAdminLiveScoreHeader(this.ui, p);

        // Período
        this.atualizarPeriodo(p.periodo || '1T');

        // Render
        this.atualizarStatus();
        this.gerenciarCronometro();
        this.renderEscalacao();
        this.renderGols();
        this.renderCartoes();
        this.renderSubstituicoes();
        this.renderEventos();
        this.renderConfiguracoesPartida();
    }

    // === INICIAR PARTIDA ===
    async iniciarPartida() {
        const selectedTeams = resolveLiveScoreSelectedTeams({
            match: this.matchCadastrada,
            selectTime1: this.ui.selectTime1,
            selectTime2: this.ui.selectTime2,
            inputTime1Nome: this.ui.inputTime1Nome,
            inputTime2Nome: this.ui.inputTime2Nome,
        });

        if (!selectedTeams.time1Nome || !selectedTeams.time2Nome) {
            FMModal.warning('Preencha ou selecione os nomes dos dois times.');
            return;
        }

        const client = this.getClient();
        if (!client) return;

        // Verifica se já tem partida em andamento
        const { data: emAndamento } = await getActiveLiveScoreMatch(client);

        if (emAndamento) {
            FMModal.warning('Já existe uma partida em andamento. Finalize-a antes de iniciar outra.');
            return;
        }

        const novaPartida = buildLiveScoreMatchPayload({
            linkedMatch: this.matchCadastrada,
            selectedTeams,
        });

        const { data, error } = await createLiveScoreMatch(novaPartida, client);

        if (error) {
            console.error('Erro ao iniciar partida:', error);
            FMModal.error('Não foi possível iniciar a partida. Verifique se você está logado como administrador.');
        } else {
            this.partidaAtual = data;
            this.mostrarLive();
            FMModal.success('Partida iniciada com sucesso!');
        }
    }

    // === PERÍODO ===
    async mudarPeriodo(novoPeriodo) {
        if (!this.partidaAtual) return;
        
        this.partidaAtual.periodo = novoPeriodo;
        this.atualizarPeriodo(novoPeriodo);

        const client = this.getClient();
        if (!client) return;

        await updateLiveScoreMatch(this.partidaAtual.id, { periodo: novoPeriodo }, client);
    }

    atualizarPeriodo(periodo) {
        this.ui.periodoBtn1T?.classList.toggle('active', periodo === '1T');
        this.ui.periodoBtn2T?.classList.toggle('active', periodo === '2T');
        this.ui.periodoBtnPR?.classList.toggle('active', periodo === 'PR');
    }

    // === ESCALAÇÃO ===
    renderEscalacao() {
        if (!this.partidaAtual) return;
        const escalacao = this.partidaAtual.escalacao || { time1: [], time2: [] };

        const onGoalClick = (timeKey, jogador) => this.registrarGolClicado(timeKey, jogador);

        renderAdminLineupList(this.ui.escalacaoT1, escalacao.time1, 'time1', onGoalClick);
        renderAdminLineupList(this.ui.escalacaoT2, escalacao.time2, 'time2', onGoalClick);
    }

    abrirModalJogador() {
        if (!this.ui.modalJogador) return;
        this.ui.modalNome.value = '';
        this.ui.modalTime.value = 'time1';
        this.ui.modalJogador.classList.remove('hidden');
    }

    fecharModalJogador() {
        if (this.ui.modalJogador) {
            this.ui.modalJogador.classList.add('hidden');
        }
    }

    async confirmarJogadorManual() {
        const nome = this.ui.modalNome?.value?.trim();
        const time = this.ui.modalTime?.value;

        if (!nome) {
            FMModal.warning('Digite o nome do jogador.');
            return;
        }

        if (!this.partidaAtual) return;

        const escalacao = this.partidaAtual.escalacao || { time1: [], time2: [] };
        const timeKey = time === 'time1' ? 'time1' : 'time2';

        escalacao[timeKey].push({ nome, numero: '', posicao: '' });
        this.partidaAtual.escalacao = escalacao;

        const client = this.getClient();
        if (!client) return;

        await updateLiveScoreMatch(this.partidaAtual.id, { escalacao }, client);

        this.renderEscalacao();
        this.fecharModalJogador();
    }

    // === AUTOCOMPLETE ===
    mostrarSugestoes(event, timeKey, tipo) {
        const input = event.target;
        const valor = input.value.toLowerCase();
        let suggestEl = null;

        if (tipo === 'gol') {
            suggestEl = timeKey === 'time1' ? this.ui.suggestGolT1 : this.ui.suggestGolT2;
        } else if (tipo === 'cartao') {
            suggestEl = timeKey === 'time1' ? this.ui.suggestCartaoT1 : this.ui.suggestCartaoT2;
        }

        if (!suggestEl) return;

        if (valor.length < 1) {
            renderAdminSuggestions(suggestEl);
            return;
        }

        const sugestoes = (this.autocompleteCache[timeKey] || [])
            .filter(nome => String(nome || '').toLowerCase().includes(valor))
            .slice(0, 5);

        renderAdminSuggestions(suggestEl, sugestoes, (nome) => {
            input.value = nome;
            renderAdminSuggestions(suggestEl);
        });
    }

    // === REGISTRAR GOL ===
    async registrarGol(timeKey) {
        if (!this.partidaAtual) return;

        const input = timeKey === 'time1' ? this.ui.inputGolT1 : this.ui.inputGolT2;
        const jogador = input.value.trim();

        if (!jogador) {
            FMModal.warning('Digite o nome do jogador que marcou o gol.');
            return;
        }

        const gols = this.partidaAtual.gols_registrados || { time1: [], time2: [] };
        const { minutos, segundos } = this.partidaAtual.cronometro_state || { minutos: 0, segundos: 0 };
        const tempo = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

        gols[timeKey].push({ jogador, minuto: tempo });
        this.partidaAtual.gols_registrados = gols;

        // Incrementa placar
        await this.ajustarPlacar(timeKey, 1);

        const client = this.getClient();
        if (!client) return;

        const { error } = await updateLiveScoreMatch(this.partidaAtual.id, { gols_registrados: gols }, client);

        if (!error) {
            this.renderGols();
            input.value = '';
            if (typeof this.mostrarSugestoes === 'function') {
                const el = timeKey === 'time1' ? this.ui.suggestGolT1 : this.ui.suggestGolT2;
                renderAdminSuggestions(el);
            }
        }
    }

    // === REGISTRAR GOL CLICADO ===
    async registrarGolClicado(timeKey, jogadorNome) {
        if (!this.partidaAtual) return;
        const confirm = await FMModal.confirm({
            type: 'admin',
            title: 'Registrar Gol',
            message: `Registrar gol para <b>${escapeHtml(jogadorNome)}</b>?`,
            confirmLabel: 'Confirmar Gol',
            cancelLabel: 'Cancelar',
        });
        if (!confirm) return;

        const input = timeKey === 'time1' ? this.ui.inputGolT1 : this.ui.inputGolT2;
        if (input) input.value = jogadorNome;
        await this.registrarGol(timeKey);
    }

    // === REGISTRAR CARTÃO ===
    async registrarCartao(timeKey, tipoCarta) {
        if (!this.partidaAtual) return;

        const input = timeKey === 'time1' ? this.ui.inputCartaoT1 : this.ui.inputCartaoT2;
        const jogador = input.value.trim();

        if (!jogador) {
            FMModal.warning('Digite o nome do jogador que recebeu cartão.');
            return;
        }

        const { minutos, segundos } = this.partidaAtual.cronometro_state || { minutos: 0, segundos: 0 };
        const tempo = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

        let updateData = {};

        if (tipoCarta === 'amarelo') {
            const cartoesAmarelos = this.partidaAtual.cartoes_amarelos_registrados || { time1: [], time2: [] };
            cartoesAmarelos[timeKey].push({ jogador, minuto: tempo, tipo: 'amarelo' });
            this.partidaAtual.cartoes_amarelos_registrados = cartoesAmarelos;
            updateData.cartoes_amarelos_registrados = cartoesAmarelos;
        } else {
            const cartoesVermelhos = this.partidaAtual.cartoes_vermelhos_registrados || { time1: [], time2: [] };
            cartoesVermelhos[timeKey].push({ jogador, minuto: tempo, tipo: 'vermelho' });
            this.partidaAtual.cartoes_vermelhos_registrados = cartoesVermelhos;
            updateData.cartoes_vermelhos_registrados = cartoesVermelhos;

            const campoCartoes = timeKey === 'time1' ? 'time1_cartoes_vermelhos' : 'time2_cartoes_vermelhos';
            this.partidaAtual[campoCartoes] = (this.partidaAtual[campoCartoes] || 0) + 1;
            updateData[campoCartoes] = this.partidaAtual[campoCartoes];
        }

        const client = this.getClient();
        if (!client) return;

        const { error } = await updateLiveScoreMatch(this.partidaAtual.id, updateData, client);

        if (!error) {
            this.renderCartoes();
            input.value = '';
        }
    }

    // === SUBSTITUIÇÃO ===
    async registrarSubstituicao(timeKey) {
        if (!this.partidaAtual) return;

        const inputSai = timeKey === 'time1' ? this.ui.inputSubSaiT1 : this.ui.inputSubSaiT2;
        const inputEntra = timeKey === 'time1' ? this.ui.inputSubEntraT1 : this.ui.inputSubEntraT2;
        
        const sai = inputSai?.value?.trim();
        const entra = inputEntra?.value?.trim();

        if (!sai || !entra) {
            FMModal.warning('Preencha o jogador que sai e o que entra.');
            return;
        }

        const { minutos, segundos } = this.partidaAtual.cronometro_state || { minutos: 0, segundos: 0 };
        const tempo = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

        const substituicoes = this.partidaAtual.substituicoes || [];
        substituicoes.push({ minuto: tempo, time: timeKey, sai, entra });
        this.partidaAtual.substituicoes = substituicoes;

        const client = this.getClient();
        if (!client) return;

        await updateLiveScoreMatch(this.partidaAtual.id, { substituicoes }, client);

        this.renderSubstituicoes();
        if (inputSai) inputSai.value = '';
        if (inputEntra) inputEntra.value = '';
    }

    renderSubstituicoes() {
        if (!this.ui.listaSubstituicoes) return;
        const subs = this.partidaAtual?.substituicoes || [];

        this.ui.listaSubstituicoes.innerHTML = buildAdminSubstitutionsListHtml(subs, {
            time1: this.ui.nomeTime1.textContent,
            time2: this.ui.nomeTime2.textContent,
        });
    }
    // === EVENTOS PERSONALIZADOS ===
    async adicionarEvento() {
        if (!this.ui.inputEvento || !this.partidaAtual) return;

        const descricao = this.ui.inputEvento.value.trim();
        if (!descricao) {
            FMModal.warning('Digite uma descrição para o evento.');
            return;
        }

        const { minutos, segundos } = this.partidaAtual.cronometro_state || { minutos: 0, segundos: 0 };
        const tempo = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

        const eventos = this.partidaAtual.eventos_personalizados || [];
        eventos.push({ minuto: tempo, descricao });
        this.partidaAtual.eventos_personalizados = eventos;

        const client = this.getClient();
        if (!client) return;

        await updateLiveScoreMatch(this.partidaAtual.id, { eventos_personalizados: eventos }, client);

        this.renderEventos();
        this.ui.inputEvento.value = '';
    }

    renderEventos() {
        if (!this.ui.listaEventos) return;
        const eventos = this.partidaAtual?.eventos_personalizados || [];

        this.ui.listaEventos.innerHTML = buildAdminCustomEventsListHtml(eventos);
    }
    // === OBSERVAÇÕES ===
    async salvarObservacoes() {
        if (!this.ui.observacoes || !this.partidaAtual) return;

        const obs = this.ui.observacoes.value;
        this.partidaAtual.observacoes = obs;

        const client = this.getClient();
        if (!client) return;

        await updateLiveScoreMatch(this.partidaAtual.id, { observacoes: obs }, client);

        FMModal.success('Observações salvas!');
    }

    // === CRONÔMETRO ===
    gerenciarCronometro() {
        clearInterval(this.cronometroInterval);
        if (!this.partidaAtual?.cronometro_state) return;

        let { minutos, segundos, rodando } = this.partidaAtual.cronometro_state;
        this.exibirCronometro(minutos, segundos);

        if (rodando) {
            this.ui.btnPlayPause.innerHTML = '<i class="fas fa-pause"></i>';
            this.cronometroInterval = setInterval(async () => {
                if (segundos > 0) {
                    segundos--;
                } else if (minutos > 0) {
                    minutos--;
                    segundos = 59;
                } else {
                    clearInterval(this.cronometroInterval);
                    this.partidaAtual.cronometro_state.rodando = false;
                    await this.salvarCronometro(0, 0, false);
                    this.ui.btnPlayPause.innerHTML = '<i class="fas fa-play"></i>';
                    this.atualizarStatus();
                    
                    // Finaliza a partida quando o cronômetro chega a zero
                    const limite = this.partidaAtual.tempo_limite || 7;
                    FMModal.warning(`Fim de jogo! Tempo esgotado (${limite} minutos). A partida será finalizada agora.`);
                    await this.finalizarPartida(true); // pass true to skip confirmation
                    return;
                }
                this.partidaAtual.cronometro_state.minutos = minutos;
                this.partidaAtual.cronometro_state.segundos = segundos;
                this.exibirCronometro(minutos, segundos);

                // Salva a cada 5 segundos
                if (segundos % 5 === 0) {
                    await this.salvarCronometro(minutos, segundos, true);
                }
            }, 1000);
        } else {
            this.ui.btnPlayPause.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    async toggleCronometro() {
        if (!this.partidaAtual) return;
        const novoEstado = !this.partidaAtual.cronometro_state.rodando;
        this.partidaAtual.cronometro_state.rodando = novoEstado;
        await this.salvarCronometro(
            this.partidaAtual.cronometro_state.minutos,
            this.partidaAtual.cronometro_state.segundos,
            novoEstado
        );
        this.atualizarStatus();
        this.gerenciarCronometro();
    }

    async resetCronometro() {
        if (!this.partidaAtual) return;
        clearInterval(this.cronometroInterval);
        const limite = this.partidaAtual.tempo_limite || 7;
        this.partidaAtual.cronometro_state = { minutos: limite, segundos: 0, rodando: false };
        await this.salvarCronometro(limite, 0, false);
        this.atualizarStatus();
        this.gerenciarCronometro();
    }

    exibirCronometro(min, seg) {
        this.ui.cronometro.textContent = `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
        if (document.activeElement !== this.ui.configMinutos && document.activeElement !== this.ui.configSegundos) {
            if (this.ui.configMinutos) this.ui.configMinutos.value = min;
            if (this.ui.configSegundos) this.ui.configSegundos.value = seg;
        }
    }

    async salvarCronometro(minutos, segundos, rodando) {
        const client = this.getClient();
        if (!client || !this.partidaAtual) return;

        await updateLiveScoreMatch(this.partidaAtual.id, { cronometro_state: { minutos, segundos, rodando } }, client);
    }

    async aplicarTempoCronometro() {
        if (!this.partidaAtual) return;
        
        const minVal = parseInt(this.ui.configMinutos.value, 10);
        const segVal = parseInt(this.ui.configSegundos.value, 10);

        if (isNaN(minVal) || minVal < 0 || minVal > 99 || isNaN(segVal) || segVal < 0 || segVal > 59) {
            FMModal.warning('Insira valores validos para minutos (0-99) e segundos (0-59).');
            return;
        }

        const rodando = this.partidaAtual.cronometro_state.rodando;
        clearInterval(this.cronometroInterval);

        this.partidaAtual.cronometro_state.minutos = minVal;
        this.partidaAtual.cronometro_state.segundos = segVal;

        await this.salvarCronometro(minVal, segVal, rodando);
        this.gerenciarCronometro();
        FMModal.success(`Tempo do cronometro atualizado para ${String(minVal).padStart(2, '0')}:${String(segVal).padStart(2, '0')}!`);
    }

    async salvarTempoLimite() {
        if (!this.partidaAtual) return;

        const limite = parseInt(this.ui.configTempoLimite.value, 10);
        if (isNaN(limite) || limite < 1 || limite > 90) {
            FMModal.warning('O tempo limite da partida deve ser entre 1 e 90 minutos.');
            return;
        }

        this.partidaAtual.tempo_limite = limite;
        
        const client = this.getClient();
        if (!client) return;

        const { error } = await updateLiveScoreMatch(this.partidaAtual.id, { tempo_limite: limite }, client);
        if (error) {
            FMModal.error('Erro ao salvar o tempo limite da partida.');
        } else {
            FMModal.success(`Tempo limite da partida configurado para ${limite} minutos!`);
        }
    }

    async salvarRegraDoisGols() {
        if (!this.partidaAtual) return;

        const ativa = this.ui.configRegraGols.checked;
        const desativada = !ativa;
        this.partidaAtual.regra_dois_gols_desativada = desativada;

        const client = this.getClient();
        if (!client) return;

        const { error } = await updateLiveScoreMatch(this.partidaAtual.id, { regra_dois_gols_desativada: desativada }, client);
        if (error) {
            FMModal.error('Erro ao salvar configuracao da regra de gols.');
            this.ui.configRegraGols.checked = ativa; // Reverte o checkbox
        } else {
            const statusMsg = ativa ? 'ativada' : 'desativada';
            FMModal.success(`Regra de fim de jogo com 2 gols ${statusMsg}!`);
        }
    }

    renderConfiguracoesPartida() {
        if (!this.partidaAtual) return;
        const p = this.partidaAtual;
        
        if (this.ui.configTempoLimite) {
            this.ui.configTempoLimite.value = p.tempo_limite || 7;
        }

        if (this.ui.configRegraGols) {
            this.ui.configRegraGols.checked = !p.regra_dois_gols_desativada;
        }

        if (this.ui.configMinutos && this.ui.configSegundos && p.cronometro_state) {
            if (document.activeElement !== this.ui.configMinutos && document.activeElement !== this.ui.configSegundos) {
                this.ui.configMinutos.value = p.cronometro_state.minutos;
                this.ui.configSegundos.value = p.cronometro_state.segundos;
            }
        }
    }

    // === PLACAR ===
    async ajustarPlacar(timeKey, delta) {
        if (!this.partidaAtual) return;

        const campo = timeKey === 'time1' ? 'time1_gols' : 'time2_gols';
        const atual = this.partidaAtual[campo] || 0;
        const novo = Math.max(0, atual + delta);
        if (novo === atual) return;

        this.partidaAtual[campo] = novo;

        const client = this.getClient();
        if (!client) return;

        const { error } = await updateLiveScoreMatch(this.partidaAtual.id, { [campo]: novo }, client);

        if (!error) {
            const el = timeKey === 'time1' ? this.ui.placarTime1 : this.ui.placarTime2;
            el.textContent = novo;

            // Finaliza a partida se um dos times atingir 2 gols e a regra não estiver desativada
            if (novo >= 2 && !this.partidaAtual.regra_dois_gols_desativada) {
                const teamName = timeKey === 'time1' ? this.partidaAtual.time1_nome : this.partidaAtual.time2_nome;
                FMModal.success(`Fim de jogo! O time ${teamName} atingiu 2 gols. A partida será finalizada agora.`);
                await this.finalizarPartida(true); // skip confirmation
            }
        }
    }

    // === REGISTRAR CARTÃO ===
    // === RENDER ===
    renderGols() {
        if (!this.partidaAtual) return;
        const gols = this.partidaAtual.gols_registrados || { time1: [], time2: [] };

        this.ui.listaGolsT1.innerHTML = buildAdminGoalsListHtml(gols.time1 || []);
        this.ui.listaGolsT2.innerHTML = buildAdminGoalsListHtml(gols.time2 || []);
    }
    renderCartoes() {
        if (!this.ui.listaCartoesT1) return;

        const cartoesVermelhos = this.partidaAtual?.cartoes_vermelhos_registrados || { time1: [], time2: [] };
        const cartoesAmarelos = this.partidaAtual?.cartoes_amarelos_registrados || { time1: [], time2: [] };

        this.ui.listaCartoesT1.innerHTML = buildAdminCardsListHtml(
            cartoesVermelhos.time1 || [],
            cartoesAmarelos.time1 || [],
        );
        this.ui.listaCartoesT2.innerHTML = buildAdminCardsListHtml(
            cartoesVermelhos.time2 || [],
            cartoesAmarelos.time2 || [],
        );
    }
    atualizarStatus() {
        if (!this.partidaAtual) return;
        const rodando = this.partidaAtual.cronometro_state?.rodando;
        renderAdminStatusBadge(this.ui.statusBadge, rodando);
    }

    // === FINALIZAR ===
    async finalizarPartida(skipConfirmation = false) {
        if (!this.partidaAtual) return;
        
        if (!skipConfirmation) {
            const confirmed = await FMModal.confirm({
                type: 'admin',
                title: 'Finalizar partida',
                message: 'Tem certeza que deseja finalizar a partida?',
                confirmLabel: 'Finalizar',
                danger: true,
                priority: 80
            });
            if (!confirmed) return;
        }

        clearInterval(this.cronometroInterval);

        const client = this.getClient();
        if (!client) return;

        const { error } = await finishLiveScoreMatch(this.partidaAtual.id, client);

        if (error) {
            console.error('Erro ao finalizar:', error);
            FMModal.error('Erro ao finalizar a partida.');
        } else {
            FMModal.success('Partida finalizada com sucesso!');
            this.partidaAtual = null;
            this.mostrarConfig();
            this.carregarHistorico();
            // Recarrega a lista de competições e standings
            setTimeout(() => {
                this.carregarCompeticoesStandings();
            }, 500);
        }
    }

    // === HISTÓRICO COM DROPDOWN ===
    async carregarHistorico() {
        const client = this.getClient();
        if (!client || !this.ui.historicoSelect) return;

        const { data: competitions, error } = await getLiveScoreHistoryCompetitions(client);

        if (error || !competitions || competitions.length === 0) {
            this.ui.historicoSelect.innerHTML = '<option value="">&mdash; Nenhuma partida finalizada &mdash;</option>';
            this.ui.historicoLista.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:0.85rem">Nenhuma partida finalizada ainda.</p>';
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
                this.ui.historicoLista.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:0.85rem">Selecione uma competi&ccedil;&atilde;o para ver o hist&oacute;rico detalhado.</p>';
            }
        });
    }

    async carregarHistoricoDetalhado(competicaoId) {
        const client = this.getClient();
        if (!client || !this.ui.historicoLista) return;

        const { data: history, error } = await getLiveScoreHistoryDetails(competicaoId, client);

        if (error || !history?.matches || history.matches.length === 0) {
            this.ui.historicoLista.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:0.85rem">Nenhuma partida encontrada para esta competi&ccedil;&atilde;o.</p>';
            return;
        }

        this.renderHistoricoDetalhado(history.matches, history.title);
    }

    renderHistoricoDetalhado(partidas, competicaoTitulo) {
        if (!this.ui.historicoLista) return;

        this.ui.historicoLista.innerHTML = buildLiveScoreHistoryHtml(partidas, competicaoTitulo, {
            variant: 'admin',
        });
    }
    // === CLASSIFICAÇÃO (STANDINGS) ===
    async carregarCompeticoesStandings() {
        const client = this.getClient();
        if (!client || !this.ui.standingsSelect) return;

        // Busca todas as competições que têm classificação
        const { data: competitions, error } = await getStandingsCompetitions(client);

        if (error) {
            renderStandingsCompetitionOptions(this.ui.standingsSelect, []);
            return;
        }

        renderStandingsCompetitionOptions(this.ui.standingsSelect, competitions);

        // Listener para carregar a classificaÃ§Ã£o quando selecionar
        this.ui.standingsSelect.onchange = () => {
            const selectedId = this.ui.standingsSelect.value;
            if (selectedId) {
                this.carregarStandings(selectedId);
            } else {
                this.ui.standingsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:0.85rem">Selecione uma competição para ver a classificação.</p>';
            }
        };
    }

    async carregarStandings(matchId) {
        const client = this.getClient();
        if (!client || !this.ui.standingsContainer) return;

        const { data, error } = await getStandingsByMatch(matchId, client);

        if (error) {
            console.error('Erro ao carregar classificação:', error);
            this.ui.standingsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:0.85rem">Erro ao carregar classificação.</p>';
            return;
        }

        if (!data || data.length === 0) {
            this.ui.standingsContainer.innerHTML = `
                <div class="adm-standings-empty">
                    <i class="fas fa-trophy"></i>
                    Nenhuma classificação disponível para esta competição.
                </div>`;
            return;
        }

        this.renderStandingsTable(data);
    }

    renderStandingsTable(standings) {
        if (!this.ui.standingsContainer) return;

        this.ui.standingsContainer.innerHTML = buildStandingsTableHtml(standings, {
            wrapperClass: 'adm-standings-table-wrap',
            tableClass: 'adm-standings-table',
            positionMode: 'badge',
        });
    }


    // === REALTIME ===
    setupRealtimeListeners() {
        const client = this.getClient();
        if (!client) return;

        createRealtimeSubscription({
            client,
            channelName: 'fm-placar-admin',
            postgresChanges: [{
                event: 'UPDATE',
                table: 'fm_partidas_ao_vivo',
                handler: (payload) => {
                    if (this.partidaAtual && payload.new.id === this.partidaAtual.id) {
                        console.log('[Admin] Atualização recebida:', payload.eventType);
                        
                        // Verifica o que mudou para atualizar apenas o necessário
                        const cronometroMudou = JSON.stringify(payload.new.cronometro_state) !== JSON.stringify(this.partidaAtual.cronometro_state);
                        const placarMudou = this.partidaAtual.time1_gols !== payload.new.time1_gols || this.partidaAtual.time2_gols !== payload.new.time2_gols;
                        const golsMudaram = JSON.stringify(this.partidaAtual.gols_registrados) !== JSON.stringify(payload.new.gols_registrados);
                        const cartoesMudaram = JSON.stringify(this.partidaAtual.cartoes_vermelhos_registrados) !== JSON.stringify(payload.new.cartoes_vermelhos_registrados) ||
                                             JSON.stringify(this.partidaAtual.cartoes_amarelos_registrados) !== JSON.stringify(payload.new.cartoes_amarelos_registrados);
                        const subsMudaram = JSON.stringify(this.partidaAtual.substituicoes) !== JSON.stringify(payload.new.substituicoes);
                        const eventosMudaram = JSON.stringify(this.partidaAtual.eventos_personalizados) !== JSON.stringify(payload.new.eventos_personalizados);
                        const escalacaoMudou = JSON.stringify(this.partidaAtual.escalacao) !== JSON.stringify(payload.new.escalacao);
                        const periodoMudou = this.partidaAtual.periodo !== payload.new.periodo;
                        const configTempoLimiteMudou = this.partidaAtual.tempo_limite !== payload.new.tempo_limite;
                        const regraGolsMudou = this.partidaAtual.regra_dois_gols_desativada !== payload.new.regra_dois_gols_desativada;
                        
                        // Atualiza dados locais
                        this.partidaAtual = { ...this.partidaAtual, ...payload.new };
                        
                        // Renderiza apenas o que mudou
                        if (placarMudou) {
                            this.ui.placarTime1.textContent = this.partidaAtual.time1_gols || 0;
                            this.ui.placarTime2.textContent = this.partidaAtual.time2_gols || 0;
                        }
                        if (golsMudaram) this.renderGols();
                        if (cartoesMudaram) this.renderCartoes();
                        if (subsMudaram) this.renderSubstituicoes();
                        if (eventosMudaram) this.renderEventos();
                        if (escalacaoMudou) this.renderEscalacao();
                        if (periodoMudou) this.atualizarPeriodo(this.partidaAtual.periodo);
                        if (cronometroMudou) this.gerenciarCronometro();
                        if (configTempoLimiteMudou || regraGolsMudou || cronometroMudou) {
                            this.renderConfiguracoesPartida();
                        }
                        this.atualizarStatus();
                    }

                    // Quando a partida é finalizada
                    if (payload.new.status === 'finalizada' && this.partidaAtual && payload.new.id === this.partidaAtual.id) {
                        this.partidaAtual = null;
                        this.mostrarConfig();
                        this.carregarHistorico();
                        this.carregarCompeticoesStandings();
                        FMModal.success('Partida finalizada!');
                    }
                },
            }],
        });

        createRealtimeSubscription({
            client,
            channelName: 'fm-standings-admin',
            postgresChanges: [{
                event: '*',
                table: 'fm_classificacao',
                handler: () => {
                    // Recarrega a lista de competições e a classificação atual
                    this.carregarCompeticoesStandings();
                },
            }],
        });
    }
}

// Verifica autenticação e inicializa
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.initDB === 'function') {
        await window.initDB();
    }

    // Verifica se o usuário é admin
    const currentUser = getStoredUser();
    if (!currentUser || !isAdminRole(currentUser.role)) {
        await FMModal.admin({
            title: 'Acesso restrito',
            message: 'Apenas administradores podem acessar esta pagina.',
            priority: 90
        });
        window.location.href = '../index.html';
        return;
    }

    // Inicializa a classe e expõe globalmente para os onclicks
    window.placarAdminInstance = new PlacarAdmin();
});
