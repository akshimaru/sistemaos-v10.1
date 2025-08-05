/*
  # Fix Financial Calculations

  1. Changes
    - Add function to calculate total balance
    - Add function to calculate monthly totals
    - Add function to handle bill payments
    - Add constraints to ensure data consistency
    - Add function to handle transaction cleanup
    - Add function to handle bill cancellation

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

  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate monthly totals
CREATE OR REPLACE FUNCTION calculate_monthly_totals(
  user_id_param uuid,
  month_start date,
  month_end date
) RETURNS TABLE (
  receitas decimal,
  despesas decimal,
  saldo decimal
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_transactions AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) as total_receitas,
      COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) as total_despesas
    FROM transacoes_financeiras
    WHERE user_id = user_id_param
      AND data >= month_start
      AND data < month_end
  )
  SELECT
    total_receitas as receitas,
    total_despesas as despesas,
    (total_receitas - total_despesas) as saldo
  FROM monthly_transactions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle bill payment
CREATE OR REPLACE FUNCTION handle_bill_payment()
RETURNS trigger AS $$
BEGIN
  -- Only proceed if the bill is being marked as paid
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    -- Create transaction if it doesn't exist
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

-- Function to handle transaction cleanup
CREATE OR REPLACE FUNCTION cleanup_bill_transaction()
RETURNS trigger AS $$
BEGIN
  -- If the transaction is being deleted and is linked to a bill
  IF OLD.conta_pagar_id IS NOT NULL THEN
    -- Update the bill to clear the transaction_id and status
    UPDATE contas_pagar
    SET 
      transacao_id = NULL,
      status = CASE 
        WHEN status = 'pago' THEN 
          CASE 
            WHEN data_vencimento < CURRENT_DATE THEN 'atrasado'
            ELSE 'pendente'
          END
        ELSE status
      END
    WHERE id = OLD.conta_pagar_id;
  END IF;

  RETURN OLD;
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

DROP TRIGGER IF EXISTS cleanup_bill_transaction_trigger ON transacoes_financeiras;
CREATE TRIGGER cleanup_bill_transaction_trigger
  BEFORE DELETE ON transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_bill_transaction();

-- Add constraints
ALTER TABLE transacoes_financeiras
  DROP CONSTRAINT IF EXISTS check_bill_transaction_type;

ALTER TABLE transacoes_financeiras
  ADD CONSTRAINT check_bill_transaction_type
  CHECK (
    (conta_pagar_id IS NULL) OR 
    (conta_pagar_id IS NOT NULL AND tipo = 'despesa')
  );

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