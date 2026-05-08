'use client'

import { useState, useCallback, useRef } from 'react'
import Cropper from 'react-easy-crop'
import { adminFetch } from '@/lib/auth/adminClient'

type Area = { x: number; y: number; width: number; height: number }

async function getCroppedWebp(imageSrc: string, cropPx: Area): Promise<Blob> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = imageSrc
    })
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, cropPx.x, cropPx.y, cropPx.width, cropPx.height, 0, 0, 800, 600)
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('canvas toBlob failed')), 'image/webp', 0.88)
    })
}

type Props = {
    productId: string
    onDone: (publicUrl: string) => void
    onCancel: () => void
}

export default function ImageCropper({ productId, onDone, onCancel }: Props) {
    const fileRef = useRef<HTMLInputElement>(null)
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedArea, setCroppedArea] = useState<Area | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => setImageSrc(reader.result as string)
        reader.readAsDataURL(file)
    }

    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedArea(croppedAreaPixels)
    }, [])

    async function handleUpload() {
        if (!imageSrc || !croppedArea) return
        setUploading(true)
        setError(null)
        try {
            const blob = await getCroppedWebp(imageSrc, croppedArea)

            const urlRes = await adminFetch('/api/admin/upload-url', {
                method: 'POST',
                body: JSON.stringify({ filename: `${productId}.webp` }),
            })
            const { data } = await urlRes.json()

            await fetch(data.uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/webp' },
            })

            onDone(data.publicUrl)
        } catch (e: any) {
            setError(e.message ?? '上傳失敗')
        } finally {
            setUploading(false)
        }
    }

    const css = {
        surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
        muted: { color: 'var(--color-admin-muted)' },
    }

    return (
        <div className="space-y-3">
            {!imageSrc ? (
                <div
                    className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer"
                    style={{ borderColor: 'var(--color-admin-border)' }}
                    onClick={() => fileRef.current?.click()}
                >
                    <p className="text-sm" style={css.muted}>點擊選擇圖片</p>
                    <p className="text-xs mt-1" style={css.muted}>支援 JPG、PNG、WebP</p>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </div>
            ) : (
                <>
                    <div className="relative rounded-xl overflow-hidden" style={{ height: 300 }}>
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={4 / 3}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs shrink-0" style={css.muted}>縮放</span>
                        <input
                            type="range" min={1} max={3} step={0.01}
                            value={zoom}
                            onChange={e => setZoom(Number(e.target.value))}
                            className="flex-1 accent-blue-600"
                        />
                    </div>
                </>
            )}

            {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}

            <div className="flex gap-2">
                <button
                    onClick={handleUpload}
                    disabled={!imageSrc || uploading}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: 'var(--color-admin-primary)' }}
                >
                    {uploading ? '上傳中...' : '確認上傳'}
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg text-sm border"
                    style={css.surface}
                >
                    <span style={css.muted}>取消</span>
                </button>
            </div>
        </div>
    )
}
