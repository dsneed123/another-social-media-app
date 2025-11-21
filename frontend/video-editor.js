/**
 * TikTok-Style Video Editor
 * Mobile-first video editing with timeline, speed controls, text timing, etc.
 */

class VideoEditor {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        // Editor state
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.playbackSpeed = 1;
        this.volume = 1;
        this.voiceoverTrack = null;
        this.isDraggingScrubber = false;
        this.isResizingText = false;

        // Multi-track data structures
        this.videoTracks = [];    // Array of video clip objects
        this.audioTracks = [];    // Array of audio clip objects
        this.textElements = [];   // Array of text layer objects

        // Timeline state
        this.timelineWidth = 0;
        this.pixelsPerSecond = 0;

        // Bind methods
        this.update = this.update.bind(this);
        this.handleScrubberStart = this.handleScrubberStart.bind(this);
        this.handleScrubberMove = this.handleScrubberMove.bind(this);
        this.handleScrubberEnd = this.handleScrubberEnd.bind(this);

        // Block dragging state
        this.isDraggingBlock = false;
        this.draggingBlockType = null; // 'video', 'audio', or 'text'
        this.draggingBlockIndex = null;
        this.dragBlockDuration = 0;
        this.dragBlockStartX = 0;

        // Clip ID counter
        this.nextClipId = 1;

