import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from 'store/authStore';
import { useNotificationStore } from 'store/notificationStore';
import { Colors } from 'constants/theme';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const handleCopyStoreId = async () => {
    const storeId = user?._id || '';
    if (!storeId) {
      Alert.alert('Error', 'Store ID not found');
      return;
    }
    Alert.alert('Your Store ID', storeId, [
      {
        text: 'Close',
        style: 'cancel',
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const MenuItem = ({
    icon,
    label,
    route,
    badge,
    color,
  }: {
    icon: string;
    label: string;
    route: string;
    badge?: number;
    color?: string;
  }) => (
    <TouchableOpacity
      onPress={() => router.push(route as any)}
      className="flex-row items-center bg-white px-4 py-3.5 border-b border-divider"
      activeOpacity={0.7}
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: (color || Colors.primary) + '15' }}
      >
        <Ionicons name={icon as any} size={18} color={color || Colors.primary} />
      </View>
      <Text className="flex-1 text-base text-textPrimary">{label}</Text>
      {badge ? (
        <View className="bg-primary rounded-full w-5 h-5 items-center justify-center mr-2">
          <Text className="text-white text-xs font-bold">{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView>
        {/* Profile Header */}
        <View className="bg-white p-5 items-center mb-3">
          <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-3">
            <Text className="text-white text-2xl font-bold">
              {(user?.store_name || user?.name || 'S')[0].toUpperCase()}
            </Text>
          </View>
          <Text className="text-lg font-bold text-textPrimary">
            {user?.store_name || user?.name || 'Store'}
          </Text>
          <Text className="text-sm text-textSecondary">{user?.email}</Text>
          {user?.phone_number && (
            <Text className="text-sm text-textTertiary mt-0.5">{user.phone_number}</Text>
          )}

          {/* Store ID with Copy Button */}
          {user?._id && (
            <TouchableOpacity
              onPress={handleCopyStoreId}
              className="mt-3 flex-row items-center justify-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: Colors.info + '15' }}
            >
              <Ionicons name="copy-outline" size={14} color={Colors.info} />
              <Text className="text-xs font-semibold ml-1.5" style={{ color: Colors.info }}>
                Store ID: {user._id.substring(0, 8)}...
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu Items */}
        <View className="mb-3">
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            route="/notifications"
            badge={unreadCount}
          />
          <MenuItem icon="chatbubbles-outline" label="Customer Chat" route="/chat" color={Colors.info} />
          <MenuItem icon="card-outline" label="Bank Account" route="/bank-account" color={Colors.success} />
          <MenuItem icon="pricetag-outline" label="Promotions" route="/promotions" color={Colors.accent} />
          <MenuItem icon="return-down-back-outline" label="Refunds" route="/refunds" color={Colors.warning} />
          <MenuItem icon="receipt-outline" label="Expenses" route="/expenses" color={Colors.info} />
          <MenuItem icon="speedometer-outline" label="Store Charges" route="/charges" color={Colors.info} />
          <MenuItem icon="time-outline" label="Store Hours" route="/store-hours" color={Colors.info} />
        </View>

        <View className="mb-3">
          <MenuItem icon="document-text-outline" label="Terms & Conditions" route="/terms" />
          <MenuItem icon="shield-outline" label="Privacy Policy" route="/privacy" />
          <MenuItem icon="trash-outline" label="Delete Account" route="/delete-account" color={Colors.error} />
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center bg-white px-4 py-4 mb-6"
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text className="text-base font-semibold text-error ml-3">Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
