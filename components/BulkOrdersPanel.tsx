import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from 'constants/theme';
import { storeService } from 'services/storeService';
import type { PendingBulkOrder, PendingBulkInquiry } from 'types';
import PendingBulkInquiriesBanner from 'components/PendingBulkInquiriesBanner';
import BulkOrderDetailModal from 'components/BulkOrderDetailModal';
import { getBulkPaymentMeta, formatBulkDeliveryLabel } from 'utils/bulkOrderPayment';

type Props = {
  orders: PendingBulkOrder[];
  awaitingOrders?: PendingBulkOrder[];
  inquiries: PendingBulkInquiry[];
  onUpdated?: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Date TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBD';
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default function BulkOrdersPanel({ orders, awaitingOrders = [], inquiries, onUpdated }: Props) {
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailFallback, setDetailFallback] = useState<PendingBulkOrder | null>(null);

  const handleMarkNoted = async (order: PendingBulkOrder) => {
    const orderId = String(order.order_id || '').trim();
    if (!orderId) return;

    Alert.alert(
      'Mark as noted?',
      'This bulk order will be marked as acknowledged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Noted',
          onPress: async () => {
            try {
              setMarkingId(orderId);
              await storeService.markBulkOrderNoted(orderId);
              onUpdated?.();
            } catch (err: any) {
              Alert.alert(
                'Could not update',
                err?.response?.data?.message || 'Please try again.',
              );
            } finally {
              setMarkingId(null);
            }
          },
        },
      ],
    );
  };

  const callCustomer = (phone?: string) => {
    const normalized = String(phone || '').replace(/\s+/g, '');
    if (!normalized) return;
    Linking.openURL(`tel:${normalized}`).catch(() => null);
  };

  const pendingInquiries = inquiries.filter((item) => item.status === 'submitted');
  const quotedInquiries = inquiries.filter((item) => item.status === 'quoted');

  const openDetail = (order: PendingBulkOrder) => {
    setDetailFallback(order);
    setDetailOrderId(String(order.order_id || ''));
  };

  const closeDetail = () => {
    setDetailOrderId(null);
    setDetailFallback(null);
  };

  const renderDetailButton = (order: PendingBulkOrder) => (
    <TouchableOpacity
      onPress={() => openDetail(order)}
      className="mt-3 rounded-xl py-3 items-center flex-row justify-center"
      style={{ backgroundColor: '#F1F5F9' }}
    >
      <Ionicons name="document-text-outline" size={18} color="#334155" />
      <Text className="font-bold ml-2" style={{ color: '#334155' }}>View Full Details</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <PendingBulkInquiriesBanner inquiries={pendingInquiries} onUpdated={onUpdated} />

      {awaitingOrders.length > 0 ? (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Ionicons name="hourglass-outline" size={18} color="#B45309" />
            <Text className="text-lg font-bold text-textPrimary ml-2">
              Awaiting Payment ({awaitingOrders.length})
            </Text>
          </View>
          {awaitingOrders.map((order) => {
            const orderId = String(order.order_id || '').trim();
            const paymentMeta = getBulkPaymentMeta(order);
            const address =
              order.delivery_address ||
              order.address_snapshot?.full_address ||
              '';

            return (
              <View
                key={orderId}
                className="rounded-2xl px-4 py-4 mb-3"
                style={{ backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#FDBA74' }}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 pr-2">
                    <Text className="text-xs font-extrabold uppercase" style={{ color: '#C2410C' }}>
                      #{order.order_number || orderId.slice(-8).toUpperCase()}
                      {order.inquiry_number ? ` · ${order.inquiry_number}` : ''}
                    </Text>
                    <Text className="text-base font-bold text-textPrimary mt-1" numberOfLines={2}>
                      {order.package_name || 'Bulk Order'}
                    </Text>
                  </View>
                  <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: paymentMeta.bg }}>
                    <Text className="text-[10px] font-bold uppercase" style={{ color: paymentMeta.color }}>
                      {paymentMeta.label}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm font-semibold" style={{ color: '#9A3412' }}>
                  {order.customer_name} · {order.customer_phone}
                </Text>
                <Text className="text-sm mt-1" style={{ color: '#7C2D12' }}>
                  {formatDate(order.delivery_date)} · {formatBulkDeliveryLabel(order)}
                </Text>
                {address ? (
                  <Text className="text-xs mt-1" style={{ color: '#9A3412' }} numberOfLines={2}>
                    {address}
                  </Text>
                ) : null}
                <Text className="text-sm font-semibold mt-2" style={{ color: '#C2410C' }}>
                  {paymentMeta.amountLine}
                </Text>
                {renderDetailButton(order)}
              </View>
            );
          })}
        </View>
      ) : null}

      {quotedInquiries.length > 0 ? (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Ionicons name="checkmark-done" size={18} color="#047857" />
            <Text className="text-lg font-bold text-textPrimary ml-2">
              Quoted Inquiries ({quotedInquiries.length})
            </Text>
          </View>
          {quotedInquiries.map((inquiry) => (
            <View
              key={String(inquiry._id)}
              className="rounded-2xl px-4 py-4 mb-3"
              style={{ backgroundColor: '#ECFDF5', borderWidth: 1.5, borderColor: '#6EE7B7' }}
            >
              <Text className="text-xs font-extrabold uppercase" style={{ color: '#047857' }}>
                Quotation Sent · {inquiry.inquiry_number}
              </Text>
              <Text className="text-sm font-semibold mt-2" style={{ color: '#065F46' }}>
                {inquiry.customer_name} · {inquiry.customer_phone}
              </Text>
              <Text className="text-sm mt-1" style={{ color: '#334155' }}>
                {inquiry.headcount} people · {formatDate(inquiry.delivery_date)} · {String(inquiry.delivery_slot || 'lunch')}{inquiry.delivery_time ? ` · ${inquiry.delivery_time}` : ''}
              </Text>
              {inquiry.address_snapshot?.full_address ? (
                <Text className="text-xs mt-1" style={{ color: '#64748B' }} numberOfLines={2}>
                  {inquiry.address_snapshot.full_address}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-center mb-2">
        <Ionicons name="people" size={18} color="#B45309" />
        <Text className="text-lg font-bold text-textPrimary ml-2">
          Confirmed Bulk Orders ({orders.length})
        </Text>
      </View>

      {!orders.length ? (
        <View className="rounded-2xl px-4 py-8 items-center" style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' }}>
          <Ionicons name="calendar-outline" size={32} color="#D97706" />
          <Text className="text-sm text-textSecondary mt-3 text-center">
            No confirmed bulk orders yet. Orders appear here after customer pays 50% advance.
          </Text>
        </View>
      ) : (
        orders.map((order) => {
          const orderId = String(order.order_id || '').trim();
          const isMarking = markingId === orderId;
          const paymentMeta = getBulkPaymentMeta(order);
          const address =
            order.delivery_address ||
            order.address_snapshot?.full_address ||
            '';

          return (
            <View
              key={orderId}
              className="rounded-2xl px-4 py-4 mb-3"
              style={{
                backgroundColor: '#FFFBEB',
                borderWidth: 1.5,
                borderColor: order.is_noted ? '#FDE68A' : '#FCD34D',
              }}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 pr-2">
                  <Text className="text-xs font-extrabold uppercase" style={{ color: '#B45309' }}>
                    #{order.order_number || orderId.slice(-8).toUpperCase()} · {order.source === 'user' ? 'Customer App' : 'Admin'}
                  </Text>
                  <Text className="text-base font-bold text-textPrimary mt-1" numberOfLines={2}>
                    {order.package_name || 'Bulk Order'}
                  </Text>
                </View>
                <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: paymentMeta.bg }}>
                  <Text className="text-[10px] font-bold uppercase" style={{ color: paymentMeta.color }}>
                    {paymentMeta.label}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center mb-1">
                <Ionicons name="calendar-outline" size={15} color="#92400E" />
                <Text className="text-sm font-semibold ml-2 flex-1" style={{ color: '#78350F' }}>
                  {formatDate(order.delivery_date)} · {formatBulkDeliveryLabel(order)}
                </Text>
              </View>

              <View className="flex-row items-center mt-1">
                <Ionicons name="person-outline" size={15} color="#92400E" />
                <Text className="text-sm font-semibold ml-2 flex-1" style={{ color: '#78350F' }}>
                  {order.customer_name}
                </Text>
                <TouchableOpacity
                  onPress={() => callCustomer(order.customer_phone)}
                  className="flex-row items-center px-2 py-1 rounded-lg"
                  style={{ backgroundColor: '#FEF3C7' }}
                >
                  <Ionicons name="call-outline" size={14} color="#B45309" />
                  <Text className="text-xs font-bold ml-1" style={{ color: '#92400E' }}>
                    {order.customer_phone || 'Call'}
                  </Text>
                </TouchableOpacity>
              </View>

              {address ? (
                <View className="flex-row items-start mt-2 bg-white/70 rounded-xl px-3 py-2">
                  <Ionicons name="location-outline" size={15} color="#92400E" style={{ marginTop: 1 }} />
                  <Text className="text-xs ml-2 flex-1" style={{ color: '#78350F' }} numberOfLines={3}>
                    {address}
                  </Text>
                </View>
              ) : null}

              <Text className="text-sm font-semibold mt-2" style={{ color: '#92400E' }}>
                {order.headcount || 0} people · {paymentMeta.amountLine}
              </Text>

              {(order.line_items || []).length > 0 ? (
                <View style={{ marginTop: 8, gap: 4 }}>
                  {order.line_items!.map((line, idx) => (
                    <Text key={idx} style={{ fontSize: 12, color: '#78350F' }}>
                      • {line.name}: {line.portion_label || line.serving_count} · ₹{Number(line.line_total || 0).toLocaleString('en-IN')}
                    </Text>
                  ))}
                </View>
              ) : null}

              {order.special_requirements ? (
                <Text style={{ fontSize: 12, color: '#92400E', marginTop: 6, fontStyle: 'italic' }}>
                  Note: {order.special_requirements}
                </Text>
              ) : null}

              {!order.is_noted ? (
                <TouchableOpacity
                  onPress={() => handleMarkNoted(order)}
                  disabled={isMarking}
                  className="mt-3 rounded-xl py-3 items-center flex-row justify-center"
                  style={{ backgroundColor: Colors.primary }}
                >
                  {isMarking ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                      <Text className="text-white font-bold ml-2">Mark Noted</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View className="mt-3 rounded-xl py-2 items-center" style={{ backgroundColor: '#FEF3C7' }}>
                  <Text className="text-xs font-bold" style={{ color: '#92400E' }}>Acknowledged</Text>
                </View>
              )}

              {renderDetailButton(order)}
            </View>
          );
        })
      )}

      <BulkOrderDetailModal
        orderId={detailOrderId}
        fallbackOrder={detailFallback}
        onClose={closeDetail}
      />
    </View>
  );
}
