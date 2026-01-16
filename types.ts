
export interface Scene {
  sceneNumber: number;
  timeRange: string;
  screenDescription: string;
  narration: string;
  bgmMood: string;
  imagePrompt: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  isGeneratingImage?: boolean;
  isGeneratingVideo?: boolean;
  isGeneratingAudio?: boolean;
}

export interface HorrorShortScript {
  title: string;
  concept: string;
  scenes: Scene[];
  productionTips: string;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING_SCRIPT = 'GENERATING_SCRIPT',
  GENERATING_ASSETS = 'GENERATING_ASSETS',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
