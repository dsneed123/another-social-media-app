import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  SlideInDown,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Avatar } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { Story, RootStackParamList } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PROGRESS_BAR_HEIGHT = 3;

type StoryViewerNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StoryViewer'>;
type StoryViewerRouteProp = RouteProp<RootStackParamList, 'StoryViewer'>;

const ProgressBar: React.FC<{
  index: number;
  currentIndex: number;
  progress: SharedValue<number>;
  total: number;
}> = ({ index, currentIndex, progress, total }) => {
  const animatedStyle = useAnimatedStyle(() => {
    if (index < currentIndex) {
      return { width: '100%' };
    }
    if (index > currentIndex) {
      return { width: '0%' };
    }
    return {
      width: `${progress.value * 100}%`,
    };
  });

  return (
    <View style={[styles.progressBarContainer, { width: `${100 / total - 1}%` }]}>
      <Animated.View style={[styles.progressBarFill, animatedStyle]} />
    </View>
  );
};

export const StoryViewerScreen: React.FC = () => {
  const navigation = useNavigation<StoryViewerNavigationProp>();
  const route = useRoute<StoryViewerRouteProp>();
  const { user } = useAuthStore();

  const { stories, initialIndex } = route.params;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  const progress = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const videoRef = useRef<Video>(null);

  const currentStory = stories[currentIndex];
  const isVideo = currentStory?.media_type === 'video';
  const STORY_DURATION = isVideo ? 30000 : 5000; // 30s for video, 5s for image

  // Mark story as viewed
  useEffect(() => {
    if (currentStory && user) {
      api.viewStory(currentStory.id, user.id).catch(console.error);
    }
  }, [currentStory, user]);

  // Progress timer
  useEffect(() => {
    if (isPaused || isVideo) return;

    progress.value = 0;
    progress.value = withTiming(1, { duration: STORY_DURATION });

    const timeout = setTimeout(() => {
      goToNextStory();
    }, STORY_DURATION);

    return () => clearTimeout(timeout);
  }, [currentIndex, isPaused, isVideo]);

  const goToNextStory = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      progress.value = 0;
    } else {
      navigation.goBack();
    }
  }, [currentIndex, stories.length, navigation]);

  const goToPrevStory = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      progress.value = 0;
    }
  }, [currentIndex]);

  const handleTap = (side: 'left' | 'right') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (side === 'left') {
      goToPrevStory();
    } else {
      goToNextStory();
    }
  };

  const handleLongPressIn = () => {
    setIsPaused(true);
    scale.value = withSpring(0.95);
    videoRef.current?.pauseAsync();
  };

  const handleLongPressOut = () => {
    setIsPaused(false);
    scale.value = withSpring(1);
    videoRef.current?.playAsync();
  };

  const handleLike = async () => {
    if (!user || !currentStory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLiked(!isLiked);

    try {
      if (isLiked) {
        await api.unlikeStory(currentStory.id, user.id);
      } else {
        await api.likeStory(currentStory.id, user.id);
      }
    } catch (error) {
      setIsLiked(isLiked); // Revert on error
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Would send message via API
    setReplyText('');
    setShowReply(false);
  };

  // Swipe to dismiss gesture
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        scale.value = interpolate(
          event.translationY,
          [0, 200],
          [1, 0.9],
          Extrapolation.CLAMP
        );
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        runOnJS(navigation.goBack)();
      } else {
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
      }
    });

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!currentStory) return null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.storyContainer, animatedContainerStyle]}>
          {/* Media */}
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: currentStory.media_url }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay={!isPaused}
              isLooping={false}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded && status.durationMillis) {
                  progress.value = status.positionMillis / status.durationMillis;
                  if (status.didJustFinish) {
                    goToNextStory();
                  }
                }
              }}
            />
          ) : (
            <Image
              source={{ uri: currentStory.media_url }}
              style={styles.media}
              resizeMode="cover"
            />
          )}

          {/* Gradient overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
            locations={[0, 0.2, 0.8, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Touch areas */}
          <View style={styles.touchAreas}>
            <TouchableWithoutFeedback
              onPress={() => handleTap('left')}
              onLongPress={handleLongPressIn}
              onPressOut={handleLongPressOut}
              delayLongPress={200}
            >
              <View style={styles.touchLeft} />
            </TouchableWithoutFeedback>
            <TouchableWithoutFeedback
              onPress={() => handleTap('right')}
              onLongPress={handleLongPressIn}
              onPressOut={handleLongPressOut}
              delayLongPress={200}
            >
              <View style={styles.touchRight} />
            </TouchableWithoutFeedback>
          </View>

          {/* Header */}
          <SafeAreaView style={styles.header} edges={['top']}>
            {/* Progress bars */}
            <View style={styles.progressBars}>
              {stories.map((_, index) => (
                <ProgressBar
                  key={index}
                  index={index}
                  currentIndex={currentIndex}
                  progress={progress}
                  total={stories.length}
                />
              ))}
            </View>

            {/* User info */}
            <View style={styles.userRow}>
              <TouchableOpacity
                style={styles.userInfo}
                onPress={() => {
                  navigation.goBack();
                  navigation.navigate('Profile', { userId: currentStory.user_id });
                }}
              >
                <Avatar
                  uri={currentStory.user?.avatar_url}
                  name={currentStory.user?.username}
                  size={36}
                />
                <View style={styles.userText}>
                  <Text style={styles.username}>{currentStory.user?.username}</Text>
                  <Text style={styles.timestamp}>
                    {formatTimeAgo(currentStory.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.headerActions}>
                {isPaused && (
                  <Animated.View entering={FadeIn} exiting={FadeOut}>
                    <Ionicons name="pause" size={20} color={colors.text.primary} />
                  </Animated.View>
                )}
                <TouchableOpacity style={styles.headerButton}>
                  <Ionicons name="ellipsis-horizontal" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          {/* Caption */}
          {currentStory.caption && (
            <View style={styles.captionContainer}>
              <Text style={styles.caption}>{currentStory.caption}</Text>
            </View>
          )}

          {/* Footer */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.footer}
          >
            <SafeAreaView edges={['bottom']} style={styles.footerContent}>
              {showReply ? (
                <Animated.View entering={SlideInDown} style={styles.replyContainer}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Send a reply..."
                    placeholderTextColor={colors.text.muted}
                    value={replyText}
                    onChangeText={setReplyText}
                    autoFocus
                    multiline
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !replyText.trim() && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSendReply}
                    disabled={!replyText.trim()}
                  >
                    <Ionicons
                      name="send"
                      size={20}
                      color={replyText.trim() ? colors.text.primary : colors.text.muted}
                    />
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.replyButton}
                    onPress={() => setShowReply(true)}
                  >
                    <Text style={styles.replyButtonText}>Send message</Text>
                  </TouchableOpacity>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                      <Ionicons
                        name={isLiked ? 'heart' : 'heart-outline'}
                        size={28}
                        color={isLiked ? colors.accentPink : colors.text.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                      <Ionicons name="paper-plane-outline" size={26} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const formatTimeAgo = (dateStr: string): string => {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyContainer: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  media: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.primary,
  },
  touchAreas: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  touchLeft: {
    flex: 1,
  },
  touchRight: {
    flex: 2,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  progressBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    gap: 4,
  },
  progressBarContainer: {
    height: PROGRESS_BAR_HEIGHT,
    backgroundColor: colors.transparent.white20,
    borderRadius: PROGRESS_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.text.primary,
    borderRadius: PROGRESS_BAR_HEIGHT / 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userText: {
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    padding: spacing.xs,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 120,
    left: spacing.lg,
    right: spacing.lg,
  },
  caption: {
    fontSize: typography.sizes.lg,
    color: colors.text.primary,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyButton: {
    flex: 1,
    height: 44,
    backgroundColor: colors.transparent.white20,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginRight: spacing.md,
  },
  replyButtonText: {
    color: colors.text.secondary,
    fontSize: typography.sizes.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    padding: spacing.xs,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.transparent.white20,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  replyInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    maxHeight: 100,
  },
  sendButton: {
    padding: spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
