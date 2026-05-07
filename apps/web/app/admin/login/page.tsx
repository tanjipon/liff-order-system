'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleLogin() {
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError('Email或密碼錯誤')
            setLoading(false)
            return
        }

        window.location.href = '/admin'
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white rounded-lg shadow p-8 w-full max-w-sm space-y-4">
                <h1 className="text-xl font-bold text-center">後台登入</h1>

                {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <div className="space-y-3">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                    <input
                        type="password"
                        placeholder="密碼"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                    <button
                        onClick={handleLogin}
                        disabled={loading || !email || !password}
                        className="w-full py-2 bg-gray-800 text-white rounded text-sm disabled:opacity-40 cursor-pointer"
                    >
                        {loading ? '登入中...' : '登入'}
                    </button>
                </div>
            </div>
        </div>
    )
}