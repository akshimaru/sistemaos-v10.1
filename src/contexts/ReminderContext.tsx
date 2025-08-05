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

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) {
    throw new Error('useReminders must be used within a ReminderProvider');
  }
  return context;
}

interface ReminderProviderProps {
  children: React.ReactNode;
}

export function ReminderProvider({ children }: ReminderProviderProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [stats, setStats] = useState<ReminderStats>({
    pendingMaintenance: 0,
    pendingEvaluation: 0,
    totalSentToday: 0
  });

  async function checkReminders() {
    // Evitar múltiplas execuções simultâneas
    if (isCheckingRef.current) return;
    
    try {
      isCheckingRef.current = true;
      setIsChecking(true);
      
      // Verificar apenas em horário comercial
      const now = new Date();
      const hour = now.getHours();
      
      if (hour < 8 || hour > 18) {
        console.log('🕐 Fora do horário comercial, pulando verificação');
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

      // Verificar lembretes de manutenção
      if (maintenanceSettings.reminder_enabled) {
        const [targetHour] = maintenanceSettings.reminder_time.split(':').map(Number);
        const currentHour = now.getHours();
        
        // Verificar se está próximo do horário configurado (margem de 1 hora)
        if (Math.abs(currentHour - targetHour) <= 1) {
          console.log('🔧 Verificando lembretes de manutenção automáticos...');
          
          const result = await MaintenanceReminderService.processAutomaticReminders();
          totalSent += result.sent;
          totalErrors += result.errors;
          
          if (result.sent > 0) {
            console.log(`✅ ${result.sent} lembrete(s) de manutenção enviado(s)`);
          }
          
          if (result.errors > 0) {
            console.error(`❌ ${result.errors} erro(s) ao enviar lembretes de manutenção`);
          }
        }
      }

      // Verificar lembretes de avaliação
      if (evaluationSettings.evaluation_reminder_enabled) {
        const [evalHours] = evaluationSettings.evaluation_reminder_time.split(':').map(Number);
        const currentHour = now.getHours();
        
        if (Math.abs(currentHour - evalHours) <= 1) {
          console.log('⭐ Verificando lembretes de avaliação automáticos...');
          
          const result = await EvaluationReminderService.processAutomaticReminders();
          totalSent += result.sent;
          totalErrors += result.errors;
          
          if (result.sent > 0) {
            console.log(`✅ ${result.sent} lembrete(s) de avaliação enviado(s)`);
          }
          
          if (result.errors > 0) {
            console.error(`❌ ${result.errors} erro(s) ao enviar lembretes de avaliação`);
          }
        }
      }

      // Atualizar estatísticas
      await updateStats();
      setLastCheck(new Date());

      if (totalSent > 0) {
        console.log(`🏁 Total: ${totalSent} lembrete(s) enviado(s) com sucesso`);
      }

    } catch (error) {
      console.error('💥 Erro durante verificação de lembretes:', error);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
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
        totalSentToday: 0 // TODO: Implementar contagem de hoje
      });
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
    }
  }

  useEffect(() => {
    // Verificar a cada 4 horas em vez de 1 hora (60% menos carga)
    intervalRef.current = setInterval(checkReminders, 4 * 60 * 60 * 1000);

    // Verificação inicial apenas em horário comercial
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 8 && hour <= 18) {
      // Aguardar 30 segundos para não impactar a inicialização
      setTimeout(() => {
        checkReminders();
        updateStats();
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

// Hook para estatísticas em tempo real
export function useReminderStats() {
  const { stats, isChecking, lastCheck } = useReminders();
  
  return {
    ...stats,
    isLoading: isChecking,
    lastUpdate: lastCheck,
    hasActivity: stats.pendingMaintenance > 0 || stats.pendingEvaluation > 0
  };
}

// Utilitário para limpeza de cache
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
