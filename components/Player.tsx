
import React, { useRef, useEffect, useState } from 'react';
import { TimelineItem } from '../types';

interface PlayerProps {
  timeline: TimelineItem[];
  bgmFile: File | null;
  onEnded: () => void;
  autoPlay?: boolean;
}

export const Player: React.FC<PlayerProps> = ({ timeline, bgmFile, onEnded, autoPlay = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);

  // Setup BGM URL
  useEffect(() => {
    if (bgmFile) {
      const url = URL.createObjectURL(bgmFile);
      setBgmUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBgmUrl(null);
    }
  }, [bgmFile]);

  // Reset when timeline changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    if (videoRef.current) {
        videoRef.current.load();
    }
    if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.pause();
    }
  }, [timeline]);

  // Monitor playback time to enforce cutDuration
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let animationFrameId: number;

    const checkTime = () => {
      if (video.paused || video.ended) return;
      
      const currentItem = timeline[currentIndex];
      if (currentItem && video.currentTime >= currentItem.cutDuration) {
        handleNext();
      } else {
        animationFrameId = requestAnimationFrame(checkTime);
      }
    };

    const onPlay = () => {
        setIsPlaying(true);
        // Sync Audio
        if (currentIndex === 0 && audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
        }
        animationFrameId = requestAnimationFrame(checkTime);
    };
    
    const onPause = () => {
        setIsPlaying(false);
        cancelAnimationFrame(animationFrameId);
        // Pause audio if video pauses (simple sync attempt)
        if (audioRef.current) audioRef.current.pause();
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentIndex, timeline]);

  const handleNext = () => {
     if (currentIndex < timeline.length - 1) {
        setCurrentIndex(prev => prev + 1);
     } else {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();
        onEnded();
     }
  };

  // Handle clip switching
  useEffect(() => {
    const video = videoRef.current;
    if (video && timeline[currentIndex]) {
      video.src = timeline[currentIndex].clip.url;
      // Ensure muted in preview as well if we have BGM, or simply just because user requested "clips muted"
      video.muted = true; 
      
      if (autoPlay || (currentIndex > 0 && isPlaying)) {
        video.play().catch(e => console.log('Autoplay blocked', e));
      }
    }
  }, [currentIndex, timeline, autoPlay]);

  if (!timeline.length) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[9/16] md:aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-800 mx-auto w-full max-w-md md:max-w-full">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          controls={false} // Hide native controls to enforce custom logic
          playsInline
        />
        
        {/* Hidden Audio for BGM Preview */}
        {bgmUrl && (
            <audio ref={audioRef} src={bgmUrl} />
        )}

        {/* Custom Controls Overlay */}
        <div 
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={() => {
                if (videoRef.current?.paused) {
                    videoRef.current.play();
                    audioRef.current?.play();
                } else {
                    videoRef.current?.pause();
                    audioRef.current?.pause();
                }
            }}
        >
            {!isPlaying && (
                 <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                 </div>
            )}
        </div>
        
        {/* Info Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs text-white border border-white/10 max-w-[70%]">
            <div className="font-bold truncate">{timeline[currentIndex]?.clip.name}</div>
            <div className="text-gray-300">
                剪辑时长: {timeline[currentIndex]?.cutDuration.toFixed(1)}s / 原长: {timeline[currentIndex]?.clip.duration.toFixed(1)}s
            </div>
            {timeline[currentIndex]?.reasoning && (
                <div className="text-brand-400 mt-1 italic">"{timeline[currentIndex].reasoning}"</div>
            )}
          </div>
          <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-xs font-mono text-white border border-white/10">
             {currentIndex + 1}/{timeline.length}
          </div>
        </div>
        
        {/* Progress Bar (Global) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
             <div 
               className="h-full bg-brand-500 transition-all duration-300"
               style={{ width: `${((currentIndex) / timeline.length) * 100}%` }}
             />
        </div>
      </div>

      {/* Playlist Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {timeline.map((item, idx) => (
          <div 
            key={`${item.clip.id}-${idx}`}
            onClick={() => {
                setCurrentIndex(idx);
                if (audioRef.current) {
                    // Primitive seek logic for BGM preview (not accurate but better than nothing)
                    // In a real app we'd calculate precise cumulative time
                    audioRef.current.currentTime = 0; 
                    audioRef.current.play();
                }
                videoRef.current?.play();
            }}
            className={`flex-shrink-0 w-24 md:w-32 cursor-pointer transition-all rounded-lg overflow-hidden border-2 relative group
              ${idx === currentIndex ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
          >
            <div className="bg-gray-800 aspect-video flex flex-col items-center justify-center text-xs text-gray-400 p-1">
               <span className="truncate w-full text-center">{item.clip.name}</span>
               <span className="text-[10px] text-brand-500 mt-1">{item.cutDuration}s</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
