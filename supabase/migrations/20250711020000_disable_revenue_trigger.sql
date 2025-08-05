-- Desabilitar temporariamente trigger de receita de ordens de serviço
-- Data: 2025-07-11
-- Motivo: Remover erro "INSERT has more target columns than expressions" enquanto ajustes são consolidados

-- 1) Remover trigger antigo
DROP TRIGGER IF EXISTS create_service_order_revenue_trigger ON ordens_servico;

-- 2) Remover função associada
DROP FUNCTION IF EXISTS create_service_order_revenue();

-- 3) Aviso
DO $$
BEGIN
  RAISE NOTICE 'Trigger e função de receita de ordens de serviço desabilitados temporariamente';
END$$;
