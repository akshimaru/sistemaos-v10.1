import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Check, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ToastCustom';
import { ContaPagarModal } from '../components/ContaPagarModal';
import { formatCurrency } from '../utils/formatters';
import type { ContaPagar, CategoriaFinanceira } from '../types/database';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

export function ContasPagar() {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [contaParaEditar, setContaParaEditar] = useState<ContaPagar>();
  const [busca, setBusca] = useState('');
  const [buscaCategoria, setBuscaCategoria] = useState('');
  const [pagina, setPagina] = useState(0);
  const [totalContas, setTotalContas] = useState(0);
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'atrasado' | 'pago'>('todos');
  const itensPorPagina = 10;
  const [showCalendar, setShowCalendar] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [totalMes, setTotalMes] = useState(0);
  const [totalPagoMes, setTotalPagoMes] = useState(0);
  const [contasAtrasadas, setContasAtrasadas] = useState<ContaPagar[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Função para obter o primeiro e último dia do mês
  const getMonthRange = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { firstDay, lastDay };
  };

  useEffect(() => {
    buscarDados();
  }, [pagina, busca, buscaCategoria, statusFiltro, currentDate]);

  // Atualizar eventos do calendário quando as contas mudarem
  useEffect(() => {
    const filteredEvents = contas
      .filter(conta => {
        const contaDate = new Date(conta.data_vencimento);
        const { firstDay, lastDay } = getMonthRange(currentDate);
        return contaDate >= firstDay && contaDate <= lastDay && conta.status !== 'pago';
      })
      .map(conta => ({
        id: conta.id,
        title: conta.descricao,
        start: conta.data_vencimento,
        end: conta.data_vencimento,
        backgroundColor: conta.status === 'atrasado'
            ? '#EF4444' // red for late
            : '#F59E0B', // yellow for pending
        borderColor: conta.status === 'atrasado'
            ? '#DC2626'
            : '#D97706',
        extendedProps: {
          valor: conta.valor,
          status: conta.status,
          categoria: conta.categoria?.nome,
          categoriaColor: conta.categoria?.cor
        }
      }));

    setCalendarEvents(filteredEvents);
  }, [contas, currentDate]);

  async function buscarDados() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar contas atrasadas
      const { data: contasAtrasadasData } = await supabase
        .from('contas_pagar')
        .select(`
          *,
          categoria:categorias_financeiras(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'atrasado')
        .order('data_vencimento', { ascending: true });

      setContasAtrasadas(contasAtrasadasData || []);

      const { firstDay, lastDay } = getMonthRange(currentDate);

      // Buscar total do mês
      const [{ data: contasPendentes }, { data: contasPagas }] = await Promise.all([
        supabase
        .from('contas_pagar')
        .select('valor, status')
        .eq('user_id', user.id)
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', firstDay.toISOString())
        .lte('data_vencimento', lastDay.toISOString()),
        
        supabase
        .from('contas_pagar')
        .select('valor, status')
        .eq('user_id', user.id)
        .eq('status', 'pago')
        .gte('data_vencimento', firstDay.toISOString())
        .lte('data_vencimento', lastDay.toISOString())
      ]);

      const totalPendente = contasPendentes?.reduce((acc, conta) => 
        acc + Number(conta.valor), 0) || 0;
      const totalPago = contasPagas?.reduce((acc, conta) => 
        acc + Number(conta.valor), 0) || 0;

      setTotalMes(totalPendente);
      setTotalPagoMes(totalPago);

      // Buscar categorias
      const { data: categoriasData } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .eq('user_id', user.id)
        .order('nome');

      setCategorias(categoriasData || []);

      // Buscar contas
      let query = supabase
        .from('contas_pagar')
        .select(`
          *,
          categoria:categorias_financeiras(*)
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: true })
        .gte('data_vencimento', firstDay.toISOString())
        .lte('data_vencimento', lastDay.toISOString());

      if (busca) {
        query = query.or('descricao.ilike.%' + busca + '%,categoria.nome.ilike.%' + busca + '%');
      }

      if (buscaCategoria) {
        query = query.eq('categoria_id', buscaCategoria);
      }

      if (statusFiltro !== 'todos') {
        query = query.eq('status', statusFiltro);
      }

      const { data, count, error } = await query
        .range(pagina * itensPorPagina, (pagina + 1) * itensPorPagina - 1);

      if (error) throw error;

      setContas(data || []);
      setTotalContas(count || 0);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar contas');
    } finally {
      setLoading(false);
    }
  }

  async function handleExcluir(conta: ContaPagar) {
    if (!confirm(`Deseja realmente excluir a conta ${conta.descricao}?`)) return;

    try {
      const { error } = await supabase
        .from('contas_pagar')
        .delete()
        .eq('id', conta.id);

      if (error) throw error;

      toast.success('Conta excluída com sucesso!');
      // Se a página atual ficar vazia após exclusão, volte para a anterior
      if (paginatedContas.length === 1 && pagina > 0) {
        setPagina(pagina - 1);
      } else {
        buscarDados();
      }
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      toast.error('Erro ao excluir conta');
    }
  }

  async function handlePagar(conta: ContaPagar) {
    try {
      // Atualizar status da conta
      const { error: contaError } = await supabase
        .from('contas_pagar')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString()
        })
        .eq('id', conta.id);

      if (contaError) throw contaError;

      toast.success('Conta marcada como paga!');
      buscarDados();
    } catch (error) {
      console.error('Erro ao pagar conta:', error);
      toast.error('Erro ao pagar conta');
    }
  }

  // Filtro global client-side
  const filteredContas = useMemo(() => {
    let result = contas;
    if (globalFilter) {
      result = result.filter(conta => {
        const values = [
          conta.descricao,
          conta.categoria?.nome,
          conta.status,
          formatCurrency(conta.valor),
          new Date(conta.data_vencimento).toLocaleDateString('pt-BR')
        ].join(' ').toLowerCase();
        return values.includes(globalFilter.toLowerCase());
      });
    }
    if (statusFiltro !== 'todos') {
      result = result.filter(conta => conta.status === statusFiltro);
    }
    if (buscaCategoria) {
      result = result.filter(conta => conta.categoria_id === buscaCategoria);
    }
    return result;
  }, [contas, globalFilter, statusFiltro, buscaCategoria]);

  // Paginação client-side
  const paginatedContas = useMemo(() => {
    const start = pagina * itensPorPagina;
    return filteredContas.slice(start, start + itensPorPagina);
  }, [filteredContas, pagina, itensPorPagina]);

  const totalPaginas = Math.ceil(filteredContas.length / itensPorPagina);

  // Colunas para TanStack Table
  const columns = useMemo<ColumnDef<ContaPagar, any>[]>(() => [
    {
      header: 'Descrição',
      accessorKey: 'descricao',
    },
    {
      header: 'Categoria',
      accessorFn: row => row.categoria?.nome || '',
      id: 'categoria',
      cell: info => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${info.row.original.categoria?.cor}20`, color: info.row.original.categoria?.cor }}>{info.getValue()}</span>
      ),
    },
    {
      header: 'Vencimento',
      accessorKey: 'data_vencimento',
      cell: info => new Date(info.getValue()).toLocaleDateString('pt-BR'),
    },
    {
      header: 'Valor',
      accessorKey: 'valor',
      cell: info => formatCurrency(info.getValue()),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: info => (
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[info.getValue()]}`}>{info.getValue() === 'pago' ? 'Pago' : info.getValue() === 'atrasado' ? 'Atrasado' : 'Pendente'}</span>
      ),
    },
    {
      header: 'Ações',
      id: 'acoes',
      cell: info => (
        <div className="flex items-center justify-end space-x-2">
          {(info.row.original.status === 'pendente' || info.row.original.status === 'atrasado') && (
            <button onClick={() => handlePagar(info.row.original)} className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-all duration-200"><Check className="w-5 h-5" /></button>
          )}
          <button onClick={() => { setContaParaEditar(info.row.original); setModalAberto(true); }} className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all duration-200"><Pencil className="w-5 h-5" /></button>
          <button onClick={() => handleExcluir(info.row.original)} className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all duration-200"><Trash2 className="w-5 h-5" /></button>
        </div>
      ),
    },
  ], [setContaParaEditar, setModalAberto, handlePagar, handleExcluir]);

  const table = useReactTable({
    data: paginatedContas,
    columns,
    state: {
      globalFilter,
      pagination: { pageIndex: pagina, pageSize: itensPorPagina },
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: totalPaginas,
  });

  const statusColors = {
    pendente: 'bg-yellow-100 text-yellow-800',
    atrasado: 'bg-red-100 text-red-800',
    pago: 'bg-green-100 text-green-800',
    cancelado: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Contas a Pagar
            </h1>
          </div>
          <div>
            <button
              onClick={() => {
                setContaParaEditar(undefined);
                setModalAberto(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-300 flex items-center space-x-2 shadow-lg shadow-purple-200"
            >
              <Plus className="w-5 h-5" />
              <span>Nova Conta</span>
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Total a Pagar em {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalMes)}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Total Pago em {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalPagoMes)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Calendário */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 mb-8"
        >
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-bold text-gray-800">Calendário de Vencimentos</h2>
              </div>
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                {showCalendar ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            
            {showCalendar && (
              <>
                {/* Contas Atrasadas */}
                {contasAtrasadas.length > 0 && (
                  <div className="mb-6 bg-amber-50/80 backdrop-blur-lg rounded-xl p-4 border border-amber-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <h3 className="font-semibold text-amber-800">
                        Contas em Atraso ({contasAtrasadas.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {contasAtrasadas.map((conta) => (
                        <div
                          key={conta.id}
                          className="flex items-center justify-between p-3 bg-white/50 backdrop-blur-lg rounded-lg border border-amber-100"
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-800">
                                {conta.descricao}
                              </span>
                              <span className="font-medium text-red-600">
                                {formatCurrency(conta.valor)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: `${conta.categoria?.cor}20`,
                                    color: conta.categoria?.cor
                                  }}
                                >
                                  {conta.categoria?.nome}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Vencimento: {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <button
                                onClick={() => handlePagar(conta)}
                                className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-all duration-200"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="calendar-container"
                >
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale={ptBrLocale}
                    height="auto"
                    headerToolbar={{
                      left: 'prev,next today',
                      center: 'title',
                      right: 'dayGridMonth,timeGridWeek,timeGridDay'
                    }}
                    events={calendarEvents}
                    datesSet={({ view }) => {
                      const newDate = view.currentStart;
                      setCurrentDate(newDate);
                    }}
                    eventContent={(eventInfo) => (
                      <div className="p-1">
                        <div className="text-xs font-medium text-white line-clamp-1">
                          {eventInfo.event.title} - {formatCurrency(eventInfo.event.extendedProps.valor)}
                        </div>
                        <div className="text-xs text-white/80 line-clamp-1">
                          {eventInfo.event.extendedProps.categoria}
                        </div>
                      </div>
                    )}
                    eventDidMount={(info) => {
                      const tooltip = document.createElement('div');
                      tooltip.className = 'calendar-tooltip';
                      tooltip.innerHTML = `
                        <div class="bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-md space-y-2">
                          <div class="flex items-center justify-between">
                            <p class="font-medium text-gray-800">${info.event.title}</p>
                            <span class="${
                              info.event.extendedProps.status === 'pago'
                                ? 'bg-green-100 text-green-800'
                                : info.event.extendedProps.status === 'atrasado'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            } text-xs px-2 py-1 rounded-full font-medium">
                              ${info.event.extendedProps.status === 'pago' ? 'Pago' : 
                                info.event.extendedProps.status === 'atrasado' ? 'Atrasado' : 
                                'Pendente'}
                            </span>
                          </div>
                          <p class="text-lg font-semibold text-gray-900">
                            ${formatCurrency(info.event.extendedProps.valor)}
                          </p>
                          <div class="flex items-center space-x-2">
                            <span
                              class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                              style="background-color: ${info.event.extendedProps.categoriaColor}20; color: ${info.event.extendedProps.categoriaColor}"
                            >
                              ${info.event.extendedProps.categoria}
                            </span>
                            <span class="text-xs text-gray-500">
                              Vencimento: ${new Date(info.event.start!).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      `;
                      
                      info.el.addEventListener('mouseover', () => {
                        document.body.appendChild(tooltip);
                        const rect = info.el.getBoundingClientRect();
                        tooltip.style.position = 'fixed';
                        tooltip.style.top = `${rect.bottom + 5}px`;
                        tooltip.style.left = `${rect.left}px`;
                        tooltip.style.zIndex = '1000';
                      });
                      
                      info.el.addEventListener('mouseout', () => {
                        if (document.body.contains(tooltip)) {
                          document.body.removeChild(tooltip);
                        }
                      });
                    }}
                    eventClick={(info) => {
                      const conta = contas.find(c => c.id === info.event.id);
                      if (conta) {
                        if (conta.status === 'pendente' || conta.status === 'atrasado') {
                          handlePagar(conta);
                        }
                      }
                    }}
                    slotMinTime="08:00:00"
                    slotMaxTime="18:00:00"
                    businessHours={{
                      daysOfWeek: [1, 2, 3, 4, 5, 6],
                      startTime: '08:00',
                      endTime: '18:00'
                    }}
                  />
                </motion.div>
              </>
            )}
          </div>
        </motion.div>

        {/* Filtros e Lista */}
        <div className="mt-8 bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
            <div className="flex space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por descrição ou nome da categoria..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-full sm:w-64"
                />
              </div>

              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="todos">Todos os Status</option>
                <option value="pendente">Pendente</option>
                <option value="atrasado">Atrasado</option>
                <option value="pago">Pago</option>
              </select>

              <select
                value={buscaCategoria}
                onChange={(e) => setBuscaCategoria(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Todas as Categorias</option>
                {categorias
                  .filter(c => c.tipo === 'despesa')
                  .map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="border-b border-gray-100">
                    {headerGroup.headers.map(header => (
                      <th key={header.id} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={table.getVisibleFlatColumns().length} className="px-6 py-4 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr> 
                ) : paginatedContas.length === 0 ? (
                  <tr>
                    <td colSpan={table.getVisibleFlatColumns().length} className="px-6 py-4 text-center text-gray-500">
                      Nenhuma conta encontrada
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-gray-50/50"
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 text-sm text-gray-900">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Mostrando {paginatedContas.length} de {filteredContas.length} resultados
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

      <ContaPagarModal
        isOpen={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setContaParaEditar(undefined);
        }}
        contaParaEditar={contaParaEditar}
        categorias={categorias}
        onSuccess={buscarDados}
      />
    </div>
  );
}