

export interface AssetItem {
  id: string;
  type: 'character' | 'scene';
  name: string;
  description?: string; // Visual description extracted from script
  data: string; // base64
  mimeType: string;
  previewUrl: string;
  autoReference?: boolean;
}

export type VideoModel = 'veo_3_1-fast' | 'veo_3_1-fast-4K' | 'veo_3_1' | 'veo_3_1-4K' | 'veo3.1-fast' | 'veo3.1' | 'grok-video-3-10s' | 'grok-video-3-15s' | 'sora-2-all';

export interface AudioItem {
  name?: string;
  prompt: string;
  voice: string;
  url?: string;
  isGenerating?: boolean;
  error?: string;
}

export interface Keyframe {
  prompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
  error?: string;
}

export interface Scene {
  sceneNumber: number;
  episodeNumber?: number;
  script: string;
  visualPrompt: string;
  visualPromptZh?: string; // Chinese visual prompt
  cameraPrompt: string;
  imageUrl?: string; // Base64 (Currently selected image)
  imageHistory?: string[]; // History of generated images (Base64 strings)
  videoUrl?: string; // Deprecated: Use videoUrls[0]
  videoUrls?: string[]; // Array of generated video URLs
  videoPrompt?: string; // Dedicated prompt for video generation (Veo)
  audioPrompt?: string; // Deprecated: Use audios
  audioUrl?: string; // Deprecated: Use audios
  isGeneratingAudio?: boolean; // Deprecated: Use audios
  audioVoice?: string; // Deprecated: Use audios
  audios?: AudioItem[]; // Array of audio items (e.g., 2 per scene)
  videoPromptZh?: string; // Chinese video prompt
  character?: string; // Character name(s) in this scene
  videoDuration?: 8 | 10 | 15; // User preference for video length
  isGeneratingImage?: boolean;
  isGeneratingVideo?: boolean;
  isGeneratingVideoPrompt?: boolean;
  isTranslatingVisual?: boolean; // UI state for translation loading
  isTranslatingVideo?: boolean;  // UI state for translation loading
  error?: string; // Error message for individual scene generation failure
  dialogue?: string; // Added dialogue/narration
  globalParams?: string; // Added global parameters
  keyframes?: Keyframe[]; // Exactly 3 keyframes for 3-panel storyboard
  // Changed from single object to array of objects (max 3)
  sceneReferenceImages?: Array<{
    data: string;
    mimeType: string;
    previewUrl: string;
    analysis?: string; // The reverse-prompted description in Chinese
    isAnalyzing?: boolean; // Loading state for analysis
  } | undefined>;
}

export interface StyleOption {
  id: string;
  name: string;
  description?: string;
  previewUrl?: string;
  promptModifier: string;
  subStyles?: StyleOption[]; // Support for nested styles
}

export enum AppStep {
  MODEL_CONFIG = 'model_config',
  INPUT = 'input',
  SCRIPT_EDIT = 'script_edit',
  ASSETS = 'assets',
  STORYBOARD = 'storyboard',
}

export interface VideoGenerationConfig {
  resolution: '720p' | '1080p';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
}

export interface ScriptCategory {
  id: string;
  name: string;
  description: string;
  templates: ScriptTemplate[];
}

export interface ScriptOption {
  title: string;
  outline: string;
  content: string;
}

export interface SeriesContext {
  isSeries: boolean;
  totalEpisodes: number;
  currentEpisode: number;
  seriesOutline: string;
  previousSummaries: string[];
}

export interface PastEpisode {
  episodeNumber: number;
  scenes: Scene[];
  globalNarration: string;
  globalAudioUrl?: string;
  draftScript: string;
  summary: string;
}
