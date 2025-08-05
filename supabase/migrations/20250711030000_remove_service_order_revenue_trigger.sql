-- Remover permanentemente trigger de receita de ordens de serviço
--   para eliminar erro de INSERT durante finalização de ordens
-- Data: 2025-07-11

-- 1) Apagar trigger de receita de ordens de serviço
DROP TRIGGER IF EXISTS create_service_order_revenue_trigger ON ordens_servico;

-- 2) Apagar função de receita de ordens de serviço
DROP FUNCTION IF EXISTS create_service_order_revenue();

-- 3) Mensagem de confirmação
DO $$
BEGIN
  RAISE NOTICE 'Trigger e função create_service_order_revenue removidos com sucesso';
END$$;
