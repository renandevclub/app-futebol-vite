// Sistema de Controle de Pagamento de Jogadores - Mini Torneio (Bolão)
// Permite que capitães registrem pagamentos dos jogadores

const supabase = window.supabaseClient;

class PagamentoJogadoresManager {
    constructor() {
        this.timesComJogadores = [];
        this.timeAtualSelecionado = null;
        this.jogadoresComPagamento = [];
        this.init();
    }

    async init() {
        this.bindUI();
        this.setupEventListeners();
        await this.carregarTimesComJogadores();
        this.setupRealtimeListeners();
    }

    bindUI() {
        this.ui = {
            // Seletor de time
            selectTime: document.getElementById('select-time-pagamento'),
            containerJogadores: document.getElementById('container-jogadores-pagamento'),
            resumoPagamentos: document.getElementById('resumo-pagamentos'),
            msgSelecione: document.getElementById('msg-selecione-time'),
            
            // Resumo de pagamentos
            totalJogadores: document.getElementById('total-jogadores'),
            jogadoresPagos: document.getElementById('jogadores-pagos'),
            percentualPagamento: document.getElementById('percentual-pagamento'),
            totalArrecadado: document.getElementById('total-arrecadado'),
            jogadoresPendentes: document.getElementById('jogadores-pendentes'),
            
            // Modal
            modalPagamento: document.getElementById('modal-pagamento-jogador'),
            formPagamento: document.getElementById('form-pagamento-jogador'),
            pagamentoNomeJogador: document.getElementById('pagamento-nome-jogador'),
            pagamentoValor: document.getElementById('pagamento-valor'),
            pagamentoData: document.getElementById('pagamento-data'),
            pagamentoStatus: document.getElementById('pagamento-status'),
            pagamentoObservacoes: document.getElementById('pagamento-observacoes'),
            btnFecharModalPagamento: document.getElementById('btn-fechar-modal-pagamento'),
            btnCancelarPagamento: document.getElementById('btn-cancelar-pagamento'),
        };

        // Definir data atual como padrão
        if (this.ui.pagamentoData) {
            this.ui.pagamentoData.value = new Date().toISOString().split('T')[0];
        }
    }

