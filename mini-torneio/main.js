
// Sistema da Página Principal - Mini Torneio (Bolão)
// Versão adaptada para Supabase

const supabase = window.supabaseClient;

class TorneioLandingPage {
    constructor() {
        this.config = {};
        this.countdownInterval = null;
        this.init();
    }

    async init() {
        this.bindUI();
        this.setupEventListeners();
        await this.loadConfig();
        this.setupRealtimeListeners();
        this.startLiveMatchCheck();
    }

    bindUI() {
        this.ui = {
            // Alerta
            liveAlertContainer: document.getElementById("live-match-alert-menu-container"),
            // Cronômetro
            countdownContainer: document.getElementById("countdown-container"),
            countdownTitle: document.getElementById("countdown-title"),
            countdownDisplay: document.getElementById("countdown-display"),
            countdownDays: document.getElementById("countdown-days"),
            countdownHours: document.getElementById("countdown-hours"),
            countdownMinutes: document.getElementById("countdown-minutes"),
            countdownSeconds: document.getElementById("countdown-seconds"),
            countdownDateText: document.getElementById("countdown-date-text"),
            // Formulário de Interesse
            formInteresse: document.getElementById("form-interesse"),
            agradecimentoInteresse: document.getElementById("agradecimento-interesse"),
            // Seção de premiação do artilheiro
            premiacaoArtilheiroContainer: document.getElementById("premiacao-artilheiro-container"),
        };
    }

    setupEventListeners() {
        this.ui.formInteresse?.addEventListener("submit", (e) => this.submeterInteresse(e));
    }

    async loadConfig() {
        const { data, error } = await supabase
            .from("mt_configuracoes")
            .select("*")
            .eq("id", 1)
            .single();

        if (error) {
            console.error("Erro ao carregar configuração:", error);
            // Fallback para configuração padrão se houver erro
            this.config = {
                valor_inscricao: 150, aluguel_campo: 150, quantidade_times: 3, tempo_cronometro: 7,
                formato_partida: "tempo-e-gols", data_inicio_torneio: null,
                premiacao: { primeiro: 250, segundo: 50, terceiro: 0, artilheiro: 50, artilheiroAtivo: false }
            };
        } else {
            this.config = data;
        }
        this.updateUI();
        this.iniciarCronometroRegressivo();
    }

    updateUI() {
        const { valor_inscricao, aluguel_campo, quantidade_times, tempo_cronometro, formato_partida, premiacao } = this.config;
        const arrecadacaoTotal = (valor_inscricao || 0) * (quantidade_times || 0);
        const disponivelPremiacao = arrecadacaoTotal - (aluguel_campo || 0);

        document.querySelectorAll("[data-config]").forEach(el => {
            const key = el.getAttribute("data-config");
            switch (key) {
                case "valor-inscricao": el.textContent = `R$ ${(valor_inscricao || 0).toFixed(2)}`; break;
                case "aluguel-campo": el.textContent = `R$ ${(aluguel_campo || 0).toFixed(2)}`; break;
                case "quantidade-times": el.textContent = quantidade_times || 0; break;
                case "tempo-cronometro": el.textContent = tempo_cronometro || 0; break;
                case "arrecadacao-total": el.textContent = `R$ ${arrecadacaoTotal.toFixed(2)}`; break;
                case "disponivel-premiacao": el.textContent = `R$ ${disponivelPremiacao.toFixed(2)}`; break;
                case "premio-primeiro": el.textContent = `R$ ${(premiacao?.primeiro || 0).toFixed(2)}`; break;
                case "premio-segundo": el.textContent = `R$ ${(premiacao?.segundo || 0).toFixed(2)}`; break;
                case "premio-terceiro": el.textContent = `R$ ${(premiacao?.terceiro || 0).toFixed(2)}`; break;
                case "premio-artilheiro": el.textContent = `R$ ${(premiacao?.artilheiro || 0).toFixed(2)}`; break;
            }
        });

        const resumoFormato = document.getElementById("resumo-formato-partida");
        const duracaoInfo = document.getElementById("duracao-partida-info");
        if (formato_partida === "somente-tempo") {
            if(resumoFormato) resumoFormato.innerHTML = `Partidas de <span>${tempo_cronometro || 0}</span> min`;
            if(duracaoInfo) duracaoInfo.innerHTML = `<strong>Fim da partida:</strong> ${tempo_cronometro || 0} minutos.`;
        } else {
            if(resumoFormato) resumoFormato.innerHTML = `Partidas de <span>${tempo_cronometro || 0}</span> min ou 2 gols`;
            if(duracaoInfo) duracaoInfo.innerHTML = `<strong>Fim da partida:</strong> ${tempo_cronometro || 0} minutos ou 2 gols marcados.`;
        }

        if (premiacao?.artilheiroAtivo && this.ui.premiacaoArtilheiroContainer) {
            this.ui.premiacaoArtilheiroContainer.classList.remove("hidden");
            this.ui.premiacaoArtilheiroContainer.classList.add("flex");
        } else {
            this.ui.premiacaoArtilheiroContainer?.classList.remove("flex");
            this.ui.premiacaoArtilheiroContainer?.classList.add("hidden");
        }
    }

