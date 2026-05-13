import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SESSION_ID     = 'aaaaaaaa-0000-0000-0000-000000000001'
const PRODUCT_ID     = 'bbbbbbbb-0000-0000-0000-000000000001'
const PICKUP_OPTION_ID = 'cccccccc-0000-0000-0000-000000000001'

async function resetOrders() {
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

// reset order before each test and reset session time to active
beforeEach(async () => {
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('products').update({ stock_qty: 20, max_per_person: null }).eq('id', PRODUCT_ID)
    await supabase.from('sessions').update({
        opens_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', SESSION_ID)
})


describe('create_order 時間條件驗證', () => {
    it('opens_at not reached: return SESSION_NOT_ACTIVE', async () => {
        // set opens_at future time
        await supabase.from('sessions').update({
            opens_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }).eq('id', SESSION_ID)

        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_time_001',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 1 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
        })

        expect(error?.message).toContain('SESSION_NOT_ACTIVE')
    })

    it('closes_at passed: return SESSION_NOT_ACTIVE', async () => {
        // set closes_at past time
        await supabase.from('sessions').update({
            closes_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        }).eq('id', SESSION_ID)

        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_time_002',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 1 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
        })

        expect(error?.message).toContain('SESSION_NOT_ACTIVE')
    })

    it('opens_at and closes_at are NULL: always active and successfully ordered', async () => {
        await supabase.from('sessions').update({
            opens_at: null,
            closes_at: null,
        }).eq('id', SESSION_ID)

        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_time_003',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 1 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
        })

        expect(error).toBeNull()
    })
})
