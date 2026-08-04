// A flag vive fora de mockApi.js de propósito. Quem só precisa saber "estou em
// modo demo?" importa daqui; o mockApi inteiro (21 KB minificados de respostas
// falsas) fica atrás de um import dinâmico e nunca entra no bundle de produção.
const parseUseMockFlag = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

const resolveUseMockEnv = () => {
  try {
    return import.meta.env?.VITE_USE_MOCK
  } catch {
    return undefined
  }
}

const resolveIsDevMode = () => {
  try {
    return Boolean(import.meta.env?.DEV)
  } catch {
    return false
  }
}

const resolveIsTestMode = () => {
  try {
    return import.meta.env?.MODE === 'test'
  } catch {
    return false
  }
}

const resolvedUseMockEnv = resolveUseMockEnv()

export const USE_MOCK_API =
  !resolveIsTestMode() &&
  (parseUseMockFlag(resolvedUseMockEnv) ||
   (resolvedUseMockEnv === undefined && resolveIsDevMode()))
