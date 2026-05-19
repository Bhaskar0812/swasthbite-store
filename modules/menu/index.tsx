import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Switch,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStoreStore } from 'store/storeStore';
import { Colors } from 'constants/theme';
import type { MenuItem } from 'types';

export default function MenuScreen() {
  const { menuItems, packages, fetchMenuItems, fetchPackages, toggleItemStock, toggleItemInstantAvailability, togglePackage } =
    useStoreStore();
  const [tab, setTab] = useState<'items' | 'packages'>('items');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMenuItems();
    fetchPackages();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMenuItems(), fetchPackages()]);
    setRefreshing(false);
  }, []);

  const filteredItems = menuItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPackages = packages.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }: { item: MenuItem }) => (
    <View className="bg-white rounded-xl p-4 mb-3 mx-4 flex-row items-center">
      <View className="flex-1">
        <View className="flex-row items-center">
          {item.is_veg !== undefined && (
            <View
              className="w-4 h-4 border-2 rounded-sm mr-2 items-center justify-center"
              style={{ borderColor: item.is_veg ? Colors.success : Colors.error }}
            >
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.is_veg ? Colors.success : Colors.error }}
              />
            </View>
          )}
          <Text className="text-base font-semibold text-textPrimary flex-1" numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Text className="text-sm text-textSecondary mt-1">₹{item.price}</Text>
        {item.categories?.[0]?.name && (
          <Text className="text-xs text-textTertiary mt-0.5">{item.categories[0].name}</Text>
        )}
      </View>
      <View className="items-center">
        <View className="flex-row items-center mb-2">
          <Text className="text-xs mr-2" style={{ color: item.store_available ? Colors.success : Colors.offline }}>
            Stock
          </Text>
          <Switch
            value={item.store_available}
            onValueChange={(val) => toggleItemStock(item._id, val)}
            trackColor={{ false: '#E0E0E0', true: Colors.success + '50' }}
            thumbColor={item.store_available ? Colors.success : '#9E9E9E'}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
        <View className="flex-row items-center">
          <Text className="text-xs mr-2" style={{ color: item.available_for_instant ? Colors.primary : Colors.offline }}>
            Instant
          </Text>
          <Switch
            value={item.available_for_instant}
            onValueChange={(val) => toggleItemInstantAvailability(item._id, val)}
            trackColor={{ false: '#E0E0E0', true: Colors.primary + '50' }}
            thumbColor={item.available_for_instant ? Colors.primary : '#9E9E9E'}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
      </View>
    </View>
  );

  const renderPackage = ({ item }: { item: any }) => (
    <View className="bg-white rounded-xl p-4 mb-3 mx-4 flex-row items-center">
      <View className="flex-1">
        <Text className="text-base font-semibold text-textPrimary">{item.name}</Text>
        <Text className="text-sm text-textSecondary mt-1">₹{item.price}</Text>
        {item.duration_days && (
          <Text className="text-xs text-textTertiary mt-0.5">
            {item.duration_days} days • {item.meals_per_day || 1} meals/day
          </Text>
        )}
      </View>
      <View className="items-center">
        <Switch
          value={item.store_selected}
          onValueChange={() => togglePackage(item._id)}
          trackColor={{ false: '#E0E0E0', true: Colors.success + '50' }}
          thumbColor={item.store_selected ? Colors.success : '#9E9E9E'}
        />
        <Text className="text-xs mt-0.5" style={{ color: item.store_selected ? Colors.success : Colors.offline }}>
          {item.store_selected ? 'Active' : 'Off'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3">
        <Text className="text-xl font-bold text-textPrimary mb-3">Menu Management</Text>

        {/* Tab Switcher */}
        <View className="flex-row bg-white rounded-xl p-1 mb-3">
          {(['items', 'packages'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              className="flex-1 py-2.5 rounded-lg items-center"
              style={tab === t ? { backgroundColor: Colors.primary } : {}}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: tab === t ? '#fff' : Colors.textSecondary }}
              >
                {t === 'items' ? 'Menu Items' : 'Packages'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View className="flex-row bg-white rounded-xl px-3 py-2.5 items-center border border-border">
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            className="flex-1 ml-2 text-sm text-textPrimary"
            placeholder={`Search ${tab}...`}
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {tab === 'items' ? (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={
            <View className="items-center py-20">
              <Ionicons name="restaurant-outline" size={48} color={Colors.textTertiary} />
              <Text className="text-textTertiary mt-3">No menu items found</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredPackages}
          keyExtractor={(item) => item._id}
          renderItem={renderPackage}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={
            <View className="items-center py-20">
              <Ionicons name="cube-outline" size={48} color={Colors.textTertiary} />
              <Text className="text-textTertiary mt-3">No packages found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
