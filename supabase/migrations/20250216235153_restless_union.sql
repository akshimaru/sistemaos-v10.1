/*
  # Fix service order transaction creation

  1. Changes
    - Add fallback category creation if 'Serviços Luthieria' doesn't exist
    - Ensure category ID is always set for service order transactions
    - Add better error handling

  2. Security
    - Maintain RLS policies
    - Keep security definer for proper permissions
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
    -- Get or create the category for 'Serviços Luthieria'
    SELECT id INTO categoria_id
    FROM categorias_financeiras
    WHERE user_id = NEW.user_id
      AND nome = 'Serviços Luthieria'
      AND tipo = 'receita'
    LIMIT 1;

    -- If category doesn't exist, create it
    IF categoria_id IS NULL THEN
      INSERT INTO categorias_financeiras (
        nome,
        tipo,
        cor,
        user_id
      ) VALUES (
        'Serviços Luthieria',
        'receita',
        '#10B981',
        NEW.user_id
      )
      RETURNING id INTO categoria_id;
    END IF;

    -- Get client, instrument and brand names with fallbacks
    SELECT COALESCE(c.nome, 'Cliente não encontrado') INTO cliente_nome
    FROM clientes c
    WHERE c.id = NEW.cliente_id;

    SELECT COALESCE(i.nome, 'Instrumento não encontrado') INTO instrumento_nome
    FROM instrumentos i
    WHERE i.id = NEW.instrumento_id;

    SELECT COALESCE(m.nome, 'Marca não encontrada') INTO marca_nome
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
      'Serviço - ' || cliente_nome || ' (' || instrumento_nome || ' ' || marca_nome || ' ' || COALESCE(NEW.modelo, '') || ')',
      NEW.valor_servicos - COALESCE(NEW.desconto, 0),
      'receita',
      NOW(),
      categoria_id,
      NEW.id,
      NEW.user_id
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details but allow the order status update to proceed
    RAISE WARNING 'Error creating revenue transaction: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;