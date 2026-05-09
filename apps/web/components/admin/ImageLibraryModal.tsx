'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { adminFetch } from '@/lib/auth/adminClient'

type ImageRecord = { id: string; url: string; name: string | null; created_at: string }

type Props = {
    onSelect: (imageId: string, url: string) => void
    onClose: () => void
}

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
} as const

export default function ImageLibraryModal({ onSelect, onClose }: Props) {
    const [images, setImages] = useState<ImageRecord[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        adminFetch('/api/admin/images')
            .then(r => r.json())
            .then(body => { if (body.data) setImages(body.data) })
            .finally(() => setLoading(false))
    }, [])

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl rounded-2xl border overflow-hidden flex flex-col"
                style={{ ...css.surface, maxHeight: '80vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
                    style={{ borderColor: 'var(--color-admin-border)' }}>
                    <h2 className="text-sm font-semibold" style={css.text}>從圖庫選擇</h2>
                    <button
                        onClick={onClose}
                        className="text-lg leading-none px-2"
                        style={css.muted}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <span className="text-sm" style={css.muted}>載入中...</span>
                        </div>
                    ) : images.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-2">
                            <span className="text-sm" style={css.muted}>圖庫尚無圖片</span>
                            <span className="text-xs" style={css.muted}>請先上傳新圖片，系統會自動存入圖庫</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {images.map(img => (
                                <button
                                    key={img.id}
                                    onClick={() => onSelect(img.id, img.url)}
                                    className="group relative rounded-xl overflow-hidden border-2 text-left transition-all hover:border-blue-500 focus:outline-none"
                                    style={{ borderColor: 'var(--color-admin-border)', aspectRatio: '4/3' }}
                                >
                                    <Image
                                        src={img.url}
                                        alt={img.name ?? ''}
                                        fill
                                        className="object-cover"
                                        sizes="200px"
                                    />
                                    {img.name && (
                                        <div className="absolute inset-x-0 bottom-0 px-2 py-1"
                                            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                                            <p className="text-white text-xs truncate">{img.name}</p>
                                        </div>
                                    )}
                                    {/* hover overlay */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                        style={{ backgroundColor: 'rgba(26,115,232,0.15)' }}>
                                        <span className="text-xs font-semibold text-white bg-blue-600 px-2 py-1 rounded-lg">選擇</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
