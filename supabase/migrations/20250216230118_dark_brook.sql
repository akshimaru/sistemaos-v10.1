/*
  # Reset Financial Data

  1. Changes
    - Delete all existing financial transactions
    - Delete all existing bills to pay
    - Keep categories intact
*/

-- Delete all financial transactions
DELETE FROM transacoes_financeiras;

-- Delete all bills to pay
DELETE FROM contas_pagar;

-- Reset sequences
ALTER SEQUENCE IF EXISTS transacoes_financeiras_id_seq RESTART;
ALTER SEQUENCE IF EXISTS contas_pagar_id_seq RESTART;