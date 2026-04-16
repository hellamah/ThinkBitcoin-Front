import { useState, useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_URL } from '../api';
import { useAuth } from '../context/AuthContext';

export default function useAgentHub() {
  const [hubConnection, setHubConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeDebates, setActiveDebates] = useState({}); // correlationId -> debateData
  const { token } = useAuth();
  
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
          console.log('[SignalR] Reconectando...');
        });

        connection.onreconnected(() => {
          setIsConnected(true);
          console.log('[SignalR] Reconectado.');
        });

        connection.onclose(() => {
          setIsConnected(false);
          console.log('[SignalR] Conexão falhou/fechou.');
        });

        connection.on('ReceberResultadoDebate', (resultado) => {
          console.log('[SignalR] Resultado de debate recebido:', resultado);
          setActiveDebates(prev => ({
            ...prev,
             [resultado.correlationId || resultado.CorrelationId]: resultado
          }));
        });

        await connection.start();
        setIsConnected(true);
        setHubConnection(connection);
        connectionRef.current = connection;
        console.log('[SignalR] Conectado ao AgentHub com sucesso.');

      } catch (err) {
        console.error('[SignalR] Erro na conexão:', err);
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

  const inscreverDebate = useCallback(async (correlationId) => {
    if (hubConnection && isConnected) {
      try {
        await hubConnection.invoke('InscreverDebate', correlationId);
        console.log(`[SignalR] Inscrito no debate ${correlationId}`);
      } catch (err) {
        console.error(`[SignalR] Erro ao inscrever no debate ${correlationId}:`, err);
      }
    } else {
        console.warn(`[SignalR] Não está conectado. Impossível inscrever em ${correlationId}`);
    }
  }, [hubConnection, isConnected]);

  return { hubConnection, isConnected, activeDebates, inscreverDebate };
}
