'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import AdminError from '@/components/admin/AdminError'
import ImageCropper from '@/components/admin/ImageCropper'

type ImageRecord = { id: string; url: string; name: string | null; created_at: string }

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
    border: { borderColor: 'var(--color-admin-border)' },
} as const

export default function ImagesPage() {
    const [images, setImages] = useState<ImageRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [showUploader, setShowUploader] = useState(false)
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

    // 編輯備註名稱
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [savingName, setSavingName] = useState(false)

    // 刪除確認
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    async function load() {
        setLoading(true)
        setError(null)
        try {
            const res = await adminFetch('/api/admin/images')
            const body = await res.json()
            if (!res.ok) throw new Error(body.message ?? '載入失敗')
            setImages(body.data)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    function handleUploaded(_imageId: string, _url: string) {
        setShowUploader(false)
        load()
    }

    async function handleSaveName(id: string) {
        setSavingName(true)
        try {
            await adminFetch(`/api/admin/images/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: editName.trim() || null }),
            })
            setImages(prev => prev.map(img => img.id === id ? { ...img, name: editName.trim() || null } : img))
            setEditingId(null)
        } finally {
            setSavingName(false)
        }
    }

    async function handleDelete(id: string) {
        setDeleteLoading(true)
        try {
            const res = await adminFetch(`/api/admin/images/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setImages(prev => prev.filter(img => img.id !== id))
                setDeletingId(null)
            }
        } finally {
            setDeleteLoading(false)
        }
    }

    if (loading) return <AdminSpinner />
    if (error) return <AdminError error={error} onRetry={load} />

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold" style={css.text}>圖庫管理</h1>
                <button
                    onClick={() => setShowUploader(v => !v)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-admin-primary)' }}
                >
                    {showUploader ? '取消上傳' : '上傳新圖片'}
                </button>
            </div>

            {/* 上傳區 */}
            {showUploader && (
                <div className="rounded-xl border p-5 mb-6" style={css.surface}>
                    <p className="text-sm font-semibold mb-4" style={css.text}>上傳新圖片</p>
                    <ImageCropper
                        productId={`library-${Date.now()}`}
                        onDone={handleUploaded}
                        onCancel={() => setShowUploader(false)}
                        hideLibraryTab
                    />
                </div>
            )}

            {/* 圖片 Grid */}
            {images.length === 0 ? (
                <div className="rounded-xl border p-12 text-center" style={css.surface}>
                    <p className="text-sm" style={css.muted}>圖庫尚無圖片</p>
                    <p className="text-xs mt-1" style={css.muted}>上傳商品圖片時會自動存入圖庫</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {images.map(img => (
                        <div key={img.id} className="rounded-xl border overflow-hidden" style={css.surface}>
                            {/* 圖片 */}
                            <button
                                className="relative w-full block"
                                style={{ aspectRatio: '4/3' }}
                                onClick={() => setLightboxUrl(img.url)}
                            >
                                <Image
                                    src={img.url}
                                    alt={img.name ?? ''}
                                    fill
                                    className="object-cover"
                                    sizes="220px"
                                />
                            </button>

                            {/* 備註名稱 + 操作 */}
                            <div className="p-2 space-y-1.5">
                                {editingId === img.id ? (
                                    <div className="flex gap-1">
                                        <input
                                            autoFocus
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleSaveName(img.id)
                                                if (e.key === 'Escape') setEditingId(null)
                                            }}
                                            placeholder="備註名稱"
                                            className="flex-1 border rounded px-2 py-1 text-xs min-w-0"
                                            style={css.surface}
                                        />
                                        <button
                                            onClick={() => handleSaveName(img.id)}
                                            disabled={savingName}
                                            className="px-2 py-1 rounded text-xs text-white shrink-0 disabled:opacity-50"
                                            style={{ backgroundColor: 'var(--color-admin-primary)' }}
                                        >
                                            {savingName ? '...' : '儲存'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="w-full text-left text-xs truncate rounded px-1 py-0.5 hover:bg-gray-100 transition-colors"
                                        style={img.name ? css.text : css.muted}
                                        onClick={() => { setEditingId(img.id); setEditName(img.name ?? '') }}
                                        title="點擊編輯備註名稱"
                                    >
                                        {img.name || '點擊新增備註'}
                                    </button>
                                )}

                                <button
                                    onClick={() => setDeletingId(img.id)}
                                    className="w-full text-xs py-1 rounded border transition-colors hover:bg-red-50"
                                    style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
                                >
                                    刪除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
                    onClick={() => setLightboxUrl(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white text-xl leading-none w-9 h-9 flex items-center justify-center rounded-full"
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                        onClick={() => setLightboxUrl(null)}
                    >
                        ✕
                    </button>
                    <div className="relative max-w-3xl w-full" style={{ aspectRatio: '4/3' }}>
                        <Image
                            src={lightboxUrl!}
                            alt=""
                            fill
                            className="object-contain"
                            sizes="100vw"
                        />
                    </div>
                </div>
            )}

            {/* 刪除確認 Dialog */}
            {deletingId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={() => setDeletingId(null)}
                >
                    <div
                        className="rounded-2xl border p-6 w-full max-w-sm space-y-4"
                        style={css.surface}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-sm font-semibold" style={css.text}>確認刪除圖片？</h3>
                        <p className="text-xs" style={css.muted}>
                            此操作無法復原。若商品正在使用此圖片，刪除後圖片將無法顯示。
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleDelete(deletingId)}
                                disabled={deleteLoading}
                                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                                style={{ backgroundColor: '#DC2626' }}
                            >
                                {deleteLoading ? '刪除中...' : '確認刪除'}
                            </button>
                            <button
                                onClick={() => setDeletingId(null)}
                                className="flex-1 py-2 rounded-lg text-sm border"
                                style={css.surface}
                            >
                                <span style={css.muted}>取消</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
