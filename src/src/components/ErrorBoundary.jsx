import { Component } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

/**
 * Error Boundary de renderização. Um try/catch em volta do JSX de um componente
 * não captura erros dos filhos (o React renderiza os filhos fora daquele stack);
 * apenas class components com getDerivedStateFromError conseguem interceptá-los.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erro não tratado na renderização:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <Box
          sx={{
            p: 5,
            color: '#ff5252',
            background: '#0a0a0a',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <Typography variant="h5">Ocorreu um erro ao carregar a página.</Typography>
          <Typography sx={{ mt: 2, opacity: 0.7 }}>{this.state.error.message}</Typography>
          <Button
            variant="outlined"
            sx={{ mt: 4, color: '#ffd700', borderColor: '#ffd700' }}
            onClick={() => window.location.reload()}
          >
            Recarregar Página
          </Button>
        </Box>
      )
    }
    return this.props.children
  }
}
