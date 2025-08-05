import Swal from 'sweetalert2';
import { WhatsAppService } from './whatsapp-service';

export const alerts = {
  success: (message: string) => {
    return Swal.fire({
      title: 'Sucesso!',
      text: message,
      icon: 'success',
      confirmButtonText: 'OK',
      confirmButtonColor: '#8B5CF6',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg'
      }
    });
  },

  error: (message: string) => {
    return Swal.fire({
      title: 'Erro!',
      text: message,
      icon: 'error',
      confirmButtonText: 'OK',
      confirmButtonColor: '#8B5CF6',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg'
      }
    });
  },

  info: (message: string) => {
    return Swal.fire({
      title: 'Informação',
      text: message,
      icon: 'info',
      confirmButtonText: 'OK',
      confirmButtonColor: '#8B5CF6',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg'
      }
    });
  },

  confirm: (options: {
    title: string;
    text: string;
    icon?: 'warning' | 'error' | 'success' | 'info' | 'question';
    confirmButtonText?: string;
    cancelButtonText?: string;
  }) => {
    return Swal.fire({
      title: options.title,
      text: options.text,
      icon: options.icon || 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8B5CF6',
      cancelButtonColor: '#d33',
      confirmButtonText: options.confirmButtonText || 'Sim',
      cancelButtonText: options.cancelButtonText || 'Cancelar',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg',
        cancelButton: 'rounded-lg'
      }
    });
  },

  orderDetails: (ordem: any, onStatusUpdate?: () => void) => {
    return Swal.fire({
      title: `Ordem #${ordem.numero}`,
      html: `<div class="text-left space-y-6">
        <div class="bg-purple-50/50 p-4 rounded-lg">
          <p class="font-semibold text-gray-800 mb-2">Informações do Cliente</p>
          <p class="text-gray-700 mb-1"><strong>Nome:</strong> ${ordem.cliente?.nome || 'N/A'}</p>
          <p class="text-gray-700 mb-1"><strong>Telefone:</strong> ${ordem.cliente?.telefone || 'N/A'}</p>
        </div>
        
        <div class="bg-blue-50/50 p-4 rounded-lg">
          <p class="font-semibold text-gray-800 mb-2">Informações do Instrumento</p>
          <p class="text-gray-700 mb-1"><strong>Instrumento:</strong> ${ordem.instrumento?.nome || 'N/A'}</p>
          <p class="text-gray-700 mb-1"><strong>Marca:</strong> ${ordem.marca?.nome || 'N/A'}</p>
          <p class="text-gray-700 mb-1"><strong>Modelo:</strong> ${ordem.modelo || 'N/A'}</p>
          <p class="text-gray-700 mb-1"><strong>Acessórios:</strong> ${ordem.acessorios || 'N/A'}</p>
        </div>
        
        <div class="bg-gray-50/50 p-4 rounded-lg">
          <div class="space-y-2">
            <div>
              <p class="text-gray-700"><strong>Status Atual:</strong> <span class="px-2 py-1 rounded text-sm ${
                ordem.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                ordem.status === 'em_andamento' ? 'bg-blue-100 text-blue-800' :
                ordem.status === 'atraso' ? 'bg-red-100 text-red-800' :
                'bg-green-100 text-green-800'
              }">${
                ordem.status === 'pendente' ? 'Pendente' :
                ordem.status === 'em_andamento' ? 'Em Andamento' :
                ordem.status === 'atraso' ? 'Em Atraso' :
                'Concluído'
              }</span></p>
            </div>
            <div>
              <p class="text-gray-700"><strong>Observações Adicionais:</strong></p>
              <p class="text-gray-600 text-sm whitespace-pre-wrap">${ordem.observacoes || 'Nenhuma observação adicional.'}</p>
            </div>
          </div>
        </div>

        <div class="bg-green-50/50 p-4 rounded-lg border border-green-200">
          <p class="font-semibold text-green-800 mb-3">🚀 Ações Rápidas com WhatsApp</p>
          <div class="grid grid-cols-1 gap-2">
            <button type="button" id="btn-andamento" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              📧 Avisar: Serviço em Andamento
            </button>
            <button type="button" id="btn-atraso" class="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
              ⏰ Avisar: Tivemos um Contratempo
            </button>
            <button type="button" id="btn-finalizar" class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
              ✅ Finalizar e Avisar Cliente
            </button>
          </div>
        </div>
      </div>`,
      icon: 'info',
      confirmButtonColor: '#8B5CF6',
      confirmButtonText: 'Fechar',
      width: '42rem',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg',
        htmlContainer: 'text-left'
      },
      didOpen: () => {
        const btnAndamento = document.getElementById('btn-andamento');
        const btnAtraso = document.getElementById('btn-atraso');
        const btnFinalizar = document.getElementById('btn-finalizar');

        btnAndamento?.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Desabilitar o botão para evitar cliques duplos
          if (btnAndamento) {
            (btnAndamento as HTMLButtonElement).disabled = true;
            btnAndamento.textContent = 'Enviando...';
          }
          
          try {
            await WhatsAppService.sendProgressMessage(ordem);
            await alerts.updateOrderStatus(ordem.id, 'em_andamento');
            
            // Fechar o modal atual
            Swal.close();
            
            // Mostrar sucesso
            setTimeout(async () => {
              await alerts.success('Status atualizado para "Em Andamento" e mensagem WhatsApp enviada!');
              // Chamar callback para atualizar a interface
              if (onStatusUpdate) onStatusUpdate();
            }, 300);
            
          } catch (error: any) {
            console.error('❌ Erro ao enviar mensagem de andamento:', error);
            
            // Reabilitar o botão
            if (btnAndamento) {
              (btnAndamento as HTMLButtonElement).disabled = false;
              btnAndamento.textContent = '📧 Avisar: Serviço em Andamento';
            }
            
            await alerts.error('Erro ao enviar mensagem: ' + (error?.message || error));
          }
        });

        btnAtraso?.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Desabilitar o botão para evitar cliques duplos
          if (btnAtraso) {
            (btnAtraso as HTMLButtonElement).disabled = true;
            btnAtraso.textContent = 'Enviando...';
          }
          
          try {
            await WhatsAppService.sendDelayMessage(ordem);
            await alerts.updateOrderStatus(ordem.id, 'atraso');
            
            // Fechar o modal atual
            Swal.close();
            
            // Mostrar sucesso
            setTimeout(async () => {
              await alerts.success('Status atualizado para "Em Atraso" e mensagem WhatsApp enviada!');
              // Chamar callback para atualizar a interface
              if (onStatusUpdate) onStatusUpdate();
            }, 300);
            
          } catch (error: any) {
            console.error('❌ Erro ao enviar mensagem de atraso:', error);
            
            // Reabilitar o botão
            if (btnAtraso) {
              (btnAtraso as HTMLButtonElement).disabled = false;
              btnAtraso.textContent = '⏰ Avisar: Tivemos um Contratempo';
            }
            
            await alerts.error('Erro ao enviar mensagem: ' + (error?.message || error));
          }
        });

        btnFinalizar?.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Desabilitar o botão para evitar cliques duplos
          if (btnFinalizar) {
            (btnFinalizar as HTMLButtonElement).disabled = true;
            btnFinalizar.textContent = 'Finalizando...';
          }
          
          try {
            await WhatsAppService.sendCompletionMessage(ordem);
            await alerts.updateOrderStatus(ordem.id, 'concluido');
            
            // Fechar o modal atual
            Swal.close();
            
            // Mostrar sucesso
            setTimeout(async () => {
              await alerts.success('Ordem finalizada e cliente notificado via WhatsApp!');
              // Chamar callback para atualizar a interface
              if (onStatusUpdate) onStatusUpdate();
            }, 300);
            
          } catch (error: any) {
            console.error('❌ Erro ao finalizar ordem:', error);
            
            // Reabilitar o botão
            if (btnFinalizar) {
              (btnFinalizar as HTMLButtonElement).disabled = false;
              btnFinalizar.textContent = '✅ Finalizar e Avisar Cliente';
            }
            
            await alerts.error('Erro ao finalizar ordem: ' + (error?.message || error));
          }
        });
      }
    });
  },

  updateOrderStatus: async (ordemId: string, status: string) => {
    const { supabase } = await import('../lib/supabase');
    
    const { error } = await supabase
      .from('ordens_servico')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', ordemId);

    if (error) throw error;
  }
};