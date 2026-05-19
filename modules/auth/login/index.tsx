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
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from 'store/authStore';
import { authService } from 'services/authService';
import Toast from 'react-native-toast-message';

const REGISTRATION_URL = 'https://swasthbite.in/store-registration';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Toast.show({ type: 'error', text1: 'Please enter email and password' });
      return;
    }

    setLoading(true);
    try {
      const res = await authService.login(trimmedEmail, password);
      const d = res.data || res;
      if (d.token) {
        await login(d.token, d.user || d.registration, d.type, d.onboarding);
        router.replace('/(tabs)');
      } else {
        Toast.show({ type: 'error', text1: res.message || 'Login failed' });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Login failed. Please try again.';
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setLoading(false);
    }
  };

  const openRegistration = () => {
    Linking.openURL(REGISTRATION_URL);
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
        {/* Header */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">SP</Text>
          </View>
          <Text className="text-2xl font-bold text-textPrimary">SwasthBite Partner</Text>
          <Text className="text-textSecondary mt-1">Login to manage your store</Text>
        </View>

        {/* Email */}
        <Text className="text-sm font-medium text-textSecondary mb-1.5">Email</Text>
        <TextInput
          className="bg-background border border-border rounded-xl px-4 py-3.5 text-base text-textPrimary mb-4"
          placeholder="store@example.com"
          placeholderTextColor="#9E9E9E"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Password */}
        <Text className="text-sm font-medium text-textSecondary mb-1.5">Password</Text>
        <View className="flex-row bg-background border border-border rounded-xl mb-2 items-center">
          <TextInput
            className="flex-1 px-4 py-3.5 text-base text-textPrimary"
            placeholder="Enter password"
            placeholderTextColor="#9E9E9E"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="px-4">
            <Text className="text-primary text-sm font-medium">
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Forgot Password */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/forgot-password')}
          className="self-end mb-6"
        >
          <Text className="text-primary text-sm font-medium">Forgot Password?</Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className="bg-primary rounded-xl py-4 items-center mb-6"
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-bold">Login</Text>
          )}
        </TouchableOpacity>

        {/* Register Link */}
        <View className="flex-row items-center justify-center">
          <Text className="text-textSecondary">Don't have a store? </Text>
          <TouchableOpacity onPress={openRegistration}>
            <Text className="text-primary font-bold">Register Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