    setupEventListeners() {
        this.ui.selectTime?.addEventListener('change', (e) => this.selecionarTime(e.target.value));
        this.ui.formPagamento?.addEventListener('submit', (e) => this.salvarPagamentoJogador(e));
        this.ui.btnFecharModalPagamento?.addEventListener('click', () => this.fecharModalPagamento());
        this.ui.btnCancelarPagamento?.addEventListener('click', () => this.fecharModalPagamento());
        
        this.ui.modalPagamento?.addEventListener('click', (e) => {
            if (e.target === this.ui.modalPagamento) this.fecharModalPagamento();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.ui.modalPagamento?.classList.contains('active')) {
                this.fecharModalPagamento();
            }
        });
    }

    async carregarTimesComJogadores() {
        try {
            const { data: times, error } = await supabase
                .from('mt_times')
                .select('*')
                .order('nome_time', { ascending: true });

            if (error) throw error;

            this.timesComJogadores = times || [];
            console.log('Times carregados:', this.timesComJogadores);
            this.preencherSelectTimes();
        } catch (error) {
            console.error('Erro ao carregar times:', error);
            this.showToast('Erro ao carregar times', 'error');
        }
    }

    preencherSelectTimes() {
        if (!this.ui.selectTime) return;

        this.ui.selectTime.innerHTML = '<option value="">-- Selecione um time --</option>';
        this.timesComJogadores.forEach(time => {
            const option = document.createElement('option');
            option.value = time.id;
            const qtdJogadores = (time.jogadores && Array.isArray(time.jogadores)) ? time.jogadores.length : 0;
            option.textContent = `${time.nome_time} (${qtdJogadores} jogadores)`;
            this.ui.selectTime.appendChild(option);
        });
    }

    async selecionarTime(timeId) {
        if (!timeId) {
            this.ui.containerJogadores.innerHTML = '';
            if (this.ui.resumoPagamentos) this.ui.resumoPagamentos.classList.add('hidden');
            if (this.ui.msgSelecione) this.ui.msgSelecione.classList.remove('hidden');
            return;
        }

        // Converter timeId para número se necessário
        const timeIdNumerico = parseInt(timeId, 10);
        
        // Procurar o time
        this.timeAtualSelecionado = this.timesComJogadores.find(t => {
            return t.id == timeIdNumerico || t.id == timeId || String(t.id) === String(timeId);
        });

        console.log('Time selecionado:', this.timeAtualSelecionado);

        if (!this.timeAtualSelecionado) {
            this.showToast('Time não encontrado', 'error');
            return;
        }

        // Mostrar resumo
        if (this.ui.resumoPagamentos) this.ui.resumoPagamentos.classList.remove('hidden');
        if (this.ui.msgSelecione) this.ui.msgSelecione.classList.add('hidden');

        await this.carregarPagamentosJogadores(timeIdNumerico);
        this.renderizarJogadoresComPagamento();
    }

    async carregarPagamentosJogadores(timeId) {
        try {
            const { data: pagamentos, error } = await supabase
                .from('mt_pagamento_jogadores')
                .select('*')
                .eq('time_id', timeId)
                .order('data_pagamento', { ascending: false });

            if (error) throw error;

            this.jogadoresComPagamento = pagamentos || [];
            console.log('Pagamentos carregados:', this.jogadoresComPagamento);
        } catch (error) {
            console.error('Erro ao carregar pagamentos:', error);
            this.jogadoresComPagamento = [];
        }
    }

    renderizarJogadoresComPagamento() {
        if (!this.timeAtualSelecionado) {
            console.warn('Time não selecionado');
            return;
        }

        const jogadores = (this.timeAtualSelecionado.jogadores && Array.isArray(this.timeAtualSelecionado.jogadores)) 
            ? this.timeAtualSelecionado.jogadores 
            : [];

        console.log('Jogadores a renderizar:', jogadores);
        
        if (jogadores.length === 0) {
            this.ui.containerJogadores.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-inbox text-3xl mb-2 block opacity-50"></i>
                    <p>Este time não possui jogadores cadastrados</p>
                </div>
            `;
            return;
        }

        // Calcular resumo
        const jogadoresPagos = jogadores.filter(j => this.verificarJogadorPago(j)).length;
        const jogadoresPendentes = jogadores.length - jogadoresPagos;
        const percentual = jogadores.length > 0 ? Math.round((jogadoresPagos / jogadores.length) * 100) : 0;
        const totalArrecadado = this.calcularTotalArrecadado();

        // Atualizar elementos do resumo
        if (this.ui.totalJogadores) this.ui.totalJogadores.textContent = jogadores.length;
        if (this.ui.jogadoresPagos) this.ui.jogadoresPagos.textContent = jogadoresPagos;
        if (this.ui.percentualPagamento) this.ui.percentualPagamento.textContent = percentual;
        if (this.ui.totalArrecadado) this.ui.totalArrecadado.textContent = this.formatarValor(totalArrecadado);
        if (this.ui.jogadoresPendentes) this.ui.jogadoresPendentes.textContent = jogadoresPendentes;

        // Renderizar jogadores
        this.ui.containerJogadores.innerHTML = jogadores.map((jogador, index) => {
            const pagamento = this.obterPagamentoJogador(jogador);
            const pago = pagamento && pagamento.status === 'pago';

            return `
                <div class="jogador-card bg-white rounded-lg p-4 border-l-4 ${pago ? 'border-green-500' : 'border-gray-300'} card-shadow">
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="font-semibold text-gray-800">${this.escapeHtml(jogador)}</span>
                                ${pago ? '<span class="badge-pago"><i class="fas fa-check-circle mr-1"></i>Pago</span>' : '<span class="badge-pendente"><i class="fas fa-clock mr-1"></i>Pendente</span>'}
                            </div>
                            ${pagamento ? `
                                <div class="text-sm text-gray-600 space-y-1">
                                    <p><strong>Valor:</strong> R$ ${this.formatarValor(pagamento.valor)}</p>
                                    <p><strong>Data:</strong> ${this.formatarData(pagamento.data_pagamento)}</p>
                                    ${pagamento.observacoes ? `<p><strong>Obs:</strong> ${this.escapeHtml(pagamento.observacoes)}</p>` : ''}
                                </div>
                            ` : ''}
                        </div>
                        <button class="btn-editar-pagamento px-3 py-2 rounded-lg transition-all" 
                                onclick="pagamentoManager.abrirModalPagamento('${this.escapeHtml(jogador)}', ${this.timeAtualSelecionado.id})">
                            <i class="fas fa-edit"></i> ${pago ? 'Editar' : 'Registrar'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    verificarJogadorPago(nomeJogador) {
        return this.jogadoresComPagamento.some(p => p.nome_jogador === nomeJogador && p.status === 'pago');
    }

    obterPagamentoJogador(nomeJogador) {
        return this.jogadoresComPagamento.find(p => p.nome_jogador === nomeJogador);
    }

    calcularTotalArrecadado() {
        return this.jogadoresComPagamento
            .filter(p => p.status === 'pago')
            .reduce((sum, p) => sum + (p.valor || 0), 0);
    }

    abrirModalPagamento(nomeJogador, timeId) {
        const pagamentoExistente = this.obterPagamentoJogador(nomeJogador);

        this.ui.pagamentoNomeJogador.textContent = this.escapeHtml(nomeJogador);
        this.ui.pagamentoNomeJogador.dataset.timeId = timeId;
        this.ui.pagamentoNomeJogador.dataset.nomeJogador = nomeJogador;

        if (pagamentoExistente) {
            this.ui.pagamentoValor.value = pagamentoExistente.valor;
            this.ui.pagamentoData.value = pagamentoExistente.data_pagamento;
            this.ui.pagamentoStatus.value = pagamentoExistente.status;
            this.ui.pagamentoObservacoes.value = pagamentoExistente.observacoes || '';
        } else {
            this.ui.pagamentoValor.value = '';
            this.ui.pagamentoData.value = new Date().toISOString().split('T')[0];
            this.ui.pagamentoStatus.value = 'pendente';
            this.ui.pagamentoObservacoes.value = '';
        }

        this.ui.modalPagamento.classList.add('active');
    }

    async salvarPagamentoJogador(event) {
        event.preventDefault();

        const timeId = parseInt(this.ui.pagamentoNomeJogador.dataset.timeId, 10);
        const nomeJogador = this.ui.pagamentoNomeJogador.dataset.nomeJogador;
        const valor = parseFloat(this.ui.pagamentoValor.value);
        const data = this.ui.pagamentoData.value;
        const status = this.ui.pagamentoStatus.value;
        const observacoes = this.ui.pagamentoObservacoes.value.trim();

        if (!valor || !data || !status) {
            this.showToast('Por favor, preencha todos os campos obrigatórios', 'error');
            return;
        }

        try {
            const pagamentoExistente = this.obterPagamentoJogador(nomeJogador);

            if (pagamentoExistente) {
                // Atualizar pagamento existente
                const { error } = await supabase
                    .from('mt_pagamento_jogadores')
                    .update({
                        valor: valor,
                        data_pagamento: data,
                        status: status,
                        observacoes: observacoes,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', pagamentoExistente.id);

                if (error) throw error;
                this.showToast('Pagamento atualizado com sucesso!');
            } else {
                // Criar novo pagamento
                const { error } = await supabase
                    .from('mt_pagamento_jogadores')
                    .insert([{
                        time_id: timeId,
                        nome_jogador: nomeJogador,
                        valor: valor,
                        data_pagamento: data,
                        status: status,
                        observacoes: observacoes,
                        created_at: new Date().toISOString(),
                    }]);

                if (error) throw error;
                this.showToast('Pagamento registrado com sucesso!');
            }

            this.fecharModalPagamento();
            await this.carregarPagamentosJogadores(timeId);
            this.renderizarJogadoresComPagamento();
        } catch (error) {
            console.error('Erro ao salvar pagamento:', error);
            this.showToast('Erro ao salvar pagamento', 'error');
        }
    }

    fecharModalPagamento() {
        this.ui.modalPagamento.classList.remove('active');
    }

    setupRealtimeListeners() {
        supabase
            .channel('pagamento-jogadores-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'mt_pagamento_jogadores' },
                () => {
                    if (this.timeAtualSelecionado) {
                        this.carregarPagamentosJogadores(this.timeAtualSelecionado.id);
                        this.renderizarJogadoresComPagamento();
                    }
                }
            )
            .subscribe();
    }

    formatarValor(valor) {
        return valor.toFixed(2).replace('.', ',');
    }

    formatarData(data) {
        const date = new Date(data);
        return date.toLocaleDateString('pt-BR');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium z-50 animate-pulse ${
            type === 'error' ? 'bg-red-500' : type === 'info' ? 'bg-blue-500' : 'bg-green-500'
        }`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Inicializar o gerenciador
const pagamentoManager = new PagamentoJogadoresManager();
window.pagamentoManager = pagamentoManager;

