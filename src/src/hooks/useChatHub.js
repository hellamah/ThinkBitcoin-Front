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
          
          // Identifica se é uma mensagem de status/sistema (transiente)
          const isStatus = log.includes('[SYSTEM]') || log.includes('Executando:');
          
          setMessages(prev => [
            ...prev.slice(-99),
            { 
              id: Date.now(), 
              text: log, 
              sender: 'BOT', 
              timestamp: new Date(),
              isStatus 
            }
          ]);
        });

        connection.on('ReceberResultadoDebate', (resultado) => {
          console.log('[ChatHub] Resultado final recebido:', resultado);

          const textoFormatado = `⚖️ VEREDITO FINAL: ${resultado.vereditoAegis}\n\n🎯 AÇÃO SUGERIDA: ${resultado.acao.toUpperCase()}\n📈 SCORE FINAL: ${resultado.scoreFinal}`;

          setMessages(prev => [
            ...prev,
            { 
              id: Date.now(), 
              text: textoFormatado, 
              sender: 'BOT', 
              timestamp: new Date(), 
              isResult: true,
              rawResult: resultado // Guardamos o objeto original para formatação rica no Terminal
            }
          ]);
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

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const enviarMensagem = useCallback(async (texto, payload = '', correlationId = null) => {
    if (!hubConnection) {
      console.warn('[ChatHub] Tentativa de enviar mensagem sem conexão criada.');
      return false;
    }

    if (!isConnected) {
      console.warn('[ChatHub] Tentativa de enviar mensagem enquanto desconectado. Aguardando conexão...');
      // Poderíamos implementar uma fila de espera aqui se necessário
      return false;
    }

    try {
      // Logamos a mensagem do usuário localmente para feedback imediato
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, text: texto, sender: 'USER', timestamp: new Date() }
      ]);

      // Lógica de Parsing Robusta
      const trimmedText = texto.trim();
      let comandoFinal = 'CHAT';
      let payloadFinal = trimmedText;

      // Identifica se é um comando (começa com # ou /)
      if (trimmedText.startsWith('#') || trimmedText.startsWith('/')) {
        const partes = trimmedText.split(/\s+/); // Divide por qualquer espaço em branco
        comandoFinal = partes[0].replace(/[#/]/g, '').toUpperCase();
        payloadFinal = partes.slice(1).join(' ').trim();
      } 
      // Caso especial: ANALISAR sem prefixo (retrocompatibilidade)
      else if (trimmedText.toUpperCase().startsWith('ANALISAR')) {
        const partes = trimmedText.split(/\s+/);
        comandoFinal = 'ANALISAR';
        payloadFinal = partes.slice(1).join(' ').trim();
      }

      // Comandos locais que não precisam ir para o servidor
      if (comandoFinal === 'LIMPAR' || comandoFinal === 'CLEAR') {
        clearMessages();
        return true;
      }

      const cmdMsg = {
        correlationId: (correlationId && correlationId.length === 36) ? correlationId : '00000000-0000-0000-0000-000000000000',
        comando: comandoFinal,
        payload: payloadFinal,
        timestamp: new Date().toISOString(),
        usuario: user?.idUsuarioTB || user?.id || ''
      };

      console.log(`[ChatHub] [${comandoFinal}] -> Enviando para o Servidor...`);

      try {
        // Invocando o nome exato definido no HubMethodName do servidor
        await hubConnection.invoke('ProcessarComandoAgente', cmdMsg);
        return true;
      } catch (invokeErr) {
        console.error('[ChatHub] Erro na invocação do método no servidor:', invokeErr);
        throw invokeErr;
      }
    } catch (err) {
      console.error('[ChatHub] Erro crítico ao processar/enviar mensagem:', err);
      return false;
    }
  }, [hubConnection, isConnected, user, clearMessages]);

  return {
    hubConnection,
    isConnected,
    messages,
    enviarMensagem,
    clearMessages
  };
}
