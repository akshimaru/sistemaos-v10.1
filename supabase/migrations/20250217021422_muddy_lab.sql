/*
  # Reset Bills System

  1. Changes
    - Drop existing bills table and recreate with simpler structure
    - Remove financial transaction dependencies
    - Add proper constraints and indexes
    - Add RLS policies

  2. Security
    - Enable RLS
    - Add proper policies for data access
    - Add proper constraints for data integrity
*/

-- Drop existing tables and dependencies
DROP TABLE IF EXISTS contas_pagar CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS conta_status CASCADE;
DROP TYPE IF EXISTS periodicidade_tipo CASCADE;

-- Create new types
CREATE TYPE conta_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE periodicidade_tipo AS ENUM ('unica', 'diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');

-- Create new bills table with simpler structure
CREATE TABLE contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  valor decimal(10,2) NOT NULL,
  data_vencimento timestamptz NOT NULL,
  data_pagamento timestamptz,
  status conta_status NOT NULL DEFAULT 'pendente',
  categoria_id uuid REFERENCES categorias_financeiras(id),
  recorrente boolean NOT NULL DEFAULT false,
  periodicidade periodicidade_tipo NOT NULL DEFAULT 'unica',
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  CONSTRAINT contas_pagar_valor_positivo CHECK (valor > 0)
);

-- Create indexes
CREATE INDEX idx_contas_pagar_data_vencimento ON contas_pagar(data_vencimento);
CREATE INDEX idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX idx_contas_pagar_user_id ON contas_pagar(user_id);
CREATE INDEX idx_contas_pagar_categoria_id ON contas_pagar(categoria_id);

-- Enable RLS
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own bills"
  ON contas_pagar
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bills"
  ON contas_pagar
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bills"
  ON contas_pagar
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bills"
  ON contas_pagar
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_conta_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for timestamp update
CREATE TRIGGER update_conta_timestamp_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION update_conta_timestamp();

-- Function to update bill status
CREATE OR REPLACE FUNCTION update_conta_status()
RETURNS trigger AS $$
BEGIN
  -- If the bill is pending and past due, mark as late
  IF NEW.status = 'pendente' AND NEW.data_vencimento < NOW() THEN
    NEW.status = 'atrasado';
  END IF;
  
  -- If the bill was late but due date was changed to future, mark as pending
  IF NEW.status = 'atrasado' AND NEW.data_vencimento >= NOW() THEN
    NEW.status = 'pendente';
  END IF;
  
  -- If the bill is paid, set payment date
  IF NEW.status = 'pago' AND NEW.data_pagamento IS NULL THEN
    NEW.data_pagamento = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for status update
CREATE TRIGGER update_conta_status_trigger
  BEFORE INSERT OR UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION update_conta_status();

-- Function to create next recurring bill
CREATE OR REPLACE FUNCTION criar_proxima_conta_recorrente()
RETURNS trigger AS $$
BEGIN
  -- If the bill is recurring and was paid, create next one
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
$$ LANGUAGE plpgsql;

-- Trigger for creating next recurring bill
CREATE TRIGGER criar_proxima_conta_recorrente_trigger
  AFTER UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION criar_proxima_conta_recorrente();