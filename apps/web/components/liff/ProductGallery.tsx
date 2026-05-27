'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Product = {
    id: string
    name: string
    images: { url: string }[]
}

type Slide = { productName: string; url: string }

type Props = {
    products: Product[]
}

export default function ProductGallery({ products }: Props) {
    const slides: Slide[] = products.flatMap(p =>
        p.images.map(img => ({ productName: p.name, url: img.url }))
    )

    const [current, setCurrent] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const startX = useRef<number | null>(null)
    const startY = useRef<number | null>(null)
    const lockAxis = useRef<'h' | 'v' | null>(null)

    // Register non-passive touchmove so preventDefault() works
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        function onTouchMove(e: TouchEvent) {
            if (lockAxis.current === 'h') e.preventDefault()
        }
        el.addEventListener('touchmove', onTouchMove, { passive: false })
        return () => el.removeEventListener('touchmove', onTouchMove)
    }, [])

    if (slides.length === 0) return null

    function onTouchStart(e: React.TouchEvent) {
        startX.current = e.touches[0].clientX
        startY.current = e.touches[0].clientY
        lockAxis.current = null
    }

    function onTouchMove(e: React.TouchEvent) {
        if (lockAxis.current !== null || startX.current === null || startY.current === null) return
        const dx = Math.abs(e.touches[0].clientX - startX.current)
        const dy = Math.abs(e.touches[0].clientY - startY.current)
        if (dx > 5 || dy > 5) lockAxis.current = dx >= dy ? 'h' : 'v'
    }

    function onTouchEnd(e: React.TouchEvent) {
        if (startX.current === null || lockAxis.current !== 'h') {
            startX.current = null
            startY.current = null
            lockAxis.current = null
            return
        }
        const diff = startX.current - e.changedTouches[0].clientX
        if (Math.abs(diff) >= 40) {
            if (diff > 0) setCurrent(c => Math.min(c + 1, slides.length - 1))
            else setCurrent(c => Math.max(c - 1, 0))
        }
        startX.current = null
        startY.current = null
        lockAxis.current = null
    }

    const slide = slides[current]

    return (
        <div className="mb-4">
            {/* 圖片區塊 */}
            <div
                ref={containerRef}
                className="relative w-full select-none rounded-2xl overflow-hidden"
                style={{ aspectRatio: '4/3' }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <Image
                    src={slide.url}
                    alt={slide.productName}
                    fill
                    className="object-cover"
                    priority
                />

                {slides.length > 1 && (
                    <>
                        <button
                            onClick={() => setCurrent(c => Math.max(c - 1, 0))}
                            disabled={current === 0}
                            className="absolute left-2 top-1/2 -translate-y-1/2 disabled:opacity-0"
                        >
                            <ChevronLeft className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.65)' }} />
                        </button>
                        <button
                            onClick={() => setCurrent(c => Math.min(c + 1, slides.length - 1))}
                            disabled={current === slides.length - 1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 disabled:opacity-0"
                        >
                            <ChevronRight className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.65)' }} />
                        </button>
                    </>
                )}
            </div>

            {/* 商品名稱 + 分頁點 */}
            <div className="flex items-center justify-between gap-2 mt-2 px-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-liff-text)' }}>
                    {slide.productName}
                </p>
                {slides.length > 1 && (
                    <div className="flex gap-1 shrink-0">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrent(i)}
                                className="rounded-full transition-all"
                                style={{
                                    width: i === current ? 16 : 6,
                                    height: 6,
                                    backgroundColor: i === current
                                        ? 'var(--color-liff-primary)'
                                        : 'var(--color-liff-border)',
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
