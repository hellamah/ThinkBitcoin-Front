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
    https: '13502' // Porta de HTTPS exposta pelo LoadBalancer/NodePort
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
// Preferência baseada no protocolo atual, mas permite o resto da lógica
const protocol = (location.protocol === 'https:' || location.protocol === 'http:') 
  ? location.protocol 
  : 'http:'

const getHostUrl = (portConfig) => {
  const isHttps = protocol === 'https:'
  const port = isHttps ? portConfig.https : portConfig.http
  
  // Se for HTTPS local, usamos o domínio do Ingress para o SSL funcionar
  // Se for HTTP local, mantemos localhost
  const hostname = (isHttps && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) 
    ? 'thinkbitcoin.local' 
    : location.hostname
  
  return port === '443' || port === '80' 
    ? `${protocol}//${hostname}` 
    : `${protocol}//${hostname}:${port}`
}

const hostUrl = getHostUrl(PORTS.DOTNET_API)
const pythonHostUrl = getHostUrl(PORTS.PYTHON_API)

const envUrl = import.meta.env?.VITE_API_URL
const pythonEnvUrl = import.meta.env?.VITE_PYTHON_API_URL

// Em produção (Vercel + Cloudflare), usamos a envUrl pura (ex: https://api.minerthinkbitcoin.com)
// Em desenvolvimento local, usamos a lógica de portas do Minikube/Localhost
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1'

export const API_URL = isLocal ? hostUrl : (envUrl || hostUrl)
// A API Python tem sua própria env var: cair no VITE_API_URL apontaria para a API .NET.
export const PYTHON_API_URL = isLocal ? pythonHostUrl : (pythonEnvUrl || pythonHostUrl)
