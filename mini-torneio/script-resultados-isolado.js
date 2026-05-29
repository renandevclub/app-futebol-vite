
// Sistema de Resultados e Classificação - Mini Torneio (Bolão)
// Versão Isolada para Divulgação Pública
// Integração com Supabase mantida

const supabase = window.supabaseClient;

class ResultadosManager {
    constructor() {
        this.times = [];
        this.partidas = [];
        this.config = {};
        this.isLoading = false;
        this.init();
    }

    async init() {
        this.bindUI();
        this.setupEventListeners();
        await this.loadInitialData();
        this.setupRealtimeListeners();
    }

    bindUI() {
        this.ui = {
            tabelaClassificacaoBody: document.getElementById("tabela-classificacao-body"),
            listaArtilheiros: document.getElementById("lista-artilheiros"),
            listaResultados: document.getElementById("lista-resultados"),
            tabButtons: document.querySelectorAll(".tab-button"),
            abasContainer: document.getElementById("abas-container"),
        };
    }

    setupEventListeners() {
        this.ui.tabButtons.forEach(button => {
            button.addEventListener("click", () => {
                const tabName = button.getAttribute("data-tab");
                this.mostrarAba(tabName);
                
                // Atualizar estado dos botões
                this.ui.tabButtons.forEach(btn => btn.classList.remove("active"));
                button.classList.add("active");
            });
        });
    }

    async loadInitialData() {
        try {
            this.isLoading = true;
            await this.carregarConfiguracoes();
            await this.carregarTimes();
            await this.carregarPartidas();
            this.renderAll();
        } catch (error) {
            console.error("Erro ao carregar dados iniciais:", error);
            this.mostrarErro("Erro ao carregar dados. Tente novamente mais tarde.");
        } finally {
            this.isLoading = false;
        }
    }

