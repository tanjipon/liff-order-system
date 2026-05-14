'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LiffLoader from '@/components/liff/LiffLoader'
import LiffError from '@/components/liff/LiffError'
import { useMinLoading } from '@/hooks/useMinLoading'
import { useLiff } from '@/components/liff/LiffProvider'
import { CheckCircle } from 'lucide-react'
import ProductGallery from '@/components/liff/ProductGallery'
import AddressInput, { type AddressParts, EMPTY_ADDRESS } from '@/components/liff/AddressInput'
import { formatAddress } from '@/lib/twAddress'

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

function getProductImages(p: Product): { url: string }[] {
    return [...(p.product_image_links ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(l => ({ url: l.product_images.url }))
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
    requires_address: boolean
}

// ── Shared styles ──────────────────────────────────────────
const S = {
    outer: 'min-h-screen w-full',
    inner: 'p-4 max-w-md mx-auto',
    card: 'rounded-2xl border p-4',
    title: 'text-xl font-bold mb-4',
    label: 'text-sm font-medium',
    muted: 'text-xs',
    primaryBtn: 'w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40',
    secondaryBtn: 'w-full py-3 rounded-xl font-bold text-sm border',
    backBtn: 'text-sm mb-4 flex items-center gap-1',
    input: 'w-full border rounded-xl px-3 py-2 text-sm',
} as const

const css = {
    bg: { backgroundColor: 'var(--color-liff-bg)' },
    surface: { backgroundColor: 'var(--color-liff-surface)', borderColor: 'var(--color-liff-border)' },
    primary: { backgroundColor: 'var(--color-liff-primary)' },
    primaryHover: { backgroundColor: 'var(--color-liff-primary-hover)' },
    text: { color: 'var(--color-liff-text)' },
    muted: { color: 'var(--color-liff-muted)' },
    accent: { color: 'var(--color-liff-primary)' },
    border: { borderColor: 'var(--color-liff-border)' },
    warnBg: { backgroundColor: '#FFF3CD', color: '#856404' },
    dangerBg: { backgroundColor: '#FFE8ED', color: '#C0392B' },
    successBg: { backgroundColor: '#ECFDF5', color: '#065F46' },
} as const

function OrderPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const sessionId = searchParams.get('sessionId')
    const { ready, token, error: liffError } = useLiff()

    const [session, setSession] = useState<Session | null>(null)
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [dataLoaded, setDataLoaded] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [orderId, setOrderId] = useState<string | null>(null)
    const [orderNumber, setOrderNumber] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [quotaUsed, setQuotaUsed] = useState(0)
    const [productQuotaUsed, setProductQuotaUsed] = useState<Record<string, number>>({})

    const [step, setStep] = useState<'items' | 'pickup' | 'payment' | 'contact' | 'confirm'>('items')
    const [pickupOptions, setPickupOptions] = useState<PickupOption[]>([])
    const [selectedPickup, setSelectedPickup] = useState<PickupOption | null>(null)
    const [selectedPayment, setSelectedPayment] = useState<'bank_transfer' | 'cash' | null>(null)

    // Contact info
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [sameAsCustomer, setSameAsCustomer] = useState(true)
    const [recipientName, setRecipientName] = useState('')
    const [recipientPhone, setRecipientPhone] = useState('')
    const [recipientAddress, setRecipientAddress] = useState<AddressParts>(EMPTY_ADDRESS)

    const [now, setNow] = useState(() => Date.now())
    const { combine } = useMinLoading(1500)
    const isLoading = combine(dataLoaded) || !ready

    const activeUrl = sessionId
        ? `/api/sessions/active?sessionId=${sessionId}`
        : '/api/sessions/active'

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (!session?.next_restock_at) return
        if (new Date(session.next_restock_at).getTime() - now <= 0) {
            fetch(activeUrl)
                .then(res => res.json())
                .then(body => { if (body.data) setSession(body.data) })
        }
    }, [now, session?.next_restock_at])

    useEffect(() => {
        if (!ready) return
        if (!token) {
            setError(liffError ?? '請透過 LINE 開啟此頁面')
            setDataLoaded(true)
            return
        }
        fetch(activeUrl)
            .then(res => res.json())
            .then(body => {
                if (body.data) {
                    setSession(body.data)
                    const init: Record<string, number> = {}
                    body.data.products.forEach((p: Product) => { init[p.id] = 0 })
                    setQuantities(init)
                    fetch('/api/orders', { headers: { 'x-liff-token': token } })
                        .then(res => res.json())
                        .then(body => {
                            if (body.data) {
                                const activeOrders = body.data.filter((o: any) => o.status !== 'cancelled')
                                const used = activeOrders.reduce((sum: number, o: any) =>
                                    sum + o.order_items.reduce((s: number, i: any) => s + i.quantity, 0), 0)
                                setQuotaUsed(used)
                                const perProduct: Record<string, number> = {}
                                activeOrders.forEach((o: any) => {
                                    o.order_items.forEach((i: any) => {
                                        perProduct[i.product_id] = (perProduct[i.product_id] ?? 0) + i.quantity
                                    })
                                })
                                setProductQuotaUsed(perProduct)
                            }
                        })
                } else {
                    setError('目前沒有開放中的訂單')
                }
            })
            .catch(() => setError('載入失敗，請稍後再試'))
            .finally(() => setDataLoaded(true))
    }, [ready, token])

    useEffect(() => {
        if (step === 'pickup' && pickupOptions.length === 0) {
            fetch('/api/pickup-options')
                .then(res => res.json())
                .then(body => setPickupOptions(body.data ?? []))
        }
    }, [step])

    function formatCountdown(targetIso: string): string {
        const msLeft = new Date(targetIso).getTime() - now
        if (msLeft <= 0) return '0秒'
        const totalSec = Math.floor(msLeft / 1000)
        const days = Math.floor(totalSec / 86400)
        const hours = Math.floor((totalSec % 86400) / 3600)
        const minutes = Math.floor((totalSec % 3600) / 60)
        const secs = totalSec % 60
        const parts = []
        if (days > 0) parts.push(`${days}日`)
        if (hours > 0) parts.push(`${hours}時`)
        if (minutes > 0) parts.push(`${minutes}分`)
        parts.push(`${secs}秒`)
        return parts.join(' ')
    }

    function updateQuantity(productId: string, delta: number, maxStock: number, maxPerPerson: number | null) {
        setQuantities(prev => {
            const current = prev[productId] ?? 0
            const effectiveMax = maxPerPerson !== null
                ? Math.min(maxStock, maxPerPerson - (productQuotaUsed[productId] ?? 0))
                : maxStock
            const next = Math.max(0, Math.min(current + delta, Math.max(0, effectiveMax)))
            return { ...prev, [productId]: next }
        })
    }

    const totalItems = Object.values(quantities).reduce((sum, q) => sum + q, 0)
    const totalSelected = totalItems + quotaUsed
    const itemSubtotal = session?.products.reduce(
        (sum, p) => sum + p.price * (quantities[p.id] ?? 0), 0
    ) ?? 0

    if (isLoading) return <LiffLoader />
    if (error && !orderId) return <LiffError error={error} backHref="/liff/sessions" />
    if (!session) return null

    // ── 訂單送出成功 ──────────────────────────────────────────
    if (orderId) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4" style={css.bg}>
            <CheckCircle className="w-16 h-16 mb-4" style={{ color: 'var(--color-liff-primary)' }} />
            <h2 className="text-xl font-bold mb-2" style={css.text}>訂單已送出</h2>
            {orderNumber && (
                <>
                    <p className="text-sm mb-1" style={css.muted}>訂單單號</p>
                    <p className="text-2xl font-bold tabular-nums" style={css.accent}>
                        #{String(orderNumber).padStart(4, '0')}
                    </p>
                </>
            )}
            <button
                onClick={() => router.push('/liff/status')}
                className="mt-6 text-sm underline underline-offset-2"
                style={css.muted}
            >查看訂單狀態</button>
        </div>
    )

    async function handleSubmit() {
        setSubmitting(true)
        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-liff-token': token ?? '' },
                body: JSON.stringify({
                    sessionId: session!.id,
                    items: session!.products
                        .filter(p => (quantities[p.id] ?? 0) > 0)
                        .map(p => ({ product_id: p.id, quantity: quantities[p.id] })),
                    pickupOptionId: selectedPickup!.id,
                    paymentMethod: selectedPayment!,
                    customerName,
                    customerPhone,
                    recipientName:    sameAsCustomer ? customerName : recipientName,
                    recipientPhone:   sameAsCustomer ? customerPhone : recipientPhone,
                    recipientAddress: selectedPickup!.requires_address ? formatAddress(recipientAddress) : null,
                })
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '訂單送出失敗')
            setOrderId(body.data.orderId)
            setOrderNumber(body.data.orderNumber)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const notOpenYet = session.opens_at !== null && new Date(session.opens_at).getTime() > now

    // ── Step 1: 選商品 ────────────────────────────────────────
    if (step === 'items') return (
        <div className={S.outer} style={css.bg}>
            <div className={S.inner}>
                {sessionId && (
                    <button
                        onClick={() => router.push('/liff/sessions')}
                        className={S.backBtn}
                        style={css.muted}
                    >
                        ← 返回選單
                    </button>
                )}
                <h1 className={S.title} style={css.text}>{session.title}</h1>

                <ProductGallery products={session.products.map(p => ({ ...p, images: getProductImages(p) }))} />

                {/* opens_at 倒數 */}
                {notOpenYet && (
                    <div className="rounded-xl p-3 mb-4 text-sm text-center" style={css.warnBg}>
                        開搶倒數：{formatCountdown(session.opens_at!)}
                    </div>
                )}

                {/* per_person_limit 提示 */}
                {session.per_person_limit && (
                    <div className={`text-sm mb-4 p-3 rounded-xl ${totalSelected >= session.per_person_limit ? '' : ''
                        }`} style={totalSelected >= session.per_person_limit ? css.dangerBg : { backgroundColor: 'var(--color-liff-bg)', color: 'var(--color-liff-muted)', border: '1px solid var(--color-liff-border)' }}>
                        每人限購 {session.per_person_limit} 件・已選 {totalSelected} 件
                    </div>
                )}

                {/* 商品列表 */}
                <div className="space-y-3">
                    {session.products.map(product => (
                        <div key={product.id} className={`${S.card} flex items-center justify-between`} style={css.surface}>
                            <div className="flex-1 min-w-0 pr-3">
                                <p className="font-semibold text-sm" style={css.text}>{product.name}</p>
                                <p className={S.muted} style={css.muted}>NT$ {product.price}</p>
                                <p className={S.muted} style={css.muted}>庫存 {product.stock_qty}</p>
                                {/* 庫存 0 提示 */}
                                {product.stock_qty === 0 && (
                                    <p className="text-xs mt-0.5">
                                        {session.next_restock_at
                                            ? <span style={{ color: '#B45309' }}>
                                                追加庫存將於 {new Date(session.next_restock_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 開放<br />
                                                （{formatCountdown(session.next_restock_at)}）
                                            </span>
                                            : <span style={css.muted}>已售完</span>
                                        }
                                    </p>
                                )}
                                {/* 每人限購提示 */}
                                {product.max_per_person !== null && (
                                    <p className="text-xs mt-0.5" style={css.muted}>每人限購 {product.max_per_person} 件</p>
                                )}
                            </div>

                            {/* 數量選擇器：固定寬度避免版面位移 */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => updateQuantity(product.id, -1, product.stock_qty, product.max_per_person)}
                                        className="w-8 h-8 rounded-full border flex items-center justify-center text-base font-bold"
                                        style={css.surface}
                                    >−</button>
                                    {/* 固定寬度：tabular-nums 確保等寬數字 */}
                                    <span className="w-8 text-center text-sm font-medium tabular-nums" style={css.text}>
                                        {quantities[product.id] ?? 0}
                                    </span>
                                    <button
                                        onClick={() => updateQuantity(product.id, 1, product.stock_qty, product.max_per_person)}
                                        disabled={
                                            (quantities[product.id] ?? 0) >= product.stock_qty ||
                                            (session.per_person_limit !== null && totalSelected >= session.per_person_limit) ||
                                            (product.max_per_person !== null && (quantities[product.id] ?? 0) >= product.max_per_person - (productQuotaUsed[product.id] ?? 0))
                                        }
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-base font-bold text-white disabled:opacity-40"
                                        style={css.primary}
                                    >+</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 小計 */}
                <div className="mt-6 pt-4 border-t" style={css.border}>
                    <p className="text-right font-bold text-sm" style={css.text}>小計：NT$ {itemSubtotal}</p>
                </div>

                <button
                    onClick={() => setStep('pickup')}
                    disabled={totalItems === 0 || notOpenYet}
                    className={`mt-4 ${S.primaryBtn}`}
                    style={css.primary}
                >
                    下一步：選擇取貨方式
                </button>
            </div>
        </div>
    )

    // ── Step 2: 取貨方式 ──────────────────────────────────────
    if (step === 'pickup') return (
        <div className={S.outer} style={css.bg}>
            <div className={S.inner}>
                <button onClick={() => setStep('items')} className={S.backBtn} style={css.muted}>← 返回</button>
                <h2 className={S.title} style={css.text}>選擇取貨方式</h2>
                <div className="space-y-3">
                    {pickupOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={() => setSelectedPickup(option)}
                            className={`w-full text-left ${S.card} transition-all`}
                            style={selectedPickup?.id === option.id
                                ? { backgroundColor: '#FFF0F5', borderColor: 'var(--color-liff-primary)' }
                                : css.surface
                            }
                        >
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-sm" style={css.text}>{option.name}</p>
                                <p className="text-sm font-medium" style={css.accent}>
                                    {option.extra_fee > 0 ? `+NT$ ${option.extra_fee}` : '免費'}
                                </p>
                            </div>
                            {option.description && (
                                <p className="text-xs mt-1" style={css.muted}>{option.description}</p>
                            )}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setStep('payment')}
                    disabled={!selectedPickup}
                    className={`mt-6 ${S.primaryBtn}`}
                    style={css.primary}
                >
                    下一步：選擇付款方式
                </button>
            </div>
        </div>
    )

    // ── Step 3: 付款方式 ──────────────────────────────────────
    if (step === 'payment') {
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
            <div className={S.outer} style={css.bg}>
                <div className={S.inner}>
                    <button onClick={() => setStep('pickup')} className={S.backBtn} style={css.muted}>← 返回</button>
                    <h2 className={S.title} style={css.text}>選擇付款方式</h2>
                    <div className="space-y-3">
                        {availablePayments.map(p => (
                            <button
                                key={p.value}
                                onClick={() => setSelectedPayment(p.value)}
                                className={`w-full text-left ${S.card} font-semibold text-sm transition-all`}
                                style={selectedPayment === p.value
                                    ? { backgroundColor: '#FFF0F5', borderColor: 'var(--color-liff-primary)', color: 'var(--color-liff-text)' }
                                    : { ...css.surface, color: 'var(--color-liff-text)' }
                                }
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setStep('contact')}
                        disabled={!selectedPayment}
                        className={`mt-6 ${S.primaryBtn}`}
                        style={css.primary}
                    >
                        下一步：填寫資料
                    </button>
                </div>
            </div>
        )
    }

    // ── Step 4: Contact info ──────────────────────────────────
    if (step === 'contact') {
        const requiresAddress = selectedPickup?.requires_address ?? false
        const contactValid =
            customerName.trim() !== '' &&
            customerPhone.trim() !== '' &&
            (sameAsCustomer || (recipientName.trim() !== '' && recipientPhone.trim() !== '')) &&
            (!requiresAddress || (recipientAddress.city !== '' && recipientAddress.district !== '' && recipientAddress.street.trim() !== ''))

        return (
            <div className={S.outer} style={css.bg}>
                <div className={S.inner}>
                    <button onClick={() => setStep('payment')} className={S.backBtn} style={css.muted}>← 返回</button>
                    <h2 className={S.title} style={css.text}>填寫資料</h2>

                    {/* Orderer info */}
                    <div className={`${S.card} space-y-3 mb-4`} style={css.surface}>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={css.muted}>訂購人資訊</p>
                        <div>
                            <label className="block text-xs mb-1" style={css.muted}>姓名</label>
                            <input
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="姓名"
                                className={S.input}
                                style={css.surface}
                            />
                        </div>
                        <div>
                            <label className="block text-xs mb-1" style={css.muted}>聯絡電話</label>
                            <input
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                placeholder="電話"
                                type="tel"
                                className={S.input}
                                style={css.surface}
                            />
                        </div>
                    </div>

                    {/* Same-as-customer toggle */}
                    <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer" style={css.text}>
                        <input
                            type="checkbox"
                            checked={sameAsCustomer}
                            onChange={e => setSameAsCustomer(e.target.checked)}
                            className="accent-pink-400 w-4 h-4"
                        />
                        收貨人同訂購人
                    </label>

                    {/* Recipient info — only shown when not same as customer */}
                    {!sameAsCustomer && (
                        <div className={`${S.card} space-y-3 mb-4`} style={css.surface}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={css.muted}>收貨人資訊</p>
                            <div>
                                <label className="block text-xs mb-1" style={css.muted}>姓名</label>
                                <input
                                    value={recipientName}
                                    onChange={e => setRecipientName(e.target.value)}
                                    placeholder="姓名"
                                    className={S.input}
                                    style={css.surface}
                                />
                            </div>
                            <div>
                                <label className="block text-xs mb-1" style={css.muted}>電話</label>
                                <input
                                    value={recipientPhone}
                                    onChange={e => setRecipientPhone(e.target.value)}
                                    placeholder="電話"
                                    type="tel"
                                    className={S.input}
                                    style={css.surface}
                                />
                            </div>
                        </div>
                    )}

                    {/* Shipping address — only shown when pickup requires it */}
                    {requiresAddress && (
                        <div className={`${S.card} space-y-3 mb-4`} style={css.surface}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={css.muted}>收貨地址</p>
                            <AddressInput
                                value={recipientAddress}
                                onChange={setRecipientAddress}
                                surfaceStyle={css.surface}
                            />
                        </div>
                    )}

                    <button
                        onClick={() => setStep('confirm')}
                        disabled={!contactValid}
                        className={S.primaryBtn}
                        style={css.primary}
                    >
                        下一步：確認訂單
                    </button>
                </div>
            </div>
        )
    }

    // ── Step 5: 確認訂單 ──────────────────────────────────────
    if (step === 'confirm') {
        const pickupFee = selectedPickup?.extra_fee ?? 0
        const totalAmount = itemSubtotal + pickupFee

        return (
            <div className={S.outer} style={css.bg}>
                <div className={S.inner}>
                    <button onClick={() => setStep('contact')} className={S.backBtn} style={css.muted}>← 返回</button>
                    <h2 className={S.title} style={css.text}>確認訂單</h2>

                    {/* 商品明細 */}
                    <div className={`${S.card} space-y-2 mb-4`} style={css.surface}>
                        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide" style={css.muted}>商品明細</h3>
                        {session.products
                            .filter(p => (quantities[p.id] ?? 0) > 0)
                            .map(p => (
                                <div key={p.id} className="flex justify-between text-sm">
                                    <span style={css.text}>{p.name} × {quantities[p.id]}</span>
                                    <span className="font-medium" style={css.text}>NT$ {p.price * quantities[p.id]}</span>
                                </div>
                            ))
                        }
                    </div>

                    {/* 費用總覽 */}
                    <div className={`${S.card} space-y-2 mb-4`} style={css.surface}>
                        <div className="flex justify-between text-sm">
                            <span style={css.muted}>商品小計</span>
                            <span style={css.text}>NT$ {itemSubtotal}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span style={css.muted}>取貨方式：{selectedPickup?.name}</span>
                            <span style={css.text}>{pickupFee > 0 ? `NT$ ${pickupFee}` : '免費'}</span>
                        </div>
                        <div className="flex justify-between font-bold text-sm border-t pt-2 mt-2" style={{ borderColor: 'var(--color-liff-border)', color: 'var(--color-liff-text)' }}>
                            <span>總金額</span>
                            <span style={css.accent}>NT$ {totalAmount}</span>
                        </div>
                    </div>

                    {/* 付款方式 */}
                    <div className={`${S.card} mb-4`} style={css.surface}>
                        <p className="text-xs mb-1" style={css.muted}>付款方式</p>
                        <p className="font-semibold text-sm" style={css.text}>
                            {selectedPayment === 'bank_transfer' ? '銀行匯款' : '現金付款'}
                        </p>
                    </div>

                    {/* Contact summary */}
                    <div className={`${S.card} mb-6 space-y-2`} style={css.surface}>
                        <div>
                            <p className="text-xs mb-0.5" style={css.muted}>訂購人</p>
                            <p className="text-sm font-semibold" style={css.text}>{customerName}　{customerPhone}</p>
                        </div>
                        <div>
                            <p className="text-xs mb-0.5" style={css.muted}>收貨人</p>
                            <p className="text-sm font-semibold" style={css.text}>
                                {sameAsCustomer ? customerName : recipientName}　{sameAsCustomer ? customerPhone : recipientPhone}
                            </p>
                            {selectedPickup?.requires_address && recipientAddress.city && (
                                <p className="text-xs mt-0.5" style={css.muted}>{formatAddress(recipientAddress)}</p>
                            )}
                        </div>
                    </div>

                    {error && <p className="text-sm mb-3 text-center" style={{ color: '#C0392B' }}>{error}</p>}

                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={S.primaryBtn}
                        style={css.primary}
                    >
                        {submitting ? '送出中...' : '確認送出'}
                    </button>
                </div>
            </div>
        )
    }

    return null
}

export default function OrderPage() {
    return (
        <Suspense>
            <OrderPageInner />
        </Suspense>
    )
}