    submeterInteresse(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const nomeTime = formData.get("nome-time");
        const capitao = formData.get("capitao");
        const telefone = formData.get("telefone");
        const mensagem = formData.get("mensagem");

        if (!nomeTime || !capitao || !telefone) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        let textoWhatsApp = `*✋ Interesse em Participar do Torneio*\n\n`;
        textoWhatsApp += `*Time:* ${nomeTime}\n`;
        textoWhatsApp += `*Capitão:* ${capitao}\n`;
        textoWhatsApp += `*Telefone:* ${telefone}\n`;
        if (mensagem) {
            textoWhatsApp += `*Mensagem:* ${mensagem}\n`;
        }
        textoWhatsApp += `\nGostaria de receber mais informações sobre como participar!`;

        const whatsappUrl = `https://wa.me/5591993370456?text=${encodeURIComponent(textoWhatsApp)}`;
        window.open(whatsappUrl, "_blank");

        this.ui.agradecimentoInteresse.classList.remove("hidden");
        event.target.reset();
        setTimeout(() => {
            this.ui.agradecimentoInteresse.classList.add("hidden");
        }, 5000);
    }

    iniciarCronometroRegressivo() {
        clearInterval(this.countdownInterval);
                const dataAlvoBase = this.config.data_inicio_torneio ? new Date(this.config.data_inicio_torneio).getTime() : null;
        // A diferença de 3 horas (20:00 vs 23:00) sugere que a data/hora está sendo interpretada como UTC
        // e convertida para um fuso horário local de UTC-3. Para corrigir, adicionamos 3 horas ao timestamp.
        const TRES_HORAS_MS = 3 * 60 * 60 * 1000;
        const dataAlvo = dataAlvoBase ? dataAlvoBase + TRES_HORAS_MS : null;

        if (!dataAlvo || dataAlvo < new Date().getTime()) {
            this.ui.countdownContainer.classList.add("hidden");
            return;
        }

        this.ui.countdownContainer.classList.remove("hidden");
        this.ui.countdownDateText.textContent = new Date(dataAlvo).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

        const atualizar = () => {
            const agora = new Date().getTime();
            const diferenca = dataAlvo - agora;

            if (diferenca <= 0) {
                this.ui.countdownTitle.textContent = "🎉 O torneio começou!";
                this.ui.countdownDisplay.classList.add("hidden");
                clearInterval(this.countdownInterval);
                return;
            }

            this.ui.countdownDays.textContent = String(Math.floor(diferenca / (1000 * 60 * 60 * 24))).padStart(2, "0");
            this.ui.countdownHours.textContent = String(Math.floor((diferenca % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, "0");
            this.ui.countdownMinutes.textContent = String(Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, "0");
            this.ui.countdownSeconds.textContent = String(Math.floor((diferenca % (1000 * 60)) / 1000)).padStart(2, "0");
        };

        atualizar();
        this.countdownInterval = setInterval(atualizar, 1000);
    }

    async startLiveMatchCheck() {
        // Busca a partida atual para verificar se há alguma em andamento
        const { data, error } = await supabase
            .from("mt_partidas")
            .select("*")
            .eq("status", "em-andamento")
            .maybeSingle();

        if (error) {
            console.error("Erro ao verificar partida ao vivo:", error);
            return;
        }
        
        this.displayLiveMatchAlert(data);
    }

    displayLiveMatchAlert(partidaData) {
        const existingAlert = document.getElementById("live-match-alert");
        const cardPlacar = document.querySelector(".card-placar");

        if (partidaData && partidaData.status === "em-andamento") {
            // Exibir o botão de Placar ao Vivo na navegação rápida
            if (cardPlacar) {
                cardPlacar.classList.remove("hidden");
            }

            if (existingAlert) return; 

            const alertDiv = document.createElement("div");
            alertDiv.id = "live-match-alert";
            alertDiv.className = "bg-red-600 text-white p-3 text-center shadow-lg flex items-center justify-center gap-4 pulse-live";
            alertDiv.innerHTML = `
                <i class="fas fa-satellite-dish text-xl"></i>
                <span class="font-semibold">Partida em andamento!</span>
                <a href="index-placar-publico.html" class="bg-white text-red-600 font-bold py-1 px-3 rounded-md text-sm hover:bg-gray-200">
                    ACOMPANHAR
                </a>
            `;
            this.ui.liveAlertContainer.appendChild(alertDiv);
        } else {
            // Ocultar o botão de Placar ao Vivo na navegação rápida
            if (cardPlacar) {
                cardPlacar.classList.add("hidden");
            }

            if (existingAlert) {
                existingAlert.remove();
            }
        }
    }

    setupRealtimeListeners() {
        // Listener para configurações
        supabase.channel("config_updates")
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "mt_configuracoes", filter: "id=eq.1" },
                (payload) => {
                    console.log("Configuração atualizada em tempo real!", payload.new);
                    this.config = payload.new;
                    this.updateUI();
                    this.iniciarCronometroRegressivo();
                }
            )
            .subscribe();

        // Listener para partidas (para o alerta de partida ao vivo)
        supabase.channel("partida_updates")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "mt_partidas" },
                (payload) => {
                    console.log("Mudança na partida detectada!", payload);
                    if (payload.new && payload.new.status === "em-andamento") {
                        this.displayLiveMatchAlert(payload.new);
                    } else if (payload.old && payload.old.status === "em-andamento" && payload.new.status !== "em-andamento") {
                        // Se a partida foi finalizada ou cancelada
                        this.displayLiveMatchAlert(null); // Remove o alerta
                    } else if (!payload.new && payload.old) {
                        // Se a partida foi deletada
                        this.displayLiveMatchAlert(null); // Remove o alerta
                    }
                }
            )
            .subscribe();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new TorneioLandingPage();
});

