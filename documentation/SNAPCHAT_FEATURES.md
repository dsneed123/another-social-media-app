# Snapchat-Style Chat Features

## Overview
The chat system now implements Snapchat-like features for ephemeral messaging.

## Features Implemented

### 1. One Chat Per User
- **Direct Messages (1:1)**: You can only have ONE direct chat with each user
- When you try to create a new chat with someone you already have a chat with, the existing chat is returned
- **Group Chats**: You can be in multiple group chats with the same people
- This prevents cluttered chat lists and maintains the Snapchat-style simplicity

### 2. View-Once Messages
- Messages can be sent in "View Once" mode (toggle the 👁️ checkbox before sending)
- View-once messages appear blurred until clicked
- Once viewed, the message is visible for 3 seconds, then automatically deletes
- **Saving Messages**: Right-click (or long-press on mobile) any message to save it
  - Saved messages won't auto-delete
  - Saved messages show a 💾 indicator

### 3. Chat Names
- **Direct Chats (1:1)**: Display the other user's username (like Snapchat)
- **Group Chats**: Display the group name set when creating the chat

### 4. Message Types
- **Text Messages**: Standard text with optional view-once
- **Images**: Photos with view-once mode
- **Videos**: Video messages (coming soon)

## API Endpoints

### Create Chat
```
POST /api/chats
Body: {
  "creator_id": "uuid",
  "is_group": false,
  "name": null,  // null for 1:1, required for groups
  "member_ids": ["uuid"]  // other user(s)
}
```
Returns existing chat if 1:1 chat already exists.

### Mark Message as Viewed
```
POST /api/users/{user_id}/messages/{message_id}/view
```
Marks message as viewed. Triggers auto-delete for view-once messages.

### Save Message
```
POST /api/users/{user_id}/messages/{message_id}/save
```
Saves a message to prevent auto-deletion.

### Unsave Message
```
DELETE /api/users/{user_id}/messages/{message_id}/unsave
```
Removes saved status, allowing message to be deleted.

## Database Schema

### New Tables
- **saved_messages**: Tracks which messages users have saved
  - Prevents auto-deletion of saved messages
  - Links message_id to user_id

### New Functions
- **find_direct_chat()**: Finds existing 1:1 chat between two users
- **auto_delete_viewed_message()**: Trigger that deletes view-once messages after viewing
- **cleanup_expired_messages()**: Cleans up expired messages (can be run periodically)

## Usage Examples

### Sending a View-Once Message
1. Type your message
2. Check the "👁️ View Once" checkbox
3. Click Send
4. Recipient will see a blurred message
5. When clicked, message displays for 3 seconds then disappears

### Saving a Message
1. Right-click on any message
2. Message is saved and shows 💾 indicator
3. Message won't auto-delete even if it's view-once

### Creating a Chat
- Click the + button to create a new chat
- Select a user from your following list
- If you already have a chat with them, it will open that chat
- If not, a new chat is created

## Technical Details

### Message Flow
1. Sender sends message with `view_once: true`
2. Message stored in database with `view_once` flag
3. Receiver sees blurred message
4. On click, `mark_message_viewed()` is called
5. Database trigger checks if message should be deleted
6. If not saved, message is soft-deleted (`deleted_at` set)
7. Frontend shows message for 3 seconds then removes from UI

### Auto-Delete Logic
Messages are auto-deleted when:
- `view_once` is true AND
- Message has been viewed AND
- Message is not saved AND
- Viewer is not the sender

Messages are preserved when:
- Marked as saved in `saved_messages` table
- Sender views their own message
- Not yet viewed

## Future Enhancements
- [ ] Streak tracking (consecutive days of messaging)
- [ ] Screenshot detection
- [ ] Message expiration timers (24 hours, etc.)
- [ ] Video messages with view-once
- [ ] Location sharing
- [ ] Bitmoji/avatar integration
