import React, { useRef, useEffect, useState } from 'react';
import { VideoClip } from '../types';

interface PlayerProps {
  playlist: VideoClip[];
  onEnded: () => void;
  autoPlay?: boolean;
}

export const Player: React.FC<PlayerProps> = ({ playlist, onEnded, autoPlay = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Reset when playlist changes
    setCurrentIndex(0);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [playlist]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      if (currentIndex < playlist.length - 1) {
        setCurrentIndex(prev => prev + 1);
        // Small timeout to allow state update before play
        setTimeout(() => {
            videoRef.current?.play().catch(() => {});
        }, 50);
      } else {
        setIsPlaying(false);
        onEnded();
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [currentIndex, playlist, onEnded]);

  // Handle source change when index changes
  useEffect(() => {
    const video = videoRef.current;
    if (video && playlist[currentIndex]) {
      video.src = playlist[currentIndex].url;
      if (autoPlay || (currentIndex > 0 && isPlaying)) {
        video.play().catch(e => console.log('Autoplay blocked', e));
        setIsPlaying(true);
      }
    }
  }, [currentIndex, playlist, autoPlay]);

  if (!playlist.length) {
    return (
      <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-gray-500">
        没有加载视频
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-800">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          controls
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {/* Overlay showing current clip info */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white border border-white/10">
          正在播放: {playlist[currentIndex]?.name} ({currentIndex + 1}/{playlist.length})
        </div>
      </div>

      {/* Playlist Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {playlist.map((clip, idx) => (
          <div 
            key={`${clip.id}-${idx}`}
            onClick={() => {
                setCurrentIndex(idx);
                setIsPlaying(true);
            }}
            className={`flex-shrink-0 w-32 cursor-pointer transition-all rounded-lg overflow-hidden border-2 relative group
              ${idx === currentIndex ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
          >
            <div className="bg-gray-800 aspect-video flex items-center justify-center text-xs text-gray-400">
               <span className="truncate px-2">{clip.name}</span>
            </div>
            {idx === currentIndex && (
                <div className="absolute inset-0 bg-brand-500/10 flex items-center justify-center">
                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-ping" />
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};