const getLocation = () => {
  if (typeof window === 'undefined' || !window.location) {
    return {
      protocol: 'http:',
      hostname: 'localhost',
    }
  }
  return window.location
}

const location = getLocation()
const protocol = location.protocol === 'https:' ? 'https:' : 'http:'
const defaultPort = '13501'
const hostUrl = `${protocol}//${location.hostname}:${defaultPort}`

const resolveEnvUrl = () => {
  try {
    return import.meta.env?.VITE_API_URL
  } catch {
    return undefined
  }
}

const runtimeUrl = typeof window !== 'undefined' ? window?._env_?.VITE_API_URL : undefined
const useRuntime = runtimeUrl && !runtimeUrl.startsWith('${')
const finalEnvUrl = useRuntime ? runtimeUrl : envUrl

export const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? (useRuntime ? runtimeUrl : hostUrl)
  : (finalEnvUrl || (isDev ? '' : hostUrl))


