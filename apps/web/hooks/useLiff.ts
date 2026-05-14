'use client'

import { useEffect, useState } from 'react'

type LiffState = {
    ready: boolean
    token: string | null
    error: string | null
}

let initialized = false

export function useLiff(): LiffState {
    const [state, setState] = useState<LiffState>({
        ready: false,
        token: null,
        error: null,
    })

    useEffect(() => {
        // dev: skip LIFF init, use mock token
        if (process.env.NODE_ENV === 'development') {
            setState({ ready: true, token: 'mock-token', error: null })
            return
        }

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) {
            setState({ ready: true, token: null, error: 'LIFF ID 未設定' })
            return
        }

        if (initialized) {
            import('@line/liff').then(({ default: liff }) => {
                const token = liff.getAccessToken()
                setState({ ready: true, token, error: token ? null : '無法取得 LINE 登入狀態' })
            })
            return
        }

        import('@line/liff').then(async ({ default: liff }) => {
            try {
                await liff.init({ liffId })
                initialized = true
                if (!liff.isLoggedIn()) {
                    liff.login()
                    return
                }
                const token = liff.getAccessToken()
                setState({ ready: true, token, error: token ? null : '無法取得 LINE 登入狀態' })
            } catch (e: any) {
                setState({ ready: true, token: null, error: '登入失敗，請重試' })
            }
        })
    }, [])

    return state
}
