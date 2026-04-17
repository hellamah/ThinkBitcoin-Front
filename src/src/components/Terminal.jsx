import { useState, useEffect, useRef } from 'react'
import { MdClose, MdTerminal, MdFiberManualRecord } from 'react-icons/md'
import { IconButton } from '@mui/material'

const Terminal = ({ messages = [], onCommand, onClose, status = 'ACTIVE', title = 'CHATBOT_INTERFACE' }) => {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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

    if (sender === 'USER') return <span className="msg-user">[VOCÊ] {text}</span>
    if (sender === 'BOT') return <span className="msg-agent">[IATB] {text}</span>
    
    // Fallback para logs brutos ou mensagens do sistema
    if (text.startsWith('[USER]')) return <span className="msg-user">{text}</span>
    if (text.startsWith('[SYSTEM]')) return <span className="msg-system">{text}</span>
    if (text.startsWith('[ERROR]')) return <span className="msg-error">{text}</span>
    if (text.startsWith('[AEGIS]') || text.startsWith('[AGENT]')) return <span className="msg-agent">{text}</span>
    
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
          
          {messages.map((msg, i) => (
            <div key={msg.id || i} className="terminal-line">
              <span className="prefix">&gt;</span>
              {formatMessage(msg)}
            </div>
          ))}
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
