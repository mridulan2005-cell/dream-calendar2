// Left-edge drag handle for a resizable right-hand panel. Sits on the panel's
// left border; a thin accent bar appears on hover/drag.
export default function ResizeHandle({ onMouseDown }) {
  return (
    <div
      onMouseDown={onMouseDown}
      title="Drag to resize"
      className="group absolute left-0 top-0 z-20 flex h-full w-2 -translate-x-1/2 cursor-col-resize items-center justify-center"
    >
      <div className="h-full w-0.5 bg-transparent transition group-hover:bg-accent/50" />
    </div>
  )
}
