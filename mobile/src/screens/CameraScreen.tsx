import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { GradientButton } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { colors, spacing, typography, borderRadius } from '../theme/colors';
import { RootStackParamList } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type CameraNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CameraScreen: React.FC = () => {
  const navigation = useNavigation<CameraNavigationProp>();
  const { user } = useAuthStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const cameraRef = useRef<any>(null);

  // Animations
  const shutterScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);
  const recordingPulse = useSharedValue(1);

  const shutterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const recordingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordingPulse.value }],
  }));

  useEffect(() => {
    if (isRecording) {
      recordingPulse.value = withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      );
      const interval = setInterval(() => {
        recordingPulse.value = withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(1, { duration: 500 })
        );
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    shutterScale.value = withSpring(0.9, {}, () => {
      shutterScale.value = withSpring(1);
    });

    // Flash effect
    flashOpacity.value = withSequence(
      withTiming(0.8, { duration: 50 }),
      withTiming(0, { duration: 150 })
    );

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      setCapturedImage(photo.uri);
    } catch (error) {
      console.error('Failed to capture:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleRecordStart = async () => {
    if (!cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRecording(true);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
        quality: '720p',
      });
      setCapturedImage(video.uri);
    } catch (error) {
      console.error('Failed to record:', error);
    } finally {
      setIsRecording(false);
    }
  };

  const handleRecordStop = async () => {
    if (!cameraRef.current) return;
    cameraRef.current.stopRecording();
    setIsRecording(false);
  };

  const handleFlipCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCameraType((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!capturedImage || !user) return;

    setIsUploading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const formData = new FormData();
      const filename = capturedImage.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('media', {
        uri: capturedImage,
        name: filename,
        type,
      } as any);
      formData.append('user_id', user.id);
      formData.append('caption', caption);
      formData.append('media_type', capturedImage.includes('.mp4') ? 'video' : 'image');

      await api.createStory(formData);
      Alert.alert('Success', 'Story posted!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to post story');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDiscard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCapturedImage(null);
    setCaption('');
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <LinearGradient
          colors={colors.gradients.primary as any}
          style={styles.permissionIcon}
        >
          <Ionicons name="camera" size={48} color={colors.text.primary} />
        </LinearGradient>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          We need camera access to take photos and videos for your stories
        </Text>
        <GradientButton
          title="Enable Camera"
          onPress={requestPermission}
          gradient={colors.gradients.primary as any}
          style={styles.permissionButton}
        />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Preview Mode
  if (capturedImage) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedImage }} style={styles.previewImage} />

        {/* Top Controls */}
        <SafeAreaView style={styles.previewTopControls}>
          <TouchableOpacity style={styles.controlButton} onPress={handleDiscard}>
            <Ionicons name="close" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="text" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="brush" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="musical-notes" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Bottom Controls */}
        <View style={styles.previewBottomControls}>
          <BlurView intensity={80} tint="dark" style={styles.previewBlur}>
            <View style={styles.previewRow}>
              <TouchableOpacity style={styles.saveButton}>
                <Ionicons name="download-outline" size={24} color={colors.text.primary} />
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>

              <GradientButton
                title={isUploading ? 'Posting...' : 'Post Story'}
                onPress={handleUpload}
                loading={isUploading}
                gradient={colors.gradients.sunset as any}
                size="large"
                style={styles.postButton}
                icon={<Ionicons name="paper-plane" size={20} color={colors.text.primary} />}
              />
            </View>
          </BlurView>
        </View>
      </View>
    );
  }

  // Camera Mode
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flashEnabled ? 'on' : 'off'}
      />

      {/* Flash overlay */}
      <Animated.View style={[styles.flashOverlay, flashAnimatedStyle]} pointerEvents="none" />

      {/* Top Controls */}
      <SafeAreaView style={styles.topControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} color={colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.topRight}>
          <TouchableOpacity
            style={[styles.controlButton, flashEnabled && styles.controlButtonActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFlashEnabled(!flashEnabled);
            }}
          >
            <Ionicons
              name={flashEnabled ? 'flash' : 'flash-off'}
              size={24}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="timer-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="sparkles-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Gallery */}
        <TouchableOpacity style={styles.galleryButton} onPress={handlePickImage}>
          <Ionicons name="images" size={28} color={colors.text.primary} />
        </TouchableOpacity>

        {/* Shutter */}
        <Animated.View style={[styles.shutterWrapper, shutterAnimatedStyle]}>
          <TouchableOpacity
            style={[styles.shutterButton, isRecording && styles.shutterRecording]}
            onPress={handleCapture}
            onLongPress={handleRecordStart}
            onPressOut={isRecording ? handleRecordStop : undefined}
            delayLongPress={200}
          >
            <Animated.View
              style={[
                styles.shutterInner,
                isRecording && styles.shutterInnerRecording,
                recordingStyle,
              ]}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Flip Camera */}
        <TouchableOpacity style={styles.flipButton} onPress={handleFlipCamera}>
          <Ionicons name="camera-reverse" size={28} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Recording Indicator */}
      {isRecording && (
        <Animated.View entering={ZoomIn} style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording...</Text>
        </Animated.View>
      )}

      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity style={styles.modeButton}>
          <Text style={[styles.modeText, styles.modeTextActive]}>Story</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeButton}>
          <Text style={styles.modeText}>Reel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeButton}>
          <Text style={styles.modeText}>Live</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  camera: {
    flex: 1,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
  },
  topRight: {
    gap: spacing.sm,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.black50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: colors.primary,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.transparent.black50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: spacing.xl,
  },
  shutterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterRecording: {
    borderColor: colors.status.error,
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.text.primary,
  },
  shutterInnerRecording: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.status.error,
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.transparent.black50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.xl,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparent.black70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.status.error,
    marginRight: spacing.sm,
  },
  recordingText: {
    color: colors.text.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  modeSelector: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  modeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  modeText: {
    color: colors.text.secondary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  modeTextActive: {
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  previewTopControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewBottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  previewBlur: {
    padding: spacing.lg,
    paddingBottom: 50,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  saveText: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
  },
  postButton: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  permissionTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  permissionText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    width: '100%',
    marginBottom: spacing.md,
  },
  goBackButton: {
    padding: spacing.md,
  },
  goBackText: {
    color: colors.text.tertiary,
    fontSize: typography.sizes.md,
  },
});
