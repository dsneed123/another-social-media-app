import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  SlideInRight,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { Avatar, GradientButton } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { User, RootStackParamList } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DiscoverNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CategoryChip: React.FC<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
}> = ({ label, icon, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
    onPress={onPress}
  >
    <Ionicons
      name={icon}
      size={18}
      color={isActive ? colors.text.primary : colors.text.secondary}
    />
    <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const UserCard: React.FC<{
  user: User;
  onPress: () => void;
  onFollow: () => void;
  isFollowing: boolean;
  index: number;
}> = ({ user, onPress, onFollow, isFollowing, index }) => (
  <Animated.View entering={SlideInRight.delay(index * 50).springify()}>
    <TouchableOpacity style={styles.userCard} onPress={onPress} activeOpacity={0.8}>
      <Avatar
        uri={user.avatar_url}
        name={user.display_name || user.username}
        size={56}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.display_name || user.username}
        </Text>
        <Text style={styles.userUsername} numberOfLines={1}>
          @{user.username}
        </Text>
        {user.bio && (
          <Text style={styles.userBio} numberOfLines={1}>
            {user.bio}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.followButton,
          isFollowing && styles.followingButton,
        ]}
        onPress={(e) => {
          e.stopPropagation();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onFollow();
        }}
      >
        {isFollowing ? (
          <Ionicons name="checkmark" size={18} color={colors.text.primary} />
        ) : (
          <Ionicons name="person-add" size={18} color={colors.text.primary} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  </Animated.View>
);

const SuggestedSection: React.FC<{
  title: string;
  users: User[];
  onUserPress: (user: User) => void;
  onFollow: (userId: string) => void;
  followingIds: Set<string>;
}> = ({ title, users, onUserPress, onFollow, followingIds }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity>
        <Text style={styles.seeAllText}>See All</Text>
      </TouchableOpacity>
    </View>
    <FlatList
      data={users.slice(0, 10)}
      renderItem={({ item, index }) => (
        <UserCard
          user={item}
          index={index}
          onPress={() => onUserPress(item)}
          onFollow={() => onFollow(item.id)}
          isFollowing={followingIds.has(item.id)}
        />
      )}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.usersList}
    />
  </View>
);

export const DiscoverScreen: React.FC = () => {
  const navigation = useNavigation<DiscoverNavigationProp>();
  const { user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [popularUsers, setPopularUsers] = useState<User[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isSearching, setIsSearching] = useState(false);

  const categories = [
    { id: 'all', label: 'All', icon: 'globe-outline' as const },
    { id: 'creators', label: 'Creators', icon: 'star-outline' as const },
    { id: 'nearby', label: 'Nearby', icon: 'location-outline' as const },
    { id: 'music', label: 'Music', icon: 'musical-notes-outline' as const },
    { id: 'art', label: 'Art', icon: 'color-palette-outline' as const },
  ];

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [popular, suggested] = await Promise.all([
        api.getPopularUsers(user.id),
        api.getSuggestedUsers(user.id),
      ]);
      setPopularUsers(popular);
      setSuggestedUsers(suggested);
    } catch (error) {
      console.error('Failed to load discover data:', error);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!user || query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await api.searchUsers(user.id, query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleFollow = async (userId: string) => {
    if (!user) return;

    const isCurrentlyFollowing = followingIds.has(userId);

    // Optimistic update
    setFollowingIds((prev) => {
      const newSet = new Set(prev);
      if (isCurrentlyFollowing) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });

    try {
      if (isCurrentlyFollowing) {
        await api.unfollowUser(user.id, userId);
      } else {
        await api.followUser(user.id, userId);
      }
    } catch (error) {
      // Revert on error
      setFollowingIds((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyFollowing) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    }
  };

  const handleUserPress = (selectedUser: User) => {
    navigation.navigate('Profile', { userId: selectedUser.id });
  };

  const renderSearchResults = () => (
    <FlatList
      data={searchResults}
      renderItem={({ item, index }) => (
        <UserCard
          user={item}
          index={index}
          onPress={() => handleUserPress(item)}
          onFollow={() => handleFollow(item.id)}
          isFollowing={followingIds.has(item.id)}
        />
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.searchResultsList}
      ListEmptyComponent={
        searchQuery.length >= 2 ? (
          <View style={styles.emptySearch}>
            <Ionicons name="search" size={48} color={colors.text.muted} />
            <Text style={styles.emptySearchText}>No users found</Text>
            <Text style={styles.emptySearchSubtext}>
              Try a different search term
            </Text>
          </View>
        ) : null
      }
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
      </Animated.View>

      {/* Search Bar */}
      <Animated.View entering={FadeInDown.delay(200)} style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setIsSearching(false);
              }}
            >
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Categories */}
      <Animated.View entering={FadeInRight.delay(300)}>
        <FlatList
          data={categories}
          renderItem={({ item }) => (
            <CategoryChip
              label={item.label}
              icon={item.icon}
              isActive={activeCategory === item.id}
              onPress={() => setActiveCategory(item.id)}
            />
          )}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </Animated.View>

      {/* Content */}
      {isSearching ? (
        renderSearchResults()
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {/* Featured Banner */}
              <Animated.View entering={FadeInDown.delay(400)} style={styles.banner}>
                <LinearGradient
                  colors={colors.gradients.sunset as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bannerGradient}
                >
                  <View style={styles.bannerContent}>
                    <Ionicons name="sparkles" size={32} color={colors.text.primary} />
                    <Text style={styles.bannerTitle}>Find Your People</Text>
                    <Text style={styles.bannerSubtitle}>
                      Discover creators that match your interests
                    </Text>
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Suggested Users */}
              {suggestedUsers.length > 0 && (
                <SuggestedSection
                  title="Suggested For You"
                  users={suggestedUsers}
                  onUserPress={handleUserPress}
                  onFollow={handleFollow}
                  followingIds={followingIds}
                />
              )}

              {/* Popular Users */}
              {popularUsers.length > 0 && (
                <SuggestedSection
                  title="Trending Creators"
                  users={popularUsers}
                  onUserPress={handleUserPress}
                  onFollow={handleFollow}
                  followingIds={followingIds}
                />
              )}

              {/* Topics Grid */}
              <View style={styles.topicsSection}>
                <Text style={styles.sectionTitle}>Browse Topics</Text>
                <View style={styles.topicsGrid}>
                  {[
                    { name: 'Photography', icon: 'camera', gradient: colors.gradients.primary },
                    { name: 'Travel', icon: 'airplane', gradient: colors.gradients.ocean },
                    { name: 'Fashion', icon: 'shirt', gradient: colors.gradients.sunset },
                    { name: 'Food', icon: 'restaurant', gradient: ['#F7971E', '#FFD200'] },
                    { name: 'Fitness', icon: 'fitness', gradient: ['#11998e', '#38ef7d'] },
                    { name: 'Music', icon: 'musical-notes', gradient: ['#ee0979', '#ff6a00'] },
                  ].map((topic, index) => (
                    <TouchableOpacity key={topic.name} style={styles.topicCard}>
                      <LinearGradient
                        colors={topic.gradient as any}
                        style={styles.topicGradient}
                      >
                        <Ionicons
                          name={topic.icon as any}
                          size={28}
                          color={colors.text.primary}
                        />
                        <Text style={styles.topicName}>{topic.name}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
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
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.sizes.md,
  },
  categoriesList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  categoryTextActive: {
    color: colors.text.primary,
  },
  content: {
    paddingBottom: 100,
  },
  banner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  bannerGradient: {
    padding: spacing.lg,
  },
  bannerContent: {
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  bannerSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    opacity: 0.8,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  seeAllText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  usersList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    width: SCREEN_WIDTH * 0.75,
    marginRight: spacing.md,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  userUsername: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  userBio: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  followButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButton: {
    backgroundColor: colors.background.tertiary,
  },
  topicsSection: {
    paddingHorizontal: spacing.lg,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  topicCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  topicGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  searchResultsList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  emptySearch: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptySearchText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySearchSubtext: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
