-- Criar tabela para configurações da empresa
-- Esta tabela armazenará as informações da empresa que são usadas nas mensagens WhatsApp

CREATE TABLE IF NOT EXISTS configuracoes_empresa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_empresa TEXT NOT NULL DEFAULT 'Serviços prime Luthieria - Samuel Luthier',
  cnpj TEXT DEFAULT '30.057.854/0001-75',
  horario_funcionamento TEXT NOT NULL DEFAULT '10h às 13h | 14h às 18h',
  dias_funcionamento TEXT NOT NULL DEFAULT 'Segunda a Sábado',
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE configuracoes_empresa ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam e editem apenas suas próprias configurações
CREATE POLICY "Users can view own company config" ON configuracoes_empresa
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company config" ON configuracoes_empresa
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company config" ON configuracoes_empresa
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own company config" ON configuracoes_empresa
  FOR DELETE USING (auth.uid() = user_id);

-- Comentário explicativo
COMMENT ON TABLE configuracoes_empresa IS 
'Armazena as configurações da empresa utilizadas nas mensagens WhatsApp e outros contextos do sistema';
