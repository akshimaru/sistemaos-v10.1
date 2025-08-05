# 🚀 Guia Rápido de Deploy

## 1. Criar Repositório no GitHub

1. Acesse [GitHub.com](https://github.com) e faça login
2. Clique no botão **"New"** ou no ícone **"+"** → **"New repository"**
3. Configure o repositório:
   - **Repository name**: `sistema-os-luthieria-v10` (ou outro nome de sua preferência)
   - **Description**: `Sistema completo de gestão para luthieria com ordens de serviço, controle financeiro e integração WhatsApp`
   - **Visibility**: Private (recomendado para uso comercial) ou Public
   - **❌ NÃO marcar** "Add a README file"
   - **❌ NÃO marcar** "Add .gitignore" 
   - **❌ NÃO marcar** "Choose a license"
4. Clique em **"Create repository"**

## 2. Conectar o Repositório Local

Após criar o repositório no GitHub, execute estes comandos:

```powershell
# Navegar até o projeto (já feito)
cd "c:\Users\Vibratho Servidor\Documents\sistemaos-v10-main"

# Adicionar o remote origin (SUBSTITUA YOUR_USERNAME pelo seu usuário GitHub)
git remote add origin https://github.com/YOUR_USERNAME/sistema-os-luthieria-v10.git

# Fazer push para o GitHub
git push -u origin main
```

**⚠️ IMPORTANTE**: Substitua `YOUR_USERNAME` pelo seu nome de usuário do GitHub!

## 3. Deploy no EasyPanel

### Método 1: Deploy Direto do GitHub (Recomendado)
1. Acesse seu painel do EasyPanel
2. Clique em **"Create Project"** ou **"New App"**
3. Selecione **"GitHub"** como fonte
4. Conecte e selecione seu repositório `sistema-os-luthieria-v10`
5. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`: Sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY`: Sua chave anônima do Supabase
6. O EasyPanel detectará automaticamente o `Dockerfile` e `easypanel.yml`
7. Clique em **"Deploy"**

### Método 2: Deploy Manual via Docker
Se preferir usar Docker Hub:

```powershell
# Build da imagem
docker build -t seu-usuario/sistema-os-luthieria:latest .

# Push para Docker Hub
docker push seu-usuario/sistema-os-luthieria:latest
```

## 4. Configurações Importantes

### Variáveis de Ambiente Obrigatórias
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
```

### Portas
- **Desenvolvimento**: 5173
- **Produção**: 80 (configurado no Docker)

## 5. Verificações Pós-Deploy

Após o deploy, verifique:
- [ ] Aplicação carregando corretamente
- [ ] Login funcionando (conexão com Supabase)
- [ ] Dashboard acessível
- [ ] Funcionalidades principais operacionais

## 🔧 Troubleshooting

### Problemas Comuns

**1. Erro de autenticação no Git:**
```powershell
# Configurar suas credenciais
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@exemplo.com"
```

**2. Erro de conexão com Supabase:**
- Verifique se as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão corretas
- Confirme se o projeto Supabase está ativo

**3. Build falhando:**
- Verifique se todas as dependências estão no `package.json`
- Confirme se o Node.js está na versão 18 ou superior

## 📞 Próximos Passos

1. ✅ Criar repositório GitHub
2. ✅ Push do código
3. ✅ Deploy no EasyPanel
4. ⏳ Testar funcionalidades
5. ⏳ Configurar domínio personalizado (opcional)
6. ⏳ Configurar monitoramento
