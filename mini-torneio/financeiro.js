// Sistema de Financeiro - Mini Torneio (Bolão)
// Gerenciamento de Receitas e Despesas

const supabase = window.supabaseClient;

class FinanceiroManager {
    constructor() {
        this.receitas = [];
        this.despesas = [];
        this.lancamentoEmEdicao = null;
        this.init();
    }

    async init() {
        this.bindUI();
        this.setupEventListeners();
        await this.carregarDados();
        this.setupRealtimeListeners();
    }

    bindUI() {
        this.ui = {
            // Receitas
            formReceita: document.getElementById('form-receita'),
            receitaDescricao: document.getElementById('receita-descricao'),
            receitaValor: document.getElementById('receita-valor'),
            receitaData: document.getElementById('receita-data'),
            receitasTbody: document.getElementById('receitas-tbody'),

            // Despesas
            formDespesa: document.getElementById('form-despesa'),
            despesaDescricao: document.getElementById('despesa-descricao'),
            despesaValor: document.getElementById('despesa-valor'),
            despesaData: document.getElementById('despesa-data'),
            despesasTbody: document.getElementById('despesas-tbody'),

            // Resumo
            totalReceitas: document.getElementById('total-receitas'),
            totalDespesas: document.getElementById('total-despesas'),
            saldoTotal: document.getElementById('saldo-total'),

            // Abas
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),

            // Modal
            modalEdicao: document.getElementById('modal-edicao'),
            formEdicao: document.getElementById('form-edicao'),
            edicaoId: document.getElementById('edicao-id'),
            edicaoTipo: document.getElementById('edicao-tipo'),
            edicaoDescricao: document.getElementById('edicao-descricao'),
            edicaoValor: document.getElementById('edicao-valor'),
            edicaoData: document.getElementById('edicao-data'),
            btnFecharModal: document.getElementById('btn-fechar-modal'),
            btnCancelarEdicao: document.getElementById('btn-cancelar-edicao'),
        };

