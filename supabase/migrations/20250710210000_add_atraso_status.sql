-- Adicionar status 'atraso' à constraint ordens_servico_status_check
-- Esta migração atualiza a constraint para incluir o novo status 'atraso'
-- necessário para as ações rápidas do calendário de WhatsApp

-- Remover a constraint existente
ALTER TABLE ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_status_check;

-- Recriar a constraint com o status 'atraso' incluído
ALTER TABLE ordens_servico
  ADD CONSTRAINT ordens_servico_status_check 
  CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado', 'atraso'));

-- Comentário explicativo
COMMENT ON CONSTRAINT ordens_servico_status_check ON ordens_servico IS 
'Constraint que garante que o status da ordem de serviço seja um dos valores válidos: pendente, em_andamento, concluido, cancelado, atraso';
