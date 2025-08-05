/*
  # Fix Balance Calculation

  1. Changes
    - Add trigger to update transaction amount when bill amount changes
    - Add trigger to update bill amount when transaction amount changes
    - Add function to ensure bill and transaction amounts stay in sync
    - Add constraints to ensure data consistency

  2. Security
    - All functions run with SECURITY DEFINER to ensure proper permissions
    - Triggers handle all edge cases to prevent data inconsistency
*/

-- Function to sync bill and transaction amounts
CREATE OR REPLACE FUNCTION sync_bill_transaction_amounts()
RETURNS trigger AS $$
BEGIN
  -- If this is a bill update
  IF TG_TABLE_NAME = 'contas_pagar' THEN
    -- If the bill has a transaction and the amount changed
    IF NEW.transacao_id IS NOT NULL AND NEW.valor != OLD.valor THEN
      UPDATE transacoes_financeiras
      SET valor = NEW.valor
      WHERE id = NEW.transacao_id;
    END IF;
  -- If this is a transaction update
  ELSIF TG_TABLE_NAME = 'transacoes_financeiras' THEN
    -- If the transaction is linked to a bill and the amount changed
    IF NEW.conta_pagar_id IS NOT NULL AND NEW.valor != OLD.valor THEN
      UPDATE contas_pagar
      SET valor = NEW.valor
      WHERE id = NEW.conta_pagar_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for amount synchronization
DROP TRIGGER IF EXISTS sync_bill_amount_trigger ON contas_pagar;
CREATE TRIGGER sync_bill_amount_trigger
  AFTER UPDATE OF valor ON contas_pagar
  FOR EACH ROW
  WHEN (OLD.valor IS DISTINCT FROM NEW.valor)
  EXECUTE FUNCTION sync_bill_transaction_amounts();

DROP TRIGGER IF EXISTS sync_transaction_amount_trigger ON transacoes_financeiras;
CREATE TRIGGER sync_transaction_amount_trigger
  AFTER UPDATE OF valor ON transacoes_financeiras
  FOR EACH ROW
  WHEN (OLD.valor IS DISTINCT FROM NEW.valor)
  EXECUTE FUNCTION sync_bill_transaction_amounts();

-- Function to ensure transaction type is 'despesa' for bills
CREATE OR REPLACE FUNCTION ensure_bill_transaction_type()
RETURNS trigger AS $$
BEGIN
  IF NEW.conta_pagar_id IS NOT NULL AND NEW.tipo != 'despesa' THEN
    NEW.tipo = 'despesa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce transaction type
DROP TRIGGER IF EXISTS ensure_bill_transaction_type_trigger ON transacoes_financeiras;
CREATE TRIGGER ensure_bill_transaction_type_trigger
  BEFORE INSERT OR UPDATE ON transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION ensure_bill_transaction_type();

-- Add constraints to ensure data consistency
ALTER TABLE transacoes_financeiras
  DROP CONSTRAINT IF EXISTS check_bill_transaction_type;

ALTER TABLE transacoes_financeiras
  ADD CONSTRAINT check_bill_transaction_type
  CHECK (
    (conta_pagar_id IS NULL) OR
    (conta_pagar_id IS NOT NULL AND tipo = 'despesa')
  );

-- Function to handle bill payment and transaction creation
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

-- Create trigger for bill payment
DROP TRIGGER IF EXISTS handle_bill_payment_trigger ON contas_pagar;
CREATE TRIGGER handle_bill_payment_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  WHEN (NEW.status = 'pago' AND OLD.status != 'pago')
  EXECUTE FUNCTION handle_bill_payment();