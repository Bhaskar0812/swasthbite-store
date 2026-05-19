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
import type { StoreCharges } from 'types';

export default function ChargesScreen() {
  const [charges, setCharges] = useState<StoreCharges | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    delivery_per_km: '',
    packing_charge: '',
    handling_charge: '',
  });

  const fetchCharges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeService.getCharges();
      const data = res.data;
      if (data) {
        setCharges(data);
        setForm({
          delivery_per_km: String(data.delivery_per_km || 0),
          packing_charge: String(data.packing_charge || 0),
          handling_charge: String(data.handling_charge || 0),
        });
      }
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCharges(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await storeService.updateCharges({
        delivery_per_km: Number(form.delivery_per_km),
        packing_charge: Number(form.packing_charge),
        handling_charge: Number(form.handling_charge),
      });
      Toast.show({ type: 'success', text1: 'Charges updated' });
      setEditing(false);
      fetchCharges();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const ChargeRow = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
    <View className="flex-row items-center justify-between py-3.5 border-b border-divider">
      <Text className="text-sm text-textSecondary">{label}</Text>
      <Text className="text-base font-bold text-textPrimary">₹{value} {unit}</Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary flex-1">Store Charges</Text>
        {charges && !editing && (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text className="text-primary text-sm font-medium">Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchCharges} colors={[Colors.primary]} />}
        contentContainerStyle={{ padding: 16 }}
      >
        {!editing && charges ? (
          <View className="bg-white rounded-2xl px-5 py-2">
            <ChargeRow label="Delivery per KM" value={String(charges.delivery_per_km)} unit="/km" />
            <ChargeRow label="Packing Charge" value={String(charges.packing_charge)} unit="/order" />
            <ChargeRow label="Handling Charge" value={String(charges.handling_charge)} unit="/order" />
          </View>
        ) : (
          <View className="bg-white rounded-2xl p-5">
            {[
              { key: 'delivery_per_km', label: 'Delivery per KM (₹)', placeholder: '5' },
              { key: 'packing_charge', label: 'Packing Charge (₹)', placeholder: '10' },
              { key: 'handling_charge', label: 'Handling Charge (₹)', placeholder: '5' },
            ].map((field) => (
              <View key={field.key} className="mb-4">
                <Text className="text-sm font-medium text-textSecondary mb-1.5">{field.label}</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-base text-textPrimary"
                  value={(form as any)[field.key]}
                  onChangeText={(t) => setForm({ ...form, [field.key]: t })}
                  placeholder={field.placeholder}
                  keyboardType="numeric"
                />
              </View>
            ))}

            <TouchableOpacity onPress={handleSave} disabled={saving} className="bg-primary rounded-xl py-4 items-center mt-2">
              {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-bold">Save Charges</Text>}
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
