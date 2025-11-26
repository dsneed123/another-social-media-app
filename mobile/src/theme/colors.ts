// Relay Social - Modern Dark Theme with Vibrant Accents
export const colors = {
  // Primary brand colors
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  primaryDark: '#5541D7',

  // Accent colors
  accent: '#00D9FF',
  accentPink: '#FF6B9D',
  accentOrange: '#FFA502',
  accentGreen: '#00E676',

  // Gradient presets
  gradients: {
    primary: ['#6C5CE7', '#A29BFE'],
    sunset: ['#FF6B9D', '#FFA502'],
    ocean: ['#00D9FF', '#6C5CE7'],
    aurora: ['#00E676', '#00D9FF', '#6C5CE7'],
    story: ['#833AB4', '#FD1D1D', '#FCB045'],
  },

  // Background colors
  background: {
    primary: '#0A0A0F',
    secondary: '#12121A',
    tertiary: '#1A1A25',
    card: '#1E1E2D',
    elevated: '#252536',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },

  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: '#B8B8C7',
    tertiary: '#6B6B7B',
    muted: '#4A4A5A',
    inverse: '#0A0A0F',
  },

  // UI elements
  border: {
    default: '#2A2A3A',
    light: '#3A3A4A',
    focus: '#6C5CE7',
  },

  // Status colors
  status: {
    success: '#00E676',
    warning: '#FFA502',
    error: '#FF4757',
    info: '#00D9FF',
    online: '#00E676',
    offline: '#6B6B7B',
  },

  // Chat bubbles
  chat: {
    sent: '#6C5CE7',
    received: '#252536',
    sentText: '#FFFFFF',
    receivedText: '#FFFFFF',
  },

  // Story ring colors
  storyRing: {
    unseen: ['#833AB4', '#FD1D1D', '#FCB045'],
    seen: ['#4A4A5A', '#4A4A5A'],
  },

  // Transparent variants
  transparent: {
    white10: 'rgba(255, 255, 255, 0.1)',
    white20: 'rgba(255, 255, 255, 0.2)',
    white50: 'rgba(255, 255, 255, 0.5)',
    black50: 'rgba(0, 0, 0, 0.5)',
    black70: 'rgba(0, 0, 0, 0.7)',
    primary20: 'rgba(108, 92, 231, 0.2)',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
    display: 40,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
