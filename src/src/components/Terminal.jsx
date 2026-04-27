import { useState, useEffect, useRef } from 'react'
import { MdClose, MdTerminal, MdFiberManualRecord } from 'react-icons/md'
import { IconButton } from '@mui/material'

const Terminal = ({ messages = [], onCommand, onClose, status = 'ACTIVE', title = 'CHATBOT_INTERFACE' }) => {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const chatHistory = messages.filter(msg => !msg.isStatus)
  const currentStatus = messages.filter(msg => msg.isStatus).pop()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatHistory])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (input.trim()) {
        const fullCommand = input.trim()
        setHistory(prev => [fullCommand, ...prev].slice(0, 50))
        setHistoryIndex(-1)
        onCommand(fullCommand)
        setInput('')
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  const focusInput = () => {
    if (inputRef.current) inputRef.current.focus()
  }

  const formatMessage = (msg) => {
    const text = typeof msg === 'string' ? msg : msg.text
    const sender = msg.sender || 'SYSTEM'
    const isResult = msg.isResult

    if (isResult && msg.rawResult) {
      const res = msg.rawResult;
      const acao = res.acao?.toUpperCase() || 'HOLD';
      const colorClass = acao === 'BUY' ? 'positive' : acao === 'SELL' ? 'negative' : 'neutral';
      
      return (
        <div className={`result-card ${colorClass}`}>
          <div className="result-header">
            <MdFiberManualRecord className="blink" />
            <span>RELATÓRIO DE ANÁLISE CONCLUÍDO</span>
          </div>
          <div className="result-body">
            <div className="result-row">
              <span className="label">VEREDITO:</span>
              <span className="value">{res.vereditoAegis}</span>
            </div>
            <div className="result-main">
              <div className="action-box">
                <span className="action-label">AÇÃO SUGERIDA</span>
                <span className="action-value">{acao}</span>
              </div>
              <div className="score-box">
                <span className="score-label">SCORE</span>
                <span className="score-value">{res.scoreFinal}</span>
              </div>
            </div>
          </div>
          <div className="result-footer">
            TIMESTAMP: {new Date(msg.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )
    }

    if (sender === 'USER') return <span className="msg-user">[VOCÊ] {text}</span>
    if (sender === 'BOT') {
      let displayMsg = text;
      if (text.startsWith('[USER] Executando:')) return <span className="msg-system-alt">{text}</span>
      if (text.startsWith('[SYSTEM]')) return <span className="msg-system">{text}</span>
      
      return <span className="msg-agent">[IATB] {displayMsg}</span>
    }
    
    return <span>{text}</span>
  }

  return (
    <div className="terminal-container">
      <div className="terminal-window" onClick={focusInput}>
        <div className="terminal-header">
          <div className="terminal-status">
            <MdTerminal size={18} />
            <span>{title}::{status}</span>
            <div className={`status-indicator ${status === 'CONNECTED' ? 'pulse' : ''}`}></div>
          </div>
          <IconButton onClick={onClose} size="small" sx={{ color: '#00ff41' }}>
            <MdClose />
          </IconButton>
        </div>

        <div className="terminal-content" ref={scrollRef}>
          <div className="terminal-line">
            <span className="prefix">&gt;</span>
            <span className="msg-system">CONEXÃO SEGURA ESTABELECIDA COM A REDE THINKBITCOIN.</span>
          </div>
          
          {chatHistory.map((msg, i) => (
            <div key={msg.id || i} className="terminal-line">
              {msg.sender === 'USER' && <span className="prefix">&gt;</span>}
              {formatMessage(msg)}
            </div>
          ))}

          {currentStatus && (
            <div className="terminal-status-bar">
              <span className="status-label">STATUS:</span>
              <span className="status-text">{currentStatus.text.replace('[SYSTEM]', '').trim()}</span>
              <span className="status-dots">...</span>
            </div>
          )}
        </div>

        <div className="terminal-input-area">
          <span className="terminal-prompt">USER@TB-CHAT:~$</span>
          <input
            ref={inputRef}
            className="terminal-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck="false"
          />
          <div className="cursor"></div>
        </div>
      </div>
    </div>
  )
}

export default Terminal
