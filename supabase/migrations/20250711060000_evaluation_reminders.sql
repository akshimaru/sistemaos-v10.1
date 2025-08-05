-- Adicionar sistema de lembretes para avaliação do Google e Instagram
-- Data: 2025-07-11
-- Motivo: Solicitar avaliação após 1 semana da conclusão do serviço

-- Criar tabela para lembretes de avaliação
CREATE TABLE IF NOT EXISTS evaluation_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL,
  service_completion_date DATE NOT NULL,
  evaluation_reminder_sent BOOLEAN DEFAULT false,
  evaluation_reminder_date DATE,
  instagram_reminder_sent BOOLEAN DEFAULT false,
  instagram_reminder_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, ordem_servico_id)
);

-- Habilitar RLS
ALTER TABLE evaluation_reminders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para evaluation_reminders
CREATE POLICY "Users can view own evaluation reminders" ON evaluation_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evaluation reminders" ON evaluation_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evaluation reminders" ON evaluation_reminders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own evaluation reminders" ON evaluation_reminders
  FOR DELETE USING (auth.uid() = user_id);

-- Adicionar configurações para lembretes de avaliação na tabela reminder_settings
ALTER TABLE reminder_settings 
ADD COLUMN IF NOT EXISTS evaluation_reminder_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS evaluation_reminder_days INTEGER DEFAULT 7, -- Dias após conclusão para enviar lembrete
ADD COLUMN IF NOT EXISTS google_review_link TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS instagram_handle TEXT DEFAULT '@luthieriabrasilia';

-- Função para criar lembrete de avaliação quando ordem é finalizada
CREATE OR REPLACE FUNCTION create_evaluation_reminder()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executa se o status mudou para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Inserir lembrete de avaliação
    INSERT INTO evaluation_reminders (
      user_id,
      ordem_servico_id,
      cliente_id,
      service_completion_date,
      updated_at
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.cliente_id,
      CURRENT_DATE,
      NOW()
    ) ON CONFLICT (user_id, ordem_servico_id) 
    DO UPDATE SET 
      service_completion_date = CURRENT_DATE,
      is_active = true,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar lembretes de avaliação quando ordem é finalizada
CREATE TRIGGER create_evaluation_reminder_trigger
  AFTER UPDATE ON ordens_servico
  FOR EACH ROW
  WHEN (NEW.status = 'concluido')
  EXECUTE FUNCTION create_evaluation_reminder();

-- Função para obter lembretes de avaliação pendentes (para usar no sistema)
CREATE OR REPLACE FUNCTION get_pending_evaluation_reminders(p_user_id UUID)
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
  instagram_reminder_sent BOOLEAN
) AS $$
BEGIN
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
    er.instagram_reminder_sent
  FROM evaluation_reminders er
  JOIN ordens_servico os ON er.ordem_servico_id = os.id
  JOIN clientes c ON er.cliente_id = c.id
  LEFT JOIN instrumentos i ON os.instrumento_id = i.id
  LEFT JOIN marcas m ON os.marca_id = m.id
  WHERE er.user_id = p_user_id
    AND er.is_active = true
    AND (CURRENT_DATE - er.service_completion_date) >= 7 -- 7 dias ou mais
    AND (
      er.evaluation_reminder_sent = false 
      OR er.instagram_reminder_sent = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários explicativos
COMMENT ON TABLE evaluation_reminders IS 
'Controla lembretes para solicitar avaliação do Google e convite para Instagram após conclusão de serviços';

COMMENT ON FUNCTION create_evaluation_reminder() IS 
'Cria automaticamente lembretes de avaliação quando uma ordem de serviço é finalizada';

COMMENT ON FUNCTION get_pending_evaluation_reminders(UUID) IS 
'Retorna lembretes de avaliação pendentes para um usuário específico';

-- Verificação
DO $$ 
BEGIN 
    RAISE NOTICE 'Sistema de lembretes de avaliação criado com sucesso';
    RAISE NOTICE 'Lembretes serão enviados 7 dias após conclusão do serviço';
END $$;
