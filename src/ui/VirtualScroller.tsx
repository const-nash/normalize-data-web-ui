import { useVirtualizer } from '@tanstack/react-virtual'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

export interface VirtualItem {
  index: number
  style: CSSProperties
}

interface VirtualScrollerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  count: number
  // Item height in Tailwind spacing steps: 8 means the same height as `h-8`
  itemSize: number
  overscan?: number
  // Rendered above the items and kept in view while scrolling
  header?: ReactNode
  renderItem: (item: VirtualItem) => ReactNode
}

const spacing = (steps: number) => `calc(var(--spacing) * ${steps})`

// Generic vertical virtualization. Knows nothing about what it renders.
export function VirtualScroller({
  count,
  itemSize,
  overscan = 10,
  header,
  renderItem,
  className,
  ...rest
}: VirtualScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const [itemPx, setItemPx] = useState(0)

  // TanStack needs pixels. Measure the Tailwind size so it follows root font size and zoom.
  useLayoutEffect(() => {
    const probe = probeRef.current
    if (!probe) return
    const update = () => setItemPx(probe.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(probe)
    return () => observer.disconnect()
  }, [itemSize])

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemPx,
    overscan,
  })

  useLayoutEffect(() => {
    virtualizer.measure()
  }, [virtualizer, itemPx])

  const items = itemPx > 0 ? virtualizer.getVirtualItems() : []
  const itemStyle: CSSProperties = { height: spacing(itemSize) }

  return (
    <div ref={scrollRef} className={`relative overflow-auto ${className ?? ''}`} {...rest}>
      <div
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute"
        style={itemStyle}
      />
      {header}
      <div style={{ height: virtualizer.getTotalSize() }}>
        <div style={{ transform: `translateY(${items[0]?.start ?? 0}px)` }}>
          {items.map((item) => (
            <Fragment key={item.key}>
              {renderItem({ index: item.index, style: itemStyle })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
