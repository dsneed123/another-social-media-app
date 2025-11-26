import storage from '../utils/storage';
import { User, Story, ChatRoom, Message, Notification, Streak, AuthResponse, Comment } from '../types';

// Configure your API base URL here
// Use your machine's IP address for physical devices/emulators
const DEV_HOST = '10.0.0.233';  // Your local machine IP

const API_BASE_URL = __DEV__
  ? `http://${DEV_HOST}:3000`  // Local backend
  : 'https://your-production-url.ondigitalocean.app';

const WS_BASE_URL = __DEV__
  ? `ws://${DEV_HOST}:3000`
  : 'wss://your-production-url.ondigitalocean.app';

class ApiService {
  private token: string | null = null;

  async init() {
    this.token = await storage.getItem('auth_token');
  }

  private async getHeaders(): Promise<HeadersInit> {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await this.getHeaders();

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    if (!response.ok) {
      // Handle both JSON and plain text error responses
      const text = await response.text();
      let errorMessage = 'Request failed';
      try {
        const json = JSON.parse(text);
        errorMessage = json.error || json.message || text;
      } catch {
        // Plain text response
        errorMessage = text || 'Request failed';
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      storage.setItem('auth_token', token);
    } else {
      storage.deleteItem('auth_token');
    }
  }

  getToken() {
    return this.token;
  }

  getWsUrl(userId: string) {
    return `${WS_BASE_URL}/ws/${userId}`;
  }

  // ============ AUTH ============
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(response.token);
    return response;
  }

  async signup(username: string, email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    this.setToken(response.token);
    return response;
  }

  async logout() {
    this.setToken(null);
  }

  // ============ STORIES ============
  async getFeed(userId: string): Promise<Story[]> {
    return this.request<Story[]>(`/api/stories/feed/${userId}`);
  }

  async getUserStories(userId: string): Promise<Story[]> {
    return this.request<Story[]>(`/api/stories/user/${userId}`);
  }