        // Active video sources for playback
        this.videoElements = {}; // Map of clip IDs to video elements
        this.audioElements = {}; // Map of clip IDs to audio elements
    }

    initialize() {
        // Set up video event listeners
        this.video.addEventListener('loadedmetadata', () => {
            this.duration = this.video.duration;
            this.updateTimelineScale();
            this.renderTimeline();
        });

        this.video.addEventListener('timeupdate', () => {
            // Only update from main video if not playing (to avoid conflicts with update loop)
            if (!this.isDraggingScrubber && !this.isPlaying) {
                this.currentTime = this.video.currentTime;
                this.updateScrubberPosition();
                this.updateTextVisibility();
            }
        });

        this.video.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });

        // Set up timeline scrubber
        const scrubberTrack = document.querySelector('.timeline-scrubber-track');
        if (scrubberTrack) {
            scrubberTrack.addEventListener('touchstart', this.handleScrubberStart);
            scrubberTrack.addEventListener('mousedown', this.handleScrubberStart);
        }

        // Play/pause on video tap
        const preview = document.querySelector('.editor-preview');
        if (preview) {
            preview.addEventListener('click', () => this.togglePlayPause());
        }

        // Start render loop
        this.update();
    }

    loadVideo(videoSrc, textElements = []) {
        this.video.src = videoSrc;

        // Initialize first video track with the main video
        const mainVideoId = this.nextClipId++;
        this.videoTracks = [{
            id: mainVideoId,
            src: videoSrc,
            startTime: 0,
            endTime: null, // Will be set when duration loads
            volume: 1,
            speed: 1,
            type: 'main'
        }];

        // Clone text elements and set default timing
        this.textElements = textElements.map(text => {
            const startTime = typeof text.startTime === 'number' ? text.startTime : 0;
            const endTime = typeof text.endTime === 'number' ? text.endTime : null;

            return {
                ...text,
                id: text.id || this.nextClipId++,
                startTime: startTime,
                endTime: endTime,
                visible: true,
                // Ensure all text properties are preserved
                x: text.x || 540,
                y: text.y || 960,
                size: text.size || 48,
                color: text.color || 'white',
                font: text.font || 'Arial',
                style: text.style || 'outline',
                content: text.content || ''
            };
        });

        this.video.load();

        // Update durations once metadata loads
        const updateDurations = () => {
            // Set main video track duration
            if (this.videoTracks[0]) {
                this.videoTracks[0].endTime = this.duration;

                // Add audio track for main video
                this.audioTracks.push({
                    id: mainVideoId,
                    src: videoSrc,
                    startTime: 0,
                    endTime: this.duration,
                    volume: 1,
                    type: 'video-audio',
                    videoClipId: mainVideoId,
                    file: { name: 'Main Video Audio' }
                });
                // Store reference - main video audio uses the main video element
                this.audioElements[mainVideoId] = this.video;
            }

            // Set text element end times
            this.textElements.forEach(text => {
                if (text.endTime === null || text.endTime > this.duration) {
                    text.endTime = this.duration || 10;
                }
            });

            this.renderTimeline();
            this.video.removeEventListener('loadedmetadata', updateDurations);
        };

        this.video.addEventListener('loadedmetadata', updateDurations);
    }

    // Add new video clip
    addVideoClip(file) {
        const url = URL.createObjectURL(file);
        const clipId = this.nextClipId++;

        const clip = {
            id: clipId,
            src: url,
            startTime: this.duration, // Add at end by default
            endTime: this.duration + 5, // Default 5 second duration
            volume: 1,
            speed: 1,
            type: 'clip',
            file: file
        };

        // Create video element to get duration
        const vidEl = document.createElement('video');
        vidEl.src = url;
        vidEl.preload = 'metadata';
        vidEl.muted = false;
        vidEl.addEventListener('loadedmetadata', () => {
            clip.endTime = clip.startTime + vidEl.duration;
            this.videoElements[clipId] = vidEl;

            // Automatically add audio track for this video clip
            const audioTrack = {
                id: clipId, // Use same ID as video clip
                src: url,
                startTime: clip.startTime,
                endTime: clip.endTime,
                volume: 1,
                type: 'video-audio',
                videoClipId: clipId,
                file: { name: `${file.name} (audio)` }
            };
            this.audioTracks.push(audioTrack);
            // Audio element reference points to the video element (videos have audio)
            this.audioElements[clipId] = vidEl;

            this.updateProjectDuration();
            this.renderTimeline();
            console.log('Video clip loaded:', file.name, 'duration:', vidEl.duration);
        });
        vidEl.load();

        this.videoTracks.push(clip);
        this.renderTimeline();
        return clip;
    }

    // Add new audio clip
    addAudioClip(file) {
        const url = URL.createObjectURL(file);
        const clipId = this.nextClipId++;

        const clip = {
            id: clipId,
            src: url,
            startTime: 0, // Start at beginning by default
            endTime: 10, // Default 10 second duration
            volume: 0.8,
            type: file.type.includes('music') ? 'music' : 'audio',
            file: file
        };

        // Create audio element to get duration
        const audEl = document.createElement('audio');
        audEl.src = url;
        audEl.preload = 'metadata';
        audEl.addEventListener('loadedmetadata', () => {
            clip.endTime = clip.startTime + audEl.duration;
            this.audioElements[clipId] = audEl;
            this.renderTimeline();
            console.log('Audio clip loaded:', file.name, 'duration:', audEl.duration);
        });
        audEl.load();

        this.audioTracks.push(clip);
        this.renderTimeline();
        return clip;
    }

    // Add new text layer
    addTextLayer(textData) {
        const text = {
            id: this.nextClipId++,
            content: textData.content || 'New Text',
            x: textData.x || 540,
            y: textData.y || 960,
            size: textData.size || 48,
            color: textData.color || 'white',
            font: textData.font || 'Arial',
            style: textData.style || 'outline',
            startTime: textData.startTime || 0,
            endTime: textData.endTime || Math.min(3, this.duration),
            visible: true
        };

        this.textElements.push(text);
        this.renderTimeline();
        return text;
    }

    // Update total project duration
    updateProjectDuration() {
        let maxDuration = 0;

        // Check video tracks
        this.videoTracks.forEach(clip => {
            if (clip.endTime > maxDuration) {
                maxDuration = clip.endTime;
            }
        });

        // Check audio tracks
        this.audioTracks.forEach(clip => {
            if (clip.endTime > maxDuration) {
                maxDuration = clip.endTime;
            }
        });

        // Check text elements
        this.textElements.forEach(text => {
            if (text.endTime > maxDuration) {
                maxDuration = text.endTime;
            }
        });

        if (maxDuration > this.duration) {
            this.duration = maxDuration;
        }
    }

    // Delete clip
    deleteClip(type, id) {
        if (type === 'video') {
            this.videoTracks = this.videoTracks.filter(c => c.id !== id);
            if (this.videoElements[id]) {
                URL.revokeObjectURL(this.videoElements[id].src);
                delete this.videoElements[id];
            }
            // Also delete associated video-audio track
            this.audioTracks = this.audioTracks.filter(c => c.videoClipId !== id);
            if (this.audioElements[id] && this.audioElements[id] !== this.video) {
                // Don't revoke main video element's audio
                delete this.audioElements[id];
            }
        } else if (type === 'audio') {
            const audioClip = this.audioTracks.find(c => c.id === id);

            // Only allow deleting standalone audio clips, not video-audio
            if (audioClip && audioClip.type !== 'video-audio') {
                this.audioTracks = this.audioTracks.filter(c => c.id !== id);
                if (this.audioElements[id]) {
                    URL.revokeObjectURL(this.audioElements[id].src);
                    delete this.audioElements[id];
                }
            } else {
                console.log('Cannot delete video audio track separately. Delete the video clip instead.');
                return;
            }
        } else if (type === 'text') {
            this.textElements = this.textElements.filter(t => t.id !== id);
        }

        this.renderTimeline();
    }

    // Playback Controls - Updated for multi-track
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;

        // Play active video clip
        const activeClip = this.getActiveVideoClip();
        if (activeClip) {
            let videoEl;
            if (activeClip.type === 'main') {
                videoEl = this.video;
            } else {
                videoEl = this.videoElements[activeClip.id];
            }

            if (videoEl) {
                const clipTime = this.currentTime - activeClip.startTime;
                videoEl.currentTime = clipTime;
                videoEl.play();
            }
        }

        // Play active audio clips
        const activeAudioClips = this.getActiveAudioClips();
        activeAudioClips.forEach(clip => {
            const audioEl = this.audioElements[clip.id];
            if (audioEl) {
                const clipTime = this.currentTime - clip.startTime;
                audioEl.currentTime = clipTime;
                audioEl.play().catch(e => console.log('Audio play error:', e));
            }
        });

        this.updatePlayPauseButton();
        this.showPlayPauseIcon('bi-pause-fill');
    }

    pause() {
        this.isPlaying = false;

        // Pause all video elements
        this.video.pause();
        Object.values(this.videoElements).forEach(vid => vid.pause());

        // Pause all audio elements
        Object.values(this.audioElements).forEach(aud => aud.pause());

        this.updatePlayPauseButton();
        this.showPlayPauseIcon('bi-play-fill');
    }

    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));

        // Update active video clip
        const activeClip = this.getActiveVideoClip();
        if (activeClip) {
            let videoEl;
            if (activeClip.type === 'main') {
                videoEl = this.video;
            } else {
                videoEl = this.videoElements[activeClip.id];
            }

            if (videoEl) {
                const clipTime = this.currentTime - activeClip.startTime;
                videoEl.currentTime = Math.max(0, Math.min(clipTime, videoEl.duration));
            }
        }

        // Update active audio clips
        const activeAudioClips = this.getActiveAudioClips();
        activeAudioClips.forEach(clip => {
            const audioEl = this.audioElements[clip.id];
            if (audioEl) {
                const clipTime = this.currentTime - clip.startTime;
                audioEl.currentTime = Math.max(0, Math.min(clipTime, audioEl.duration));
            }
        });

        this.updateScrubberPosition();
        this.updateTextVisibility();
    }

    // Speed Controls
    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
        this.video.playbackRate = speed;

        // Update UI
        document.querySelectorAll('.speed-option').forEach(btn => {
            btn.classList.remove('selected');
            if (parseFloat(btn.dataset.speed) === speed) {
                btn.classList.add('selected');
            }
        });
    }

    // Volume Controls
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.video.volume = this.volume;

        // Update UI
        const volumeSlider = document.getElementById('video-volume-slider');
        const volumeValue = document.getElementById('video-volume-value');
        if (volumeSlider) volumeSlider.value = this.volume * 100;
        if (volumeValue) volumeValue.textContent = Math.round(this.volume * 100) + '%';
    }

    // Text Timing
    updateTextTiming(textIndex, startTime, endTime) {
        if (this.textElements[textIndex]) {
            this.textElements[textIndex].startTime = startTime;
            this.textElements[textIndex].endTime = endTime;
            this.renderTextTracks();
            this.updateTextVisibility();
        }
    }

    updateTextVisibility() {
        this.textElements.forEach((text, index) => {
            const isVisible = this.currentTime >= (text.startTime || 0) &&
                            this.currentTime <= (text.endTime || this.duration);
            text.visible = isVisible;
        });
    }

    getVisibleTexts() {
        return this.textElements.filter(text => {
            // Check if text should be visible at current time
            const startTime = text.startTime || 0;
            const endTime = text.endTime || this.duration;
            return this.currentTime >= startTime && this.currentTime <= endTime;
        });
    }

    // Timeline Rendering
    updateTimelineScale() {
        const scrubberTrack = document.querySelector('.timeline-scrubber-track');
        if (scrubberTrack && this.duration > 0) {
            this.timelineWidth = scrubberTrack.clientWidth;
            this.pixelsPerSecond = this.timelineWidth / this.duration;
        }
    }

    renderTimeline() {
        this.renderVideoTracks();
        this.renderAudioTracks();
        this.renderTextTracks();
        this.updateScrubberPosition();
    }

    // Render video tracks
    renderVideoTracks() {
        const container = document.getElementById('video-tracks-container');
        if (!container) return;

        if (!this.duration || this.duration <= 0) return;

        container.innerHTML = '';

        if (this.videoTracks.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'timeline-empty-message';
            emptyMsg.innerHTML = '<i class="bi bi-film"></i> No video clips yet';
            container.appendChild(emptyMsg);
            return;
        }

        // Create track for each video clip
        this.videoTracks.forEach((clip, index) => {
            const track = document.createElement('div');
            track.className = 'timeline-track-row';
            track.dataset.index = index;
            track.dataset.type = 'video';

            // Track label
            const label = document.createElement('div');
            label.className = 'timeline-track-label';
            const clipName = clip.type === 'main' ? 'Main Video' : `Clip ${index}`;
            label.innerHTML = `<i class="bi bi-film"></i> <span>${clipName}</span>`;

            // Track content
            const trackContent = document.createElement('div');
            trackContent.className = 'timeline-track-content-area';

            const item = document.createElement('div');
            item.className = 'timeline-clip timeline-video-clip draggable';
            item.dataset.index = index;
            item.dataset.id = clip.id;

            // Position and width
            const left = (clip.startTime / this.duration) * 100;
            const width = ((clip.endTime - clip.startTime) / this.duration) * 100;
            item.style.left = Math.max(0, Math.min(100, left)) + '%';
            item.style.width = Math.max(1, Math.min(100 - left, width)) + '%';

            // Resize handles
            const leftHandle = document.createElement('div');
            leftHandle.className = 'clip-handle clip-handle-left';
            leftHandle.dataset.type = 'video';
            leftHandle.dataset.index = index;

            const rightHandle = document.createElement('div');
            rightHandle.className = 'clip-handle clip-handle-right';
            rightHandle.dataset.type = 'video';
            rightHandle.dataset.index = index;

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'clip-delete-btn';
            deleteBtn.innerHTML = '<i class="bi bi-x"></i>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (clip.type !== 'main') { // Can't delete main video
                    this.deleteClip('video', clip.id);
                }
            };

            item.appendChild(leftHandle);
            item.appendChild(rightHandle);
            if (clip.type !== 'main') {
                item.appendChild(deleteBtn);
            }

            // Dragging
            item.addEventListener('mousedown', (e) => {
                if (!e.target.classList.contains('clip-handle') && !e.target.closest('.clip-delete-btn')) {
                    this.startDragClip(e, 'video', index);
                }
            });
            item.addEventListener('touchstart', (e) => {
                if (!e.target.classList.contains('clip-handle') && !e.target.closest('.clip-delete-btn')) {
                    this.startDragClip(e, 'video', index);
                }
            });

            trackContent.appendChild(item);
            track.appendChild(label);
            track.appendChild(trackContent);
            container.appendChild(track);
        });
    }

    // Render audio tracks
    renderAudioTracks() {
        const container = document.getElementById('audio-tracks-container');
        if (!container) return;

        if (!this.duration || this.duration <= 0) return;

        container.innerHTML = '';

        if (this.audioTracks.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'timeline-empty-message';
            emptyMsg.innerHTML = '<i class="bi bi-music-note"></i> No audio tracks yet';
            container.appendChild(emptyMsg);
            return;
        }

        // Create track for each audio clip
        this.audioTracks.forEach((clip, index) => {
            const track = document.createElement('div');
            track.className = 'timeline-track-row';
            track.dataset.index = index;
            track.dataset.type = 'audio';

            // Track label
            const label = document.createElement('div');
            label.className = 'timeline-track-label';
            const isVideoAudio = clip.type === 'video-audio';
            const icon = isVideoAudio ? '<i class="bi bi-camera-video-fill"></i>' : '<i class="bi bi-music-note"></i>';
            const clipName = clip.file ? clip.file.name.substring(0, 12) : `Audio ${index + 1}`;
            label.innerHTML = `${icon} <span>${clipName}</span>`;
            label.title = clip.file ? clip.file.name : `Audio ${index + 1}`;

            // Track content
            const trackContent = document.createElement('div');
            trackContent.className = 'timeline-track-content-area';

            const item = document.createElement('div');
            // Different styling for video audio
            const clipClass = isVideoAudio ? 'timeline-clip timeline-video-audio-clip draggable' : 'timeline-clip timeline-audio-clip draggable';
            item.className = clipClass;
            item.dataset.index = index;
            item.dataset.id = clip.id;

            // Position and width
            const left = (clip.startTime / this.duration) * 100;
            const width = ((clip.endTime - clip.startTime) / this.duration) * 100;
            item.style.left = Math.max(0, Math.min(100, left)) + '%';
            item.style.width = Math.max(1, Math.min(100 - left, width)) + '%';

            // Resize handles
            const leftHandle = document.createElement('div');
            leftHandle.className = 'clip-handle clip-handle-left';
            leftHandle.dataset.type = 'audio';
            leftHandle.dataset.index = index;

            const rightHandle = document.createElement('div');
            rightHandle.className = 'clip-handle clip-handle-right';
            rightHandle.dataset.type = 'audio';
            rightHandle.dataset.index = index;

            // Delete button (only for standalone audio, not video audio)
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'clip-delete-btn';
            deleteBtn.innerHTML = '<i class="bi bi-x"></i>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteClip('audio', clip.id);
            };

            item.appendChild(leftHandle);
            item.appendChild(rightHandle);

            // Only add delete button for standalone audio clips
            if (!isVideoAudio) {
                item.appendChild(deleteBtn);
            }

            // Dragging
            item.addEventListener('mousedown', (e) => {
                if (!e.target.classList.contains('clip-handle') && !e.target.closest('.clip-delete-btn')) {
                    this.startDragClip(e, 'audio', index);
                }
            });
            item.addEventListener('touchstart', (e) => {
                if (!e.target.classList.contains('clip-handle') && !e.target.closest('.clip-delete-btn')) {
                    this.startDragClip(e, 'audio', index);
                }
            });

            trackContent.appendChild(item);
            track.appendChild(label);
            track.appendChild(trackContent);
            container.appendChild(track);
        });
    }

    renderTextTracks() {
        const container = document.getElementById('text-tracks-container');
        if (!container) return;

        // Don't render if duration is not valid yet
        if (!this.duration || this.duration <= 0) return;

        container.innerHTML = '';

        // Show message if no text elements
        if (this.textElements.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'timeline-empty-message';
            emptyMsg.innerHTML = '<i class="bi bi-fonts"></i> No text layers yet. Add text to get started!';
            container.appendChild(emptyMsg);
            return;
        }

        // Create SEPARATE track for each text element (TikTok style)
        this.textElements.forEach((text, index) => {
            const track = document.createElement('div');
            track.className = 'timeline-track-row';
            track.dataset.index = index;

            // Track label on left (shows text preview)
            const label = document.createElement('div');
            label.className = 'timeline-track-label';
            const textPreview = (text.content || `Text ${index + 1}`).substring(0, 15);
            label.innerHTML = `<i class="bi bi-fonts"></i> <span>${textPreview}${text.content && text.content.length > 15 ? '...' : ''}</span>`;
            label.title = text.content || `Text ${index + 1}`;

            // Track content (the timeline bar area)
            const trackContent = document.createElement('div');
            trackContent.className = 'timeline-track-content-area';

            const item = document.createElement('div');
            item.className = 'timeline-text-item draggable';
            item.dataset.index = index;

            // Position and width based on timing
            const left = (text.startTime / this.duration) * 100;
            const width = ((text.endTime - text.startTime) / this.duration) * 100;
            item.style.left = Math.max(0, Math.min(100, left)) + '%';
            item.style.width = Math.max(1, Math.min(100 - left, width)) + '%';

            // Add resize handles
            const leftHandle = document.createElement('div');
            leftHandle.className = 'text-item-handle text-item-handle-left';
            leftHandle.dataset.index = index;
            leftHandle.dataset.handle = 'left';

            const rightHandle = document.createElement('div');
            rightHandle.className = 'text-item-handle text-item-handle-right';
            rightHandle.dataset.index = index;
            rightHandle.dataset.handle = 'right';

            item.appendChild(leftHandle);
            item.appendChild(rightHandle);

            // Add event listeners - DRAG ENTIRE BLOCK
            item.addEventListener('mousedown', (e) => {
                if (!e.target.classList.contains('text-item-handle')) {
                    this.startDragTextBlock(e, index);
                }
            });
            item.addEventListener('touchstart', (e) => {
                if (!e.target.classList.contains('text-item-handle')) {
                    this.startDragTextBlock(e, index);
                }
            });

            // Click to select
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('text-item-handle')) {
                    this.selectTextItem(index);
                }
            });

            // Handle resize (existing logic)
            leftHandle.addEventListener('touchstart', (e) => this.startResizeText(e, index, 'left'));
            leftHandle.addEventListener('mousedown', (e) => this.startResizeText(e, index, 'left'));
            rightHandle.addEventListener('touchstart', (e) => this.startResizeText(e, index, 'right'));
            rightHandle.addEventListener('mousedown', (e) => this.startResizeText(e, index, 'right'));

            trackContent.appendChild(item);
            track.appendChild(label);
            track.appendChild(trackContent);
            container.appendChild(track);
        });

        // Also populate the text timing panel
        this.renderTextTimingPanel();
    }

    // Universal drag for any clip type
    startDragClip(e, type, index) {
        e.stopPropagation();
        e.preventDefault();

        this.isDraggingBlock = true;
        this.draggingBlockType = type;
        this.draggingBlockIndex = index;

        let clip;
        if (type === 'video') {
            clip = this.videoTracks[index];
        } else if (type === 'audio') {
            clip = this.audioTracks[index];
        } else if (type === 'text') {
            clip = this.textElements[index];
            this.selectTextItem(index);
        }

        this.dragBlockDuration = clip.endTime - clip.startTime;

        document.addEventListener('touchmove', this.handleClipDrag.bind(this));
        document.addEventListener('mousemove', this.handleClipDrag.bind(this));
        document.addEventListener('touchend', this.endClipDrag.bind(this));
        document.addEventListener('mouseup', this.endClipDrag.bind(this));

        console.log(`Started dragging ${type} clip:`, index);
    }

    // Kept for backwards compatibility
    startDragTextBlock(e, index) {
        this.startDragClip(e, 'text', index);
    }

    handleClipDrag(e) {
        if (!this.isDraggingBlock) return;
        e.preventDefault();

        const touch = e.touches ? e.touches[0] : e;
        const scrubberTrack = document.querySelector('.timeline-scrubber-track');
        if (!scrubberTrack) return;

        const rect = scrubberTrack.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const time = (x / rect.width) * this.duration;

        let clip;
        if (this.draggingBlockType === 'video') {
            clip = this.videoTracks[this.draggingBlockIndex];
        } else if (this.draggingBlockType === 'audio') {
            clip = this.audioTracks[this.draggingBlockIndex];
        } else if (this.draggingBlockType === 'text') {
            clip = this.textElements[this.draggingBlockIndex];
        }

        // Move entire block, maintaining duration
        let newStartTime = time - (this.dragBlockDuration / 2);

        // Clamp to valid range
        newStartTime = Math.max(0, Math.min(newStartTime, this.duration - this.dragBlockDuration));

        clip.startTime = newStartTime;
        clip.endTime = newStartTime + this.dragBlockDuration;

        // If dragging a video clip, also move its associated audio track
        if (this.draggingBlockType === 'video') {
            const associatedAudio = this.audioTracks.find(a => a.videoClipId === clip.id);
            if (associatedAudio) {
                associatedAudio.startTime = newStartTime;
                associatedAudio.endTime = newStartTime + this.dragBlockDuration;
            }
        }

        // Re-render appropriate tracks
        if (this.draggingBlockType === 'video') {
            this.renderVideoTracks();
            this.renderAudioTracks(); // Also render audio since video-audio tracks move too
        } else if (this.draggingBlockType === 'audio') {
            this.renderAudioTracks();
        } else if (this.draggingBlockType === 'text') {
            this.renderTextTracks();
            this.updateTextTimingInputs(this.draggingBlockIndex);
        }
    }

    // Kept for backwards compatibility
    handleBlockDrag(e) {
        this.handleClipDrag(e);
    }

    endClipDrag() {
        if (this.isDraggingBlock) {
            console.log(`Ended dragging ${this.draggingBlockType} clip`);
        }
        this.isDraggingBlock = false;
        this.draggingBlockType = null;

        document.removeEventListener('touchmove', this.handleClipDrag);
        document.removeEventListener('mousemove', this.handleClipDrag);
        document.removeEventListener('touchend', this.endClipDrag);
        document.removeEventListener('mouseup', this.endClipDrag);
    }

    // Kept for backwards compatibility
    endBlockDrag() {
        this.endClipDrag();
    }

    renderTextTimingPanel() {
        const panel = document.getElementById('text-timing-list');
        if (!panel) return;

        panel.innerHTML = '';

        if (this.textElements.length === 0) {
            panel.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center;">No text elements added yet</p>';
            return;
        }

        this.textElements.forEach((text, index) => {
            const item = document.createElement('div');
            item.className = 'text-timing-item';

            const name = document.createElement('div');
            name.className = 'text-timing-name';
            name.textContent = text.content || `Text ${index + 1}`;

            const controls = document.createElement('div');
            controls.className = 'text-timing-controls';

            const startLabel = document.createElement('span');
            startLabel.className = 'text-timing-label';
            startLabel.textContent = 'Start';

            const startInput = document.createElement('input');
            startInput.type = 'number';
            startInput.className = 'text-timing-input';
            startInput.value = text.startTime.toFixed(2);
            startInput.step = '0.1';
            startInput.min = '0';
            startInput.max = this.duration;
            startInput.id = `text-${index}-start`;
            startInput.addEventListener('change', (e) => {
                const newStart = parseFloat(e.target.value);
                if (!isNaN(newStart)) {
                    text.startTime = Math.max(0, Math.min(newStart, text.endTime - 0.1));
                    this.renderTextTracks();
                }
            });

            const endLabel = document.createElement('span');
            endLabel.className = 'text-timing-label';
            endLabel.textContent = 'End';

            const endInput = document.createElement('input');
            endInput.type = 'number';
            endInput.className = 'text-timing-input';
            endInput.value = text.endTime.toFixed(2);
            endInput.step = '0.1';
            endInput.min = '0';
            endInput.max = this.duration;
            endInput.id = `text-${index}-end`;
            endInput.addEventListener('change', (e) => {
                const newEnd = parseFloat(e.target.value);
                if (!isNaN(newEnd)) {
                    text.endTime = Math.min(this.duration, Math.max(newEnd, text.startTime + 0.1));
                    this.renderTextTracks();
                }
            });

            controls.appendChild(startLabel);
            controls.appendChild(startInput);
            controls.appendChild(endLabel);
            controls.appendChild(endInput);

            item.appendChild(name);
            item.appendChild(controls);
            panel.appendChild(item);
        });
    }

    selectTextItem(index) {
        document.querySelectorAll('.timeline-text-item').forEach(item => {
            item.classList.remove('selected');
        });
        const item = document.querySelector(`.timeline-text-item[data-index="${index}"]`);
        if (item) {
            item.classList.add('selected');
        }

        // Update text timing inputs
        this.updateTextTimingInputs(index);
    }

    updateTextTimingInputs(index) {
        const text = this.textElements[index];
        if (!text) return;

        const startInput = document.getElementById(`text-${index}-start`);
        const endInput = document.getElementById(`text-${index}-end`);

        if (startInput) startInput.value = text.startTime.toFixed(2);
        if (endInput) endInput.value = text.endTime.toFixed(2);
    }

    // Text Item Resizing
    startResizeText(e, index, handle) {
        e.stopPropagation();
        this.isResizingText = true;
        this.resizingTextIndex = index;
        this.resizingHandle = handle;

        document.addEventListener('touchmove', this.handleTextResize.bind(this));
        document.addEventListener('mousemove', this.handleTextResize.bind(this));
        document.addEventListener('touchend', this.endResizeText.bind(this));
        document.addEventListener('mouseup', this.endResizeText.bind(this));
    }

    handleTextResize(e) {
        if (!this.isResizingText) return;

        const touch = e.touches ? e.touches[0] : e;
        const scrubberTrack = document.querySelector('.timeline-scrubber-track');
        const rect = scrubberTrack.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const time = (x / rect.width) * this.duration;

        const text = this.textElements[this.resizingTextIndex];

        if (this.resizingHandle === 'left') {
            text.startTime = Math.max(0, Math.min(time, text.endTime - 0.1));
        } else {
            text.endTime = Math.min(this.duration, Math.max(time, text.startTime + 0.1));
        }

        this.renderTextTracks();
        this.updateTextTimingInputs(this.resizingTextIndex);
    }

    endResizeText() {
        this.isResizingText = false;
        document.removeEventListener('touchmove', this.handleTextResize);
        document.removeEventListener('mousemove', this.handleTextResize);
        document.removeEventListener('touchend', this.endResizeText);
        document.removeEventListener('mouseup', this.endResizeText);
    }

    // Scrubber Control
    handleScrubberStart(e) {
        this.isDraggingScrubber = true;
        this.wasPlaying = this.isPlaying;
        if (this.isPlaying) {
            this.pause();
        }
        this.handleScrubberMove(e);

        document.addEventListener('touchmove', this.handleScrubberMove);
        document.addEventListener('mousemove', this.handleScrubberMove);
        document.addEventListener('touchend', this.handleScrubberEnd);
        document.addEventListener('mouseup', this.handleScrubberEnd);
    }

    handleScrubberMove(e) {
        if (!this.isDraggingScrubber) return;

        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const scrubberTrack = document.querySelector('.timeline-scrubber-track');
        const rect = scrubberTrack.getBoundingClientRect();
        const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
        const time = (x / rect.width) * this.duration;

        this.seek(time);
    }

    handleScrubberEnd() {
        this.isDraggingScrubber = false;
        if (this.wasPlaying) {
            this.play();
        }

        document.removeEventListener('touchmove', this.handleScrubberMove);
        document.removeEventListener('mousemove', this.handleScrubberMove);
        document.removeEventListener('touchend', this.handleScrubberEnd);
        document.removeEventListener('mouseup', this.handleScrubberEnd);
    }

    updateScrubberPosition() {
        const scrubber = document.querySelector('.timeline-scrubber');
        const playheadTime = document.querySelector('.timeline-playhead-time');

        if (scrubber && this.duration > 0) {
            const progress = (this.currentTime / this.duration) * 100;
            scrubber.style.left = progress + '%';

            if (playheadTime) {
                playheadTime.style.left = progress + '%';
                playheadTime.textContent = this.formatTime(this.currentTime);
            }
        }

        // Update time display
        const timeDisplay = document.querySelector('.timeline-time');
        if (timeDisplay) {
            timeDisplay.textContent = this.formatTime(this.currentTime);
        }
    }

    // Voiceover Recording
    async startVoiceoverRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.voiceoverRecorder = new MediaRecorder(stream);
            this.voiceoverChunks = [];

            this.voiceoverRecorder.ondataavailable = (e) => {
                this.voiceoverChunks.push(e.data);
            };

            this.voiceoverRecorder.onstop = () => {
                const blob = new Blob(this.voiceoverChunks, { type: 'audio/webm' });
                this.voiceoverTrack = URL.createObjectURL(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            this.voiceoverRecorder.start();

            // Update UI
            const btn = document.getElementById('voiceover-record-btn');
            if (btn) {
                btn.classList.add('recording');
                btn.innerHTML = '<i class="bi bi-stop-circle"></i> Stop Recording';
            }

        } catch (err) {
            console.error('Voiceover recording error:', err);
            alert('Could not access microphone: ' + err.message);
        }
    }

    stopVoiceoverRecording() {
        if (this.voiceoverRecorder && this.voiceoverRecorder.state === 'recording') {
            this.voiceoverRecorder.stop();

            // Update UI
            const btn = document.getElementById('voiceover-record-btn');
            const waveform = document.getElementById('voiceover-waveform');
            if (btn) {
                btn.classList.remove('recording');
                btn.innerHTML = '<i class="bi bi-mic"></i> Record Voiceover';
            }
            if (waveform) {
                waveform.textContent = 'Voiceover recorded successfully!';
                waveform.style.color = '#B39FFF';
            }

            // Show voiceover volume control
            const voiceoverVolControl = document.getElementById('voiceover-volume-control');
            if (voiceoverVolControl) {
                voiceoverVolControl.style.display = 'block';
            }
        }
    }

    // Get active video clip at current time
    getActiveVideoClip() {
        for (let clip of this.videoTracks) {
            if (this.currentTime >= clip.startTime && this.currentTime < clip.endTime) {
                return clip;
            }
        }
        return null;
    }

    // Get active audio clips at current time
    getActiveAudioClips() {
        return this.audioTracks.filter(clip =>
            this.currentTime >= clip.startTime && this.currentTime < clip.endTime
        );
    }

    // Render Loop - Updated for multi-track
    update() {
        // Get the active video clip at current time
        const activeClip = this.getActiveVideoClip();

        if (activeClip) {
            // Get the video element for this clip
            let videoEl;
            if (activeClip.type === 'main') {
                videoEl = this.video;
            } else {
                videoEl = this.videoElements[activeClip.id];
            }

            if (videoEl && videoEl.readyState >= 2) {
                // If playing, update currentTime from the video element
                if (this.isPlaying && !videoEl.paused) {
                    // Calculate global time from clip time
                    this.currentTime = activeClip.startTime + videoEl.currentTime;
                    this.updateScrubberPosition();

                    // Check if we've reached the end of this clip
                    if (this.currentTime >= activeClip.endTime) {
                        // Pause current clip
                        videoEl.pause();

                        // Move to the start of next clip or end
                        this.currentTime = Math.min(activeClip.endTime + 0.01, this.duration);

                        // Check if we've reached the end of the entire timeline
                        if (this.currentTime >= this.duration) {
                            this.pause();
                            this.currentTime = 0;
                            this.seek(0);
                        } else {
                            // There's more timeline, check for next clip
                            const nextClip = this.getActiveVideoClip();
                            if (nextClip && nextClip !== activeClip) {
                                // Start playing the next clip
                                let nextVideoEl;
                                if (nextClip.type === 'main') {
                                    nextVideoEl = this.video;
                                } else {
                                    nextVideoEl = this.videoElements[nextClip.id];
                                }
                                if (nextVideoEl && nextVideoEl.readyState >= 2) {
                                    nextVideoEl.currentTime = this.currentTime - nextClip.startTime;
                                    nextVideoEl.play().catch(e => console.log('Next clip play error:', e));
                                }
                            }
                        }
                    }
                }

                // Calculate time within the clip
                const clipTime = this.currentTime - activeClip.startTime;

                // Only sync if we're out of sync (switched clips or seeking)
                if (Math.abs(videoEl.currentTime - clipTime) > 0.1) {
                    videoEl.currentTime = clipTime;

                    // If playing, ensure video element is playing
                    if (this.isPlaying && videoEl.paused) {
                        videoEl.play().catch(e => console.log('Video play error:', e));
                    }
                }

                // Set canvas size if not already set or if video size changed
                if (this.canvas.width !== videoEl.videoWidth || this.canvas.height !== videoEl.videoHeight) {
                    this.canvas.width = videoEl.videoWidth;
                    this.canvas.height = videoEl.videoHeight;
                }

                // Clear canvas
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

                // Draw video frame to canvas
                this.ctx.drawImage(videoEl, 0, 0, this.canvas.width, this.canvas.height);

                // Apply speed if different from 1x
                if (activeClip.speed && activeClip.speed !== 1) {
                    videoEl.playbackRate = activeClip.speed;
                }

                // Apply volume
                if (activeClip.volume !== undefined) {
                    videoEl.volume = activeClip.volume;
                }

                // Draw visible text overlays ON TOP of video
                this.drawTextOverlays();
            }
        } else {
            // No active clip, show black screen with text
            if (this.canvas.width > 0 && this.canvas.height > 0) {
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                this.drawTextOverlays();
            }
        }

        // Play/pause active audio clips
        const activeAudioClips = this.getActiveAudioClips();
        activeAudioClips.forEach(clip => {
            const audioEl = this.audioElements[clip.id];
            if (audioEl) {
                const clipTime = this.currentTime - clip.startTime;

                // Only sync audio time if out of sync (don't constantly reset)
                if (Math.abs(audioEl.currentTime - clipTime) > 0.2) {
                    audioEl.currentTime = clipTime;
                }

                // Play if not playing
                if (this.isPlaying && audioEl.paused) {
                    audioEl.play().catch(e => console.log('Audio play error:', e));
                }

                // Pause if should be paused
                if (!this.isPlaying && !audioEl.paused) {
                    audioEl.pause();
                }

                // Apply volume
                if (clip.volume !== undefined) {
                    audioEl.volume = clip.volume;
                }
            }
        });

        // Pause audio clips that are not active
        this.audioTracks.forEach(clip => {
            if (!activeAudioClips.includes(clip)) {
                const audioEl = this.audioElements[clip.id];
                if (audioEl && !audioEl.paused) {
                    audioEl.pause();
                }
            }
        });

        requestAnimationFrame(this.update);
    }

    drawTextOverlays() {
        // Update visibility first
        this.updateTextVisibility();

        const visibleTexts = this.getVisibleTexts();

        if (visibleTexts.length === 0) {
            return; // No text to draw
        }

        visibleTexts.forEach(text => {
            if (!text.content) return; // Skip empty text

            this.ctx.save();

            // Set font
            let fontStyle = '';
            if (text.italic) fontStyle += 'italic ';
            if (text.bold) fontStyle += 'bold ';
            this.ctx.font = `${fontStyle}${text.size || 48}px ${text.font || 'Arial'}`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            const style = text.style || 'outline';
            const metrics = this.ctx.measureText(text.content);
            const textWidth = metrics.width;
            const textHeight = text.size || 48;

            // Scale coordinates to canvas size
            const canvasWidth = this.canvas.width;
            const canvasHeight = this.canvas.height;
            const scaleX = canvasWidth / 1080; // Assuming design width of 1080
            const scaleY = canvasHeight / 1920; // Assuming design height of 1920

            const x = (text.x || 540) * scaleX;
            const y = (text.y || 960) * scaleY;

            // Draw text with style
            if (style === 'outline') {
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = (text.size || 48) * 0.15;
                this.ctx.strokeText(text.content, x, y);
                this.ctx.fillStyle = text.color || 'white';
                this.ctx.fillText(text.content, x, y);
            } else if (style === 'solid') {
                this.ctx.fillStyle = text.bgColor || '#000';
                this.ctx.fillRect(
                    x - textWidth / 2 - 12,
                    y - textHeight / 2 - 8,
                    textWidth + 24,
                    textHeight + 16
                );
                this.ctx.fillStyle = text.color || 'white';
                this.ctx.fillText(text.content, x, y);
            } else if (style === 'rounded') {
                this.ctx.fillStyle = text.bgColor || 'rgba(0,0,0,0.7)';
                this.roundRect(
                    x - textWidth / 2 - 12,
                    y - textHeight / 2 - 8,
                    textWidth + 24,
                    textHeight + 16,
                    12
                );
                this.ctx.fill();
                this.ctx.fillStyle = text.color || 'white';
                this.ctx.fillText(text.content, x, y);
            } else if (style === 'semi') {
                this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
                this.ctx.fillRect(
                    x - textWidth / 2 - 12,
                    y - textHeight / 2 - 8,
                    textWidth + 24,
                    textHeight + 16
                );
                this.ctx.fillStyle = text.color || 'white';
                this.ctx.fillText(text.content, x, y);
            }

            this.ctx.restore();
        });
    }

    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }

    // UI Helpers
    updatePlayPauseButton() {
        // Update play/pause button if exists
    }

    showPlayPauseIcon(iconClass) {
        const icon = document.querySelector('.editor-play-pause');
        if (icon) {
            icon.className = 'editor-play-pause show';
            icon.innerHTML = `<i class="bi ${iconClass}"></i>`;
            setTimeout(() => {
                icon.classList.remove('show');
            }, 500);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Export
    async exportVideo() {
        // Return all tracks and settings
        return {
            videoTracks: this.videoTracks,
            audioTracks: this.audioTracks,
            textElements: this.textElements,
            speed: this.playbackSpeed,
            volume: this.volume,
            voiceoverTrack: this.voiceoverTrack,
            duration: this.duration
        };
    }
}

// Global instance
let videoEditor = null;

// Initialize video editor
function openVideoEditor(videoSrc, textElements = []) {
    const editorEl = document.getElementById('video-editor');
    const videoEl = document.getElementById('editor-video');
    const canvasEl = document.getElementById('editor-canvas');

    if (!videoEditor) {
        videoEditor = new VideoEditor(videoEl, canvasEl);
        videoEditor.initialize();
    }

    // Close all control panels first
    document.querySelectorAll('.editor-control-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    videoEditor.loadVideo(videoSrc, textElements);
    editorEl.classList.add('active');

    // Update duration display and render timeline after metadata loads
    const metadataHandler = () => {
        const durationEl = document.querySelector('.timeline-duration');
        if (durationEl) {
            durationEl.textContent = videoEditor.formatTime(videoEl.duration);
        }

        // Update timeline scale and render text tracks
        videoEditor.updateTimelineScale();
        videoEditor.renderTimeline();

        // Remove the event listener after it fires
        videoEl.removeEventListener('loadedmetadata', metadataHandler);
    };

    videoEl.addEventListener('loadedmetadata', metadataHandler);

    // If metadata is already loaded, trigger immediately
    if (videoEl.readyState >= 1) {
        metadataHandler();
    }

    console.log('Video editor opened with', textElements.length, 'text elements');
}

function closeVideoEditor() {
    const editorEl = document.getElementById('video-editor');
    editorEl.classList.remove('active');

    // Close all control panels
    document.querySelectorAll('.editor-control-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    if (videoEditor) {
        videoEditor.pause();
    }

    console.log('Video editor closed');
}

// Control Panel Management
function openControlPanel(panelId) {
    // Close all panels
    document.querySelectorAll('.editor-control-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    // Open requested panel
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.add('active');
    }
}

function closeControlPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.remove('active');
    }
}

// Export edited video
async function exportEditedVideo() {
    if (!videoEditor) return null;

    const settings = await videoEditor.exportVideo();
    closeVideoEditor();

    return settings;
}
