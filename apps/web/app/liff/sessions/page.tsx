'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LiffLoader from '@/components/liff/LiffLoader'
import { useMinLoading } from '@/hooks/useMinLoading'

type Session = {
    id: string
    title: string
    opens_at: string | null
    closes_at: string | null
    per_person_limit: number | null
}

const S = {
    outer: 'min-h-screen w-full',
    inner: 'p-4 max-w-md mx-auto',
} as const

const css = {
    bg: { backgroundColor: 'var(--color-liff-bg)' },
    surface: { backgroundColor: 'var(--color-liff-surface)', borderColor: 'var(--color-liff-border)' },
    primary: { backgroundColor: 'var(--color-liff-primary)' },
    text: { color: 'var(--color-liff-text)' },
    muted: { color: 'var(--color-liff-muted)' },
    warnBg: { backgroundColor: '#FFF3CD', color: '#856404' },
} as const

function formatCountdown(targetIso: string, now: number): string {
    const msLeft = new Date(targetIso).getTime() - now
    if (msLeft <= 0) return '即將開放'
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

export default function SessionsPage() {
    const router = useRouter()
    const [sessions, setSessions] = useState<Session[]>([])
    const [dataLoaded, setDataLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [now, setNow] = useState(() => Date.now())

    const { combine } = useMinLoading(1500)
    const isLoading = combine(dataLoaded)

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        fetch('/api/sessions')
            .then(res => res.json())
            .then(body => {
                if (body.data) setSessions(body.data)
                else setError('載入失敗，請稍後再試')
            })
            .catch(() => setError('載入失敗，請稍後再試'))
            .finally(() => setDataLoaded(true))
    }, [])

    if (isLoading) return <LiffLoader />

    return (
        <div className={S.outer} style={css.bg}>
            <div className={S.inner}>

                {/* 頁首 */}
                <div className="pt-6 pb-4 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={css.text}>選擇訂購項目</h1>
                        <p className="text-sm mt-1" style={css.muted}>請選擇您要訂購的開單</p>
                    </div>
                    <button
                        onClick={() => router.push('/liff/status')}
                        className="mt-1 text-sm px-3 py-1.5 rounded-xl border shrink-0"
                        style={css.surface}
                    >
                        <span style={css.muted}>我的訂單</span>
                    </button>
                </div>

                {error && (
                    <div className="rounded-2xl p-4 text-sm text-center"
                        style={{ backgroundColor: '#FFE8ED', color: '#C0392B' }}>
                        {error}
                    </div>
                )}

                {!error && sessions.length === 0 && (
                    <div className="p-8 text-center">
                        <p className="text-sm" style={css.muted}>目前沒有開放中的訂單</p>
                    </div>
                )}

                <div className="space-y-3">
                    {sessions.map(s => {
                        const notOpenYet = s.opens_at && new Date(s.opens_at).getTime() > now

                        return (
                            <button
                                key={s.id}
                                onClick={() => !notOpenYet && router.push(`/liff/order?sessionId=${s.id}`)}
                                className="w-full rounded-2xl border p-4 text-left transition-opacity"
                                style={{
                                    ...css.surface,
                                    cursor: notOpenYet ? 'default' : 'pointer',
                                    opacity: notOpenYet ? 0.85 : 1,
                                }}
                            >
                                <p className="font-bold text-base" style={css.text}>{s.title}</p>

                                {/* 尚未開放 - 倒數 */}
                                {notOpenYet && (
                                    <div className="mt-2 rounded-xl px-3 py-2 text-sm font-medium tabular-nums"
                                        style={css.warnBg}>
                                        開放倒數：{formatCountdown(s.opens_at!, now)}
                                    </div>
                                )}

                                <div className="mt-1.5 space-y-0.5">
                                    {s.closes_at && (
                                        <p className="text-xs" style={css.muted}>
                                            截止：{new Date(s.closes_at).toLocaleString('zh-TW', {
                                                month: 'numeric', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    )}
                                    {s.per_person_limit && (
                                        <p className="text-xs" style={css.muted}>
                                            每人上限：{s.per_person_limit} 件
                                        </p>
                                    )}
                                </div>

                                {!notOpenYet && (
                                    <div className="mt-3 flex justify-end">
                                        <span className="text-xs font-bold px-3 py-1.5 rounded-xl text-white"
                                            style={css.primary}>
                                            立即訂購 →
                                        </span>
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>

            </div>
        </div>
    )
}
