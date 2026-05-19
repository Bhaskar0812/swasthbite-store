import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from 'constants/theme';

export default function TermsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary">Terms & Conditions</Text>
      </View>
      <ScrollView className="flex-1 p-4">
        <View className="bg-white rounded-2xl p-5">
          <Text className="text-base font-bold text-textPrimary mb-3">SwasthBite Partner Terms of Service</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            By using the SwasthBite Partner app, you agree to the following terms and conditions. Please read them carefully.
          </Text>
          <Text className="text-sm font-semibold text-textPrimary mb-1">1. Partner Obligations</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            As a store partner, you agree to maintain high quality standards, provide accurate menu information, and ensure timely order preparation.
          </Text>
          <Text className="text-sm font-semibold text-textPrimary mb-1">2. Payments & Settlements</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            Settlements are processed as per the agreed frequency. Any penalties for late deliveries, cancellations, or quality issues will be deducted from settlements.
          </Text>
          <Text className="text-sm font-semibold text-textPrimary mb-1">3. Dispute Resolution</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            Any disputes will be handled through our customer support. SwasthBite reserves the right to deactivate stores that consistently violate terms.
          </Text>
          <Text className="text-sm font-semibold text-textPrimary mb-1">4. Intellectual Property</Text>
          <Text className="text-sm text-textSecondary leading-5 mb-3">
            SwasthBite branding and app content are owned by SwasthBite. Partners may not use our branding without written consent.
          </Text>
          <Text className="text-xs text-textTertiary mt-4">Last updated: January 2025</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
