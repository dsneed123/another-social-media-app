use axum::{
    extract::{State, Multipart},
    Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use std::process::Command;
use tokio::fs;
use tempfile::TempDir;
use aws_sdk_s3::primitives::ByteStream;

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextElement {
    pub content: String,
    pub x: f64,
    pub y: f64,
    pub font_size: i32,
    pub color: String,
    pub start_time: f64,
    pub end_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoClip {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTrack {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub volume: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenderRequest {
    pub user_id: Uuid,
    pub text_elements: Vec<TextElement>,
    pub video_clips: Vec<VideoClip>,
    pub audio_tracks: Vec<AudioTrack>,
    pub speed: f64,
}

#[derive(Debug, Serialize)]
pub struct RenderResponse {
    pub render_id: Uuid,
    pub video_url: String,
    pub message: String,
    pub render_time_seconds: f64,
}

/// Render video with edits using FFmpeg (server-side, 10-100x faster than browser)
pub async fn render_video(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<RenderResponse>, StatusCode> {
    println!("🎬 Received video render request");

    let mut user_id: Option<Uuid> = None;
    let mut original_video_data: Option<Vec<u8>> = None;
    let mut original_filename: Option<String> = None;
    let mut text_elements: Vec<TextElement> = Vec::new();
    let mut video_clips: Vec<VideoClip> = Vec::new();
    let mut audio_tracks: Vec<AudioTrack> = Vec::new();
    let mut audio_files: Vec<(String, Vec<u8>)> = Vec::new();
    let mut video_files: Vec<(String, Vec<u8>)> = Vec::new();
    let mut speed: f64 = 1.0;

    // Parse multipart form data
    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "user_id" => {
                let value = field.text().await.unwrap();
                user_id = Uuid::parse_str(&value).ok();
            }
            "video" => {
                original_filename = field.file_name().map(|s| s.to_string());
                original_video_data = Some(field.bytes().await.unwrap().to_vec());
            }
            "text_elements" => {
                let json_str = field.text().await.unwrap();
                text_elements = serde_json::from_str(&json_str).unwrap_or_default();
            }
            "video_clips" => {
                let json_str = field.text().await.unwrap();
                video_clips = serde_json::from_str(&json_str).unwrap_or_default();
            }
            "audio_tracks" => {
                let json_str = field.text().await.unwrap();
                audio_tracks = serde_json::from_str(&json_str).unwrap_or_default();
            }
            "speed" => {
                if let Ok(text) = field.text().await {
                    speed = text.parse().unwrap_or(1.0);
                }
            }
            name if name.starts_with("audio_") => {
                let file_id = name.strip_prefix("audio_").unwrap().to_string();
                let data = field.bytes().await.unwrap().to_vec();
                audio_files.push((file_id, data));
            }
            name if name.starts_with("video_clip_") => {
                let clip_id = name.strip_prefix("video_clip_").unwrap().to_string();
                let data = field.bytes().await.unwrap().to_vec();
                video_files.push((clip_id, data));
            }
            _ => {}
        }
    }

    let user_id = user_id.ok_or(StatusCode::BAD_REQUEST)?;
    let video_data = original_video_data.ok_or(StatusCode::BAD_REQUEST)?;

    println!("📊 Render stats:");
    println!("  - Text elements: {}", text_elements.len());
    println!("  - Video clips: {}", video_clips.len());
    println!("  - Audio tracks: {}", audio_tracks.len());
    println!("  - Speed: {}x", speed);

    let render_start = std::time::Instant::now();

    // Create temp directory for processing
    let temp_dir = TempDir::new().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let temp_path = temp_dir.path();

    // Write original video to temp file
    let input_video = temp_path.join("input.mp4");
    fs::write(&input_video, &video_data)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Write additional video clips if any
    for (clip_id, data) in &video_files {
        let clip_path = temp_path.join(format!("clip_{}.mp4", clip_id));
        fs::write(&clip_path, data)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // Write audio files if any
    for (track_id, data) in &audio_files {
        let audio_path = temp_path.join(format!("audio_{}.mp3", track_id));
        fs::write(&audio_path, data)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    let output_video = temp_path.join("output.mp4");

    // Build FFmpeg command
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-i").arg(&input_video);

    // Add additional video inputs
    for (clip_id, _) in &video_files {
        let clip_path = temp_path.join(format!("clip_{}.mp4", clip_id));
        cmd.arg("-i").arg(&clip_path);
    }

    // Add audio inputs
    for (track_id, _) in &audio_files {
        let audio_path = temp_path.join(format!("audio_{}.mp3", track_id));
        cmd.arg("-i").arg(&audio_path);
    }

    // Build complex filter
    let mut filter_parts = Vec::new();

    // Handle multi-clip concatenation if needed
    if video_clips.len() > 1 {
        // Sort clips by order
        let mut sorted_clips = video_clips.clone();
        sorted_clips.sort_by_key(|c| c.order);

        // Build concat filter
        let concat_input: String = sorted_clips.iter()
            .enumerate()
            .map(|(i, _)| format!("[{}:v]", i))
            .collect::<Vec<_>>()
            .join("");

        filter_parts.push(format!(
            "{}concat=n={}:v=1:a=0[vconcat]",
            concat_input,
            sorted_clips.len()
        ));
    }

    // Handle speed change
    let video_stream = if speed != 1.0 {
        filter_parts.push(format!(
            "[{}]setpts={}*PTS[v]",
            if video_clips.len() > 1 { "vconcat" } else { "0:v" },
            1.0 / speed
        ));
        "[v]".to_string()
    } else if video_clips.len() > 1 {
        "[vconcat]".to_string()
    } else {
        "[0:v]".to_string()
    };

    // Add text overlays
    let mut current_stream = video_stream;
    for (i, text) in text_elements.iter().enumerate() {
        let escaped_text = text.content.replace("'", "\\'").replace(":", "\\:");
        let next_stream = format!("[vtext{}]", i);

        filter_parts.push(format!(
            "{}drawtext=text='{}':x={}:y={}:fontsize={}:fontcolor={}:enable='between(t,{},{})'{}\n",
            current_stream,
            escaped_text,
            text.x,
            text.y,
            text.font_size,
            text.color,
            text.start_time,
            text.end_time,
            next_stream
        ));

        current_stream = next_stream;
    }

    // Mix audio if multiple tracks
    let audio_stream = if audio_tracks.len() > 0 {
        let audio_inputs: String = (0..=audio_tracks.len())
            .map(|i| format!("[{}:a]", i))
            .collect::<Vec<_>>()
            .join("");

        filter_parts.push(format!(
            "{}amix=inputs={}[aout]",
            audio_inputs,
            audio_tracks.len() + 1
        ));
        "[aout]".to_string()
    } else {
        "[0:a]".to_string()
    };

    // Apply filters if any
    if !filter_parts.is_empty() {
        let final_video = current_stream.trim_end_matches(']').trim_start_matches('[');
        filter_parts.push(format!("[{}][{}]", final_video, audio_stream.trim_matches(|c| c == '[' || c == ']')));

        let filter_complex = filter_parts.join(";");
        cmd.arg("-filter_complex").arg(&filter_complex);
    }

    // Output settings
    cmd.arg("-c:v").arg("libx264")
        .arg("-preset").arg("fast")
        .arg("-crf").arg("23")
        .arg("-c:a").arg("aac")
        .arg("-b:a").arg("192k")
        .arg("-y")
        .arg(&output_video);

    println!("🎬 Running FFmpeg...");
    println!("Command: {:?}", cmd);

    // Run FFmpeg
    let output = cmd.output()
        .map_err(|e| {
            eprintln!("❌ FFmpeg execution failed: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !output.status.success() {
        eprintln!("❌ FFmpeg failed:");
        eprintln!("STDOUT: {}", String::from_utf8_lossy(&output.stdout));
        eprintln!("STDERR: {}", String::from_utf8_lossy(&output.stderr));
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    println!("✅ FFmpeg completed successfully");

    // Read rendered video
    let rendered_data = fs::read(&output_video)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let render_time = render_start.elapsed().as_secs_f64();
    println!("⏱️ Render time: {:.2}s", render_time);

    // Upload to S3
    let render_id = Uuid::new_v4();
    let s3_key = format!("stories/{}/rendered_{}.mp4", user_id, render_id);

    let byte_stream = ByteStream::from(rendered_data);
    state.media_service.s3_client
        .put_object()
        .bucket(&state.media_service.bucket_name)
        .key(&s3_key)
        .body(byte_stream)
        .content_type("video/mp4")
        .send()
        .await
        .map_err(|e| {
            eprintln!("❌ S3 upload failed: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Construct public URL
    let video_url = if let Some(ref public_base) = state.media_service.public_url_base {
        format!("{}/{}", public_base, s3_key)
    } else {
        format!("https://{}.s3.amazonaws.com/{}", state.media_service.bucket_name, s3_key)
    };

    println!("✅ Rendered video uploaded: {}", video_url);

    Ok(Json(RenderResponse {
        render_id,
        video_url,
        message: "Video rendered successfully".to_string(),
        render_time_seconds: render_time,
    }))
}
