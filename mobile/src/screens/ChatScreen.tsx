import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { Avatar } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { Message, RootStackParamList, WSMessage } from '../types';

type ChatNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type ChatRouteProp = RouteProp<RootStackParamList, 'Chat'>;

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  onLongPress: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar,
  onLongPress,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const isMedia = message.message_type === 'image' || message.message_type === 'video';

  return (
    <Animated.View
      entering={isOwn ? SlideInRight : FadeInDown}
      style={[
        styles.messageRow,
        isOwn ? styles.messageRowOwn : styles.messageRowOther,
      ]}
    >
      {!isOwn && showAvatar && (
        <Avatar
          uri={message.sender?.avatar_url}
          name={message.sender?.username}
          size={28}
          style={styles.messageAvatar}
        />
      )}
      {!isOwn && !showAvatar && <View style={styles.avatarSpacer} />}

      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onLongPress();
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
        >
          <View
            style={[
              styles.messageBubble,
              isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
              isMedia && styles.messageBubbleMedia,
            ]}
          >
            {isMedia && message.media_url && (
              <Image
                source={{ uri: message.media_url }}
                style={styles.messageMedia}
                resizeMode="cover"
              />
            )}
            {message.content && (
              <Text
                style={[
                  styles.messageText,
                  isOwn ? styles.messageTextOwn : styles.messageTextOther,
                ]}
              >
                {message.content}
              </Text>
            )}
            {message.view_once && (
              <View style={styles.viewOnceBadge}>
                <Ionicons name="eye-off" size={12} color={colors.text.primary} />
                <Text style={styles.viewOnceText}>View once</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.messageTime,
              isOwn ? styles.messageTimeOwn : styles.messageTimeOther,
            ]}
          >
            {formatTime(message.created_at)}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const formatTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TypingIndicator: React.FC = () => (
  <Animated.View entering={FadeIn} style={styles.typingContainer}>
    <View style={styles.typingDots}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(i * 150)}
          style={[styles.typingDot]}
        />
      ))}
    </View>
    <Text style={styles.typingText}>typing...</Text>
  </Animated.View>
);

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<ChatNavigationProp>();
  const route = useRoute<ChatRouteProp>();
  const { user } = useAuthStore();
  const { chatRoom } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [viewOnce, setViewOnce] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const otherUser = chatRoom.other_user;

  // Load messages
  useEffect(() => {
    if (!user) return;

    const loadMessages = async () => {
      try {
        const data = await api.getMessages(user.id, chatRoom.id);
        setMessages(data.reverse());
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    loadMessages();
  }, [user, chatRoom.id]);

  // WebSocket connection
  useEffect(() => {
    if (!user) return;

    const ws = new WebSocket(api.getWsUrl(user.id));

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);

        switch (data.type) {
          case 'message':
            if (data.payload.chat_room_id === chatRoom.id) {
              setMessages((prev) => [...prev, data.payload]);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            break;
          case 'typing':
            if (data.payload.chat_room_id === chatRoom.id && data.payload.user_id !== user.id) {
              setOtherUserTyping(data.payload.is_typing);
            }
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [user, chatRoom.id]);

  // Handle typing indicator
  const handleTyping = useCallback((text: string) => {
    setInputText(text);

    if (!isTyping) {
      setIsTyping(true);
      wsRef.current?.send(
        JSON.stringify({
          type: 'typing',
          payload: { chat_room_id: chatRoom.id, is_typing: true },
        })
      );
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      wsRef.current?.send(
        JSON.stringify({
          type: 'typing',
          payload: { chat_room_id: chatRoom.id, is_typing: false },
        })
      );
    }, 2000);
  }, [isTyping, chatRoom.id]);

  const handleSend = async () => {
    if (!inputText.trim() || !user) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      chat_room_id: chatRoom.id,
      sender_id: user.id,
      sender: user,
      message_type: 'text',
      content: inputText.trim(),
      view_once: viewOnce,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setInputText('');
    setViewOnce(false);

    try {
      await api.sendMessage(user.id, chatRoom.id, inputText.trim(), 'text', viewOnce);
    } catch (error) {
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handlePickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (!result.canceled && user) {
      // Would upload and send media message
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && user) {
      // Would upload and send media message
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleMessageAction = (message: Message) => {
    Alert.alert('Message Options', undefined, [
      { text: 'Reply', onPress: () => {} },
      { text: 'Copy', onPress: () => {} },
      message.sender_id === user?.id && {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {},
      },
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean) as any);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender_id === user?.id;
    const prevMessage = messages[index - 1];
    const showAvatar = !prevMessage || prevMessage.sender_id !== item.sender_id;

    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
        showAvatar={showAvatar}
        onLongPress={() => handleMessageAction(item)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerUser}
          onPress={() =>
            otherUser && navigation.navigate('Profile', { userId: otherUser.id })
          }
        >
          <Avatar
            uri={otherUser?.avatar_url}
            name={otherUser?.username || chatRoom.name}
            size={40}
            showOnlineIndicator
            isOnline={true} // Would come from real-time presence
          />
          <View style={styles.headerUserInfo}>
            <Text style={styles.headerName}>
              {chatRoom.is_group ? chatRoom.name : otherUser?.display_name || otherUser?.username}
            </Text>
            <Text style={styles.headerStatus}>
              {otherUserTyping ? 'typing...' : 'Active now'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="call-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="videocam-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListFooterComponent={otherUserTyping ? <TypingIndicator /> : null}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <BlurView intensity={80} tint="dark" style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.inputButton} onPress={handleCamera}>
              <Ionicons name="camera" size={24} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.inputButton} onPress={handlePickMedia}>
              <Ionicons name="images" size={22} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor={colors.text.muted}
                value={inputText}
                onChangeText={handleTyping}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.viewOnceButton, viewOnce && styles.viewOnceButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setViewOnce(!viewOnce);
                }}
              >
                <Ionicons
                  name={viewOnce ? 'eye-off' : 'eye'}
                  size={18}
                  color={viewOnce ? colors.primary : colors.text.tertiary}
                />
              </TouchableOpacity>
            </View>

            {inputText.trim() ? (
              <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                <Ionicons name="send" size={20} color={colors.text.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.inputButton}>
                <Ionicons name="mic" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </BlurView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  headerUserInfo: {
    marginLeft: spacing.sm,
  },
  headerName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  headerStatus: {
    fontSize: typography.sizes.xs,
    color: colors.status.online,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerButton: {
    padding: spacing.sm,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    marginRight: spacing.xs,
  },
  avatarSpacer: {
    width: 32,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
  },
  messageBubbleOwn: {
    backgroundColor: colors.chat.sent,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.chat.received,
    borderBottomLeftRadius: 4,
  },
  messageBubbleMedia: {
    padding: 4,
    overflow: 'hidden',
  },
  messageMedia: {
    width: 200,
    height: 250,
    borderRadius: borderRadius.lg,
  },
  messageText: {
    fontSize: typography.sizes.md,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: colors.chat.sentText,
  },
  messageTextOther: {
    color: colors.chat.receivedText,
  },
  viewOnceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  viewOnceText: {
    fontSize: typography.sizes.xs,
    color: colors.text.primary,
    marginLeft: 4,
  },
  messageTime: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  messageTimeOwn: {
    textAlign: 'right',
    color: colors.text.tertiary,
  },
  messageTimeOther: {
    textAlign: 'left',
    color: colors.text.tertiary,
    marginLeft: 4,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.tertiary,
  },
  typingText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  inputButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    maxHeight: 100,
  },
  viewOnceButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  viewOnceButtonActive: {
    backgroundColor: colors.transparent.primary20,
    borderRadius: borderRadius.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
