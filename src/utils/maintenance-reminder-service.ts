import { supabase } from '../lib/supabase';
import { WhatsAppService } from './whatsapp-service';
import { TemplateService } from './template-service';

export interface MaintenanceReminder {
  id: string;
  cliente_id: string;
  instrumento_id: string;
  last_service_date: string;
  last_reminder_sent?: string;
  reminder_count: number;
  is_active: boolean;
  cliente?: any;
  instrumento?: any;
}

export interface ReminderSettings {
  reminder_enabled: boolean;
  reminder_interval_months: number;
  max_reminders_per_client: number;
  reminder_time: string;
}

export class MaintenanceReminderService {
  static async getSettings(): Promise<ReminderSettings> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return this.getDefaultSettings();
      }

      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        return this.getDefaultSettings();
      }

      return {
        reminder_enabled: data.reminder_enabled,
        reminder_interval_months: data.reminder_interval_months,
        max_reminders_per_client: data.max_reminders_per_client,
        reminder_time: data.reminder_time
      };
    } catch (error) {
      console.error('Erro ao carregar configurações de lembrete:', error);
      return this.getDefaultSettings();
    }
  }

  static getDefaultSettings(): ReminderSettings {
    return {
      reminder_enabled: true,
      reminder_interval_months: 6,
      max_reminders_per_client: 3,
      reminder_time: '09:00:00'
    };
  }

  static async saveSettings(settings: ReminderSettings): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { error } = await supabase
      .from('reminder_settings')
      .upsert({
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      throw new Error(`Erro ao salvar configurações: ${error.message}`);
    }
  }

  static async getPendingReminders(): Promise<MaintenanceReminder[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const settings = await this.getSettings();
      if (!settings.reminder_enabled) return [];

      // Calcular data limite (6 meses - 1 dia = 5 meses e 29 dias atrás)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - settings.reminder_interval_months);
      cutoffDate.setDate(cutoffDate.getDate() + 1); // +1 dia para 5 meses e 29 dias

      const { data, error } = await supabase
        .from('maintenance_reminders')
        .select(`
          *,
          cliente:cliente_id(id, nome, telefone),
          instrumento:instrumento_id(id, nome, marca)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .lte('last_service_date', cutoffDate.toISOString().split('T')[0])
        .lt('reminder_count', settings.max_reminders_per_client)
        .or(`last_reminder_sent.is.null,last_reminder_sent.lt.${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`); // Último lembrete há mais de 30 dias

      if (error) {
        console.error('Erro ao buscar lembretes pendentes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao obter lembretes pendentes:', error);
      return [];
    }
  }

  static async sendMaintenanceReminder(reminder: MaintenanceReminder): Promise<boolean> {
    try {
      if (!reminder.cliente?.telefone) {
        console.warn(`Cliente ${reminder.cliente?.nome} não possui telefone cadastrado`);
        return false;
      }

      // Calcular meses sem manutenção
      const lastServiceDate = new Date(reminder.last_service_date);
      const today = new Date();
      const monthsDiff = Math.floor(
        (today.getTime() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );

      // Carregar configurações da empresa
      const empresaConfig = await WhatsAppService.loadEmpresaConfig();

      // Dados para o template
      const templateData = {
        cliente: reminder.cliente,
        instrumento: reminder.instrumento,
        ultimo_servico: lastServiceDate.toLocaleDateString('pt-BR'),
        meses_sem_manutencao: monthsDiff.toString()
      };

      // Processar template
      const message = await TemplateService.processTemplate('lembrete_manutencao', templateData, empresaConfig);

      // Enviar mensagem
      const success = await WhatsAppService.sendMessage(reminder.cliente.telefone, message);

      if (success) {
        // Atualizar registro do lembrete
        await this.markReminderSent(reminder.id);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erro ao enviar lembrete de manutenção:', error);
      return false;
    }
  }

  static async markReminderSent(reminderId: string): Promise<void> {
    // Primeiro buscar o contador atual
    const { data: current, error: fetchError } = await supabase
      .from('maintenance_reminders')
      .select('reminder_count')
      .eq('id', reminderId)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar contador atual:', fetchError);
      return;
    }

    const { error } = await supabase
      .from('maintenance_reminders')
      .update({
        last_reminder_sent: new Date().toISOString().split('T')[0],
        reminder_count: (current?.reminder_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', reminderId);

    if (error) {
      console.error('Erro ao marcar lembrete como enviado:', error);
    }
  }

  static async processAutomaticReminders(): Promise<{ sent: number; errors: number }> {
    try {
      const pendingReminders = await this.getPendingReminders();
      console.log(`Processando ${pendingReminders.length} lembretes pendentes`);

      let sent = 0;
      let errors = 0;

      for (const reminder of pendingReminders) {
        try {
          const success = await this.sendMaintenanceReminder(reminder);
          if (success) {
            sent++;
            console.log(`Lembrete enviado para ${reminder.cliente?.nome}`);
          } else {
            errors++;
            console.log(`Falha ao enviar lembrete para ${reminder.cliente?.nome}`);
          }

          // Aguardar 2 segundos entre envios para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          errors++;
          console.error(`Erro ao processar lembrete para ${reminder.cliente?.nome}:`, error);
        }
      }

      return { sent, errors };
    } catch (error) {
      console.error('Erro ao processar lembretes automáticos:', error);
      return { sent: 0, errors: 1 };
    }
  }

  static async getAllReminders(): Promise<MaintenanceReminder[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('maintenance_reminders')
        .select(`
          *,
          cliente:cliente_id(id, nome, telefone),
          instrumento:instrumento_id(id, nome, marca)
        `)
        .eq('user_id', user.id)
        .order('last_service_date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar todos os lembretes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao obter todos os lembretes:', error);
      return [];
    }
  }

  static async deactivateReminder(reminderId: string): Promise<void> {
    const { error } = await supabase
      .from('maintenance_reminders')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', reminderId);

    if (error) {
      console.error('Erro ao desativar lembrete:', error);
      throw new Error('Erro ao desativar lembrete');
    }
  }
}
