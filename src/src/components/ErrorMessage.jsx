import { Alert } from '@mui/material'
import { FiAlertCircle } from 'react-icons/fi'
import { MdClose } from 'react-icons/md'
import useTranslation from '../hooks/useTranslation'
import '../App.css'

function ErrorMessage({ message, onClose }) {
  // Antes do return antecipado: hook não pode ficar atrás de condição.
  const { t } = useTranslation()

  if (!message) return null
  return (
    <Alert 
      severity="error" 
      icon={<FiAlertCircle />} 
      className="error-msg" 
      sx={{ 
        position: 'relative',
        alignItems: 'center',
        marginBottom: '16px',
        borderRadius: '8px',
        backgroundColor: 'rgba(211, 47, 47, 0.1)',
        color: '#ffcdd2',
        border: '1px solid rgba(211, 47, 47, 0.5)',
        paddingRight: '50px',
        '& .MuiAlert-icon': {
          color: 'var(--danger)'
        }
      }}
    >
      {message}
      {/* type="button": o alerta é renderizado dentro do <form> do login, e o
          default do HTML é submit — fechar o erro reenviaria o formulário. */}
      <button type="button" className="btn-close-premium small" onClick={onClose} aria-label={t('close')}>
        <MdClose />
      </button>
    </Alert>
  )
}

export default ErrorMessage
