import { useState, useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_URL } from '../api';
import { useAuth } from '../context/AuthContext';

/**
 * Hook para gerenciar a conexão e interação com o Chatbot da ThinkBitcoin via SignalR.
 */
export default function useChatHub() {
  const [hubConnection, setHubConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]); // Histórico de mensagens do chat
  const { token, user } = useAuth();

  const connectionRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const connect = async () => {
      try {
        const connection = new signalR.HubConnectionBuilder()
          .withUrl(`${API_URL}/hubs/agent`, {
            accessTokenFactory: () => token,
          })
          .withAutomaticReconnect()
          .build();

        connection.onreconnecting(() => {
          setIsConnected(false);
          console.log('[ChatHub] Reconectando...');
        });

        connection.onreconnected(() => {
          setIsConnected(true);
          console.log('[ChatHub] Reconectado.');
        });

        connection.onclose(() => {
          setIsConnected(false);
          console.log('[ChatHub] Conexão encerrada.');
        });

        // O backend ainda usa os nomes "Agente" e "Debate", mas tratamos como Chat aqui.
        connection.on('ReceberLogAgente', (log) => {
          console.log('[ChatHub] Mensagem recebida:', log);
          setMessages(prev => [
            ...prev.slice(-99),
            { id: Date.now(), text: log, sender: 'BOT', timestamp: new Date() }
          ]);
        });

        connection.on('ReceberResultadoDebate', (resultado) => {
          console.log('[ChatHub] Resultado final recebido:', resultado);
          // Opcional: Tratar resultados específicos como mensagens especiais
        });

        await connection.start();
        setIsConnected(true);
        setHubConnection(connection);
        connectionRef.current = connection;
        console.log('[ChatHub] Conectado com sucesso.');

      } catch (err) {
        console.error('[ChatHub] Erro na conexão:', err);
      }
    };

    connect();

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
        setIsConnected(false);
      }
    };
  }, [token]);

  const enviarMensagem = useCallback(async (texto, payload = '', correlationId = null) => {
    if (hubConnection && isConnected) {
      try {
        // Logamos a mensagem do usuário localmente para feedback imediato
        setMessages(prev => [
          ...prev,
          { id: Date.now() + 1, text: texto, sender: 'USER', timestamp: new Date() }
        ]);

        const cmdMsg = {
          correlationId: correlationId && correlationId.length === 36 ? correlationId : '00000000-0000-0000-0000-000000000000',
          comando: 'CHAT',
          payload: texto,
          timestamp: new Date().toISOString(),
          usuario: user?.idUsuarioTB ?? ''
        };

        await hubConnection.invoke('ProcessarComandoAgente', cmdMsg);
        return true;
      } catch (err) {
        console.error('[ChatHub] Erro ao enviar mensagem:', err);
        return false;
      }
    }
    return false;
  }, [hubConnection, isConnected]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    hubConnection,
    isConnected,
    messages,
    enviarMensagem,
    clearMessages
  };
}
