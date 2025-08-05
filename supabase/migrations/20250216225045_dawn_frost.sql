/*
  # Adicionar sistema de contas a pagar

  1. Nova Tabela
    - `contas_pagar`
      - `id` (uuid, primary key)
      - `descricao` (text)
      - `valor` (decimal)
      - `data_vencimento` (timestamptz)
      - `data_pagamento` (timestamptz)
      - `status` (text) - pendente, pago, atrasado, cancelado
      - `categoria_id` (uuid) - referência à categoria financeira
      - `transacao_id` (uuid) - referência à transação quando paga
      - `recorrente` (boolean) - indica se é uma conta recorrente
      - `periodicidade` (text) - mensal, anual, etc
      - `observacoes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `user_id` (uuid)

  2. Modificações
    - Adiciona coluna `conta_pagar_id` na tabela `transacoes_financeiras`
    - Adiciona trigger para atualizar status da conta quando paga

  3. Segurança
    - Habilita RLS
    - Adiciona políticas de segurança
*/

-- Criar enum para status de contas
CREATE TYPE conta_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');

-- Criar enum para periodicidade
CREATE TYPE periodicidade_tipo AS ENUM ('unica', 'diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');

-- Criar tabela de contas a pagar
CREATE TABLE contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  valor decimal(10,2) NOT NULL,
  data_vencimento timestamptz NOT NULL,
  data_pagamento timestamptz,
  status conta_status NOT NULL DEFAULT 'pendente',
  categoria_id uuid REFERENCES categorias_financeiras(id),
  transacao_id uuid REFERENCES transacoes_financeiras(id),
  recorrente boolean NOT NULL DEFAULT false,
  periodicidade periodicidade_tipo NOT NULL DEFAULT 'unica',
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  CONSTRAINT contas_pagar_valor_positivo CHECK (valor > 0)
);

-- Adicionar coluna na tabela de transações
ALTER TABLE transacoes_financeiras
  ADD COLUMN conta_pagar_id uuid REFERENCES contas_pagar(id);

-- Criar índices
CREATE INDEX idx_contas_pagar_data_vencimento ON contas_pagar(data_vencimento);
CREATE INDEX idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX idx_contas_pagar_user_id ON contas_pagar(user_id);
CREATE INDEX idx_contas_pagar_categoria_id ON contas_pagar(categoria_id);

-- Habilitar RLS
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;

-- Criar políticas de segurança
CREATE POLICY "Usuários podem ver suas próprias contas"
  ON contas_pagar
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias contas"
  ON contas_pagar
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias contas"
  ON contas_pagar
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias contas"
  ON contas_pagar
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION update_conta_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp
CREATE TRIGGER update_conta_timestamp_trigger
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION update_conta_timestamp();

-- Função para atualizar status da conta quando atrasada
CREATE OR REPLACE FUNCTION update_conta_status()
RETURNS trigger AS $$
BEGIN
  -- Se a conta está pendente e a data de vencimento passou, marca como atrasada
  IF NEW.status = 'pendente' AND NEW.data_vencimento < NOW() THEN
    NEW.status = 'atrasado';
  END IF;
  
  -- Se a conta foi paga, atualiza a data de pagamento
  IF NEW.status = 'pago' AND NEW.data_pagamento IS NULL THEN
    NEW.data_pagamento = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar status
CREATE TRIGGER update_conta_status_trigger
  BEFORE INSERT OR UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION update_conta_status();

-- Função para criar próxima conta recorrente
CREATE OR REPLACE FUNCTION criar_proxima_conta_recorrente()
RETURNS trigger AS $$
BEGIN
  -- Se a conta é recorrente e foi paga, cria a próxima
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

-- Trigger para criar próxima conta recorrente
CREATE TRIGGER criar_proxima_conta_recorrente_trigger
  AFTER UPDATE ON contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION criar_proxima_conta_recorrente();