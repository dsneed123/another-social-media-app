import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, borderRadius, spacing, typography } from '../../theme/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerStyle,
      secureTextEntry,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const focusAnim = useSharedValue(0);

    const handleFocus = () => {
      setIsFocused(true);
      focusAnim.value = withSpring(1);
    };

    const handleBlur = () => {
      setIsFocused(false);
      focusAnim.value = withTiming(0);
    };

    const animatedBorderStyle = useAnimatedStyle(() => {
      return {
        borderColor: interpolateColor(
          focusAnim.value,
          [0, 1],
          [error ? colors.status.error : colors.border.default, colors.primary]
        ),
      };
    });

    const isPasswordField = secureTextEntry !== undefined;
    const shouldHidePassword = isPasswordField && !showPassword;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        <Animated.View style={[styles.inputContainer, animatedBorderStyle]}>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={20}
              color={isFocused ? colors.primary : colors.text.tertiary}
              style={styles.leftIcon}
            />
          )}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon && styles.inputWithLeftIcon,
              (rightIcon || isPasswordField) && styles.inputWithRightIcon,
            ]}
            placeholderTextColor={colors.text.muted}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={shouldHidePassword}
            {...props}
          />
          {isPasswordField && (
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.rightIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
          {rightIcon && !isPasswordField && (
            <TouchableOpacity
              onPress={onRightIconPress}
              style={styles.rightIcon}
              disabled={!onRightIconPress}
            >
              <Ionicons name={rightIcon} size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </Animated.View>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: spacing.md,
    color: colors.text.primary,
    fontSize: typography.sizes.lg,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  leftIcon: {
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  rightIcon: {
    padding: spacing.md,
  },
  error: {
    color: colors.status.error,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
});
