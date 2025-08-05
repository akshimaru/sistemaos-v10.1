-- Correção do trigger de lembretes de manutenção
-- Data: 2025-07-11
-- Motivo: Erro "INSERT has more target columns than expressions" na função update_maintenance_reminder

-- 1) Recriar a função com o valor de updated_at incluído
CREATE OR REPLACE FUNCTION update_maintenance_reminder()
RETURNS TRIGGER AS $$
BEGIN
  -- Executa apenas quando status muda para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Inserir ou atualizar o lembrete de manutenção
    INSERT INTO maintenance_reminders (
      user_id,
      cliente_id,
      instrumento_id,
      last_service_date,
      updated_at
    ) VALUES (
      (SELECT user_id FROM clientes WHERE id = NEW.cliente_id LIMIT 1),
      NEW.cliente_id,
      NEW.instrumento_id,
      CURRENT_DATE,
      NOW()  -- INCLUÍDO: valor para updated_at
    )
    ON CONFLICT (user_id, cliente_id, instrumento_id)
    DO UPDATE SET
      last_service_date = CURRENT_DATE,
      last_reminder_sent = NULL,
      reminder_count = 0,
      is_active = true,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Recriar o trigger para garantir que a nova função seja usada
DROP TRIGGER IF EXISTS update_maintenance_reminder_trigger ON ordens_servico;
CREATE TRIGGER update_maintenance_reminder_trigger
  AFTER UPDATE ON ordens_servico
  FOR EACH ROW
  WHEN (NEW.status = 'concluido')
  EXECUTE FUNCTION update_maintenance_reminder();

-- 3) Mensagem de verificação
DO $$
BEGIN
  RAISE NOTICE 'Trigger update_maintenance_reminder corrigido: updated_at incluso';
END$$;
