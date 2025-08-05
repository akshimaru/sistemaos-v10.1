-- Migração para tabela de configurações do WhatsApp
CREATE TABLE IF NOT EXISTS configuracoes_whatsapp (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    method TEXT NOT NULL DEFAULT 'direct' CHECK (method IN ('direct', 'webhook')),
    webhook_url TEXT,
    api_key TEXT,
    instance_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Migração para logs do WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('direct', 'webhook')),
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Políticas RLS para configuracoes_whatsapp
ALTER TABLE configuracoes_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias configurações WhatsApp" ON configuracoes_whatsapp
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias configurações WhatsApp" ON configuracoes_whatsapp
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias configurações WhatsApp" ON configuracoes_whatsapp
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias configurações WhatsApp" ON configuracoes_whatsapp
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para whatsapp_logs
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios logs WhatsApp" ON whatsapp_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios logs WhatsApp" ON whatsapp_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_configuracoes_whatsapp_user_id ON configuracoes_whatsapp(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_user_id ON whatsapp_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_at ON whatsapp_logs(sent_at);
