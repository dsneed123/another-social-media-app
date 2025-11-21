#!/bin/bash
# Install FFmpeg for video rendering

echo "🎬 Installing FFmpeg..."

# Check OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu
        echo "Detected Debian/Ubuntu"
        sudo apt-get update
        sudo apt-get install -y ffmpeg
    elif command -v yum &> /dev/null; then
        # RedHat/CentOS
        echo "Detected RedHat/CentOS"
        sudo yum install -y ffmpeg
    elif command -v pacman &> /dev/null; then
        # Arch Linux
        echo "Detected Arch Linux"
        sudo pacman -S --noconfirm ffmpeg
    else
        echo "❌ Unsupported Linux distribution"
        exit 1
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "Detected macOS"
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not installed. Install it from https://brew.sh/"
        exit 1
    fi
    brew install ffmpeg
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

# Verify installation
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg installed successfully!"
    ffmpeg -version | head -1
else
    echo "❌ FFmpeg installation failed"
    exit 1
fi
