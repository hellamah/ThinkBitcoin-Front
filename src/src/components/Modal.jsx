import { createPortal } from 'react-dom'
import { MdClose } from 'react-icons/md'
import '../App.css'

export default function Modal({ visible, onClose, children, className = '' }) {
  if (!visible) return null
  
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className}`} onClick={(e) => e.stopPropagation()}>
        <button className="btn-close-premium small" onClick={onClose} aria-label="close">
          <MdClose size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}

