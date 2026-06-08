import { useCallback, useState } from 'react'

// Drag-to-resize width for a right-hand side panel via a handle on its LEFT edge.
// Dragging the handle left widens the panel; width is clamped between `min` and a
// max that always leaves `minMain` px for the main page.
export function useResizableWidth(initial = 480, { min = 340, minMain = 420 } = {}) {
  const [width, setWidth] = useState(initial)

  const onResizeStart = useCallback(
    (e) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = width
      // The flex row that holds the main content + this panel (handle → aside → row).
      const row = e.currentTarget?.parentElement?.parentElement
      const onMove = (ev) => {
        const avail = row ? row.clientWidth : window.innerWidth
        const max = Math.max(min, avail - minMain)
        setWidth(Math.min(max, Math.max(min, startW + (startX - ev.clientX))))
      }
      const onUp = () => {
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [width, min, minMain],
  )

  return { width, onResizeStart }
}
