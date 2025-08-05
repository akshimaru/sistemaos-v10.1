import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Componente de teste que não depende do Supabase
function TestApp() {
  const [status, setStatus] = React.useState('Verificando...');
  
  React.useEffect(() => {
    const checkEnvironment = async () => {
      try {
        // Verificar variáveis de ambiente
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        console.log('URL:', supabaseUrl);
        console.log('Key exists:', !!supabaseKey);
        
        if (!supabaseUrl || !supabaseKey) {
          setStatus('❌ Variáveis de ambiente não configuradas');
          return;
        }
        
        if (supabaseUrl.includes('your-project-ref')) {
          setStatus('❌ URL do Supabase ainda é placeholder');
          return;
        }
        
        // Tentar importar Supabase
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Teste básico
        const { error } = await supabase.auth.getSession();
        
        if (error) {
          setStatus(`⚠️ Erro na conexão: ${error.message}`);
        } else {
          setStatus('✅ Supabase conectado com sucesso!');
        }
        
      } catch (error) {
        console.error('Erro:', error);
        setStatus(`❌ Erro: ${error.message}`);
      }
    };
    
    checkEnvironment();
  }, []);
  
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        color: '#333',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        textAlign: 'center',
        maxWidth: '600px',
        width: '100%'
      }}>
        <h1 style={{ marginBottom: '20px' }}>
          Diagnóstico do Sistema
        </h1>
        
        <div style={{
          background: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          {status}
        </div>
        
        <div style={{ 
          background: '#e9ecef', 
          padding: '20px', 
          borderRadius: '5px',
          textAlign: 'left',
          fontSize: '14px'
        }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Configurações atuais:</h3>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>URL: {import.meta.env.VITE_SUPABASE_URL || 'Não definida'}</li>
            <li>Chave: {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Definida' : 'Não definida'}</li>
          </ul>
        </div>
        
        <button 
          onClick={() => window.location.reload()}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '20px',
            fontSize: '16px'
          }}
        >
          Recarregar
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TestApp />
  </StrictMode>
);
