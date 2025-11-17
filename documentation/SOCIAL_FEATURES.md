# Social Features Implementation

## Overview
Complete social engagement system for stories including followers, likes, and comments.

## Features Implemented

### 1. Follow System
- Users can follow/unfollow other users
- View follower and following lists
- Track follower counts with automatic updates
- Check follow relationships between users

**Endpoints:**
- `POST /api/social/follow/:follower_id/:following_id` - Follow a user
- `POST /api/social/unfollow/:follower_id/:following_id` - Unfollow a user
- `GET /api/social/follow-stats/:user_id/:viewer_id` - Get follow statistics
- `GET /api/social/followers/:user_id/:viewer_id` - Get list of followers
- `GET /api/social/following/:user_id/:viewer_id` - Get list of following

### 2. Story Likes
- Like/unlike stories
- Automatic like count updates via database triggers
- Track which stories a user has liked
- Display like counts on stories

**Endpoints:**
- `POST /api/social/like/:story_id/:user_id` - Like a story
- `POST /api/social/unlike/:story_id/:user_id` - Unlike a story
- `GET /api/social/likes/:story_id` - Get list of users who liked a story

### 3. Comments
- Add comments to stories
- View all comments on a story
- Delete your own comments
- Automatic comment count updates via database triggers
- Real-time comment display

**Endpoints:**
- `POST /api/social/comment/:story_id/:user_id` - Add a comment
- `GET /api/social/comments/:story_id` - Get all comments for a story
- `DELETE /api/social/comment/delete/:comment_id/:user_id` - Delete a comment

## Database Schema

### Tables Created

#### `follows`
```sql
- follower_id: UUID (references users.id)
- following_id: UUID (references users.id)
- created_at: TIMESTAMPTZ
- UNIQUE(follower_id, following_id)
```

#### `story_likes`
```sql
- id: UUID (primary key)
- story_id: UUID (references stories.id)
- user_id: UUID (references users.id)
- created_at: TIMESTAMPTZ
- UNIQUE(story_id, user_id)
```

#### `story_comments`
```sql
- id: UUID (primary key)
- story_id: UUID (references stories.id)
- user_id: UUID (references users.id)
- comment_text: TEXT
- created_at: TIMESTAMPTZ
```

### Updated Columns

#### `stories` table
- `like_count: INTEGER DEFAULT 0` - Automatically updated by trigger
- `comment_count: INTEGER DEFAULT 0` - Automatically updated by trigger

#### `users` table
- `follower_count: INTEGER DEFAULT 0` - Automatically updated by trigger
- `following_count: INTEGER DEFAULT 0` - Automatically updated by trigger
- `story_count: INTEGER DEFAULT 0` - For future use

### Database Triggers

1. **update_follower_counts()** - Automatically updates follower_count and following_count when follows are added/removed
2. **update_story_like_counts()** - Automatically updates like_count on stories when likes are added/removed
3. **update_story_comment_counts()** - Automatically updates comment_count on stories when comments are added/removed

## Frontend Integration

### Stories Page (`stories.html`)
- Like button toggles liked state with heart icon animation
- Like counts display and update in real-time
- Comment button opens popup window with comments
- Profile avatar click shows user stats and follow/unfollow option
- Comments count displays on each story

### Comments Page (`story-comments.html`)
- Popup window for viewing and adding comments
- Real-time comment list with usernames and timestamps
- Add new comments with text input
- Delete your own comments
- "Time ago" display (e.g., "2m ago", "5h ago")
- Automatic count updates

## Usage Examples

### Like a Story
```javascript
// Frontend
const response = await fetch(`/api/social/like/${storyId}/${userId}`, {
    method: 'POST'
});
const data = await response.json();
// Returns: { is_liked: true, like_count: 42 }
```

### Add a Comment
```javascript
// Frontend
const response = await fetch(`/api/social/comment/${storyId}/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_text: "Great story!" })
});
const data = await response.json();
// Returns: { id: "...", story_id: "...", user_id: "...", comment_text: "...", created_at: "..." }
```

### Follow a User
```javascript
// Frontend
const response = await fetch(`/api/social/follow/${currentUserId}/${targetUserId}`, {
    method: 'POST'
});
const data = await response.json();
// Returns: { success: true, message: "Successfully followed user" }
```

## Backend Implementation

### Module: `social.rs`
Located at: `/backend/src/social.rs`

**Key Functions:**
- `follow_user()` - Creates follow relationship
- `unfollow_user()` - Removes follow relationship
- `get_follow_stats()` - Returns follower/following counts and relationship status
- `get_followers()` - Returns list of users following target user
- `get_following()` - Returns list of users target user follows
- `like_story()` - Creates like relationship
- `unlike_story()` - Removes like relationship
- `get_story_likes()` - Returns list of users who liked story
- `add_comment()` - Creates new comment
- `get_story_comments()` - Returns all comments with usernames
- `delete_comment()` - Deletes comment (owner only)

**Response Structs:**
- `FollowStats` - Contains follower_count, following_count, is_following
- `UserListItem` - Contains user_id, username, is_following
- `Comment` - Contains id, story_id, user_id, username, comment_text, created_at

### Updated Story Queries
The `get_feed_stories()` function now includes:
- `like_count` - Number of likes on story
- `comment_count` - Number of comments on story
- `is_liked` - Whether current viewer liked the story
- `is_viewed` - Whether current viewer viewed the story

## Testing

### Test Flow
1. Create multiple test users (alice, bob, charlie)
2. Each user creates stories
3. Test following users
4. Test liking stories from different users
5. Test commenting on stories
6. Test deleting own comments
7. Verify counts update automatically
8. Verify follow relationships display correctly

### Manual Testing Steps
```bash
# Create test users via registration
# Login as alice -> Create story -> Logout
# Login as bob -> View alice's story -> Like -> Comment
# Check database: SELECT * FROM story_likes;
# Check database: SELECT * FROM story_comments;
# Verify counts: SELECT like_count, comment_count FROM stories;
```

## Performance Considerations

- **Database Triggers**: Counts are updated automatically by PostgreSQL triggers, reducing API round-trips
- **Indexed Columns**: Foreign keys are indexed for fast lookups
- **Unique Constraints**: Prevent duplicate likes/follows at database level
- **Cascading Deletes**: When a story is deleted, associated likes/comments are automatically removed

## Security

- **User Verification**: All endpoints verify user_id exists before operations
- **Comment Ownership**: Only comment owner can delete their comments
- **Follow Validation**: Cannot follow yourself, unique constraint prevents duplicates
- **Like Validation**: Unique constraint prevents duplicate likes from same user

## Future Enhancements

- [ ] Like notifications via WebSocket
- [ ] Comment notifications
- [ ] Reply to comments (nested comments)
- [ ] Tag users in comments (@mentions)
- [ ] Block users
- [ ] Report inappropriate comments
- [ ] Comment reactions (like/heart comments)
- [ ] Follower-only stories privacy
- [ ] Story insights (view list, like list)
- [ ] Suggested users to follow
- [ ] Mutual friends indicator
