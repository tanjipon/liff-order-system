import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SESSION_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const PRODUCT_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const PICKUP_OPTION_ID = 'cccccccc-0000-0000-0000-000000000001'

async function resetData() {
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

async function createTestOrder(lineUserId: string, quantity: number) {
    const { data: orderId, error } = await supabase.rpc('create_order', {
        p_session_id: SESSION_ID,
        p_line_user_id: lineUserId,
        p_display_name: 'test_user',
        p_items: [{ product_id: PRODUCT_ID, quantity }],
        p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method: 'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
    })
    if (error) throw new Error(error.message)
    return orderId as string
}

beforeEach(async () => {
    await resetData()
    await supabase.from('products').update({ stock_qty: 20, max_per_person: null }).eq('id', PRODUCT_ID)
})

describe('admin_cancel_order DB Function', () => {
    it('Release quota after cancelling order', async () => {
        const orderId = await createTestOrder('U_cancel_001', 3)

        // quota is expected to be 17 after order
        const { data: before } = await supabase
            .from('products').select('stock_qty').eq('id', PRODUCT_ID).single()
        expect(before?.stock_qty).toBe(17)

        const { error } = await supabase.rpc('admin_cancel_order', {
            p_order_id: orderId,
            p_reason: 'test cancel',
        })
        expect(error).toBeNull()

        // quota is expected to be 20 after cancelling
        const { data: after } = await supabase
            .from('products').select('stock_qty').eq('id', PRODUCT_ID).single()
        expect(after?.stock_qty).toBe(20)
    })

    it('Order cacanlled and uota released. The client can order again.', async () => {
        const orderId = await createTestOrder('U_cancel_002', 2)

        await supabase.rpc('admin_cancel_order', {
            p_order_id: orderId,
            p_reason: 'test cancel',
        })

        // order after cancelling is not expected to be blocked by quota limitation
        const { error } = await supabase.rpc('create_order', {
            p_session_id: SESSION_ID,
            p_line_user_id: 'U_cancel_002',
            p_display_name: 'test_user',
            p_items: [{ product_id: PRODUCT_ID, quantity: 2 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method: 'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
        })
        expect(error).toBeNull()
    })

    it('payment_submitted status cannot be cancelled', async () => {
        const orderId = await createTestOrder('U_cancel_003', 1)

        // Force the order status to be payment_submitted
        await supabase
            .from('orders')
            .update({ status: 'payment_submitted' })
            .eq('id', orderId)

        const { error } = await supabase.rpc('admin_cancel_order', {
            p_order_id: orderId,
            p_reason: 'test cancel',
        })
        expect(error?.message).toContain('CANNOT_CANCEL_PAYMENT_SUBMITTED')
    })

    it('completed status cannot be cancelled', async () => {
        const orderId = await createTestOrder('U_cancel_004', 1)

        await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', orderId)

        const { error } = await supabase.rpc('admin_cancel_order', {
            p_order_id: orderId,
            p_reason: 'test cancel',
        })
        expect(error?.message).toContain('ORDER_ALREADY_FINALIZED')
    })
})