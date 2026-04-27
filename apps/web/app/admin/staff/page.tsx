'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/auth/adminClient'

type StaffMember = {
    userId: string
    displayName: string
    email: string
    isActive: boolean
    role: { id: string; name: string }
}

export default function StaffPage() {
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    async function loadStaff() {
        try {
            const res = await adminFetch('/api/admin/staff')
            const body = await res.json()
            if (body.data) setStaff(body.data)
            else setError(body.error ?? '載入失敗')
        } catch {
            setError('載入失敗')
        } finally {
            setLoading(false)
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

    if (loading) return <div className="p-6">載入中...</div>
    if (error)   return <div className="p-6 text-red-500">{error}</div>

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">人員管理</h1>
                <Link
                    href="/admin/staff/new"
                    className="px-4 py-2 bg-blue-500 text-white rounded text-sm"
                >
                    新增人員
                </Link>
            </div>

            {staff.length === 0 && (
                <p className="text-gray-400 text-center py-12">尚無人員資料</p>
            )}

            <div className="space-y-3">
                {staff.map(s => (
                    <div key={s.userId} className="border rounded-lg px-4 py-3 flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-medium">{s.displayName}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {s.isActive ? '啟用中' : '已停用'}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                                    {s.role?.name}
                                </span>
                            </div>
                            <p className="text-sm text-gray-400 mt-0.5">{s.email}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleResendInvite(s.userId)}
                                className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                            >
                                重送邀請
                            </button>
                            {s.isActive ? (
                                <button
                                    onClick={() => handleDeactivate(s.userId)}
                                    className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm"
                                >
                                    停用
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleActivate(s.userId)}
                                    className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm"
                                >
                                    啟用
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
