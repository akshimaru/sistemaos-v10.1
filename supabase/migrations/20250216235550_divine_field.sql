/*
  # Add transaction cleanup for in-progress orders

  1. Changes
    - Update trigger to delete financial transaction when service order is changed to 'em_andamento'
    - Modify cleanup function to handle this new case

  2. Security
    - Maintain RLS policies
    - Keep security definer for proper permissions
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS cleanup_service_order_transaction_on_delete ON ordens_servico;
DROP TRIGGER IF EXISTS cleanup_service_order_transaction_on_cancel ON ordens_servico;

-- Update function to handle in-progress status
CREATE OR REPLACE FUNCTION cleanup_service_order_transaction()
RETURNS trigger AS $$
BEGIN
  -- Delete associated financial transaction when:
  -- 1. Order is deleted
  -- 2. Order is cancelled
  -- 3. Order is changed to in-progress
  IF (TG_OP = 'DELETE') OR 
     (TG_OP = 'UPDATE' AND (
       (NEW.status = 'cancelado' AND OLD.status != 'cancelado') OR
       (NEW.status = 'em_andamento' AND OLD.status != 'em_andamento')
     ))
  THEN
    DELETE FROM transacoes_financeiras
    WHERE ordem_servico_id = 
      CASE
        WHEN TG_OP = 'DELETE' THEN OLD.id
        WHEN TG_OP = 'UPDATE' THEN NEW.id
      END;
  END IF;

  -- Return appropriate record based on operation
  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for service order deletion
CREATE TRIGGER cleanup_service_order_transaction_on_delete
  BEFORE DELETE ON ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_service_order_transaction();

-- Recreate trigger for status changes (both cancel and in-progress)
CREATE TRIGGER cleanup_service_order_transaction_on_status_change
  BEFORE UPDATE ON ordens_servico
  FOR EACH ROW
  WHEN (
    (NEW.status = 'cancelado' AND OLD.status != 'cancelado') OR
    (NEW.status = 'em_andamento' AND OLD.status != 'em_andamento')
  )
  EXECUTE FUNCTION cleanup_service_order_transaction();