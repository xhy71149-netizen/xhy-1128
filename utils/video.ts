import { VideoClip, TimelineItem } from '../types';

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
 * Concatenates video clips into a single blob using Canvas, Web Audio API and MediaRecorder.
 * Handles BGM mixing, muting original clips, and fade effects.
 * Optimized for 60fps and frame accuracy.
 */
export const concatVideos = async (
  timeline: TimelineItem[], 
  bgmFile: File | null,
  useGPU: boolean,
  onProgress: (progress: number) => void
): Promise<Blob> => {
  if (timeline.length === 0) throw new Error("没有可合成的视频片段");

  const canvas = document.createElement('canvas');
  // Optimize context for frequent reads/writes
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  
  // Set resolution to 1080x1920 (9:16 aspect ratio)
  canvas.width = 1080; 
  canvas.height = 1920;

  // Setup Audio Context for BGM
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();
  const gainNode = audioCtx.createGain();
  
  // Configure Fade Effects (1.5s)
  const totalDuration = timeline.reduce((acc, item) => acc + item.cutDuration, 0);
  const fadeDuration = 1.5;

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeDuration);
  gainNode.gain.setValueAtTime(1, audioCtx.currentTime + totalDuration - fadeDuration);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + totalDuration);

  gainNode.connect(dest);

  // Load and decode BGM
  if (bgmFile) {
    const arrayBuffer = await bgmFile.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    source.start(0); // Start playing BGM immediately in the context timeline
  }

  // Combine Canvas Video + BGM Audio
  // Capture at 60 FPS strictly
  const canvasStream = canvas.captureStream(60);
  
  // Merge audio tracks if BGM exists, otherwise just video
  const tracks = [
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ];
  const combinedStream = new MediaStream(tracks);

  let mimeType = 'video/webm';
  if (useGPU && MediaRecorder.isTypeSupported('video/webm; codecs=h264')) {
      mimeType = 'video/webm; codecs=h264';
  } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
      mimeType = 'video/webm; codecs=vp9';
  }
    
  // High bitrate for 1080p 60fps to prevent compression artifacts
  const mediaRecorder = new MediaRecorder(combinedStream, { 
    mimeType, 
    videoBitsPerSecond: 25000000 // 25 Mbps
  });
  
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Start recording
  mediaRecorder.start();

  const video = document.createElement('video');
  video.muted = true; // IMPORTANT: Mute original video
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  let processedDuration = 0;

  // Helper to play a single clip segment
  const playClipSegment = async (item: TimelineItem) => {
    return new Promise<void>((resolve, reject) => {
      const { clip, cutDuration } = item;
      video.src = clip.url;
      
      video.onloadedmetadata = () => {
        // Resume recording components when video is ready
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (mediaRecorder.state === 'paused') mediaRecorder.resume();

        const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const w = video.videoWidth * scale;
        const h = video.videoHeight * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;

        const drawFrame = () => {
          if (video.paused || video.ended) return;

          // Use video.currentTime to strictly track content consumption.
          // This ensures we capture the exact amount of video content intended, 
          // even if rendering lags slightly (preserving frames).
          if (video.currentTime >= cutDuration) {
             video.pause();
             resolve();
             return;
          }

          if (ctx) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, x, y, w, h);
          }

          const currentTotal = processedDuration + video.currentTime;
          onProgress(Math.min(currentTotal / totalDuration, 0.99));
          
          // Prefer requestVideoFrameCallback for frame-perfect rendering
          if ('requestVideoFrameCallback' in video) {
            (video as any).requestVideoFrameCallback(drawFrame);
          } else {
            requestAnimationFrame(drawFrame);
          }
        };

        video.play().then(() => {
          if ('requestVideoFrameCallback' in video) {
             (video as any).requestVideoFrameCallback(drawFrame);
          } else {
             requestAnimationFrame(drawFrame);
          }
        }).catch(reject);
      };

      video.onerror = (e) => reject(e);
    });
  };

  try {
    for (const item of timeline) {
      // Pause everything while loading the next video to keep A/V sync
      mediaRecorder.pause();
      await audioCtx.suspend();
      
      await playClipSegment(item);
      
      processedDuration += item.cutDuration;
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
      audioCtx.close();
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
    mediaRecorder.stop();
  });
};