import { Alert } from '@mui/material'
import { FiAlertCircle } from 'react-icons/fi'
import '../App.css'

function ErrorMessage({ message }) {
  if (!message) return null
  return (
    <Alert severity="error" icon={<FiAlertCircle />} className="error-msg" sx={{ alignItems: 'center' }}>
      {message}
    </Alert>
  )
}

export default ErrorMessage
