import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export default function LiffError({ error, backHref }: { error: string; backHref?: string }) {
    const router = useRouter()

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-6"
            style={{ backgroundColor: 'var(--color-liff-bg)' }}>
            <div className="max-w-sm w-full rounded-2xl border p-8 text-center space-y-4"
                style={{ backgroundColor: 'var(--color-liff-surface)', borderColor: 'var(--color-liff-border)' }}>
                <div className="flex justify-center">
                    <AlertCircle className="w-12 h-12" style={{ color: 'var(--color-liff-muted)' }} />
                </div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-liff-text)' }}>
                    發生錯誤
                </h2>
                <p className="text-sm" style={{ color: '#C0392B' }}>{error}</p>
                {backHref && (
                    <button
                        onClick={() => router.push(backHref)}
                        className="w-full py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
                        style={{ backgroundColor: 'var(--color-liff-primary)' }}>
                        返回
                    </button>
                )}
            </div>
        </div>
    )
}
