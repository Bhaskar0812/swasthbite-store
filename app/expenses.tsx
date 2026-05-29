import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { storeService } from 'services/storeService';
import { Colors } from 'constants/theme';
import Toast from 'react-native-toast-message';
import type { Expense } from 'types';

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', amount: '', category: '', notes: '' });

  const categoryOptions = [
    { key: 'raw_material', label: 'Ingredients' },
    { key: 'packaging', label: 'Packaging' },
    { key: 'utilities', label: 'Utilities' },
    { key: 'salary', label: 'Salary' },
    { key: 'rent', label: 'Rent' },
    { key: 'marketing', label: 'Marketing' },
    { key: 'other', label: 'Other' },
  ] as const;

  const toCategoryKey = (value: string) => {
    const v = String(value || '').trim().toLowerCase();
    const map: Record<string, string> = {
      ingredients: 'raw_material',
      'raw material': 'raw_material',
      raw_material: 'raw_material',
      packaging: 'packaging',
      utilities: 'utilities',
      salary: 'salary',
      rent: 'rent',
      marketing: 'marketing',
      other: 'other',
    };
    return map[v] || 'other';
  };

  const categoryLabel = (value: string) => {
    const key = toCategoryKey(value);
    return categoryOptions.find((c) => c.key === key)?.label || 'Other';
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, sRes] = await Promise.all([
        storeService.getExpenses(),
        storeService.getExpenseSummary(),
      ]);
      setExpenses(eRes.data?.expenses || eRes.data || []);
      setSummary(sRes.data || {});
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSave = async () => {
    if (!form.title || !form.amount || !form.category) {
      Toast.show({ type: 'error', text1: 'Please fill required fields' });
      return;
    }
    setSaving(true);
    try {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        Toast.show({ type: 'error', text1: 'Enter a valid amount' });
        setSaving(false);
        return;
      }

      const payload = {
        title: form.title.trim(),
        amount,
        category: toCategoryKey(form.category),
        description: form.notes.trim(),
        date: new Date().toISOString(),
      };

      if (editingId) {
        await storeService.updateExpense(editingId, payload);
      } else {
        await storeService.createExpense(payload);
      }
      Toast.show({ type: 'success', text1: editingId ? 'Expense updated' : 'Expense added' });
      setModalVisible(false);
      setForm({ title: '', amount: '', category: '', notes: '' });
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await storeService.deleteExpense(id);
      Toast.show({ type: 'success', text1: 'Expense deleted' });
      fetchData();
    } catch { }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary flex-1">Expenses</Text>
        <TouchableOpacity
          onPress={() => { setEditingId(null); setForm({ title: '', amount: '', category: '', notes: '' }); setModalVisible(true); }}
          className="bg-primary rounded-lg px-3 py-1.5"
        >
          <Text className="text-white text-xs font-semibold">+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      {summary && (
        <View className="bg-white mx-4 mt-4 rounded-xl p-4">
          <Text className="text-sm font-bold text-textPrimary mb-2">Summary</Text>
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-textPrimary">₹{summary.total_expenses || summary.total || 0}</Text>
              <Text className="text-xs text-textTertiary">Total</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-warning">{summary.count || 0}</Text>
              <Text className="text-xs text-textTertiary">Entries</Text>
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={expenses}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} colors={[Colors.primary]} />}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-xl p-4 mb-3">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-textPrimary">{item.title}</Text>
                <Text className="text-xs text-textTertiary mt-0.5">{categoryLabel(item.category)}</Text>
                {(item as any).description && <Text className="text-xs text-textSecondary mt-1">{(item as any).description}</Text>}
              </View>
              <View className="items-end">
                <Text className="text-base font-bold text-textPrimary">₹{item.amount}</Text>
                <View className="flex-row mt-1">
                  <TouchableOpacity
                    onPress={() => {
                      setEditingId(item._id);
                      setForm({
                        title: item.title,
                        amount: String(item.amount),
                        category: toCategoryKey(item.category),
                        notes: (item as any).description || '',
                      });
                      setModalVisible(true);
                    }}
                    className="mr-2"
                  >
                    <Ionicons name="create-outline" size={16} color={Colors.info} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item._id)}>
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <Text className="text-xs text-textTertiary mt-2">
              {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Ionicons name="card-outline" size={48} color={Colors.textTertiary} />
            <Text className="text-textTertiary mt-3">No expenses recorded</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setModalVisible(false)}>
        <View
          className="flex-1 bg-black/50 justify-end"
          style={{ paddingBottom: keyboardHeight > 0 ? Math.max(8, keyboardHeight - insets.bottom) : 0 }}
        >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'flex-end',
                paddingTop: insets.top + 16,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 16 + insets.bottom, maxHeight: keyboardHeight > 0 ? '84%' : '90%' }}>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-xl font-bold text-textPrimary">{editingId ? 'Edit' : 'Add'} Expense</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                <Text className="text-sm font-semibold text-textSecondary mb-1.5">Title</Text>
                <TextInput className="bg-background border border-border rounded-xl px-4 py-4 text-base mb-3" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="Expense title" placeholderTextColor={Colors.textTertiary} />

                <Text className="text-sm font-semibold text-textSecondary mb-1.5">Amount</Text>
                <TextInput className="bg-background border border-border rounded-xl px-4 py-4 text-2xl font-bold mb-3" value={form.amount} onChangeText={(t) => setForm({ ...form, amount: t })} placeholder="0" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />

                <Text className="text-sm font-semibold text-textSecondary mb-1.5">Category</Text>
                <View className="flex-row flex-wrap mb-3">
                  {categoryOptions.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setForm({ ...form, category: cat.key })}
                      className="px-3 py-1.5 rounded-full mr-2 mb-2 border"
                      style={{ borderColor: form.category === cat.key ? Colors.primary : Colors.border, backgroundColor: form.category === cat.key ? Colors.primary + '10' : '#fff' }}
                    >
                      <Text className="text-sm" style={{ color: form.category === cat.key ? Colors.primary : Colors.textSecondary }}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-sm font-semibold text-textSecondary mb-1.5">Notes (optional)</Text>
                <TextInput className="bg-background border border-border rounded-xl px-4 py-4 text-base mb-4" value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} placeholder="Additional notes" placeholderTextColor={Colors.textTertiary} multiline />

                <TouchableOpacity onPress={handleSave} disabled={saving} className="bg-primary rounded-xl py-4 items-center">
                  {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-bold">{editingId ? 'Update' : 'Add'} Expense</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
      </Modal>
    </SafeAreaView>
  );
}
