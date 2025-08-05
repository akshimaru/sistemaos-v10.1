import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { DollarSign, ArrowRight, Search, Plus, Filter, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ToastCustom';
import { alerts } from '../utils/alerts';
import { formatCurrency, capitalize } from '../utils/formatters';
import { Autocomplete } from '../components/Autocomplete';
import { TransacaoModal } from '../components/TransacaoModal';
import { CategoriaFinanceiraModal } from '../components/CategoriaFinanceiraModal';
import { ImportarCSVModal } from '../components/ImportarCSVModal';
import type { TransacaoFinanceira, CategoriaFinanceira } from '../types/database';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export function Financeiro() {
  const navigate = useNavigate();
  const [transacoes, setTransacoes] = useState<TransacaoFinanceira[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalTransacaoAberto, setModalTransacaoAberto] = useState(false);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [modalImportarCSVAberto, setModalImportarCSVAberto] = useState(false);
  const [transacaoParaEditar, setTransacaoParaEditar] = useState<TransacaoFinanceira>();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [paginaTransacoes, setPaginaTransacoes] = useState(0);
  const [totalTransacoes, setTotalTransacoes] = useState(0);
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [receitasMes, setReceitasMes] = useState(0);
  const [despesasMes, setDespesasMes] = useState(0);
  const [saldoMes, setSaldoMes] = useState(0);
  const [showTransactions, setShowTransactions] = useState(false);
  const itensPorPagina = 10;

  // Função para obter o primeiro e último dia do mês
  const getMonthRange = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { firstDay, lastDay };
  };
  const [dadosGraficos, setDadosGraficos] = useState({
    receitasPorCategoria: {},
    despesasPorCategoria: {},
    fluxoMensal: [],
  });

  useEffect(() => {
    const { firstDay, lastDay } = getMonthRange(currentDate);
    buscarDados(firstDay, lastDay);
    carregarDadosGraficos();
  }, [currentDate, pagina, busca, tipoFiltro, categoriaFiltro]);

  async function buscarDados(firstDay: Date, lastDay: Date) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id || !user?.aud) {
        navigate('/login');
        return;
      }

      // Buscar categorias
      let { data: categoriasData, error: categoriasError } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .eq('user_id', user.id)
        .order('nome');

      if (categoriasError) throw categoriasError;
      setCategorias(categoriasData || []);

      // Buscar totais do mês
      const { data: transacoesMes, error: transacoesError } = await supabase
        .from('transacoes_financeiras')
        .select('tipo, valor, conta_pagar_id')
        .eq('user_id', user.id)
        .gte('data', firstDay.toISOString())
        .lte('data', lastDay.toISOString());

      if (transacoesError) throw transacoesError;

      if (transacoesMes) {
        const receitas = transacoesMes
          .filter(t => t.tipo === 'receita')
          .reduce((acc, t) => acc + Number(t.valor), 0);
        const despesas = transacoesMes
          .filter(t => t.tipo === 'despesa')
          .reduce((acc, t) => {
            // Não contar transações que são de contas a pagar ainda não pagas
            if (t.conta_pagar_id) {
              const conta = contasPendentes?.find(c => c.id === t.conta_pagar_id);
              if (conta && conta.status !== 'pago') {
                return acc;
              }
            }
            return acc + Number(t.valor);
          }, 0);

        setReceitasMes(receitas);
        setDespesasMes(despesas);
        setSaldoMes(receitas - despesas);
      }

      // Buscar transações
      let query = supabase
        .from('transacoes_financeiras')
        .select(`
          *,
          categoria:categorias_financeiras(*)
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .order('data', { ascending: false });

      // Aplicar filtros
      if (busca) {
        query = query.or(`descricao.ilike.%${busca}%`);
      }

      if (tipoFiltro !== 'todos') {
        query.eq('tipo', tipoFiltro);
      }

      if (categoriaFiltro) {
        query.eq('categoria_id', categoriaFiltro);
      }
      
      query
        .gte('data', firstDay.toISOString())
        .lte('data', lastDay.toISOString());

      const { data, count, error } = await query
        .range(pagina * itensPorPagina, (pagina + 1) * itensPorPagina - 1);

      if (error) throw error;

      setTransacoes(data || []);
      setTotalTransacoes(count || 0);
    } catch (error) {
      if (error?.message && !error.message.includes('Failed to fetch')) {
        console.error('Erro ao buscar dados:', error);
      }
      if (error?.message && !error.message.includes('Failed to fetch')) {
        console.error('Erro ao buscar dados:', error);
        toast.error('Erro ao carregar dados financeiros');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleExcluir(transacao: TransacaoFinanceira) {
    const result = await alerts.confirm({
      title: 'Excluir Transação',
      text: 'Deseja realmente excluir esta transação?',
      icon: 'warning'
    });

    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase
        .from('transacoes_financeiras')
        .delete()
        .eq('id', transacao.id);

      if (error) throw error;

      toast.success('Transação excluída com sucesso!');
      buscarDados(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      toast.error('Erro ao excluir transação');
    }
  }

  const totalPaginas = Math.ceil(totalTransacoes / itensPorPagina);

  async function carregarDadosGraficos() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar dados dos últimos 6 meses
      const dataFinal = new Date();
      const dataInicial = new Date();
      dataInicial.setMonth(dataInicial.getMonth() - 5);

      const { data: transacoes, error } = await supabase
        .from('transacoes_financeiras')
        .select(`
          *,
          categoria:categorias_financeiras(*)
        `)
        .eq('user_id', user.id)
        .is('conta_pagar_id', null)
        .gte('data', dataInicial.toISOString())
        .lte('data', dataFinal.toISOString());

      if (error) throw error;

      // Processar dados para os gráficos
      const receitasPorCategoria = {};
      const despesasPorCategoria = {};
      const fluxoMensal = Array(6).fill(0).map(() => ({ receitas: 0, despesas: 0 }));

      transacoes.forEach(transacao => {
        const valor = Number(transacao.valor);
        const mes = new Date(transacao.data).getMonth();
        const mesIndex = (mes - dataInicial.getMonth() + 12) % 6;
        const categoriaNome = transacao.categoria?.nome || 'Sem categoria';

        if (transacao.tipo === 'receita') {
          receitasPorCategoria[categoriaNome] = (receitasPorCategoria[categoriaNome] || 0) + valor;
          fluxoMensal[mesIndex].receitas += valor;
        } else {
          despesasPorCategoria[categoriaNome] = (despesasPorCategoria[categoriaNome] || 0) + valor;
          fluxoMensal[mesIndex].despesas += valor;
        }
      });

      setDadosGraficos({
        receitasPorCategoria,
        despesasPorCategoria,
        fluxoMensal
      });
    } catch (error) {
      console.error('Erro ao carregar dados dos gráficos:', error);
      toast.error('Erro ao carregar análises');
    }
  }

  // Configuração dos gráficos
  const fluxoMensalConfig = {
    labels: Array(6).fill(0).map((_, i) => {
      const data = new Date();
      data.setMonth(data.getMonth() - (5 - i));
      return data.toLocaleDateString('pt-BR', { month: 'short' });
    }),
    datasets: [
      {
        label: 'Receitas',
        data: dadosGraficos.fluxoMensal.map(m => m.receitas),
        borderColor: '#10B981',
        backgroundColor: '#10B98120',
        fill: true,
      },
      {
        label: 'Despesas',
        data: dadosGraficos.fluxoMensal.map(m => m.despesas),
        borderColor: '#EF4444',
        backgroundColor: '#EF444420',
        fill: true,
      }
    ]
  };

  const receitasConfig = {
    labels: Object.keys(dadosGraficos.receitasPorCategoria),
    datasets: [{
      data: Object.values(dadosGraficos.receitasPorCategoria),
      backgroundColor: [
        '#10B981',
        '#3B82F6',
        '#6366F1',
        '#8B5CF6',
        '#EC4899'
      ]
    }]
  };

  const despesasConfig = {
    labels: Object.keys(dadosGraficos.despesasPorCategoria),
    datasets: [{
      label: 'Despesas',
      data: Object.values(dadosGraficos.despesasPorCategoria),
      backgroundColor: [
        '#EF4444',
        '#F59E0B',
        '#F43F5E',
        '#8B5CF6',
        '#64748B'
      ]
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Cabeçalho e Filtros */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Autocomplete
                options={transacoes.map(t => ({ id: t.id, nome: t.descricao }))}
                value={busca}
                onChange={(value) => setBusca(value)}
                placeholder="Buscar transações..."
                className="w-full sm:w-64"
              />
            </div>

            <div className="flex space-x-2">
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/50 backdrop-blur-lg shadow-sm"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Saídas</option>
              </select>

              <Autocomplete
                value={categoriaFiltro}
                onChange={(value) => setCategoriaFiltro(value)}
                options={categorias.map(c => ({ id: c.id, nome: c.nome }))}
                placeholder="Todas as Categorias"
                className="w-48"
              >
              </Autocomplete>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setModalTransacaoAberto(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-300 flex items-center space-x-2 shadow-lg shadow-purple-200"
              >
                <Plus className="w-5 h-5" />
                <span>Nova Transação</span>
              </button>

              <button
                onClick={() => setModalCategoriaAberto(true)}
                className="px-4 py-2 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all duration-300 flex items-center space-x-2 border border-gray-200 shadow-sm"
              >
                <Filter className="w-5 h-5" />
                <span>Categorias</span>
              </button>

              <button
                onClick={() => setModalImportarCSVAberto(true)}
                className="px-4 py-2 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all duration-300 flex items-center space-x-2 border border-gray-200 shadow-sm"
              >
                <Upload className="w-5 h-5" />
                <span>Importar CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100"
            >
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Receitas de {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(receitasMes)}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100"
            >
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Saídas de {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(despesasMes)}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100"
            >
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Saldo de {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(saldoMes)}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Atalho para Transações */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/transacoes')}
            className="w-full bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100 hover:bg-white/90 transition-all duration-200 flex items-center justify-between group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-800">Lista de Transações</h3>
                <p className="text-sm text-gray-600">Visualize e gerencie todas as suas transações financeiras</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-purple-600 transition-colors" />
          </button>
        </motion.div>

        {/* Gráficos Analíticos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Fluxo Mensal */}
          <div className="lg:col-span-3 bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Fluxo de Caixa - Últimos 6 Meses</h3>
            <div className="h-[300px]">
              <Line data={fluxoMensalConfig} options={chartOptions} />
            </div>
          </div>

          {/* Receitas por Categoria */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Receitas por Categoria</h3>
            <div className="h-[300px]">
              <Doughnut data={receitasConfig} options={chartOptions} />
            </div>
          </div>

          {/* Despesas por Categoria */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Saídas por Categoria</h3>
            <div className="h-[300px]">
              <Bar 
                data={despesasConfig}
                options={{
                  ...chartOptions,
                  indexAxis: 'y' as const,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false
                      }
                    },
                    y: {
                      grid: {
                        display: false
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Comparativo Mensal */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Comparativo Mensal</h3>
            <div className="h-[300px]">
              <Bar 
                data={{
                  labels: ['Receitas', 'Despesas'],
                  datasets: [{
                    data: [receitasMes, despesasMes],
                    backgroundColor: ['#10B981', '#EF4444'],
                    labels: ['Receitas', 'Saídas']
                  }]
                }}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      display: false
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Modais */}
        <TransacaoModal
          isOpen={modalTransacaoAberto}
          onClose={() => {
            setModalTransacaoAberto(false);
            setTransacaoParaEditar(undefined);
          }}
          transacaoParaEditar={transacaoParaEditar}
          categorias={categorias}
          onSuccess={buscarDados}
        />

        <CategoriaFinanceiraModal
          isOpen={modalCategoriaAberto}
          onClose={() => setModalCategoriaAberto(false)}
          onSuccess={buscarDados}
        />

        <ImportarCSVModal
          isOpen={modalImportarCSVAberto}
          onClose={() => setModalImportarCSVAberto(false)}
          categorias={categorias}
          onSuccess={buscarDados}
        />
      </div>
    </div>
  );
}