    async carregarConfiguracoes() {
        try {
            const { data, error } = await supabase
                .from("mt_configuracoes")
                .select("*")
                .eq("id", 1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            
            this.config = data || { premiacao: { artilheiroAtivo: false } };
        } catch (error) {
            console.error("Erro ao carregar configurações:", error);
            this.config = { premiacao: { artilheiroAtivo: false } };
        }
    }

    async carregarTimes() {
        try {
            const { data, error } = await supabase
                .from("mt_times")
                .select("id, nome_time")
                .order("nome_time", { ascending: true });

            if (error) {
                throw error;
            }

            this.times = data || [];
        } catch (error) {
            console.error("Erro ao carregar times:", error);
            this.times = [];
        }
    }

    async carregarPartidas() {
        try {
            const { data, error } = await supabase
                .from("mt_partidas")
                .select("*, time1:mt_times!time1_id(id, nome_time), time2:mt_times!time2_id(id, nome_time)")
                .eq("status", "finalizada")
                .order("created_at", { ascending: false });

            if (error) {
                throw error;
            }

            this.partidas = data || [];
        } catch (error) {
            console.error("Erro ao carregar partidas:", error);
            this.partidas = [];
        }
    }

    renderAll() {
        this.renderClassificacao();
        this.renderArtilheiros();
        this.renderResultados();
    }

    mostrarAba(abaId) {
        document.querySelectorAll(".aba-content").forEach(aba => {
            aba.classList.add("hidden");
        });
        
        const abaElement = document.getElementById(`aba-${abaId}`);
        if (abaElement) {
            abaElement.classList.remove("hidden");
        }
    }

    renderClassificacao() {
        const classificacao = this.calcularClassificacao();
        
        if (classificacao.length === 0) {
            this.ui.tabelaClassificacaoBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-8">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p class="empty-state-title">Nenhuma partida finalizada ainda</p>
                            <p>Os dados aparecerão aqui quando houver partidas.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        this.ui.tabelaClassificacaoBody.innerHTML = classificacao.map((time, index) => {
            const posicao = index + 1;
            let badgeClass = "position-other";
            if (posicao === 1) badgeClass = "position-1";
            else if (posicao === 2) badgeClass = "position-2";
            else if (posicao === 3) badgeClass = "position-3";

            const saldoClass = time.saldoGols > 0 ? 'stat-highlight' : time.saldoGols < 0 ? 'stat-negative' : '';

            return `
                <tr>
                    <td>
                        <span class="position-badge ${badgeClass}">${posicao}</span>
                    </td>
                    <td>
                        <div class="team-name-cell">
                            <span class="team-name-text">${this.escapeHtml(time.nome)}</span>
                        </div>
                    </td>
                    <td><span class="stat-highlight">${time.pontos}</span></td>
                    <td>${time.jogos}</td>
                    <td>${time.vitorias}</td>
                    <td>${time.empates}</td>
                    <td>${time.derrotas}</td>
                    <td>${time.golsFeitos}</td>
                    <td>${time.golsSofridos}</td>
                    <td><span class="${saldoClass}">${time.saldoGols > 0 ? '+' : ''}${time.saldoGols}</span></td>
                </tr>
            `;
        }).join("");
    }

    calcularClassificacao() {
        const stats = {};
        
        this.times.forEach(time => {
            stats[time.id] = {
                id: time.id,
                nome: time.nome_time,
                pontos: 0,
                jogos: 0,
                vitorias: 0,
                empates: 0,
                derrotas: 0,
                golsFeitos: 0,
                golsSofridos: 0,
                saldoGols: 0,
            };
        });

        this.partidas.forEach(partida => {
            const time1Stats = stats[partida.time1_id];
            const time2Stats = stats[partida.time2_id];

            if (!time1Stats || !time2Stats) return;

            time1Stats.jogos++;
            time2Stats.jogos++;

            time1Stats.golsFeitos += partida.time1_gols || 0;
            time1Stats.golsSofridos += partida.time2_gols || 0;
            time1Stats.saldoGols = time1Stats.golsFeitos - time1Stats.golsSofridos;

            time2Stats.golsFeitos += partida.time2_gols || 0;
            time2Stats.golsSofridos += partida.time1_gols || 0;
            time2Stats.saldoGols = time2Stats.golsFeitos - time2Stats.golsSofridos;

            if (partida.time1_gols > partida.time2_gols) {
                time1Stats.vitorias++;
                time1Stats.pontos += 3;
                time2Stats.derrotas++;
            } else if (partida.time2_gols > partida.time1_gols) {
                time2Stats.vitorias++;
                time2Stats.pontos += 3;
                time1Stats.derrotas++;
            } else {
                time1Stats.empates++;
                time2Stats.empates++;
                time1Stats.pontos += 1;
                time2Stats.pontos += 1;
            }
        });

        return Object.values(stats).sort((a, b) => {
            if (b.pontos !== a.pontos) return b.pontos - a.pontos;
            if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
            if (b.saldoGols !== a.saldoGols) return b.saldoGols - a.saldoGols;
            if (b.golsFeitos !== a.golsFeitos) return b.golsFeitos - a.golsFeitos;
            return a.nome.localeCompare(b.nome);
        });
    }

    renderArtilheiros() {
        const artilheiros = this.calcularArtilheiros();
        
        if (artilheiros.length === 0) {
            this.ui.listaArtilheiros.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p class="empty-state-title">Nenhum gol registrado ainda</p>
                    <p>Os artilheiros aparecerão aqui quando houver gols.</p>
                </div>
            `;
            return;
        }

        this.ui.listaArtilheiros.innerHTML = artilheiros.map((artilheiro, index) => {
            const posicao = index + 1;
            return `
                <div class="artilheiro-card">
                    <div class="artilheiro-rank">#${posicao}</div>
                    <div class="artilheiro-info">
                        <div class="artilheiro-name">${this.escapeHtml(artilheiro.jogador)}</div>
                        <div class="artilheiro-team">
                            <i class="fas fa-shield-alt mr-1"></i>${this.escapeHtml(artilheiro.timeNome)}
                        </div>
                    </div>
                    <div class="artilheiro-gols">
                        ${artilheiro.gols}
                        <i class="fas fa-futbol"></i>
                    </div>
                </div>
            `;
        }).join("");
    }

    calcularArtilheiros() {
        const golsPorJogador = {};

        this.partidas.forEach(partida => {
            const time1Nome = partida.time1?.nome_time || "Time 1";
            const time2Nome = partida.time2?.nome_time || "Time 2";

            if (partida.gols_registrados?.time1 && Array.isArray(partida.gols_registrados.time1)) {
                partida.gols_registrados.time1.forEach(gol => {
                    const chaveJogador = `${gol.jogador}_${time1Nome}`;
                    if (!golsPorJogador[chaveJogador]) {
                        golsPorJogador[chaveJogador] = {
                            jogador: gol.jogador,
                            gols: 0,
                            timeNome: time1Nome
                        };
                    }
                    golsPorJogador[chaveJogador].gols++;
                });
            }

            if (partida.gols_registrados?.time2 && Array.isArray(partida.gols_registrados.time2)) {
                partida.gols_registrados.time2.forEach(gol => {
                    const chaveJogador = `${gol.jogador}_${time2Nome}`;
                    if (!golsPorJogador[chaveJogador]) {
                        golsPorJogador[chaveJogador] = {
                            jogador: gol.jogador,
                            gols: 0,
                            timeNome: time2Nome
                        };
                    }
                    golsPorJogador[chaveJogador].gols++;
                });
            }
        });

        return Object.values(golsPorJogador).sort((a, b) => b.gols - a.gols);
    }

    renderResultados() {
        if (this.partidas.length === 0) {
            this.ui.listaResultados.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p class="empty-state-title">Nenhuma partida finalizada ainda</p>
                    <p>Os resultados aparecerão aqui quando houver partidas.</p>
                </div>
            `;
            return;
        }

        this.ui.listaResultados.innerHTML = this.partidas.map(partida => {
            const dataFormatada = new Date(partida.created_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const time1Nome = partida.time1?.nome_time || "Time 1";
            const time2Nome = partida.time2?.nome_time || "Time 2";
            const time1Gols = partida.time1_gols || 0;
            const time2Gols = partida.time2_gols || 0;

            let golsHTML = '<div class="resultado-gols-detalhes">';
            golsHTML += '<div class="resultado-gols-titulo">Gols Marcados:</div>';

            if (partida.gols_registrados?.time1 && Array.isArray(partida.gols_registrados.time1) && partida.gols_registrados.time1.length > 0) {
                partida.gols_registrados.time1.forEach(gol => {
                    golsHTML += `
                        <div class="resultado-gol-item">
                            <i class="fas fa-circle"></i>
                            ${this.escapeHtml(gol.jogador)} (${this.escapeHtml(time1Nome)}) - ${gol.minuto || '?'}'
                        </div>
                    `;
                });
            }

            if (partida.gols_registrados?.time2 && Array.isArray(partida.gols_registrados.time2) && partida.gols_registrados.time2.length > 0) {
                partida.gols_registrados.time2.forEach(gol => {
                    golsHTML += `
                        <div class="resultado-gol-item">
                            <i class="fas fa-circle"></i>
                            ${this.escapeHtml(gol.jogador)} (${this.escapeHtml(time2Nome)}) - ${gol.minuto || '?'}'
                        </div>
                    `;
                });
            }

            if (!partida.gols_registrados?.time1?.length && !partida.gols_registrados?.time2?.length) {
                golsHTML += '<div class="resultado-gol-item text-gray-500">Nenhum gol registrado</div>';
            }

            golsHTML += '</div>';

            return `
                <div class="resultado-card">
                    <div class="resultado-header">
                        <span class="resultado-data">
                            <i class="fas fa-calendar mr-2"></i>${dataFormatada}
                        </span>
                        <span class="resultado-status">
                            <i class="fas fa-check-circle mr-1"></i>FINALIZADA
                        </span>
                    </div>

                    <div class="resultado-placar">
                        <div class="resultado-time">
                            <div class="resultado-time-nome">${this.escapeHtml(time1Nome)}</div>
                            <div class="resultado-gols">${time1Gols}</div>
                        </div>
                        <div class="resultado-separador">×</div>
                        <div class="resultado-time">
                            <div class="resultado-time-nome">${this.escapeHtml(time2Nome)}</div>
                            <div class="resultado-gols">${time2Gols}</div>
                        </div>
                    </div>

                    ${golsHTML}
                </div>
            `;
        }).join("");
    }

    setupRealtimeListeners() {
        try {
            supabase.channel("resultados-changes")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "mt_partidas" },
                    (payload) => {
                        console.log("Mudança na tabela de partidas detectada!", payload);
                        this.loadInitialData();
                    }
                )
                .subscribe();

            supabase.channel("times-changes-for-results")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "mt_times" },
                    (payload) => {
                        console.log("Mudança na tabela de times detectada!", payload);
                        this.loadInitialData();
                    }
                )
                .subscribe();
        } catch (error) {
            console.error("Erro ao configurar listeners em tempo real:", error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    mostrarErro(mensagem) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-40';
        errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${mensagem}`;
        document.body.appendChild(errorMsg);
        setTimeout(() => errorMsg.remove(), 4000);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new ResultadosManager();
});

