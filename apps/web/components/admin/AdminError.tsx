'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MdLock, MdBlock, MdWarning } from 'react-icons/md'

export default function AdminError({ error, onRetry }: { error: string; onRetry?: () => void }) {
    const router = useRouter()
    const isUnauthorized = error === 'UNAUTHORIZED'
    const isForbidden = error === 'FORBIDDEN'
    const [countdown, setCountdown] = useState(3)

    useEffect(() => {
        if (!isUnauthorized) return
        const interval = setInterval(() => setCountdown(c => c - 1), 1000)
        const timeout = setTimeout(() => router.push('/admin/login'), 3000)
        return () => { clearInterval(interval); clearTimeout(timeout) }
    }, [isUnauthorized, router])

    return (
        <div className="flex items-center justify-center min-h-[300px] p-8">
            <div className="max-w-sm w-full rounded-2xl border p-8 text-center space-y-4"
                style={{ backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' }}>

                {isUnauthorized ? (
                    <>
                        <div className="flex justify-center">
                            <MdLock className="w-12 h-12" style={{ color: 'var(--color-admin-muted)' }} />
                        </div>
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-admin-text)' }}>
                            請重新登入
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--color-admin-muted)' }}>
                            登入狀態已過期，請重新登入
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-admin-muted)' }}>
                            {countdown} 秒後自動跳轉...
                        </p>
                        <button
                            onClick={() => router.push('/admin/login')}
                            className="w-full py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
                            style={{ backgroundColor: 'var(--color-admin-primary)' }}>
                            立即前往登入
                        </button>
                    </>
                ) : isForbidden ? (
                    <>
                        <div className="flex justify-center">
                            <MdBlock className="w-12 h-12" style={{ color: 'var(--color-admin-muted)' }} />
                        </div>
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-admin-text)' }}>
                            權限不足
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--color-admin-muted)' }}>
                            您的帳號沒有執行此操作的權限
                        </p>
                        <button
                            onClick={() => router.back()}
                            className="w-full py-2 rounded-lg text-sm border cursor-pointer"
                            style={{ borderColor: 'var(--color-admin-border)', color: 'var(--color-admin-muted)' }}>
                            返回
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex justify-center">
                            <MdWarning className="w-12 h-12" style={{ color: 'var(--color-admin-muted)' }} />
                        </div>
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-admin-text)' }}>
                            發生錯誤
                        </h2>
                        <p className="text-sm font-mono" style={{ color: '#DC2626' }}>{error}</p>
                        <div className="flex gap-2">
                            {onRetry && (
                                <button
                                    onClick={onRetry}
                                    className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                                    style={{ backgroundColor: 'var(--color-admin-primary)' }}>
                                    重試
                                </button>
                            )}
                            <button
                                onClick={() => router.back()}
                                className="flex-1 py-2 rounded-lg text-sm border cursor-pointer"
                                style={{ borderColor: 'var(--color-admin-border)', color: 'var(--color-admin-muted)' }}>
                                返回
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
