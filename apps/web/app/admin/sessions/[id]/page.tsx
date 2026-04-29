'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'
import Link from 'next/link'

type Product = {
    id: string
    name: string
    price: number
    stock_qty: number
    max_per_person: number | null
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

export default function SessionDetailPage() {
    const { id } = useParams<{ id: string }>()

    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
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

    const [restocks, setRestocks] = useState<Restock[]>([])
    const [restockOpensAt, setRestockOpensAt] = useState('')
    const [restockItems, setRestockItems] = useState<{ productId: string; quantity: string }[]>([])
    const [addingRestock, setAddingRestock] = useState(false)
    const [restockError, setRestockError] = useState<string | null>(null)

    async function loadSession() {
        try {
            const res = await adminFetch(`/api/admin/sessions/${id}`)
            const body = await res.json()
            if (body.data) setSession(body.data)
            else setError(body.error ?? '載入失敗')
        } catch {
            setError('載入失敗')
        } finally {
            setLoading(false)
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
        await adminFetch(`/api/admin/sessions/${id}/products/${productId}`, {
            method: 'DELETE',
        })
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

    if (loading) return <div className="p-6">載入中...</div>
    if (error) return <div className="p-6 text-red-500">{error}</div>
    if (!session) return null

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8">

            {/* order creation info */}
            <div>
                <h1 className="text-2xl font-bold">{session.title}</h1>
                <Link href={`/admin/sessions/${id}/edit`} className="text-sm text-gray-500 border rounded px-3 py-1">
                    編輯開單
                </Link>
                <Link href={`/admin/sessions/${id}/stats`} className="text-sm text-gray-500 border rounded px-3 py-1">
                    查看統計
                </Link>
                <div className="text-sm text-gray-500 mt-1 space-y-0.5">
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

            {/* products list */}
            <div>
                <h2 className="text-lg font-semibold mb-3">商品</h2>
                {session.products.length === 0 ? (
                    <p className="text-gray-400 text-sm">尚未新增商品</p>
                ) : (
                    <div className="space-y-2">
                        {session.products.map(p => (
                            <div key={p.id} className="border rounded px-4 py-3 space-y-2">
                                {editState?.productId === p.id ? (
                                    <form onSubmit={handleEdit} className="flex gap-2 items-end flex-wrap">
                                        <input
                                            value={editState.name}
                                            onChange={e => setEditState({ ...editState, name: e.target.value })}
                                            className="border rounded px-2 py-1 text-sm flex-1"
                                            required
                                        />
                                        <input
                                            type="number" min="0"
                                            value={editState.price}
                                            onChange={e => setEditState({ ...editState, price: e.target.value })}
                                            className="border rounded px-2 py-1 text-sm w-24"
                                            required
                                        />
                                        <input
                                            type="number" min="0"
                                            value={editState.stockQty}
                                            onChange={e => setEditState({ ...editState, stockQty: e.target.value })}
                                            className="border rounded px-2 py-1 text-sm w-24"
                                            required
                                        />
                                        <input
                                            type="number" min="1"
                                            placeholder="不限"
                                            value={editState.maxPerPerson}
                                            onChange={e => setEditState({ ...editState, maxPerPerson: e.target.value })}
                                            className="border rounded px-2 py-1 text-sm w-24"
                                        />
                                        <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded text-sm">儲存</button>
                                        <button type="button" onClick={() => setEditState(null)} className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm">取消</button>
                                    </form>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{p.name}</p>
                                            <p className="text-sm text-gray-500">
                                                NT$ {p.price}・庫存 {p.stock_qty}
                                                {p.max_per_person && `・每人限購 ${p.max_per_person} 件`}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditState({
                                                    productId: p.id,
                                                    name: p.name,
                                                    price: String(p.price),
                                                    stockQty: String(p.stock_qty),
                                                    maxPerPerson: p.max_per_person ? String(p.max_per_person) : ''
                                                })}
                                                className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                                            >編輯</button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm"
                                            >刪除</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                    </div>
                )}
            </div>

            {/* add new product list */}
            <div>
                <h2 className="text-lg font-semibold mb-3">新增商品</h2>
                <form onSubmit={handleAddProduct} className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">商品名稱 *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            className="w-full border rounded px-3 py-2 text-sm"
                            placeholder="例：草莓塔"
                        />
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">售價（NT$）*</label>
                            <input
                                type="number"
                                min="0"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                required
                                className="w-full border rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">庫存數量 *</label>
                            <input
                                type="number"
                                min="0"
                                value={stockQty}
                                onChange={e => setStockQty(e.target.value)}
                                required
                                className="w-full border rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">每人限購（件）</label>
                            <input
                                type="number"
                                min="1"
                                value={maxPerPerson}
                                onChange={e => setMaxPerPerson(e.target.value)}
                                className="w-full border rounded px-3 py-2 text-sm"
                                placeholder="不填表示無限制"
                            />
                        </div>
                    </div>

                    {addError && <p className="text-red-500 text-sm">{addError}</p>}

                    <button
                        type="submit"
                        disabled={adding}
                        className="w-full bg-blue-500 text-white rounded py-2 text-sm disabled:opacity-50"
                    >
                        {adding ? '新增中...' : '新增商品'}
                    </button>
                </form>
            </div>

            {/* restock schedule section */}
            <div>
                <h2 className="text-lg font-semibold mb-3">追加庫存排程</h2>

                {/* existing restocks list */}
                {restocks.length === 0 ? (
                    <p className="text-gray-400 text-sm mb-4">尚未設定追加庫存</p>
                ) : (
                    <div className="space-y-2 mb-4">
                        {restocks.map(r => (
                            <div key={r.id} className={`border rounded px-4 py-3 text-sm ${!r.is_active ? 'opacity-40' : ''
                                }`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium">
                                            {new Date(r.opens_at).toLocaleString('zh-TW')}
                                            {r.applied && <span className="ml-2 text-green-600 text-xs">已套用</span>}
                                            {!r.is_active && <span className="ml-2 text-gray-400 text-xs">已取消</span>}
                                        </p>
                                        <ul className="text-gray-500 mt-1 space-y-0.5">
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
                                            className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs"
                                        >取消</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* add new restock form */}
                <form onSubmit={handleAddRestock} className="space-y-3 border rounded p-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">開放時間 *</label>
                        <input
                            type="datetime-local"
                            value={restockOpensAt}
                            onChange={e => setRestockOpensAt(e.target.value)}
                            required
                            className="w-full border rounded px-3 py-2 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">追加數量（填 0 或空白表示不追加此商品）</label>
                        {session.products.map(p => (
                            <div key={p.id} className="flex items-center gap-3 mb-2">
                                <span className="text-sm flex-1">{p.name}</span>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    className="border rounded px-2 py-1 text-sm w-24"
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

                    {restockError && <p className="text-red-500 text-sm">{restockError}</p>}

                    <button
                        type="submit"
                        disabled={addingRestock || !restockOpensAt}
                        className="w-full bg-blue-500 text-white rounded py-2 text-sm disabled:opacity-50"
                    >
                        {addingRestock ? '新增中...' : '新增追加庫存排程'}
                    </button>
                </form>
            </div>

        </div>
    )
}
