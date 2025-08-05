# Configuração do Repositório GitHub

## 📋 Passos para criar o repositório

### 1. Preparar o projeto localmente

```powershell
# Navegar até o diretório do projeto
cd "c:\Users\Vibratho Servidor\Documents\sistemaos-v10-main"

# Inicializar repositório Git
git init

# Adicionar todos os arquivos
git add .

# Fazer o commit inicial
git commit -m "feat: sistema de OS completo v10 - versão de produção"
```

### 2. Criar repositório no GitHub

1. Acesse [GitHub.com](https://github.com)
2. Clique em "New repository" ou no ícone "+"
3. Configure o repositório:
   - **Repository name**: `sistema-os-luthieria-v10`
   - **Description**: `Sistema completo de gestão para luthieria com ordens de serviço, controle financeiro e integração WhatsApp`
   - **Visibility**: Public ou Private (recomendo Private se for uso comercial)
   - **NÃO** marque "Add a README file" (já temos um)
   - **NÃO** marque "Add .gitignore" (já temos um)
   - **NÃO** marque "Choose a license" (pode adicionar depois se necessário)

### 3. Conectar repositório local com GitHub

```powershell
# Adicionar o remote origin (substitua YOUR_USERNAME pelo seu usuário)
git remote add origin https://github.com/YOUR_USERNAME/sistema-os-luthieria-v10.git

# Renomear branch para main (padrão atual do GitHub)
git branch -M main

# Fazer push inicial
git push -u origin main
```

### 4. Configurar variáveis de ambiente para deploy

No EasyPanel, você precisará configurar estas variáveis:

- `VITE_SUPABASE_URL`: URL do seu projeto Supabase
- `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase

## 🚀 Deploy no EasyPanel

### Opção 1: Deploy direto do GitHub
1. No EasyPanel, crie uma nova aplicação
2. Selecione "GitHub" como fonte
3. Conecte seu repositório `sistema-os-luthieria-v10`
4. Configure as variáveis de ambiente
5. O EasyPanel usará automaticamente o `Dockerfile` e `easypanel.yml`

### Opção 2: Deploy via Docker Hub (opcional)
Se preferir usar Docker Hub:

```powershell
# Build da imagem
docker build -t seu-usuario/sistema-os-luthieria:latest .

# Push para Docker Hub
docker push seu-usuario/sistema-os-luthieria:latest
```

## 📁 Estrutura do Projeto

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Database + Auth + Functions)
- **Deploy**: Docker + EasyPanel
- **Integração**: WhatsApp API

## 🔧 Configurações Importantes

### Variáveis de Ambiente Necessárias
```env
VITE_SUPABASE_URL=sua-url-supabase
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### Portas
- **Desenvolvimento**: 5173 (Vite dev server)
- **Produção**: 80 (nginx no container)

## ✅ Checklist Pré-Deploy

- [ ] Repositório criado no GitHub
- [ ] Código commitado e pushado
- [ ] Variáveis de ambiente configuradas
- [ ] Supabase configurado e funcionando
- [ ] Dockerfile testado localmente
- [ ] EasyPanel configurado

## 📞 Suporte

Para dúvidas sobre o deploy, verifique:
1. Logs do EasyPanel
2. Status do Supabase
3. Configurações de rede/firewall
4. Variáveis de ambiente
