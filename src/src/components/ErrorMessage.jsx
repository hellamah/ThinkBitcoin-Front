import { Alert } from '@mui/material'
import { FiAlertCircle } from 'react-icons/fi'
import '../App.css'

function ErrorMessage({ message, onClose }) {
  if (!message) return null
  return (
    <Alert 
      severity="error" 
      icon={<FiAlertCircle />} 
      className="error-msg" 
      sx={{ 
        alignItems: 'center',
        marginBottom: '16px',
        borderRadius: '8px',
        backgroundColor: 'rgba(211, 47, 47, 0.1)',
        color: '#ffcdd2',
        border: '1px solid rgba(211, 47, 47, 0.5)',
        '& .MuiAlert-icon': {
          color: '#f44336'
        }
      }}
      onClose={onClose}
    >
      {message}
    </Alert>
  )
}

export default ErrorMessage
