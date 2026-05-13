import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SESSION_ID      = 'aaaaaaaa-0000-0000-0000-000000000001'
const PRODUCT_ID      = 'bbbbbbbb-0000-0000-0000-000000000001'
const PICKUP_OPTION_ID = 'cccccccc-0000-0000-0000-000000000001'

async function resetData() {
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('products').update({ stock_qty: 20, max_per_person: null }).eq('id', PRODUCT_ID)
    await supabase.from('sessions').update({ per_person_limit: null }).eq('id', SESSION_ID)
}

beforeEach(resetData)

afterAll(async () => {
    await supabase.from('sessions').update({ per_person_limit: 5 }).eq('id', SESSION_ID)
    await supabase.from('products').update({ max_per_person: null }).eq('id', PRODUCT_ID)
})

describe('create_order per-product quota 驗證', () => {
    it('max_per_person is NULL: no limit, order successfully', async () => {
        // null means unlimited, amount of 10 is ok
        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_pq_001',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 10 }],
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

    it('amount not reach max_per_person: order successfully', async () => {
        await supabase.from('products').update({ max_per_person: 3 }).eq('id', PRODUCT_ID)

        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_pq_002',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 3 }],
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

    it('amount exceed max_per_person: return PRODUCT_QUOTA_EXCEEDED', async () => {
        await supabase.from('products').update({ max_per_person: 2 }).eq('id', PRODUCT_ID)

        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_pq_003',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 3 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
        })

        expect(error?.message).toContain('PRODUCT_QUOTA_EXCEEDED')
    })

    it('total amount of multiple orders exceed max_per_person: return PRODUCT_QUOTA_EXCEEDED', async () => {
        await supabase.from('products').update({ max_per_person: 3 }).eq('id', PRODUCT_ID)

        // first order amount of 2
        await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_pq_004',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 2 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
        })

        // second order amount of 2, 4 in total, reach the limit of 3
        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_pq_004',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 2 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
        })

        expect(error?.message).toContain('PRODUCT_QUOTA_EXCEEDED')
    })

    it('cancelled order not inluded: buyable after cancelled', async () => {
        await supabase.from('products').update({ max_per_person: 2 }).eq('id', PRODUCT_ID)

        // reach the limit of 2
        const { data: orderId } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_pq_005',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 2 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
        })

        // cancel order
        await supabase.rpc('admin_cancel_order', {
            p_order_id: orderId,
            p_reason: 'test',
        })

        // able to reorder again
        const { error } = await supabase.rpc('create_order', {
            p_session_id:       SESSION_ID,
            p_line_user_id:     'U_pq_005',
            p_display_name:     'test_user',
            p_items:            [{ product_id: PRODUCT_ID, quantity: 2 }],
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
