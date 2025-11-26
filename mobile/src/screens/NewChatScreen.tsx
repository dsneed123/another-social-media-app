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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { Avatar, GradientButton } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { User, RootStackParamList } from '../types';

type NewChatNavigationProp = NativeStackNavigationProp<RootStackParamList, 'NewChat'>;

export const NewChatScreen: React.FC = () => {
  const navigation = useNavigation<NewChatNavigationProp>();
  const { user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const searchUsers = useCallback(async (query: string) => {
    if (!user || query.length < 2) {
      setUsers([]);
      return;
    }

    try {
      const results = await api.searchUsers(user.id, query);
      setUsers(results.filter((u) => u.id !== user.id));
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [user]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchUsers]);

  const toggleSelection = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleCreateChat = async () => {
    if (selectedUsers.size === 0 || !user) return;

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const memberIds = [user.id, ...Array.from(selectedUsers)];
      const chatRoom = await api.createChat(memberIds);
      navigation.goBack();
      navigation.navigate('Chat', { chatRoom });
    } catch (error) {
      console.error('Failed to create chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderUser = ({ item, index }: { item: User; index: number }) => {
    const isSelected = selectedUsers.has(item.id);

    return (
      <Animated.View entering={SlideInRight.delay(index * 30)}>
        <TouchableOpacity
          style={[styles.userItem, isSelected && styles.userItemSelected]}
          onPress={() => toggleSelection(item.id)}
        >
          <Avatar
            uri={item.avatar_url}
            name={item.display_name || item.username}
            size={50}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {item.display_name || item.username}
            </Text>
            <Text style={styles.userUsername}>@{item.username}</Text>
          </View>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && (
              <Ionicons name="checkmark" size={16} color={colors.text.primary} />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <TouchableOpacity
          onPress={handleCreateChat}
          disabled={selectedUsers.size === 0 || loading}
        >
          <Text
            style={[
              styles.nextText,
              (selectedUsers.size === 0 || loading) && styles.nextTextDisabled,
            ]}
          >
            {loading ? 'Creating...' : 'Next'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Selected users */}
      {selectedUsers.size > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>To:</Text>
          <FlatList
            data={users.filter((u) => selectedUsers.has(u.id))}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.selectedChip}
                onPress={() => toggleSelection(item.id)}
              >
                <Text style={styles.selectedChipText}>{item.username}</Text>
                <Ionicons name="close" size={14} color={colors.text.primary} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => `selected-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedList}
          />
        </View>
      )}

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search people..."
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
      </View>

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          searchQuery.length >= 2 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color={colors.text.muted} />
              <Text style={styles.emptyText}>Search for people to message</Text>
            </View>
          )
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  cancelText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  nextText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  nextTextDisabled: {
    opacity: 0.5,
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  selectedLabel: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    paddingLeft: spacing.lg,
  },
  selectedList: {
    paddingHorizontal: spacing.sm,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: 4,
    gap: 4,
  },
  selectedChipText: {
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
    borderRadius: borderRadius.md,
  },
  userItemSelected: {
    backgroundColor: colors.transparent.primary20,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
});
