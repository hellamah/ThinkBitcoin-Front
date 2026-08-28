import { Component } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import useTranslation from '../hooks/useTranslation'

/**
 * Error Boundary de renderização. Um try/catch em volta do JSX de um componente
 * não captura erros dos filhos (o React renderiza os filhos fora daquele stack);
 * apenas class components com getDerivedStateFromError conseguem interceptá-los.
 *
 * A classe recebe `t` por prop em vez de ler o contexto: hooks não existem em
 * class component, e o wrapper abaixo resolve isso sem obrigar quem usa o
 * componente a saber da diferença. O provedor de tradução fica acima do
 * boundary (main.jsx), então a tela de erro sempre tem dicionário disponível.
 */
class LimiteDeErro extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erro não tratado na renderização:', error, info?.componentStack)
  }

  render() {
    const { t } = this.props

    if (this.state.error) {
      return (
        <Box
          sx={{
            p: 5,
            color: 'var(--danger-ink)',
            backgroundColor: 'var(--surface-base)',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <Typography variant="h5">{t('erroGlobal.titulo')}</Typography>
          {/* A mensagem técnica não é traduzida de propósito: vem do erro em si,
              e reescrevê-la esconderia o texto que serve para depurar. */}
          <Typography sx={{ mt: 2, opacity: 0.7 }}>{this.state.error.message}</Typography>
          <Button
            variant="outlined"
            sx={{ mt: 4, color: 'var(--accent-ink)', borderColor: 'var(--accent)' }}
            onClick={() => window.location.reload()}
          >
            {t('erroGlobal.recarregar')}
          </Button>
        </Box>
      )
    }
    return this.props.children
  }
}

export default function ErrorBoundary({ children }) {
  const { t } = useTranslation()
  return <LimiteDeErro t={t}>{children}</LimiteDeErro>
}
