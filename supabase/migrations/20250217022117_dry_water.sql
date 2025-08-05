-- Function to handle service order status changes
CREATE OR REPLACE FUNCTION handle_service_order_status_change()
RETURNS trigger AS $$
BEGIN
  -- If status is changing from 'concluido' to another status
  IF OLD.status = 'concluido' AND NEW.status != 'concluido' THEN
    -- Delete associated financial transaction
    DELETE FROM transacoes_financeiras 
    WHERE ordem_servico_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for status changes
DROP TRIGGER IF EXISTS handle_service_order_status_change_trigger ON ordens_servico;
CREATE TRIGGER handle_service_order_status_change_trigger
  BEFORE UPDATE ON ordens_servico
  FOR EACH ROW
  WHEN (OLD.status = 'concluido' AND NEW.status != 'concluido')
  EXECUTE FUNCTION handle_service_order_status_change();