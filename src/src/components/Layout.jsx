import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { MdHome, MdLogin, MdDashboard, MdLogout, MdSettings, MdPublic, MdPsychology, MdWorkspacePremium, MdClose } from 'react-icons/md'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import logoLight from '../../logo-light.svg'
import '../App.css'
import { useAuth } from '../context/AuthContext'
import useConsentimento from '../hooks/useConsentimento'
import ConsentimentoLGPD from './ConsentimentoLGPD'
import CookieBanner from './CookieBanner'
import useTranslation from '../hooks/useTranslation'
import { useRef, useState, useEffect } from 'react'
function Layout({ children }) {
  const { token, user, logout } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [upsellVisivel, setUpsellVisivel] = useState(false)

  // Documentos que o usuário ainda precisa aceitar. Vem da API, e não de
  // uma marca no navegador: limpar o localStorage não pode apagar a dúvida
  // sobre o consentimento, e trocar de dispositivo não pode recriá-la.
  const { pendencias, registrar } = useConsentimento(token)

  // O modal não cobre as próprias páginas dos documentos: cobrar o aceite
  // por cima do texto impediria a leitura calma do que se está aceitando.
  const rotaDeLeituraLegal = location.pathname === '/privacidade' || location.pathname === '/termos'
  const consentimentoPendente = !!token && !rotaDeLeituraLegal && pendencias.length > 0

  // Um 403 da API significa "autenticado, mas sem o cargo exigido" — recurso
  // de assinatura paga. Em vez de cada página tratar o erro, o convite para
  // migrar de plano aparece aqui, uma única vez por navegação.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const aoRequererAssinatura = () => {
      if (token) setUpsellVisivel(true)
    }
    window.addEventListener('subscription-required', aoRequererAssinatura)
    return () => window.removeEventListener('subscription-required', aoRequererAssinatura)
  }, [token])

  useEffect(() => {
    setUpsellVisivel(false)
  }, [location.pathname])
  
  const handleMouseMove = (e) => {
    if (!containerRef.current) return
    const { left, top } = containerRef.current.getBoundingClientRect()
    const x = e.clientX - left
    const y = e.clientY - top
    containerRef.current.style.setProperty('--mouse-x', `${x}px`)
    containerRef.current.style.setProperty('--mouse-y', `${y}px`)
  }
  const semNav = false /* Padronizado para manter Header/Footer em todas as telas */

  // `nav-item` vai como string literal, e não pela forma de função que o
  // NavLink aceita: o IconButton do MUI funde a className com a dele via clsx
  // antes de repassá-la, e clsx descarta funções. A classe se perdia no
  // caminho — a regra `.nav-item` existia na folha de estilo e não chegava a
  // elemento nenhum, deixando a navegação inteira sem o estilo dela.
  //
  // Com string, o NavLink acrescenta o `active` por conta própria, que era a
  // única coisa que a versão em função ainda conseguia entregar ao DOM.

  const comum = (
    <>
      <IconButton
        component={NavLink}
        to="/"
        className="nav-item"
        title={t('nav.home')}
        aria-label={t('nav.home')}
      >
        <MdHome />
        <span className="nav-label">{t('nav.home')}</span>
      </IconButton>
      <IconButton
        component={NavLink}
        to="/dashboard"
        className="nav-item"
        title={t('nav.dashboard')}
        aria-label={t('nav.dashboard')}
      >
        <MdDashboard />
        <span className="nav-label">{t('nav.dashboard')}</span>
      </IconButton>
      <IconButton
        component={NavLink}
        to="/settings"
        className="nav-item"
        title={t('nav.settings')}
        aria-label={t('nav.settings')}
      >
        <MdSettings />
        <span className="nav-label">{t('nav.settings')}</span>
      </IconButton>
      <IconButton
        component={NavLink}
        to="/heatmap"
        className="nav-item"
        title={t('nav.heatmap') || 'Geopolítica'}
        aria-label={t('nav.heatmap') || 'Geopolítica'}
      >
        <MdPublic />
        <span className="nav-label">{t('nav.heatmap') || 'Geopolítica'}</span>
      </IconButton>
      <IconButton
        component={NavLink}
        to="/treinamento-episodios"
        className="nav-item"
        title={t('nav.training') || 'Treinamento IA'}
        aria-label={t('nav.training') || 'Treinamento IA'}
      >
        <MdPsychology />
        <span className="nav-label">{t('nav.training') || 'Treinamento IA'}</span>
      </IconButton>
    </>
  )

  const visitante = (
    <>
      <IconButton
        component={NavLink}
        to="/login"
        className="nav-item"
        title={t('nav.login')}
        aria-label={t('nav.login')}
      >
        <MdLogin />
        <span className="nav-label">{t('nav.login')}</span>
      </IconButton>
    </>
  )

  const logado = (
    <IconButton
      onClick={logout}
      className="nav-item"
      title={t('nav.logout')}
      aria-label={t('nav.logout')}
    >
      <MdLogout />
      <span className="nav-label">{t('nav.logout')}</span>
    </IconButton>
  )

  const links = token ? (
    <>
      {comum}
      {logado}
    </>
  ) : (
    <>
      {comum}
      {visitante}
    </>
  )

  return (
    <div 
      className={`portfolio-screen${semNav ? ' no-nav' : ''}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
    >
      <div className="liquid-mesh-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="mouse-spotlight"></div>
      </div>
      <div className="ambient-glow-aura"></div>
      <div className="grain-overlay-main"></div>

      <AppBar position="fixed" className="app-header-floating" sx={{ width: '100%', left: 0 }}>
        <Container maxWidth="xl">
          <Toolbar className="header-toolbar" disableGutters>
            <div className="header-left">
              <NavLink to="/" className="logo-link">
                <img src={logoLight} alt="ThinkBitcoin" className="app-logo" />
              </NavLink>
              {!semNav && (
                <Box component="nav" className="desktop-nav">
                  <IconButton
                    component={NavLink}
                    to="/dashboard"
                    className="nav-item"
                    title={t('nav.dashboard')}
                  >
                    <MdDashboard />
                    <span className="nav-label">{t('nav.dashboard')}</span>
                  </IconButton>
                  <IconButton
                    component={NavLink}
                    to="/heatmap"
                    className="nav-item"
                    title={t('nav.heatmap') || 'Geopolítica'}
                  >
                    <MdPublic />
                    <span className="nav-label">{t('nav.heatmap') || 'Geopolítica'}</span>
                  </IconButton>
                  <IconButton
                    component={NavLink}
                    to="/treinamento-episodios"
                    className="nav-item"
                    title={t('nav.training') || 'Treinamento IA'}
                  >
                    <MdPsychology />
                    <span className="nav-label">{t('nav.training') || 'Treinamento IA'}</span>
                  </IconButton>
                </Box>
              )}
            </div>

            {!semNav && (
              <div className="header-right">
                <IconButton
                  component={NavLink}
                  to="/settings"
                  className="nav-item"
                  title={t('nav.settings')}
                >
                  <MdSettings />
                </IconButton>
                
                <div className="user-info-pill">
                  <span className="user-name">
                    {token ? (user?.nome || t('activeUser')) : t('greetingGuest')}
                  </span>
                  {token ? (
                    <IconButton onClick={logout} className="logout-btn" title={t('nav.logout')}>
                      <MdLogout />
                    </IconButton>
                  ) : (
                    <div className="guest-actions">
                      <Button component={NavLink} to="/login" variant="text" size="small" sx={{ color: 'white' }}>
                        {t('nav.login')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Toolbar>
        </Container>
      </AppBar>
      
      <main className="main-content-premium" key={location.pathname}>
        {upsellVisivel && (
          <Box
            role="status"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
              mb: 3,
              p: 2,
              borderRadius: '12px',
              border: '1px solid var(--accent-a30)',
              backgroundColor: 'var(--accent-a08)',
            }}
          >
            <MdWorkspacePremium style={{ color: 'var(--accent-ink)', fontSize: '1.4rem', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: '200px', fontSize: '0.9rem' }}>
              {t('upsell.mensagem')}
            </span>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                setUpsellVisivel(false)
                navigate('/settings?planos=1')
              }}
            >
              {t('upsell.verPlanos')}
            </Button>
            <IconButton
              size="small"
              aria-label={t('close')}
              onClick={() => setUpsellVisivel(false)}
              sx={{ color: 'inherit' }}
            >
              <MdClose />
            </IconButton>
          </Box>
        )}
        {children}
      </main>
      {consentimentoPendente && (
        <ConsentimentoLGPD
          pendencias={pendencias}
          onConcluir={(itens, origem) => registrar({ itens, origem })}
        />
      )}
      {/* No Layout, e não na Home: quem entra por um link direto para /login,
          /dashboard ou /privacidade nunca passava pela Home e por isso nunca
          via o banner — nem tinha a escolha guardada no navegador sincronizada
          com a trilha do titular, porque o efeito que faz isso mora aqui
          dentro. O banner é a primeira pergunta do produto; não podia depender
          de qual porta a pessoa usou para entrar. */}
      <CookieBanner />
      <nav className="bottom-nav">{links}</nav>
      <footer className="app-footer">
        <p>{t('copyRight')}</p>
      </footer>
    </div>
  )
}

export default Layout
