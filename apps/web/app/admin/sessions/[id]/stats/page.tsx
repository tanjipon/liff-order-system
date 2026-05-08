'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import AdminError from '@/components/admin/AdminError'
import Link from 'next/link'

type ProductStat = {
    productId: string
    name: string
    totalQty: number
    totalRevenue: number
}

type Stats = {
    totalOrders: number
    totalAmount: number
    statusCounts: Record<string, number>
    productStats: ProductStat[]
}

const STATUS_LABEL: Record<string, string> = {
    pending:           '待確認',
    in_production:     '製作中',
    pending_payment:   '待付款',
    payment_submitted: '付款確認中',
    completed:         '已完成',
    cancelled:         '已取消',
}

const STATUS_STYLE: Record<string, { backgroundColor: string; color: string }> = {
    pending:           { backgroundColor: '#FEF9C3', color: '#854D0E' },
    in_production:     { backgroundColor: '#DBEAFE', color: '#1E40AF' },
    pending_payment:   { backgroundColor: '#FFEDD5', color: '#9A3412' },
    payment_submitted: { backgroundColor: '#EDE9FE', color: '#5B21B6' },
    completed:         { backgroundColor: '#DCFCE7', color: '#166534' },
    cancelled:         { backgroundColor: '#F3F4F6', color: '#6B7280' },
}

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
    border: { borderColor: 'var(--color-admin-border)' },
} as const

export default function SessionStatsPage() {
    const { id } = useParams<{ id: string }>()
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        adminFetch(`/api/admin/sessions/${id}/stats`)
            .then(r => r.json())
            .then(body => {
                if (body.data) setStats(body.data)
                else setError(body.error ?? '載入失敗')
            })
            .catch(() => setError('載入失敗'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <AdminSpinner />
    if (error) return <AdminError error={error} />
    if (!stats) return null

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">

            {/* 頁首 */}
            <div className="flex items-center gap-3">
                <Link href={`/admin/sessions/${id}`}
                    className="text-sm px-3 py-1.5 rounded-lg border"
                    style={css.surface}>
                    <span style={css.muted}>← 返回</span>
                </Link>
                <h1 className="text-xl font-semibold" style={css.text}>開單統計</h1>
            </div>

            {/* 總覽數字 */}
            <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border p-5 text-center" style={css.surface}>
                    <p className="text-xs font-medium" style={css.muted}>有效訂單數</p>
                    <p className="text-3xl font-bold mt-2 tabular-nums" style={css.text}>
                        {stats.totalOrders}
                    </p>
                </div>
                <div className="rounded-xl border p-5 text-center" style={css.surface}>
                    <p className="text-xs font-medium" style={css.muted}>總金額</p>
                    <p className="text-3xl font-bold mt-2 tabular-nums" style={css.text}>
                        NT$ {stats.totalAmount.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* 訂單狀態分佈 */}
            <div>
                <h2 className="text-base font-semibold mb-3" style={css.text}>訂單狀態分佈</h2>
                <div className="rounded-xl border overflow-hidden" style={css.surface}>
                    {Object.entries(stats.statusCounts).map(([status, count], idx) => (
                        <div key={status}
                            className={`px-4 py-3 flex justify-between items-center ${idx !== 0 ? 'border-t' : ''}`}
                            style={idx !== 0 ? css.border : {}}>
                            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                                style={STATUS_STYLE[status] ?? { backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                                {STATUS_LABEL[status] ?? status}
                            </span>
                            <span className="text-sm font-semibold tabular-nums" style={css.text}>
                                {count} 筆
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 商品售出明細 */}
            <div>
                <h2 className="text-base font-semibold mb-3" style={css.text}>商品售出明細</h2>
                {stats.productStats.length === 0 ? (
                    <div className="rounded-xl border p-8 text-center" style={css.surface}>
                        <p className="text-sm" style={css.muted}>尚無售出資料</p>
                    </div>
                ) : (
                    <div className="rounded-xl border overflow-hidden" style={css.surface}>
                        {stats.productStats.map((p, idx) => (
                            <div key={p.productId}
                                className={`px-4 py-3 flex justify-between items-center ${idx !== 0 ? 'border-t' : ''}`}
                                style={idx !== 0 ? css.border : {}}>
                                <p className="font-semibold text-sm" style={css.text}>{p.name}</p>
                                <div className="text-right">
                                    <p className="text-xs tabular-nums" style={css.muted}>售出 {p.totalQty} 件</p>
                                    <p className="text-sm font-bold tabular-nums" style={css.text}>
                                        NT$ {p.totalRevenue.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
