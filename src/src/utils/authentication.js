import { apiRequest, AuthenticationEndpoint, HttpMethod } from './apiClient'

const obterToken = (dados) => dados?.resultado?.tokenAutenticado

export const authenticate = async ({ email, senha }) => {
  const data = await apiRequest(AuthenticationEndpoint.LOGIN, {
    method: HttpMethod.POST,
    body: { email, senha },
  })

  const token = obterToken(data)
  if (!token) {
    throw new Error('Token de autenticação ausente na resposta')
  }

  return data.resultado
}

export default authenticate
