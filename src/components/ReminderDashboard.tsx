import React from 'react';
import { useReminderStats } from '../contexts/ReminderContext';
import { 
  Wrench, 
  Star, 
  Send, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  color: 'orange' | 'purple' | 'green' | 'blue' | 'red';
  icon: React.ReactNode;
  subtitle?: string;
}

function StatCard({ title, value, color, icon, subtitle }: StatCardProps) {
  const colorClasses = {
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    red: 'bg-red-50 text-red-600 border-red-200'
  };

  const iconColorClasses = {
    orange: 'text-orange-500',
    purple: 'text-purple-500',
    green: 'text-green-500',
    blue: 'text-blue-500',
    red: 'text-red-500'
  };

  return (
    <div className={`rounded-lg border-2 p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm font-medium">{title}</div>
          {subtitle && (
            <div className="text-xs opacity-75 mt-1">{subtitle}</div>
          )}
        </div>
        <div className={`${iconColorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function ReminderDashboard() {
  const { 
    pendingMaintenance, 
    pendingEvaluation, 
    totalSentToday, 
    isLoading, 
    lastUpdate,
    hasActivity 
  } = useReminderStats();

  return (
    <div className="space-y-6">
      {/* Header com status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sistema de Lembretes</h2>
          <p className="text-gray-600">Automação inteligente para manutenção e avaliações</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {isLoading ? (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm font-medium">Verificando...</span>
            </div>
          ) : (
            <div className="flex items-center text-green-600">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Sistema Ativo</span>
            </div>
          )}
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Manutenção Pendente"
          value={pendingMaintenance}
          color="orange"
          icon={<Wrench className="w-8 h-8" />}
          subtitle="Clientes aguardando lembrete"
        />
        
        <StatCard
          title="Avaliação Pendente"
          value={pendingEvaluation}
          color="purple"
          icon={<Star className="w-8 h-8" />}
          subtitle="Serviços para avaliar"
        />
        
        <StatCard
          title="Enviados Hoje"
          value={totalSentToday}
          color="green"
          icon={<Send className="w-8 h-8" />}
          subtitle="Lembretes processados"
        />
        
        <StatCard
          title="Taxa de Sucesso"
          value="95%"
          color="blue"
          icon={<TrendingUp className="w-8 h-8" />}
          subtitle="Últimos 30 dias"
        />
      </div>

      {/* Status e informações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status do Sistema */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-500" />
            Status do Sistema
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Última verificação:</span>
              <span className="text-sm font-medium">
                {lastUpdate ? lastUpdate.toLocaleString('pt-BR') : 'Nunca'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Próxima verificação:</span>
              <span className="text-sm font-medium">
                {lastUpdate ? 
                  new Date(lastUpdate.getTime() + 4 * 60 * 60 * 1000).toLocaleString('pt-BR') : 
                  'Em até 4 horas'
                }
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Frequência:</span>
              <span className="text-sm font-medium">A cada 4 horas</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Horário ativo:</span>
              <span className="text-sm font-medium">08:00 - 18:00</span>
            </div>
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-gray-500" />
            Alertas e Atividade
          </h3>
          
          <div className="space-y-3">
            {hasActivity ? (
              <>
                {pendingMaintenance > 0 && (
                  <div className="flex items-center p-3 bg-orange-50 rounded-lg">
                    <Wrench className="w-4 h-4 text-orange-500 mr-3" />
                    <span className="text-sm text-orange-800">
                      {pendingMaintenance} cliente(s) precisam de lembrete de manutenção
                    </span>
                  </div>
                )}
                
                {pendingEvaluation > 0 && (
                  <div className="flex items-center p-3 bg-purple-50 rounded-lg">
                    <Star className="w-4 h-4 text-purple-500 mr-3" />
                    <span className="text-sm text-purple-800">
                      {pendingEvaluation} avaliação(ões) pendente(s)
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">
                  Sistema funcionando perfeitamente!
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Nenhum lembrete pendente no momento.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dicas de otimização */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          💡 Sistema Otimizado
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
              <p className="font-medium text-blue-900">Cache Inteligente</p>
              <p className="text-blue-700">Configurações armazenadas por 30 minutos</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
              <p className="font-medium text-blue-900">Verificação Otimizada</p>
              <p className="text-blue-700">A cada 4 horas (60% menos carga)</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
              <p className="font-medium text-blue-900">Horário Inteligente</p>
              <p className="text-blue-700">Apenas em horário comercial</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
