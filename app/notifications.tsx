import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNotificationStore } from 'store/notificationStore';
import { Colors } from 'constants/theme';
import type { Notification } from 'types';

export default function NotificationsScreen() {
  const { notifications, loading, fetchNotifications, markRead, markAllRead } =
    useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      onPress={() => {
        if (!item.is_read) markRead(item._id);
      }}
      className="bg-white px-4 py-3.5 border-b border-divider"
      style={{ opacity: item.is_read ? 0.7 : 1 }}
    >
      <View className="flex-row items-start">
        {!item.is_read && <View className="w-2 h-2 rounded-full bg-primary mt-2 mr-2" />}
        <View className="flex-1">
          <Text className="text-sm font-semibold text-textPrimary">{item.title}</Text>
          <Text className="text-sm text-textSecondary mt-1">{item.body}</Text>
          <Text className="text-xs text-textTertiary mt-1.5">
            {new Date(item.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary flex-1">Notifications</Text>
        <TouchableOpacity onPress={markAllRead}>
          <Text className="text-sm text-primary font-medium">Mark all read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchNotifications} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View className="items-center py-20">
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textTertiary} />
            <Text className="text-textTertiary mt-3">No notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
