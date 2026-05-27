'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function CallbackHandler() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function handle() {
            const code = searchParams.get('code')

            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code)
                if (error) {
                    setError('邀請連結已過期，請聯絡管理員重新寄送邀請信')
                    return
                }
            }

            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                setError('驗證失敗，請聯絡管理員重新寄送邀請信')
                return
            }

            router.replace('/auth/set-password')
        }

        handle()
    }, [router, searchParams])

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white rounded-lg shadow p-8 w-full max-w-sm text-center space-y-4">
                    <p className="text-sm text-red-500">{error}</p>
                    <a href="/admin/login" className="text-sm text-blue-600 underline">返回登入頁</a>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <p className="text-sm text-gray-500">驗證中，請稍候…</p>
        </div>
    )
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-sm text-gray-500">載入中…</p>
            </div>
        }>
            <CallbackHandler />
        </Suspense>
    )
}
