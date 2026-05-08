import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    let query = supabase
        .from('sessions')
        .select(`
            id,
            title,
            opens_at,
            closes_at,
            per_person_limit,
            products (
                id,
                name,
                price,
                stock_qty,
                max_per_person,
                image_url
            )
        `)
        .eq('is_active', true)
        .or(`opens_at.is.null,opens_at.lte.${now}`)
        .or(`closes_at.is.null,closes_at.gte.${now}`)

    if (sessionId) {
        query = query.eq('id', sessionId)
    } else {
        query = query.order('created_at', { ascending: false }).limit(1)
    }

    const { data: session, error } = await query.single()

    if (error || !session) {
        return Response.json({ error: 'SESSION_NOT_ACTIVE' }, { status: 404 })
    }

    // actively apply active restock and get next restock
    const { data: nextRestockAt } = await supabase
        .rpc('apply_pending_restocks', { p_session_id: session.id })

    // re-query products to get new stock_qty
    const { data: products } = await supabase
        .from('products')
        .select('id, name, price, stock_qty, max_per_person, image_url')
        .eq('session_id', session.id)

    return Response.json({
        data: {
            ...session,
            products: products ?? session.products,
            next_restock_at: nextRestockAt ?? null,
        }
    })
}
