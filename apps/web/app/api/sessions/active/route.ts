import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const now = new Date().toISOString()

    const { data: session, error } = await supabase
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
                stock_qty
            )    
        `)
        .eq('is_active', true)
        .or(`opens_at.is.null,opens_at.lte.${now}`)
        .or(`closes_at.is.null,closes_at.gte.${now}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error || !session) {
        return Response.json({ error: 'SESSION_NOT_ACTIVE' }, { status: 404 })
    }

    return Response.json({ data: session })
}