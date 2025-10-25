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
const defaultPort = location.protocol === 'https:' ? '13501' : '13500'
const hostUrl = `${location.protocol}//${location.hostname}:${defaultPort}`

const resolveEnvUrl = () => {
  try {
    return import.meta.env?.VITE_API_URL
  } catch {
    return undefined
  }
}

const envUrl = resolveEnvUrl()

export const API_URL = envUrl || hostUrl
