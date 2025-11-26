import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { Avatar } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { RootStackParamList } from '../types';

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  label,
  value,
  onPress,
  rightElement,
  danger,
}) => (
  <TouchableOpacity
    style={styles.settingsItem}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.settingsIcon, danger && styles.settingsIconDanger]}>
      <Ionicons
        name={icon}
        size={20}
        color={danger ? colors.status.error : colors.text.secondary}
      />
    </View>
    <Text style={[styles.settingsLabel, danger && styles.settingsLabelDanger]}>
      {label}
    </Text>
    {value && <Text style={styles.settingsValue}>{value}</Text>}
    {rightElement}
    {onPress && !rightElement && (
      <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
    )}
  </TouchableOpacity>
);

const SettingsSection: React.FC<{
  title: string;
  children: React.ReactNode;
  delay?: number;
}> = ({ title, children, delay = 0 }) => (
  <Animated.View entering={FadeInDown.delay(delay)} style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>{children}</View>
  </Animated.View>
);

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsNavigationProp>();
  const { user, logout } = useAuthStore();

  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [saveOriginals, setSaveOriginals] = useState(true);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          logout();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Would call API to delete account
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.profileSection}>
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Avatar
              uri={user.avatar_url}
              name={user.display_name || user.username}
              size={60}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user.display_name || user.username}
              </Text>
              <Text style={styles.profileUsername}>@{user.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Account Settings */}
        <SettingsSection title="Account" delay={300}>
          <SettingsItem
            icon="person-outline"
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingsItem
            icon="lock-closed-outline"
            label="Privacy"
            onPress={() => {}}
          />
          <SettingsItem
            icon="shield-outline"
            label="Security"
            onPress={() => {}}
          />
          <SettingsItem
            icon="key-outline"
            label="Change Password"
            onPress={() => {}}
          />
        </SettingsSection>

        {/* Preferences */}
        <SettingsSection title="Preferences" delay={400}>
          <SettingsItem
            icon="notifications-outline"
            label="Notifications"
            rightElement={
              <Switch
                value={notifications}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNotifications(value);
                }}
                trackColor={{ false: colors.border.default, true: colors.primary }}
              />
            }
          />
          <SettingsItem
            icon="moon-outline"
            label="Dark Mode"
            rightElement={
              <Switch
                value={darkMode}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDarkMode(value);
                }}
                trackColor={{ false: colors.border.default, true: colors.primary }}
              />
            }
          />
          <SettingsItem
            icon="eye-off-outline"
            label="Private Account"
            rightElement={
              <Switch
                value={privateAccount}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPrivateAccount(value);
                }}
                trackColor={{ false: colors.border.default, true: colors.primary }}
              />
            }
          />
          <SettingsItem
            icon="download-outline"
            label="Save Original Photos"
            rightElement={
              <Switch
                value={saveOriginals}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSaveOriginals(value);
                }}
                trackColor={{ false: colors.border.default, true: colors.primary }}
              />
            }
          />
        </SettingsSection>

        {/* Storage & Data */}
        <SettingsSection title="Storage & Data" delay={500}>
          <SettingsItem
            icon="cloud-outline"
            label="Data Usage"
            value="Auto"
            onPress={() => {}}
          />
          <SettingsItem
            icon="trash-outline"
            label="Clear Cache"
            value="256 MB"
            onPress={() => {
              Alert.alert('Clear Cache', 'This will free up 256 MB of storage', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', onPress: () => {} },
              ]);
            }}
          />
        </SettingsSection>

        {/* Support */}
        <SettingsSection title="Support" delay={600}>
          <SettingsItem
            icon="help-circle-outline"
            label="Help Center"
            onPress={() => {}}
          />
          <SettingsItem
            icon="chatbubble-outline"
            label="Contact Us"
            onPress={() => {}}
          />
          <SettingsItem
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => {}}
          />
          <SettingsItem
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => {}}
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About" delay={700}>
          <SettingsItem
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
          />
          <SettingsItem
            icon="star-outline"
            label="Rate Us"
            onPress={() => {}}
          />
          <SettingsItem
            icon="share-outline"
            label="Share App"
            onPress={() => {}}
          />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Account Actions" delay={800}>
          <SettingsItem
            icon="log-out-outline"
            label="Log Out"
            onPress={handleLogout}
            danger
          />
          <SettingsItem
            icon="trash-outline"
            label="Delete Account"
            onPress={handleDeleteAccount}
            danger
          />
        </SettingsSection>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Relay Social v1.0.0</Text>
          <Text style={styles.footerText}>Made with ❤️</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profileSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  profileUsername: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionContent: {
    backgroundColor: colors.background.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingsIconDanger: {
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
  },
  settingsLabel: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  settingsLabelDanger: {
    color: colors.status.error,
  },
  settingsValue: {
    fontSize: typography.sizes.md,
    color: colors.text.tertiary,
    marginRight: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.text.muted,
    marginVertical: 2,
  },
});
