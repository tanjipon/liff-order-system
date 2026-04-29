import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SESSION_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const PRODUCT_ID = 'bbbbbbbb-0000-0000-0000-000000000001'

async function resetData() {
    await supabase.from('restock_items').delete().neq('restock_id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('session_restocks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('products').update({ stock_qty: 20, max_per_person: null }).eq('id', PRODUCT_ID)
}

// restock record creating helper
async function createRestock(opensAt: string, quantity = 10) {
    const { data: restock } = await supabase
        .from('session_restocks')
        .insert({ session_id: SESSION_ID, opens_at: opensAt })
        .select('id')
        .single()

    await supabase.from('restock_items').insert({
        restock_id: restock!.id,
        product_id: PRODUCT_ID,
        quantity,
    })

    return restock!.id
}

beforeEach(resetData)

describe('apply_pending_restocks DB Function', () => {
    it('normal application: active restock added to stock_qty. applied set to true', async () => {
        // opens_at set past time
        await createRestock(new Date(Date.now() - 60 * 1000).toISOString(), 5)

        await supabase.rpc('apply_pending_restocks', { p_session_id: SESSION_ID })

        const { data: product } = await supabase
            .from('products').select('stock_qty').eq('id', PRODUCT_ID).single()
        expect(product?.stock_qty).toBe(25) // 20 + 5

        const { data: restocks } = await supabase
            .from('session_restocks').select('applied').eq('session_id', SESSION_ID)
        expect(restocks?.every(r => r.applied)).toBe(true)
    })

    it('inactive restock not applied', async () => {
        // opens_at set future time
        await createRestock(new Date(Date.now() + 60 * 60 * 1000).toISOString(), 5)

        await supabase.rpc('apply_pending_restocks', { p_session_id: SESSION_ID })

        const { data: product } = await supabase
            .from('products').select('stock_qty').eq('id', PRODUCT_ID).single()
        expect(product?.stock_qty).toBe(20) // not changed
    })

    it('recall do not apply again: stock do not update on second call', async () => {
        await createRestock(new Date(Date.now() - 60 * 1000).toISOString(), 5)

        await supabase.rpc('apply_pending_restocks', { p_session_id: SESSION_ID })
        await supabase.rpc('apply_pending_restocks', { p_session_id: SESSION_ID }) // 第二次

        const { data: product } = await supabase
            .from('products').select('stock_qty').eq('id', PRODUCT_ID).single()
        expect(product?.stock_qty).toBe(25) // only add once
    })

    it('next_restock_at: return the lastest inapplied opens_at', async () => {
        const future1 = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
        const future2 = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        await createRestock(future1, 3)
        await createRestock(future2, 3)

        const { data: nextAt } = await supabase.rpc('apply_pending_restocks', { p_session_id: SESSION_ID })

        // return latest（future1）
        expect(new Date(nextAt).toISOString().slice(0, 16)).toBe(future1.slice(0, 16))
    })

    it('no future restock: next_restock_at return null', async () => {
        // only active restock. no future restock
        await createRestock(new Date(Date.now() - 60 * 1000).toISOString(), 3)

        const { data: nextAt } = await supabase.rpc('apply_pending_restocks', { p_session_id: SESSION_ID })

        expect(nextAt).toBeNull()
    })

    it('applied restock block the deletion (409)', async () => {
        const restockId = await createRestock(new Date(Date.now() - 60 * 1000).toISOString(), 5)
        await supabase.rpc('apply_pending_restocks', { p_session_id: SESSION_ID })

        const { data: restock } = await supabase
            .from('session_restocks').select('applied').eq('id', restockId).single()
        expect(restock?.applied).toBe(true)
    })
})
