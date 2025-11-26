// Core types for the Relay Social app

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  display_name?: string;
  about?: string;
  profile_link?: string;
  role: 'user' | 'admin' | 'moderator';
  follower_count: number;
  following_count: number;
  story_count: number;
  created_at: string;
  updated_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  expires_at: string;
  created_at: string;
  user?: User;
  has_liked?: boolean;
  has_viewed?: boolean;
}

export interface ChatRoom {
  id: string;
  name?: string;
  is_group: boolean;
  created_by: string;
  created_at: string;
  last_message?: Message;
  members?: ChatMember[];
  other_user?: User;
  unread_count?: number;
}

export interface ChatMember {
  id: string;
  chat_room_id: string;
  user_id: string;
  user?: User;
  joined_at: string;
  last_read_at?: string;
}

export interface Message {
  id: string;
  chat_room_id: string;
  sender_id: string;
  sender?: User;
  message_type: 'text' | 'image' | 'video';
  content?: string;
  media_url?: string;
  thumbnail_url?: string;
  view_once: boolean;
  expires_at?: string;
  deleted_at?: string;
  created_at: string;
  is_saved?: boolean;
  viewed_by?: string[];
}

export interface Comment {
  id: string;
  story_id: string;
  user_id: string;
  user?: User;
  comment_text: string;
  parent_comment_id?: string;
  reply_count: number;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  follower?: User;
  following?: User;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'follow' | 'like' | 'comment' | 'mention' | 'message';
  from_user_id?: string;
  from_user?: User;
  story_id?: string;
  story?: Story;
  comment_id?: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

export interface Streak {
  id: string;
  user1_id: string;
  user2_id: string;
  other_user?: User;
  current_streak: number;
  longest_streak: number;
  last_interaction_date: string;
}

export interface FeedItem extends Story {
  feed_score?: number;
  is_ad?: boolean;
}

// API Response types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Signup: undefined;
  Camera: undefined;
  StoryViewer: { stories: Story[]; initialIndex: number };
  Profile: { userId: string };
  EditProfile: undefined;
  Settings: undefined;
  Chat: { chatRoom: ChatRoom };
  NewChat: undefined;
  Followers: { userId: string; type: 'followers' | 'following' };
  Comments: { storyId: string };
  Search: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Discover: undefined;
  Camera: undefined;
  Chats: undefined;
  Profile: undefined;
};

// WebSocket message types
export interface WSMessage {
  type: 'message' | 'typing' | 'presence' | 'read' | 'delete';
  payload: any;
}

export interface TypingIndicator {
  user_id: string;
  chat_room_id: string;
  is_typing: boolean;
}
