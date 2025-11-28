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

export interface GeneratedSequence {
  clips: VideoClip[];
  totalDuration: number;
  narrativeReasoning: string;
  title: string;
}

export interface ProcessingState {
  status: 'idle' | 'analyzing' | 'generating' | 'complete' | 'error';
  message?: string;
}