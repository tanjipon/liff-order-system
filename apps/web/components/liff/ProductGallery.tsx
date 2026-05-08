'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Product = {
    id: string
    name: string
    image_url: string | null
}

type Props = {
    products: Product[]
}

export default function ProductGallery({ products }: Props) {
    const withImage = products.filter(p => p.image_url)
    const [current, setCurrent] = useState(0)
    const startX = useRef<number | null>(null)

    if (withImage.length === 0) return null

    function onTouchStart(e: React.TouchEvent) {
        startX.current = e.touches[0].clientX
    }

    function onTouchEnd(e: React.TouchEvent) {
        if (startX.current === null) return
        const diff = startX.current - e.changedTouches[0].clientX
        if (Math.abs(diff) < 40) return
        if (diff > 0) setCurrent(c => Math.min(c + 1, withImage.length - 1))
        else setCurrent(c => Math.max(c - 1, 0))
        startX.current = null
    }

    const p = withImage[current]

    return (
        <div className="mb-4">
            {/* 圖片區塊，無白邊 */}
            <div
                className="relative w-full select-none rounded-2xl overflow-hidden"
                style={{ aspectRatio: '4/3' }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <Image
                    src={p.image_url!}
                    alt={p.name}
                    fill
                    className="object-cover"
                    priority
                />

                {/* 左右箭頭（桌機） */}
                {withImage.length > 1 && (
                    <>
                        <button
                            onClick={() => setCurrent(c => Math.max(c - 1, 0))}
                            disabled={current === 0}
                            className="absolute left-2 top-1/2 -translate-y-1/2 disabled:opacity-0"
                        ><ChevronLeft className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.65)' }} /></button>
                        <button
                            onClick={() => setCurrent(c => Math.min(c + 1, withImage.length - 1))}
                            disabled={current === withImage.length - 1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 disabled:opacity-0"
                        ><ChevronRight className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.65)' }} /></button>
                    </>
                )}
            </div>

            {/* 商品名稱 + 分頁點（圖片外側下方） */}
            <div className="flex items-center justify-between gap-2 mt-2 px-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-liff-text)' }}>
                    {p.name}
                </p>
                {withImage.length > 1 && (
                    <div className="flex gap-1 shrink-0">
                        {withImage.map((_, i) => (
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
