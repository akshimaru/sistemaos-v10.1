/*
  # Add Service Order Completion Trigger

  1. Changes
    - Add trigger to automatically create revenue transaction when service order is completed
    - Transaction will be created with:
      - Description: Client name + instrument details
      - Amount: Service order total value (valor_servicos - desconto)
      - Type: 'receita'
      - Category: 'Serviços Luthieria'
      - Reference to the service order
  
  2. Security
    - Trigger runs with SECURITY DEFINER to ensure it can access all necessary tables
    - Only creates transaction for status change to 'concluido'
*/

-- Function to create revenue transaction on service order completion
CREATE OR REPLACE FUNCTION create_service_order_revenue()
RETURNS trigger AS $$
DECLARE
  categoria_id uuid;
  cliente_nome text;
  instrumento_nome text;
  marca_nome text;
BEGIN
  -- Only proceed if status is changing to 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Get the category ID for 'Serviços Luthieria'
    SELECT id INTO categoria_id
    FROM categorias_financeiras
    WHERE user_id = NEW.user_id
      AND nome = 'Serviços Luthieria'
      AND tipo = 'receita'
    LIMIT 1;

    -- Get client, instrument and brand names
    SELECT c.nome INTO cliente_nome
    FROM clientes c
    WHERE c.id = NEW.cliente_id;

    SELECT i.nome INTO instrumento_nome
    FROM instrumentos i
    WHERE i.id = NEW.instrumento_id;

    SELECT m.nome INTO marca_nome
    FROM marcas m
    WHERE m.id = NEW.marca_id;

    -- Create the revenue transaction
    INSERT INTO transacoes_financeiras (
      descricao,
      valor,
      tipo,
      data,
      categoria_id,
      ordem_servico_id,
      user_id
    ) VALUES (
      'Serviço - ' || cliente_nome || ' (' || instrumento_nome || ' ' || marca_nome || ' ' || NEW.modelo || ')',
      NEW.valor_servicos - NEW.desconto,
      'receita',
      NOW(),
      categoria_id,
      NEW.id,
      NEW.user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS create_service_order_revenue_trigger ON ordens_servico;
CREATE TRIGGER create_service_order_revenue_trigger
  AFTER UPDATE ON ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION create_service_order_revenue();