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
        assertPermission(ctx, 'restocks:manage')
        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase
            .from('session_restocks')
            .select(`
                id,
                opens_at,
                is_active,
                applied,
                created_at,
                restock_items (
                    product_id,
                    quantity,
                    products ( name )
                )
            `)
            .eq('session_id', sessionId)
            .order('opens_at', { ascending: true })

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
        assertPermission(ctx, 'restocks:manage')
        const supabase = getSupabaseAdmin()

        // items: [{ productId: string, quantity: number }]
        const { opensAt, items } = await req.json()

        if (!opensAt || !Array.isArray(items) || items.length === 0) {
            return errorResponse('MISSING_FIELDS', 400)
        }

        // create session_restocks main record
        const { data: restock, error: restockError } = await supabase
            .from('session_restocks')
            .insert({ session_id: sessionId, opens_at: opensAt })
            .select('id')
            .single()

        if (restockError) throw new Error(restockError.message)

        // create restock_items detail
        const { error: itemsError } = await supabase
            .from('restock_items')
            .insert(
                items.map((item: { productId: string; quantity: number }) => ({
                    restock_id: restock.id,
                    product_id: item.productId,
                    quantity:   item.quantity,
                }))
            )

        if (itemsError) throw new Error(itemsError.message)

        return Response.json({ data: { restockId: restock.id } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
