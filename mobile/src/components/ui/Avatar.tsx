import React from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius, typography } from '../../theme/colors';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  showStoryRing?: boolean;
  hasUnseenStory?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  showOnlineIndicator?: boolean;
  isOnline?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 48,
  showStoryRing = false,
  hasUnseenStory = false,
  onPress,
  style,
  showOnlineIndicator = false,
  isOnline = false,
}) => {
  const ringSize = size + 6;
  const ringGradient = hasUnseenStory
    ? colors.storyRing.unseen
    : colors.storyRing.seen;

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const avatarContent = (
    <View
      style={[
        styles.avatarContainer,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <LinearGradient
          colors={colors.gradients.primary as any}
          style={[
            styles.placeholder,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
            {getInitials(name)}
          </Text>
        </LinearGradient>
      )}
      {showOnlineIndicator && (
        <View
          style={[
            styles.onlineIndicator,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              backgroundColor: isOnline ? colors.status.online : colors.status.offline,
              borderWidth: size * 0.06,
            },
          ]}
        />
      )}
    </View>
  );

  const content = showStoryRing ? (
    <LinearGradient
      colors={ringGradient as any}
      style={[
        styles.storyRing,
        { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
      ]}
    >
      <View
        style={[
          styles.ringInner,
          {
            width: ringSize - 4,
            height: ringSize - 4,
            borderRadius: (ringSize - 4) / 2,
          },
        ]}
      >
        {avatarContent}
      </View>
    </LinearGradient>
  ) : (
    avatarContent
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={style}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={style}>{content}</View>;
};

const styles = StyleSheet.create({
  avatarContainer: {
    overflow: 'hidden',
  },
  image: {
    backgroundColor: colors.background.tertiary,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
  },
  storyRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderColor: colors.background.primary,
  },
});
