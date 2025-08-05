-- Migration: Tabela para configurações da empresa
-- Data: 2025-08-02
-- Descrição: Centralizar todas as configurações da empresa

BEGIN;

-- Criar tabela empresa_config se não existir
CREATE TABLE IF NOT EXISTS empresa_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Serviços Prime Luthieria',
  telefone TEXT DEFAULT '(61) 99999-9999',
  endereco TEXT DEFAULT '',
  email TEXT DEFAULT '',
  cnpj TEXT DEFAULT '',
  website TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE empresa_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own empresa config" ON empresa_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own empresa config" ON empresa_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own empresa config" ON empresa_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own empresa config" ON empresa_config
  FOR DELETE USING (auth.uid() = user_id);

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION update_empresa_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp
CREATE TRIGGER update_empresa_config_updated_at_trigger
  BEFORE UPDATE ON empresa_config
  FOR EACH ROW
  EXECUTE FUNCTION update_empresa_config_updated_at();

-- Comentários
COMMENT ON TABLE empresa_config IS 'Configurações da empresa do usuário';
COMMENT ON COLUMN empresa_config.nome IS 'Nome da empresa';
COMMENT ON COLUMN empresa_config.telefone IS 'Telefone principal da empresa';
COMMENT ON COLUMN empresa_config.endereco IS 'Endereço completo da empresa';
COMMENT ON COLUMN empresa_config.email IS 'E-mail de contato da empresa';

COMMIT;

-- Log de sucesso
SELECT 'Migration empresa_config aplicada com sucesso' as status;
