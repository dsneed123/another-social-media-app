# Video Editor Testing Guide

## Overview
This guide will help you test all features of the TikTok-style video editor integrated into your stories feature.

## Setup

### Required Files
All files should be in place:
- ✅ `frontend/video-editor.css` - Styles
- ✅ `frontend/video-editor.js` - JavaScript logic
- ✅ `frontend/create-story.html` - Integration point

### Browser Requirements
- Chrome/Edge 90+ (recommended)
- Safari 14+
- Firefox 88+
- HTTPS required for voiceover feature

## Testing Checklist

### 1. Opening the Editor

**Steps:**
1. Navigate to `/create-story` page
2. Click "Select Media" button
3. Upload a video file (MP4, WebM, etc.)
4. Wait for video preview to load

**Expected Results:**
- ✅ Video preview appears
- ✅ "Advanced Edit" button becomes visible in the toolbar
- ✅ Button has a sliders icon and "Advanced Edit" text

**Troubleshooting:**
- If button doesn't appear, check browser console for errors
- Verify video-editor.css and video-editor.js are loaded in Network tab

### 2. Entering the Editor

**Steps:**
1. Click the "Advanced Edit" button

**Expected Results:**
- ✅ Full-screen video editor opens
- ✅ Video plays in the preview area
- ✅ Timeline appears at bottom with scrubber
- ✅ Four control buttons visible: Speed, Volume, Voiceover, Text Timing
- ✅ Header shows "Cancel" button, "Edit Video" title, and "Done" button

**Troubleshooting:**
- If editor doesn't open, check console for JavaScript errors
- Try refreshing the page and uploading video again

### 3. Timeline Scrubber

**Steps:**
1. Wait for video to load (duration shows in timeline)
2. Drag the white scrubber handle left/right
3. Tap anywhere on the timeline
4. Observe the playhead time indicator

**Expected Results:**
- ✅ Scrubber moves smoothly as you drag
- ✅ Video seeks to the correct time
- ✅ Current time updates (e.g., "0:05")
- ✅ Playhead time indicator follows scrubber
- ✅ Video pauses during dragging, resumes if it was playing

**Troubleshooting:**
- If scrubber doesn't respond, check that video metadata has loaded
- Try clicking on the timeline track itself

### 4. Play/Pause Control

**Steps:**
1. Tap anywhere on the video preview area
2. Tap again

**Expected Results:**
- ✅ First tap: Video plays, large pause icon appears briefly
- ✅ Second tap: Video pauses, large play icon appears briefly
- ✅ Icons fade out after 0.5 seconds

### 5. Speed Controls

**Steps:**
1. Click "Speed" button at bottom
2. Bottom panel slides up showing speed options
3. Try clicking each speed: 0.3x, 0.5x, 1x, 1.5x, 2x, 3x
4. Play the video after each change

**Expected Results:**
- ✅ Panel opens with 6 speed buttons
- ✅ "1x" is selected by default (highlighted)
- ✅ Clicking a speed highlights it (purple background)
- ✅ Video playback speed changes immediately
- ✅ Slow motion (0.3x, 0.5x) works
- ✅ Fast motion (1.5x, 2x, 3x) works
- ✅ Close button (X) closes the panel

**Troubleshooting:**
- If speed doesn't change, check that videoEditor.setPlaybackSpeed() is being called
- Verify video.playbackRate is supported in your browser

### 6. Volume Controls

**Steps:**
1. Click "Volume" button
2. Panel opens with three sliders
3. Drag "Original Audio" slider
4. Drag "Background Music" slider (if music added)
5. Check percentage values update

**Expected Results:**
- ✅ Panel opens with volume sliders
- ✅ Original Audio slider at 100% by default
- ✅ Dragging slider changes volume in real-time
- ✅ Percentage value updates (e.g., "75%")
- ✅ Video audio volume changes accordingly
- ✅ Purple slider handle matches brand color

**Note:** Background Music and Voiceover sliders are placeholders unless those features are added separately.

### 7. Text Timing (Core Feature)

**Prerequisites:**
- Add at least 2-3 text elements to your video before opening the editor

