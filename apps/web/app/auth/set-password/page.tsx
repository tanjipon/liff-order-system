'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SetPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (password.length < 8) {
            setError('密碼至少需要 8 個字元')
            return
        }
        if (password !== confirm) {
            setError('兩次輸入的密碼不一致')
            return
        }

        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            setError('設定失敗，請再試一次')
            setLoading(false)
            return
        }

        await supabase.auth.signOut()
        router.replace('/admin/login?setup=done')
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white rounded-lg shadow p-8 w-full max-w-sm space-y-4">
                <h1 className="text-xl font-bold text-center">設定密碼</h1>
                <p className="text-sm text-gray-500 text-center">請為你的帳號設定一組登入密碼</p>

                {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                        type="password"
                        placeholder="新密碼（至少 8 個字元）"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                    <input
                        type="password"
                        placeholder="確認密碼"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={loading || !password || !confirm}
                        className="w-full py-2 bg-gray-800 text-white rounded text-sm disabled:opacity-40 cursor-pointer"
                    >
                        {loading ? '設定中...' : '確認設定'}
                    </button>
                </form>
            </div>
        </div>
    )
}
