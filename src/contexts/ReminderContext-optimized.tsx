// 🚀 VERSÃO OTIMIZADA DO SISTEMA DE LEMBRETES
// Implementação das principais melhorias identificadas

// 1. Context Provider Otimizado
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { MaintenanceReminderService } from '../utils/maintenance-reminder-service';
import { EvaluationReminderService } from '../utils/evaluation-reminder-service';

interface ReminderContextType {
  checkReminders: () => Promise<void>;
  isChecking: boolean;
  lastCheck: Date | null;
  stats: ReminderStats;
}

interface ReminderStats {
  pendingMaintenance: number;
  pendingEvaluation: number;
  totalSentToday: number;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

// Cache para configurações (evita múltiplas consultas)
class ReminderCache {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

  static async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: now });
    return data;
  }

  static clear(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [stats, setStats] = useState<ReminderStats>({
    pendingMaintenance: 0,
    pendingEvaluation: 0,
    totalSentToday: 0
  });

  // Função otimizada de verificação
  async function checkReminders() {
    if (isCheckingRef.current) return;
    
    try {
      isCheckingRef.current = true;
      setIsChecking(true);
      
      // Verificar apenas em horário comercial
      const now = new Date();
      const hour = now.getHours();
      
      if (hour < 8 || hour > 18) {
        console.log('Fora do horário comercial, pulando verificação');
        return;
      }

      console.log('🔄 Iniciando verificação de lembretes otimizada...');

      // Usar cache para configurações
      const [maintenanceSettings, evaluationSettings] = await Promise.all([
        ReminderCache.get('maintenance-settings', () => 
          MaintenanceReminderService.getSettings()
        ),
        ReminderCache.get('evaluation-settings', () => 
          EvaluationReminderService.getSettings()
        )
      ]);

      let totalSent = 0;
      let totalErrors = 0;

      // Processar lembretes de manutenção
      if (maintenanceSettings.reminder_enabled) {
        const result = await processMaintenanceReminders(maintenanceSettings);
        totalSent += result.sent;
        totalErrors += result.errors;
      }

      // Processar lembretes de avaliação
      if (evaluationSettings.evaluation_reminder_enabled) {
        const result = await processEvaluationReminders(evaluationSettings);
        totalSent += result.sent;
        totalErrors += result.errors;
      }

      // Atualizar estatísticas
      await updateStats();
      setLastCheck(new Date());

      if (totalSent > 0) {
        console.log(`✅ ${totalSent} lembrete(s) enviado(s) com sucesso`);
      }
      
      if (totalErrors > 0) {
        console.error(`❌ ${totalErrors} erro(s) ao enviar lembretes`);
      }

    } catch (error) {
      console.error('Erro durante verificação de lembretes:', error);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }

  // Processar lembretes de manutenção com verificação de horário
  async function processMaintenanceReminders(settings: any) {
    const now = new Date();
    const [targetHour] = settings.reminder_time.split(':').map(Number);
    const currentHour = now.getHours();

    // Verificar se está dentro da janela de envio (±1 hora)
    if (Math.abs(currentHour - targetHour) <= 1) {
      return await MaintenanceReminderService.processAutomaticReminders();
    }

    return { sent: 0, errors: 0 };
  }

  // Processar lembretes de avaliação com verificação de horário
  async function processEvaluationReminders(settings: any) {
    const now = new Date();
    const [targetHour] = settings.evaluation_reminder_time.split(':').map(Number);
    const currentHour = now.getHours();

    // Verificar se está dentro da janela de envio (±1 hora)
    if (Math.abs(currentHour - targetHour) <= 1) {
      return await EvaluationReminderService.processAutomaticReminders();
    }

    return { sent: 0, errors: 0 };
  }

  // Atualizar estatísticas
  async function updateStats() {
    try {
      const [pendingMaintenance, pendingEvaluation] = await Promise.all([
        ReminderCache.get('pending-maintenance', () => 
          MaintenanceReminderService.getPendingReminders()
        ),
        ReminderCache.get('pending-evaluation', () => 
          EvaluationReminderService.getPendingReminders()
        )
      ]);

      setStats({
        pendingMaintenance: pendingMaintenance.length,
        pendingEvaluation: pendingEvaluation.length,
        totalSentToday: await getTodaysSentCount()
      });
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
    }
  }

  // Contar lembretes enviados hoje
  async function getTodaysSentCount(): Promise<number> {
    // Implementar busca no banco por lembretes enviados hoje
    // Por ora, retornar 0
    return 0;
  }

  useEffect(() => {
    // Verificar a cada 4 horas em vez de 1 hora
    intervalRef.current = setInterval(checkReminders, 4 * 60 * 60 * 1000);

    // Verificação inicial apenas em horário comercial
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 8 && hour <= 18) {
      // Aguardar 30 segundos para não impactar a inicialização
      setTimeout(() => {
        checkReminders();
        updateStats(); // Carregar estatísticas iniciais
      }, 30000);
    } else {
      // Apenas carregar estatísticas fora do horário comercial
      setTimeout(updateStats, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      ReminderCache.clear(); // Limpar cache ao desmontar
    };
  }, []);

  const value: ReminderContextType = {
    checkReminders,
    isChecking,
    lastCheck,
    stats
  };

  return (
    <ReminderContext.Provider value={value}>
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) {
    throw new Error('useReminders must be used within a ReminderProvider');
  }
  return context;
}

// 2. Hook para estatísticas em tempo real
export function useReminderStats() {
  const { stats, isChecking, lastCheck } = useReminders();
  
  return {
    ...stats,
    isLoading: isChecking,
    lastUpdate: lastCheck,
    hasActivity: stats.pendingMaintenance > 0 || stats.pendingEvaluation > 0
  };
}

// 3. Componente de Dashboard simplificado
export function ReminderDashboard() {
  const { stats, isChecking, lastCheck } = useReminders();
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Sistema de Lembretes
        </h3>
        {isChecking && (
          <div className="flex items-center text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Verificando...
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {stats.pendingMaintenance}
          </div>
          <div className="text-sm text-gray-500">Manutenção Pendente</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {stats.pendingEvaluation}
          </div>
          <div className="text-sm text-gray-500">Avaliação Pendente</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {stats.totalSentToday}
          </div>
          <div className="text-sm text-gray-500">Enviados Hoje</div>
        </div>
      </div>
      
      {lastCheck && (
        <div className="mt-4 text-xs text-gray-400 text-center">
          Última verificação: {lastCheck.toLocaleString('pt-BR')}
        </div>
      )}
    </div>
  );
}

// 4. Utilitário para limpeza de cache
export const ReminderCacheUtils = {
  clearAll: () => ReminderCache.clear(),
  clearSettings: () => {
    ReminderCache.clear('maintenance-settings');
    ReminderCache.clear('evaluation-settings');
  },
  clearPending: () => {
    ReminderCache.clear('pending-maintenance');
    ReminderCache.clear('pending-evaluation');
  }
};
