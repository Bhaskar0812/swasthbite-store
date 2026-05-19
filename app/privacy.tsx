import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from 'constants/theme';

export default function PrivacyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary">Privacy Policy</Text>
      </View>
      <ScrollView className="flex-1 p-4">
        <View className="bg-white rounded-2xl p-5">
          <Text className="text-base font-bold text-textPrimary mb-3">SwasthBite Privacy Policy</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </Text>
          <Text className="text-sm font-semibold text-textPrimary mb-1">Information We Collect</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            We collect store details, bank account information, order data, and usage analytics to provide our services.
          </Text>
          <Text className="text-sm font-semibold text-textPrimary mb-1">How We Use Your Data</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            Your data is used to process orders, handle settlements, provide customer support, and improve our platform.
          </Text>
          <Text className="text-sm font-semibold text-textPrimary mb-1">Data Security</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            We use industry-standard encryption and security practices to protect your data. Bank details are stored securely and never shared with third parties.
          </Text>
          <Text className="text-sm font-semibold text-textPrimary mb-1">Contact</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            For privacy-related concerns, contact us at support@swasthbite.in
          </Text>
          <Text className="text-xs text-textTertiary mt-4">Last updated: January 2025</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
