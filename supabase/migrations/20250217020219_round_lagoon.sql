/*
  # Fix Financial Integration

  1. Changes
    - Add function to calculate correct balance considering bills and transactions
    - Add function to handle bill payment with proper transaction creation
    - Add function to handle bill cancellation and transaction cleanup
    - Add function to handle bill status changes
    - Add constraints to ensure data consistency
    - Add indexes for better performance

  2. Security
    - All functions run with SECURITY DEFINER to ensure proper permissions
    - Triggers handle all edge cases to prevent data inconsistency
*/

-- Function to calculate total balance
CREATE OR REPLACE FUNCTION calculate_total_balance(user_id_param uuid, start_date timestamptz DEFAULT NULL, end_date timestamptz DEFAULT NULL)
RETURNS decimal AS $$
DECLARE
  total decimal;
BEGIN
  -- Calculate total from all transactions
  SELECT COALESCE(SUM(
    CASE
      WHEN t.tipo = 'receita' THEN t.valor
      ELSE -t.valor
    END
  ), 0)
  INTO total
  FROM transacoes_financeiras t
  WHERE t.user_id = user_id_param
    AND (start_date IS NULL OR t.data >= start_date)
    AND (end_date IS NULL OR t.data <= end_date);

  -- Subtract unpaid bills that don't have transactions yet
  SELECT total - COALESCE(SUM(valor), 0)
  INTO total
  FROM contas_pagar
  WHERE user_id = user_id_param
    AND status IN ('pendente', 'atrasado')
    AND transacao_id IS NULL
    AND (start_date IS NULL OR data_vencimento >= start_date)
    AND (end_date IS NULL OR data_vencimento <= end_date);

  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle bill payment
CREATE OR REPLACE FUNCTION handle_bill_payment()
RETURNS trigger AS $$
BEGIN
  -- Only proceed if the bill is being marked as paid
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    -- If there's no transaction yet, create one
    IF NEW.transacao_id IS NULL THEN
      INSERT INTO transacoes_financeiras (
        descricao,
        valor,
        tipo,
        data,
        categoria_id,
        conta_pagar_id,
        user_id
      ) VALUES (
        NEW.descricao,
        NEW.valor,
        'despesa',
        COALESCE(NEW.data_pagamento, NOW()),
        NEW.categoria_id,
        NEW.id,
        NEW.user_id
      )
      RETURNING id INTO NEW.transacao_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle bill cancellation
CREATE OR REPLACE FUNCTION handle_bill_cancellation()
RETURNS trigger AS $$
BEGIN
  -- If the bill is being cancelled and has a transaction
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' AND NEW.transacao_id IS NOT NULL THEN
    -- Delete the associated transaction
    DELETE FROM transacoes_financeiras WHERE id = NEW.transacao_id;
    -- Clear the transaction_id
    NEW.transacao_id = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle bill status changes
CREATE OR REPLACE FUNCTION handle_bill_status_change()
RETURNS trigger AS $$
BEGIN
  -- If the bill is being unpaid and has a transaction
  IF NEW.status != 'pago' AND OLD.status = 'pago' AND NEW.transacao_id IS NOT NULL THEN
    -- Delete the associated transaction
    DELETE FROM transacoes_financeiras WHERE id = NEW.transacao_id;
    -- Clear the transaction_id
    NEW.transacao_id = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace triggers
DROP TRIGGER IF EXISTS handle_bill_payment_trigger ON contas_pagar;
CREATE TRIGGER handle_bill_payment_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  WHEN (NEW.status = 'pago' AND OLD.status != 'pago')
  EXECUTE FUNCTION handle_bill_payment();

DROP TRIGGER IF EXISTS handle_bill_cancellation_trigger ON contas_pagar;
CREATE TRIGGER handle_bill_cancellation_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  WHEN (NEW.status = 'cancelado' AND OLD.status != 'cancelado')
  EXECUTE FUNCTION handle_bill_cancellation();

DROP TRIGGER IF EXISTS handle_bill_status_change_trigger ON contas_pagar;
CREATE TRIGGER handle_bill_status_change_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  WHEN (NEW.status != 'pago' AND OLD.status = 'pago')
  EXECUTE FUNCTION handle_bill_status_change();

-- Add constraints and indexes
ALTER TABLE transacoes_financeiras
  DROP CONSTRAINT IF EXISTS check_bill_transaction_type;

ALTER TABLE transacoes_financeiras
  ADD CONSTRAINT check_bill_transaction_type
  CHECK (
    (conta_pagar_id IS NULL) OR 
    (conta_pagar_id IS NOT NULL AND tipo = 'despesa')
  );

CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_conta_pagar_id 
  ON transacoes_financeiras(conta_pagar_id);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_transacao_id 
  ON contas_pagar(transacao_id);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_status 
  ON contas_pagar(status);

-- Function to ensure data consistency
CREATE OR REPLACE FUNCTION ensure_financial_consistency()
RETURNS trigger AS $$
BEGIN
  -- Ensure transaction type is 'despesa' for bills
  IF NEW.conta_pagar_id IS NOT NULL THEN
    NEW.tipo = 'despesa';
  END IF;

  -- Ensure positive values
  IF NEW.valor <= 0 THEN
    RAISE EXCEPTION 'Transaction value must be positive';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for data consistency
DROP TRIGGER IF EXISTS ensure_financial_consistency_trigger ON transacoes_financeiras;
CREATE TRIGGER ensure_financial_consistency_trigger
  BEFORE INSERT OR UPDATE ON transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION ensure_financial_consistency();