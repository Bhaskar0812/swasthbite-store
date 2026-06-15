import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from 'constants/theme';
import { storeService } from 'services/storeService';
import type { PendingBulkOrder } from 'types';

type Props = {
  orders: PendingBulkOrder[];
  onNoted?: () => void;
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

export default function PendingBulkOrdersBanner({ orders, onNoted }: Props) {
  const [markingId, setMarkingId] = useState<string | null>(null);

  if (!orders.length) return null;

  const handleMarkNoted = async (order: PendingBulkOrder) => {
    const orderId = String(order.order_id || '').trim();
    if (!orderId) return;

    Alert.alert(
      'Mark as noted?',
      'This bulk order will be removed from the pending list once noted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Noted',
          onPress: async () => {
            try {
              setMarkingId(orderId);
              await storeService.markBulkOrderNoted(orderId);
              onNoted?.();
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

  return (
    <View className="mb-4">
      <View className="flex-row items-center mb-2">
        <Ionicons name="people" size={18} color="#B45309" />
        <Text className="text-lg font-bold text-textPrimary ml-2">
          Bulk Orders ({orders.length})
        </Text>
      </View>

      {orders.map((order) => {
        const orderId = String(order.order_id || '').trim();
        const isMarking = markingId === orderId;

        return (
          <View
            key={orderId}
            className="rounded-2xl px-4 py-4 mb-3"
            style={{
              backgroundColor: '#FFFBEB',
              borderWidth: 1.5,
              borderColor: '#FCD34D',
            }}
          >
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-extrabold uppercase" style={{ color: '#B45309' }}>
                  Bulk Order · {order.source === 'user' ? 'Customer App' : 'Admin'}
                </Text>
                <Text className="text-base font-bold text-textPrimary mt-1" numberOfLines={2}>
                  {order.package_name || 'Bulk Order'}
                </Text>
              </View>
              <View
                className="px-2.5 py-1 rounded-full"
                style={{ backgroundColor: '#FEF3C7' }}
              >
                <Text className="text-[10px] font-bold uppercase" style={{ color: '#92400E' }}>
                  {order.payment_status || 'pending'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mb-1">
              <Ionicons name="calendar-outline" size={15} color="#92400E" />
              <Text className="text-sm font-semibold ml-2" style={{ color: '#78350F' }}>
                {formatDate(order.delivery_date)} · {String(order.delivery_slot || 'lunch')}
              </Text>
            </View>

            <Text className="text-sm text-textSecondary mt-1">
              {order.customer_name} · {order.customer_phone}
            </Text>
            <Text className="text-sm font-semibold mt-1" style={{ color: '#92400E' }}>
              {order.headcount || 0} people · Paid ₹{Number(order.paid_amount || 0).toLocaleString('en-IN')}
              {Number(order.due_amount || 0) > 0
                ? ` · Due ₹${Number(order.due_amount).toLocaleString('en-IN')}`
                : ''}
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
          </View>
        );
      })}
    </View>
  );
}
