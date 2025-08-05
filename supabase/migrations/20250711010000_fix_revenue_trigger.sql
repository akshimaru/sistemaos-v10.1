-- Correção COMPLETA de triggers de transações financeiras
-- Data: 2025-07-11
-- Motivo: Erro "INSERT has more target columns than expressions" 
-- Vários triggers estavam faltando o campo conta_pagar_id adicionado posteriormente

-- 1. Recriar a função de criação de receita com todos os campos necessários
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
      INSERT INTO categorias_financeiras (nome, tipo, user_id)
      VALUES ('Serviços Luthieria', 'receita', NEW.user_id)
      RETURNING id INTO categoria_id;
    END IF;

    -- Get client, instrument and brand names safely
    SELECT COALESCE(c.nome, 'Cliente') INTO cliente_nome
    FROM clientes c
    WHERE c.id = NEW.cliente_id;

    SELECT COALESCE(i.nome, 'Instrumento') INTO instrumento_nome
    FROM instrumentos i
    WHERE i.id = NEW.instrumento_id;

    SELECT COALESCE(m.nome, 'Marca') INTO marca_nome
    FROM marcas m
    WHERE m.id = NEW.marca_id;

    -- Create the revenue transaction - INCLUINDO conta_pagar_id como NULL
    INSERT INTO transacoes_financeiras (
      descricao,
      valor,
      tipo,
      data,
      categoria_id,
      ordem_servico_id,
      conta_pagar_id,  -- ADICIONADO: campo que estava faltando
      user_id
    ) VALUES (
      'Serviço - ' || cliente_nome || ' (' || instrumento_nome || ' ' || marca_nome || ' ' || COALESCE(NEW.modelo, '') || ')',
      GREATEST(NEW.valor_servicos - COALESCE(NEW.desconto, 0), 0),  -- Garantir valor não negativo
      'receita',
      NOW(),
      categoria_id,
      NEW.id,
      NULL,  -- conta_pagar_id é NULL para receitas de ordens de serviço
      NEW.user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Corrigir função de handling de pagamento de contas (se necessário)
-- Esta função já inclui conta_pagar_id mas vamos garantir que está correta
CREATE OR REPLACE FUNCTION handle_bill_payment()
RETURNS trigger AS $$
BEGIN
  -- Only proceed if the bill is being marked as paid
  IF NEW.status = 'pago' AND (OLD IS NULL OR OLD.status != 'pago') THEN
    -- If there's no transaction yet, create one
    IF NEW.transacao_id IS NULL THEN
      INSERT INTO transacoes_financeiras (
        descricao,
        valor,
        tipo,
        data,
        categoria_id,
        conta_pagar_id,  -- Já incluído corretamente
        ordem_servico_id, -- Adicionado para consistência
        user_id
      ) VALUES (
        NEW.descricao,
        NEW.valor,
        'despesa',
        COALESCE(NEW.data_pagamento, NOW()),
        NEW.categoria_id,
        NEW.id,  -- conta_pagar_id
        NULL,    -- ordem_servico_id é NULL para contas a pagar
        NEW.user_id
      )
      RETURNING id INTO NEW.transacao_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION create_service_order_revenue() IS 
'Cria transação financeira de receita quando ordem de serviço é finalizada - CORRIGIDO para incluir conta_pagar_id';

COMMENT ON FUNCTION handle_bill_payment() IS 
'Processa pagamento de contas a pagar - CORRIGIDO para incluir ordem_servico_id';

-- Verificação
DO $$ 
BEGIN 
    RAISE NOTICE 'Triggers de transações financeiras corrigidos - todos os campos incluídos';
    RAISE NOTICE 'create_service_order_revenue: conta_pagar_id = NULL';
    RAISE NOTICE 'handle_bill_payment: ordem_servico_id = NULL';
END $$;
