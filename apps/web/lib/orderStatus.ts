export type OrderStatus = 
    | 'pending'
    | 'in_production'
    | 'pending_payment'
    | 'payment_submitted'
    | 'completed'
    | 'cancelled'

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending: ['in_production', 'cancelled'],
    in_production: ['pending_payment', 'cancelled'],
    pending_payment: ['payment_submitted', 'completed', 'cancelled'],
    payment_submitted: ['completed'],
    completed: [],
    cancelled: []
}

export function assertTransition(
    current: OrderStatus, 
    next: OrderStatus
): void {
    const allowed = ALLOWED_TRANSITIONS[current]
    if (!allowed.includes(next)) throw new Error(`INVALID_TRANSITION:${current}->${next}`)
}

export function assertPaymentTransition(
    current: OrderStatus,
    next: OrderStatus,
    paymentMethod: 'bank_transfer' | 'cash'
): void {
    assertTransition(current, next)
    if (
        paymentMethod === 'bank_transfer' &&
        current === 'pending_payment' &&
        next === 'completed'
    ){
        throw new Error('INVALID_TRANSITION:bank_transfer_must_submit_remit_first')
    }
}

export function assertCancellable(status: OrderStatus): void {
  if (status === 'payment_submitted') {
    throw new Error('CANNOT_CANCEL_PAYMENT_SUBMITTED')
  }
  if (status === 'completed' || status === 'cancelled') {
    throw new Error('ORDER_ALREADY_FINALIZED')
  }
}