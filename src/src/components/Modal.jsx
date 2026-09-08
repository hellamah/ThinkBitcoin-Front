import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MdClose } from 'react-icons/md'
import useTranslation from '../hooks/useTranslation'
import '../App.css'

export default function Modal({ visible, onClose, children, className = '' }) {
  const { t } = useTranslation()

  // Esc fecha. O listener fica no `document` e na fase de bolha de propósito:
  // popups do MUI abertos DENTRO do modal (o menu do seletor de moeda, por
  // exemplo) montam o próprio nó direto no body e chamam `stopPropagation()`
  // no Escape antes que ele suba até aqui. Com isso o Esc fecha primeiro o
  // menu e só depois o modal, que é a ordem que o usuário espera. Em captura,
  // ou preso ao nó do modal, os dois fechariam de uma vez.
  useEffect(() => {
    if (!visible || !onClose) return undefined
    const aoTeclar = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [visible, onClose])

  if (!visible) return null

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      {/* role/aria-modal para o leitor de tela anunciar como diálogo e ignorar
          o conteúdo atrás — sem eles, o portal é só mais uma <div> no fim do
          body e a leitura continua na página coberta. */}
      <div
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* O nome acessível é a única coisa que o leitor de tela tem aqui — o
            botão é só um ícone. Estava "close", em inglês, nos cinco idiomas. */}
        <button className="btn-close-premium small" onClick={onClose} aria-label={t('close')}>
          <MdClose size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}
