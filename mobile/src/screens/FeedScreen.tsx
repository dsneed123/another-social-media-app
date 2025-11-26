import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { Avatar } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { Story, User, RootStackParamList } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_AVATAR_SIZE = 72;
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.55;

type FeedNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Story Ring Component for horizontal story list
const StoryItem: React.FC<{
  user: User;
  hasUnseenStory: boolean;
  onPress: () => void;
  isOwn?: boolean;
}> = ({ user, hasUnseenStory, onPress, isOwn }) => (
  <TouchableOpacity style={styles.storyItem} onPress={onPress} activeOpacity={0.8}>
    <Avatar
      uri={user.avatar_url}
      name={user.display_name || user.username}
      size={STORY_AVATAR_SIZE}
      showStoryRing={!isOwn && hasUnseenStory}
      hasUnseenStory={hasUnseenStory}
    />
    {isOwn && (
      <View style={styles.addStoryBadge}>
        <Ionicons name="add" size={16} color={colors.text.primary} />
      </View>
    )}
    <Text style={styles.storyUsername} numberOfLines={1}>
      {isOwn ? 'Your Story' : user.username}
    </Text>
  </TouchableOpacity>
);

// Feed Card Component
const FeedCard: React.FC<{
  story: Story;
  onPress: () => void;
  onLike: () => void;
  onComment: () => void;
  onProfile: () => void;
}> = ({ story, onPress, onLike, onComment, onProfile }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handleDoubleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLike();
  };

  return (
    <Animated.View entering={FadeInDown.springify()} style={[styles.cardContainer, animatedStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        onLongPress={handleDoubleTap}
      >
        <View style={styles.card}>
          <Image
            source={{ uri: story.media_url }}
            style={styles.cardImage}
            resizeMode="cover"
          />

          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.cardGradient}
          />

          {/* Top user info */}
          <View style={styles.cardTopInfo}>
            <TouchableOpacity style={styles.userRow} onPress={onProfile}>
              <Avatar
                uri={story.user?.avatar_url}
                name={story.user?.username}
                size={36}
              />
              <View style={styles.userInfo}>
                <Text style={styles.username}>{story.user?.username}</Text>
                <Text style={styles.timestamp}>
                  {formatTimeAgo(story.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreButton}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Bottom engagement */}
          <View style={styles.cardBottomInfo}>
            {story.caption && (
              <Text style={styles.caption} numberOfLines={2}>
                {story.caption}
              </Text>
            )}
            <View style={styles.engagementRow}>
              <TouchableOpacity
                style={styles.engagementButton}
                onPress={onLike}
              >
                <Ionicons
                  name={story.has_liked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={story.has_liked ? colors.accentPink : colors.text.primary}
                />
                <Text style={styles.engagementCount}>{story.like_count}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.engagementButton}
                onPress={onComment}
              >
                <Ionicons name="chatbubble-outline" size={22} color={colors.text.primary} />
                <Text style={styles.engagementCount}>{story.comment_count}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.engagementButton}>
                <Ionicons name="paper-plane-outline" size={22} color={colors.text.primary} />
              </TouchableOpacity>
              <View style={styles.viewCount}>
                <Ionicons name="eye-outline" size={18} color={colors.text.secondary} />
                <Text style={styles.viewCountText}>{story.view_count}</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// Time formatting helper
const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

export const FeedScreen: React.FC = () => {
  const navigation = useNavigation<FeedNavigationProp>();
  const { user } = useAuthStore();
  const [stories, setStories] = useState<Story[]>([]);
  const [storyUsers, setStoryUsers] = useState<(User & { hasUnseenStory: boolean })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    try {
      const feed = await api.getFeed(user.id);
      setStories(feed);

      // Extract unique users with stories
      const userMap = new Map<string, User & { hasUnseenStory: boolean }>();
      feed.forEach((story) => {
        if (story.user && !userMap.has(story.user.id)) {
          userMap.set(story.user.id, {
            ...story.user,
            hasUnseenStory: !story.has_viewed,
          });
        }
      });
      setStoryUsers(Array.from(userMap.values()));
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleStoryPress = (userStories: Story[], index: number) => {
    navigation.navigate('StoryViewer', { stories: userStories, initialIndex: index });
  };

  const handleLike = async (story: Story) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (story.has_liked) {
        await api.unlikeStory(story.id, user.id);
      } else {
        await api.likeStory(story.id, user.id);
      }
      // Update local state
      setStories((prev) =>
        prev.map((s) =>
          s.id === story.id
            ? {
                ...s,
                has_liked: !s.has_liked,
                like_count: s.has_liked ? s.like_count - 1 : s.like_count + 1,
              }
            : s
        )
      );
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const renderStoryItem = ({ item, index }: { item: User & { hasUnseenStory: boolean }; index: number }) => (
    <StoryItem
      user={item}
      hasUnseenStory={item.hasUnseenStory}
      onPress={() => {
        const userStories = stories.filter((s) => s.user_id === item.id);
        handleStoryPress(userStories, 0);
      }}
    />
  );

  const renderFeedItem = ({ item, index }: { item: Story; index: number }) => (
    <FeedCard
      story={item}
      onPress={() => handleStoryPress([item], 0)}
      onLike={() => handleLike(item)}
      onComment={() => navigation.navigate('Comments', { storyId: item.id })}
      onProfile={() => navigation.navigate('Profile', { userId: item.user_id })}
    />
  );

  const ListHeader = () => (
    <View style={styles.storiesContainer}>
      {/* Own story */}
      {user && (
        <StoryItem
          user={user}
          hasUnseenStory={false}
          onPress={() => navigation.navigate('Camera' as any)}
          isOwn
        />
      )}

      {/* Other users' stories */}
      <FlatList
        data={storyUsers.filter((u) => u.id !== user?.id)}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesList}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
        <Text style={styles.headerTitle}>Relay</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Search' as any)}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Feed */}
      <FlatList
        data={stories}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.feedList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={64} color={colors.text.muted} />
              <Text style={styles.emptyTitle}>No Stories Yet</Text>
              <Text style={styles.emptySubtitle}>
                Follow people to see their stories here
              </Text>
            </View>
          ) : null
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.error,
  },
  storiesContainer: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    marginBottom: spacing.md,
  },
  storiesList: {
    paddingRight: spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    marginLeft: spacing.md,
    width: STORY_AVATAR_SIZE + 8,
  },
  addStoryBadge: {
    position: 'absolute',
    bottom: 20,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  storyUsername: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  feedList: {
    paddingBottom: 100,
  },
  cardContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.background.card,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  cardTopInfo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: spacing.sm,
  },
  username: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  moreButton: {
    padding: spacing.sm,
  },
  cardBottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  caption: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  engagementCount: {
    marginLeft: spacing.xs,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  viewCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  viewCountText: {
    marginLeft: spacing.xs,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
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
    marginTop: spacing.xs,
  },
});
