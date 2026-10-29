import { createPortal } from 'react-dom'
import { MdClose } from 'react-icons/md'
import useTranslation from '../hooks/useTranslation'
import { useDialogoAcessivel, useFecharComEsc } from '../hooks/useDialogoAcessivel'
import '../App.css'

export default function Modal({ visible, onClose, children, className = '', rotulo }) {
  const { t } = useTranslation()

  useFecharComEsc(visible, onClose)

  // Prende o Tab dentro do diálogo, foca-o ao abrir e devolve o foco ao
  // elemento que o abriu. Ver o hook para o que estava acontecendo sem isto.
  const refDialogo = useDialogoAcessivel(visible)

  if (!visible) return null

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      {/* role/aria-modal para o leitor de tela anunciar como diálogo e ignorar
          o conteúdo atrás — sem eles, o portal é só mais uma <div> no fim do
          body e a leitura continua na página coberta.

          `aria-label` vem de quem chama porque o título vive no `children`, e
          um diálogo sem nome é anunciado só como "diálogo": quem não enxerga a
          tela não tem como saber o que abriu. O fallback genérico existe para
          não deixar nenhum caminho sem nome, mas o certo é sempre passar o
          `rotulo`.

          `tabIndex={-1}` é o que permite focar o contêiner ao abrir — focável
          por código, fora do ciclo do Tab. */}
      <div
        ref={refDialogo}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={rotulo || t('dialogo.generico')}
        tabIndex={-1}
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
