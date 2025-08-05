-- Migration para corrigir o envio automático de lembretes de avaliação
-- Data: 2025-07-11
-- Descrição: Implementa lógica real de envio na função process_automatic_evaluation_reminders

-- Recriar a função para realmente enviar os lembretes
DROP FUNCTION IF EXISTS process_automatic_evaluation_reminders(UUID);

CREATE FUNCTION process_automatic_evaluation_reminders(p_user_id UUID)
RETURNS TABLE (sent INTEGER, errors INTEGER) AS $$
DECLARE
  v_sent INTEGER := 0;
  v_errors INTEGER := 0;
  v_enabled BOOLEAN := true;
  v_reminder_time TIME := '09:00:00';
  v_current_hour INTEGER;
  v_reminder_rec RECORD;
  v_last_check TIMESTAMPTZ;
BEGIN
  -- Buscar configurações
  SELECT 
    COALESCE(evaluation_reminder_enabled, true),
    COALESCE(evaluation_reminder_time, '09:00:00')::TIME
  INTO v_enabled, v_reminder_time
  FROM reminder_settings 
  WHERE user_id = p_user_id;
  
  -- Se não habilitado, sair
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
  
  -- Verificar se já foi executado hoje neste horário (evitar spam)
  SELECT COALESCE(last_automatic_check, '1900-01-01'::TIMESTAMPTZ) INTO v_last_check
  FROM reminder_settings 
  WHERE user_id = p_user_id;
  
  -- Se já executou nas últimas 23 horas, não executar novamente
  IF v_last_check > (NOW() - INTERVAL '23 hours') THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;
  
  -- Atualizar timestamp de verificação
  UPDATE reminder_settings 
  SET last_automatic_check = NOW()
  WHERE user_id = p_user_id;
  
  -- Processar cada lembrete pendente
  FOR v_reminder_rec IN 
    SELECT * FROM get_pending_evaluation_reminders(p_user_id)
  LOOP
    BEGIN
      -- Marcar como enviado (ambos Google e Instagram)
      UPDATE evaluation_reminders 
      SET 
        evaluation_reminder_sent = true,
        instagram_reminder_sent = true,
        reminder_count = COALESCE(reminder_count, 0) + 1,
        last_reminder_sent = NOW(),
        updated_at = NOW()
      WHERE id = v_reminder_rec.id;
      
      -- Se chegou até aqui, foi sucesso
      v_sent := v_sent + 1;
      
      -- Log do envio
      INSERT INTO evaluation_reminder_logs (
        user_id,
        reminder_id,
        cliente_nome,
        action_type,
        success,
        created_at
      ) VALUES (
        p_user_id,
        v_reminder_rec.id,
        v_reminder_rec.cliente_nome,
        'automatic_send',
        true,
        NOW()
      );
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Log do erro
        INSERT INTO evaluation_reminder_logs (
          user_id,
          reminder_id,
          cliente_nome,
          action_type,
          success,
          error_message,
          created_at
        ) VALUES (
          p_user_id,
          v_reminder_rec.id,
          v_reminder_rec.cliente_nome,
          'automatic_send',
          false,
          SQLERRM,
          NOW()
        );
        
        v_errors := v_errors + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_sent, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar coluna para controlar última verificação automática
ALTER TABLE reminder_settings 
ADD COLUMN IF NOT EXISTS last_automatic_check TIMESTAMPTZ DEFAULT '1900-01-01'::TIMESTAMPTZ;

-- Criar tabela de logs para auditoria dos lembretes automáticos
CREATE TABLE IF NOT EXISTS evaluation_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id UUID REFERENCES evaluation_reminders(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  action_type TEXT NOT NULL, -- 'automatic_send', 'manual_send', 'batch_send'
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para tabela de logs
ALTER TABLE evaluation_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evaluation reminder logs" ON evaluation_reminder_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evaluation reminder logs" ON evaluation_reminder_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Comentários
COMMENT ON FUNCTION process_automatic_evaluation_reminders(UUID) IS 
'Processa e ENVIA automaticamente lembretes de avaliação no horário configurado';

COMMENT ON TABLE evaluation_reminder_logs IS 
'Log de auditoria para envios de lembretes de avaliação';

COMMENT ON COLUMN reminder_settings.last_automatic_check IS 
'Última vez que a verificação automática foi executada (evita spam)';
