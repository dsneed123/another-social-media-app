import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { TabNavigator } from './TabNavigator';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { StoryViewerScreen } from '../screens/StoryViewerScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ProfileDetailScreen } from '../screens/ProfileDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { FollowersScreen } from '../screens/FollowersScreen';
import { CommentsScreen } from '../screens/CommentsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { NewChatScreen } from '../screens/NewChatScreen';

import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background.primary,
    card: colors.background.secondary,
    text: colors.text.primary,
    border: colors.border.default,
    notification: colors.status.error,
  },
};

const LoadingScreen = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  if (isLoading) {
    return (
      <>
        <StatusBar style="light" />
        <LoadingScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer theme={DarkTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background.primary },
            animation: 'slide_from_right',
          }}
        >
          {isAuthenticated ? (
            <>
              <Stack.Screen name="Main" component={TabNavigator} />
              <Stack.Screen
                name="StoryViewer"
                component={StoryViewerScreen}
                options={{
                  animation: 'fade',
                  presentation: 'fullScreenModal',
                }}
              />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="Profile" component={ProfileDetailScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="Followers" component={FollowersScreen} />
              <Stack.Screen
                name="Comments"
                component={CommentsScreen}
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="NewChat"
                component={NewChatScreen}
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="Search"
                component={NotificationsScreen}
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ animation: 'fade' }}
              />
              <Stack.Screen name="Signup" component={SignupScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
});
