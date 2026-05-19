import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Switch,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { storeService } from 'services/storeService';
import { Colors } from 'constants/theme';
import Toast from 'react-native-toast-message';
import type { Promotion } from 'types';

export default function PromotionsScreen() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    title: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'flat',
    discount_value: '',
    min_order_amount: '',
    max_discount_amount: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
  });

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeService.getPromotions();
      setPromotions(res.data || []);
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPromotions(); }, []);

  const resetForm = () => {
    setForm({
      code: '', title: '', description: '', discount_type: 'percentage',
      discount_value: '', min_order_amount: '', max_discount_amount: '',
      valid_from: '', valid_until: '', is_active: true,
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.code || !form.title || !form.discount_value) {
      Toast.show({ type: 'error', text1: 'Code, title and discount value are required' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        discount_value: Number(form.discount_value),
        min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : undefined,
        max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : undefined,
        valid_from: form.valid_from || new Date().toISOString(),
        valid_until: form.valid_until || new Date(Date.now() + 30 * 86400000).toISOString(),
      };
      if (editingId) {
        await storeService.updatePromotion(editingId, payload);
        Toast.show({ type: 'success', text1: 'Promotion updated' });
      } else {
        await storeService.createPromotion(payload);
        Toast.show({ type: 'success', text1: 'Promotion created' });
      }
      setModalVisible(false);
      resetForm();
      fetchPromotions();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await storeService.deletePromotion(id);
      Toast.show({ type: 'success', text1: 'Promotion deleted' });
      fetchPromotions();
    } catch { }
  };

  const editPromo = (promo: Promotion) => {
    setForm({
      code: promo.code,
      title: promo.title,
      description: promo.description || '',
      discount_type: promo.discount_type,
      discount_value: String(promo.discount_value),
      min_order_amount: promo.min_order_amount ? String(promo.min_order_amount) : '',
      max_discount_amount: promo.max_discount_amount ? String(promo.max_discount_amount) : '',
      valid_from: promo.valid_from,
      valid_until: promo.valid_until,
      is_active: promo.is_active,
    });
    setEditingId(promo._id);
    setModalVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary flex-1">Promotions</Text>
        <TouchableOpacity
          onPress={() => { resetForm(); setModalVisible(true); }}
          className="bg-primary rounded-lg px-3 py-1.5"
        >
          <Text className="text-white text-xs font-semibold">+ Create</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={promotions}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPromotions} colors={[Colors.primary]} />}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-xl p-4 mb-3">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-base font-bold text-textPrimary mr-2">{item.code}</Text>
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: item.is_active ? Colors.success + '15' : Colors.textTertiary + '15' }}
                  >
                    <Text className="text-[10px] font-semibold" style={{ color: item.is_active ? Colors.success : Colors.textTertiary }}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-textSecondary mt-0.5">{item.title}</Text>
              </View>
              <View className="flex-row">
                <TouchableOpacity onPress={() => editPromo(item)} className="mr-3">
                  <Ionicons name="create-outline" size={20} color={Colors.info} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item._id)}>
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
            <Text className="text-lg font-bold text-primary">
              {item.discount_type === 'percentage' ? `${item.discount_value}%` : `₹${item.discount_value}`} OFF
            </Text>
            {item.min_order_amount ? (
              <Text className="text-xs text-textTertiary mt-1">Min order: ₹{item.min_order_amount}</Text>
            ) : null}
            <Text className="text-xs text-textTertiary mt-1">
              Valid: {new Date(item.valid_from).toLocaleDateString()} - {new Date(item.valid_until).toLocaleDateString()}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Ionicons name="pricetag-outline" size={48} color={Colors.textTertiary} />
            <Text className="text-textTertiary mt-3">No promotions yet</Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="text-lg font-bold text-textPrimary">
                {editingId ? 'Edit Promotion' : 'New Promotion'}
              </Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <ScrollView className="px-5 pb-8" keyboardShouldPersistTaps="handled">
              <Text className="text-xs font-medium text-textSecondary mb-1">Code</Text>
              <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-sm mb-3" value={form.code} onChangeText={(t) => setForm({ ...form, code: t.toUpperCase() })} placeholder="e.g. SAVE20" autoCapitalize="characters" />

              <Text className="text-xs font-medium text-textSecondary mb-1">Title</Text>
              <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-sm mb-3" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="Promotion title" />

              <Text className="text-xs font-medium text-textSecondary mb-1">Discount Type</Text>
              <View className="flex-row mb-3">
                {(['percentage', 'flat'] as const).map((dt) => (
                  <TouchableOpacity
                    key={dt}
                    onPress={() => setForm({ ...form, discount_type: dt })}
                    className="flex-1 py-2.5 rounded-xl mr-2 items-center border"
                    style={{ borderColor: form.discount_type === dt ? Colors.primary : Colors.border, backgroundColor: form.discount_type === dt ? Colors.primary + '10' : '#fff' }}
                  >
                    <Text className="text-sm capitalize" style={{ color: form.discount_type === dt ? Colors.primary : Colors.textSecondary }}>{dt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-xs font-medium text-textSecondary mb-1">Discount Value</Text>
              <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-sm mb-3" value={form.discount_value} onChangeText={(t) => setForm({ ...form, discount_value: t })} placeholder={form.discount_type === 'percentage' ? '20' : '100'} keyboardType="numeric" />

              <Text className="text-xs font-medium text-textSecondary mb-1">Min Order Amount (optional)</Text>
              <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-sm mb-3" value={form.min_order_amount} onChangeText={(t) => setForm({ ...form, min_order_amount: t })} placeholder="500" keyboardType="numeric" />

              <Text className="text-xs font-medium text-textSecondary mb-1">Max Discount (optional)</Text>
              <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-sm mb-3" value={form.max_discount_amount} onChangeText={(t) => setForm({ ...form, max_discount_amount: t })} placeholder="200" keyboardType="numeric" />

              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-sm text-textSecondary">Active</Text>
                <Switch value={form.is_active} onValueChange={(v) => setForm({ ...form, is_active: v })} trackColor={{ false: '#E0E0E0', true: Colors.success + '50' }} thumbColor={form.is_active ? Colors.success : '#9E9E9E'} />
              </View>

              <TouchableOpacity onPress={handleSave} disabled={saving} className="bg-primary rounded-xl py-4 items-center mb-6">
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-bold">{editingId ? 'Update' : 'Create'} Promotion</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
