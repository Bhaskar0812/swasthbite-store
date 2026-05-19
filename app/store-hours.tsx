import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Colors } from 'constants/theme';
import { storeService } from 'services/storeService';

const DAYS = [
  { day_index: 0, label: 'Sun' },
  { day_index: 1, label: 'Mon' },
  { day_index: 2, label: 'Tue' },
  { day_index: 3, label: 'Wed' },
  { day_index: 4, label: 'Thu' },
  { day_index: 5, label: 'Fri' },
  { day_index: 6, label: 'Sat' },
];

type DayRow = {
  day_index: number;
  label: string;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

type PickerState = {
  visible: boolean;
  dayIndex: number | null;
  field: 'open_time' | 'close_time' | null;
  value: Date;
};

const parseTime = (value: string) => {
  const [hours = '9', minutes = '0'] = String(value || '09:00').split(':');
  const date = new Date();
  date.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return date;
};

const formatTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const defaultWeekly = (): DayRow[] =>
  DAYS.map((day) => ({
    ...day,
    is_open: day.day_index !== 0,
    open_time: '09:00',
    close_time: '21:00',
  }));

export default function StoreHoursScreen() {
  const [enabled, setEnabled] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [weekly, setWeekly] = useState<DayRow[]>(defaultWeekly());
  const [repeatForWeek, setRepeatForWeek] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<PickerState>({
    visible: false,
    dayIndex: null,
    field: null,
    value: parseTime('09:00'),
  });

  const loadHours = async () => {
    try {
      setLoading(true);
      const res = await storeService.getStoreHours();
      const hours = res.data?.operating_hours || {};
      const weeklyHours = Array.isArray(hours.weekly) && hours.weekly.length === 7 ? hours.weekly : defaultWeekly();
      setEnabled(Boolean(hours.enabled));
      setOpenNow(Boolean(res.data?.open_now));
      setWeekly(
        DAYS.map((day) => {
          const row = weeklyHours.find((entry: any) => Number(entry.day_index) === day.day_index);
          return {
            day_index: day.day_index,
            label: day.label,
            is_open: Boolean(row?.is_open),
            open_time: String(row?.open_time || '09:00'),
            close_time: String(row?.close_time || '21:00'),
          };
        }),
      );
    } catch (error: any) {
      Toast.show({ type: 'error', text1: error?.response?.data?.message || 'Failed to load store hours' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHours();
  }, []);

  const updateRow = (index: number, key: 'is_open' | 'open_time' | 'close_time', value: boolean | string) => {
    setWeekly((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const applyRowToWeek = (index: number) => {
    const source = weekly[index];
    if (!source) return;

    setWeekly((current) =>
      current.map((row) =>
        row.day_index === source.day_index
          ? row
          : row.is_open
            ? {
              ...row,
              open_time: source.open_time,
              close_time: source.close_time,
            }
            : row,
      ),
    );
    Toast.show({ type: 'success', text1: `Applied ${source.label}'s time to the week` });
  };

  const openPicker = (dayIndex: number, field: 'open_time' | 'close_time', currentValue: string) => {
    setPicker({
      visible: true,
      dayIndex,
      field,
      value: parseTime(currentValue),
    });
  };

  const confirmPicker = (selectedDate?: Date) => {
    if (picker.dayIndex === null || !picker.field) return;
    const nextValue = formatTime(selectedDate || picker.value);
    const targetIndex = picker.dayIndex;

    setWeekly((current) =>
      current.map((row) => {
        if (repeatForWeek && row.is_open && picker.field) {
          const sourceRow = current[targetIndex];
          return {
            ...row,
            [picker.field]: nextValue,
            ...(picker.field === 'open_time' && sourceRow?.close_time ? { close_time: sourceRow.close_time } : {}),
          } as DayRow;
        }

        if (row.day_index === targetIndex) {
          return { ...row, [picker.field]: nextValue } as DayRow;
        }
        return row;
      }),
    );

    setPicker({ visible: false, dayIndex: null, field: null, value: picker.value });
  };

  const pickerTitle = useMemo(() => {
    if (picker.dayIndex === null || !picker.field) return 'Pick time';
    const day = DAYS.find((d) => d.day_index === picker.dayIndex)?.label || '';
    return `${day} ${picker.field === 'open_time' ? 'opening' : 'closing'} time`;
  }, [picker.dayIndex, picker.field]);

  const onSave = async () => {
    try {
      setSaving(true);
      const res = await storeService.updateStoreHours({
        enabled,
        timezone: 'Asia/Kolkata',
        weekly,
      });
      setOpenNow(Boolean(res.data?.open_now));
      Toast.show({ type: 'success', text1: 'Store hours updated' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: error?.response?.data?.message || 'Failed to update store hours' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity onPress={() => router.back()} className="w-11 h-11 rounded-full items-center justify-center bg-white">
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-textPrimary">Store Hours</Text>
          <View className="w-11 h-11" />
        </View>

        <View className="bg-blue-600 rounded-3xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-white text-lg font-bold">Weekly schedule</Text>
              <Text className="text-blue-100 text-sm mt-1">Set day-wise open and close times for your store.</Text>
            </View>
            <View className="items-end">
              <Text className="text-blue-100 text-xs">Current</Text>
              <Text className="text-white font-bold mt-0.5">{openNow ? 'Open' : 'Closed'}</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-4 bg-white/10 rounded-2xl px-4 py-3">
            <View>
              <Text className="text-white font-semibold">Enable weekly hours</Text>
              <Text className="text-blue-100 text-xs mt-0.5">Auto-close will follow this schedule.</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={enabled ? '#fff' : '#fff'}
            />
          </View>

          <View className="flex-row items-center justify-between mt-3 bg-white/10 rounded-2xl px-4 py-3">
            <View className="flex-1 pr-3">
              <Text className="text-white font-semibold">Repeat same time for week</Text>
              <Text className="text-blue-100 text-xs mt-0.5">Pick one day and apply it to all open days.</Text>
            </View>
            <Switch
              value={repeatForWeek}
              onValueChange={setRepeatForWeek}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={repeatForWeek ? '#fff' : '#fff'}
            />
          </View>
        </View>

        {loading ? (
          <View className="bg-white rounded-2xl p-4 items-center">
            <Text className="text-textSecondary">Loading hours...</Text>
          </View>
        ) : (
          weekly.map((day, index) => (
            <View key={day.day_index} className="bg-white rounded-2xl p-4 mb-3 shadow-sm" style={{ elevation: 2 }}>
              <View className="flex-row items-center justify-between mb-3">
                <View>
                  <Text className="text-base font-bold text-textPrimary">{day.label}</Text>
                  <Text className="text-xs text-textSecondary mt-0.5">Set opening hours for this day</Text>
                </View>
                <Switch value={day.is_open} onValueChange={(value) => updateRow(index, 'is_open', value)} trackColor={{ false: '#E5E7EB', true: Colors.success + '55' }} thumbColor={day.is_open ? Colors.success : '#9CA3AF'} />
              </View>

              {day.is_open ? (
                <View className="flex-row">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs text-textSecondary mb-1">Open</Text>
                    <TouchableOpacity
                      onPress={() => openPicker(index, 'open_time', day.open_time)}
                      className="bg-slate-50 rounded-xl px-3 py-3 flex-row items-center justify-between"
                    >
                      <Text className="text-textPrimary font-medium">{day.open_time}</Text>
                      <Ionicons name="time-outline" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-1 ml-2">
                    <Text className="text-xs text-textSecondary mb-1">Close</Text>
                    <TouchableOpacity
                      onPress={() => openPicker(index, 'close_time', day.close_time)}
                      className="bg-slate-50 rounded-xl px-3 py-3 flex-row items-center justify-between"
                    >
                      <Text className="text-textPrimary font-medium">{day.close_time}</Text>
                      <Ionicons name="time-outline" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View className="bg-slate-50 rounded-xl px-3 py-3">
                  <Text className="text-xs text-textSecondary">Closed on this day</Text>
                </View>
              )}

              <View className="flex-row items-center justify-between mt-3">
                <Text className="text-xs text-textTertiary">
                  {day.is_open ? 'Use copy to week for same timings' : 'Enable this day to set hours'}
                </Text>
                {day.is_open ? (
                  <TouchableOpacity onPress={() => applyRowToWeek(index)} className="px-3 py-2 rounded-xl" style={{ backgroundColor: Colors.info + '15' }}>
                    <Text className="text-xs font-semibold" style={{ color: Colors.info }}>Apply to week</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}

        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          className="rounded-2xl py-4 items-center mt-2"
          style={{ backgroundColor: Colors.primary }}
        >
          <Text className="text-white font-bold">{saving ? 'Saving...' : 'Save Store Hours'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} className="py-4 items-center mt-2">
          <Text className="text-sm font-semibold" style={{ color: Colors.primary }}>Back</Text>
        </TouchableOpacity>
      </ScrollView>

      {picker.visible ? (
        <Modal transparent animationType="fade" visible={picker.visible} onRequestClose={() => setPicker({ visible: false, dayIndex: null, field: null, value: picker.value })}>
          <View className="flex-1 bg-black/40 items-center justify-end">
            <View className="w-full bg-white rounded-t-3xl p-4">
              <View className="flex-row items-center justify-between mb-3">
                <TouchableOpacity onPress={() => setPicker({ visible: false, dayIndex: null, field: null, value: picker.value })}>
                  <Text className="text-sm font-semibold" style={{ color: Colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <Text className="text-base font-bold text-textPrimary">{pickerTitle}</Text>
                <TouchableOpacity onPress={() => confirmPicker(picker.value)}>
                  <Text className="text-sm font-semibold" style={{ color: Colors.primary }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={picker.value}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    if (event.type === 'set' && selectedDate) confirmPicker(selectedDate);
                    else setPicker({ visible: false, dayIndex: null, field: null, value: picker.value });
                    return;
                  }
                  if (selectedDate) setPicker((current) => ({ ...current, value: selectedDate }));
                }}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}
