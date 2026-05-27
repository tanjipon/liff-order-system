'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import ImageCropper from './ImageCropper'
import { adminFetch } from '@/lib/auth/adminClient'

export type ImageLink = { linkId: string; imageId: string; url: string }

type Props = {
    productId: string
    images: ImageLink[]
    onLightbox: (url: string) => void
    onChange: () => void
}

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    muted: { color: 'var(--color-admin-muted)' },
} as const

export default function ProductImageStrip({ productId, images, onLightbox, onChange }: Props) {
    const [open, setOpen] = useState(false)
    const [removing, setRemoving] = useState<string | null>(null)

    async function handleAdd(imageId: string) {
        await adminFetch(`/api/admin/products/${productId}/images`, {
            method: 'POST',
            body: JSON.stringify({ imageId }),
        })
        setOpen(false)
        onChange()
    }

    async function handleRemove(linkId: string) {
        setRemoving(linkId)
        try {
            await adminFetch(`/api/admin/products/${productId}/images/${linkId}`, { method: 'DELETE' })
            onChange()
        } finally {
            setRemoving(null)
        }
    }

    return (
        <div className="space-y-2">
            {/* 縮圖列 */}
            <div className="flex flex-wrap gap-2 items-center">
                {images.map(img => (
                    <div key={img.linkId} className="relative group shrink-0">
                        <button
                            type="button"
                            onClick={() => onLightbox(img.url)}
                            className="block rounded-lg overflow-hidden"
                        >
                            <Image
                                src={img.url}
                                alt=""
                                width={56}
                                height={42}
                                className="object-cover rounded-lg hover:opacity-80 transition-opacity"
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRemove(img.linkId)}
                            disabled={removing === img.linkId}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: '#DC2626' }}
                        >
                            <X className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                        </button>
                    </div>
                ))}

                {!open && (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="w-14 h-[42px] rounded-lg border-2 border-dashed flex items-center justify-center text-lg font-light transition-colors hover:border-blue-400"
                        style={{ borderColor: 'var(--color-admin-border)', color: 'var(--color-admin-muted)' }}
                    >
                        +
                    </button>
                )}
            </div>

            {/* ImageCropper 已內建「上傳新圖片 / 從圖庫選擇」Tab */}
            {open && (
                <div className="rounded-xl border p-4" style={css.surface}>
                    <ImageCropper
                        productId={productId}
                        onDone={(imageId) => handleAdd(imageId)}
                        onCancel={() => setOpen(false)}
                    />
                </div>
            )}
        </div>
    )
}
