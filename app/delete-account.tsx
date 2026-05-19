import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { authService } from 'services/authService';
import { useAuthStore } from 'store/authStore';
import { Colors } from 'constants/theme';

export default function DeleteAccountScreen() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submitDeletion = async () => {
    if (!password.trim()) {
      Alert.alert('Password required', 'Please enter your password to confirm the request.');
      return;
    }

    Alert.alert(
      'Confirm deletion request',
      'This will submit your account deletion request and sign you out after confirmation. The request cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit request',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await authService.requestDeletion({
                password: password.trim(),
                reason: reason.trim(),
              });
              await logout();
              Alert.alert(
                'Request submitted',
                'Your account deletion request has been submitted successfully.',
                [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
              );
            } catch (error: any) {
              const message =
                error?.response?.data?.message ||
                'We could not submit your deletion request. Please try again.';
              Alert.alert('Deletion failed', message);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary">Delete Account</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="bg-white rounded-3xl p-5 mb-4 border border-divider">
          <View className="w-14 h-14 rounded-2xl bg-red-50 items-center justify-center mb-4">
            <Ionicons name="warning-outline" size={28} color={Colors.error} />
          </View>
          <Text className="text-xl font-bold text-textPrimary mb-2">Close your store partner account</Text>
          <Text className="text-sm text-textSecondary leading-5">
            Submit a deletion request for {user?.store_name || user?.name || 'your account'}.
            The request is password-protected and reviewed by our team before permanent removal.
          </Text>
        </View>

        <View className="bg-white rounded-3xl p-5 mb-4 border border-divider">
          <Text className="text-base font-bold text-textPrimary mb-3">What happens next</Text>
          {[
            'Your deletion request is submitted immediately after password verification.',
            'An admin reviews the request before account removal.',
            'Pending payouts and required legal records may be retained as required by law.',
            'You will be logged out from all devices after submission.',
          ].map((item) => (
            <View key={item} className="flex-row items-start mb-3">
              <View className="w-2 h-2 rounded-full bg-primary mt-2 mr-3" />
              <Text className="flex-1 text-sm text-textSecondary leading-5">{item}</Text>
            </View>
          ))}
        </View>

        <View className="bg-white rounded-3xl p-5 mb-4 border border-divider">
          <Text className="text-base font-bold text-textPrimary mb-2">Reason for deletion</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Optional reason"
            multiline
            textAlignVertical="top"
            className="border border-divider rounded-2xl px-4 py-3 text-textPrimary min-h-[96px]"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View className="bg-white rounded-3xl p-5 mb-5 border border-divider">
          <Text className="text-base font-bold text-textPrimary mb-2">Confirm with password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            className="border border-divider rounded-2xl px-4 py-3 text-textPrimary"
            placeholderTextColor={Colors.textTertiary}
          />
          <Text className="text-xs text-textTertiary mt-3 leading-5">
            This request cannot be reversed after submission. Account deletion may take up to 30 days.
          </Text>
        </View>

        <TouchableOpacity
          onPress={submitDeletion}
          disabled={loading}
          className="rounded-2xl px-4 py-4 items-center justify-center"
          style={{ backgroundColor: Colors.error }}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-bold">Submit deletion request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
