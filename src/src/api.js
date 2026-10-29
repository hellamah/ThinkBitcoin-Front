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
}

// Havia aqui mais quatro entradas — PYTHON_API, PYTHON_AGGREGATOR, OLLAMA e
// FRONTEND — e uma `PYTHON_API_URL` exportada a partir da primeira. Nenhuma
// tinha consumidor: o front fala com uma API só, a .NET.
//
// A `VITE_PYTHON_API_URL` chegava a ser lida, e o valor não ia a lugar nenhum.
// Isso é pior do que não existir: quem a configurasse esperando efeito não
// teria nenhum, e em silêncio. O DEPLOYMENT.md ainda a citava como variável a
// manter em dia com a CSP.
//
// Se um dia o front precisar falar com a API Python, o caminho é o mesmo do
// `hostUrl` abaixo: uma entrada em PORTS, uma env var e a mesma regra de
// local/produção.

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

const envUrl = import.meta.env?.VITE_API_URL

// Em produção (Vercel + Cloudflare), usamos a envUrl pura (ex: https://api.minerthinkbitcoin.com)
// Em desenvolvimento local, usamos a lógica de portas do Minikube/Localhost
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1'

export const API_URL = isLocal ? hostUrl : (envUrl || hostUrl)
