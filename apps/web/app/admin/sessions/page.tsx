'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/auth/adminClient'

type Session = {
    id: string
    title: string
    opens_at: string | null
    closes_at: string | null
    per_person_limit: number | null
    is_active: boolean
    created_at: string
}

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        adminFetch('/api/admin/sessions')
            .then(r => r.json())
            .then(body => {
                if (body.data) setSessions(body.data)
                else setError(body.error ?? '載入失敗')
            })
            .catch(() => setError('載入失敗'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="p-6">載入中...</div>
    if (error)   return <div className="p-6 text-red-500">{error}</div>

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">開單管理</h1>
                
                <Link
                    href="/admin/sessions/new"
                    className="px-4 py-2 bg-blue-500 text-white rounded text-sm"
                >
                    新增開單
                </Link>
            </div>

            {sessions.length === 0 && (
                <p className="text-gray-400 text-center py-12">尚未建立任何開單</p>
            )}

            <div className="space-y-3">
                {sessions.map(s => (
                    <div key={s.id} className="border rounded-lg px-4 py-3 flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-medium">{s.title}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {s.is_active ? '進行中' : '已關閉'}
                                </span>
                            </div>
                            <p className="text-sm text-gray-400 mt-0.5">
                                {new Date(s.created_at).toLocaleDateString('zh-TW')}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Link
                                href={`/admin/sessions/${s.id}`}
                                className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                            >
                                詳情
                            </Link>
                            <Link
                                href={`/admin/sessions/${s.id}/edit`}
                                className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                            >
                                編輯
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
