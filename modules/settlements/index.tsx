import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from 'services/api';
import { useAuthStore } from 'store/authStore';
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
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fetch all data
  const fetchAll = useCallback(async () => {
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
    } catch (err) {
      console.error('Finance fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Utilities
  const toAmount = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const formatMoney = (value: number) =>
    `₹${toAmount(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const parseDate = (value: any) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (value: any) => {
    const date = parseDate(value);
    if (!date) return '—';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (value: any) => {
    const date = parseDate(value);
    if (!date) return '—';
    return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const prettyType = (value: string) =>
    String(value || 'entry')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const getCashUpiAdjustment = (settlement: any) => {
    const explicitCombined = toAmount(
      settlement?.cash_upi_direct_payment_bulk_orders ??
      settlement?.cash_upi_direct_payment ??
      settlement?.cash_upi_direct_payment_deductions,
    );
    if (Math.abs(explicitCombined) > 0) return explicitCombined;

    const explicitSplit =
      toAmount(settlement?.cash_direct_payment_bulk_orders ?? settlement?.cash_direct_payment) +
      toAmount(settlement?.upi_direct_payment_bulk_orders ?? settlement?.upi_direct_payment);
    if (Math.abs(explicitSplit) > 0) return explicitSplit;

    // Backward compatibility: derive when explicit cash/UPI field is absent.
    const derived =
      toAmount(settlement?.net_amount) +
      toAmount(settlement?.carry_forward) -
      toAmount(settlement?.payable_amount);
    return Math.abs(derived) < 0.01 ? 0 : derived;
  };

  // Settlement processing
  const sortedSettlements = [...settlements]
    .sort(
      (a, b) =>
        (parseDate(b.period_end)?.getTime() || 0) -
        (parseDate(a.period_end)?.getTime() || 0),
    )
    .filter((item, index, array) => {
      if (!item._id) return true;
      return index === array.findIndex((s) => s._id === item._id);
    });

  const cycleStart = (() => {
    const latest = sortedSettlements[0];
    const latestEnd = parseDate(latest?.period_end);
    if (latestEnd) {
      const start = new Date(latestEnd);
      start.setDate(start.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  })();

  // Ledger summary
  const todayKey = new Date().toDateString();
  const ledgerEarningSummary = ledger.reduce(
    (acc: any, item) => {
      const amount = Math.abs(toAmount(item?.amount));
      const direction = String(item?.direction || '').toLowerCase() === 'out' ? 'out' : 'in';
      if (direction !== 'in') return acc;

      const date = parseDate(item?.created_at || item?.date);
      acc.totalTillNow += amount;
      if (date && date >= cycleStart) acc.currentCycle += amount;
      if (date && date.toDateString() === todayKey) acc.today += amount;
      return acc;
    },
    { currentCycle: 0, totalTillNow: 0, today: 0 },
  );

  // Expense summary
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay());

  const expenseSummary = expenses.reduce(
    (acc: { weekly: number; monthly: number; overall: number }, item: any) => {
      const amount = Math.abs(toAmount(item?.amount));
      const date = parseDate(item?.date || item?.created_at || item?.createdAt);

      acc.overall += amount;
      if (date && date >= monthStart) acc.monthly += amount;
      if (date && date >= weekStart) acc.weekly += amount;
      return acc;
    },
    { weekly: 0, monthly: 0, overall: 0 },
  );

  // Handlers
  const handleDownloadPDF = async (settlementId: string) => {
    try {
      setDownloadingId(settlementId);
      const token = useAuthStore.getState().token;
      const url = `${api.defaults.baseURL}/store/settlements/${settlementId}/pdf`;
      // Lazy-load optional native modules so older binaries don't crash on screen open.
      let FileSystem: any = null;
      let Sharing: any = null;
      try {
        FileSystem = await import('expo-file-system');
        Sharing = await import('expo-sharing');
      } catch {
        FileSystem = null;
        Sharing = null;
      }

      const canUseFileApis =
        !!FileSystem?.File &&
        !!FileSystem?.Paths?.cache &&
        typeof FileSystem?.File?.downloadFileAsync === 'function';

      if (!canUseFileApis) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return;
        }
        Alert.alert('Download unavailable', 'Please update the app to download settlement PDFs.');
        return;
      }

      const file = new FileSystem.File(
        FileSystem.Paths.cache,
        `settlement-${settlementId}.pdf`,
      );

      await FileSystem.File.downloadFileAsync(url, file, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const sharingAvailable = Sharing && (await Sharing.isAvailableAsync());
      if (sharingAvailable) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Share settlement PDF',
        });
      } else {
        Alert.alert('Downloaded', `Saved to ${file.uri}`);
      }
    } catch (err) {
      console.error('PDF download error:', err);
      Alert.alert('Error', 'Could not download the settlement PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  // UI Components
  const StatCard = ({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'blue' | 'amber' }) => {
    const styles =
      tone === 'blue'
        ? { bg: '#EFF6FF', color: '#1D4ED8' }
        : tone === 'amber'
          ? { bg: '#FFF7ED', color: '#C2410C' }
          : { bg: '#ECFDF5', color: '#047857' };

    return (
      <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: styles.bg }}>
        <Text className="text-xs" style={{ color: Colors.textSecondary }}>
          {label}
        </Text>
        <Text className="text-lg font-bold mt-1" style={{ color: styles.color }}>
          {value}
        </Text>
      </View>
    );
  };

  const renderSummaryHeader = () => {
    if (tab === 'ledger') {
      return (
        <View className="mx-4 mb-3 mt-2 bg-white rounded-xl p-3">
          <Text className="text-sm text-textSecondary mb-2">Earnings Summary</Text>
          <View className="flex-row gap-2">
            <StatCard label="Current Cycle" value={formatMoney(ledgerEarningSummary.currentCycle)} tone="blue" />
            <StatCard label="Till Now" value={formatMoney(ledgerEarningSummary.totalTillNow)} tone="green" />
            <StatCard label="Today" value={formatMoney(ledgerEarningSummary.today)} tone="amber" />
          </View>
          <Text className="text-xs text-textTertiary mt-2">Cycle start: {formatDate(cycleStart)}</Text>
        </View>
      );
    }
    if (tab === 'expenses') {
      return (
        <View className="mx-4 mb-3 mt-2 bg-white rounded-xl p-3">
          <Text className="text-sm text-textSecondary mb-2">Expense Summary</Text>
          <View className="flex-row gap-2">
            <StatCard label="This Week" value={formatMoney(expenseSummary.weekly)} tone="amber" />
            <StatCard label="This Month" value={formatMoney(expenseSummary.monthly)} tone="blue" />
            <StatCard label="Overall" value={formatMoney(expenseSummary.overall)} tone="green" />
          </View>
        </View>
      );
    }
    return null;
  };

  const renderSettlement = ({ item }: { item: Settlement }) => {
    const gross = toAmount((item as any)?.gross_amount);
    const net = toAmount(item.net_amount);
    const payable = toAmount((item as any)?.payable_amount);
    const settled = toAmount((item as any)?.settled_amount);
    const carryFwd = toAmount((item as any)?.carry_forward);
    const penaltyDed = toAmount((item as any)?.penalty_deductions);
    const commissionDed = toAmount((item as any)?.commission_deductions);
    const deliveryDed = toAmount((item as any)?.delivery_deductions);
    const refundDed = toAmount((item as any)?.refund_deductions);
    const promoDed = toAmount((item as any)?.promotional_wallet_deductions);
    const otherDed = toAmount((item as any)?.other_deductions);
    const cashUpiAdj = getCashUpiAdjustment(item as any);
    const totalDed = penaltyDed + commissionDed + deliveryDed + refundDed + promoDed + otherDed + cashUpiAdj;

    const status = String((item as any)?.status || '').toLowerCase();
    const isClosed = ['completed', 'settled'].includes(status);

    return (
      <View className="bg-white rounded-xl overflow-hidden mb-3 mx-4" style={{ borderWidth: 1, borderColor: '#e5e7eb' }}>
        {/* Header */}
        <View className="bg-slate-50 p-4 flex-row justify-between items-center border-b border-slate-100">
          <View className="flex-1">
            <Text className="text-base font-bold text-textPrimary">
              {formatDate(item.period_start)} - {formatDate(item.period_end)}
            </Text>
            <Text className="text-sm text-textTertiary mt-0.5">{toAmount((item as any)?.total_orders || 0)} orders</Text>
          </View>
          <View className="flex-col items-end gap-1">
            <View
              className="px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: isClosed ? Colors.success + '15' : Colors.warning + '15',
              }}
            >
              <Text className="text-sm font-semibold capitalize" style={{ color: isClosed ? Colors.success : Colors.warning }}>
                {prettyType(status)}
              </Text>
            </View>
            {settled > 0 && (
              <Text className="text-xs text-textTertiary">Settled: {formatMoney(settled)}</Text>
            )}
          </View>
        </View>

        {/* Financial Breakdown */}
        <View className="p-4">
          {/* Gross */}
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-base text-textSecondary">Gross Order Value</Text>
            <Text className="text-base font-semibold text-textPrimary">{formatMoney(gross)}</Text>
          </View>

          {/* Deductions Breakdown */}
          {totalDed > 0 && (
            <View className="mb-2 bg-red-50 rounded-lg p-2">
              <Text className="text-sm font-semibold text-red-700 mb-1">Deductions: -{formatMoney(totalDed)}</Text>
              {commissionDed > 0 && (
                <View className="flex-row justify-between ml-2 mb-0.5">
                  <Text className="text-sm text-textSecondary">Commission</Text>
                  <Text className="text-sm text-red-700">-{formatMoney(commissionDed)}</Text>
                </View>
              )}
              {penaltyDed > 0 && (
                <View className="flex-row justify-between ml-2 mb-0.5">
                  <Text className="text-sm text-textSecondary">Penalties</Text>
                  <Text className="text-sm text-red-700">-{formatMoney(penaltyDed)}</Text>
                </View>
              )}
              {deliveryDed > 0 && (
                <View className="flex-row justify-between ml-2 mb-0.5">
                  <Text className="text-sm text-textSecondary">Delivery</Text>
                  <Text className="text-sm text-red-700">-{formatMoney(deliveryDed)}</Text>
                </View>
              )}
              {refundDed > 0 && (
                <View className="flex-row justify-between ml-2 mb-0.5">
                  <Text className="text-sm text-textSecondary">Refunds</Text>
                  <Text className="text-sm text-red-700">-{formatMoney(refundDed)}</Text>
                </View>
              )}
              {promoDed > 0 && (
                <View className="flex-row justify-between ml-2 mb-0.5">
                  <Text className="text-sm text-textSecondary">Promo Wallet</Text>
                  <Text className="text-sm text-red-700">-{formatMoney(promoDed)}</Text>
                </View>
              )}
              {cashUpiAdj > 0 && (
                <View className="flex-row justify-between ml-2 mb-0.5">
                  <Text className="text-sm text-textSecondary">Cash/UPI Direct Payment</Text>
                  <Text className="text-sm text-red-700">-{formatMoney(cashUpiAdj)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Net Amount */}
          <View className="flex-row justify-between items-center mb-2 p-2 bg-emerald-50 rounded-lg">
            <Text className="text-base font-semibold text-textPrimary">Net Amount</Text>
            <Text className="text-base font-bold text-success">{formatMoney(net)}</Text>
          </View>

          {/* Carry Forward */}
          {carryFwd !== 0 && (
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-base text-textSecondary">Carry Forward</Text>
              <Text className={`text-base font-semibold ${carryFwd > 0 ? 'text-info' : 'text-error'}`}>
                {carryFwd > 0 ? '+' : ''}{formatMoney(carryFwd)}
              </Text>
            </View>
          )}

          {/* Payable Amount - Highlighted */}
          <View className="flex-row justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Text className="text-base font-bold text-blue-900">Payable Amount</Text>
            <Text className="text-xl font-bold text-blue-700">{formatMoney(payable)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View className="border-t border-slate-100 p-3 flex-row gap-2">
          <TouchableOpacity
            className="flex-1 py-2.5 px-3 rounded-lg flex-row items-center justify-center"
            style={{ backgroundColor: Colors.info + '15' }}
            onPress={() => handleDownloadPDF((item as any)._id)}
            disabled={downloadingId === (item as any)._id}
          >
            <Ionicons
              name={downloadingId === (item as any)._id ? 'hourglass' : 'document-outline'}
              size={14}
              color={Colors.info}
              style={{ marginRight: 6 }}
            />
            <Text className="text-sm font-semibold" style={{ color: Colors.info }}>
              {downloadingId === (item as any)._id ? 'Downloading...' : 'PDF'}
            </Text>
          </TouchableOpacity>
          {status === 'approved' && (
            <TouchableOpacity
              className="flex-1 py-2.5 px-3 rounded-lg flex-row items-center justify-center"
              style={{ backgroundColor: Colors.success + '15' }}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} style={{ marginRight: 6 }} />
              <Text className="text-sm font-semibold" style={{ color: Colors.success }}>
                Pay
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderPenalty = ({ item }: { item: Penalty }) => {
    const reasonKey = String((item as any)?.reason || (item as any)?.type || 'other').toLowerCase();
    const reasonLabelMap: Record<string, string> = {
      undelivered_order: 'Undelivered Order',
      breach: 'Policy Breach',
      other: 'Other',
    };
    const reasonLabel = reasonLabelMap[reasonKey] || prettyType(reasonKey);
    const status = String((item as any)?.status || '').toLowerCase();

    const order = (item as any)?.order;
    const orderId = (typeof order === 'string' ? order : order?._id) || (item as any)?.order || '';
    const orderName =
      (typeof order === 'object' ? order?.package_name || order?.meal_name || order?.title : '') || '';
    const customerName = (typeof order === 'object' ? order?.user?.name || order?.user_name : '') || '';
    const orderHint = orderId ? `Order: #${String(orderId).slice(-6)}` : '';

    const penaltyPct = Number((item as any)?.penalty_percentage || 0);
    const orderValue = Number((item as any)?.order_value || 0);

    const dateValue =
      (item as any)?.createdAt ||
      (item as any)?.created_at ||
      (item as any)?.resolved_at ||
      (item as any)?.updatedAt;

    return (
      <View className="bg-white rounded-xl p-4 mb-3 mx-4">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-bold text-textPrimary">{reasonLabel}</Text>
            {(item as any)?.description ? (
              <Text className="text-xs text-textSecondary mt-1" numberOfLines={3}>
                {(item as any)?.description}
              </Text>
            ) : null}
            {orderName || customerName || orderHint ? (
              <Text className="text-xs text-textTertiary mt-1" numberOfLines={2}>
                {[customerName, orderName, orderHint].filter(Boolean).join(' • ')}
              </Text>
            ) : null}
          </View>
          <View className="items-end">
            <Text className="text-base font-bold text-error">-{formatMoney(item.amount)}</Text>
            {status ? (
              <View className="mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: Colors.warning + '15' }}>
                <Text className="text-[10px] font-semibold capitalize" style={{ color: Colors.warning }}>
                  {prettyType(status)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {penaltyPct > 0 && (
          <Text className="text-[10px] text-textTertiary mt-2">
            {orderValue > 0 ? `Order Value: ${formatMoney(orderValue)} • ${penaltyPct}%` : `Penalty: ${penaltyPct}%`}
          </Text>
        )}
        {dateValue && <Text className="text-[10px] text-textTertiary mt-1">{formatDate(dateValue)}</Text>}
      </View>
    );
  };

  const renderLedger = ({ item }: { item: any }) => {
    const direction = String(item?.direction || '').toLowerCase() === 'out' ? 'out' : 'in';
    const amount = toAmount(item?.amount);
    const iconName = direction === 'in' ? 'arrow-up' : 'arrow-down';

    return (
      <View className="bg-white rounded-xl p-4 mb-3 mx-4">
        <View className="flex-row items-center">
          <View
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: direction === 'in' ? Colors.success + '15' : Colors.error + '15' }}
          >
            <Ionicons
              name={iconName as any}
              size={18}
              color={direction === 'in' ? Colors.success : Colors.error}
            />
          </View>
          <View className="flex-1 pr-3">
            <Text className="text-sm font-bold text-textPrimary">{prettyType(item?.type || 'entry')}</Text>
            <Text className="text-xs text-textSecondary mt-0.5" numberOfLines={3}>
              {item?.description || 'No description'}
            </Text>
          </View>
          <Text className="text-base font-bold" style={{ color: direction === 'in' ? Colors.success : Colors.error }}>
            {direction === 'in' ? '+' : '-'}{formatMoney(amount)}
          </Text>
        </View>

        <View className="flex-row justify-between mt-3 pt-2 border-t border-slate-100">
          <Text className="text-[11px] text-textTertiary">{formatDateTime(item?.created_at || item?.date)}</Text>
          <Text className="text-[11px] text-textTertiary">Balance: {formatMoney(item?.balance_after || 0)}</Text>
        </View>
      </View>
    );
  };

  const renderExpense = ({ item }: { item: any }) => (
    <View className="bg-white rounded-xl p-4 mb-3 mx-4">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-textPrimary">{item.title}</Text>
          <Text className="text-xs text-textTertiary mt-0.5">{item.category}</Text>
        </View>
        <Text className="text-base font-bold text-textPrimary">{formatMoney(item.amount)}</Text>
      </View>
      <Text className="text-xs text-textTertiary mt-2">{formatDate(item.date)}</Text>
    </View>
  );

  // Tab configuration
  const tabs = [
    { key: 'settlements', label: 'Settlements', icon: 'wallet' },
    { key: 'penalties', label: 'Penalties', icon: 'warning' },
    { key: 'ledger', label: 'Ledger', icon: 'book' },
    { key: 'expenses', label: 'Expenses', icon: 'card' },
  ] as const;

  const dataMap = { settlements: sortedSettlements, penalties, ledger, expenses };
  const renderMap = {
    settlements: renderSettlement,
    penalties: renderPenalty,
    ledger: renderLedger,
    expenses: renderExpense,
  };

  const getFinanceItemKey = (item: any, index: number) => {
    const explicit = item?._id || item?.id || item?.entry_id || item?.txn_id;
    if (explicit) return String(explicit);
    return `${tab}-${index}`;
  };

  const currentData = dataMap[tab];
  const renderFunction = renderMap[tab];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Tabs */}
      <View className="bg-white border-b border-slate-200 px-4 py-2">
        <View className="flex-row gap-1">
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              className={`flex-1 py-3 rounded-lg flex-row items-center justify-center gap-1.5 ${tab === t.key ? 'bg-blue-100' : 'bg-slate-100'
                }`}
            >
              <Ionicons
                name={t.icon as any}
                size={14}
                color={tab === t.key ? Colors.primary : Colors.textSecondary}
              />
              <Text
                className={`text-[11px] font-semibold ${tab === t.key ? 'text-blue-700' : 'text-textSecondary'
                  }`}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'expenses' && (
          <View className="mt-2">
            <TouchableOpacity
              onPress={() => router.push('/expenses')}
              className="self-end px-3 py-2 rounded-lg flex-row items-center"
              style={{ backgroundColor: Colors.primary + '15' }}
            >
              <Ionicons name="add-circle-outline" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text className="text-xs font-semibold" style={{ color: Colors.primary }}>
                Add Expense
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-textSecondary">Loading...</Text>
        </View>
      ) : currentData.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="archive" size={48} color={Colors.textTertiary} />
          <Text className="text-textSecondary mt-2">No {tab} data</Text>
        </View>
      ) : (
        <FlatList
          data={currentData as any}
          renderItem={renderFunction as any}
          keyExtractor={getFinanceItemKey}
          ListHeaderComponent={renderSummaryHeader}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAll();
              }}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
