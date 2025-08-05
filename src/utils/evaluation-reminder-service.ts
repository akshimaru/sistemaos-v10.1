import { supabase } from '../lib/supabase';
import { WhatsAppService } from './whatsapp-service';
import { TemplateService } from './template-service';

export interface EvaluationReminder {
  id: string;
  ordem_servico_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  instrumento_nome: string;
  marca_nome: string;
  modelo: string;
  service_completion_date: string;
  days_since_completion: number;
  evaluation_reminder_sent: boolean;
  instagram_reminder_sent: boolean;
}

export interface EvaluationReminderSettings {
  evaluation_reminder_enabled: boolean;
  evaluation_reminder_days: number;
  max_evaluation_reminders_per_client: number;
  evaluation_reminder_time: string;
  google_review_link: string;
  instagram_handle: string;
}

export class EvaluationReminderService {
  
  static async getPendingReminders(): Promise<EvaluationReminder[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.rpc('get_pending_evaluation_reminders', {
        p_user_id: user.id
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar lembretes de avaliação pendentes:', error);
      throw error;
    }
  }

  static async getSettings(): Promise<EvaluationReminderSettings> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('reminder_settings')
        .select('evaluation_reminder_enabled, evaluation_reminder_days, max_evaluation_reminders_per_client, evaluation_reminder_time, google_review_link, instagram_handle')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || {
        evaluation_reminder_enabled: true,
        evaluation_reminder_days: 7,
        max_evaluation_reminders_per_client: 3,
        evaluation_reminder_time: '09:00',
        google_review_link: '',
        instagram_handle: '@luthieriabrasilia'
      };
    } catch (error) {
      console.error('Erro ao buscar configurações de lembretes de avaliação:', error);
      throw error;
    }
  }

  static async saveSettings(settings: EvaluationReminderSettings): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('reminder_settings')
        .upsert({
          user_id: user.id,
          evaluation_reminder_enabled: settings.evaluation_reminder_enabled,
          evaluation_reminder_days: settings.evaluation_reminder_days,
          max_evaluation_reminders_per_client: settings.max_evaluation_reminders_per_client,
          evaluation_reminder_time: settings.evaluation_reminder_time,
          google_review_link: settings.google_review_link,
          instagram_handle: settings.instagram_handle,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao salvar configurações de lembretes de avaliação:', error);
      throw error;
    }
  }

  static async markReminderSent(reminderId: string, type: 'evaluation' | 'instagram'): Promise<void> {
    try {
      const { error } = await supabase.rpc('mark_evaluation_reminder_sent', {
        p_reminder_id: reminderId,
        p_reminder_type: type
      });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao marcar lembrete como enviado:', error);
      throw error;
    }
  }

  static async markReminderComplete(reminderId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('mark_evaluation_reminder_complete', {
        p_reminder_id: reminderId
      });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao marcar lembrete como completo:', error);
      throw error;
    }
  }

  static async sendEvaluationReminder(reminder: EvaluationReminder, settings: EvaluationReminderSettings): Promise<boolean> {
    try {
      // Import WhatsApp service
      // Preparar dados para o template
      const templateData = {
        cliente: reminder.cliente_nome,
        instrumento: reminder.instrumento_nome,
        marca: reminder.marca_nome || '',
        modelo: reminder.modelo || '',
        numero: reminder.ordem_servico_id.slice(-8), // Últimos 8 caracteres do ID
        nome_empresa: 'Serviços Prime Luthieria - Samuel Luthier',
        telefone_empresa: '(61) 99999-9999', // Usar telefone configurado
        google_review_link: settings.google_review_link || 'https://g.page/r/SEU_PERFIL_GOOGLE/review',
        instagram_handle: settings.instagram_handle || '@luthieriabrasilia'
      };

      // Gerar mensagem usando template
      const message = await TemplateService.processTemplate('avaliacao_google_instagram', templateData, {
        nome_empresa: templateData.nome_empresa,
        telefone_empresa: templateData.telefone_empresa
      });

      // Enviar mensagem
      const success = await WhatsAppService.sendMessage(reminder.cliente_telefone, message);
      
      if (success) {
        // Marcar ambos os lembretes como enviados (Google e Instagram em uma única mensagem)
        await this.markReminderComplete(reminder.id);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao enviar lembrete de avaliação:', error);
      throw error;
    }
  }

  static async processAutomaticReminders(): Promise<{ sent: number; errors: number }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Primeiro, buscar lembretes pendentes antes de processá-los
      const pendingReminders = await this.getPendingReminders();
      const settings = await this.getSettings();
      
      if (pendingReminders.length === 0) {
        return { sent: 0, errors: 0 };
      }

      // Verificar se é hora de enviar (tolerância de 1 hora)
      const now = new Date();
      const currentHour = now.getHours();
      const [targetHour] = settings.evaluation_reminder_time.split(':').map(Number);
      
      if (Math.abs(currentHour - targetHour) > 1) {
        return { sent: 0, errors: 0 };
      }

      console.log(`🤖 Processamento automático: ${pendingReminders.length} lembrete(s) para enviar`);

      let sent = 0;
      let errors = 0;

      // Enviar cada lembrete via WhatsApp
      for (const reminder of pendingReminders) {
        try {
          const success = await this.sendEvaluationReminder(reminder, settings);
          if (success) {
            sent++;
            console.log(`✅ Lembrete automático enviado para ${reminder.cliente_nome}`);
          } else {
            errors++;
            console.error(`❌ Falha ao enviar lembrete automático para ${reminder.cliente_nome}`);
          }
        } catch (error) {
          console.error(`❌ Erro ao enviar lembrete automático para ${reminder.cliente_nome}:`, error);
          errors++;
        }
      }

      console.log(`🤖 Processamento automático concluído: ${sent} enviados, ${errors} erros`);
      return { sent, errors };
    } catch (error) {
      console.error('Erro ao processar lembretes automáticos de avaliação:', error);
      throw error;
    }
  }

  static async sendAllPendingReminders(): Promise<{ sent: number; errors: number }> {
    try {
      const pendingReminders = await this.getPendingReminders();
      const settings = await this.getSettings();
      
      let sent = 0;
      let errors = 0;

      for (const reminder of pendingReminders) {
        try {
          const success = await this.sendEvaluationReminder(reminder, settings);
          if (success) {
            sent++;
          } else {
            errors++;
          }
        } catch (error) {
          console.error(`Erro ao enviar lembrete para ${reminder.cliente_nome}:`, error);
          errors++;
        }
      }

      return { sent, errors };
    } catch (error) {
      console.error('Erro ao enviar todos os lembretes de avaliação:', error);
      throw error;
    }
  }
}
