import { useTranslationContext } from '../context/TranslationContext'

// A implementação mudou de casa (TranslationContext) quando os dicionários
// passaram a ser carregados sob demanda. O hook continua aqui, com a mesma
// assinatura, para que os componentes não precisassem ser tocados um a um.
export default function useTranslation() {
  return useTranslationContext()
}
