const getLocation = () => {
  if (typeof window === 'undefined' || !window.location) {
    return {
      protocol: 'http:',
      hostname: 'localhost',
    }
  }
  return window.location
}

const PORTS = {
  DOTNET_API: {
    http: '13501',
    https: '13502'
  },
  PYTHON_API: {
    http: '13600',
    https: '13603'
  },
  PYTHON_AGGREGATOR: {
    http: '13602',
    https: '13604'
  },
  OLLAMA: {
    http: '11434',
    https: '11435'
  },
  FRONTEND: '3000'
}

const location = getLocation()
// Preferência sempre por HTTPS
const protocol = 'https:' 

const getHostUrl = (portConfig) => {
  const port = protocol === 'https:' ? portConfig.https : portConfig.http
  return `${protocol}//${location.hostname}:${port}`
}

const hostUrl = getHostUrl(PORTS.DOTNET_API)

const resolveEnvUrl = () => {
  try {
    return import.meta.env?.VITE_API_URL
  } catch {
    return undefined
  }
}
const envUrl = resolveEnvUrl()
const isDev = import.meta.env?.DEV

const runtimeUrl = typeof window !== 'undefined' ? window?._env_?.VITE_API_URL : undefined
const useRuntime = runtimeUrl && !runtimeUrl.startsWith('${')
const finalEnvUrl = useRuntime ? runtimeUrl : envUrl

export const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? (useRuntime ? runtimeUrl : hostUrl)
  : (finalEnvUrl || (isDev ? '' : hostUrl))

export const PYTHON_API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? getHostUrl(PORTS.PYTHON_API)
  : (useRuntime ? runtimeUrl : hostUrl) // Fallback


