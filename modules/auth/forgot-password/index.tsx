import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { authService } from 'services/authService';
import Toast from 'react-native-toast-message';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter your email' });
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      Toast.show({ type: 'success', text1: 'OTP sent to your email' });
      setStep('otp');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to send OTP' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp.trim() || !newPassword.trim()) {
      Toast.show({ type: 'error', text1: 'Please fill all fields' });
      return;
    }
    if (newPassword.length < 6) {
      Toast.show({ type: 'error', text1: 'Password must be at least 6 characters' });
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(email.trim().toLowerCase(), otp.trim(), newPassword);
      Toast.show({ type: 'success', text1: 'Password reset successful!' });
      router.back();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Reset failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-textPrimary mb-2">
          {step === 'email' ? 'Forgot Password' : 'Reset Password'}
        </Text>
        <Text className="text-textSecondary mb-8">
          {step === 'email'
            ? 'Enter your registered email to receive an OTP'
            : 'Enter the OTP and your new password'}
        </Text>

        {step === 'email' ? (
          <>
            <Text className="text-sm font-medium text-textSecondary mb-1.5">Email</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3.5 text-base text-textPrimary mb-6"
              placeholder="store@example.com"
              placeholderTextColor="#9E9E9E"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={handleSendOtp}
              disabled={loading}
              className="bg-primary rounded-xl py-4 items-center"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-base font-bold">Send OTP</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text className="text-sm font-medium text-textSecondary mb-1.5">OTP</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3.5 text-base text-textPrimary mb-4"
              placeholder="Enter OTP"
              placeholderTextColor="#9E9E9E"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
            />
            <Text className="text-sm font-medium text-textSecondary mb-1.5">New Password</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3.5 text-base text-textPrimary mb-6"
              placeholder="Enter new password"
              placeholderTextColor="#9E9E9E"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={loading}
              className="bg-primary rounded-xl py-4 items-center"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-base font-bold">Reset Password</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
