'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminFetch } from '@/lib/auth/adminClient'

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

    if (loading) return <div className="p-6">載入中...</div>
    if (error)   return <div className="p-6 text-red-500">{error}</div>
    if (!stats)  return null

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold">開單統計</h1>

            {/* Overview */}
            <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500">有效訂單數</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalOrders}</p>
                </div>
                <div className="border rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500">總金額</p>
                    <p className="text-3xl font-bold mt-1">NT$ {stats.totalAmount}</p>
                </div>
            </div>

            {/* each stats */}
            <div>
                <h2 className="text-lg font-semibold mb-3">訂單狀態分佈</h2>
                <div className="space-y-2">
                    {Object.entries(stats.statusCounts).map(([status, count]) => (
                        <div key={status} className="flex justify-between items-center border rounded px-4 py-2">
                            <span className="text-sm">{STATUS_LABEL[status] ?? status}</span>
                            <span className="font-medium">{count} 筆</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* product sale detail */}
            <div>
                <h2 className="text-lg font-semibold mb-3">商品售出明細</h2>
                {stats.productStats.length === 0 ? (
                    <p className="text-gray-400 text-sm">尚無售出資料</p>
                ) : (
                    <div className="space-y-2">
                        {stats.productStats.map(p => (
                            <div key={p.productId} className="border rounded px-4 py-3 flex justify-between items-center">
                                <p className="font-medium">{p.name}</p>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">售出 {p.totalQty} 件</p>
                                    <p className="text-sm font-medium">NT$ {p.totalRevenue}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
