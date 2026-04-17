import { NextRequest } from 'next/server'

export async function verifyLiffToken(req: NextRequest) {
    const token = req.headers.get('x-liff-token')
    if (!token) throw new Error('UNAUTHORIZED')

    // skip LINE verification in dev environment
    if (process.env.NODE_ENV === 'development' && token === 'mock-token') {
        return { userId: 'U_dev_mock', displayName: '開發測試用戶' }
    }

    const res = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error('UNAUTHORIZED')

    const profile = await res.json()
    return {
        userId: profile.userId as string,
        displayName: profile.displayName as string
    }
}