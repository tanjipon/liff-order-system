import { describe, it, expect } from 'vitest'
import { assertTransition, assertPaymentTransition, assertCancellable } from '@/lib/orderStatus'

describe('assertTransition', () => {
    it('allows valid transition', () => {
        expect(() => assertTransition('pending', 'in_production')).not.toThrow()
        expect(() => assertTransition('in_production', 'cancelled')).not.toThrow()
        expect(() => assertTransition('payment_submitted', 'completed')).not.toThrow()
    })

    it('reject skip transitions', () => {
        expect(() => assertTransition('pending', 'completed'))
            .toThrow('INVALID_TRANSITION')
        expect(() => assertTransition('pending', 'payment_submitted'))
            .toThrow('INVALID_TRANSITION')
    })

    it('rejects payment_submitted → cancelled', () => {
        expect(() => assertTransition('payment_submitted', 'cancelled'))
            .toThrow('INVALID_TRANSITION')
    })
})

describe('assertPaymentTransition', () => {
    it('allows cash: pending_payment → completed', () => {
        expect(() => assertPaymentTransition('pending_payment', 'completed', 'cash'))
            .not.toThrow()
    })

    it('rejects bank_transfer: pending_payment → completed', () => {
        expect(() => assertPaymentTransition('pending_payment', 'completed', 'bank_transfer'))
            .toThrow('bank_transfer_must_submit_remit_first')
    })

    it('allows bank_transfer: pending_payment → payment_submitted', () => {
        expect(() => assertPaymentTransition('pending_payment', 'payment_submitted', 'bank_transfer'))
            .not.toThrow()
    })
})

describe('assertCancellable', () => {
    it('allows cancellation for pending and in_production', () => {
        expect(() => assertCancellable('pending')).not.toThrow()
        expect(() => assertCancellable('in_production')).not.toThrow()
        expect(() => assertCancellable('pending_payment')).not.toThrow()
    })

    it('rejects cancellation for payment_submitted', () => {
        expect(() => assertCancellable('payment_submitted'))
            .toThrow('CANNOT_CANCEL_PAYMENT_SUBMITTED')
    })

    it('rejects cancellation for terminal states', () => {
        expect(() => assertCancellable('completed'))
            .toThrow('ORDER_ALREADY_FINALIZED')
        expect(() => assertCancellable('cancelled'))
            .toThrow('ORDER_ALREADY_FINALIZED')
    })
})