import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { Avatar } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { Notification, RootStackParamList } from '../types';

type NotificationsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const NotificationIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
  const config = {
    follow: { icon: 'person-add', color: colors.primary },
    like: { icon: 'heart', color: colors.accentPink },
    comment: { icon: 'chatbubble', color: colors.accent },
    mention: { icon: 'at', color: colors.accentOrange },
    message: { icon: 'paper-plane', color: colors.accentGreen },
  };

  const { icon, color } = config[type] || config.follow;

  return (
    <View style={[styles.notificationIcon, { backgroundColor: color }]}>
      <Ionicons name={icon as any} size={14} color={colors.text.primary} />
    </View>
  );
};

const NotificationItem: React.FC<{
  notification: Notification;
  onPress: () => void;
  index: number;
}> = ({ notification, onPress, index }) => {
  const getNotificationText = () => {
    switch (notification.type) {
      case 'follow':
        return 'started following you';
      case 'like':
        return 'liked your story';
      case 'comment':
        return 'commented on your story';
      case 'mention':
        return 'mentioned you';
      case 'message':
        return 'sent you a message';
      default:
        return notification.message;
    }
  };

  return (
    <Animated.View entering={SlideInRight.delay(index * 30).springify()}>
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !notification.is_read && styles.notificationUnread,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Avatar
            uri={notification.from_user?.avatar_url}
            name={notification.from_user?.username}
            size={48}
          />
          <NotificationIcon type={notification.type} />
        </View>

        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>
            <Text style={styles.username}>
              {notification.from_user?.username}
            </Text>{' '}
            {getNotificationText()}
          </Text>
          <Text style={styles.notificationTime}>
            {formatTimeAgo(notification.created_at)}
          </Text>
        </View>

        {notification.story && (
          <View style={styles.storyThumbnail}>
            {/* Would show story thumbnail */}
          </View>
        )}

        {notification.type === 'follow' && (
          <TouchableOpacity style={styles.followBackButton}>
            <Text style={styles.followBackText}>Follow</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
};

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NotificationsNavigationProp>();
  const { user } = useAuthStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await api.markAllNotificationsRead(user.id);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all read:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!user) return;

    // Mark as read
    if (!notification.is_read) {
      try {
        await api.markNotificationRead(user.id, notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n
          )
        );
      } catch (error) {
        console.error('Failed to mark notification read:', error);
      }
    }

    // Navigate based on type
    switch (notification.type) {
      case 'follow':
        if (notification.from_user_id) {
          navigation.navigate('Profile', { userId: notification.from_user_id });
        }
        break;
      case 'like':
      case 'comment':
        if (notification.story_id) {
          // Would navigate to story
        }
        break;
      case 'message':
        // Would navigate to chat
        break;
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const groupNotificationsByDate = (notifs: Notification[]) => {
    const today: Notification[] = [];
    const thisWeek: Notification[] = [];
    const older: Notification[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    notifs.forEach((n) => {
      const date = new Date(n.created_at);
      if (date >= todayStart) {
        today.push(n);
      } else if (date >= weekStart) {
        thisWeek.push(n);
      } else {
        older.push(n);
      }
    });

    return { today, thisWeek, older };
  };

  const grouped = groupNotificationsByDate(filteredNotifications);

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
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Filter */}
      <Animated.View entering={FadeInDown.delay(200)} style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'unread' && styles.filterButtonActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        renderItem={({ item, index }) => (
          <NotificationItem
            notification={item}
            index={index}
            onPress={() => handleNotificationPress(item)}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={64} color={colors.text.muted} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtitle}>
              When someone interacts with you, you'll see it here
            </Text>
          </View>
        }
      />
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
    marginLeft: spacing.sm,
  },
  markAllRead: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.tertiary,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  filterTextActive: {
    color: colors.text.primary,
  },
  listContent: {
    paddingBottom: 100,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  notificationUnread: {
    backgroundColor: colors.transparent.primary20,
  },
  avatarContainer: {
    position: 'relative',
  },
  notificationIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  notificationContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  notificationText: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    lineHeight: 20,
  },
  username: {
    fontWeight: typography.weights.semibold,
  },
  notificationTime: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  storyThumbnail: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.tertiary,
    marginLeft: spacing.sm,
  },
  followBackButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
  },
  followBackText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
});
