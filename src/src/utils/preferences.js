import { LANGUAGE_CODES, IDIOMA_PADRAO, detectarIdiomaDoNavegador } from '../lang'

const getWindow = () =>
  typeof window !== 'undefined' ? window : undefined

const hasLocalStorage = () => {
  const win = getWindow()
  if (!win) return false
  try {
    return typeof win.localStorage !== 'undefined'
  } catch {
    return false
  }
}

export const Theme = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
})

// Derivado do registro em lang/index.js, e não escrito à mão: enquanto esta
// lista era própria, acrescentar um idioma exigia lembrar de editá-la — e
// esquecer não quebrava nada, só fazia o idioma novo ser rejeitado em silêncio
// pelo normalizeLanguage e cair no padrão.
export const Language = Object.freeze(
  Object.fromEntries(LANGUAGE_CODES.map((codigo) => [codigo.toUpperCase(), codigo]))
)

// Estilo do algoritmo e perfil de risco saíram da interface: eram a mesma
// pergunta feita duas vezes — mesma escala, e "Conservador"/"Agressivo" escritos
// com a mesma palavra nos dois seletores — e nada no sistema lia a resposta.
//
// As colunas continuam no banco, então o valor precisa seguir sendo enviado: a
// alteração grava `preferencia.EstiloAlgoritmo = parametro.EstiloAlgoritmo`
// direto, sem guarda, e o default do banco só vale no INSERT. Parar de mandar
// gravaria null por cima. Daí estes valores permanecerem aqui, agora como
// constantes e não mais como opções.
export const AlgorithmStyle = Object.freeze({
  CONSERVATIVE: 'conservador',
  BALANCED: 'equilibrado',
  AGGRESSIVE: 'agressivo',
})

export const RiskProfile = Object.freeze({
  CONSERVATIVE: 'conservador',
  MODERATE: 'moderado',
  AGGRESSIVE: 'agressivo',
})

export const ReviewFrequency = Object.freeze({
  DAILY: 'diaria',
  WEEKLY: 'semanal',
  MONTHLY: 'mensal',
})

export const DEFAULT_PREFERENCES = Object.freeze({
  tema: Theme.DARK,
  idioma: IDIOMA_PADRAO,
  notificacoes: false,
  estiloAlgoritmo: AlgorithmStyle.BALANCED,
  investimentoInicial: 0,
  riscoMaximoPerda: 2,
  siglaMoedaPreferida: null,
  siglaEmpresaExterna: null,
  saldoSeguranca: 0,
  siglaMoedaSaldoSeguranca: null,
  siglaMoedaUltimaInteracaoIA: null,
  dataUltimaInteracaoIA: null,
  frequenciaReview: ReviewFrequency.DAILY,
  perfilRisco: RiskProfile.MODERATE,
})

const getStorage = () => {
  if (!hasLocalStorage()) return null
  try {
    return getWindow().localStorage
  } catch {
    return null
  }
}

const normalizeTheme = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (normalized === Theme.LIGHT) return Theme.LIGHT
  if (normalized === Theme.DARK) return Theme.DARK
  return null
}

const normalizeLanguage = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  return LANGUAGE_CODES.includes(normalized) ? normalized : null
}

const normalizeAlgorithmStyle = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (Object.values(AlgorithmStyle).includes(normalized)) return normalized
  return null
}

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (['true', '1', 'yes', 'sim'].includes(normalized)) return true
    if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) return false
  }
  return null
}

