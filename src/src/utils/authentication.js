import { apiRequest, AuthenticationEndpoint, HttpMethod } from './apiClient'

export const AuthTokenClaim = Object.freeze({
  ID: 'idUsuarioTB',
  NAME: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  EMAIL: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  ROLE: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
})

/**
 * Cargos emitidos pela API no claim de role.
 *
 * Espelham o CargoTipoEnum do backend. Servem para a interface decidir o que
 * oferecer ANTES de bater na API: sem isso, a única forma de descobrir que um
 * recurso é pago seria pedir e tomar 403 — o que faz o convite de assinatura
 * saltar na tela sem que o usuário tenha clicado em nada.
 */
export const AuthRole = Object.freeze({
  ADMINISTRADOR: 'Administrador',
  MINERADOR: 'Minerador',
  CONSULTOR: 'Consultor',
  SISTEMA: 'Sistema',
})

// O claim de role vem como string quando há um cargo só e como array quando há
// vários — é assim que o .NET serializa, e tratar só um dos casos deixa o outro
// silenciosamente sem cargo nenhum.
const normalizarCargos = (valor) => {
  if (Array.isArray(valor)) return valor.filter((c) => typeof c === 'string')
  if (typeof valor === 'string') return [valor]
  return []
}

const normalizeBase64 = (valor) => {
  if (typeof valor !== 'string') return null
  const sanitized = valor.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (sanitized.length % 4)) % 4
  return sanitized + '='.repeat(padding)
}

const decodeBase64 = (valor) => {
  try {
    // Ambiente Node.js (comum em testes vitest)
    /* istanbul ignore next */
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(valor, 'base64').toString('utf-8')
    }

    // Ambiente Browser
    if (typeof atob === 'function') {
      const binStr = atob(valor)
      // Técnica moderna com TextDecoder
      if (typeof TextDecoder !== 'undefined') {
        const bytes = new Uint8Array(binStr.length)
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i)
        }
        return new TextDecoder().decode(bytes)
      }
      // Fallback para navegadores muito antigos (se existirem)
      return decodeURIComponent(escape(binStr))
    }
  } catch {
    /* istanbul ignore next */
  }

  throw new Error('Nenhum decodificador base64 disponível ou falha na decodificação')
}

const decodeJwtPayload = (token) => {
  if (typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length < 2) return null
  const base64 = normalizeBase64(partes[1])
  if (!base64) return null
  try {
    const decoded = decodeBase64(base64)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Retorna true se o token JWT tiver claim `exp` no passado.
 * Tokens sem `exp` (ex.: mocks de desenvolvimento) são tratados como válidos.
 */
export const isAuthenticationTokenExpired = (token) => {
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  return payload.exp * 1000 <= Date.now()
}

export const decodeAuthenticationToken = (token) => {
  const payload = decodeJwtPayload(token)
  if (!payload) return null

  // Busca o ID de forma insensível a maiúsculas/minúsculas nas chaves do payload
  const keys = Object.keys(payload)
  const idKey = keys.find(k => k.toLowerCase() === 'idusuariotb')
  const id = idKey ? payload[idKey] : (payload['sub'] || payload['nameid'] || null)

  return {
    idUsuarioTB: id,
    nome: payload[AuthTokenClaim.NAME] ?? payload['unique_name'] ?? payload['name'] ?? '',
    email: payload[AuthTokenClaim.EMAIL] ?? payload['email'] ?? '',
    cargos: normalizarCargos(payload[AuthTokenClaim.ROLE] ?? payload['role'] ?? payload['roles']),
  }
}

/**
 * Retorna true se o usuário tiver ao menos um dos cargos informados.
 *
 * Usuário sem cargo nenhum (token de mock, sessão antiga) responde false: negar
 * por omissão só esconde um botão, enquanto liberar por omissão prometeria um
 * recurso que a API vai recusar depois.
 */
export const temCargo = (user, ...cargos) => {
  const doUsuario = user?.cargos
  if (!Array.isArray(doUsuario) || doUsuario.length === 0) return false
  return cargos.some((cargo) =>
    doUsuario.some((c) => c.toLowerCase() === String(cargo).toLowerCase())
  )
}

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
