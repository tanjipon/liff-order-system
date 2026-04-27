import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase
            .from('pickup_options')
            .select('id, name, description, extra_fee, allowed_payment_methods')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        if (error) throw new Error(error.message)

        return Response.json({ data })
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 })
    }
}
