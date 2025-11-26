import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Input, GradientButton } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography } from '../../theme/colors';
import { RootStackParamList } from '../../types';

type SignupNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation<SignupNavigationProp>();
  const { signup } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!username) newErrors.username = 'Username is required';
    else if (username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) newErrors.username = 'Letters, numbers, and underscores only';

    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';

    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await signup(username, email, password);
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back Button */}
            <Animated.View entering={FadeInDown.delay(100)}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </Animated.View>

            {/* Header */}
            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join the community and start sharing</Text>
            </Animated.View>

            {/* Form */}
            <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.form}>
              <Input
                label="Username"
                placeholder="Choose a unique username"
                value={username}
                onChangeText={setUsername}
                error={errors.username}
                leftIcon="person-outline"
                autoCapitalize="none"
                autoComplete="username"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />

              <Input
                ref={emailRef}
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              <Input
                ref={passwordRef}
                label="Password"
                placeholder="Create a strong password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                leftIcon="lock-closed-outline"
                secureTextEntry
                autoComplete="password-new"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />

              <Input
                ref={confirmRef}
                label="Confirm Password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
                leftIcon="shield-checkmark-outline"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />

              {/* Password Strength Indicator */}
              {password && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3, 4].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthBar,
                          {
                            backgroundColor:
                              password.length >= level * 3
                                ? level <= 1
                                  ? colors.status.error
                                  : level <= 2
                                  ? colors.status.warning
                                  : colors.status.success
                                : colors.border.default,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.strengthText}>
                    {password.length < 6
                      ? 'Weak'
                      : password.length < 10
                      ? 'Medium'
                      : 'Strong'}
                  </Text>
                </View>
              )}

              <GradientButton
                title="Create Account"
                onPress={handleSignup}
                loading={loading}
                gradient={colors.gradients.sunset as any}
                size="large"
                style={styles.signupButton}
              />
            </Animated.View>

            {/* Terms */}
            <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.terms}>
              <Text style={styles.termsText}>
                By signing up, you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </Animated.View>

            {/* Sign In Link */}
            <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.signinLink}>Sign In</Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.lg,
    color: colors.text.secondary,
  },
  form: {
    marginBottom: spacing.lg,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
  strengthBars: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    color: colors.text.tertiary,
    fontSize: typography.sizes.sm,
    marginLeft: spacing.sm,
    width: 60,
  },
  signupButton: {
    marginTop: spacing.md,
  },
  terms: {
    marginBottom: spacing.lg,
  },
  termsText: {
    textAlign: 'center',
    color: colors.text.tertiary,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: colors.text.secondary,
    fontSize: typography.sizes.md,
  },
  signinLink: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
});
