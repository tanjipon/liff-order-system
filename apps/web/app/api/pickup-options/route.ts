import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const supabase = getSupabaseAdmin()
        const { searchParams } = new URL(req.url)
        const sessionId = searchParams.get('sessionId')

        if (!sessionId) {
            return Response.json({ error: 'MISSING_SESSION_ID' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('session_pickup_options')
            .select(`
                sort_order,
                pickup_options ( id, name, description, extra_fee, allowed_payment_methods, requires_address )
            `)
            .eq('session_id', sessionId)
            .order('sort_order', { ascending: true })

        if (error) throw new Error(error.message)

        const pickupOptions = (data ?? [])
            .map(row => row.pickup_options)
            .filter(Boolean)

        return Response.json({ data: pickupOptions })
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 })
    }
}
