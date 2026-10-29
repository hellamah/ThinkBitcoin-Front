import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import {
  IDIOMA_PADRAO,
  carregarDicionario,
  dicionarioPadrao,
  idiomaDe,
} from '../lang'

// A tradução virou contexto porque os dicionários passaram a ser carregados sob
// demanda: como hook puro, cada componente dispararia o próprio import e teria
// o próprio estado de carga. Aqui o dicionário é buscado uma vez e o resultado
// serve a árvore inteira.

const TranslationContext = createContext({
  t: (chave) => chave,
  lang: IDIOMA_PADRAO,
  idioma: idiomaDe(IDIOMA_PADRAO),
})

/** Caminha por "heatmap.fearGreed" até o valor, ou undefined. */
const buscar = (dicionario, chave) =>
  chave.split('.').reduce((nivel, parte) => (nivel ? nivel[parte] : undefined), dicionario)

/**
 * Substitui {{nome}} pelos valores informados.
 * Regex global, e não replace de string: com substituição literal, um texto que
 * repete o mesmo marcador ("{{count}} de {{count}}") só teria a primeira
 * ocorrência trocada, deixando a segunda crua na tela.
 */
const interpolar = (texto, vars) =>
  Object.keys(vars).reduce(
    (acc, nome) => acc.replace(new RegExp(`\\{\\{${nome}\\}\\}`, 'g'), vars[nome]),
    texto
  )

export function TranslationProvider({ children }) {
  const { prefs } = useAuth()
  const lang = idiomaDe(prefs?.idioma).codigo

  // O idioma padrão (inglês, o único com import estático em lang/index.js) já
  // entra carregado: é o fallback enquanto o escolhido não chega.
  const [dicionarios, setDicionarios] = useState(() => ({
    [IDIOMA_PADRAO]: dicionarioPadrao,
  }))

  useEffect(() => {
    if (dicionarios[lang]) return undefined
    let vivo = true
    carregarDicionario(lang)
      .then((dicionario) => {
        if (vivo && dicionario) {
          setDicionarios((atual) => ({ ...atual, [lang]: dicionario }))
        }
      })
      // O dicionário vem por import dinâmico, então é um chunk que pode não
      // chegar: rede oscilando, ou um deploy que trocou os hashes com a aba
      // aberta. A tela sobrevive — `t` cai no dicionário padrão —, mas sem
      // este catch a rejeição sobe crua no console como unhandled, sem dizer
      // que o assunto era idioma.
      .catch((err) => {
        console.error(`Erro ao carregar o dicionário de "${lang}":`, err)
      })
    return () => {
      vivo = false
    }
  }, [lang, dicionarios])

  // O <html lang> estava fixo em pt-BR no index.html. Leitor de tela usa esse
  // atributo para escolher a pronúncia, e o buscador para saber o idioma da
  // página; deixá-lo mentindo é pior do que não tê-lo.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = idiomaDe(lang).htmlLang
  }, [lang])

  const dicionario = dicionarios[lang]

  const t = useCallback(
    (chave, vars = {}) => {
      const bruto = buscar(dicionario, chave) ?? buscar(dicionarioPadrao, chave) ?? chave
      return interpolar(String(bruto), vars)
    },
    [dicionario]
  )

  const valor = useMemo(
    () => ({ t, lang, idioma: idiomaDe(lang) }),
    [t, lang]
  )

  return <TranslationContext.Provider value={valor}>{children}</TranslationContext.Provider>
}

export const useTranslationContext = () => useContext(TranslationContext)
