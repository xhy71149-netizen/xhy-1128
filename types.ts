
export interface VideoClip {
  id: string;
  file: File;
  name: string;
  duration: number; // in seconds
  url: string;
}

export interface SequenceConfig {
  minDuration: number;
  maxDuration: number;
}

export interface TimelineItem {
  clip: VideoClip;
  cutDuration: number; // The duration AI decided for this clip (in seconds)
  reasoning?: string; // Why this clip is here
}

export interface GeneratedSequence {
  id: string; // Unique ID for this specific generation result
  bgmName?: string; // Name of the BGM used for this sequence
  bgmFile?: File; // The actual BGM file
  timeline: TimelineItem[];
  totalDuration: number;
  narrativeReasoning: string;
  title: string;
}

export interface ProcessingState {
  status: 'idle' | 'analyzing' | 'generating' | 'complete' | 'error';
  message?: string;
}
