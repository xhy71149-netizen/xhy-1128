
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

// Helper to preload video metadata
const loadVideoPromise = (video: HTMLVideoElement, url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    video.src = url;
    video.onloadedmetadata = () => resolve();
    video.onerror = (e) => reject(new Error(`Failed to load video: ${url}`));
  });
};

/**
 * Concatenates video clips into a single blob using Canvas, Web Audio API and MediaRecorder.
 * Uses Double Buffering to ensure smooth BGM playback without interruptions.
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
    source.start(0); // Start playing BGM immediately
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
    
  // High bitrate for 1080p 60fps
  const mediaRecorder = new MediaRecorder(combinedStream, { 
    mimeType, 
    videoBitsPerSecond: 25000000 // 25 Mbps
  });
  
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // --- Double Buffering Setup ---
  const v1 = document.createElement('video');
  const v2 = document.createElement('video');
  
  // Configure videos
  [v1, v2].forEach(v => {
      v.muted = true; // IMPORTANT: Mute original video
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.width = 1080;
      v.height = 1920;
  });

  let currentVideo = v1;
  let nextVideo = v2;
  let processedDuration = 0;

  // Start recording
  mediaRecorder.start();
  // Ensure audio is running (some browsers start suspended)
  if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
  }

  try {
      // 1. Initial Load
      await loadVideoPromise(currentVideo, timeline[0].clip.url);
      
      let nextVideoPromise: Promise<void> | null = null;
      if (timeline.length > 1) {
          nextVideoPromise = loadVideoPromise(nextVideo, timeline[1].clip.url);
      }

      for (let i = 0; i < timeline.length; i++) {
          const item = timeline[i];
          const duration = item.cutDuration;

          // Play current video
          await new Promise<void>((resolve, reject) => {
              const playPromise = currentVideo.play();
              if (playPromise) playPromise.catch(reject);

              const drawFrame = () => {
                  if (currentVideo.paused || currentVideo.ended) return;

                  // Render to canvas
                  if (ctx) {
                      const scale = Math.min(canvas.width / currentVideo.videoWidth, canvas.height / currentVideo.videoHeight);
                      const w = currentVideo.videoWidth * scale;
                      const h = currentVideo.videoHeight * scale;
                      const x = (canvas.width - w) / 2;
                      const y = (canvas.height - h) / 2;

                      ctx.fillStyle = '#000';
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(currentVideo, x, y, w, h);
                  }

                  const currentTime = currentVideo.currentTime;
                  // Update progress
                  onProgress(Math.min((processedDuration + currentTime) / totalDuration, 0.99));

                  // Check if cut duration reached
                  if (currentTime >= duration) {
                      currentVideo.pause();
                      resolve();
                  } else {
                      if ('requestVideoFrameCallback' in currentVideo) {
                          (currentVideo as any).requestVideoFrameCallback(drawFrame);
                      } else {
                          requestAnimationFrame(drawFrame);
                      }
                  }
              };

              if ('requestVideoFrameCallback' in currentVideo) {
                  (currentVideo as any).requestVideoFrameCallback(drawFrame);
              } else {
                  requestAnimationFrame(drawFrame);
              }
          });

          processedDuration += duration;

          // Prepare for next clip
          if (i < timeline.length - 1) {
              // Wait for next video ONLY if it hasn't loaded yet.
              // We do NOT pause MediaRecorder/AudioContext here to ensure smooth BGM.
              // If loading is slow, the canvas will hold the last frame (freeze) but audio continues.
              // Double buffering makes freezing very unlikely for local files.
              if (nextVideoPromise) {
                  await nextVideoPromise;
              }

              // Swap buffers
              [currentVideo, nextVideo] = [nextVideo, currentVideo];

              // Preload i + 2
              if (i + 2 < timeline.length) {
                  nextVideoPromise = loadVideoPromise(nextVideo, timeline[i + 2].clip.url);
              } else {
                  nextVideoPromise = null;
              }
          }
      }

  } catch (err) {
      console.error("Error during rendering:", err);
      mediaRecorder.stop();
      audioCtx.close();
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
