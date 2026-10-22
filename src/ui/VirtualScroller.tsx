import { useVirtualizer } from '@tanstack/react-virtual'
import { Fragment, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react'

export interface VirtualItem {
  index: number
  style: CSSProperties
}

export interface VirtualScrollerHandle {
  // Scrolls just enough to show the item below the sticky header
  scrollToIndex: (index: number) => void
}

interface VirtualScrollerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  count: number
  // Item height in Tailwind spacing steps: 8 means the same height as `h-8`
  itemSize: number
  overscan?: number
  // Rendered above the items and kept in view while scrolling
  header?: ReactNode
  renderItem: (item: VirtualItem) => ReactNode
  handleRef?: Ref<VirtualScrollerHandle>
}

const spacing = (steps: number) => `calc(var(--spacing) * ${steps})`

// Measures an element's height and keeps it up to date
function useHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setHeight(element.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, height] as const
}

// Generic vertical virtualization. Knows nothing about what it renders.
export function VirtualScroller({
  count,
  itemSize,
  overscan = 10,
  header,
  renderItem,
  handleRef,
  className,
  ...rest
}: VirtualScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // TanStack needs pixels. Measure the Tailwind size so it follows root font size and zoom.
  const [probeRef, itemPx] = useHeight()
  const [headerRef, headerPx] = useHeight()

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemPx,
    overscan,
    // Items start below the header, and the sticky header covers the top of the viewport
    scrollMargin: headerPx,
    scrollPaddingStart: headerPx,
  })

  useLayoutEffect(() => {
    virtualizer.measure()
  }, [virtualizer, itemPx, headerPx])

  useImperativeHandle(
    handleRef,
    () => ({ scrollToIndex: (index) => virtualizer.scrollToIndex(index, { align: 'auto' }) }),
    [virtualizer],
  )

  const items = itemPx > 0 ? virtualizer.getVirtualItems() : []
  const itemStyle: CSSProperties = { height: spacing(itemSize) }
  const offset = (items[0]?.start ?? headerPx) - headerPx

  return (
    <div ref={scrollRef} className={`relative overflow-auto ${className ?? ''}`} {...rest}>
      <div
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute"
        style={itemStyle}
      />
      <div ref={headerRef} className="sticky top-0 z-10">
        {header}
      </div>
      <div style={{ height: virtualizer.getTotalSize() }}>
        <div style={{ transform: `translateY(${offset}px)` }}>
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
