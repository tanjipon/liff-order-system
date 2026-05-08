import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()

    const { data: sessions, error } = await supabase
        .from('sessions')
        .select('id, title, opens_at, closes_at, per_person_limit')
        .eq('is_active', true)
        .or(`closes_at.is.null,closes_at.gte.${now}`)
        .order('created_at', { ascending: false })

    if (error) {
        return Response.json({ error: 'LOAD_FAILED' }, { status: 500 })
    }

    return Response.json({ data: sessions ?? [] })
}
