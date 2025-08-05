/*
  # Update Bills Schema and Relationships

  1. Changes
    - Add foreign key constraint for transactions
    - Add cascade delete for related transactions
    - Update trigger functions to handle transaction relationships

  2. Security
    - Maintain RLS policies
    - Ensure data integrity with proper constraints
*/

-- First, remove any existing foreign key constraints
ALTER TABLE transacoes_financeiras
  DROP CONSTRAINT IF EXISTS transacoes_financeiras_conta_pagar_id_fkey;

ALTER TABLE contas_pagar
  DROP CONSTRAINT IF EXISTS contas_pagar_transacao_id_fkey;

-- Add proper foreign key constraints with cascade delete
ALTER TABLE transacoes_financeiras
  ADD CONSTRAINT transacoes_financeiras_conta_pagar_id_fkey
  FOREIGN KEY (conta_pagar_id)
  REFERENCES contas_pagar(id)
  ON DELETE CASCADE;

ALTER TABLE contas_pagar
  ADD CONSTRAINT contas_pagar_transacao_id_fkey
  FOREIGN KEY (transacao_id)
  REFERENCES transacoes_financeiras(id)
  ON DELETE SET NULL;

-- Update function to handle bill payment status
CREATE OR REPLACE FUNCTION update_conta_status()
RETURNS trigger AS $$
BEGIN
  -- If the bill is being marked as paid and there's no payment date
  IF NEW.status = 'pago' AND NEW.data_pagamento IS NULL THEN
    NEW.data_pagamento = NOW();
  END IF;

  -- If the bill is pending and past due, mark as late
  IF NEW.status = 'pendente' AND NEW.data_vencimento < CURRENT_DATE THEN
    NEW.status = 'atrasado';
  END IF;

  -- If the bill was late but the due date was changed to the future
  IF NEW.status = 'atrasado' AND NEW.data_vencimento >= CURRENT_DATE THEN
    NEW.status = 'pendente';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function to handle recurring bills
CREATE OR REPLACE FUNCTION criar_proxima_conta_recorrente()
RETURNS trigger AS $$
BEGIN
  -- Only create next bill if current one is paid and is recurring
  IF NEW.status = 'pago' AND NEW.recorrente = true AND 
     (OLD.status IS NULL OR OLD.status != 'pago') THEN
    
    INSERT INTO contas_pagar (
      descricao,
      valor,
      data_vencimento,
      categoria_id,
      recorrente,
      periodicidade,
      observacoes,
      user_id
    ) VALUES (
      NEW.descricao,
      NEW.valor,
      CASE NEW.periodicidade
        WHEN 'diaria' THEN NEW.data_vencimento + INTERVAL '1 day'
        WHEN 'semanal' THEN NEW.data_vencimento + INTERVAL '1 week'
        WHEN 'quinzenal' THEN NEW.data_vencimento + INTERVAL '15 days'
        WHEN 'mensal' THEN NEW.data_vencimento + INTERVAL '1 month'
        WHEN 'bimestral' THEN NEW.data_vencimento + INTERVAL '2 months'
        WHEN 'trimestral' THEN NEW.data_vencimento + INTERVAL '3 months'
        WHEN 'semestral' THEN NEW.data_vencimento + INTERVAL '6 months'
        WHEN 'anual' THEN NEW.data_vencimento + INTERVAL '1 year'
        ELSE NEW.data_vencimento
      END,
      NEW.categoria_id,
      NEW.recorrente,
      NEW.periodicidade,
      NEW.observacoes,
      NEW.user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle bill deletion and cleanup
CREATE OR REPLACE FUNCTION cleanup_bill_transaction()
RETURNS trigger AS $$
BEGIN
  -- If the bill has an associated transaction, it will be deleted by cascade
  -- We don't need to explicitly delete it here
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
DROP TRIGGER IF EXISTS update_conta_status_trigger ON contas_pagar;
CREATE TRIGGER update_conta_status_trigger
  BEFORE INSERT OR UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION update_conta_status();

DROP TRIGGER IF EXISTS criar_proxima_conta_recorrente_trigger ON contas_pagar;
CREATE TRIGGER criar_proxima_conta_recorrente_trigger
  AFTER UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION criar_proxima_conta_recorrente();

DROP TRIGGER IF EXISTS cleanup_bill_transaction_trigger ON contas_pagar;
CREATE TRIGGER cleanup_bill_transaction_trigger
  BEFORE DELETE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_bill_transaction();