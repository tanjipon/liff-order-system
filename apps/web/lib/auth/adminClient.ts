import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getAdminToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        window.location.href = '/admin/login'
        return ''
    }
    return session.access_token
}

export async function adminFetch(url: string, options: RequestInit = {}) {
    const token = await getAdminToken()
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
    })
    if (res.status === 401) throw new Error('UNAUTHORIZED')
    if (res.status === 403) throw new Error('FORBIDDEN')
    return res
}