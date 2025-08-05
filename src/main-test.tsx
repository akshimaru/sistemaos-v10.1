import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Componente de teste simples
function TestApp() {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>
          ✅ React Funcionando!
        </h1>
        <p style={{ color: '#666', lineHeight: '1.6' }}>
          Se você está vendo esta mensagem, o React está carregando corretamente.
          O problema anterior era que as variáveis de ambiente do Supabase não estavam configuradas.
        </p>
        <div style={{ 
          background: '#f8f9fa', 
          padding: '15px', 
          borderRadius: '5px', 
          marginTop: '20px',
          textAlign: 'left'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Para resolver:</h3>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
            <li>Configure o arquivo .env com suas credenciais reais do Supabase</li>
            <li>Substitua as URLs placeholder pelas URLs reais do seu projeto</li>
            <li>Reinicie o servidor de desenvolvimento</li>
          </ol>
        </div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '20px'
          }}
        >
          Recarregar Página
        </button>
      </div>
    </div>
  );
}

// Renderizar o componente de teste
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TestApp />
  </StrictMode>
);
