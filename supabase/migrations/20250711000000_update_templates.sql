-- Atualizar templates de mensagens para incluir mais informações e novos tipos

-- Atualizar comentário da tabela para incluir os novos tipos
COMMENT ON COLUMN message_templates.template_type IS 
'Tipo do template: nova_ordem, servico_finalizado, servico_andamento, servico_atraso, lembrete_retirada, cobranca_pagamento, orcamento_aprovado, diagnostico_concluido, agendamento_coleta, promocao_desconto, lembrete_manutencao';

-- Esta migração não precisa alterar dados existentes,
-- os novos templates serão criados automaticamente pelo código quando necessário
-- e os templates existentes serão mantidos para preservar customizações dos usuários
