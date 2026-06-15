import type { PendingBulkOrder } from 'types';

export const resolveBulkOrderId = (order: Pick<PendingBulkOrder, 'order_id'>) => {
  const raw = order.order_id as unknown;
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'object' && raw !== null && '_id' in raw) {
    return String((raw as { _id?: string })._id || '').trim();
  }
  return String(raw).trim();
};

export const startOfLocalDay = (value = new Date()) => {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
};

export const getBulkOrderDay = (order: Pick<PendingBulkOrder, 'delivery_date'>) => {
  if (!order.delivery_date) return null;
  const day = new Date(order.delivery_date);
  if (Number.isNaN(day.getTime())) return null;
  day.setHours(0, 0, 0, 0);
  return day;
};

export const isBulkOrderUpcoming = (order: Pick<PendingBulkOrder, 'delivery_date'>) => {
  const day = getBulkOrderDay(order);
  if (!day) return true;
  return day >= startOfLocalDay();
};

export const splitBulkOrdersByDate = (orders: PendingBulkOrder[]) => {
  const upcoming: PendingBulkOrder[] = [];
  const past: PendingBulkOrder[] = [];

  orders.forEach((order) => {
    if (isBulkOrderUpcoming(order)) {
      upcoming.push(order);
    } else {
      past.push(order);
    }
  });

  upcoming.sort((a, b) => {
    const aDay = getBulkOrderDay(a)?.getTime() || Number.MAX_SAFE_INTEGER;
    const bDay = getBulkOrderDay(b)?.getTime() || Number.MAX_SAFE_INTEGER;
    return aDay - bDay;
  });

  past.sort((a, b) => {
    const aDay = getBulkOrderDay(a)?.getTime() || 0;
    const bDay = getBulkOrderDay(b)?.getTime() || 0;
    return bDay - aDay;
  });

  return { upcoming, past };
};