        // Definir data atual como padrão
        const hoje = new Date().toISOString().split('T')[0];
        this.ui.receitaData.value = hoje;
        this.ui.despesaData.value = hoje;
    }

    setupEventListeners() {
        // Formulários
        this.ui.formReceita?.addEventListener('submit', (e) => this.submeterReceita(e));
        this.ui.formDespesa?.addEventListener('submit', (e) => this.submeterDespesa(e));
        this.ui.formEdicao?.addEventListener('submit', (e) => this.salvarEdicao(e));

        // Abas
        this.ui.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.mudarAba(btn.dataset.tab));
        });

        // Modal
        this.ui.btnFecharModal?.addEventListener('click', () => this.fecharModal());
        this.ui.btnCancelarEdicao?.addEventListener('click', () => this.fecharModal());
        this.ui.modalEdicao?.addEventListener('click', (e) => {
            if (e.target === this.ui.modalEdicao) this.fecharModal();
        });

        // Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.ui.modalEdicao.classList.contains('active')) {
                this.fecharModal();
            }
        });
    }

    async carregarDados() {
        try {
            // Carregar receitas
            const { data: receitas, error: erroReceitas } = await supabase
                .from('mt_financeiro')
                .select('*')
                .eq('tipo', 'receita')
                .order('data', { ascending: false });

            if (erroReceitas) throw erroReceitas;
            this.receitas = receitas || [];

            // Carregar despesas
            const { data: despesas, error: erroDespesas } = await supabase
                .from('mt_financeiro')
                .select('*')
                .eq('tipo', 'despesa')
                .order('data', { ascending: false });

            if (erroDespesas) throw erroDespesas;
            this.despesas = despesas || [];

            this.renderizarTabelas();
            this.atualizarResumo();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showToast('Erro ao carregar dados financeiros', 'error');
        }
    }

    async submeterReceita(event) {
        event.preventDefault();

        const descricao = this.ui.receitaDescricao.value.trim();
        const valor = parseFloat(this.ui.receitaValor.value);
        const data = this.ui.receitaData.value;

        if (!descricao || !valor || !data) {
            this.showToast('Por favor, preencha todos os campos', 'error');
            return;
        }

        try {
            const { data: novaReceita, error } = await supabase
                .from('mt_financeiro')
                .insert([{
                    tipo: 'receita',
                    descricao: descricao,
                    valor: valor,
                    data: data,
                    created_at: new Date().toISOString(),
                }])
                .select();

            if (error) throw error;

            this.ui.formReceita.reset();
            this.ui.receitaData.value = new Date().toISOString().split('T')[0];
            this.showToast('Receita adicionada com sucesso!');
            await this.carregarDados();
        } catch (error) {
            console.error('Erro ao adicionar receita:', error);
            this.showToast('Erro ao adicionar receita', 'error');
        }
    }

    async submeterDespesa(event) {
        event.preventDefault();

        const descricao = this.ui.despesaDescricao.value.trim();
        const valor = parseFloat(this.ui.despesaValor.value);
        const data = this.ui.despesaData.value;

        if (!descricao || !valor || !data) {
            this.showToast('Por favor, preencha todos os campos', 'error');
            return;
        }

        try {
            const { data: novaDespesa, error } = await supabase
                .from('mt_financeiro')
                .insert([{
                    tipo: 'despesa',
                    descricao: descricao,
                    valor: valor,
                    data: data,
                    created_at: new Date().toISOString(),
                }])
                .select();

            if (error) throw error;

            this.ui.formDespesa.reset();
            this.ui.despesaData.value = new Date().toISOString().split('T')[0];
            this.showToast('Despesa adicionada com sucesso!');
            await this.carregarDados();
        } catch (error) {
            console.error('Erro ao adicionar despesa:', error);
            this.showToast('Erro ao adicionar despesa', 'error');
        }
    }

    renderizarTabelas() {
        // Renderizar receitas
        if (this.receitas.length === 0) {
            this.ui.receitasTbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-gray-500 py-8">
                        <i class="fas fa-inbox text-2xl mb-2 block opacity-50"></i>
                        Nenhuma receita registrada
                    </td>
                </tr>
            `;
        } else {
            this.ui.receitasTbody.innerHTML = this.receitas.map(receita => `
                <tr>
                    <td>${this.formatarData(receita.data)}</td>
                    <td>${this.escapeHtml(receita.descricao)}</td>
                    <td class="font-semibold text-green-600">R$ ${this.formatarValor(receita.valor)}</td>
                    <td>
                        <button class="btn-edit mr-2" onclick="financeiroManager.abrirEdicao('${receita.id}', 'receita')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete" onclick="financeiroManager.deletarLancamento('${receita.id}', 'receita')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // Renderizar despesas
        if (this.despesas.length === 0) {
            this.ui.despesasTbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-gray-500 py-8">
                        <i class="fas fa-inbox text-2xl mb-2 block opacity-50"></i>
                        Nenhuma despesa registrada
                    </td>
                </tr>
            `;
        } else {
            this.ui.despesasTbody.innerHTML = this.despesas.map(despesa => `
                <tr>
                    <td>${this.formatarData(despesa.data)}</td>
                    <td>${this.escapeHtml(despesa.descricao)}</td>
                    <td class="font-semibold text-red-600">R$ ${this.formatarValor(despesa.valor)}</td>
                    <td>
                        <button class="btn-edit mr-2" onclick="financeiroManager.abrirEdicao('${despesa.id}', 'despesa')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete" onclick="financeiroManager.deletarLancamento('${despesa.id}', 'despesa')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    atualizarResumo() {
        const totalReceitas = this.receitas.reduce((sum, r) => sum + (r.valor || 0), 0);
        const totalDespesas = this.despesas.reduce((sum, d) => sum + (d.valor || 0), 0);
        const saldo = totalReceitas - totalDespesas;

        this.ui.totalReceitas.textContent = this.formatarValor(totalReceitas);
        this.ui.totalDespesas.textContent = this.formatarValor(totalDespesas);
        this.ui.saldoTotal.textContent = this.formatarValor(saldo);

        // Mudar cor do saldo
        const saldoElement = this.ui.saldoTotal.closest('.stat-card');
        if (saldo >= 0) {
            saldoElement.classList.remove('saldo');
            saldoElement.classList.add('receita');
        } else {
            saldoElement.classList.remove('receita');
            saldoElement.classList.add('despesa');
        }
    }

    async abrirEdicao(id, tipo) {
        const lancamento = tipo === 'receita' 
            ? this.receitas.find(r => r.id === id)
            : this.despesas.find(d => d.id === id);

        if (!lancamento) return;

        this.lancamentoEmEdicao = lancamento;
        this.ui.edicaoId.value = lancamento.id;
        this.ui.edicaoTipo.value = tipo;
        this.ui.edicaoDescricao.value = lancamento.descricao;
        this.ui.edicaoValor.value = lancamento.valor;
        this.ui.edicaoData.value = lancamento.data;

        this.ui.modalEdicao.classList.add('active');
    }

    async salvarEdicao(event) {
        event.preventDefault();

        const id = this.ui.edicaoId.value;
        const tipo = this.ui.edicaoTipo.value;
        const descricao = this.ui.edicaoDescricao.value.trim();
        const valor = parseFloat(this.ui.edicaoValor.value);
        const data = this.ui.edicaoData.value;

        if (!descricao || !valor || !data) {
            this.showToast('Por favor, preencha todos os campos', 'error');
            return;
        }

        try {
            const { error } = await supabase
                .from('mt_financeiro')
                .update({
                    descricao: descricao,
                    valor: valor,
                    data: data,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (error) throw error;

            this.fecharModal();
            this.showToast('Lançamento atualizado com sucesso!');
            await this.carregarDados();
        } catch (error) {
            console.error('Erro ao atualizar lançamento:', error);
            this.showToast('Erro ao atualizar lançamento', 'error');
        }
    }

    async deletarLancamento(id, tipo) {
        if (!confirm('Tem certeza que deseja deletar este lançamento?')) return;

        try {
            const { error } = await supabase
                .from('mt_financeiro')
                .delete()
                .eq('id', id);

            if (error) throw error;

            this.showToast('Lançamento deletado com sucesso!');
            await this.carregarDados();
        } catch (error) {
            console.error('Erro ao deletar lançamento:', error);
            this.showToast('Erro ao deletar lançamento', 'error');
        }
    }

    mudarAba(abaNome) {
        // Atualizar botões
        this.ui.tabBtns.forEach(btn => {
            if (btn.dataset.tab === abaNome) {
                btn.classList.add('active');
                btn.classList.add('border-b-2', 'border-purple-600', 'text-purple-600');
                btn.classList.remove('text-gray-600', 'hover:text-gray-800');
            } else {
                btn.classList.remove('active');
                btn.classList.remove('border-b-2', 'border-purple-600', 'text-purple-600');
                btn.classList.add('text-gray-600', 'hover:text-gray-800');
            }
        });

        // Atualizar conteúdo
        this.ui.tabContents.forEach(content => {
            if (content.id === `${abaNome}-section`) {
                content.classList.remove('hidden');
                content.classList.add('active');
            } else {
                content.classList.add('hidden');
                content.classList.remove('active');
            }
        });
    }

    fecharModal() {
        this.ui.modalEdicao.classList.remove('active');
        this.lancamentoEmEdicao = null;
    }

    setupRealtimeListeners() {
        // Inscrever em mudanças na tabela financeiro
        supabase
            .channel('financeiro-changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'mt_financeiro' },
                () => {
                    this.carregarDados();
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
const financeiroManager = new FinanceiroManager();
window.financeiroManager = financeiroManager;

