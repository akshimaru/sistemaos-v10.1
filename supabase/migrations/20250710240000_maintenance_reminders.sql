-- Criar tabela para controle de lembretes de manutenção
-- Esta tabela rastreia quando foram enviados lembretes e configurações do sistema

CREATE TABLE IF NOT EXISTS maintenance_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL,
  instrumento_id UUID,
  last_service_date DATE NOT NULL,
  last_reminder_sent DATE,
  reminder_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, cliente_id, instrumento_id)
);

-- Configurações para lembretes automáticos
CREATE TABLE IF NOT EXISTS reminder_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_interval_months INTEGER DEFAULT 6, -- Intervalo em meses para enviar lembrete
  max_reminders_per_client INTEGER DEFAULT 3, -- Máximo de lembretes por cliente
  reminder_time TIME DEFAULT '09:00:00', -- Horário para envio automático
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE maintenance_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para maintenance_reminders
CREATE POLICY "Users can view own reminders" ON maintenance_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders" ON maintenance_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders" ON maintenance_reminders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders" ON maintenance_reminders
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para reminder_settings
CREATE POLICY "Users can view own reminder settings" ON reminder_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminder settings" ON reminder_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminder settings" ON reminder_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminder settings" ON reminder_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Função para atualizar automaticamente os lembretes quando uma ordem é finalizada
CREATE OR REPLACE FUNCTION update_maintenance_reminder()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executa se o status mudou para 'concluido'
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
      CURRENT_DATE
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

-- Trigger para atualizar lembretes quando ordem é finalizada
CREATE TRIGGER update_maintenance_reminder_trigger
  AFTER UPDATE ON ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_reminder();

-- Comentários explicativos
COMMENT ON TABLE maintenance_reminders IS 
'Controla lembretes de manutenção preventiva para clientes e instrumentos';

COMMENT ON TABLE reminder_settings IS 
'Configurações globais para o sistema de lembretes automáticos';

COMMENT ON FUNCTION update_maintenance_reminder() IS 
'Atualiza automaticamente os lembretes quando uma ordem de serviço é finalizada';
