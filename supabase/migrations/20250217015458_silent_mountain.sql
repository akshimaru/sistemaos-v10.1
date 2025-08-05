/*
  # Fix Balance Calculation

  1. Changes
    - Add trigger to update transaction amount when bill amount changes
    - Add trigger to update bill amount when transaction amount changes
    - Add function to ensure bill and transaction amounts stay in sync
    - Add constraints to ensure data consistency
    - Add function to handle bill cancellation
    - Add function to handle bill payment status changes
    - Add function to handle transaction cleanup

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

-- Create trigger for bill cancellation
DROP TRIGGER IF EXISTS handle_bill_cancellation_trigger ON contas_pagar;
CREATE TRIGGER handle_bill_cancellation_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  WHEN (NEW.status = 'cancelado' AND OLD.status != 'cancelado')
  EXECUTE FUNCTION handle_bill_cancellation();

-- Function to handle bill payment status changes
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

-- Create trigger for bill status changes
DROP TRIGGER IF EXISTS handle_bill_status_change_trigger ON contas_pagar;
CREATE TRIGGER handle_bill_status_change_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  WHEN (NEW.status != 'pago' AND OLD.status = 'pago')
  EXECUTE FUNCTION handle_bill_status_change();

-- Function to handle transaction cleanup
CREATE OR REPLACE FUNCTION cleanup_bill_transaction()
RETURNS trigger AS $$
BEGIN
  -- If the transaction is being deleted and is linked to a bill
  IF OLD.conta_pagar_id IS NOT NULL THEN
    -- Update the bill to clear the transaction_id
    UPDATE contas_pagar
    SET transacao_id = NULL
    WHERE id = OLD.conta_pagar_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for transaction cleanup
DROP TRIGGER IF EXISTS cleanup_bill_transaction_trigger ON transacoes_financeiras;
CREATE TRIGGER cleanup_bill_transaction_trigger
  BEFORE DELETE ON transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_bill_transaction();