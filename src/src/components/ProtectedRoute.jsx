import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { temCargo } from '../utils/authentication'

// `cargos`: a página é de quem tem um deles (ex.: a de administrador). Quem
// não tem volta ao painel, em vez de ver uma tela que a API só responderia com
// 403. A API confere o cargo de novo: isto decide o que mostrar, não o que
// pode.
export default function ProtectedRoute({ children, cargos }) {
  const { token, user } = useAuth()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  if (cargos?.length && !temCargo(user, ...cargos)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
