import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Platform-agnostic storage that works on web (localStorage) and native (SecureStore)
const isWeb = Platform.OS === 'web';

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    // SecureStore only accepts strings - guard against null/undefined
    if (value === null || value === undefined) {
      console.warn(`storage.setItem: Ignoring null/undefined value for key "${key}"`);
      return;
    }
    const stringValue = String(value);
    if (isWeb) {
      localStorage.setItem(key, stringValue);
      return;
    }
    return SecureStore.setItemAsync(key, stringValue);
  },

  async deleteItem(key: string): Promise<void> {
    if (isWeb) {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export default storage;
