import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')

        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase
            .from('session_pickup_options')
            .select(`
                id,
                sort_order,
                pickup_options ( id, name, description, extra_fee, allowed_payment_methods, requires_address, is_active )
            `)
            .eq('session_id', sessionId)
            .order('sort_order', { ascending: true })

        if (error) throw new Error(error.message)

        return Response.json({ data })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')

        const supabase = getSupabaseAdmin()
        const { pickupOptionId } = await req.json()

        if (!pickupOptionId) return errorResponse('MISSING_FIELD', 400)

        const { data, error } = await supabase
            .from('session_pickup_options')
            .insert({ session_id: sessionId, pickup_option_id: pickupOptionId })
            .select('id')
            .single()

        if (error) throw new Error(error.message)

        return Response.json({ data: { id: data.id } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
