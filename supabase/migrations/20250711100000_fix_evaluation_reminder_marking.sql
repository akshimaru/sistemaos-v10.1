-- Migration para corrigir o sistema de marcação de lembretes de avaliação
-- Data: 2025-07-11
-- Descrição: Adiciona função para marcar ambos os tipos de lembrete (Google + Instagram) de uma vez

-- Função para marcar ambos os lembretes como enviados (usado quando a mensagem contém Google + Instagram)
CREATE OR REPLACE FUNCTION mark_evaluation_reminder_complete(
  p_reminder_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE evaluation_reminders 
  SET 
    evaluation_reminder_sent = true,
    instagram_reminder_sent = true,
    reminder_count = COALESCE(reminder_count, 0) + 1,
    last_reminder_sent = NOW(),
    updated_at = NOW()
  WHERE id = p_reminder_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário da função
COMMENT ON FUNCTION mark_evaluation_reminder_complete(UUID) IS 
'Marca um lembrete de avaliação como completamente enviado (Google Reviews + Instagram)';

-- Atualizar a função de lembretes pendentes para ser mais clara na lógica
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
    AND NOT (er.evaluation_reminder_sent = true AND er.instagram_reminder_sent = true) -- Só é pendente se AMBOS não foram enviados
  ORDER BY er.service_completion_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
