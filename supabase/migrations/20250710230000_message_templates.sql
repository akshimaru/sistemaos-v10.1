-- Criar tabela para templates de mensagens WhatsApp
-- Esta tabela armazenará os templates personalizáveis para diferentes tipos de mensagem

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_type VARCHAR(50) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_content TEXT NOT NULL,
  variables TEXT[], -- Array de variáveis disponíveis para este template
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, template_type)
);

-- Habilitar RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own templates" ON message_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates" ON message_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON message_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON message_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Inserir templates padrão para cada usuário (será feito via código)
-- Os tipos de template suportados:
-- 'nova_ordem' - Nova ordem criada
-- 'servico_finalizado' - Serviço finalizado
-- 'servico_andamento' - Serviço em andamento
-- 'servico_atraso' - Contratempo/atraso
-- 'lembrete_retirada' - Lembrete para retirada
-- 'cobranca_pagamento' - Cobrança/pagamento

-- Comentário explicativo
COMMENT ON TABLE message_templates IS 
'Armazena templates personalizáveis para mensagens WhatsApp do sistema';

COMMENT ON COLUMN message_templates.template_type IS 
'Tipo do template: nova_ordem, servico_finalizado, servico_andamento, servico_atraso, lembrete_retirada, cobranca_pagamento';

COMMENT ON COLUMN message_templates.variables IS 
'Array de variáveis disponíveis como {cliente}, {instrumento}, {numero}, {valor}, etc.';
