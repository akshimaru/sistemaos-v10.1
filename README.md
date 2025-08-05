# Sistema de Ordem de Serviço v10 🎸

Sistema completo de gerenciamento de ordem de serviço para luthieria com integração WhatsApp, controle financeiro e configurações centralizadas.

[Edit in StackBlitz ⚡️](https://stackblitz.com/~/github.com/akshimaru/sistema-os-financeiro-completo-v10)

## ✨ Funcionalidades Principais

### 🎸 Gestão de Ordens de Serviço
- Cadastro completo de ordens com instrumentos e clientes
- Status dinâmico (Pendente, Em Andamento, Concluído, Cancelado, Atraso)
- Sistema de busca e filtros avançados
- Controle de prazos e entregas
- Impressão de ordens de serviço

### 📱 Integração WhatsApp
- Envio automático de mensagens para clientes
- Templates personalizáveis para diferentes situações:
  - Nova ordem registrada
  - Serviço finalizado
  - Serviço em andamento
  - Contratempo/atraso
  - Lembrete de retirada
  - Cobrança de pagamento
  - Solicitação de avaliação
- Suporte para método direto (WhatsApp Web) e webhook
- Sistema de logs de mensagens enviadas

### 🔔 Sistema de Lembretes
- **Lembretes de Manutenção**: Notificações automáticas para clientes sobre manutenção preventiva
- **Lembretes de Avaliação**: Solicitações de feedback após conclusão do serviço
- Configuração de intervalos personalizáveis
- Dashboard dedicado para gerenciar lembretes

### ⚙️ Configurações Centralizadas
- **Atalhos Rápidos**: Acesso rápido ao WhatsApp, Templates e Configurações
- **Configurações da Empresa**: Nome, CNPJ, telefone, horários
- **Templates de Mensagem**: Editor completo para personalizar mensagens
- **Configurações WhatsApp**: Escolha entre método direto ou webhook
- **Lembretes**: Configuração de intervalos e habilitação de serviços

### 💰 Controle Financeiro
- Gestão de receitas e despesas
- Categorias financeiras personalizáveis
- Contas a pagar e receber
- Relatórios financeiros em tempo real
- Dashboard financeiro com gráficos

### 👥 Gestão de Clientes
- Cadastro completo com histórico de serviços
- Controle de comunicações
- Histórico de interações
- Importação via CSV

### 🔧 Cadastros Base
- Instrumentos musicais
- Marcas e modelos
- Serviços disponíveis
- Problemas comuns

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Headless UI
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Animações**: Framer Motion
- **Icons**: Lucide React
- **Deployment**: Docker + Nginx

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ 
- NPM ou Yarn
- Conta no Supabase

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/akshimaru/sistema-os-financeiro-completo-v10.git
cd sistema-os-financeiro-completo-v10
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas credenciais do Supabase
```

4. Execute o projeto:
```bash
npm run dev
```

### Configuração do Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com)
2. Execute as migrações SQL da pasta `supabase/migrations/`
3. Configure as variáveis no arquivo `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## 📱 Configuração WhatsApp

O sistema suporta dois métodos de envio:

### Método Direto (Padrão)
- Abre o WhatsApp Web automaticamente
- Não requer configuração adicional
- Funciona imediatamente

### Método Webhook
- Para automação completa
- Requer serviço de WhatsApp API
- Configure URL e chave de API nas configurações

## 🔧 Funcionalidades Avançadas

### Sistema de Lembretes
- Configure intervalos personalizados para lembretes de manutenção
- Ative lembretes de avaliação automáticos
- Dashboard centralizado para gerenciar todos os lembretes

### Templates Personalizáveis
- Editor completo de templates de mensagem
- Variáveis dinâmicas ({cliente}, {instrumento}, etc.)
- Suporte a emojis e formatação

### Controle de Acesso
- Sistema de autenticação seguro via Supabase
- Row Level Security (RLS) habilitado
- Dados isolados por usuário

## 📊 Dashboard

O dashboard principal oferece:
- Visão geral de ordens por status
- Métricas financeiras em tempo real
- Lista de lembretes pendentes
- Acesso rápido às principais funcionalidades

## 🔒 Segurança

- Autenticação via Supabase Auth
- Row Level Security (RLS) em todas as tabelas
- Tokens JWT seguros
- Validação de dados no frontend e backend

## 📈 Performance

- Lazy loading de componentes
- Otimização de consultas SQL
- Cache de dados localmente
- Bundle otimizado com Vite

## 🐳 Deploy com Docker

```bash
# Build da imagem
docker build -t sistema-os .

# Executar container
docker run -p 80:80 sistema-os
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato.

---

Desenvolvido com ❤️ para luthiers e profissionais de manutenção de instrumentos musicais.