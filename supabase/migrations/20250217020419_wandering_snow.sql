/*
  # Fix Bill Transaction Handling

  1. Changes
    - Fix trigger functions to properly handle bill transactions
    - Add proper error handling and validation
    - Ensure data consistency between bills and transactions
    - Add proper cleanup for deleted records
    - Add proper handling for status changes

  2. Security
    - All functions run with SECURITY DEFINER to ensure proper permissions
    - Add proper validation and error handling
*/

-- Function to handle bill payment
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
  IF NEW.status = 'cancelado' AND (OLD IS NULL OR OLD.status != 'cancelado') AND NEW.transacao_id IS NOT NULL THEN
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
  IF NEW.status != 'pago' AND (OLD IS NULL OR OLD.status = 'pago') AND NEW.transacao_id IS NOT NULL THEN
    -- Delete the associated transaction
    DELETE FROM transacoes_financeiras WHERE id = NEW.transacao_id;
    -- Clear the transaction_id
    NEW.transacao_id = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle transaction deletion
CREATE OR REPLACE FUNCTION handle_transaction_deletion()
RETURNS trigger AS $$
BEGIN
  -- If the transaction is linked to a bill, update the bill
  IF OLD.conta_pagar_id IS NOT NULL THEN
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
  WHEN (NEW.status = 'pago' AND (OLD IS NULL OR OLD.status != 'pago'))
  EXECUTE FUNCTION handle_bill_payment();

DROP TRIGGER IF EXISTS handle_bill_cancellation_trigger ON contas_pagar;
CREATE TRIGGER handle_bill_cancellation_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  WHEN (NEW.status = 'cancelado' AND (OLD IS NULL OR OLD.status != 'cancelado'))
  EXECUTE FUNCTION handle_bill_cancellation();

DROP TRIGGER IF EXISTS handle_bill_status_change_trigger ON contas_pagar;
CREATE TRIGGER handle_bill_status_change_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  WHEN (NEW.status != 'pago' AND (OLD IS NULL OR OLD.status = 'pago'))
  EXECUTE FUNCTION handle_bill_status_change();

DROP TRIGGER IF EXISTS handle_transaction_deletion_trigger ON transacoes_financeiras;
CREATE TRIGGER handle_transaction_deletion_trigger
  BEFORE DELETE ON transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION handle_transaction_deletion();

-- Add constraints and indexes
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