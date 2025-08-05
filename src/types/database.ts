export interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  telefone: string;
  created_at: string;
  user_id: string;
}

export interface Marca {
  id: string;
  nome: string;
  created_at: string;
  created_at: string;
  user_id: string;
}

export interface Instrumento {
  id: string;
  nome: string;
  created_at: string;
  user_id: string;
}

export interface Servico {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  created_at: string;
  user_id: string;
}

export interface Problema {
  id: string;
  nome: string;
  descricao: string;
  created_at: string;
  user_id: string;
}

export interface OrdemServico {
  id: string;
  numero: number;
  cliente_id: string;
  instrumento_id: string;
  marca_id: string;
  modelo: string;
  acessorios: string;
  problemas_ids: string[];
  problema_descricao: string;
  servicos_ids: string[];
  servico_descricao: string;
  valor_servicos: number;
  desconto: number;
  valor_total: number;
  forma_pagamento: 'credito' | 'debito' | 'pix';
  observacoes: string;
  data_entrada: string;
  data_previsao: string;
  data_entrega?: string;
  status: 'pendente' | 'em_andamento' | 'concluido' | 'cancelado';
  created_at: string;
  user_id: string;
  
  // Relacionamentos
  cliente?: Cliente;
  instrumento?: Instrumento;
  marca?: Marca;
  problemas?: Problema[];
  servicos?: Servico[];
}

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  cor: string;
  created_at: string;
  user_id: string;
}

export type ContaStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type Periodicidade = 'unica' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

export interface ContaPagar {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: ContaStatus;
  categoria_id?: string;
  recorrente: boolean;
  periodicidade: Periodicidade;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  categoria?: CategoriaFinanceira;
}

export interface TransacaoFinanceira {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  data: string;
  categoria_id: string;
  conta_pagar_id?: string;
  ordem_servico_id?: string;
  created_at: string;
  user_id: string;
  categoria?: CategoriaFinanceira;
  conta_pagar?: ContaPagar;
}