**Steps:**
1. In create-story, add text using the text tool
2. Add multiple text elements with different messages
3. Open Advanced Edit
4. Look at the timeline - you should see text tracks
5. Click "Text Timing" button
6. Panel opens with list of all text elements

**Expected Results:**
- ✅ Timeline shows colored bars for each text element
- ✅ Text content is visible on each bar
- ✅ Text Timing panel lists all text elements
- ✅ Each element has "Start" and "End" input fields
- ✅ Default timing: Start = 0, End = video duration

**Drag Handle Test:**
1. Find a text bar on the timeline
2. Grab the left edge (start handle)
3. Drag left or right
4. Grab the right edge (end handle)
5. Drag left or right

**Expected Results:**
- ✅ Left handle adjusts start time
- ✅ Right handle adjusts end time
- ✅ Bar width changes as you drag
- ✅ Text Timing panel inputs update automatically
- ✅ Minimum duration: 0.1 seconds

**Manual Input Test:**
1. Open Text Timing panel
2. Click on "Start" input for first text
3. Enter a value (e.g., 2.5)
4. Click on "End" input
5. Enter a value (e.g., 7.0)

**Expected Results:**
- ✅ Timeline bar updates to match new times
- ✅ Values are clamped to valid range (0 to video duration)
- ✅ End time must be > start time

**Playback Test:**
1. Scrub to before first text's start time
2. Press play
3. Watch as time passes each text's start/end time

**Expected Results:**
- ✅ Text appears on video when current time >= start time
- ✅ Text disappears when current time > end time
- ✅ Multiple texts can be visible at same time
- ✅ Text rendering matches original styles (color, size, font, outline)

### 8. Voiceover Recording

**Prerequisites:**
- Microphone connected
- HTTPS connection (required for getUserMedia)
- Grant microphone permission when prompted

**Steps:**
1. Click "Voiceover" button
2. Read the instruction text
3. Click "Start Recording" button
4. Speak into microphone
5. Click "Stop Recording" button

**Expected Results:**
- ✅ Panel opens with red "Start Recording" button
- ✅ Browser prompts for microphone permission
- ✅ After granting: Button changes to "Stop Recording"
- ✅ Button pulses while recording (animation)
- ✅ After stopping: "Voiceover recorded successfully!" message
- ✅ Message appears in purple color
- ✅ In Volume panel, "Voiceover" slider now appears

**Troubleshooting:**
- If permission denied, check browser settings
- If button doesn't respond, check console for errors
- HTTPS is required - won't work on http://

### 9. Control Panel Interactions

**Steps:**
1. Open Speed panel
2. Click Volume button
3. Volume panel should replace Speed panel
4. Click X to close
5. Open Text Timing panel
6. Click outside the panel (on video)

**Expected Results:**
- ✅ Only one panel open at a time
- ✅ Opening a panel closes any other open panel
- ✅ X button closes the panel
- ✅ Panels slide up from bottom smoothly
- ✅ Panels have backdrop blur effect

### 10. Exporting Edited Video

**Steps:**
1. Make some edits:
   - Change speed to 1.5x
   - Adjust volume to 80%
   - Set text timing (if text exists)
   - Record voiceover (optional)
2. Click "Done" button in header

**Expected Results:**
- ✅ Editor closes, returns to create-story page
- ✅ Video preview still visible
- ✅ Text elements have updated timing
- ✅ Console shows: "Video editor settings applied: {...}"
- ✅ No errors in console

**Verify Settings:**
1. Open browser console
2. Type: `window.videoEditorSettings`
3. Press Enter

**Expected Output:**
```javascript
{
    speed: 1.5,
    volume: 0.8,
    voiceoverTrack: "blob:http://..." // if recorded
}
```

### 11. Cancel/Back Button

**Steps:**
1. Make some edits in the editor
2. Click "Cancel" button in header

**Expected Results:**
- ✅ Editor closes immediately
- ✅ Returns to create-story page
- ✅ Edits are NOT saved (original text timing intact)
- ✅ Video preview still shows

### 12. Mobile Responsiveness

**Test on Mobile/Tablet:**
1. Open on phone or use Chrome DevTools mobile emulation
2. Upload video and open editor

