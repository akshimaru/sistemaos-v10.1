-- Migration: Configurações avançadas de lembretes de avaliação
-- Data: 2025-07-11
-- Versão: 2

BEGIN;

-- Adicionar apenas as novas colunas necessárias
ALTER TABLE reminder_settings 
  ADD COLUMN IF NOT EXISTS max_evaluation_reminders_per_client INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS evaluation_reminder_time TIME DEFAULT '09:00:00';

-- Adicionar colunas de controle na tabela evaluation_reminders
ALTER TABLE evaluation_reminders 
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_sent TIMESTAMP WITH TIME ZONE;

-- Atualizar função para considerar limite de reenvios
DROP FUNCTION IF EXISTS get_pending_evaluation_reminders(UUID);

CREATE FUNCTION get_pending_evaluation_reminders(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  ordem_servico_id UUID,
  cliente_nome TEXT,
  cliente_telefone TEXT,
  instrumento_nome TEXT,
  marca_nome TEXT,
  modelo TEXT,
  service_completion_date DATE,
  days_since_completion INTEGER,
  evaluation_reminder_sent BOOLEAN,
  instagram_reminder_sent BOOLEAN,
  reminder_count INTEGER
) AS $$
DECLARE
  v_max_reminders INTEGER := 3;
  v_reminder_days INTEGER := 7;
BEGIN
  -- Buscar configurações do usuário
  SELECT 
    COALESCE(max_evaluation_reminders_per_client, 3),
    COALESCE(evaluation_reminder_days, 7)
  INTO v_max_reminders, v_reminder_days
  FROM reminder_settings 
  WHERE user_id = p_user_id;

  RETURN QUERY
  SELECT 
    er.id,
    er.ordem_servico_id,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    i.nome as instrumento_nome,
    m.nome as marca_nome,
    os.modelo,
    er.service_completion_date,
    (CURRENT_DATE - er.service_completion_date)::INTEGER as days_since_completion,
    er.evaluation_reminder_sent,
    er.instagram_reminder_sent,
    COALESCE(er.reminder_count, 0) as reminder_count
  FROM evaluation_reminders er
  JOIN ordens_servico os ON er.ordem_servico_id = os.id
  JOIN clientes c ON er.cliente_id = c.id
  LEFT JOIN instrumentos i ON os.instrumento_id = i.id
  LEFT JOIN marcas m ON os.marca_id = m.id
  WHERE er.user_id = p_user_id
    AND er.is_active = true
    AND (CURRENT_DATE - er.service_completion_date) >= v_reminder_days
    AND COALESCE(er.reminder_count, 0) < v_max_reminders
    AND (
      er.evaluation_reminder_sent = false 
      OR er.instagram_reminder_sent = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar lembrete como enviado
DROP FUNCTION IF EXISTS mark_evaluation_reminder_sent(UUID, TEXT);

CREATE FUNCTION mark_evaluation_reminder_sent(
  p_reminder_id UUID,
  p_reminder_type TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE evaluation_reminders 
  SET 
    evaluation_reminder_sent = CASE WHEN p_reminder_type = 'evaluation' THEN true ELSE evaluation_reminder_sent END,
    instagram_reminder_sent = CASE WHEN p_reminder_type = 'instagram' THEN true ELSE instagram_reminder_sent END,
    reminder_count = COALESCE(reminder_count, 0) + 1,
    last_reminder_sent = NOW(),
    updated_at = NOW()
  WHERE id = p_reminder_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para processar lembretes automáticos
DROP FUNCTION IF EXISTS process_automatic_evaluation_reminders(UUID);

CREATE FUNCTION process_automatic_evaluation_reminders(p_user_id UUID)
RETURNS TABLE (sent INTEGER, errors INTEGER) AS $$
DECLARE
  v_sent INTEGER := 0;
  v_errors INTEGER := 0;
  v_enabled BOOLEAN := true;
  v_reminder_time TIME := '09:00:00';
  v_current_hour INTEGER;
BEGIN
  -- Buscar configurações
  SELECT 
    COALESCE(evaluation_reminder_enabled, true),
    COALESCE(evaluation_reminder_time, '09:00:00')
  INTO v_enabled, v_reminder_time
  FROM reminder_settings 
  WHERE user_id = p_user_id;
  
  -- Verificar se está habilitado
  IF NOT v_enabled THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;
  
  -- Verificar horário (tolerância de 1 hora)
  v_current_hour := EXTRACT(HOUR FROM NOW());
  IF ABS(v_current_hour - EXTRACT(HOUR FROM v_reminder_time)) > 1 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;
  
  -- Contar lembretes que seriam enviados
  SELECT COUNT(*) INTO v_sent
  FROM get_pending_evaluation_reminders(p_user_id);
  
  -- Por ora, apenas retornar contagem sem enviar
  RETURN QUERY SELECT v_sent, 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON COLUMN reminder_settings.max_evaluation_reminders_per_client IS 
'Número máximo de lembretes de avaliação por cliente';

COMMENT ON COLUMN reminder_settings.evaluation_reminder_time IS 
'Horário para envio automático dos lembretes de avaliação';

COMMENT ON COLUMN evaluation_reminders.reminder_count IS 
'Contador de lembretes enviados';

COMMENT ON COLUMN evaluation_reminders.last_reminder_sent IS 
'Data do último lembrete enviado';

COMMIT;

-- Log de sucesso
SELECT 'Migration 20250711070000 aplicada com sucesso' as status;
