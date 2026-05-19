import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { storeService } from 'services/storeService';
import { Colors } from 'constants/theme';
import Toast from 'react-native-toast-message';
import type { BankAccount } from 'types';

export default function BankAccountScreen() {
  const [bank, setBank] = useState<BankAccount | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    settlement_frequency: 'weekly' as 'weekly' | 'monthly',
  });
  const [bankInfo, setBankInfo] = useState<{ bank_name?: string; branch_name?: string } | null>(null);

  const fetchBank = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeService.getBankAccount();
      if (res.data) {
        setBank(res.data);
        setForm({
          account_holder_name: res.data.account_holder_name || '',
          account_number: res.data.account_number || '',
          ifsc_code: res.data.ifsc_code || '',
          settlement_frequency: res.data.settlement_frequency || 'weekly',
        });
      }
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBank(); }, []);

  const lookupIFSC = async (ifsc: string) => {
    if (ifsc.length !== 11) return;
    try {
      const res = await storeService.lookupIFSC(ifsc);
      setBankInfo(res.data);
    } catch {
      setBankInfo(null);
    }
  };

  const handleSave = async () => {
    if (!form.account_holder_name || !form.account_number || !form.ifsc_code) {
      Toast.show({ type: 'error', text1: 'Please fill all fields' });
      return;
    }
    setSaving(true);
    try {
      await storeService.updateBankAccount({
        ...form,
        bank_name: bankInfo?.bank_name,
        branch_name: bankInfo?.branch_name,
      });
      Toast.show({ type: 'success', text1: 'Bank account updated' });
      setEditing(false);
      fetchBank();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary flex-1">Bank Account</Text>
        {bank && !editing && (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text className="text-primary text-sm font-medium">Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchBank} colors={[Colors.primary]} />}
        contentContainerStyle={{ padding: 16 }}
      >
        {!editing && bank ? (
          <View className="bg-white rounded-2xl p-5">
            <View className="mb-4">
              <Text className="text-xs text-textTertiary">Account Holder</Text>
              <Text className="text-base font-semibold text-textPrimary mt-0.5">
                {bank.account_holder_name}
              </Text>
            </View>
            <View className="mb-4">
              <Text className="text-xs text-textTertiary">Account Number</Text>
              <Text className="text-base font-semibold text-textPrimary mt-0.5">
                ****{bank.account_number.slice(-4)}
              </Text>
            </View>
            <View className="mb-4">
              <Text className="text-xs text-textTertiary">IFSC Code</Text>
              <Text className="text-base font-semibold text-textPrimary mt-0.5">{bank.ifsc_code}</Text>
            </View>
            {bank.bank_name && (
              <View className="mb-4">
                <Text className="text-xs text-textTertiary">Bank</Text>
                <Text className="text-base font-semibold text-textPrimary mt-0.5">
                  {bank.bank_name} {bank.branch_name ? `- ${bank.branch_name}` : ''}
                </Text>
              </View>
            )}
            <View className="mb-4">
              <Text className="text-xs text-textTertiary">Settlement Frequency</Text>
              <Text className="text-base font-semibold text-textPrimary mt-0.5 capitalize">
                {bank.settlement_frequency}
              </Text>
            </View>
            {bank.is_verified && (
              <View className="flex-row items-center mt-2">
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text className="text-sm text-success ml-1.5">Verified</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="bg-white rounded-2xl p-5">
            <Text className="text-sm font-medium text-textSecondary mb-1.5">Account Holder Name</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base text-textPrimary mb-4"
              value={form.account_holder_name}
              onChangeText={(t) => setForm({ ...form, account_holder_name: t })}
              placeholder="Full name as per bank"
              placeholderTextColor="#9E9E9E"
            />

            <Text className="text-sm font-medium text-textSecondary mb-1.5">Account Number</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base text-textPrimary mb-4"
              value={form.account_number}
              onChangeText={(t) => setForm({ ...form, account_number: t })}
              placeholder="Account number"
              placeholderTextColor="#9E9E9E"
              keyboardType="number-pad"
            />

            <Text className="text-sm font-medium text-textSecondary mb-1.5">IFSC Code</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-base text-textPrimary mb-2"
              value={form.ifsc_code}
              onChangeText={(t) => {
                setForm({ ...form, ifsc_code: t.toUpperCase() });
                if (t.length === 11) lookupIFSC(t.toUpperCase());
              }}
              placeholder="IFSC Code"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="characters"
              maxLength={11}
            />
            {bankInfo && (
              <Text className="text-xs text-success mb-4">
                {bankInfo.bank_name} - {bankInfo.branch_name}
              </Text>
            )}

            <Text className="text-sm font-medium text-textSecondary mb-1.5">Settlement Frequency</Text>
            <View className="flex-row mb-6">
              {(['weekly', 'monthly'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setForm({ ...form, settlement_frequency: f })}
                  className="flex-1 py-3 rounded-xl mr-2 items-center border"
                  style={{
                    backgroundColor: form.settlement_frequency === f ? Colors.primary + '10' : '#fff',
                    borderColor: form.settlement_frequency === f ? Colors.primary : Colors.border,
                  }}
                >
                  <Text
                    className="text-sm font-semibold capitalize"
                    style={{
                      color: form.settlement_frequency === f ? Colors.primary : Colors.textSecondary,
                    }}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="bg-primary rounded-xl py-4 items-center"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-base font-bold">Save Bank Account</Text>
              )}
            </TouchableOpacity>

            {editing && (
              <TouchableOpacity onPress={() => setEditing(false)} className="items-center mt-3">
                <Text className="text-textSecondary text-sm">Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
