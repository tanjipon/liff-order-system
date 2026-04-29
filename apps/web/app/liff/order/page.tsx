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
    opens_at: string | null
    closes_at: string | null
    per_person_limit: number | null
    next_restock_at: string | null
    products: Product[]
}

type PickupOption = {
    id: string
    name: string
    description: string | null
    extra_fee: number
    allowed_payment_methods: string[] | null
}

export default function OrderPage() {
    const [session, setSession] = useState<Session | null>(null)
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [orderId, setOrderId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [quotaUsed, setQuotaUsed] = useState(0)

    const [step, setStep] = useState<'items' | 'pickup' | 'payment' | 'confirm'>('items')
    const [pickupOptions, setPickupOptions] = useState<PickupOption[]>([])
    const [selectedPickup, setSelectedPickup] = useState<PickupOption | null>(null)
    const [selectedPayment, setSelectedPayment] = useState<'bank_transfer' | 'cash' | null>(null)

    const [now, setNow] = useState(() => Date.now())

    // update now every second to drive counting down UI
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    // refresh when next_restock_at count to 0
    useEffect(() => {
        if (!session?.next_restock_at) return
        const msLeft = new Date(session.next_restock_at).getTime() - now
        if (msLeft <= 0) {
            // time's up and update stock
            fetch('/api/sessions/active')
                .then(res => res.json())
                .then(body => {
                    if (body.data) setSession(body.data)
                })
        }
    }, [now, session?.next_restock_at])

    useEffect(() => {
        fetch('/api/sessions/active')
            .then(res => res.json())
            .then(body => {
                if (body.data) {
                    setSession(body.data)
                    const init: Record<string, number> = {}
                    body.data.products.forEach((p: Product) => { init[p.id] = 0 })
                    setQuantities(init)

                    fetch('/api/orders', { headers: { 'x-liff-token': 'mock-token' } })
                        .then(res => res.json())
                        .then(body => {
                            if (body.data) {
                                const used = body.data
                                    .filter((o: any) => o.status !== 'cancelled')
                                    .reduce((sum: number, o: any) =>
                                        sum + o.order_items.reduce((s: number, i: any) => s + i.quantity, 0), 0)
                                setQuotaUsed(used)
                            }
                        })
                } else {
                    setError('目前沒有開放中的訂單')
                }
            })
            .catch(() => setError('載入失敗，請稍後再試'))
            .finally(() => setLoading(false))
    }, [])

    // load in pickup step
    useEffect(() => {
        if (step === 'pickup' && pickupOptions.length === 0) {
            fetch('/api/pickup-options')
                .then(res => res.json())
                .then(body => setPickupOptions(body.data ?? []))
        }
    }, [step])

    function formatCountdown(targetIso: string): string {
        const msLeft = new Date(targetIso).getTime() - now
        if (msLeft <= 0) return '00:00'
        const totalSec = Math.floor(msLeft / 1000)
        const min = Math.floor(totalSec / 60).toString().padStart(2, '0')
        const sec = (totalSec % 60).toString().padStart(2, '0')
        return `${min}:${sec}`
    }

    function updateQuantity(productId: string, delta: number, maxStock: number) {
        setQuantities(prev => {
            const current = prev[productId] ?? 0
            const next = Math.max(0, Math.min(current + delta, maxStock))
            return { ...prev, [productId]: next }
        })
    }

    const totalItems = Object.values(quantities).reduce((sum, q) => sum + q, 0)
    const totalSelected = totalItems + quotaUsed
    const itemSubtotal = session?.products.reduce(
        (sum, p) => sum + p.price * (quantities[p.id] ?? 0), 0
    ) ?? 0

    if (loading) return <div className="p-4">載入中</div>
    if (error) return <div className="p-4 text-red-500">{error}</div>

    if (orderId) return (
        <div className="p-4 max-w-md mx-auto text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold mb-2">訂單已送出</h2>
            <p className="text-gray-500 text-sm">訂單編號</p>
            <p className="font-mono text-xs text-gray-400 mt-1 break-all">{orderId}</p>
        </div>
    )

    if (!session) return null

    async function handleSubmit() {
        setSubmitting(true)
        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-liff-token': 'mock-token',
                },
                body: JSON.stringify({
                    sessionId: session!.id,
                    items: session!.products
                        .filter(p => (quantities[p.id] ?? 0) > 0)
                        .map(p => ({ product_id: p.id, quantity: quantities[p.id] })),
                    pickupOptionId: selectedPickup!.id,
                    paymentMethod: selectedPayment!,
                })
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '訂單送出失敗')
            setOrderId(body.data.orderId)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    // step 1: pick product
    if (step === 'items') return (
        <div className="p-4 max-w-md mx-auto">
            <h1 className="text-xl font-bold mb-4">{session.title}</h1>
            {session.per_person_limit && (
                <div className={`text-sm mb-4 p-2 rounded ${totalSelected >= session.per_person_limit
                    ? 'bg-red-50 text-red-600'
                    : 'bg-gray-50 text-gray-500'
                    }`}>
                    每人限購 {session.per_person_limit} 件・已選 {totalSelected} 件
                </div>
            )}
            {session.opens_at && new Date(session.opens_at).getTime() > now && (
                <div className="text-sm mb-4 p-2 rounded bg-yellow-50 text-yellow-700">
                    開搶倒數：{formatCountdown(session.opens_at)}
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
                        <div className="flex items-center gap-2">
                            <button onClick={() => updateQuantity(product.id, -1, product.stock_qty)}
                                className="w-8 h-8 rounded-full border text-lg">-</button>
                            <span className="w-6 text-center">{quantities[product.id] ?? 0}</span>
                            <button onClick={() => updateQuantity(product.id, 1, product.stock_qty)}
                                disabled={
                                    (quantities[product.id] ?? 0) >= product.stock_qty ||
                                    (session.per_person_limit !== null && totalSelected >= session.per_person_limit)
                                }
                                className="w-8 h-8 rounded-full border text-lg disabled:opacity-40">+</button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-6 border-t pt-4">
                <p className="text-right font-bold">小計：NT$ {itemSubtotal}</p>
            </div>
            <button
                onClick={() => setStep('pickup')}
                disabled={
                    totalItems === 0 ||
                    (session.opens_at !== null && new Date(session.opens_at).getTime() > now)
                }
                className="mt-4 w-full py-3 bg-green-500 text-white rounded-lg font-bold disabled:opacity-40"
            >
                下一步：選擇取貨方式
            </button>
        </div>
    )

    // step 2: pick pickup option
    if (step === 'pickup') return (
        <div className="p-4 max-w-md mx-auto">
            <button onClick={() => setStep('items')} className="text-sm text-gray-500 mb-4">← 返回</button>
            <h2 className="text-xl font-bold mb-4">選擇取貨方式</h2>
            <div className="space-y-3">
                {pickupOptions.map(option => (
                    <button
                        key={option.id}
                        onClick={() => setSelectedPickup(option)}
                        className={`w-full text-left border rounded-lg p-4 ${selectedPickup?.id === option.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200'
                            }`}
                    >
                        <div className="flex justify-between items-center">
                            <p className="font-medium">{option.name}</p>
                            <p className="text-sm text-gray-500">
                                {option.extra_fee > 0 ? `+NT$ ${option.extra_fee}` : '免費'}
                            </p>
                        </div>
                        {option.description && (
                            <p className="text-sm text-gray-400 mt-1">{option.description}</p>
                        )}
                    </button>
                ))}
            </div>
            <button
                onClick={() => setStep('payment')}
                disabled={!selectedPickup}
                className="mt-6 w-full py-3 bg-green-500 text-white rounded-lg font-bold disabled:opacity-40"
            >
                下一步：選擇付款方式
            </button>
        </div>
    )

    // step 3: choose payment method
    if (step === 'payment') {
        // filter mayment methods by pickup options
        const availablePayments: { value: 'bank_transfer' | 'cash'; label: string }[] = (
            [
                { value: 'bank_transfer', label: '銀行匯款' },
                { value: 'cash', label: '現金付款' },
            ] as const
        ).filter(p =>
            !selectedPickup?.allowed_payment_methods ||
            selectedPickup.allowed_payment_methods.includes(p.value)
        )

        return (
            <div className="p-4 max-w-md mx-auto">
                <button onClick={() => setStep('pickup')} className="text-sm text-gray-500 mb-4">← 返回</button>
                <h2 className="text-xl font-bold mb-4">選擇付款方式</h2>
                <div className="space-y-3">
                    {availablePayments.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setSelectedPayment(p.value)}
                            className={`w-full text-left border rounded-lg p-4 font-medium ${selectedPayment === p.value
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setStep('confirm')}
                    disabled={!selectedPayment}
                    className="mt-6 w-full py-3 bg-green-500 text-white rounded-lg font-bold disabled:opacity-40"
                >
                    下一步：確認訂單
                </button>
            </div>
        )
    }

    // step 4: confirm order
    if (step === 'confirm') {
        const pickupFee = selectedPickup?.extra_fee ?? 0
        const totalAmount = itemSubtotal + pickupFee

        return (
            <div className="p-4 max-w-md mx-auto">
                <button onClick={() => setStep('payment')} className="text-sm text-gray-500 mb-4">← 返回</button>
                <h2 className="text-xl font-bold mb-4">確認訂單</h2>

                {/* products reciept */}
                <div className="border rounded-lg p-4 space-y-2 mb-4">
                    <h3 className="font-medium text-sm text-gray-500 mb-2">商品明細</h3>
                    {session!.products
                        .filter(p => (quantities[p.id] ?? 0) > 0)
                        .map(p => (
                            <div key={p.id} className="flex justify-between text-sm">
                                <span>{p.name} × {quantities[p.id]}</span>
                                <span>NT$ {p.price * quantities[p.id]}</span>
                            </div>
                        ))
                    }
                </div>

                {/* fee overview */}
                <div className="border rounded-lg p-4 space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                        <span>商品小計</span>
                        <span>NT$ {itemSubtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>取貨方式：{selectedPickup?.name}</span>
                        <span>{pickupFee > 0 ? `NT$ ${pickupFee}` : '免費'}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2 mt-2">
                        <span>總金額</span>
                        <span>NT$ {totalAmount}</span>
                    </div>
                </div>

                {/* payment method */}
                <div className="border rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-500">付款方式</p>
                    <p className="font-medium mt-1">
                        {selectedPayment === 'bank_transfer' ? '銀行匯款' : '現金付款'}
                    </p>
                </div>

                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-3 bg-green-500 text-white rounded-lg font-bold disabled:opacity-40"
                >
                    {submitting ? '送出中...' : '確認送出'}
                </button>
            </div>
        )
    }

    return null
}
