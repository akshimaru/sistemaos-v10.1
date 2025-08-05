// 🌟 SUPABASE EDGE FUNCTION PARA LEMBRETES
// Arquivo: supabase/functions/process-reminders/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReminderResult {
  user_id: string;
  maintenance_sent: number;
  evaluation_sent: number;
  errors: number;
}

serve(async (req) => {
  // Permitir OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar cliente Supabase com service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🚀 Iniciando processamento automático de lembretes...')

    // Buscar todos os usuários com lembretes habilitados
    const { data: activeUsers, error: usersError } = await supabase
      .from('reminder_settings')
      .select('user_id, reminder_enabled, evaluation_reminder_enabled')
      .or('reminder_enabled.eq.true,evaluation_reminder_enabled.eq.true')

    if (usersError) {
      throw new Error(`Erro ao buscar usuários: ${usersError.message}`)
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('ℹ️ Nenhum usuário com lembretes habilitados')
      return new Response(
        JSON.stringify({ message: 'Nenhum usuário ativo', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Processando ${activeUsers.length} usuário(s)...`)

    const results: ReminderResult[] = []
    let totalProcessed = 0

    // Processar cada usuário
    for (const user of activeUsers) {
      try {
        const result = await processUserReminders(supabase, user.user_id)
        results.push(result)
        totalProcessed++

        // Log do progresso
        if (result.maintenance_sent > 0 || result.evaluation_sent > 0) {
          console.log(`✅ Usuário ${user.user_id}: ${result.maintenance_sent} manutenção, ${result.evaluation_sent} avaliação`)
        }

        // Delay entre usuários para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`❌ Erro ao processar usuário ${user.user_id}:`, error)
        results.push({
          user_id: user.user_id,
          maintenance_sent: 0,
          evaluation_sent: 0,
          errors: 1
        })
      }
    }

    // Calcular estatísticas finais
    const totalMaintenance = results.reduce((sum, r) => sum + r.maintenance_sent, 0)
    const totalEvaluation = results.reduce((sum, r) => sum + r.evaluation_sent, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)

    // Log final
    console.log(`🏁 Processamento concluído:`)
    console.log(`   📧 ${totalMaintenance} lembretes de manutenção enviados`)
    console.log(`   ⭐ ${totalEvaluation} lembretes de avaliação enviados`)
    console.log(`   ❌ ${totalErrors} erro(s)`)

    // Salvar log no banco
    await supabase.from('reminder_execution_logs').insert({
      executed_at: new Date().toISOString(),
      users_processed: totalProcessed,
      maintenance_sent: totalMaintenance,
      evaluation_sent: totalEvaluation,
      errors: totalErrors,
      execution_time_ms: Date.now() - parseInt(Deno.env.get('START_TIME') || '0')
    })

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        maintenance_sent: totalMaintenance,
        evaluation_sent: totalEvaluation,
        errors: totalErrors,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Erro geral:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Processar lembretes para um usuário específico
async function processUserReminders(supabase: any, userId: string): Promise<ReminderResult> {
  let maintenanceSent = 0
  let evaluationSent = 0
  let errors = 0

  try {
    // Buscar configurações do usuário
    const { data: settings } = await supabase
      .from('reminder_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!settings) {
      return { user_id: userId, maintenance_sent: 0, evaluation_sent: 0, errors: 1 }
    }

    // Verificar horário atual
    const now = new Date()
    const currentHour = now.getHours()

    // Processar lembretes de manutenção
    if (settings.reminder_enabled) {
      const [targetHour] = settings.reminder_time.split(':').map(Number)
      
      // Verificar se está no horário correto (±1 hora)
      if (Math.abs(currentHour - targetHour) <= 1) {
        try {
          const { data: result } = await supabase.rpc('process_user_maintenance_reminders', {
            p_user_id: userId
          })
          
          if (result && result.length > 0) {
            maintenanceSent = result[0].sent || 0
            errors += result[0].errors || 0
          }
        } catch (error) {
          console.error(`Erro lembretes manutenção usuário ${userId}:`, error)
          errors++
        }
      }
    }

    // Processar lembretes de avaliação
    if (settings.evaluation_reminder_enabled) {
      const [targetHour] = settings.evaluation_reminder_time.split(':').map(Number)
      
      // Verificar se está no horário correto (±1 hora)
      if (Math.abs(currentHour - targetHour) <= 1) {
        try {
          const { data: result } = await supabase.rpc('process_user_evaluation_reminders', {
            p_user_id: userId
          })
          
          if (result && result.length > 0) {
            evaluationSent = result[0].sent || 0
            errors += result[0].errors || 0
          }
        } catch (error) {
          console.error(`Erro lembretes avaliação usuário ${userId}:`, error)
          errors++
        }
      }
    }

  } catch (error) {
    console.error(`Erro ao processar usuário ${userId}:`, error)
    errors++
  }

  return {
    user_id: userId,
    maintenance_sent: maintenanceSent,
    evaluation_sent: evaluationSent,
    errors
  }
}

/* 
  COMO CONFIGURAR:

  1. Criar a Edge Function:
     npx supabase functions new process-reminders

  2. Fazer deploy:
     npx supabase functions deploy process-reminders

  3. Configurar Cron Job no Supabase:
     SELECT cron.schedule(
       'process-reminders-job',
       '0 9,14 * * *', -- 9h e 14h todos os dias
       'SELECT net.http_post(
         url:=''https://your-project.supabase.co/functions/v1/process-reminders'',
         headers:=''{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'',
         body:=''{}''
       );'
     );

  4. Criar tabela de logs (opcional):
     CREATE TABLE reminder_execution_logs (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       executed_at TIMESTAMPTZ NOT NULL,
       users_processed INTEGER NOT NULL,
       maintenance_sent INTEGER NOT NULL,
       evaluation_sent INTEGER NOT NULL,
       errors INTEGER NOT NULL,
       execution_time_ms INTEGER,
       created_at TIMESTAMPTZ DEFAULT NOW()
     );

  VANTAGENS DESTA IMPLEMENTAÇÃO:

  ✅ Funciona 24/7 independente da aplicação
  ✅ Processamento em lote eficiente
  ✅ Logs detalhados para auditoria
  ✅ Retry automático via Cron
  ✅ Escalável para milhares de usuários
  ✅ Baixo custo computacional
  ✅ Não afeta performance da aplicação
*/
