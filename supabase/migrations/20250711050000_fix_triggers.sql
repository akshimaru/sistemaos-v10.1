-- MIGRAÇÃO UNIFICADA DE CORREÇÃO DE TRIGGERS
-- Data: 2025-07-11
-- Motivo: Ajustar erros de INSERT em triggers de receita e lembretes de manutenção

-- 1) Corrigir trigger de receita (create_service_order_revenue)
DROP TRIGGER IF EXISTS create_service_order_revenue_trigger ON ordens_servico;
DROP FUNCTION IF EXISTS create_service_order_revenue();

CREATE OR REPLACE FUNCTION create_service_order_revenue()
RETURNS trigger AS $$
DECLARE
  categoria_id uuid;
  cliente_nome text;
  instrumento_nome text;
  marca_nome text;
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Categoria receita
    SELECT id INTO categoria_id
    FROM categorias_financeiras
    WHERE user_id = NEW.user_id
      AND nome = 'Serviços Luthieria'
      AND tipo = 'receita'
    LIMIT 1;
    IF categoria_id IS NULL THEN
      INSERT INTO categorias_financeiras (nome, tipo, user_id)
      VALUES ('Serviços Luthieria', 'receita', NEW.user_id)
      RETURNING id INTO categoria_id;
    END IF;

    -- Buscar nomes
    SELECT COALESCE(c.nome, '') INTO cliente_nome FROM clientes c WHERE c.id = NEW.cliente_id;
    SELECT COALESCE(i.nome, '') INTO instrumento_nome FROM instrumentos i WHERE i.id = NEW.instrumento_id;
    SELECT COALESCE(m.nome, '') INTO marca_nome FROM marcas m WHERE m.id = NEW.marca_id;

    -- Inserir transação receita com conta_pagar_id nulo
    INSERT INTO transacoes_financeiras (
      descricao, valor, tipo, data, categoria_id, ordem_servico_id, conta_pagar_id, user_id
    ) VALUES (
      'Serviço - ' || cliente_nome || ' (' || instrumento_nome || ' ' || marca_nome || ')',
      GREATEST(NEW.valor_servicos - COALESCE(NEW.desconto,0),0),
      'receita', NOW(), categoria_id, NEW.id, NULL, NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger receita
CREATE TRIGGER create_service_order_revenue_trigger
  AFTER UPDATE ON ordens_servico
  FOR EACH ROW
  WHEN (NEW.status = 'concluido')
  EXECUTE FUNCTION create_service_order_revenue();

-- 2) Corrigir trigger de lembretes de manutenção (update_maintenance_reminder)
DROP TRIGGER IF EXISTS update_maintenance_reminder_trigger ON ordens_servico;
DROP FUNCTION IF EXISTS update_maintenance_reminder();

CREATE OR REPLACE FUNCTION update_maintenance_reminder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    INSERT INTO maintenance_reminders (
      user_id, cliente_id, instrumento_id, last_service_date, updated_at
    ) VALUES (
      (SELECT user_id FROM clientes WHERE id = NEW.cliente_id LIMIT 1),
      NEW.cliente_id, NEW.instrumento_id, CURRENT_DATE, NOW()
    ) ON CONFLICT (user_id, cliente_id, instrumento_id)
    DO UPDATE SET
      last_service_date = CURRENT_DATE,
      last_reminder_sent = NULL,
      reminder_count = 0,
      is_active = true,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger lembretes
CREATE TRIGGER update_maintenance_reminder_trigger
  AFTER UPDATE ON ordens_servico
  FOR EACH ROW
  WHEN (NEW.status = 'concluido')
  EXECUTE FUNCTION update_maintenance_reminder();

-- Mensagem de confirmação
DO $$ BEGIN
  RAISE NOTICE 'Triggers de receita e manutenção atualizados com correções';
END $$;
