-- Migração de emergência para resolver problema de INSERT
-- Esta migração remove temporariamente a tabela whatsapp_logs para permitir
-- que as finalizações de ordem funcionem sem problemas

-- Opção 1: Renomear a tabela problemática
ALTER TABLE IF EXISTS whatsapp_logs RENAME TO whatsapp_logs_backup;

-- Opção 2: Criar uma view temporária que não faz nada
CREATE OR REPLACE VIEW whatsapp_logs AS 
SELECT 
    gen_random_uuid() as id,
    auth.uid() as user_id,
    '' as phone_number,
    '' as message,
    'direct' as method,
    'success' as status,
    null as error_message,
    now() as sent_at
WHERE false; -- Esta view nunca retorna dados

-- Comentário
COMMENT ON VIEW whatsapp_logs IS 'View temporária para contornar problema de INSERT - substitui tabela original';

-- Verificação
DO $$ 
BEGIN 
    RAISE NOTICE 'Tabela whatsapp_logs renomeada para whatsapp_logs_backup e view temporária criada';
END $$;
