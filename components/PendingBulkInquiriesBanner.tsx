import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from 'constants/theme';
import { storeService } from 'services/storeService';
import type { PendingBulkInquiry } from 'types';

type Props = {
  inquiries: PendingBulkInquiry[];
  onUpdated?: () => void;
};

type QuoteLine = {
  name: string;
  description: string;
  quantity: string;
  unit_price: string;
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

const emptyLine = (): QuoteLine => ({
  name: '',
  description: '',
  quantity: '1',
  unit_price: '',
});

export default function PendingBulkInquiriesBanner({ inquiries, onUpdated }: Props) {
  const [selected, setSelected] = useState<PendingBulkInquiry | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const quoteTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity);
        const price = Number(line.unit_price);
        if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) return sum;
        return sum + qty * price;
      }, 0),
    [lines],
  );

  if (!inquiries.length) return null;

  const openQuote = (inquiry: PendingBulkInquiry) => {
    setSelected(inquiry);
    setLines([emptyLine()]);
    setNotes('');
  };

  const closeQuote = () => {
    setSelected(null);
    setLines([emptyLine()]);
    setNotes('');
  };

  const updateLine = (index: number, field: keyof QuoteLine, value: string) => {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, [field]: value } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const submitQuote = async () => {
    if (!selected) return;
    const payloadLines = lines
      .map((line) => ({
        name: line.name.trim(),
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
      }))
      .filter((line) => line.name && line.quantity > 0 && line.unit_price >= 0);

    if (!payloadLines.length) {
      Alert.alert('Add items', 'Add at least one line item with name, quantity and price.');
      return;
    }

    try {
      setSubmitting(true);
      await storeService.quoteBulkInquiry(String(selected._id), {
        line_items: payloadLines,
        notes: notes.trim(),
      });
      Alert.alert('Quotation sent', 'Customer can now review and pay 50% advance.');
      closeQuote();
      onUpdated?.();
    } catch (err: any) {
      Alert.alert('Could not send quote', err?.response?.data?.message || 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="mb-4">
      <View className="flex-row items-center mb-2">
        <Ionicons name="document-text" size={18} color="#1D4ED8" />
        <Text className="text-lg font-bold text-textPrimary ml-2">
          Bulk Inquiries ({inquiries.length})
        </Text>
      </View>

      {inquiries.map((inquiry) => (
        <View
          key={String(inquiry._id)}
          className="rounded-2xl px-4 py-4 mb-3"
          style={{ backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#93C5FD' }}
        >
          <Text className="text-xs font-extrabold uppercase" style={{ color: '#1D4ED8' }}>
            Custom Bulk Inquiry · {inquiry.inquiry_number}
          </Text>
          <Text className="text-sm font-semibold mt-2" style={{ color: '#1E3A8A' }}>
            {inquiry.customer_name} · {inquiry.customer_phone}
          </Text>
          <Text className="text-sm mt-1" style={{ color: '#334155' }}>
            {inquiry.headcount} people · {formatDate(inquiry.delivery_date)} · {inquiry.delivery_slot}
          </Text>
          {inquiry.address_snapshot?.full_address ? (
            <Text className="text-xs mt-1" style={{ color: '#64748B' }} numberOfLines={2}>
              {inquiry.address_snapshot.full_address}
            </Text>
          ) : null}
          <Text className="text-sm mt-2" style={{ color: '#0F172A' }} numberOfLines={3}>
            {inquiry.requirements}
          </Text>
          {inquiry.contact_note ? (
            <Text className="text-xs mt-1 italic" style={{ color: '#475569' }}>
              Note: {inquiry.contact_note}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={() => openQuote(inquiry)}
            className="mt-3 rounded-xl py-3 items-center flex-row justify-center"
            style={{ backgroundColor: '#1D4ED8' }}
          >
            <Ionicons name="create-outline" size={18} color="#FFF" />
            <Text className="text-white font-bold ml-2">Send Quotation</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={closeQuote}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A1A1A' }}>Send Quotation</Text>
              <TouchableOpacity onPress={closeQuote}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                Customer pays 50% advance on acceptance. Balance due 2 hours before delivery.
              </Text>

              {lines.map((line, index) => (
                <View key={index} style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontWeight: '700', color: '#374151' }}>Item {index + 1}</Text>
                    {lines.length > 1 ? (
                      <TouchableOpacity onPress={() => removeLine(index)}>
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <TextInput
                    value={line.name}
                    onChangeText={(v) => updateLine(index, 'name', v)}
                    placeholder="Item / package name"
                    style={{ backgroundColor: '#FFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 }}
                  />
                  <TextInput
                    value={line.description}
                    onChangeText={(v) => updateLine(index, 'description', v)}
                    placeholder="Description (optional)"
                    style={{ backgroundColor: '#FFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={line.quantity}
                      onChangeText={(v) => updateLine(index, 'quantity', v)}
                      placeholder="Qty"
                      keyboardType="number-pad"
                      style={{ flex: 1, backgroundColor: '#FFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E5E7EB' }}
                    />
                    <TextInput
                      value={line.unit_price}
                      onChangeText={(v) => updateLine(index, 'unit_price', v)}
                      placeholder="Unit price ₹"
                      keyboardType="decimal-pad"
                      style={{ flex: 2, backgroundColor: '#FFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E5E7EB' }}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity onPress={addLine} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginBottom: 12 }}>
                <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontWeight: '700', marginLeft: 6 }}>Add line item</Text>
              </TouchableOpacity>

              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes for customer (optional)"
                multiline
                style={{ backgroundColor: '#FFF', borderRadius: 10, padding: 12, minHeight: 70, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, textAlignVertical: 'top' }}
              />

              <View style={{ backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#065F46' }}>
                  Total ₹{Math.round(quoteTotal).toLocaleString('en-IN')}
                </Text>
                <Text style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>
                  Advance 50% · Balance 50% (2hr before delivery)
                </Text>
              </View>

              <TouchableOpacity
                onPress={submitQuote}
                disabled={submitting}
                style={{ backgroundColor: Colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                {submitting ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Share Quotation</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
