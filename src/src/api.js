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

const envUrl = resolveEnvUrl()
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV

export const API_URL = envUrl || (isDev ? '' : hostUrl)
