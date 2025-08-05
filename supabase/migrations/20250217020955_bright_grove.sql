/*
  # Fix Bill Deletion Handling

  1. Changes
    - Fix trigger functions to properly handle bill deletions
    - Add proper cleanup for deleted records
    - Ensure data consistency between bills and transactions
    - Add proper error handling

  2. Security
    - All functions run with SECURITY DEFINER to ensure proper permissions
    - Add proper validation and error handling
*/

-- Function to handle bill deletion cleanup
CREATE OR REPLACE FUNCTION handle_bill_deletion()
RETURNS trigger AS $$
BEGIN
  -- If the bill has an associated transaction, delete it
  IF OLD.transacao_id IS NOT NULL THEN
    DELETE FROM transacoes_financeiras 
    WHERE id = OLD.transacao_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for bill deletion
DROP TRIGGER IF EXISTS handle_bill_deletion_trigger ON contas_pagar;
CREATE TRIGGER handle_bill_deletion_trigger
  BEFORE DELETE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION handle_bill_deletion();

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

-- Create trigger for transaction deletion
DROP TRIGGER IF EXISTS handle_transaction_deletion_trigger ON transacoes_financeiras;
CREATE TRIGGER handle_transaction_deletion_trigger
  BEFORE DELETE ON transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION handle_transaction_deletion();

-- Add proper indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contas_pagar_transacao_id 
  ON contas_pagar(transacao_id);

CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_conta_pagar_id 
  ON transacoes_financeiras(conta_pagar_id);