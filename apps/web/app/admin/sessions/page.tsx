'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import { useMinLoading } from '@/hooks/useMinLoading'

type Session = {
    id: string
    title: string
    opens_at: string | null
    closes_at: string | null
    per_person_limit: number | null
    is_active: boolean
    created_at: string
}

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
    border: { borderColor: 'var(--color-admin-border)' },
} as const

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { combine } = useMinLoading(1000)
    const isLoading = combine(dataLoaded)

    useEffect(() => {
        adminFetch('/api/admin/sessions')
            .then(r => r.json())
            .then(body => {
                if (body.data) setSessions(body.data)
                else setError(body.error ?? '載入失敗')
            })
            .catch(() => setError('載入失敗'))
            .finally(() => setDataLoaded(true))
    }, [])

    if (isLoading) return <AdminSpinner />
    if (error) return <div className="p-8 text-sm" style={{ color: '#DC2626' }}>{error}</div>

    return (
        <div className="p-6 max-w-3xl mx-auto">

            {/* 頁首 */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold" style={css.text}>開單管理</h1>
                    <p className="text-sm mt-0.5" style={css.muted}>{sessions.length} 筆開單</p>
                </div>
                <Link
                    href="/admin/sessions/new"
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-admin-primary)' }}
                >
                    新增開單
                </Link>
            </div>

            {sessions.length === 0 ? (
                <div className="rounded-xl border p-12 text-center" style={css.surface}>
                    <p className="text-sm" style={css.muted}>尚未建立任何開單</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sessions.map((s) => (
                        <div key={s.id}
                            className="rounded-xl border p-4 flex items-center gap-3"
                            style={css.surface}>

                            {/* 狀態 badge */}
                            <div className="shrink-0">
                                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                                    style={s.is_active
                                        ? { backgroundColor: '#DCFCE7', color: '#166534' }
                                        : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                                    }>
                                    {s.is_active ? '進行中' : '已關閉'}
                                </span>
                            </div>

                            {/* 標題 + 日期 */}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm" style={css.text}>{s.title}</p>
                                <p className="text-xs mt-0.5" style={css.muted}>
                                    建立於 {new Date(s.created_at).toLocaleDateString('zh-TW')}
                                    {s.opens_at && `・開放 ${new Date(s.opens_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                                </p>
                            </div>

                            {/* 連結按鈕 */}
                            <div className="shrink-0 flex gap-2">
                                <Link
                                    href={`/admin/sessions/${s.id}`}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                                    style={css.surface}
                                >
                                    <span style={css.muted}>詳情</span>
                                </Link>
                                <Link
                                    href={`/admin/sessions/${s.id}/edit`}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                                    style={css.surface}
                                >
                                    <span style={css.muted}>編輯</span>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
