import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { Avatar } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { User, RootStackParamList } from '../types';

type FollowersRouteProp = RouteProp<RootStackParamList, 'Followers'>;
type FollowersNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const FollowersScreen: React.FC = () => {
  const navigation = useNavigation<FollowersNavigationProp>();
  const route = useRoute<FollowersRouteProp>();
  const { user } = useAuthStore();
  const { userId, type } = route.params;

  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const loadUsers = useCallback(async () => {
    if (!user) return;
    try {
      const data = type === 'followers'
        ? await api.getFollowers(userId, user.id)
        : await api.getFollowing(userId, user.id);
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, [userId, user, type]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleFollow = async (targetUserId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isFollowing = followingIds.has(targetUserId);
    setFollowingIds((prev) => {
      const newSet = new Set(prev);
      if (isFollowing) newSet.delete(targetUserId);
      else newSet.add(targetUserId);
      return newSet;
    });

    try {
      if (isFollowing) {
        await api.unfollowUser(user.id, targetUserId);
      } else {
        await api.followUser(user.id, targetUserId);
      }
    } catch (error) {
      setFollowingIds((prev) => {
        const newSet = new Set(prev);
        if (isFollowing) newSet.add(targetUserId);
        else newSet.delete(targetUserId);
        return newSet;
      });
    }
  };

  const filteredUsers = searchQuery
    ? users.filter((u) =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  const renderItem = ({ item, index }: { item: User; index: number }) => (
    <Animated.View entering={SlideInRight.delay(index * 30)}>
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => navigation.navigate('Profile', { userId: item.id })}
      >
        <Avatar
          uri={item.avatar_url}
          name={item.display_name || item.username}
          size={50}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.display_name || item.username}</Text>
          <Text style={styles.userUsername}>@{item.username}</Text>
        </View>
        {item.id !== user?.id && (
          <TouchableOpacity
            style={[
              styles.followButton,
              followingIds.has(item.id) && styles.followingButton,
            ]}
            onPress={() => handleFollow(item.id)}
          >
            <Text style={styles.followButtonText}>
              {followingIds.has(item.id) ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {type === 'followers' ? 'Followers' : 'Following'}
        </Text>
        <View style={{ width: 28 }} />
      </Animated.View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
  list: {
    paddingHorizontal: spacing.lg,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
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
  followButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  followingButton: {
    backgroundColor: colors.background.tertiary,
  },
  followButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
});