**Expected Results:**
- ✅ Editor takes full screen
- ✅ Video fits within screen bounds
- ✅ Timeline is accessible at bottom
- ✅ Control buttons are large enough to tap (44px minimum)
- ✅ Panels slide up from bottom (mobile pattern)
- ✅ Scrubber can be dragged with finger
- ✅ Text timing handles can be dragged with finger
- ✅ Pinch and zoom don't interfere with controls

### 13. Edge Cases

**No Text Elements:**
1. Upload video without adding text
2. Open editor
3. Click "Text Timing"

**Expected Results:**
- ✅ Panel shows: "No text elements added yet"
- ✅ No error in console
- ✅ Other features still work

**Very Short Video (< 3 seconds):**
1. Upload a very short video
2. Try to set text timing

**Expected Results:**
- ✅ Timeline scales appropriately
- ✅ Can still drag handles
- ✅ Minimum 0.1 second duration enforced

**Very Long Video (> 5 minutes):**
1. Upload a long video
2. Test scrubbing performance

**Expected Results:**
- ✅ Scrubber still responsive
- ✅ Time formatting shows minutes correctly (e.g., "3:45")
- ✅ No lag in timeline updates

## Common Issues

### Issue: Advanced Edit button doesn't appear
**Solution:**
- Ensure you uploaded a VIDEO file, not an image
- Check that video-editor.css and video-editor.js are loaded
- Check browser console for errors

### Issue: Timeline is empty/broken
**Solution:**
- Wait for video metadata to load (duration must be > 0)
- Check that `videoEditor.updateTimelineScale()` was called
- Verify video has valid duration

### Issue: Text doesn't render on video
**Solution:**
- Check that text elements have valid coordinates
- Verify canvas is same size as video
- Check text.visible is being calculated correctly

### Issue: Voiceover doesn't record
**Solution:**
- Must use HTTPS (not HTTP)
- Grant microphone permission
- Check browser supports MediaRecorder API

### Issue: Drag handles don't work on mobile
**Solution:**
- Ensure touchstart/touchmove events are bound
- Check that touch targets are large enough (44px)
- Verify no CSS preventing touch events

## Performance Benchmarks

**Expected Performance:**
- Video editor opens: < 500ms
- Timeline scrubbing: 60fps
- Text overlay rendering: 60fps
- Panel animations: Smooth (CSS transitions)
- Memory usage: < 100MB additional

## Browser Compatibility Matrix

| Feature | Chrome 90+ | Safari 14+ | Firefox 88+ | Edge 90+ |
|---------|-----------|-----------|------------|----------|
| Timeline | ✅ | ✅ | ✅ | ✅ |
| Speed Control | ✅ | ✅ | ✅ | ✅ |
| Volume Control | ✅ | ✅ | ✅ | ✅ |
| Text Timing | ✅ | ✅ | ✅ | ✅ |
| Voiceover | ✅ | ✅ (iOS 14.3+) | ✅ | ✅ |

## Success Criteria

✅ All checklist items pass
✅ No console errors during normal operation
✅ Smooth 60fps performance
✅ Mobile touch interactions work
✅ Text timing saves and applies correctly
✅ Can export and return to create story page

## Next Steps After Testing

If all tests pass:
1. ✅ Video editor is production-ready
2. Consider adding server-side video processing for:
   - Embedding speed changes in final video
   - Mixing voiceover with original audio
   - Rendering text timing permanently
3. Add analytics to track feature usage

If tests fail:
1. Note which specific test failed
2. Check browser console for errors
3. Verify file versions match (CSS, JS, HTML)
4. Report issues with specific steps to reproduce

## Test Summary Template

```
Date: ____________
Browser: ____________
Device: ____________

✅ = Pass, ❌ = Fail, ⚠️ = Partial

[ ] Opening the Editor
[ ] Entering the Editor
[ ] Timeline Scrubber
[ ] Play/Pause Control
[ ] Speed Controls
[ ] Volume Controls
[ ] Text Timing
[ ] Voiceover Recording
[ ] Control Panel Interactions
[ ] Exporting Edited Video
[ ] Cancel/Back Button
[ ] Mobile Responsiveness
[ ] Edge Cases

Overall: ___/13 tests passed

Notes:
_________________________________
_________________________________
```
