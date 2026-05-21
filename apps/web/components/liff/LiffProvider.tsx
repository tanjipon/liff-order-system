'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type LiffState = {
    ready: boolean
    token: string | null
    error: string | null
}

const LiffContext = createContext<LiffState>({ ready: false, token: null, error: null })

export function useLiff() {
    return useContext(LiffContext)
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<LiffState>({ ready: false, token: null, error: null })

    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            setState({ ready: true, token: 'mock-token', error: null })
            return
        }

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) {
            setState({ ready: true, token: null, error: 'LIFF ID 未設定' })
            return
        }

        import('@line/liff').then(async ({ default: liff }) => {
            try {
                await liff.init({ liffId })
                if (!liff.isLoggedIn()) {
                    liff.login()
                    return
                }
                const token = liff.getAccessToken()
                setState({ ready: true, token, error: token ? null : '無法取得 LINE 登入狀態' })
            } catch (e: any) {
                const msg = e?.code ? `${e.code}: ${e.message}` : (e?.message ?? '登入失敗，請重試')
                setState({ ready: true, token: null, error: msg })
            }
        })
    }, [])

    return <LiffContext.Provider value={state}>{children}</LiffContext.Provider>
}
