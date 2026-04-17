export function errorResponse(code: string, status = 400) {
    const messages: Record<string, string> = {
        UNAUTHORIZED: '請透過 LINE 開啟此頁面',
        FORBIDDEN: '無操作權限',
        ACCOUNT_DISABLED: '此帳號已停用，請聯絡管理員',
        QUOTA_EXCEEDED: '已超過本次開單每人購買上限',
        INSUFFICIENT_STOCK: '商品庫存不足',
        SESSION_NOT_ACTIVE: '目前沒有開放中的開單',
        ORDER_NOT_FOUND: '找不到此訂單',
        CANNOT_CANCEL_PAYMENT_SUBMITTED: '付款確認中的訂單無法取消',
        ORDER_ALREADY_FINALIZED: '此訂單已結束',
        INVALID_TRANSITION: '此訂單狀態不允許此操作',
        CANNOT_DEACTIVATE_SELF: '無法停用自己的帳號',
        CREATE_USER_FAILED: '建立帳號失敗，請確認 Email 是否已被使用',
        ROLE_NOT_FOUND: '找不到此角色',
        CANNOT_DELETE_OWNER_ROLE: '無法刪除 owner 角色',
        PICKUP_OPTION_NOT_FOUND: '取貨方式不存在或已下架',
        PAYMENT_METHOD_NOT_ALLOWED: '此取貨方式不支援所選付款方式',
        RESTOCK_NOT_FOUND: '找不到此追加庫存排程',
        RESTOCK_ALREADY_APPLIED: '此追加庫存已套用，無法取消',
    }

    return Response.json(
        { error: code, message: messages[code] ?? '系統錯誤，請稍後再試' },
        { status }
    )
}