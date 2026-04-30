import { NavLink, useLocation } from 'react-router-dom'
import { MdHome, MdLogin, MdDashboard, MdLogout, MdSettings } from 'react-icons/md'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import logoLight from '../../logo-light.svg'
import '../App.css'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import { useRef } from 'react'
function Layout({ children }) {
  const { token, user, logout } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  const containerRef = useRef(null)
  
  const handleMouseMove = (e) => {
    if (!containerRef.current) return
    const { left, top } = containerRef.current.getBoundingClientRect()
    const x = e.clientX - left
    const y = e.clientY - top
    containerRef.current.style.setProperty('--mouse-x', `${x}px`)
    containerRef.current.style.setProperty('--mouse-y', `${y}px`)
  }
  const semNav = false /* Padronizado para manter Header/Footer em todas as telas */

  const linkClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`

  const comum = (
    <>
      <IconButton
        component={NavLink}
        to="/"
        className={linkClass}
        title={t('nav.home')}
        aria-label={t('nav.home')}
      >
        <MdHome />
        <span className="nav-label">{t('nav.home')}</span>
      </IconButton>
      <IconButton
        component={NavLink}
        to="/dashboard"
        className={linkClass}
        title={t('nav.dashboard')}
        aria-label={t('nav.dashboard')}
      >
        <MdDashboard />
        <span className="nav-label">{t('nav.dashboard')}</span>
      </IconButton>
      <IconButton
        component={NavLink}
        to="/settings"
        className={linkClass}
        title={t('nav.settings')}
        aria-label={t('nav.settings')}
      >
        <MdSettings />
        <span className="nav-label">{t('nav.settings')}</span>
      </IconButton>
    </>
  )

  const visitante = (
    <>
      <IconButton
        component={NavLink}
        to="/login"
        className={linkClass}
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
                    className={linkClass}
                    title={t('nav.dashboard')}
                  >
                    <MdDashboard />
                    <span className="nav-label">{t('nav.dashboard')}</span>
                  </IconButton>
                </Box>
              )}
            </div>

            {!semNav && (
              <div className="header-right">
                <IconButton
                  component={NavLink}
                  to="/settings"
                  className={linkClass}
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
        {children}
      </main>
      <nav className="bottom-nav">{links}</nav>
      <footer className="app-footer">
        <p>{t('copyRight')}</p>
      </footer>
    </div>
  )
}

export default Layout
