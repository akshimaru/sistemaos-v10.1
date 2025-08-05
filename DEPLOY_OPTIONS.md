# Configurações de Deploy - Sistema OS Luthieria v10

Este projeto possui configurações para múltiplas plataformas de deploy:

## ✅ Plataformas Suportadas

### 🐳 Docker (EasyPanel, DigitalOcean App Platform, AWS, etc.)
- **Arquivo**: `Dockerfile`
- **Configuração**: `easypanel.yml`
- **Porta**: 80
- **Comando**: Automático via Docker

### 📦 Nixpacks (Railway, Render, Vercel, etc.)
- **Arquivo**: `nixpacks.toml`
- **Backup**: `Procfile`
- **Porta**: 8080 (via variável $PORT)
- **Comando**: `npx serve dist -s -l $PORT`

### ⚡ Vercel/Netlify (Static)
- **Build**: `npm run build`
- **Output**: `dist/`
- **Comando**: Automático (SPA)

## 🔧 Configuração por Plataforma

### EasyPanel (Docker)
```yaml
# easypanel.yml já configurado
env:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
```

### Railway (Nixpacks)
```toml
# nixpacks.toml já configurado
[variables]
NODE_VERSION = "18"
PORT = "8080"
```

### Render (Nixpacks/Docker)
**Opção 1 - Nixpacks:**
- Build Command: `npm run build`
- Start Command: `npx serve dist -s -l $PORT`

**Opção 2 - Docker:**
- Usar Dockerfile existente

### Vercel
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`

### Netlify
- Build Command: `npm run build`
- Publish Directory: `dist`
- Node Version: 18

## 🌍 Variáveis de Ambiente (Todas as Plataformas)

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
```

## 📋 Deploy por Plataforma

### 1. EasyPanel
1. Conecte repositório GitHub
2. Configure variáveis de ambiente
3. Deploy automático com Docker

### 2. Railway
1. Conecte repositório GitHub  
2. Configure variáveis de ambiente
3. Deploy automático com Nixpacks

### 3. Render
1. New Web Service → GitHub
2. Build: `npm run build`
3. Start: `npx serve dist -s -l $PORT`
4. Configure variáveis de ambiente

### 4. Vercel
1. Import GitHub repository
2. Framework: Vite
3. Configure environment variables
4. Deploy automático

### 5. Netlify
1. New site from Git
2. Build: `npm run build`
3. Publish: `dist`
4. Configure environment variables

## 🚀 Recomendações

- **Para facilidade**: Vercel ou Netlify (grátis, SPA automático)
- **Para controle total**: EasyPanel com Docker
- **Para simplicidade**: Railway com Nixpacks
- **Para performance**: DigitalOcean App Platform com Docker

## ⚠️ Notas Importantes

1. **SPA Routing**: O projeto usa React Router, certifique-se de configurar redirects para `index.html`
2. **Environment Variables**: Sempre configure as variáveis do Supabase
3. **Build Time**: ~2-3 minutos (dependendo da plataforma)
4. **Node Version**: 18+ requerido
