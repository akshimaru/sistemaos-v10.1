-- Correção definitiva da tabela whatsapp_logs para resolver erro de INSERT
-- Data: 2025-07-10
-- Problema: "INSERT has more target columns than expressions"

-- Remover todas as dependências e recriar a tabela completamente
DROP TABLE IF EXISTS whatsapp_logs CASCADE;

-- Criar a tabela com estrutura bem definida
CREATE TABLE whatsapp_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar constraints explicitamente
ALTER TABLE whatsapp_logs 
ADD CONSTRAINT whatsapp_logs_method_check 
CHECK (method IN ('direct', 'webhook'));

ALTER TABLE whatsapp_logs 
ADD CONSTRAINT whatsapp_logs_status_check 
CHECK (status IN ('success', 'error'));

-- Habilitar RLS
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Criar políticas
CREATE POLICY "whatsapp_logs_select_policy" ON whatsapp_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "whatsapp_logs_insert_policy" ON whatsapp_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Criar índices para performance
CREATE INDEX idx_whatsapp_logs_user_id ON whatsapp_logs(user_id);
CREATE INDEX idx_whatsapp_logs_sent_at ON whatsapp_logs(sent_at);
CREATE INDEX idx_whatsapp_logs_status ON whatsapp_logs(status);

-- Comentários para documentação
COMMENT ON TABLE whatsapp_logs IS 'Logs de mensagens WhatsApp enviadas pelo sistema - Estrutura corrigida';
COMMENT ON COLUMN whatsapp_logs.id IS 'Identificador único do log (UUID gerado automaticamente)';
COMMENT ON COLUMN whatsapp_logs.user_id IS 'ID do usuário que enviou a mensagem';
COMMENT ON COLUMN whatsapp_logs.phone_number IS 'Número de telefone de destino';
COMMENT ON COLUMN whatsapp_logs.message IS 'Conteúdo da mensagem enviada (limitado a 1000 chars)';
COMMENT ON COLUMN whatsapp_logs.method IS 'Método de envio: direct ou webhook';
COMMENT ON COLUMN whatsapp_logs.status IS 'Status do envio: success ou error';
COMMENT ON COLUMN whatsapp_logs.error_message IS 'Mensagem de erro (opcional, apenas quando status=error)';
COMMENT ON COLUMN whatsapp_logs.sent_at IS 'Timestamp do envio (preenchido automaticamente)';

-- Verificação final da estrutura
DO $$ 
BEGIN 
    -- Verificar se a tabela foi criada com 8 colunas
    IF (SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = 'whatsapp_logs' AND table_schema = 'public') != 8 THEN
        RAISE EXCEPTION 'ERRO: Tabela whatsapp_logs não foi criada com 8 colunas';
    END IF;
    
    RAISE NOTICE 'Tabela whatsapp_logs recriada com sucesso com % colunas', 
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = 'whatsapp_logs' AND table_schema = 'public');
END $$;