export const sanitizePreferences = (prefs = {}) => {
  const merged = {
    ...DEFAULT_PREFERENCES,
    ...prefs,
  }

  const tema = normalizeTheme(merged.tema)
  const idioma = normalizeLanguage(merged.idioma)
  const estilo = normalizeAlgorithmStyle(merged.estiloAlgoritmo)
  const notificacoes = normalizeBoolean(merged.notificacoes)

  return {
    idPreferenciasUsuarioTB: merged.idPreferenciasUsuarioTB ?? merged.IdPreferenciasUsuarioTB ?? null,
    nome: merged.nome ?? merged.Nome ?? null,
    email: merged.email ?? merged.Email ?? null,
    tema: tema ?? DEFAULT_PREFERENCES.tema,
    idioma: idioma ?? DEFAULT_PREFERENCES.idioma,
    estiloAlgoritmo: estilo ?? DEFAULT_PREFERENCES.estiloAlgoritmo,
    notificacoes: notificacoes ?? DEFAULT_PREFERENCES.notificacoes,
    investimentoInicial: merged.investimentoInicial ?? DEFAULT_PREFERENCES.investimentoInicial,
    riscoMaximoPerda: merged.riscoMaximoPerda ?? DEFAULT_PREFERENCES.riscoMaximoPerda,
    // Só sigla entra aqui. O fallback para o Guid (idMoedaPreferida) parecia uma
    // rede de segurança, mas era o contrário: a API devolvia só o Guid, ele virava
    // "sigla" e voltava assim no PUT seguinte — e a alteração, não achando moeda
    // com aquele código, gravava null por cima. Trocar o tema apagava a moeda
    // preferida. A API agora devolve a sigla junto do Guid; quem não tiver vínculo
    // vem com null, que é a resposta certa.
    siglaMoedaPreferida: merged.siglaMoedaPreferida ?? merged.SiglaMoedaPreferida ?? DEFAULT_PREFERENCES.siglaMoedaPreferida,
    siglaEmpresaExterna: merged.siglaEmpresaExterna ?? merged.SiglaEmpresaExterna ?? DEFAULT_PREFERENCES.siglaEmpresaExterna,
    saldoSeguranca: merged.saldoSeguranca ?? DEFAULT_PREFERENCES.saldoSeguranca,
    siglaMoedaSaldoSeguranca: merged.siglaMoedaSaldoSeguranca ?? merged.SiglaMoedaSaldoSeguranca ?? DEFAULT_PREFERENCES.siglaMoedaSaldoSeguranca,
    siglaMoedaUltimaInteracaoIA: merged.siglaMoedaUltimaInteracaoIA ?? merged.SiglaMoedaUltimaInteracaoIA ?? DEFAULT_PREFERENCES.siglaMoedaUltimaInteracaoIA,
    dataUltimaInteracaoIA: merged.dataUltimaInteracaoIA ?? merged.DataUltimaInteracaoIA ?? DEFAULT_PREFERENCES.dataUltimaInteracaoIA,
    frequenciaReview: merged.frequenciaReview ?? DEFAULT_PREFERENCES.frequenciaReview,
    perfilRisco: merged.perfilRisco ?? DEFAULT_PREFERENCES.perfilRisco,
  }
}

export const getStoredTheme = () =>
  normalizeTheme(getStorage()?.getItem('theme')) ?? DEFAULT_PREFERENCES.tema

export const setStoredTheme = (theme) => {
  const storage = getStorage()
  if (!storage) return
  storage.setItem('theme', normalizeTheme(theme) ?? DEFAULT_PREFERENCES.tema)
}

export const getStoredToken = () => getStorage()?.getItem('token') ?? null

export const setStoredToken = (token) => {
  const storage = getStorage()
  if (!storage) return
  storage.setItem('token', token)
}

export const clearStoredToken = () => {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem('token')
}

// O idioma do navegador entra aqui, e não no sanitizePreferences: aquele é uma
// função de saneamento de dados, que deve devolver a mesma coisa para a mesma
// entrada. Esta é o começo de sessão — já lê o tema do storage, e ler também a
// preferência declarada no sistema é o mesmo tipo de decisão.
//
// A ordem é: escolha explícita do usuário (que chega depois, do backend ou do
// storage) > idioma do navegador > IDIOMA_PADRAO. Quem já escolheu não é
// mexido; quem nunca escolheu recebe o idioma em que já navega.
export const getInitialPreferences = () =>
  sanitizePreferences({
    tema: getStoredTheme(),
    idioma: detectarIdiomaDoNavegador(),
  })

// ---------------------------------------------------------------------------
// Tours de onboarding (react-joyride)
// ---------------------------------------------------------------------------
const chaveTour = (nome) => `tb_tour_${nome}_visto`

/**
 * Retorna true se o usuário já concluiu (ou pulou) o tour de onboarding da tela.
 * @param {string} nome identificador da tela (ex.: 'heatmap', 'dashboard')
 */
export const getTourVisto = (nome) => {
  const storage = getStorage()
  if (!storage) return false
  return storage.getItem(chaveTour(nome)) === '1'
}

/**
 * Marca o tour de onboarding da tela como visto para não exibi-lo novamente.
 * @param {string} nome identificador da tela (ex.: 'heatmap', 'dashboard')
 */
export const setTourVisto = (nome) => {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(chaveTour(nome), '1')
}

// Wrappers de compatibilidade para o tour do Heatmap.
export const getTourHeatmapVisto = () => getTourVisto('heatmap')
export const setTourHeatmapVisto = () => setTourVisto('heatmap')
