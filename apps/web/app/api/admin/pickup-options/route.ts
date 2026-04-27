import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'pickup_options:manage')

        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase
            .from('pickup_options')
            .select('id, name, description, extra_fee, allowed_payment_methods, is_active, sort_order')
            .order('sort_order', { ascending: true })

        if (error) throw new Error(error.message)

        return Response.json({ data })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'pickup_options:manage')

        const supabase = getSupabaseAdmin()
        const { name, description, extraFee, allowedPaymentMethods } = await req.json()

        if (!name) return errorResponse('MISSING_FIELDS', 400)

        const { data, error } = await supabase
            .from('pickup_options')
            .insert({
                name,
                description:              description ?? null,
                extra_fee:                extraFee ?? 0,
                allowed_payment_methods:  allowedPaymentMethods ?? null,
            })
            .select('id')
            .single()

        if (error) throw new Error(error.message)

        return Response.json({ data: { pickupOptionId: data.id } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

