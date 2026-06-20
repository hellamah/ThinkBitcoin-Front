import { useAuth } from '../context/AuthContext'
import { useCallback } from 'react'
import en from '../lang/en.json'
import pt from '../lang/pt.json'

const map = { en, pt }

export default function useTranslation() {
  const { prefs } = useAuth()
  const lang = prefs?.idioma || 'pt'
  
  const t = useCallback((key, vars = {}) => {
    const str = key.split('.').reduce((o, k) => (o ? o[k] : undefined), map[lang]) || key
    return Object.keys(vars).reduce((acc, v) => acc.replace(`{{${v}}}`, vars[v]), str)
  }, [lang])
  
  return { t, lang }
}
