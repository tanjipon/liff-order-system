'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import DateTimePicker from '@/components/admin/DateTimePicker'
import AdminError from '@/components/admin/AdminError'
import ProductImageStrip, { ImageLink } from '@/components/admin/ProductImageStrip'
import { useMinLoading } from '@/hooks/useMinLoading'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import Image from 'next/image'

type ProductImageLink = { id: string; position: number; product_images: { id: string; url: string } }

type Product = {
    id: string
    name: string
    price: number
    stock_qty: number
    max_per_person: number | null
    image_url: string | null
    product_image_links: ProductImageLink[]
}

function getImages(p: Product): ImageLink[] {
    return [...(p.product_image_links ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(l => ({ linkId: l.id, imageId: l.product_images.id, url: l.product_images.url }))
}

type RestockItem = {
    product_id: string
    quantity: number
    products: { name: string }
}

type Restock = {
    id: string
    opens_at: string
    is_active: boolean
    applied: boolean
    restock_items: RestockItem[]
}

type Session = {
    id: string
    title: string
    opens_at: string | null
    closes_at: string | null
    per_person_limit: number | null
    is_active: boolean
    products: Product[]
}

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
    border: { borderColor: 'var(--color-admin-border)' },
} as const

const btn = {
    solid: 'cursor-pointer transition hover:brightness-90 active:brightness-75 disabled:hover:brightness-100 disabled:active:brightness-100',
    surface: 'cursor-pointer transition hover:brightness-95 active:brightness-90 disabled:hover:brightness-100 disabled:active:brightness-100',
} as const

export default function SessionDetailPage() {
    const { id } = useParams<{ id: string }>()

    const [session, setSession] = useState<Session | null>(null)
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [name, setName] = useState('')
    const [price, setPrice] = useState('')
    const [stockQty, setStockQty] = useState('')
    const [maxPerPerson, setMaxPerPerson] = useState('')
    const [adding, setAdding] = useState(false)
    const [addError, setAddError] = useState<string | null>(null)

    const [editState, setEditState] = useState<{
        productId: string
        name: string
        price: string
        stockQty: string
        maxPerPerson: string
    } | null>(null)

    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

    const [restocks, setRestocks] = useState<Restock[]>([])
    const [restockOpensAt, setRestockOpensAt] = useState('')
    const [restockItems, setRestockItems] = useState<{ productId: string; quantity: string }[]>([])
    const [addingRestock, setAddingRestock] = useState(false)
    const [restockError, setRestockError] = useState<string | null>(null)

    const { combine } = useMinLoading(1000)
    const isLoading = combine(dataLoaded)

    async function loadSession() {
        try {
            const res = await adminFetch(`/api/admin/sessions/${id}`)
            const body = await res.json()
            if (body.data) setSession(body.data)
            else setError(body.error ?? '載入失敗')
        } catch {
            setError('載入失敗')
        } finally {
            setDataLoaded(true)
        }
    }

    async function loadRestocks() {
        try {
            const res = await adminFetch(`/api/admin/sessions/${id}/restocks`)
            const body = await res.json()
            if (body.data) setRestocks(body.data)
        } catch { }
    }

    useEffect(() => {
        loadSession()
        loadRestocks()
    }, [])

    async function handleAddProduct(e: React.SyntheticEvent) {
        e.preventDefault()
        setAdding(true)
        setAddError(null)
        try {
            const res = await adminFetch(`/api/admin/sessions/${id}/products`, {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    price: Number(price),
                    stockQty: Number(stockQty),
                    maxPerPerson: maxPerPerson ? Number(maxPerPerson) : null,
                }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '新增失敗')
            setName('')
            setPrice('')
            setStockQty('')
            setMaxPerPerson('')
            loadSession()
        } catch (e: any) {
            setAddError(e.message)
        } finally {
            setAdding(false)
        }
    }

    async function handleAddRestock(e: React.SyntheticEvent) {
        e.preventDefault()
        setAddingRestock(true)
        setRestockError(null)
        try {
            const items = restockItems
                .filter(i => i.productId && Number(i.quantity) > 0)
                .map(i => ({ productId: i.productId, quantity: Number(i.quantity) }))
            if (items.length === 0) throw new Error('請至少填寫一項商品數量')
            const res = await adminFetch(`/api/admin/sessions/${id}/restocks`, {
                method: 'POST',
                body: JSON.stringify({ opensAt: restockOpensAt, items }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '新增失敗')
            setRestockOpensAt('')
            setRestockItems([])
            loadRestocks()
        } catch (e: any) {
            setRestockError(e.message)
        } finally {
            setAddingRestock(false)
        }
    }

    async function handleCancelRestock(restockId: string) {
        if (!confirm('確定取消這筆追加庫存排程？')) return
        await adminFetch(`/api/admin/restocks/${restockId}`, { method: 'DELETE' })
        loadRestocks()
    }

    async function handleDelete(productId: string) {
        if (!confirm('確定要刪除這個商品？')) return
        await adminFetch(`/api/admin/sessions/${id}/products/${productId}`, { method: 'DELETE' })
        loadSession()
    }

    async function handleEdit(e: React.SyntheticEvent) {
        e.preventDefault()
        if (!editState) return
        const res = await adminFetch(
            `/api/admin/sessions/${id}/products/${editState.productId}`,
            {
                method: 'PATCH',
                body: JSON.stringify({
                    name: editState.name,
                    price: Number(editState.price),
                    stockQty: Number(editState.stockQty),
                    maxPerPerson: editState.maxPerPerson ? Number(editState.maxPerPerson) : null,
                }),
            }
        )
        if (res.ok) {
            setEditState(null)
            loadSession()
        }
    }

    if (isLoading) return <AdminSpinner />
    if (error) return <AdminError error={error} onRetry={loadSession} />
    if (!session) return null

    return (
        <>
        <div className="p-6 max-w-3xl mx-auto space-y-8">

            {/* 頁首 */}
            <div className="flex items-center gap-3 mb-2">
                <Link href="/admin/sessions"
                    className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1 ${btn.surface}`}
                    style={css.surface}>
                    <ChevronLeft className="w-4 h-4" style={css.muted} /><span style={css.muted}>返回</span>
                </Link>
            </div>

            {/* 開單資訊 */}
            <div className="rounded-xl border p-5" style={css.surface}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-xl font-semibold" style={css.text}>{session.title}</h1>
                        <div className="text-xs mt-1.5 space-y-0.5" style={css.muted}>
                            {session.opens_at && (
                                <p>開放時間：{new Date(session.opens_at).toLocaleString('zh-TW')}</p>
                            )}
                            {session.closes_at && (
                                <p>截止時間：{new Date(session.closes_at).toLocaleString('zh-TW')}</p>
                            )}
                            {session.per_person_limit && (
                                <p>每人上限：{session.per_person_limit} 件</p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <Link href={`/admin/sessions/${id}/edit`}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${btn.surface}`}
                            style={css.surface}>
                            <span style={css.muted}>編輯開單</span>
                        </Link>
                        <Link href={`/admin/sessions/${id}/stats`}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${btn.surface}`}
                            style={css.surface}>
                            <span style={css.muted}>查看統計</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* 商品列表 */}
            <div>
                <h2 className="text-base font-semibold mb-3" style={css.text}>商品</h2>
                {session.products.length === 0 ? (
                    <div className="rounded-xl border p-8 text-center" style={css.surface}>
                        <p className="text-sm" style={css.muted}>尚未新增商品</p>
                    </div>
                ) : (
                    <div className="rounded-xl border overflow-hidden" style={css.surface}>
                        {session.products.map((p, idx) => (
                            <div key={p.id}
                                className={`p-4 ${idx !== 0 ? 'border-t' : ''}`}
                                style={idx !== 0 ? css.border : {}}>
                                {editState?.productId === p.id ? (
                                    <form onSubmit={handleEdit} className="flex gap-2 items-end flex-wrap">
                                        <div className="flex flex-col gap-1 flex-1 min-w-32">
                                            <label className="text-xs font-medium" style={css.muted}>商品名稱</label>
                                            <input
                                                value={editState.name}
                                                onChange={e => setEditState({ ...editState, name: e.target.value })}
                                                className="border rounded-lg px-3 py-1.5 text-sm"
                                                style={css.surface}
                                                required
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 w-24">
                                            <label className="text-xs font-medium" style={css.muted}>售價（NT$）</label>
                                            <input
                                                type="number" min="0"
                                                value={editState.price}
                                                onChange={e => setEditState({ ...editState, price: e.target.value })}
                                                className="border rounded-lg px-3 py-1.5 text-sm w-full"
                                                style={css.surface}
                                                required
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 w-24">
                                            <label className="text-xs font-medium" style={css.muted}>庫存數量</label>
                                            <input
                                                type="number" min="0"
                                                value={editState.stockQty}
                                                onChange={e => setEditState({ ...editState, stockQty: e.target.value })}
                                                className="border rounded-lg px-3 py-1.5 text-sm w-full"
                                                style={css.surface}
                                                required
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 w-24">
                                            <label className="text-xs font-medium" style={css.muted}>每人限購</label>
                                            <input
                                                type="number" min="1"
                                                placeholder="不限"
                                                value={editState.maxPerPerson}
                                                onChange={e => setEditState({ ...editState, maxPerPerson: e.target.value })}
                                                className="border rounded-lg px-3 py-1.5 text-sm w-full"
                                                style={css.surface}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 self-end">
                                            <label className="text-xs font-medium opacity-0 select-none">　</label>
                                            <div className="flex gap-2">
                                                <button type="submit"
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${btn.solid}`}
                                                    style={{ backgroundColor: 'var(--color-admin-primary)' }}>儲存</button>
                                                <button type="button" onClick={() => setEditState(null)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs border ${btn.surface}`}
                                                    style={css.surface}>
                                                    <span style={css.muted}>取消</span>
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-sm" style={css.text}>{p.name}</p>
                                                <p className="text-xs mt-0.5" style={css.muted}>
                                                    NT$ {p.price}・庫存 {p.stock_qty}
                                                    {p.max_per_person ? `・每人限購 ${p.max_per_person} 件` : ''}
                                                </p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => setEditState({
                                                        productId: p.id,
                                                        name: p.name,
                                                        price: String(p.price),
                                                        stockQty: String(p.stock_qty),
                                                        maxPerPerson: p.max_per_person ? String(p.max_per_person) : ''
                                                    })}
                                                    className={`px-3 py-1.5 rounded-lg text-xs border ${btn.surface}`}
                                                    style={css.surface}>
                                                    <span style={css.muted}>編輯</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${btn.solid}`}
                                                    style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>刪除</button>
                                            </div>
                                        </div>
                                        <ProductImageStrip
                                            productId={p.id}
                                            images={getImages(p)}
                                            onLightbox={setLightboxUrl}
                                            onChange={loadSession}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 新增商品 */}
            <div className="rounded-xl border p-5" style={css.surface}>
                <h2 className="text-base font-semibold mb-4" style={css.text}>新增商品</h2>
                <form onSubmit={handleAddProduct} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium mb-1" style={css.muted}>商品名稱 *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            placeholder="例：草莓塔"
                            className="w-full border rounded-lg px-2 py-2 text-xs"
                            style={css.surface}
                        />
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-medium mb-1" style={css.muted}>售價（NT$）*</label>
                            <input
                                type="number" min="0"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                required
                                className="w-full border rounded-lg px-2 py-2 text-xs"
                                style={css.surface}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium mb-1" style={css.muted}>庫存數量 *</label>
                            <input
                                type="number" min="0"
                                value={stockQty}
                                onChange={e => setStockQty(e.target.value)}
                                required
                                className="w-full border rounded-lg px-2 py-2 text-xs"
                                style={css.surface}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium mb-1" style={css.muted}>每人限購（件）</label>
                            <input
                                type="number" min="1"
                                value={maxPerPerson}
                                onChange={e => setMaxPerPerson(e.target.value)}
                                placeholder="不填表示無限制"
                                className="w-full border rounded-lg px-2 py-2 text-xs"
                                style={css.surface}
                            />
                        </div>
                    </div>
                    {addError && <p className="text-xs" style={{ color: '#DC2626' }}>{addError}</p>}
                    <button
                        type="submit"
                        disabled={adding}
                        className={`w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${btn.solid}`}
                        style={{ backgroundColor: 'var(--color-admin-primary)' }}
                    >
                        {adding ? '新增中...' : '新增商品'}
                    </button>
                </form>
            </div>

            {/* 追加庫存排程 */}
            <div>
                <h2 className="text-base font-semibold mb-3" style={css.text}>追加庫存排程</h2>

                {restocks.length === 0 ? (
                    <p className="text-sm mb-4" style={css.muted}>尚未設定追加庫存</p>
                ) : (
                    <div className="rounded-xl border overflow-hidden mb-4" style={css.surface}>
                        {restocks.map((r, idx) => (
                            <div key={r.id}
                                className={`p-4 ${idx !== 0 ? 'border-t' : ''} ${!r.is_active ? 'opacity-40' : ''}`}
                                style={idx !== 0 ? css.border : {}}>
                                <div className="flex justify-between items-start gap-3">
                                    <div>
                                        <p className="text-sm font-semibold" style={css.text}>
                                            {new Date(r.opens_at).toLocaleString('zh-TW')}
                                            {r.applied && (
                                                <span className="ml-2 text-xs font-normal"
                                                    style={{ color: '#16A34A' }}>已套用</span>
                                            )}
                                            {!r.is_active && (
                                                <span className="ml-2 text-xs font-normal" style={css.muted}>已取消</span>
                                            )}
                                        </p>
                                        <ul className="text-xs mt-1 space-y-0.5" style={css.muted}>
                                            {r.restock_items.map(item => (
                                                <li key={item.product_id}>
                                                    {item.products.name} +{item.quantity}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    {!r.applied && r.is_active && (
                                        <button
                                            onClick={() => handleCancelRestock(r.id)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${btn.solid}`}
                                            style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>取消</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 新增追加庫存 */}
                <div className="rounded-xl border p-5" style={css.surface}>
                    <h3 className="text-sm font-semibold mb-4" style={css.text}>新增排程</h3>
                    <form onSubmit={handleAddRestock} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium mb-1" style={css.muted}>開放時間 *</label>
                            <DateTimePicker value={restockOpensAt} onChange={setRestockOpensAt} required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-2" style={css.muted}>
                                追加數量（填 0 或空白表示不追加此商品）
                            </label>
                            {session.products.map(p => (
                                <div key={p.id} className="flex items-center gap-3 mb-2">
                                    <span className="text-sm flex-1" style={css.text}>{p.name}</span>
                                    <input
                                        type="number" min="0"
                                        placeholder="0"
                                        className="border rounded-lg px-3 py-1.5 text-sm w-24"
                                        style={css.surface}
                                        value={restockItems.find(i => i.productId === p.id)?.quantity ?? ''}
                                        onChange={e => {
                                            setRestockItems(prev => {
                                                const existing = prev.find(i => i.productId === p.id)
                                                if (existing) {
                                                    return prev.map(i => i.productId === p.id
                                                        ? { ...i, quantity: e.target.value }
                                                        : i
                                                    )
                                                }
                                                return [...prev, { productId: p.id, quantity: e.target.value }]
                                            })
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        {restockError && <p className="text-xs" style={{ color: '#DC2626' }}>{restockError}</p>}
                        <button
                            type="submit"
                            disabled={addingRestock || !restockOpensAt}
                            className={`w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${btn.solid}`}
                            style={{ backgroundColor: 'var(--color-admin-primary)' }}
                        >
                            {addingRestock ? '新增中...' : '新增追加庫存排程'}
                        </button>
                    </form>
                </div>
            </div>

        </div>

        {/* Lightbox */}
        {lightboxUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
                    onClick={() => setLightboxUrl(null)}
                >
                    <button
                        onClick={() => setLightboxUrl(null)}
                        className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${btn.surface}`}
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
                    >✕</button>
                    <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                        <Image
                            src={lightboxUrl!}
                            alt="商品圖片"
                            width={800}
                            height={600}
                            className="rounded-xl w-full h-auto"
                        />
                    </div>
                </div>
            )}
        </>
    )
}
