// Centered dimmed overlay used by true dialogs (e.g. Share access).
export function Overlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex w-full justify-center">
        {children}
      </div>
    </div>
  )
}
