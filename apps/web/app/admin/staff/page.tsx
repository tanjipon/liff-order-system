'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import AdminError from '@/components/admin/AdminError'
import { useMinLoading } from '@/hooks/useMinLoading'

type StaffMember = {
    userId: string
    displayName: string
    email: string
    isActive: boolean
    emailConfirmed: boolean
    role: { id: string; name: string }
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

export default function StaffPage() {
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { combine } = useMinLoading(1000)
    const isLoading = combine(dataLoaded)

    async function loadStaff() {
        try {
            const res = await adminFetch('/api/admin/staff')
            const body = await res.json()
            if (body.data) setStaff(body.data)
            else setError(body.error ?? '載入失敗')
        } catch {
            setError('載入失敗')
        } finally {
            setDataLoaded(true)
        }
    }

    useEffect(() => { loadStaff() }, [])

    async function handleDeactivate(userId: string) {
        if (!confirm('確定要停用此帳號？')) return
        await adminFetch(`/api/admin/staff/${userId}/deactive`, { method: 'PATCH' })
        loadStaff()
    }

    async function handleActivate(userId: string) {
        await adminFetch(`/api/admin/staff/${userId}/active`, { method: 'PATCH' })
        loadStaff()
    }

    async function handleResendInvite(userId: string) {
        await adminFetch(`/api/admin/staff/${userId}/resend-invite`, { method: 'POST' })
        alert('邀請信已重新寄出')
    }

    if (isLoading) return <AdminSpinner />
    if (error) return <AdminError error={error} onRetry={loadStaff} />

    return (
        <div className="p-6 max-w-3xl mx-auto">

            {/* 頁首 */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold" style={css.text}>人員管理</h1>
                    <p className="text-sm mt-0.5" style={css.muted}>{staff.length} 位人員</p>
                </div>
                <Link
                    href="/admin/staff/new"
                    className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${btn.solid}`}
                    style={{ backgroundColor: 'var(--color-admin-primary)' }}
                >
                    新增人員
                </Link>
            </div>

            {staff.length === 0 ? (
                <div className="rounded-xl border p-12 text-center" style={css.surface}>
                    <p className="text-sm" style={css.muted}>尚無人員資料</p>
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden" style={css.surface}>
                    {staff.map((s, idx) => (
                        <div key={s.userId}
                            className={`p-4 flex flex-wrap md:flex-nowrap items-center gap-3 ${idx !== 0 ? 'border-t' : ''}`}
                            style={idx !== 0 ? css.border : {}}>

                            {/* 狀態 badge */}
                            <div className="shrink-0">
                                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                                    style={s.isActive
                                        ? { backgroundColor: '#DCFCE7', color: '#166534' }
                                        : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                                    }>
                                    {s.isActive ? '啟用中' : '已停用'}
                                </span>
                            </div>

                            {/* 姓名 + email + 角色 */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm" style={css.text}>{s.displayName}</p>
                                    {s.role?.name && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                            style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                                            {s.role.name}
                                        </span>
                                    )}
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={s.emailConfirmed
                                            ? { backgroundColor: '#DCFCE7', color: '#166534' }
                                            : { backgroundColor: '#FEF9C3', color: '#854D0E' }
                                        }>
                                        {s.emailConfirmed ? '已確認信箱' : '待確認信箱'}
                                    </span>
                                </div>
                                <p className="text-xs mt-0.5 truncate" style={css.muted}>{s.email}</p>
                            </div>

                            {/* 操作按鈕 */}
                            <div className="shrink-0 flex gap-2">
                                <button
                                    onClick={() => handleResendInvite(s.userId)}
                                    disabled={s.emailConfirmed}
                                    className={`px-3 py-1.5 rounded-lg text-xs border ${btn.surface} disabled:opacity-40 disabled:cursor-not-allowed`}
                                    style={css.surface}>
                                    <span style={css.muted}>重送邀請</span>
                                </button>
                                {s.isActive ? (
                                    <button
                                        onClick={() => handleDeactivate(s.userId)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${btn.solid}`}
                                        style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                                        停用
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleActivate(s.userId)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${btn.solid}`}
                                        style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>
                                        啟用
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
