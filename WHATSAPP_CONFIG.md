# Configuração do Sistema WhatsApp

Este sistema oferece duas opções para envio de mensagens via WhatsApp:

## 1. Método Direto (Padrão)
- Abre WhatsApp Web em uma nova aba
- Não requer configurações adicionais
- Funciona imediatamente

## 2. Método via Webhook (Evolution API + N8N)
- Envio automático através de Evolution API
- Integração com N8N para automação
- Requer configuração inicial

### Configuração do Webhook

1. **Acesse as Configurações**
   - No menu do perfil, clique em "WhatsApp"
   - Ou acesse diretamente: `/configuracoes-whatsapp`

2. **Configure o Webhook**
   - Escolha "Via Webhook" como método
   - Insira a URL do seu webhook N8N
   - Configure API Key (se necessário)
   - Defina o nome da instância Evolution API

3. **Teste a Configuração**
   - Use o botão "Testar Webhook" para validar
   - Salve as configurações

### Estrutura do Payload Enviado

```json
{
  "to": "5511999999999",
  "message": "Texto da mensagem",
  "instance": "nome_da_instancia",
  "timestamp": "2025-07-10T20:00:00.000Z"
}
```

### Funcionalidades

- **Envio Manual**: Botão WhatsApp nas ordens de serviço
- **Envio Automático**: Quando ordem é marcada como "Concluído"
- **Logs**: Histórico de mensagens enviadas
- **Fallback**: Em caso de erro no webhook, pode voltar ao método direto

### Mensagens Automáticas

1. **Ordem de Serviço**: Detalhes completos da OS
2. **Conclusão**: Notificação de serviço pronto

### Suporte a Headers

- `Content-Type: application/json` (automático)
- `Authorization: Bearer {api_key}` (se configurado)

### Troubleshooting

- Verifique a URL do webhook
- Confirme se a Evolution API está ativa
- Teste a conectividade com o botão de teste
- Verifique os logs do N8N para debugs
