import { NextRequest } from 'next/server'

export async function verifyLiffToken(req: NextRequest) {
    const token = req.headers.get('x-liff-token')
    if (!token) throw new Error('UNAUTHORIZED')

    const res = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error('UNAUTHORIZED')

    const profile = await res.json()
    return {
        userId:         profile.userId as string,
        displayName:    profile.displayName as string
    }
}