  async createStory(formData: FormData): Promise<Story> {
    const response = await fetch(`${API_BASE_URL}/api/stories/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to create story');
    return response.json();
  }

  async viewStory(storyId: string, viewerId: string): Promise<void> {
    await this.request(`/api/stories/${storyId}/view/${viewerId}`, {
      method: 'POST',
    });
  }

  async deleteStory(storyId: string, userId: string): Promise<void> {
    await this.request(`/api/stories/${storyId}/delete/${userId}`, {
      method: 'DELETE',
    });
  }

  async likeStory(storyId: string, userId: string): Promise<void> {
    await this.request(`/api/social/like/${storyId}/${userId}`, {
      method: 'POST',
    });
  }

  async unlikeStory(storyId: string, userId: string): Promise<void> {
    await this.request(`/api/social/unlike/${storyId}/${userId}`, {
      method: 'POST',
    });
  }

  // ============ COMMENTS ============
  async getComments(storyId: string): Promise<Comment[]> {
    return this.request<Comment[]>(`/api/social/comments/${storyId}`);
  }

  async addComment(storyId: string, userId: string, text: string): Promise<Comment> {
    return this.request<Comment>(`/api/social/comment/${storyId}/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ comment_text: text }),
    });
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    await this.request(`/api/social/comment/delete/${commentId}/${userId}`, {
      method: 'DELETE',
    });
  }

  // ============ SOCIAL ============
  async followUser(followerId: string, followingId: string): Promise<void> {
    await this.request(`/api/social/follow/${followerId}/${followingId}`, {
      method: 'POST',
    });
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await this.request(`/api/social/unfollow/${followerId}/${followingId}`, {
      method: 'POST',
    });
  }

  async getFollowStats(userId: string, viewerId: string): Promise<{
    follower_count: number;
    following_count: number;
    is_following: boolean;
  }> {
    return this.request(`/api/social/follow-stats/${userId}/${viewerId}`);
  }

  async getFollowers(userId: string, viewerId: string): Promise<User[]> {
    return this.request<User[]>(`/api/social/followers/${userId}/${viewerId}`);
  }

  async getFollowing(userId: string, viewerId: string): Promise<User[]> {
    return this.request<User[]>(`/api/social/following/${userId}/${viewerId}`);
  }

  // ============ PROFILE ============
  async getProfile(userId: string, viewerId: string): Promise<User & { is_following: boolean }> {
    return this.request(`/api/profile/${userId}/${viewerId}`);
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    return this.request<User>(`/api/profile/${userId}/update`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadAvatar(userId: string, formData: FormData): Promise<{ avatar_url: string }> {
    const response = await fetch(`${API_BASE_URL}/api/discovery/avatar/${userId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload avatar');
    return response.json();
  }

  // ============ DISCOVERY ============
  async searchUsers(viewerId: string, query: string): Promise<User[]> {
    return this.request<User[]>(`/api/discovery/search/${viewerId}?q=${encodeURIComponent(query)}`);
  }

  async getPopularUsers(viewerId: string): Promise<User[]> {
    return this.request<User[]>(`/api/discovery/popular/${viewerId}`);
  }

  async getSuggestedUsers(viewerId: string): Promise<User[]> {
    return this.request<User[]>(`/api/discovery/suggested/${viewerId}`);
  }

  // ============ CHAT ============
  async getChats(userId: string): Promise<ChatRoom[]> {
    return this.request<ChatRoom[]>(`/api/users/${userId}/chats`);
  }

  async createChat(memberIds: string[], name?: string): Promise<ChatRoom> {
    return this.request<ChatRoom>('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ member_ids: memberIds, name }),
    });
  }

  async getMessages(userId: string, chatRoomId: string): Promise<Message[]> {
    return this.request<Message[]>(`/api/users/${userId}/chats/${chatRoomId}/messages`);
  }

  async sendMessage(
    userId: string,
    chatRoomId: string,
    content: string,
    messageType: 'text' | 'image' | 'video' = 'text',
    viewOnce: boolean = false
  ): Promise<Message> {
    return this.request<Message>(`/api/users/${userId}/messages/send`, {
      method: 'POST',
      body: JSON.stringify({
        chat_room_id: chatRoomId,
        content,
        message_type: messageType,
        view_once: viewOnce,
      }),
    });
  }

  async viewMessage(userId: string, messageId: string): Promise<void> {
    await this.request(`/api/users/${userId}/messages/${messageId}/view`, {
      method: 'POST',
    });
  }

  async saveMessage(userId: string, messageId: string): Promise<void> {
    await this.request(`/api/users/${userId}/messages/${messageId}/save`, {
      method: 'POST',
    });
  }

  // ============ NOTIFICATIONS ============
  async getNotifications(userId: string): Promise<Notification[]> {
    return this.request<Notification[]>(`/api/notifications/${userId}`);
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    return this.request<{ count: number }>(`/api/notifications/${userId}/unread`);
  }

  async markNotificationRead(userId: string, notificationId: string): Promise<void> {
    await this.request(`/api/notifications/${userId}/${notificationId}/read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.request(`/api/notifications/${userId}/read-all`, {
      method: 'POST',
    });
  }

  // ============ STREAKS ============
  async getStreaks(userId: string): Promise<Streak[]> {
    return this.request<Streak[]>(`/api/streaks/user/${userId}`);
  }

  async getStreak(user1Id: string, user2Id: string): Promise<Streak> {
    return this.request<Streak>(`/api/streaks/${user1Id}/${user2Id}`);
  }

  // ============ SETTINGS ============
  async updateUsername(userId: string, username: string): Promise<void> {
    await this.request(`/api/settings/${userId}/username`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  async updateEmail(userId: string, email: string): Promise<void> {
    await this.request(`/api/settings/${userId}/email`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    await this.request(`/api/settings/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    await this.request(`/api/settings/${userId}/delete`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  }
}

export const api = new ApiService();
export default api;
