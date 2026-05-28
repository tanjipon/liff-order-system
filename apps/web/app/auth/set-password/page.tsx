'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function PasswordInput({ placeholder, value, onChange }: {
    placeholder: string
    value: string
    onChange: (v: string) => void
}) {
    const [visible, setVisible] = useState(false)
    return (
        <div className="relative">
            <input
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                required
                className="w-full border rounded px-3 py-2 pr-9 text-sm"
            />
            <button
                type="button"
                onClick={() => setVisible(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
            >
                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    )
}

export default function SetPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.SyntheticEvent) {
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
                    <PasswordInput
                        placeholder="新密碼（至少 8 個字元）"
                        value={password}
                        onChange={setPassword}
                    />
                    <PasswordInput
                        placeholder="確認密碼"
                        value={confirm}
                        onChange={setConfirm}
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
