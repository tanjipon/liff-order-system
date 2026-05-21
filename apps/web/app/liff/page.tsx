'use client'

import { useLiff } from '@/components/liff/LiffProvider'

// This page serves as the LIFF entry point.
// When LIFF redirects here with ?liff.state=%2Fpath, the SDK handles
// the secondary redirect to /liff/path automatically during liff.init().
export default function LiffIndexPage() {
    const { error } = useLiff()

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-liff-bg">
                <p className="text-liff-muted text-sm">{error}</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-liff-bg">
            <p className="text-liff-muted text-sm">載入中…</p>
        </div>
    )
}
