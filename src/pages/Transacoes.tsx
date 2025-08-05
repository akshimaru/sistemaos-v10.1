import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Upload, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ToastCustom';
import { alerts } from '../utils/alerts';
import { formatCurrency } from '../utils/formatters';
import { Autocomplete } from '../components/Autocomplete';
import { TransacaoModal } from '../components/TransacaoModal';
import { CategoriaFinanceiraModal } from '../components/CategoriaFinanceiraModal';
import { ImportarCSVModal } from '../components/ImportarCSVModal';
import type { TransacaoFinanceira, CategoriaFinanceira } from '../types/database';

export function Transacoes() {
  const navigate = useNavigate();
  const [transacoes, setTransacoes] = useState<TransacaoFinanceira[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTransacaoAberto, setModalTransacaoAberto] = useState(false);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [modalImportarCSVAberto, setModalImportarCSVAberto] = useState(false);
  const [transacaoParaEditar, setTransacaoParaEditar] = useState<TransacaoFinanceira>();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [totalTransacoes, setTotalTransacoes] = useState(0);
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const itensPorPagina = 10;

  useEffect(() => {
    buscarDados();
  }, [pagina, busca, tipoFiltro, categoriaFiltro]);

  async function buscarDados() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar categorias
      const { data: categoriasData } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .eq('user_id', user.id)
        .order('nome');

      setCategorias(categoriasData || []);

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
        query = query.ilike('descricao', `%${busca}%`);
      }

      if (tipoFiltro !== 'todos') {
        query = query.eq('tipo', tipoFiltro);
      }

      if (categoriaFiltro) {
        query = query.eq('categoria_id', categoriaFiltro);
      }

      const { data, count, error } = await query
        .range(pagina * itensPorPagina, (pagina + 1) * itensPorPagina - 1);

      if (error) throw error;

      setTransacoes(data || []);
      setTotalTransacoes(count || 0);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar transações');
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
      buscarDados();
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      toast.error('Erro ao excluir transação');
    }
  }

  const totalPaginas = Math.ceil(totalTransacoes / itensPorPagina);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar transações..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-full sm:w-64 bg-white/50 backdrop-blur-lg shadow-sm"
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
                <option value="despesa">Despesas</option>
              </select>

              <Autocomplete
                value={categoriaFiltro}
                onChange={(value) => setCategoriaFiltro(value)}
                options={categorias.map(c => ({ id: c.id, nome: c.nome }))}
                placeholder="Todas as Categorias"
                className="w-48"
              />
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

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : transacoes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Nenhuma transação encontrada
                    </td>
                  </tr>
                ) : (
                  transacoes.map((transacao) => (
                    <motion.tr
                      key={transacao.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-purple-50/50 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transacao.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {transacao.descricao}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${transacao.categoria?.cor}20`,
                            color: transacao.categoria?.cor
                          }}
                        >
                          {transacao.categoria?.nome}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                        transacao.tipo === 'receita' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transacao.tipo === 'despesa' && '-'}
                        {formatCurrency(transacao.valor)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => {
                              setTransacaoParaEditar(transacao);
                              setModalTransacaoAberto(true);
                            }}
                            className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleExcluir(transacao)}
                            className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all duration-200"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Mostrando {transacoes.length} de {totalTransacoes} resultados
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPagina(p => Math.max(0, p - 1))}
                disabled={pagina === 0}
                className="p-2 rounded-lg hover:bg-white/50 disabled:opacity-50 transition-colors duration-200"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700">
                Página {pagina + 1} de {totalPaginas}
              </span>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                disabled={pagina >= totalPaginas - 1}
                className="p-2 rounded-lg hover:bg-white/50 disabled:opacity-50 transition-colors duration-200"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

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
  );
}