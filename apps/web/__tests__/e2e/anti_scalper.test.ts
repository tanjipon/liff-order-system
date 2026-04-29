import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRODUCT_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const PICKUP_OPTION_ID = 'cccccccc-0000-0000-0000-000000000001'
const SESSION_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const LINE_USER_ID = 'U_dev_mock'  // verifyLiff.ts dev bypass

test.beforeEach(async () => {
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('products').update({ stock_qty: 20, max_per_person: null }).eq('id', PRODUCT_ID)
})

test('anti scalper: limit reached', async ({ page }) => {
    // 1. create an order reach quota limit（quantity of 5）
    await supabase.rpc('create_order', {
        p_session_id: SESSION_ID,
        p_line_user_id: LINE_USER_ID,
        p_display_name: 'dev_user',
        p_items: [{ product_id: PRODUCT_ID, quantity: 5 }],
        p_pickup_option_id: PICKUP_OPTION_ID,
        p_payment_method: 'bank_transfer',
    })

    // 2. open order page
    await page.goto('/liff/order')
    await expect(page.getByText('草莓塔')).toBeVisible()

    // 3. check "已達上限" is shown
    await expect(page.getByText('已選 5 件')).toBeVisible()

    // 4. check all + buttons are disabled（quota reach the limit）
    const plusButtons = page.getByRole('button', { name: '+' })
    const count = await plusButtons.count()
    for (let i = 0; i < count; i++) {
        await expect(plusButtons.nth(i)).toBeDisabled()
    }
})

test('reorder is available after cancelled', async ({ page }) => {
    // 1. create an order with quantity of 2
    const { data: orderId } = await supabase.rpc('create_order', {
        p_session_id: SESSION_ID,
        p_line_user_id: LINE_USER_ID,
        p_display_name: 'dev_user',
        p_items: [{ product_id: PRODUCT_ID, quantity: 2 }],
        p_pickup_option_id: PICKUP_OPTION_ID,
        p_payment_method: 'bank_transfer',
    })

    // 2. open search page to check the order existence
    await page.goto('/liff/status')
    await expect(page.getByText('待確認')).toBeVisible()

    // 3. cancel order
    await page.getByText('取消訂單').click()
    await page.getByText('確認取消').click()

    // 4. reload page and check the order is cancelled
    await expect(page.getByText('已取消')).toBeVisible()

    // 5. back to order page and order again
    await page.goto('/liff/order')
    const strawberryRow = page.getByTestId(`product-${PRODUCT_ID}`)
    await strawberryRow.getByRole('button', { name: '+' }).click()
    await strawberryRow.getByRole('button', { name: '+' }).click()
    await expect(page.getByText('已選 2 件')).toBeVisible()

    // 6. check the availability of submit button
    const submitBtn = page.getByRole('button', { name: /送出訂單/ })
    await expect(submitBtn).not.toBeDisabled()
})