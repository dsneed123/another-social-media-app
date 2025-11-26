import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { Avatar } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { Comment, RootStackParamList } from '../types';

type CommentsRouteProp = RouteProp<RootStackParamList, 'Comments'>;

export const CommentsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CommentsRouteProp>();
  const { user } = useAuthStore();
  const { storyId } = route.params;

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const data = await api.getComments(storyId);
      setComments(data);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  }, [storyId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !user) return;

    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const comment = await api.addComment(storyId, user.id, newComment.trim());
      setComments((prev) => [comment, ...prev]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to send comment:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  const renderComment = ({ item, index }: { item: Comment; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)} style={styles.commentItem}>
      <TouchableOpacity>
        <Avatar
          uri={item.user?.avatar_url}
          name={item.user?.username}
          size={40}
        />
      </TouchableOpacity>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{item.user?.username}</Text>
          <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
        </View>
        <Text style={styles.commentText}>{item.comment_text}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.commentAction}>
            <Ionicons name="heart-outline" size={16} color={colors.text.tertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentAction}>
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <View style={styles.headerHandle} />
        <Text style={styles.headerTitle}>Comments</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </Animated.View>

      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={48} color={colors.text.muted} />
            <Text style={styles.emptyText}>No comments yet</Text>
            <Text style={styles.emptySubtext}>Be the first to comment!</Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inputContainer}>
          <Avatar
            uri={user?.avatar_url}
            name={user?.username}
            size={36}
          />
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={colors.text.muted}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
            onPress={handleSendComment}
            disabled={!newComment.trim() || sending}
          >
            <Ionicons
              name="send"
              size={20}
              color={newComment.trim() ? colors.primary : colors.text.muted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.light,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  commentContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentUsername: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  commentTime: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },
  commentText: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    marginTop: 2,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  commentAction: {
    marginRight: spacing.md,
  },
  replyText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    fontWeight: typography.weights.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    maxHeight: 80,
  },
  sendButton: {
    padding: spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
