import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInRight, SlideInRight } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { ChatRoom, RootStackParamList } from '../types';

type ChatsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const formatLastMessage = (message?: { content?: string; message_type: string }): string => {
  if (!message) return 'No messages yet';
  if (message.message_type === 'image') return '📷 Photo';
  if (message.message_type === 'video') return '🎬 Video';
  return message.content || '';
};

const formatTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const ChatItem: React.FC<{
  chat: ChatRoom;
  onPress: () => void;
  onDelete: () => void;
  index: number;
}> = ({ chat, onPress, onDelete, index }) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
      >
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={24} color={colors.text.primary} />
        </RNAnimated.View>
      </TouchableOpacity>
    );
  };

  const otherUser = chat.other_user;
  const hasUnread = (chat.unread_count || 0) > 0;

  return (
    <Animated.View entering={SlideInRight.delay(index * 50).springify()}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
      >
        <TouchableOpacity
          style={styles.chatItem}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <Avatar
              uri={otherUser?.avatar_url}
              name={otherUser?.username || chat.name}
              size={56}
              showOnlineIndicator
              isOnline={Math.random() > 0.5} // Simulated - would come from real-time presence
            />
            {chat.last_message?.view_once && (
              <View style={styles.viewOnceBadge}>
                <Ionicons name="eye-off" size={12} color={colors.text.primary} />
              </View>
            )}
          </View>

          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatName} numberOfLines={1}>
                {chat.is_group ? chat.name : otherUser?.display_name || otherUser?.username}
              </Text>
              <Text style={[styles.chatTime, hasUnread && styles.chatTimeUnread]}>
                {formatTime(chat.last_message?.created_at)}
              </Text>
            </View>
            <View style={styles.chatPreview}>
              <Text
                style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
                numberOfLines={1}
              >
                {formatLastMessage(chat.last_message)}
              </Text>
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>
                    {(chat.unread_count || 0) > 99 ? '99+' : chat.unread_count}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Streak indicator */}
          {Math.random() > 0.7 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakCount}>{Math.floor(Math.random() * 30) + 1}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
};

export const ChatsScreen: React.FC = () => {
  const navigation = useNavigation<ChatsNavigationProp>();
  const { user } = useAuthStore();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const loadChats = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getChats(user.id);
      setChats(data);
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  }, [user]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  };

  const handleDeleteChat = async (chatId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Would call API to delete/leave chat
    setChats((prev) => prev.filter((c) => c.id !== chatId));
  };

  const filteredChats = searchQuery
    ? chats.filter((chat) => {
        const name = chat.is_group ? chat.name : chat.other_user?.username;
        return name?.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : chats;

  const renderItem = ({ item, index }: { item: ChatRoom; index: number }) => (
    <ChatItem
      chat={item}
      index={index}
      onPress={() => navigation.navigate('Chat', { chatRoom: item })}
      onDelete={() => handleDeleteChat(item.id)}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Ionicons
              name={showSearch ? 'close' : 'search'}
              size={22}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, styles.newChatButton]}
            onPress={() => navigation.navigate('NewChat')}
          >
            <Ionicons name="create-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Search Bar */}
      {showSearch && (
        <Animated.View entering={FadeInRight} style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor={colors.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Active Stories / Quick Access */}
      <View style={styles.quickAccess}>
        <Text style={styles.quickAccessTitle}>Quick Access</Text>
        <FlatList
          data={chats.slice(0, 6)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.quickAccessItem}
              onPress={() => navigation.navigate('Chat', { chatRoom: item })}
            >
              <Avatar
                uri={item.other_user?.avatar_url}
                name={item.other_user?.username}
                size={48}
                showOnlineIndicator
                isOnline={Math.random() > 0.5}
              />
            </TouchableOpacity>
          )}
          keyExtractor={(item) => `quick-${item.id}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickAccessList}
        />
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
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
            <LinearGradient
              colors={colors.gradients.primary as any}
              style={styles.emptyIcon}
            >
              <Ionicons name="chatbubbles" size={40} color={colors.text.primary} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No Messages Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a conversation with someone!
            </Text>
            <TouchableOpacity
              style={styles.startChatButton}
              onPress={() => navigation.navigate('NewChat')}
            >
              <Text style={styles.startChatText}>Start Chatting</Text>
            </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatButton: {
    backgroundColor: colors.primary,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.sizes.md,
  },
  quickAccess: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  quickAccessTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.tertiary,
    marginLeft: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickAccessList: {
    paddingHorizontal: spacing.md,
  },
  quickAccessItem: {
    marginHorizontal: spacing.xs,
  },
  chatList: {
    paddingBottom: 100,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  avatarContainer: {
    position: 'relative',
  },
  viewOnceBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  chatContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  chatTime: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },
  chatTimeUnread: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  chatPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    flex: 1,
  },
  lastMessageUnread: {
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
  },
  unreadCount: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginLeft: spacing.sm,
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakCount: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.accentOrange,
    marginLeft: 2,
  },
  deleteAction: {
    backgroundColor: colors.status.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  startChatButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  startChatText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
});
