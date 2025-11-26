import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, borderRadius, spacing, typography } from '../../theme/colors';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  gradient?: string[];
  loading?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  gradient = colors.gradients.primary,
  loading = false,
  disabled = false,
  size = 'medium',
  style,
  textStyle,
  icon,
}) => {
  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  const sizeStyles = {
    small: { height: 40, paddingHorizontal: spacing.md },
    medium: { height: 52, paddingHorizontal: spacing.lg },
    large: { height: 60, paddingHorizontal: spacing.xl },
  };

  const textSizes = {
    small: typography.sizes.md,
    medium: typography.sizes.lg,
    large: typography.sizes.xl,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.container, style]}
    >
      <LinearGradient
        colors={disabled ? [colors.text.muted, colors.text.tertiary] : gradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, sizeStyles[size]]}
      >
        {loading ? (
          <ActivityIndicator color={colors.text.primary} size="small" />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.text,
                { fontSize: textSizes[size] },
                icon ? { marginLeft: spacing.sm } : undefined,
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  text: {
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
});
