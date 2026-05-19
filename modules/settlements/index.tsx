import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { storeService } from 'services/storeService';
import { Colors } from 'constants/theme';
import type { Settlement, Penalty } from 'types';

export default function FinanceScreen() {
  const [tab, setTab] = useState<'settlements' | 'penalties' | 'ledger' | 'expenses'>('settlements');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes, lRes, eRes] = await Promise.all([
        storeService.getSettlements(),
        storeService.getPenalties(),
        storeService.getLedger(),
        storeService.getExpenses(),
      ]);
      setSettlements(sRes.data?.settlements || sRes.data || []);
      setPenalties(pRes.data?.penalties || pRes.data || []);
      setLedger(lRes.data?.entries || lRes.data?.ledger || lRes.data || []);
      setExpenses(eRes.data?.expenses || eRes.data || []);
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const renderSettlement = ({ item }: { item: Settlement }) => (
    <View className="bg-white rounded-xl p-4 mb-3 mx-4">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-sm font-bold text-textPrimary">
          {new Date(item.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} -{' '}
          {new Date(item.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{
            backgroundColor:
              item.status === 'completed' ? Colors.success + '15' : Colors.warning + '15',
          }}
        >
          <Text
            className="text-xs font-semibold capitalize"
            style={{ color: item.status === 'completed' ? Colors.success : Colors.warning }}
          >
            {item.status}
          </Text>
        </View>
      </View>
      <View className="flex-row justify-between mt-1">
        <View>
          <Text className="text-xs text-textTertiary">Orders</Text>
          <Text className="text-sm font-semibold text-textPrimary">{item.total_orders}</Text>
        </View>
        <View>
          <Text className="text-xs text-textTertiary">Commission</Text>
          <Text className="text-sm font-semibold text-error">-₹{item.commission}</Text>
        </View>
        <View>
          <Text className="text-xs text-textTertiary">Net Amount</Text>
          <Text className="text-sm font-bold text-success">₹{item.net_amount}</Text>
        </View>
      </View>
    </View>
  );

  const renderPenalty = ({ item }: { item: Penalty }) => (
    <View className="bg-white rounded-xl p-4 mb-3 mx-4">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-textPrimary">{item.type}</Text>
          <Text className="text-xs text-textSecondary mt-1">{item.reason}</Text>
        </View>
        <Text className="text-base font-bold text-error">-₹{item.amount}</Text>
      </View>
      <Text className="text-xs text-textTertiary mt-2">
        {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </Text>
    </View>
  );

  const renderLedger = ({ item }: { item: any }) => (
    <View className="bg-white rounded-xl p-4 mb-3 mx-4 flex-row items-center">
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-3"
        style={{
          backgroundColor:
            item.direction === 'in'
              ? Colors.success + '15'
              : Colors.error + '15',
        }}
      >
        <Ionicons
          name={
            item.direction === 'in'
              ? 'arrow-down'
              : item.type === 'settlement'
                ? 'checkmark'
                : item.type === 'penalty'
                  ? 'warning'
                  : 'card'
          }
          size={18}
          color={
            item.direction === 'in' ? Colors.success : Colors.error
          }
        />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-textPrimary capitalize">{item.type}</Text>
        <Text className="text-xs text-textSecondary">{item.description}</Text>
      </View>
      <Text
        className="text-sm font-bold"
        style={{
          color:
            item.direction === 'in' ? Colors.success : Colors.error,
        }}
      >
        {item.direction === 'in' ? '+' : '-'}₹{Math.abs(item.amount)}
      </Text>
    </View>
  );

  const renderExpense = ({ item }: { item: any }) => (
    <View className="bg-white rounded-xl p-4 mb-3 mx-4">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-textPrimary">{item.title}</Text>
          <Text className="text-xs text-textTertiary mt-0.5">{item.category}</Text>
        </View>
        <Text className="text-base font-bold text-textPrimary">₹{item.amount}</Text>
      </View>
      <Text className="text-xs text-textTertiary mt-2">
        {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </Text>
    </View>
  );

  const tabs = [
    { key: 'settlements', label: 'Settlements', icon: 'wallet' },
    { key: 'penalties', label: 'Penalties', icon: 'warning' },
    { key: 'ledger', label: 'Ledger', icon: 'book' },
    { key: 'expenses', label: 'Expenses', icon: 'card' },
  ] as const;

  const dataMap = { settlements, penalties, ledger, expenses };
  const renderMap = {
    settlements: renderSettlement,
    penalties: renderPenalty,
    ledger: renderLedger,
    expenses: renderExpense,
  };

  return (
    <SafeAreaView key={tab} className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xl font-bold text-textPrimary">Finance</Text>
          {tab === 'expenses' && (
            <TouchableOpacity
              onPress={() => router.push('/add-expense' as any)}
              className="bg-primary rounded-lg px-3 py-1.5"
            >
              <Text className="text-white text-xs font-semibold">+ Add</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row bg-white rounded-xl p-1">
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              className="flex-1 py-2 rounded-lg items-center"
              style={tab === t.key ? { backgroundColor: Colors.primary } : {}}
            >
              <Ionicons
                name={t.icon as any}
                size={16}
                color={tab === t.key ? '#fff' : Colors.textTertiary}
              />
              <Text
                className="text-[10px] font-semibold mt-0.5"
                style={{ color: tab === t.key ? '#fff' : Colors.textSecondary }}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={dataMap[tab]}
        keyExtractor={(item: any) => item._id}
        renderItem={renderMap[tab] as any}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Ionicons name="document-outline" size={48} color={Colors.textTertiary} />
            <Text className="text-textTertiary mt-3">No {tab} found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
