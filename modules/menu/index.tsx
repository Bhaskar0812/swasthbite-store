import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Switch,
  RefreshControl,
  TextInput,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStoreStore } from 'store/storeStore';
import { Colors } from 'constants/theme';
import type { MenuItem } from 'types';
import { pickImageUrl } from 'utils/image';

type MainTab = 'items' | 'packages';
type ItemFilter = 'menu' | 'out' | 'catalog';

export default function MenuScreen() {
  const {
    menuItems,
    packages,
    menuItemIds,
    fetchMenuItems,
    fetchPackages,
    fetchMenuStatus,
    toggleItemStock,
    toggleItemInstantAvailability,
    togglePackage,
    updateItemPrice,
    addMenuItems,
    removeMenuItems,
  } = useStoreStore();

  const [tab, setTab] = useState<MainTab>('items');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('menu');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const [priceModal, setPriceModal] = useState<{
    open: boolean;
    item: MenuItem | null;
    price: string;
    mrp: string;
    saving: boolean;
  }>({ open: false, item: null, price: '', mrp: '', saving: false });

  useEffect(() => {
    fetchMenuItems();
    fetchPackages();
    fetchMenuStatus();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMenuItems(), fetchPackages(), fetchMenuStatus()]);
    setRefreshing(false);
  }, [fetchMenuItems, fetchPackages, fetchMenuStatus]);

  const selectedSet = useMemo(
    () => new Set((menuItemIds || []).map((id) => String(id))),
    [menuItemIds],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      const onMenu = selectedSet.has(String(item._id));
      if (itemFilter === 'menu' && !onMenu) return false;
      if (itemFilter === 'out' && !(onMenu && item.store_available === false)) return false;
      if (itemFilter === 'catalog' && onMenu) return false;
      if (!q) return true;
      return String(item.name || '').toLowerCase().includes(q);
    });
  }, [menuItems, selectedSet, itemFilter, search]);

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packages.filter((p) =>
      !q ? true : String(p.name || '').toLowerCase().includes(q),
    );
  }, [packages, search]);

  const onToggleStock = async (item: MenuItem, value: boolean) => {
    try {
      setBusyId(`${item._id}-stock`);
      await toggleItemStock(item._id, value);
    } catch (err: any) {
      Alert.alert('Stock update failed', err?.response?.data?.message || 'Could not update stock');
    } finally {
      setBusyId(null);
    }
  };

  const onToggleInstant = async (item: MenuItem, value: boolean) => {
    try {
      setBusyId(`${item._id}-instant`);
      await toggleItemInstantAvailability(item._id, value);
    } catch (err: any) {
      Alert.alert(
        'Instant update failed',
        err?.response?.data?.message || 'Could not update instant availability',
      );
    } finally {
      setBusyId(null);
    }
  };

  const openPriceEditor = (item: MenuItem) => {
    setPriceModal({
      open: true,
      item,
      price:
        item.store_price != null
          ? String(item.store_price)
          : String(item.price ?? ''),
      mrp: item.store_mrp != null ? String(item.store_mrp) : '',
      saving: false,
    });
  };

  const savePrice = async () => {
    if (!priceModal.item) return;
    const price =
      priceModal.price.trim() === '' ? null : Number(priceModal.price);
    const mrp = priceModal.mrp.trim() === '' ? null : Number(priceModal.mrp);
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      Alert.alert('Invalid price', 'Enter a valid selling price');
      return;
    }
    if (mrp != null && (!Number.isFinite(mrp) || mrp < 0)) {
      Alert.alert('Invalid MRP', 'Enter a valid MRP');
      return;
    }
    try {
      setPriceModal((prev) => ({ ...prev, saving: true }));
      await updateItemPrice(priceModal.item._id, price, mrp);
      setPriceModal({ open: false, item: null, price: '', mrp: '', saving: false });
    } catch (err: any) {
      Alert.alert('Price update failed', err?.response?.data?.message || 'Could not update price');
      setPriceModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const onAddItem = async (itemId: string) => {
    try {
      setBusyId(`${itemId}-add`);
      await addMenuItems([itemId]);
    } catch (err: any) {
      Alert.alert('Add failed', err?.response?.data?.message || 'Could not add item');
    } finally {
      setBusyId(null);
    }
  };

  const onRemoveItem = (item: MenuItem) => {
    Alert.alert(
      'Remove from menu?',
      `${item.name} will be removed from your store menu.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyId(`${item._id}-remove`);
              await removeMenuItems([item._id]);
            } catch (err: any) {
              Alert.alert(
                'Remove failed',
                err?.response?.data?.message || 'Could not remove item',
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const displayPrice = (item: MenuItem) => {
    if (item.store_price != null) return Number(item.store_price);
    return Number(item.price || 0);
  };

  const renderItem = ({ item }: { item: MenuItem }) => {
    const onMenu = selectedSet.has(String(item._id));
    const inStock = item.store_available !== false;
    const imageUrl = pickImageUrl(item, ['image', 'image_url', 'thumbnail', 'photo']);
    const stockBusy = busyId === `${item._id}-stock`;
    const addBusy = busyId === `${item._id}-add`;

    return (
      <View
        className="bg-white rounded-2xl p-3.5 mb-3 mx-4 border"
        style={{
          borderColor: onMenu
            ? inStock
              ? '#C8E6C9'
              : '#FFCDD2'
            : '#E5E7EB',
        }}
      >
        <View className="flex-row items-center">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: 56, height: 56, borderRadius: 12, marginRight: 12 }}
              resizeMode="cover"
            />
          ) : (
            <View
              className="mr-3 items-center justify-center rounded-xl"
              style={{ width: 56, height: 56, backgroundColor: '#F3F4F6' }}
            >
              <Text style={{ fontSize: 22 }}>🍽️</Text>
            </View>
          )}

          <View className="flex-1">
            <View className="flex-row items-center">
              {item.is_veg !== undefined && (
                <View
                  className="w-3.5 h-3.5 border-2 rounded-sm mr-1.5 items-center justify-center"
                  style={{ borderColor: item.is_veg ? Colors.success : Colors.error }}
                >
                  <View
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: item.is_veg ? Colors.success : Colors.error }}
                  />
                </View>
              )}
              <Text className="text-base font-semibold text-textPrimary flex-1" numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <View className="flex-row items-center mt-1">
              <Text className="text-sm font-bold" style={{ color: Colors.primary }}>
                ₹{displayPrice(item)}
              </Text>
              {item.store_price != null && Number(item.price) !== Number(item.store_price) && (
                <Text className="text-xs text-textTertiary line-through ml-2">₹{item.price}</Text>
              )}
              <Text
                className="text-[10px] font-bold ml-2 px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: inStock && onMenu ? '#E8F5E9' : '#FFEBEE',
                  color: inStock && onMenu ? '#2E7D32' : '#C62828',
                }}
              >
                {!onMenu ? 'NOT ON MENU' : inStock ? 'IN STOCK' : 'OUT OF STOCK'}
              </Text>
            </View>
          </View>
        </View>

        {onMenu ? (
          <View className="flex-row mt-3 gap-2">
            <TouchableOpacity
              onPress={() => onToggleStock(item, !inStock)}
              disabled={stockBusy}
              className="flex-1 py-2.5 rounded-xl items-center"
              style={{
                backgroundColor: inStock ? '#FFEBEE' : '#E8F5E9',
                opacity: stockBusy ? 0.6 : 1,
              }}
            >
              {stockBusy ? (
                <ActivityIndicator size="small" color={inStock ? '#C62828' : '#2E7D32'} />
              ) : (
                <Text
                  className="text-xs font-bold"
                  style={{ color: inStock ? '#C62828' : '#2E7D32' }}
                >
                  {inStock ? 'Mark Out of Stock' : 'Mark In Stock'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openPriceEditor(item)}
              className="px-3 py-2.5 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#EDE7F6' }}
            >
              <Text className="text-xs font-bold" style={{ color: '#6A1B9A' }}>
                ₹ Price
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onRemoveItem(item)}
              className="px-3 py-2.5 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#F5F5F5' }}
            >
              <Ionicons name="trash-outline" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => onAddItem(item._id)}
            disabled={addBusy}
            className="mt-3 py-2.5 rounded-xl items-center"
            style={{ backgroundColor: Colors.primary, opacity: addBusy ? 0.6 : 1 }}
          >
            {addBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm font-bold text-white">+ Add to My Menu</Text>
            )}
          </TouchableOpacity>
        )}

        {onMenu && (
          <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <Text className="text-xs text-textSecondary">Instant orders</Text>
            <Switch
              value={!!item.available_for_instant && inStock}
              onValueChange={(val) => onToggleInstant(item, val)}
              disabled={busyId === `${item._id}-instant` || !inStock}
              trackColor={{ false: '#E0E0E0', true: Colors.primary + '50' }}
              thumbColor={item.available_for_instant && inStock ? Colors.primary : '#9E9E9E'}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        )}
      </View>
    );
  };

  const renderPackage = ({ item }: { item: any }) => {
    const packageImage = pickImageUrl(item, [
      'image_url',
      'image',
      'thumbnail',
      'thumb',
      'photo',
      'media.url',
      'images',
    ]);
    const price =
      item.store_price != null ? Number(item.store_price) : Number(item.price || 0);

    return (
      <View className="bg-white rounded-2xl p-4 mb-3 mx-4 flex-row items-center border border-gray-100">
        {packageImage ? (
          <View className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 mr-3">
            <Image
              source={{ uri: packageImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
        ) : null}
        <View className="flex-1">
          <Text className="text-base font-semibold text-textPrimary">{item.name}</Text>
          <Text className="text-sm font-bold mt-1" style={{ color: Colors.primary }}>
            ₹{price}
          </Text>
          {item.duration_days && (
            <Text className="text-xs text-textTertiary mt-0.5">
              {item.duration_days} days • {item.meals_per_day || 1} meals/day
            </Text>
          )}
        </View>
        <View className="items-center">
          <Switch
            value={!!item.store_selected}
            onValueChange={() => togglePackage(item._id)}
            trackColor={{ false: '#E0E0E0', true: Colors.success + '50' }}
            thumbColor={item.store_selected ? Colors.success : '#9E9E9E'}
          />
          <Text
            className="text-xs mt-0.5 font-semibold"
            style={{ color: item.store_selected ? Colors.success : Colors.offline }}
          >
            {item.store_selected ? 'Active' : 'Off'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xl font-bold text-textPrimary">Menu Management</Text>
          <TouchableOpacity
            onPress={() => router.push('/catalog-requests' as any)}
            className="flex-row items-center px-3 py-2 rounded-xl"
            style={{ backgroundColor: Colors.primary + '15' }}
          >
            <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
            <Text className="text-sm font-bold ml-1" style={{ color: Colors.primary }}>
              Request item
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row bg-white rounded-xl p-1 mb-3">
          {([
            { key: 'items' as const, label: 'Menu Items' },
            { key: 'packages' as const, label: 'Packages' },
          ]).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              className="flex-1 py-2.5 rounded-lg items-center"
              style={tab === t.key ? { backgroundColor: Colors.primary } : {}}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: tab === t.key ? '#fff' : Colors.textSecondary }}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'items' && (
          <View className="flex-row mb-3 gap-2">
            {(
              [
                { key: 'menu' as const, label: 'My Menu' },
                { key: 'out' as const, label: 'Out of Stock' },
                { key: 'catalog' as const, label: 'Add Items' },
              ] as const
            ).map((f) => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setItemFilter(f.key)}
                className="px-3 py-2 rounded-full"
                style={{
                  backgroundColor: itemFilter === f.key ? Colors.primary : '#fff',
                  borderWidth: 1,
                  borderColor: itemFilter === f.key ? Colors.primary : '#E5E7EB',
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: itemFilter === f.key ? '#fff' : Colors.textSecondary }}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View className="flex-row bg-white rounded-xl px-3 py-2.5 items-center border border-border">
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            className="flex-1 ml-2 text-sm text-textPrimary"
            placeholder={
              tab === 'items'
                ? itemFilter === 'catalog'
                  ? 'Search catalog to add...'
                  : 'Search your menu...'
                : 'Search packages...'
            }
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
          ref={listRef}
          data={filteredItems}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-20 px-8">
              <Ionicons name="restaurant-outline" size={48} color={Colors.textTertiary} />
              <Text className="text-textTertiary mt-3 text-center">
                {itemFilter === 'catalog'
                  ? 'No more catalog items to add'
                  : itemFilter === 'out'
                    ? 'No out-of-stock items'
                    : 'Your menu is empty — open Add Items'}
              </Text>
              {itemFilter === 'menu' && (
                <TouchableOpacity
                  onPress={() => setItemFilter('catalog')}
                  className="mt-4 px-4 py-2.5 rounded-xl"
                  style={{ backgroundColor: Colors.primary }}
                >
                  <Text className="text-white font-bold text-sm">Browse Catalog</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      ) : (
        <FlatList
          data={filteredPackages}
          keyExtractor={(item) => item._id}
          renderItem={renderPackage}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-20">
              <Ionicons name="cube-outline" size={48} color={Colors.textTertiary} />
              <Text className="text-textTertiary mt-3">No packages found</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <Modal
        visible={priceModal.open}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPriceModal({ open: false, item: null, price: '', mrp: '', saving: false })
        }
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center items-center px-5"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <View className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <View className="px-5 py-4" style={{ backgroundColor: '#6A1B9A' }}>
              <Text className="text-white text-lg font-bold">Update Price</Text>
              <Text className="text-white/80 text-sm mt-1" numberOfLines={1}>
                {priceModal.item?.name}
              </Text>
            </View>
            <View className="p-5">
              <Text className="text-xs text-textSecondary mb-1">
                Master price: ₹{priceModal.item?.price ?? 0}
              </Text>
              <Text className="text-sm font-semibold text-textPrimary mb-1.5">Your selling price</Text>
              <TextInput
                value={priceModal.price}
                onChangeText={(v) => setPriceModal((p) => ({ ...p, price: v }))}
                keyboardType="decimal-pad"
                placeholder="e.g. 120"
                className="border border-gray-200 rounded-xl px-3 py-3 text-base mb-3"
              />
              <Text className="text-sm font-semibold text-textPrimary mb-1.5">MRP (optional)</Text>
              <TextInput
                value={priceModal.mrp}
                onChangeText={(v) => setPriceModal((p) => ({ ...p, mrp: v }))}
                keyboardType="decimal-pad"
                placeholder="Strike-through MRP"
                className="border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() =>
                    setPriceModal({ open: false, item: null, price: '', mrp: '', saving: false })
                  }
                  className="flex-1 py-3 rounded-xl items-center bg-gray-100"
                >
                  <Text className="font-semibold text-gray-600">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={savePrice}
                  disabled={priceModal.saving}
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: '#6A1B9A', opacity: priceModal.saving ? 0.7 : 1 }}
                >
                  {priceModal.saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-bold text-white">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
