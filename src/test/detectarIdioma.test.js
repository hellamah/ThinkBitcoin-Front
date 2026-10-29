import { describe, it, expect, afterEach } from 'vitest'
import { detectarIdiomaDoNavegador, IDIOMA_PADRAO } from '../src/lang'

// O Node 22 define um `navigator` real, com o idioma do sistema operacional.
// Todo teste daqui troca esse objeto explicitamente: sem isso, o resultado
// dependeria da máquina e a suíte passaria para quem a escreveu e falharia num
// runner configurado em outro idioma.
const navigatorOriginal = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

const comNavegador = (valor) => {
  Object.defineProperty(globalThis, 'navigator', {
    value: valor,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  if (navigatorOriginal) Object.defineProperty(globalThis, 'navigator', navigatorOriginal)
  else delete globalThis.navigator
})

describe('lang › detectarIdiomaDoNavegador', () => {
  it('reconhece o código exato', () => {
    comNavegador({ languages: ['fr'], language: 'fr' })
    expect(detectarIdiomaDoNavegador()).toBe('fr')
  })

  it('descarta a região: pt-BR e pt-PT resolvem para pt', () => {
    comNavegador({ languages: ['pt-BR'], language: 'pt-BR' })
    expect(detectarIdiomaDoNavegador()).toBe('pt')

    comNavegador({ languages: ['pt-PT'], language: 'pt-PT' })
    expect(detectarIdiomaDoNavegador()).toBe('pt')
  })

  it('não é sensível a maiúsculas', () => {
    comNavegador({ languages: ['ES-es'], language: 'ES-es' })
    expect(detectarIdiomaDoNavegador()).toBe('es')
  })

  it('respeita a ordem de preferência, e não só o primeiro item', () => {
    // Navegador em japonês (não suportado) com italiano como segunda escolha:
    // usar apenas navigator.language perderia essa segunda opção.
    comNavegador({ languages: ['ja-JP', 'it-IT', 'en-US'], language: 'ja-JP' })
    expect(detectarIdiomaDoNavegador()).toBe('it')
  })

  it('cai em navigator.language quando languages vem vazio', () => {
    comNavegador({ languages: [], language: 'fr-CA' })
    expect(detectarIdiomaDoNavegador()).toBe('fr')
  })

  it('cai em navigator.language quando languages não existe', () => {
    comNavegador({ language: 'es-MX' })
    expect(detectarIdiomaDoNavegador()).toBe('es')
  })

  it('devolve null quando nenhum idioma preferido é suportado', () => {
    // Quem decide o que fazer com o null é getInitialPreferences, que cai no
    // IDIOMA_PADRAO. A detecção não inventa um palpite.
    comNavegador({ languages: ['ja-JP', 'ko-KR'], language: 'ja-JP' })
    expect(detectarIdiomaDoNavegador()).toBeNull()
  })

  it('devolve null quando não há navigator', () => {
    comNavegador(undefined)
    expect(detectarIdiomaDoNavegador()).toBeNull()
  })

  it('ignora entradas que não são string sem quebrar', () => {
    comNavegador({ languages: [null, 42, {}, 'it'], language: undefined })
    expect(detectarIdiomaDoNavegador()).toBe('it')
  })

  it('devolve null para etiquetas vazias ou lixo', () => {
    comNavegador({ languages: ['', '-', '--'], language: '' })
    expect(detectarIdiomaDoNavegador()).toBeNull()
  })

  it('reconhece o próprio idioma padrão como qualquer outro', () => {
    comNavegador({ languages: [IDIOMA_PADRAO], language: IDIOMA_PADRAO })
    expect(detectarIdiomaDoNavegador()).toBe(IDIOMA_PADRAO)
  })
})
