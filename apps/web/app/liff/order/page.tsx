'use client'

import { useEffect, useState } from 'react'

type Product = {
    id: string
    name: string
    price: number
    stock_qty: number
}

type Session = {
    id: string
    title: string
    per_person_limit: number | null
    products: Product[]
}

export default function OderPage() {
    const [session, setSession] = useState<Session | null>(null)
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/sessions/active')
            .then(res => res.json())
            .then(body => {
                if (body.data) {
                    setSession(body.data)
                    const init: Record<string, number> = {}
                    body.data.products.forEach((p: Product) => {
                        init[p.id] = 0
                    })
                    setQuantities(init)
                } else {
                    setError('目前沒有開放中的訂單')
                }
            })
            .catch(() => setError('載入失敗，請稍後再試'))
            .finally(() => setLoading(false))
    }, [])

    function updateQuantity(productId: string, delta: number, maxStock: number) {
        setQuantities(prev => {
            const current = prev[productId] ?? 0
            const next = Math.max(0, Math.min(current + delta, maxStock))
            return { ...prev, [productId]: next }
        })
    }

    const totalItems = Object.values(quantities).reduce((sum, q) => sum + q, 0)
    const totalAmount = session?.products.reduce(
        (sum, p) => sum + p.price * (quantities[p.id] ?? 0), 0
    ) ?? 0

    if (loading) return <div className="p-4">載入中</div>
    if (error) return <div className='p-4 text-red-500'>{error}</div>
    if (!session) return null

    return (
        <div className="p-4 max-w-md mx-auto">
            <h1 className="text-xl font-bold mb-4">{session.title}</h1>
            {session.per_person_limit && (
                <div className={`text-sm mb-4 p-2 rounded ${
                    totalItems >= session.per_person_limit
                        ? 'bg-red-50 text-red-600'
                        : 'bg-grey-50 text-gray-500'
                }`}>
                    每人限購 {session.per_person_limit} 件
                    已選 {totalItems} 件
                </div>
            )}

            <div className="space-y-4">
                {session.products.map(product => (
                    <div key={product.id} className="flex items-center justify-between border rounded p-3">
                        <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-gray-500">NT$ {product.price}</p>
                            <p className="text-xs text-gray-400">庫存 {product.stock_qty}</p>
                        </div>
                        <div className='flex items-cneter gap-2'>
                            <button
                                onClick={() => updateQuantity(product.id, -1, product.stock_qty)}
                                className="w-8 h-8 rounded-full border text-lg"
                            >-</button>
                            <span className="w-6 text-center">{quantities[product.id] ?? 0}</span>
                            <button
                                onClick={() => updateQuantity(product.id, 1, product.stock_qty)}
                                disabled={
                                    (quantities[product.id] ?? 0) >= product.stock_qty || 
                                    (session.per_person_limit !== null && totalItems >= session.per_person_limit)
                                }
                                className="w-8 h-8 rounded-full border text-lg disabled:opacity-40"
                            >+</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 border-t pt-4">
                <p className="text-right font-bold">小計：NT$ {totalAmount}</p>
            </div>
        </div>
    )
}