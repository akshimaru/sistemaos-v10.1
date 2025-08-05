# Guia de Deployment no EasyPanel

Este guia explica como fazer o deploy do Sistema OS Luthieria no EasyPanel.

## Pré-requisitos

1. **Conta no EasyPanel**: Tenha uma conta ativa no EasyPanel
2. **Projeto Supabase**: Configure um projeto no Supabase com as migrações aplicadas
3. **Domínio (opcional)**: Para usar um domínio personalizado

## Configuração do Supabase

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Anote a URL do projeto e a chave anônima

### 2. Aplicar Migrações

Execute as migrações SQL na ordem correta no SQL Editor do Supabase:

1. Acesse o SQL Editor no dashboard do Supabase
2. Execute cada arquivo de migração da pasta `supabase/migrations/` em ordem cronológica
3. Verifique se todas as tabelas foram criadas corretamente

### 3. Configurar Autenticação

1. Vá para Authentication > Settings
2. Configure o Site URL para seu domínio
3. Adicione URLs de redirecionamento se necessário

## Deploy no EasyPanel

### Método 1: Deploy via Git (Recomendado)

1. **Conectar Repositório**:
   - No EasyPanel, clique em "New App"
   - Selecione "Git Repository"
   - Conecte seu repositório GitHub/GitLab

2. **Configurar Build**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Node Version: `18`

3. **Configurar Variáveis de Ambiente**:
   ```
   VITE_SUPABASE_URL=sua_url_do_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima
   ```

4. **Deploy**:
   - Clique em "Deploy"
   - Aguarde o build completar

### Método 2: Deploy via Docker

1. **Criar Nova Aplicação**:
   - No EasyPanel, clique em "New App"
   - Selecione "Docker"

2. **Configurar Docker**:
   - Use o `Dockerfile` fornecido
   - Port: `80`

3. **Configurar Variáveis de Ambiente**:
   ```
   VITE_SUPABASE_URL=sua_url_do_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima
   ```

4. **Deploy**:
   - Clique em "Deploy"
   - Aguarde o container inicializar

## Configuração de Domínio

1. **Adicionar Domínio**:
   - Vá para a aba "Domains"
   - Adicione seu domínio personalizado
   - Configure SSL automático

2. **Configurar DNS**:
   - Aponte seu domínio para o IP fornecido pelo EasyPanel
   - Aguarde a propagação DNS (pode levar até 24h)

## Configurações Avançadas

### SSL/HTTPS

O EasyPanel configura SSL automaticamente via Let's Encrypt. Certifique-se de:
- Ter o domínio apontando corretamente
- Aguardar a emissão do certificado

### Monitoramento

Configure alertas no EasyPanel para:
- CPU usage > 80%
- Memory usage > 90%
- Application downtime

### Backup

Configure backups regulares:
1. Backup do banco Supabase (automático)
2. Backup das configurações da aplicação

## Solução de Problemas

### Build Falha

1. Verifique se todas as dependências estão no `package.json`
2. Confirme que o Node.js version é compatível
3. Verifique logs de build no EasyPanel

### Aplicação Não Carrega

1. Verifique se as variáveis de ambiente estão corretas
2. Confirme se o Supabase está acessível
3. Verifique logs da aplicação

### Erro de Conexão com Supabase

1. Verifique URL e chave do Supabase
2. Confirme se o projeto Supabase está ativo
3. Verifique configurações de CORS no Supabase

### Performance Issues

1. Configure cache no nginx
2. Otimize imagens e assets
3. Configure CDN se necessário

## Manutenção

### Atualizações

1. Faça push das alterações para o repositório
2. O EasyPanel fará deploy automático (se configurado)
3. Monitore logs durante o deploy

### Monitoramento

- Acesse métricas no dashboard do EasyPanel
- Configure alertas para problemas críticos
- Monitore uso de recursos

### Backup e Restore

1. Backup automático do Supabase
2. Export manual de dados críticos
3. Teste procedimentos de restore regularmente

## Suporte

Para suporte adicional:
- Documentação do EasyPanel
- Documentação do Supabase
- Issues no repositório do projeto