import '../App.css'

export default function Modal({ visible, onClose, children }) {
  if (!visible) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="close">
          &times;
        </button>
        {children}
      </div>
    </div>
  )
}
