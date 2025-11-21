# Video Editor - Quick Start Guide

## 🚀 Getting Started in 60 Seconds

### Step 1: Upload a Video
1. Go to your app's create story page: `/create-story`
2. Click "Select Media"
3. Choose a video file from your device
4. Wait for it to load

### Step 2: Open the Editor
1. Look for the "Advanced Edit" button (appears only for videos)
2. It has a sliders icon: ⚙️
3. Click it

### Step 3: Editor Opens
You'll see:
- Video preview in center
- Timeline at bottom with scrubber
- 4 control buttons: Speed, Volume, Voiceover, Text Timing

### Step 4: Try Each Feature

**🎬 Timeline Scrubber**
- Drag the white line left/right to navigate through your video
- Or tap anywhere on the timeline to jump to that time

**⚡ Speed Controls**
1. Click "Speed" button
2. Choose a speed: 0.3x (slow-mo) to 3x (fast)
3. Video plays at new speed immediately

**🔊 Volume Controls**
1. Click "Volume" button
2. Drag the slider to adjust audio level
3. Changes apply in real-time

**📝 Text Timing** (The Main Feature!)
1. First, add some text to your video (back in create story)
2. Open Advanced Edit
3. Click "Text Timing" button
4. You'll see:
   - Each text element listed
   - Start/End time inputs
   - Colored bars on timeline

**How to Control When Text Appears:**
- **Drag handles:** Grab left/right edges of colored bars on timeline
- **Type times:** Enter exact start/end times in the panel
- **Preview:** Scrub through video to see text appear/disappear

**🎤 Voiceover**
1. Click "Voiceover" button
2. Grant microphone permission
3. Click "Start Recording"
4. Speak into mic
5. Click "Stop Recording" when done
6. ✅ Success message appears

### Step 5: Save Your Edits
1. Click "Done" button (top right)
2. Editor closes
3. Your edits are applied!
4. Continue posting your story as normal

### Step 6: Cancel If Needed
- Click "Cancel" or "X" (top left) to close without saving
- Your edits won't be applied

## 📱 Mobile Tips

- **Two fingers:** Use for pinch-to-zoom text size (outside editor)
- **One finger:** Drag to move scrubber or text timing handles
- **Tap video:** Play/pause
- **Panels slide up:** From bottom (native mobile feel)
- **Large buttons:** Easy to tap (44px minimum)

## 🎯 What Each Feature Does

| Feature | What It Does | Example Use Case |
|---------|--------------|------------------|
| **Timeline** | Navigate through video | Find the exact moment you want text to appear |
| **Speed** | Change playback speed | Create slow-motion effect at 0.5x |
| **Volume** | Adjust audio level | Lower music so voiceover is clear |
| **Text Timing** | Control when text shows | Make "Hello!" appear 0-3 seconds, "Bye!" appear 8-10 seconds |
| **Voiceover** | Record narration | Add your voice explaining the video |

## 💡 Pro Tips

1. **Text Timing Workflow:**
   - Add all your text first in create story
   - Then open Advanced Edit to set timing
   - Scrub through video to preview timing
   - Adjust until perfect

2. **Slow Motion:**
   - Use 0.5x speed for smooth slow-mo
   - Great for action shots or dramatic moments

3. **Fast Forward:**
   - Use 2x or 3x to speed up boring parts
   - Good for time-lapse style content

4. **Voiceover Recording:**
   - Record in a quiet place
   - Speak clearly and close to mic
   - Can re-record if you mess up (click Start Recording again)

5. **Text Visibility:**
   - Keep text on screen for at least 2-3 seconds
   - Give viewers time to read it
   - Don't overlap too many texts

## ⚠️ Important Notes

- **HTTPS Required:** Voiceover only works on https:// sites
- **Video Only:** Advanced Edit button only appears for videos, not images
- **Add Text First:** Text Timing panel is empty if you haven't added text yet
- **Client-Side Preview:** Speed/volume changes are for preview only (see docs for making permanent)

## 🐛 Troubleshooting

**Q: Advanced Edit button doesn't appear**
- Make sure you uploaded a VIDEO file, not an image
- Refresh the page and try again
- Check browser console (F12) for errors

**Q: Timeline is empty**
- Wait a few seconds for video to fully load
- Check that video has valid duration
- Try a different video file

**Q: Text doesn't show up**
- Make sure you added text elements in create story first
- Open Text Timing panel to verify text is listed
- Check start/end times are within video duration

**Q: Voiceover button doesn't work**
- Must use HTTPS (not HTTP)
- Grant microphone permission when prompted
- Check browser supports MediaRecorder API

**Q: Dragging doesn't work on mobile**
- Ensure you're using one finger only
- Try tapping and holding before dragging
- Some browsers may need page refresh

## 📖 Full Documentation

For complete testing instructions and advanced features:
- **Testing:** See `VIDEO_EDITOR_TEST_GUIDE.md`
- **Technical:** See `VIDEO_EDITOR_FIXES.md`
- **Implementation:** See `VIDEO_EDITOR_COMPLETE.md`

## ✨ Example Workflow

Here's a complete example of creating a video story with text timing:

1. **Upload:** Select a 15-second video of a sunset
2. **Add Text:**
   - "Watch this sunset" (add with text tool)
   - "It's beautiful!" (add with text tool)
   - "Thanks for watching" (add with text tool)
3. **Open Editor:** Click Advanced Edit
4. **Set Timing:**
   - "Watch this sunset" → 0:00 to 0:05
   - "It's beautiful!" → 0:05 to 0:10
   - "Thanks for watching" → 0:10 to 0:15
5. **Add Voiceover:** Record yourself saying "Check out this amazing view!"
6. **Adjust Speed:** Set to 0.5x for slow-motion effect
7. **Save:** Click Done
8. **Post:** Share your story!

Result: A professional-looking video story with timed text overlays, narration, and slow-motion effect! 🎥✨

## 🎉 You're Ready!

The video editor is powerful yet simple. Start with basic text timing, then explore speed controls and voiceover as you get comfortable.

**Happy creating! 🎬**

---

*Need help? Check VIDEO_EDITOR_TEST_GUIDE.md for detailed testing steps.*
