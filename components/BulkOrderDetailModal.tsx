import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { storeService } from 'services/storeService';
import type { PendingBulkOrder } from 'types';
import { formatBulkDeliveryLabel, getBulkPaymentMeta } from 'utils/bulkOrderPayment';

type Props = {
  orderId: string | null;
  fallbackOrder?: PendingBulkOrder | null;
  onClose: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Date TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBD';
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
      {label}
    </Text>
    <Text style={{ fontSize: 14, color: '#0F172A', marginTop: 2 }}>{value}</Text>
  </View>
);

export default function BulkOrderDetailModal({ orderId, fallbackOrder, onClose }: Props) {
  const [order, setOrder] = useState<PendingBulkOrder | null>(fallbackOrder || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      return;
    }

    setLoading(true);
    storeService
      .getBulkOrderDetail(orderId)
      .then((res: any) => {
        const detail = res?.data || res;
        setOrder(detail || fallbackOrder || null);
      })
      .catch(() => {
        setOrder(fallbackOrder || null);
      })
      .finally(() => setLoading(false));
  }, [orderId, fallbackOrder]);

  const paymentMeta = order ? getBulkPaymentMeta(order) : null;
  const address =
    order?.delivery_address ||
    order?.address_snapshot?.full_address ||
    '';

  return (
    <Modal visible={!!orderId} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A1A1A' }}>Bulk Order Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#2D5A3D" />
            </View>
          ) : !order ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>Could not load order details</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
              <View style={{ backgroundColor: paymentMeta?.bg || '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: paymentMeta?.color || '#B45309' }}>
                  {paymentMeta?.label}
                </Text>
                <Text style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>{paymentMeta?.amountLine}</Text>
              </View>

              <DetailRow label="Order" value={`#${order.order_number || String(order.order_id).slice(-8).toUpperCase()}`} />
              <DetailRow label="Package" value={order.package_name || 'Bulk Order'} />
              {order.inquiry_number ? (
                <DetailRow label="Inquiry Ref" value={order.inquiry_number} />
              ) : null}

              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 8 }}>Customer</Text>
                <DetailRow label="Name" value={order.customer_name || '-'} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <DetailRow label="Phone" value={order.customer_phone || '-'} />
                  </View>
                  {order.customer_phone ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${String(order.customer_phone).replace(/\s+/g, '')}`).catch(() => null)}
                      style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                    >
                      <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: 12 }}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 8 }}>Delivery</Text>
                <DetailRow label="Date" value={formatDate(order.delivery_date)} />
                <DetailRow label="Slot & Time" value={formatBulkDeliveryLabel(order)} />
                <DetailRow label="Headcount" value={`${order.headcount || 0} people`} />
                {address ? <DetailRow label="Address" value={address} /> : null}
              </View>

              {(order.line_items || []).length > 0 ? (
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8 }}>Items</Text>
                  {order.line_items!.map((line, idx) => (
                    <Text key={idx} style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
                      • {line.name}: {line.portion_label || line.serving_count} · ₹{Number(line.line_total || 0).toLocaleString('en-IN')}
                    </Text>
                  ))}
                </View>
              ) : null}

              {order.special_requirements ? (
                <View style={{ backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#1D4ED8', marginBottom: 6 }}>
                    Customer Requirements
                  </Text>
                  <Text style={{ fontSize: 13, color: '#334155', lineHeight: 20 }}>
                    {order.special_requirements}
                  </Text>
                </View>
              ) : null}

              {order.store_quote_notes ? (
                <DetailRow label="Your Quotation Notes" value={order.store_quote_notes} />
              ) : null}

              <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12 }}>
                <DetailRow label="Order Total" value={`₹${Number(order.total_amount || 0).toLocaleString('en-IN')}`} />
                {order.payment_confirmed ? (
                  <>
                    <DetailRow label="Received" value={`₹${Number(order.paid_amount || 0).toLocaleString('en-IN')}`} />
                    <DetailRow label="Balance Due" value={`₹${Number(order.due_amount || 0).toLocaleString('en-IN')}`} />
                  </>
                ) : (
                  <DetailRow
                    label="Advance Due"
                    value={`₹${Number(order.advance_amount || order.due_amount || (Number(order.total_amount || 0) / 2)).toLocaleString('en-IN')}`}
                  />
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
