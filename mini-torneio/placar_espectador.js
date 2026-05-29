// Sistema de Placar Ao Vivo - Espectador
// Lógica de visualização simplificada e sem autenticação
// Adaptação do padrão de integração Supabase

const supabase = window.supabaseClient;

class PlacarEspectador {
    constructor() {
        this.partidaAtual = null;
        this.cronometroInterval = null;
        this.init();
    }

    init() {
        this.bindUI();
        this.carregarDadosIniciais();
        this.setupRealtimeListeners();
        // Não há event listeners de controle, apenas de visualização
    }

    bindUI() {
        this.ui = {
            statusPartida: document.getElementById("status-partida"),
            cronometroDisplay: document.getElementById("cronometro"),
            nomeTime1: document.getElementById("nome-time1"),
            nomeTime2: document.getElementById("nome-time2"),
            placarTime1: document.getElementById("placar-time1"),
            placarTime2: document.getElementById("placar-time2"),
            historicoPartidasLista: document.getElementById("historico-partidas-lista"),
        };
    }

    async carregarDadosIniciais() {
        // Carrega a partida 'em-andamento'
        const { data: partidaData, error: partidaError } = await supabase
            .from("mt_partidas")
            .select("*, time1:mt_times!time1_id(nome_time), time2:mt_times!time2_id(nome_time)")
            .eq("status", "em-andamento")
            .maybeSingle();

        if (partidaError && partidaError.code !== 'PGRST116') {
            console.error("Erro ao carregar partida em andamento:", partidaError);
        }

        // Verifica se houve mudança no placar antes de atualizar
        const placarTime1Antigo = this.partidaAtual ? this.partidaAtual.time1_gols : 0;
        const placarTime2Antigo = this.partidaAtual ? this.partidaAtual.time2_gols : 0;
        
        this.partidaAtual = partidaData;
        this.atualizarInterfaceComPartida(placarTime1Antigo, placarTime2Antigo);
        this.carregarHistoricoPartidas();
    }

    async carregarHistoricoPartidas() {
        const { data, error } = await supabase
            .from("mt_partidas")
            .select("*, time1:mt_times!time1_id(nome_time), time2:mt_times!time2_id(nome_time)")
            .eq("status", "finalizada")
            .order("created_at", { ascending: false })
            .limit(5); // Limita a 5 para o histórico

        if (error) {
            this.ui.historicoPartidasLista.innerHTML = `<p class="text-red-500 text-center py-4">Erro ao carregar histórico.</p>`;
            return;
        }

        if (data.length === 0) {
            this.ui.historicoPartidasLista.innerHTML = `<p class="text-gray-500 text-center py-4 text-sm">Nenhuma partida finalizada ainda.</p>`;
            return;
        }

        this.ui.historicoPartidasLista.innerHTML = data.map(partida => {
            const time1Nome = partida.time1?.nome_time || "Time 1";
            const time2Nome = partida.time2?.nome_time || "Time 2";
            const time1Gols = partida.time1_gols || 0;
            const time2Gols = partida.time2_gols || 0;
            // Formato DD/MM
            const dataFormatada = new Date(partida.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit' });
            
// A nova estrutura de placar não requer a lógica de destaque de vencedor, pois o CSS já aplica cor aos números.
	            // Apenas definimos o placar para uso na nova estrutura.
	            const placarHtml = `${time1Gols} x ${time2Gols}`;

return `
	                <div class="historico-item">
	                    <div class="date">${dataFormatada}</div>
	                    <div class="team-name team-color-historico-1">${time1Nome}</div>
	                    <div class="score-container">
	                        <span class="score-time1">${time1Gols}</span>
	                        <span class="separator">x</span>
	                        <span class="score-time2">${time2Gols}</span>
	                    </div>
	                    <div class="team-name team-color-historico-2">${time2Nome}</div>
	                </div>
	            `;
        }).join("");
    }

    atualizarInterfaceComPartida(placarTime1Antigo = 0, placarTime2Antigo = 0) {
        if (!this.partidaAtual) {
            this.ui.statusPartida.innerHTML = `<i class="fas fa-circle mr-1 text-xs"></i> AGUARDANDO PARTIDA`;
            this.ui.statusPartida.classList.remove("live");
            this.ui.statusPartida.classList.add("waiting");
            this.ui.nomeTime1.textContent = "Time 1";
            this.ui.nomeTime2.textContent = "Time 2";
            this.ui.placarTime1.textContent = "0";
            this.ui.placarTime2.textContent = "0";
            this.ui.cronometroDisplay.textContent = "00:00";
            return;
        }

        const time1Nome = this.partidaAtual.time1?.nome_time || "Time 1";
        const time2Nome = this.partidaAtual.time2?.nome_time || "Time 2";
        const placarTime1Novo = this.partidaAtual.time1_gols || 0;
        const placarTime2Novo = this.partidaAtual.time2_gols || 0;

        this.ui.nomeTime1.textContent = time1Nome;
        this.ui.nomeTime2.textContent = time2Nome;
        this.ui.placarTime1.textContent = placarTime1Novo;
        this.ui.placarTime2.textContent = placarTime2Novo;

        this.ui.statusPartida.innerHTML = `<i class="fas fa-circle mr-1 text-xs"></i> AO VIVO`;
        this.ui.statusPartida.classList.remove("waiting");
        this.ui.statusPartida.classList.add("live");
        
        // Aplica animação de gol
        if (placarTime1Novo > placarTime1Antigo) {
            this.aplicarAnimacaoGol(this.ui.placarTime1);
        }
        if (placarTime2Novo > placarTime2Antigo) {
            this.aplicarAnimacaoGol(this.ui.placarTime2);
        }

        this.gerenciarCronometro(false); // Apenas visualiza
    }

    aplicarAnimacaoGol(elementoPlacar) {
        elementoPlacar.classList.add('gol-animation');
        setTimeout(() => {
            elementoPlacar.classList.remove('gol-animation');
        }, 500);
    }

    gerenciarCronometro(is_admin = false) {
        clearInterval(this.cronometroInterval);
        if (!this.partidaAtual || !this.partidaAtual.cronometro_state) return;

        let { minutos, segundos, rodando } = this.partidaAtual.cronometro_state;
        this.atualizarDisplayCronometro(minutos, segundos);

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
                this.atualizarDisplayCronometro(minutos, segundos);
                // Não salva no banco, pois é apenas visualização
            }, 1000);
        }
    }

    atualizarDisplayCronometro(min, seg) {
        this.ui.cronometroDisplay.textContent = `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
    }

    setupRealtimeListeners() {
        try {
            // Listener para a tabela de partidas (qualquer mudança)
            supabase.channel("placar-espectador-partidas")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "mt_partidas" },
                    (payload) => {
                        console.log("Mudança na tabela de partidas detectada! Recarregando dados...", payload);
                        this.carregarDadosIniciais();
                    }
                )
                .subscribe();

            // Listener para a tabela de times (se houver mudança de nome)
            supabase.channel("placar-espectador-times")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "mt_times" },
                    (payload) => {
                        console.log("Mudança na tabela de times detectada! Recarregando dados...", payload);
                        this.carregarDadosIniciais();
                    }
                )
                .subscribe();

        } catch (error) {
            console.error("Erro ao configurar listeners em tempo real:", error);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Verifica se o Supabase client foi carregado (do supabase-client.js)
    if (typeof supabase === 'undefined') {
        console.error("Supabase client não está definido. Verifique se supabase-client.js foi carregado corretamente.");
        return;
    }
    new PlacarEspectador();
});
