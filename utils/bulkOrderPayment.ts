import type { PendingBulkOrder } from 'types';

export const formatBulkDeliveryLabel = (order: Pick<
  PendingBulkOrder,
  'delivery_date' | 'delivery_slot' | 'delivery_time' | 'delivery_slot_label'
>) => {
  if (order.delivery_slot_label) return order.delivery_slot_label;

  const slot = String(order.delivery_slot || 'lunch');
  const slotLabel =
    slot.charAt(0).toUpperCase() + slot.slice(1);
  const time = String(order.delivery_time || '').trim();

  return time ? `${slotLabel} · ${time}` : slotLabel;
};

export const getBulkPaymentMeta = (order: PendingBulkOrder) => {
  const paid = Number(order.paid_amount || 0);
  const due = Number(order.due_amount || 0);
  const status = String(order.payment_status || '').toLowerCase();
  const confirmed = order.payment_confirmed === true;

  if (!confirmed || paid <= 0.01) {
    const advanceDue =
      Number(order.advance_amount || 0) ||
      Math.max(due, Number(order.total_amount || 0) / 2);
    return {
      label: 'Awaiting Razorpay Payment',
      color: '#B45309',
      bg: '#FEF3C7',
      amountLine: `Advance due ₹${advanceDue.toLocaleString('en-IN')} · Payment not confirmed yet`,
    };
  }

  if (status === 'paid' || due <= 0.01) {
    return {
      label: 'Fully Paid · Razorpay Confirmed',
      color: '#047857',
      bg: '#D1FAE5',
      amountLine: `Received ₹${paid.toLocaleString('en-IN')}`,
    };
  }

  return {
    label: 'Confirmed · 50% Razorpay Received',
    color: '#1D4ED8',
    bg: '#DBEAFE',
    amountLine: `Advance ₹${paid.toLocaleString('en-IN')}${due > 0 ? ` · Balance due ₹${due.toLocaleString('en-IN')}` : ''}`,
  };
};
