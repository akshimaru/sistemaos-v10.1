-- Script para verificar estrutura da tabela reminder_settings
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'reminder_settings' 
ORDER BY ordinal_position;

-- Verificar se a tabela empresa_config existe
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'empresa_config' 
ORDER BY ordinal_position;
