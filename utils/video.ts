import { VideoClip } from '../types';

export const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法加载文件元数据: ${file.name}`));
    };

    video.src = url;
  });
};

export const processUploadedFiles = async (files: File[]): Promise<VideoClip[]> => {
  const clips: VideoClip[] = [];

  for (const file of files) {
    try {
      const duration = await getVideoDuration(file);
      clips.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        duration,
        url: URL.createObjectURL(file)
      });
    } catch (error) {
      console.error(`跳过文件 ${file.name}:`, error);
    }
  }

  return clips;
};

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Concatenates video clips into a single blob using Canvas and MediaRecorder.
 * This runs client-side and records the sequence in real-time (fast-forward not reliably supported by all browsers).
 */
export const concatVideos = async (clips: VideoClip[], onProgress: (progress: number) => void): Promise<Blob> => {
  if (clips.length === 0) throw new Error("没有可合成的视频片段");

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const video = document.createElement('video');
  video.muted = true; // Required for auto-play in some contexts
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  
  // Set resolution to 1080x1920 (9:16 aspect ratio) as requested
  canvas.width = 1080; 
  canvas.height = 1920;

  // 60 FPS recording
  const stream = canvas.captureStream(60);
  // Prefer VP9 for better quality/size ratio, fallback to standard webm
  const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
    ? 'video/webm; codecs=vp9' 
    : 'video/webm';
    
  const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 }); // Increased bitrate for 60fps/1080p
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start();

  const totalDuration = clips.reduce((acc, c) => acc + c.duration, 0);
  let processedDuration = 0;

  // Helper to play a single clip and draw to canvas
  const playClip = async (clip: VideoClip) => {
    return new Promise<void>((resolve, reject) => {
      video.src = clip.url;
      
      video.onloadedmetadata = () => {
        // Calculate aspect ratio fit (contain)
        // This ensures the video fits within the 9:16 canvas, adding black bars if necessary
        const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const w = video.videoWidth * scale;
        const h = video.videoHeight * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;

        const drawFrame = () => {
          if (video.paused || video.ended) return;
          
          if (ctx) {
            // Black background
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Draw video
            ctx.drawImage(video, x, y, w, h);
          }

          const currentTotal = processedDuration + video.currentTime;
          const progress = Math.min(currentTotal / totalDuration, 0.99);
          onProgress(progress);
          
          requestAnimationFrame(drawFrame);
        };

        video.play().then(() => {
          drawFrame();
        }).catch(reject);
      };

      video.onended = () => {
        processedDuration += clip.duration;
        resolve();
      };
      
      video.onerror = (e) => reject(e);
    });
  };

  try {
    for (const clip of clips) {
      await playClip(clip);
    }
  } catch (err) {
    console.error("Error during rendering:", err);
    mediaRecorder.stop();
    throw err;
  }

  // Finalize
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      onProgress(1);
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
    mediaRecorder.stop();
  });
};