import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { storeService } from 'services/storeService';
import { authService } from 'services/authService';
import { useAuthStore } from 'store/authStore';
import { Colors } from 'constants/theme';
import Toast from 'react-native-toast-message';
import type { OnboardingStatus } from 'types';

export default function OnboardingScreen() {
  const { onboarding, setOnboarding } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus | null>(onboarding);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const email = useAuthStore.getState().user?.email;
      if (!email) return;
      const res = await authService.getStatus(email);
      const data = res.data;
      setStatus(data);
      setOnboarding(data);
    } catch { } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSignAgreement = async () => {
    setSigning(true);
    try {
      await storeService.signAgreement();
      Toast.show({ type: 'success', text1: 'Agreement signed!' });
      fetchStatus();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to sign' });
    } finally {
      setSigning(false);
    }
  };

  const handlePayment = async () => {
    setPayLoading(true);
    try {
      const orderRes = await storeService.createOnboardingOrder();
      const { order_id, amount, currency, key_id } = orderRes.data;

      let RazorpayCheckout: any;
      try {
        RazorpayCheckout = require('react-native-razorpay').default;
      } catch {
        Toast.show({ type: 'error', text1: 'Payments require a production build' });
        return;
      }

      const user = useAuthStore.getState().user;
      const options = {
        key: key_id,
        amount: String(amount),
        currency: currency || 'INR',
        order_id,
        name: 'Swasth Bite',
        description: 'Store Onboarding Fee',
        prefill: {
          email: user?.email || '',
          contact: user?.phone_number || '',
          name: user?.name || '',
        },
        theme: { color: '#E23744' },
      };

      const paymentData = await RazorpayCheckout.open(options);

      // Confirm payment with backend
      await storeService.confirmOnboardingPayment(paymentData.razorpay_payment_id);
      Toast.show({ type: 'success', text1: 'Payment successful!' });
      fetchStatus();
    } catch (err: any) {
      if (err?.error?.code === 'PAYMENT_CANCELLED') {
        Toast.show({ type: 'info', text1: 'Payment cancelled' });
      } else {
        Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Payment failed' });
      }
    } finally {
      setPayLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const steps = [
    {
      key: 'agreement',
      title: 'Sign Agreement',
      desc: 'Review and sign the store partner agreement',
      done: status?.agreement_signed,
      icon: 'document-text-outline' as const,
    },
    {
      key: 'payment',
      title: 'Complete Payment',
      desc: 'Pay onboarding fee of ₹1,899',
      done: status?.onboarding_paid,
      icon: 'card-outline' as const,
    },
    {
      key: 'approval',
      title: 'Admin Approval',
      desc: 'Wait for admin to approve your store',
      done: status?.onboarding_paid && status?.agreement_signed,
      icon: 'checkmark-circle-outline' as const,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-divider">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-textPrimary">Onboarding</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-2xl font-bold text-textPrimary mb-1">Get Started</Text>
        <Text className="text-sm text-textSecondary mb-6">
          Complete these steps to activate your store on SwasthBite.
        </Text>

        {steps.map((step, idx) => (
          <View key={step.key} className="flex-row mb-4">
            {/* Timeline */}
            <View className="items-center mr-4">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: step.done ? Colors.success : Colors.border }}
              >
                {step.done ? (
                  <Ionicons name="checkmark" size={22} color="#fff" />
                ) : (
                  <Ionicons name={step.icon} size={20} color={Colors.textTertiary} />
                )}
              </View>
              {idx < steps.length - 1 && (
                <View
                  className="w-0.5 flex-1 min-h-[40px]"
                  style={{ backgroundColor: step.done ? Colors.success : Colors.border }}
                />
              )}
            </View>

            {/* Content */}
            <View className="flex-1 bg-white rounded-xl p-4">
              <Text className="text-base font-semibold text-textPrimary">{step.title}</Text>
              <Text className="text-sm text-textSecondary mt-0.5">{step.desc}</Text>

              {step.key === 'agreement' && !step.done && (
                <TouchableOpacity
                  onPress={handleSignAgreement}
                  disabled={signing}
                  className="bg-primary rounded-lg py-2.5 items-center mt-3"
                >
                  {signing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white text-sm font-semibold">Sign Agreement</Text>
                  )}
                </TouchableOpacity>
              )}

              {step.key === 'payment' && !step.done && status?.agreement_signed && (
                <TouchableOpacity
                  onPress={handlePayment}
                  disabled={payLoading}
                  className="bg-primary rounded-lg py-2.5 items-center mt-3"
                >
                  {payLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white text-sm font-semibold">Pay ₹1,899</Text>
                  )}
                </TouchableOpacity>
              )}

              {step.key === 'approval' && status?.agreement_signed && status?.onboarding_paid && (
                <View className="flex-row items-center mt-3 bg-warning/10 rounded-lg p-3">
                  <Ionicons name="time-outline" size={18} color={Colors.warning} />
                  <Text className="text-sm text-warning ml-2">Waiting for admin approval...</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
