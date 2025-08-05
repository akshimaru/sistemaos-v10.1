import { useState, useEffect, useMemo } from 'react';
import { PenTool as Tool, Search, Plus, Trash2, ChevronLeft, ChevronRight, Send, Edit, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ToastCustom';
import { alerts } from '../utils/alerts';
import { formatDate } from '../utils/formatters';
import { WhatsAppService } from '../utils/whatsapp-service';
import { PrintOrdemModal } from '../components/PrintOrdemModal';
import type { OrdemServico } from '../types/database';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';

export function Ordens() {
  const navigate = useNavigate();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagina, setPagina] = useState(0);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [ordemParaImprimir, setOrdemParaImprimir] = useState<OrdemServico | null>(null);
  const itensPorPagina = 10;

  async function buscarOrdens() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      let query = supabase
        .from('ordens_servico')
        .select(`*,cliente:clientes(*),instrumento:instrumentos(*),marca:marcas(*)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      setOrdens(data || []);
    } catch (error) {
      toast.error('Erro ao carregar ordens de serviço');
    } finally {
      setLoading(false);
    }
  }

  // Carregar todas as ordens do Supabase apenas uma vez
  useEffect(() => {
    buscarOrdens();
  }, []);

  // Filtro global client-side
  const filteredOrdens = useMemo(() => {
    if (!globalFilter) return ordens;
    return ordens.filter(ordem => {
      const values = [
        ordem.numero,
        ordem.cliente?.nome,
        ordem.instrumento?.nome,
        ordem.marca?.nome,
        ordem.modelo,
        ordem.status,
        ordem.observacoes,
        formatDate(ordem.data_previsao)
      ].join(' ').toLowerCase();
      return values.includes(globalFilter.toLowerCase());
    });
  }, [ordens, globalFilter]);

  // Paginação client-side
  const paginatedOrdens = useMemo(() => {
    const start = pagina * itensPorPagina;
    return filteredOrdens.slice(start, start + itensPorPagina);
  }, [filteredOrdens, pagina, itensPorPagina]);

  const totalPaginas = Math.ceil(filteredOrdens.length / itensPorPagina);

  const statusColors = {
    pendente: 'bg-yellow-100 text-yellow-800',
    em_andamento: 'bg-blue-100 text-blue-800',
    concluido: 'bg-green-100 text-green-800',
    cancelado: 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  // Definição das colunas para TanStack Table v8+
  const columns = useMemo<ColumnDef<OrdemServico, any>[]>(() => [
    {
      header: 'Número',
      accessorKey: 'numero',
      cell: info => `#${info.getValue()}`,
    },
    {
      header: 'Cliente',
      accessorFn: row => row.cliente?.nome || '',
      id: 'cliente',
    },
    {
      header: 'Instrumento/Marca',
      accessorFn: row => `${row.instrumento?.nome || ''} ${row.marca?.nome || ''} ${row.modelo || ''}`,
      id: 'instrumento',
    },
    {
      header: 'Data Prevista',
      accessorKey: 'data_previsao',
      cell: info => formatDate(info.getValue()),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: info => (
        <select
          value={info.row.original.status}
          onChange={e => handleChangeStatus(info.row.original, e.target.value as 'pendente' | 'em_andamento' | 'concluido' | 'cancelado')}
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[info.row.original.status]}`}
        >
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>
      ),
    },
    {
      header: 'Ações',
      id: 'acoes',
      cell: info => (
        <div className="flex items-center justify-end space-x-3">
          <button onClick={() => navigate(`/ordens/editar/${info.row.original.id}`)} className="p-2 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-all duration-200">
            <Edit className="w-5 h-5" />
          </button>
          <button onClick={() => { setOrdemParaImprimir(info.row.original); setShowPrintModal(true); }} className="p-2 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-all duration-200">
            <Printer className="w-5 h-5" />
          </button>
          <button onClick={() => handleWhatsAppShare(info.row.original)} className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-all duration-200">
            <Send className="w-5 h-5" />
          </button>
          <button onClick={() => handleExcluir(info.row.original)} className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all duration-200">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ),
    },
  ], [navigate, setOrdemParaImprimir, setShowPrintModal, handleWhatsAppShare, handleExcluir, handleChangeStatus]);

  const table = useReactTable({
    data: paginatedOrdens,
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

  async function handleExcluir(ordem: OrdemServico) {
    const result = await alerts.confirm({
      title: 'Excluir Ordem',
      text: `Deseja realmente excluir a ordem de serviço #${ordem.numero}?`,
      icon: 'warning'
    });

    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase
        .from('ordens_servico')
        .delete()
        .eq('id', ordem.id);

      if (error) throw error;

      alerts.success('Ordem de serviço excluída com sucesso!');
      buscarOrdens();
    } catch (error) {
      console.error('Erro ao excluir ordem:', error);
      alerts.error('Erro ao excluir ordem de serviço');
    }
  }

  async function handleChangeStatus(ordem: OrdemServico, newStatus: 'pendente' | 'em_andamento' | 'concluido' | 'cancelado') {
    try {
      const { error } = await supabase
        .from('ordens_servico')
        .update({ status: newStatus })
        .eq('id', ordem.id);

      if (error) throw error;

      // If changing to completed status, send WhatsApp message
      if (newStatus === 'concluido' && ordem.cliente?.telefone) {
        try {
          await WhatsAppService.sendCompletionMessage(ordem);
          toast.success('Status atualizado e mensagem enviada!');
        } catch (whatsappError: any) {
          console.error('Erro ao enviar mensagem WhatsApp:', whatsappError);
          toast.success('Status atualizado! (Erro ao enviar WhatsApp)');
        }
      } else {
        toast.success('Status atualizado com sucesso!');
      }

      buscarOrdens();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  }

  async function handleWhatsAppShare(ordem: OrdemServico) {
    if (!ordem.cliente) {
      toast.error('Cliente não encontrado');
      return;
    }

    try {
      await WhatsAppService.sendOrderMessage(ordem);
      toast.success('Mensagem enviada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem: ' + error.message);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <Tool className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Ordens de Serviço
            </h1>
          </div>
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por qualquer campo..."
                  value={globalFilter}
                  onChange={e => setGlobalFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-full bg-white/50 backdrop-blur-lg transition-all duration-200"
                />
              </div>
            </div>
            <button
              onClick={() => navigate('/ordens/nova')}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-300 flex items-center space-x-2 shadow-lg shadow-purple-200"
            >
              <Plus className="w-5 h-5" />
              <span>Nova Ordem</span>
            </button>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white/50">
                {loading ? (
                  <tr><td colSpan={columns.length} className="px-6 py-4 text-center text-gray-500">Carregando...</td></tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr><td colSpan={columns.length} className="px-6 py-4 text-center text-gray-500">Nenhuma ordem de serviço encontrada</td></tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-purple-50/50 transition-colors duration-200">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação com TanStack Table */}
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Mostrando {paginatedOrdens.length} de {filteredOrdens.length} resultados
            </p>
            <div className="flex items-center space-x-2">
              <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0} className="p-2 rounded-lg hover:bg-white/50 disabled:opacity-50 transition-colors duration-200">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700">
                Página {pagina + 1} de {totalPaginas}
              </span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1} className="p-2 rounded-lg hover:bg-white/50 disabled:opacity-50 transition-colors duration-200">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {ordemParaImprimir && (
        <PrintOrdemModal
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setOrdemParaImprimir(null);
          }}
          ordem={ordemParaImprimir}
        />
      )}
    </div>
  );
}