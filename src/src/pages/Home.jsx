import { useState, useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { MdArrowForward, MdBolt, MdAutoGraph, MdShield } from 'react-icons/md'
import useTranslation from '../hooks/useTranslation'
import '../App.css'

// Componente para contagem animada de números
const AnimatedNumber = ({ end, duration = 2000, suffix = '', decimals = 0 }) => {
  const [current, setCurrent] = useState(0)
  const countRef = useRef(null)

  useEffect(() => {
    let startTimestamp = null
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const value = progress * end
      setCurrent(value)
      if (progress < 1) {
        countRef.current = window.requestAnimationFrame(step)
      }
    }
    countRef.current = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(countRef.current)
  }, [end, duration])

  return (
    <span>
      {current.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

function Home() {
  const { t } = useTranslation()

  return (
    <div className="home-page-v3">
      {/* Background agora é gerenciado pelo Layout global */}

      {/* Hero Section */}
      <section className="home-section hero-v3">
        <div className="hero-tag">ThinkBitcoin OS // Neural Network v4.0</div>
        <h1 className="hero-title-v3">
          A Inteligência Que<br />Domina o Mercado.
        </h1>
        <p className="hero-desc-v3">
          Acesse a plataforma de elite que utiliza inteligência artificial avançada para antecipar movimentos e maximizar seus resultados no universo Bitcoin.
        </p>
        
        <div className="cta-group">
          <NavLink to="/register" className="btn-premium btn-primary-v3">
            Começar Agora <MdArrowForward />
          </NavLink>
          <NavLink to="/login" className="btn-premium btn-secondary-v3">
            Acessar Terminal
          </NavLink>
        </div>
      </section>

      {/* Stats Section */}
      <section className="home-section" style={{ paddingTop: 0 }}>
        <div className="stats-grid-v3">
          <div className="stat-item-v3">
            <div className="stat-num-v3">
              <AnimatedNumber end={94.8} decimals={1} suffix="%" />
            </div>
            <div className="stat-label-v3">Precisão da IA</div>
          </div>
          <div className="stat-item-v3">
            <div className="stat-num-v3">
              <AnimatedNumber end={1.5} decimals={1} suffix="M+" />
            </div>
            <div className="stat-label-v3">Dados/Seg</div>
          </div>
          <div className="stat-item-v3">
            <div className="stat-num-v3">
              <AnimatedNumber end={99.9} decimals={1} suffix="%" />
            </div>
            <div className="stat-label-v3">Uptime do Core</div>
          </div>
        </div>
      </section>

      {/* AI Showcase Section */}
      <section className="home-section">
        <div style={{ marginBottom: '40px' }}>
          <h2 className="terminal-text" style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '16px' }}>
            Powered by Deep Learning
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '500px' }}>
            Nossa plataforma é construída sobre uma infraestrutura de IA total, processando sentimentos, tendências e fluxos em tempo real.
          </p>
        </div>

        <div className="ai-showcase-v3">
          <div className="ai-core-v3"></div>
          
          <div className="ai-orbit-v3 orbit-1">
            <div className="orbit-node"></div>
            <MdBolt style={{ position: 'absolute', top: '50%', right: '0', color: 'var(--color-primary)', transform: 'translate(50%, -50%)', fontSize: '20px' }} />
          </div>
          
          <div className="ai-orbit-v3 orbit-2">
            <div className="orbit-node"></div>
            <MdAutoGraph style={{ position: 'absolute', bottom: '0', left: '50%', color: 'var(--color-primary)', transform: 'translate(-50%, 50%)', fontSize: '20px' }} />
          </div>
          
          <div className="ai-orbit-v3 orbit-3">
            <div className="orbit-node"></div>
            <MdShield style={{ position: 'absolute', top: '50%', left: '0', color: 'var(--color-primary)', transform: 'translate(-50%, -50%)', fontSize: '20px' }} />
          </div>

          <div style={{ position: 'absolute', fontFamily: 'Share Tech Mono', fontSize: '0.7rem', color: 'var(--color-primary)', opacity: 0.4 }}>
            SYSTEMAL_ANALYSIS_ACTIVE
          </div>
        </div>
      </section>

      {/* Spacing for layout */}
      <div style={{ height: '100px' }}></div>
    </div>
  )
}

export default Home
