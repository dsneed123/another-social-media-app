import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { Avatar, GradientButton } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { User, Story, RootStackParamList } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

type ProfileDetailRouteProp = RouteProp<RootStackParamList, 'Profile'>;
type ProfileDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

export const ProfileDetailScreen: React.FC = () => {
  const navigation = useNavigation<ProfileDetailNavigationProp>();
  const route = useRoute<ProfileDetailRouteProp>();
  const { user: currentUser } = useAuthStore();
  const { userId } = route.params;

  const [profile, setProfile] = useState<User & { is_following: boolean } | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  const loadProfile = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [profileData, storiesData] = await Promise.all([
        api.getProfile(userId, currentUser.id),
        api.getUserStories(userId),
      ]);
      setProfile(profileData);
      setIsFollowing(profileData.is_following);
      setStories(storiesData);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }, [userId, currentUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleFollow = async () => {
    if (!currentUser || !profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsFollowing(!isFollowing);
    try {
      if (isFollowing) {
        await api.unfollowUser(currentUser.id, userId);
      } else {
        await api.followUser(currentUser.id, userId);
      }
    } catch (error) {
      setIsFollowing(isFollowing);
    }
  };

  const handleMessage = () => {
    // Would create or navigate to chat
  };

  if (!profile) return null;

  const ProfileHeader = () => (
    <View style={styles.headerContent}>
      <Animated.View entering={FadeIn.delay(100)} style={styles.profileSection}>
        <Avatar
          uri={profile.avatar_url}
          name={profile.display_name || profile.username}
          size={90}
          showStoryRing={stories.length > 0}
          hasUnseenStory={stories.some((s) => !s.has_viewed)}
          onPress={() => {
            if (stories.length > 0) {
              navigation.navigate('StoryViewer', { stories, initialIndex: 0 });
            }
          }}
        />

        <View style={styles.userInfo}>
          <Text style={styles.displayName}>
            {profile.display_name || profile.username}
          </Text>
          <Text style={styles.username}>@{profile.username}</Text>
        </View>
      </Animated.View>

      {profile.bio && (
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.bio}>{profile.bio}</Text>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(300)} style={styles.statsRow}>
        <TouchableOpacity style={styles.statItem}>
          <Text style={styles.statValue}>{profile.story_count}</Text>
          <Text style={styles.statLabel}>Stories</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('Followers', { userId, type: 'followers' })}
        >
          <Text style={styles.statValue}>{profile.follower_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('Followers', { userId, type: 'following' })}
        >
          <Text style={styles.statValue}>{profile.following_count}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
      </Animated.View>

      {!isOwnProfile && (
        <Animated.View entering={FadeInDown.delay(400)} style={styles.actionButtons}>
          <GradientButton
            title={isFollowing ? 'Following' : 'Follow'}
            onPress={handleFollow}
            gradient={isFollowing ? [colors.background.tertiary, colors.background.tertiary] : colors.gradients.primary as any}
            style={styles.followButton}
          />
          <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={styles.tabDivider} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile.username}</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={stories}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate('StoryViewer', { stories, initialIndex: index })}
          >
            <Image source={{ uri: item.media_url }} style={styles.gridImage} />
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        ListHeaderComponent={ProfileHeader}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  headerContent: {
    paddingBottom: spacing.md,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  userInfo: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  displayName: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  username: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginTop: 2,
  },
  bio: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.default,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  followButton: {
    flex: 1,
  },
  messageButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginTop: spacing.lg,
  },
  gridContainer: {
    paddingBottom: 100,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    marginRight: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
});
