-- Script para criar lembretes de avaliação para TODAS as ordens já concluídas
-- Execute este script APÓS aplicar as migrations
-- IMPORTANTE: Carrega TODAS as ordens concluídas (sem limite de tempo)

INSERT INTO evaluation_reminders (
  user_id,
  ordem_servico_id,
  cliente_id,
  service_completion_date,
  evaluation_reminder_sent,
  instagram_reminder_sent,
  reminder_count,
  is_active,
  created_at,
  updated_at
)
SELECT DISTINCT
  os.user_id,
  os.id as ordem_servico_id,
  os.cliente_id,
  COALESCE(os.data_entrega::DATE, os.updated_at::DATE, CURRENT_DATE) as service_completion_date,
  false as evaluation_reminder_sent,
  false as instagram_reminder_sent,
  0 as reminder_count,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM ordens_servico os
WHERE os.status = 'concluido'
  AND os.id NOT IN (
    -- Não inserir se já existe lembrete para esta ordem
    SELECT ordem_servico_id 
    FROM evaluation_reminders 
    WHERE ordem_servico_id = os.id
  )
  AND os.cliente_id IS NOT NULL;

-- Estatísticas completas após carregar todas as ordens
SELECT 
  COUNT(*) as total_lembretes_criados,
  COUNT(CASE WHEN (CURRENT_DATE - service_completion_date) >= 7 THEN 1 END) as prontos_para_envio_imediato,
  COUNT(CASE WHEN (CURRENT_DATE - service_completion_date) < 7 THEN 1 END) as aguardando_7_dias,
  MIN(service_completion_date) as ordem_mais_antiga,
  MAX(service_completion_date) as ordem_mais_recente
FROM evaluation_reminders 
WHERE created_at >= NOW() - INTERVAL '1 minute';

-- Contagem por usuário
SELECT 
  user_id,
  COUNT(*) as lembretes_por_usuario,
  COUNT(CASE WHEN (CURRENT_DATE - service_completion_date) >= 7 THEN 1 END) as prontos_para_envio
FROM evaluation_reminders 
WHERE created_at >= NOW() - INTERVAL '1 minute'
GROUP BY user_id
ORDER BY lembretes_por_usuario DESC;

-- Log de sucesso
SELECT 'TODAS as ordens concluídas foram carregadas no sistema de lembretes!' as status;
