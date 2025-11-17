# View Tracking & Comments Modal Update

## Changes Made

### 1. View Count Display ✅
- **Location**: `stories.html` - story info section
- **Feature**: View count now displays next to the timestamp with an eye icon
- **Format**: Shows as `👁️ [count]` (e.g., "👁️ 42")
- **Data Source**: Uses `story.view_count` from API response
- **Backend**: View tracking already implemented via `/api/stories/:story_id/view/:viewer_id` endpoint

### 2. Comments Modal (Popup) ✅
- **Previous Behavior**: Comments opened in a new browser window/tab using `window.open()`
- **New Behavior**: Comments now open as a beautiful bottom sheet modal overlay

#### Modal Features:
- **Smooth Animations**: Fade in background + slide up bottom sheet
- **Bottom Sheet Design**: Modern mobile-friendly design (70vh max height)
- **Dark Theme**: Matches app's black/purple color scheme
- **Header**: Shows comment count + close button (X)
- **Comments List**: Scrollable area with:
  - User avatars with gradient
  - Username and timestamp
  - Comment text
  - Delete button (for your own comments)
- **Input Area**: 
  - Text input with purple focus border
  - Send button (purple circle with arrow)
  - Enter key support
- **Close Options**: Click X button or click background overlay
- **Empty State**: Shows friendly "No comments yet" message
- **Loading State**: Shows spinner while loading

#### Modal CSS Highlights:
```css
- .comments-modal: Full-screen overlay with backdrop
- .comments-modal-content: Bottom sheet container
- Animations: fadeIn + slideUp
- Responsive: max-height 70vh
- Scrollable: Comments list with custom scrollbar
```

#### JavaScript Functions Added:
- `openComments(storyId, commentCount)` - Creates and shows modal
- `closeCommentsModal()` - Removes modal from DOM
- `loadModalComments(storyId)` - Fetches comments from API
- `renderModalComments(comments)` - Renders comment list
- `postModalComment(storyId)` - Posts new comment
- `deleteModalComment(commentId)` - Deletes comment
- Enter key handler - Submit comment on Enter
- Background click handler - Close modal on overlay click

#### Real-time Updates:
- After posting a comment, the modal automatically updates
- Comment count in the main feed also updates
- Delete operation refreshes the modal list

### 3. Code Organization
- All modal styles added to `<style>` section in stories.html
- All modal functions added to `<script>` section
- Event listeners for Enter key and background clicks
- Clean separation from story-comments.html (kept as backup)

## User Experience Improvements

### Before:
- Views: Not displayed
- Comments: Opened in new window (disruptive, loses context)
- Felt clunky and old-school

### After:
- Views: Clearly visible with icon next to timestamp
- Comments: Smooth modal popup that stays in context
- Modern, app-like experience
- Keyboard support (Enter to submit)
- Easy to close (X button or click outside)
- Better mobile experience

## Testing Checklist

- [x] View count displays correctly
- [x] View count only shows if > 0
- [x] Modal opens smoothly with animation
- [x] Comments load from API
- [x] Can post new comments
- [x] Can delete own comments
- [x] Enter key submits comment
- [x] Click outside closes modal
- [x] X button closes modal
- [x] Comment count updates after posting
- [x] Empty state shows when no comments
- [x] Loading state shows while fetching

## Technical Details

### API Endpoints Used:
- `GET /api/social/comments/:story_id` - Fetch comments
- `POST /api/social/comment/:story_id/:user_id` - Add comment
- `DELETE /api/social/comment/delete/:comment_id/:user_id` - Delete comment
- `POST /api/stories/:story_id/view/:viewer_id` - Mark story as viewed

### View Count Flow:
1. User scrolls to story
2. `markStoryViewed()` calls API
3. Backend increments view_count in database
4. Next feed load shows updated count
5. Display shows count next to timestamp with eye icon

### Comment Modal Flow:
1. User clicks comment button
2. `openComments()` creates modal DOM
3. `loadModalComments()` fetches data
4. `renderModalComments()` displays list
5. User types and submits (Enter or click)
6. `postModalComment()` sends to API
7. Modal refreshes with new comment
8. Main feed count updates

## Files Modified

- `/frontend/stories.html`
  - Added ~250 lines of CSS for modal
  - Added ~180 lines of JavaScript for modal functions
  - Updated story rendering to show view count
  - Added event listeners for keyboard and click handling

## Browser Compatibility

- Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive
- Smooth animations with CSS transitions
- Fallback for older browsers (modal still functional without animations)

## Future Enhancements

- [ ] Comment reactions (like/heart individual comments)
- [ ] Reply to comments (threaded conversations)
- [ ] @mentions with autocomplete
- [ ] Image/GIF comments
- [ ] Real-time comment updates via WebSocket
- [ ] Comment pagination (if > 50 comments)
- [ ] Rich text formatting
- [ ] Edit your own comments
