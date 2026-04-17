import { useState, useEffect, useRef } from 'react'
import { MdClose, MdTerminal, MdFiberManualRecord } from 'react-icons/md'
import { IconButton } from '@mui/material'

const Terminal = ({ logs = [], onCommand, onClose, status = 'ACTIVE', title = 'CORE_AGENT_LINK' }) => {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

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

  const formatLog = (log) => {
    const text = typeof log === 'string' ? log : log.text
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
            <div className={`status-indicator ${status === 'ACTIVE' ? 'pulse' : ''}`}></div>
          </div>
          <IconButton onClick={onClose} size="small" sx={{ color: '#00ff41' }}>
            <MdClose />
          </IconButton>
        </div>

        <div className="terminal-content" ref={scrollRef}>
          <div className="terminal-line">
            <span className="prefix">&gt;</span>
            <span className="msg-system">SISTEMA INICIALIZADO. CANAL DE COMANDO SEGURO ESTABELECIDO.</span>
          </div>
          
          {logs.map((log, i) => (
            <div key={log.id || i} className="terminal-line">
              <span className="prefix">&gt;</span>
              {formatLog(log)}
            </div>
          ))}
        </div>

        <div className="terminal-input-area">
          <span className="terminal-prompt">AGENTE@THINKBITCOIN:~$</span>
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
