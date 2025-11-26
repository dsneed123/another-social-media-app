import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { Avatar, GradientButton } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { Story, RootStackParamList } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const StatItem: React.FC<{
  value: number;
  label: string;
  onPress?: () => void;
}> = ({ value, label, onPress }) => (
  <TouchableOpacity style={styles.statItem} onPress={onPress} disabled={!onPress}>
    <Text style={styles.statValue}>{formatNumber(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const StoryGridItem: React.FC<{
  story: Story;
  onPress: () => void;
  index: number;
}> = ({ story, onPress, index }) => (
  <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
    <TouchableOpacity
      style={styles.gridItem}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: story.media_url }}
        style={styles.gridImage}
      />
      {story.media_type === 'video' && (
        <View style={styles.videoIndicator}>
          <Ionicons name="play" size={16} color={colors.text.primary} />
        </View>
      )}
      <View style={styles.gridOverlay}>
        <View style={styles.gridStat}>
          <Ionicons name="heart" size={14} color={colors.text.primary} />
          <Text style={styles.gridStatText}>{formatNumber(story.like_count)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  </Animated.View>
);

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { user, logout } = useAuthStore();
  const [stories, setStories] = useState<Story[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'saved'>('grid');

  const loadUserStories = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getUserStories(user.id);
      setStories(data);
    } catch (error) {
      console.error('Failed to load stories:', error);
    }
  }, [user]);

  React.useEffect(() => {
    loadUserStories();
  }, [loadUserStories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserStories();
    setRefreshing(false);
  };

  const handleStoryPress = (index: number) => {
    navigation.navigate('StoryViewer', { stories, initialIndex: index });
  };

  if (!user) return null;

  const ProfileHeader = () => (
    <View style={styles.headerContent}>
      {/* Profile Info */}
      <Animated.View entering={FadeIn.delay(100)} style={styles.profileSection}>
        <View style={styles.avatarSection}>
          <Avatar
            uri={user.avatar_url}
            name={user.display_name || user.username}
            size={90}
            showStoryRing={stories.length > 0}
            hasUnseenStory={false}
          />
          <TouchableOpacity style={styles.editAvatarButton}>
            <Ionicons name="camera" size={16} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.displayName}>
            {user.display_name || user.username}
          </Text>
          <Text style={styles.username}>@{user.username}</Text>
        </View>
      </Animated.View>

      {/* Bio */}
      {user.bio && (
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.bio}>{user.bio}</Text>
        </Animated.View>
      )}

      {/* Stats */}
      <Animated.View entering={FadeInDown.delay(300)} style={styles.statsRow}>
        <StatItem
          value={user.story_count}
          label="Stories"
        />
        <View style={styles.statDivider} />
        <StatItem
          value={user.follower_count}
          label="Followers"
          onPress={() => navigation.navigate('Followers', { userId: user.id, type: 'followers' })}
        />
        <View style={styles.statDivider} />
        <StatItem
          value={user.following_count}
          label="Following"
          onPress={() => navigation.navigate('Followers', { userId: user.id, type: 'following' })}
        />
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View entering={FadeInDown.delay(400)} style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Ionicons name="share-outline" size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Highlights */}
      <Animated.View entering={FadeInDown.delay(500)} style={styles.highlights}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.highlightsList}
        >
          <TouchableOpacity style={styles.highlightItem}>
            <View style={styles.addHighlight}>
              <Ionicons name="add" size={24} color={colors.text.primary} />
            </View>
            <Text style={styles.highlightLabel}>New</Text>
          </TouchableOpacity>
          {/* Placeholder highlights */}
          {['Travel', 'Food', 'Friends'].map((label, index) => (
            <TouchableOpacity key={label} style={styles.highlightItem}>
              <LinearGradient
                colors={colors.gradients.primary as any}
                style={styles.highlight}
              >
                <Ionicons
                  name={index === 0 ? 'airplane' : index === 1 ? 'restaurant' : 'people'}
                  size={24}
                  color={colors.text.primary}
                />
              </LinearGradient>
              <Text style={styles.highlightLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Tab Selector */}
      <Animated.View entering={FadeInDown.delay(600)} style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'grid' && styles.tabActive]}
          onPress={() => setActiveTab('grid')}
        >
          <Ionicons
            name="grid"
            size={22}
            color={activeTab === 'grid' ? colors.text.primary : colors.text.tertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
          onPress={() => setActiveTab('saved')}
        >
          <Ionicons
            name="bookmark"
            size={22}
            color={activeTab === 'saved' ? colors.text.primary : colors.text.tertiary}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>{user.username}</Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity style={styles.topBarButton}>
            <Ionicons name="add-circle-outline" size={26} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="menu-outline" size={26} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={activeTab === 'grid' ? stories : []}
        renderItem={({ item, index }) => (
          <StoryGridItem
            story={item}
            index={index}
            onPress={() => handleStoryPress(index)}
          />
        )}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        ListHeaderComponent={ProfileHeader}
        contentContainerStyle={styles.gridContainer}
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
            <Ionicons name="images-outline" size={48} color={colors.text.muted} />
            <Text style={styles.emptyText}>No stories yet</Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => navigation.navigate('Camera' as any)}
            >
              <Text style={styles.createFirstText}>Create your first story</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topBarTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  topBarButton: {
    padding: spacing.xs,
  },
  headerContent: {
    paddingBottom: spacing.md,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  avatarSection: {
    position: 'relative',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background.primary,
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
    lineHeight: 20,
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
  editButton: {
    flex: 1,
    height: 40,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  shareButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlights: {
    marginTop: spacing.lg,
  },
  highlightsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  highlightItem: {
    alignItems: 'center',
  },
  addHighlight: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  tabSelector: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    marginTop: spacing.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.text.primary,
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
  videoIndicator: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.transparent.black50,
    borderRadius: 4,
    padding: 4,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xs,
    backgroundColor: colors.transparent.black50,
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridStatText: {
    fontSize: typography.sizes.xs,
    color: colors.text.primary,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  createFirstButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  createFirstText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
});
