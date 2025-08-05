import { useState, useEffect } from 'react';
import { X, Clock, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WhatsAppService } from '../utils/whatsapp-service';
import { toast } from './ToastCustom';
import { formatDate } from '../utils/formatters';
import type { OrdemServico } from '../types/database';

interface MaintenanceReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OrdemComMeses extends OrdemServico {
  meses_desde_ultima: number;
}

export function MaintenanceReminderModal({ isOpen, onClose }: MaintenanceReminderModalProps) {
  const [ordensElegiveis, setOrdensElegiveis] = useState<OrdemComMeses[]>([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState<string[]>([]);
  const [enviados, setEnviados] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      buscarOrdensElegiveis();
    }
  }, [isOpen]);

  async function buscarOrdensElegiveis() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar ordens concluídas com mais de 5 meses
      const cincoMesesAtras = new Date();
      cincoMesesAtras.setMonth(cincoMesesAtras.getMonth() - 5);

      const { data, error } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          cliente:clientes(*),
          instrumento:instrumentos(*),
          marca:marcas(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'concluido')
        .lt('data_previsao', cincoMesesAtras.toISOString())
        .order('data_previsao', { ascending: true });

      if (error) throw error;

      // Calcular meses desde a última manutenção
      const ordensComMeses = (data || []).map(ordem => {
        const dataPrevisao = new Date(ordem.data_previsao);
        const hoje = new Date();
        const mesesDiferenca = Math.floor((hoje.getTime() - dataPrevisao.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        
        return {
          ...ordem,
          meses_desde_ultima: mesesDiferenca
        };
      }).filter(ordem => ordem.meses_desde_ultima >= 5);

      setOrdensElegiveis(ordensComMeses);

    } catch (error) {
      console.error('Erro ao buscar ordens elegíveis:', error);
      toast.error('Erro ao carregar ordens para lembrete de manutenção');
    } finally {
      setLoading(false);
    }
  }

  async function enviarLembreteManutencao(ordem: OrdemComMeses) {
    if (!ordem.cliente?.telefone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    setEnviando(prev => [...prev, ordem.id]);

    try {
      await WhatsAppService.sendMaintenanceReminder(ordem);
      toast.success(`Lembrete enviado para ${ordem.cliente.nome}!`);
      setEnviados(prev => [...prev, ordem.id]);
    } catch (error: any) {
      console.error('Erro ao enviar lembrete:', error);
      toast.error(`Erro ao enviar lembrete para ${ordem.cliente?.nome}: ${error.message}`);
    } finally {
      setEnviando(prev => prev.filter(id => id !== ordem.id));
    }
  }

  async function enviarTodosLembretes() {
    const ordensComTelefone = ordensElegiveis.filter(ordem => 
      ordem.cliente?.telefone && !enviados.includes(ordem.id)
    );

    if (ordensComTelefone.length === 0) {
      toast.error('Nenhuma ordem elegível com telefone encontrada');
      return;
    }

    const confirmacao = window.confirm(
      `Deseja enviar lembretes de manutenção para ${ordensComTelefone.length} clientes?`
    );

    if (!confirmacao) return;

    for (const ordem of ordensComTelefone) {
      await enviarLembreteManutencao(ordem);
      // Aguardar 2 segundos entre envios para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Lembretes de Manutenção
              </h3>
              <p className="text-sm text-gray-500">
                Ordens com mais de 5 meses desde a última manutenção
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
              <span className="ml-3 text-gray-600">Carregando ordens...</span>
            </div>
          ) : ordensElegiveis.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma ordem encontrada
              </h4>
              <p className="text-gray-500">
                Não há ordens concluídas há mais de 5 meses que precisem de lembrete de manutenção.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">
                    {ordensElegiveis.length} ordem(ns) encontrada(s)
                  </span>
                  <span className="text-sm text-gray-500">
                    {enviados.length} enviado(s)
                  </span>
                </div>
                <button
                  onClick={enviarTodosLembretes}
                  disabled={enviando.length > 0}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Enviar Todos os Lembretes
                </button>
              </div>

              <div className="overflow-y-auto max-h-96 space-y-4">
                {ordensElegiveis.map((ordem) => (
                  <div
                    key={ordem.id}
                    className={`border rounded-lg p-4 transition-all ${
                      enviados.includes(ordem.id)
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 hover:border-yellow-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium text-gray-900">
                            #{ordem.numero} - {ordem.cliente?.nome}
                          </h4>
                          {enviados.includes(ordem.id) && (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Instrumento:</span>{' '}
                            {ordem.instrumento?.nome} {ordem.marca?.nome} {ordem.modelo}
                          </div>
                          <div>
                            <span className="font-medium">Telefone:</span>{' '}
                            {ordem.cliente?.telefone || 'Não informado'}
                          </div>
                          <div>
                            <span className="font-medium">Última manutenção:</span>{' '}
                            {formatDate(ordem.data_previsao)}
                          </div>
                          <div>
                            <span className="font-medium">Meses atrás:</span>{' '}
                            <span className="text-yellow-600 font-semibold">
                              {ordem.meses_desde_ultima} meses
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        {enviados.includes(ordem.id) ? (
                          <div className="flex items-center text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Enviado
                          </div>
                        ) : enviando.includes(ordem.id) ? (
                          <div className="flex items-center text-yellow-600 text-sm">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                            Enviando...
                          </div>
                        ) : (
                          <button
                            onClick={() => enviarLembreteManutencao(ordem)}
                            disabled={!ordem.cliente?.telefone}
                            className="flex items-center space-x-2 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send className="w-4 h-4" />
                            <span>Enviar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
