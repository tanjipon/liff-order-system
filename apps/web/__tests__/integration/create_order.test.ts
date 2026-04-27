import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function resetData() {
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('restock_items').delete().neq('restock_id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('session_restocks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

const SESSION_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const PRODUCT_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const PICKUP_OPTION_ID = 'cccccccc-0000-0000-0000-000000000001'

beforeEach(async () => {
    await resetData()
    // Reset stock
    await supabase.from('products').update({ stock_qty: 20 }).eq('id', PRODUCT_ID)
})

describe('create_order DB Function', () => {
    it('normal order: stock is correctly calculated', async () => {
        const { data: orderId, error } = await supabase.rpc('create_order', {
            p_session_id: SESSION_ID,
            p_line_user_id: 'U_test_001',
            p_display_name: 'test_user',
            p_items: [{ product_id: PRODUCT_ID, quantity: 2 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method: 'bank_transfer'
        })

        expect(error).toBeNull()
        expect(orderId).toBeTruthy()

        const { data: product } = await supabase
            .from('products')
            .select('stock_qty')
            .eq('id', PRODUCT_ID)
            .single()

        expect(product?.stock_qty).toBe(18)
    })

    it('Quota exceeded: return QUOTA_EXCEEDED', async () => {
        const { error } = await supabase.rpc('create_order', {
            p_session_id: SESSION_ID,
            p_line_user_id: 'U_test_002',
            p_display_name: 'test_user',
            p_items: [{ product_id: PRODUCT_ID, quantity: 999 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method: 'bank_transfer',
        })

        expect(error?.message).toContain('QUOTA_EXCEEDED')
    })

    it('Insufficient stock: return INSUFFICIENT_STOCK', async () => {
        await supabase.from('products').update({ stock_qty: 0 }).eq('id', PRODUCT_ID)

        const { error } = await supabase.rpc('create_order', {
            p_session_id: SESSION_ID,
            p_line_user_id: 'U_test_003',
            p_display_name: 'test_user',
            p_items: [{ product_id: PRODUCT_ID, quantity: 1 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method: 'bank_transfer',
        })

        expect(error?.message).toContain('INSUFFICIENT_STOCK')
    })

    it('session not active: return SESSION_NOT_ACTIVE', async () => {
        const { error } = await supabase.rpc('create_order', {
            p_session_id: '00000000-0000-0000-0000-000000000000', // 不存在的 session
            p_line_user_id: 'U_test_004',
            p_display_name: 'test_user',
            p_items: [{ product_id: PRODUCT_ID, quantity: 1 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method: 'bank_transfer',
        })

        expect(error?.message).toContain('SESSION_NOT_ACTIVE')
    })

    it('pickup_fee snapshot: pickup_fee correctly insert into orders', async () => {
        const { data: orderId } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_test_005',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 1 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'bank_transfer',
        })

        const { data: order } = await supabase
            .from('orders')
            .select('pickup_fee, pickup_option_id')
            .eq('id', orderId)
            .single()

        // extra_fee in pickup option should snapshot to orders.pickup_fee
        expect(order?.pickup_option_id).toBe(PICKUP_OPTION_ID)
        expect(typeof order?.pickup_fee).toBe('number')
    })

    it('pay in cash normal order', async () => {
        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_test_006',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 1 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'cash',
        })

        expect(error).toBeNull()
    })

    it('PICKUP_OPTION_NOT_FOUND: pickup option not exist', async () => {
        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_test_007',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 1 }],
            p_pickup_option_id: '00000000-0000-0000-0000-000000000000',
            p_payment_method:   'bank_transfer',
        })

        expect(error?.message).toContain('PICKUP_OPTION_NOT_FOUND')
    })
})