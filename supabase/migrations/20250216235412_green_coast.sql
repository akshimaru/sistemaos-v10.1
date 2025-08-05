/*
  # Add transaction cleanup for service orders

  1. Changes
    - Add trigger to delete financial transaction when service order is cancelled
    - Add trigger to delete financial transaction when service order is deleted
    - Add function to handle transaction cleanup

  2. Security
    - Maintain RLS policies
    - Keep security definer for proper permissions
*/

-- Function to handle service order transaction cleanup
CREATE OR REPLACE FUNCTION cleanup_service_order_transaction()
RETURNS trigger AS $$
BEGIN
  -- Delete associated financial transaction
  DELETE FROM transacoes_financeiras
  WHERE ordem_servico_id = 
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      WHEN TG_OP = 'UPDATE' THEN NEW.id
    END;

  -- For DELETE operation, return OLD to allow the deletion to proceed
  -- For UPDATE operation, return NEW to allow the update to proceed
  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for service order deletion
DROP TRIGGER IF EXISTS cleanup_service_order_transaction_on_delete ON ordens_servico;
CREATE TRIGGER cleanup_service_order_transaction_on_delete
  BEFORE DELETE ON ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_service_order_transaction();

-- Create trigger for service order cancellation
DROP TRIGGER IF EXISTS cleanup_service_order_transaction_on_cancel ON ordens_servico;
CREATE TRIGGER cleanup_service_order_transaction_on_cancel
  BEFORE UPDATE ON ordens_servico
  FOR EACH ROW
  WHEN (NEW.status = 'cancelado' AND OLD.status != 'cancelado')
  EXECUTE FUNCTION cleanup_service_order_transaction();