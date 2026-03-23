

import React, { useState, useRef, useEffect } from 'react';
import { get, set, clear } from 'idb-keyval';
import { AppStep, Scene, StyleOption, AssetItem, ScriptCategory, ScriptTemplate, ScriptOption, VideoModel } from './types';
import { STYLES, SCRIPT_CATEGORIES, getValidDurations } from './constants';
import { generateScript, generateSceneImage, extractAssetsFromScript, setCustomConfig, testApiConnection, generateAssetImage, generateTopicIdeas, generateScriptByScenes, generateAllEpisodes, generateVideo, editSceneImage, generateAudio, generateMissingScenePrompt } from './services/geminiService';
import StepIndicator from './components/StepIndicator';
import StoryboardGrid from './components/StoryboardGrid';
import ScriptEditor from './components/ScriptEditor';
import LoadingOverlay from './components/LoadingOverlay';
import VideoPreview from './components/VideoPreview';
import PricingModal from './components/PricingModal';
import { Sparkles, AlertCircle, Upload, User, Trash2, Plus, Settings, Check, XCircle, Wifi, Clapperboard, BookOpen, Camera, ArrowRight, RefreshCw, MapPin, Wand2, Clock, Maximize2, Download, Monitor, ChevronRight, ChevronDown, PenTool, ShoppingBag, Brain, MessageCircleQuestion, BadgeDollarSign, History, ExternalLink, AlertTriangle, FileText, Database, DollarSign, Loader2, Image, Zap, Link2, Film, Bot, X, Eye, EyeOff, Save, Copy, Music, Box } from 'lucide-react';
import { clsx } from 'clsx';
import { proxyConfig as agentConfig } from './src/proxyConfig';

// Helper for concurrency
async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
) {
  const queue = items.map((item, index) => ({ item, index }));
  const activeWorkers = [];

  for (let i = 0; i < concurrency; i++) {
    activeWorkers.push((async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (task) {
          await fn(task.item, task.index);
        }
      }
    })());
  }

  await Promise.all(activeWorkers);
}

// --- Asset Slot Component (Comic Style) ---
interface AssetSlotProps {
  type: 'character' | 'scene' | 'prop';
  asset: AssetItem;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onClearImage: () => void;
  onNameChange: (name: string) => void;
  onAutoReferenceChange?: (checked: boolean) => void;
  onApplyToAll?: () => void;
  onGenerate: () => void;
  onEnlarge: () => void;
  onDownload: () => void;
  isGenerating: boolean;
  aspectRatio: '9:16' | '16:9';
  error?: string;
}

const AssetSlot: React.FC<AssetSlotProps> = ({ 
    type, asset, onUpload, onRemove, onClearImage, onNameChange, onAutoReferenceChange, 
    onApplyToAll, onGenerate, onEnlarge, onDownload, isGenerating, aspectRatio, error
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = !!(asset && asset.data);

  // Dynamic Aspect Ratio Class - Updated to fill width (make bigger)
  const aspectClass = aspectRatio === '9:16' ? 'aspect-[9/16] w-full' : 'aspect-video w-full';

  return (
    <div className="bg-white border-4 border-dashed border-[#10B981] p-2 flex flex-col gap-2 relative group hover:border-solid transition-all duration-200">
      <div 
        className={`${aspectClass} border-2 border-black bg-gray-100 flex items-center justify-center overflow-hidden relative`}
      >
        {/* Slot Loading Overlay - Semi-transparent Lighter Gray (Updated) */}
        {isGenerating && (
            <div className="absolute inset-0 z-30 bg-gray-600/50 flex flex-col items-center justify-center backdrop-blur-sm">
                <Loader2 className="animate-spin text-[#FACC15] w-10 h-10 mb-3" strokeWidth={3} />
                <span className="font-bangers text-white text-lg tracking-widest animate-pulse">CREATING...</span>
            </div>
        )}

        {hasImage ? (
           <>
             <img 
               src={asset.previewUrl} 
               alt="Asset" 
               className="w-full h-full object-cover cursor-zoom-in" 
               onDoubleClick={onEnlarge}
             />
             {/* Overlay Actions */}
             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-10 p-2">
                 <div className="flex items-center gap-2">
                     <button onClick={onEnlarge} className="p-2 bg-white border-2 border-black hover:bg-gray-100" title="Zoom">
                        <Maximize2 size={16} />
                     </button>
                     <button onClick={onDownload} className="p-2 bg-[#FACC15] border-2 border-black hover:bg-[#EAB308]" title="Download">
                        <Download size={16} />
                     </button>
                 </div>
                 <div className="flex items-center gap-2">
                     <button onClick={onGenerate} disabled={isGenerating} className="p-2 bg-[#3B82F6] text-white border-2 border-black hover:bg-[#2563EB] disabled:opacity-50" title="Regenerate">
                        <RefreshCw size={16} />
                     </button>
                     <button onClick={() => inputRef.current?.click()} className="p-2 bg-white border-2 border-black hover:bg-gray-100" title="Replace">
                        <Upload size={16} />
                     </button>
                 </div>
             </div>
           </>
        ) : (
           <div className="flex flex-col items-center justify-center w-full h-full p-4 gap-3">
             {error ? (
                <div className="text-center w-full">
                    <AlertCircle className="text-red-500 mx-auto mb-2" size={32} />
                    <p className="text-[10px] text-red-600 font-normal mb-2 leading-tight max-h-12 overflow-hidden break-words">{error.length > 50 ? error.substring(0,50) + '...' : error}</p>
                    <button 
                        onClick={onGenerate}
                        className="bg-red-100 text-red-600 px-3 py-1 text-xs font-normal border-2 border-red-500 hover:bg-red-200 uppercase"
                    >
                        RETRY
                    </button>
                </div>
             ) : (
                <>
                 <div className="flex gap-4">
                    <button 
                        onClick={() => onGenerate()}
                        disabled={isGenerating || !asset.name}
                        className="flex flex-col items-center justify-center w-16 h-16 bg-[#FACC15] border-2 border-black hover:-translate-y-1 transition-transform disabled:opacity-50 disabled:translate-y-0"
                        title="Generate"
                    >
                        <Wand2 size={24} className="mb-1" />
                        <span className="text-xs font-normal uppercase">AI</span>
                    </button>
                     <button 
                        onClick={() => inputRef.current?.click()}
                        className="flex flex-col items-center justify-center w-16 h-16 bg-white border-2 border-black hover:-translate-y-1 transition-transform"
                        title="Upload"
                    >
                        <Upload size={24} className="mb-1" />
                        <span className="text-xs font-normal uppercase">UP</span>
                    </button>
                 </div>
                 <div className="text-xs font-normal text-gray-500 text-center uppercase">
                   {asset.name ? 'READY' : 'NAME?'}
                 </div>
                </>
             )}
           </div>
        )}
        <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      </div>
      
      <div className="flex items-center justify-between gap-2 mt-1">
          <span 
            className="flex-1 min-w-0 font-bangers text-lg uppercase text-black truncate"
            title={asset.name || (type === 'character' ? "UNNAMED" : "UNNAMED")}
          >
            {asset.name || (type === 'character' ? "UNNAMED" : "UNNAMED")}
            {asset.occurrences !== undefined && <span className="text-sm text-gray-500 ml-1 font-sans">(出现{asset.occurrences}次)</span>}
          </span>
          <label className="flex items-center gap-1.5 text-xs font-normal cursor-pointer select-none hover:text-black text-gray-600 group/chk shrink-0">
              <div className={clsx("w-4 h-4 border-2 border-black flex items-center justify-center transition-colors", asset.autoReference !== false ? "bg-[#10B981]" : "bg-white")}>
                  {asset.autoReference !== false && <Check size={12} className="text-black" strokeWidth={3} />}
              </div>
              <input type="checkbox" checked={asset.autoReference !== false} onChange={(e) => onAutoReferenceChange?.(e.target.checked)} className="hidden" />
              <span className="tracking-wide">自动引用</span>
          </label>
      </div>
    </div>
  );
}

const isAssetInScene = (assetName: string, scene: Scene, isCharacter: boolean = false) => {
  if (!assetName) return false;
  const name = assetName.toLowerCase();
  
  const script = (scene.script || "").toLowerCase();
  const visual = (scene.visualPrompt || "").toLowerCase();
  const video = (scene.videoPrompt || "").toLowerCase();
  const character = (scene.character || "").toLowerCase();

  if (script.includes(name) || visual.includes(name) || video.includes(name)) {
      return true;
  }
  
  if (isCharacter) {
      // 增强：处理集体称呼，确保“一家三口”、“一家人”、“三人”等词汇能正确关联到已定义的角色
      const collectiveTerms = ['一家三口', '一家人', '三人', '全家人', '全家', '父母女儿', '父女', '母女', '夫妻', '一家', '三人行', '大家', '众人'];
      if (collectiveTerms.some(term => script.includes(term) || visual.includes(term) || video.includes(term) || character.includes(term))) {
          return true;
      }

      if (scene.character) {
          const charNames = scene.character.split(/[,，、\s]+/).map(n => n.trim().toLowerCase()).filter(Boolean);
          if (charNames.some(n => name.includes(n) || n.includes(name))) {
              return true;
          }
      }
  }
  
  return false;
};

function App() {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [topic, setTopic] = useState('');
  
  // Style Selection State
  const [selectedStylePath, setSelectedStylePath] = useState<StyleOption[]>([]);
  // Custom Style State
  const [showCustomStyleModal, setShowCustomStyleModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // New State for Step 1 (Templates)
  // Default to the first category (Story) since others were removed
  const [selectedCategory, setSelectedCategory] = useState<ScriptCategory | null>(SCRIPT_CATEGORIES[0]);
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);

  // New State for Topic Suggestions
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);

  // Video Duration & Aspect Ratio State (Replaces Scene Count)
  const [episodeCount, setEpisodeCount] = useState<string>('');
  const [episodeDuration, setEpisodeDuration] = useState<string>('10–20秒');
  const [videoDuration, setVideoDuration] = useState<8 | 10 | 15>(8); 
  const [sceneCount, setSceneCount] = useState<number>(5); 
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');

  const [scriptOptions, setScriptOptions] = useState<ScriptOption[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [totalEpisodes, setTotalEpisodes] = useState(1);
  const [regeneratingOptions, setRegeneratingOptions] = useState<number[]>([]); 

  const [episodesScenes, setEpisodesScenes] = useState<Record<number, Scene[]>>({});
  const [episodesNarration, setEpisodesNarration] = useState<Record<number, string>>({});
  const [episodesAudioUrl, setEpisodesAudioUrl] = useState<Record<number, string>>({});
  const [episodesScript, setEpisodesScript] = useState<Record<number, string>>({});
  
  const scenes = episodesScenes[currentEpisode] || [];
  const globalNarration = episodesNarration[currentEpisode] || '';
  const globalAudioUrl = episodesAudioUrl[currentEpisode];
  const draftScript = episodesScript[currentEpisode] || '';

  const setScenes = (newScenes: Scene[] | ((prev: Scene[]) => Scene[])) => {
    setEpisodesScenes(prev => ({
        ...prev,
        [currentEpisode]: typeof newScenes === 'function' ? (newScenes as (prev: Scene[]) => Scene[])(prev[currentEpisode] || []) : newScenes
    }));
  };

  const setGlobalNarration = (narration: string) => {
    setEpisodesNarration(prev => ({ ...prev, [currentEpisode]: narration }));
  };

  const setGlobalAudioUrl = (url: string | undefined) => {
    if (url) {
        setEpisodesAudioUrl(prev => ({ ...prev, [currentEpisode]: url }));
    } else {
        setEpisodesAudioUrl(prev => {
            const next = { ...prev };
            delete next[currentEpisode];
            return next;
        });
    }
  };

  const setDraftScript = (script: string) => {
    setEpisodesScript(prev => ({ ...prev, [currentEpisode]: script }));
  };
  
  const [isGeneratingGlobalAudio, setIsGeneratingGlobalAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Config Modal State - Initialize from LocalStorage
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiKey2, setShowApiKey2] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('viva_api_key') || '');
  const [apiKey2Input, setApiKey2Input] = useState(() => localStorage.getItem('viva_api_key_2') || '');
  const [activeKeyIndex, setActiveKeyIndex] = useState(() => parseInt(localStorage.getItem('viva_active_key_index') || '1'));
  const [baseUrlInput, setBaseUrlInput] = useState(() => localStorage.getItem('viva_base_url') || agentConfig.baseUrl);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
  // Model Config State
  const [isConfigConfirmed, setIsConfigConfirmed] = useState(() => localStorage.getItem('is_config_confirmed') === 'true');
  
  useEffect(() => {
    localStorage.setItem('is_config_confirmed', isConfigConfirmed.toString());
  }, [isConfigConfirmed]);

  useEffect(() => {
    document.title = agentConfig.appName;
  }, []);
  
  const [textModel, setTextModel] = useState<string>('gemini-3.1-flash-lite-preview');
  const [assetModel, setAssetModel] = useState<string>('gemini-3.1-flash-image-preview');
  const [videoModel, setVideoModel] = useState<VideoModel>('veo_3_1-fast');
  const [audioModel, setAudioModel] = useState<string>('gemini-2.5-pro-preview-tts');

  // Helper to calculate scene count based on total duration string and per-scene duration
  const updateSceneCountFromTotal = (totalStr: string, perScene: number) => {
    const match = totalStr.match(/(\d+)[–-](\d+)秒/);
    if (match) {
      const max = parseInt(match[2]);
      // For dynamic comics, we want high density.
      // 10-20s -> 5-7 scenes.
      // We target roughly one scene every 2.5 - 3 seconds.
      const calculatedCount = Math.ceil(max / 3) + 1; 
      setSceneCount(Math.max(5, calculatedCount));
    }
  };

  // Sync videoDuration with videoModel and adjust sceneCount based on priority
  useEffect(() => {
    const validDurations = getValidDurations(videoModel);
    let activeDuration = videoDuration;
    
    if (!validDurations.includes(videoDuration)) {
      activeDuration = validDurations[0];
      setVideoDuration(activeDuration);
    }
    
    if (episodeDuration) {
      updateSceneCountFromTotal(episodeDuration, activeDuration);
    }
  }, [videoModel, videoDuration, episodeDuration]);
  
  // Support Modal State
  const [showSupportModal, setShowSupportModal] = useState(false);


  // Pricing Modal State
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Dynamic Assets State
  const [characters, setCharacters] = useState<AssetItem[]>([]);
  const [coreScenes, setCoreScenes] = useState<AssetItem[]>([]);
  const [propsList, setPropsList] = useState<AssetItem[]>([]);
  
  // Generating IDs (Using Set for multiple simultaneous generations)
  const [generatingAssetIds, setGeneratingAssetIds] = useState<Set<string>>(new Set());
  // Asset Errors State
  const [assetErrors, setAssetErrors] = useState<Record<string, string>>({});

  // Lightbox State
  const [viewingAsset, setViewingAsset] = useState<AssetItem | null>(null);

  // Cancellation Reference for Global Loading
  const loadingSession = useRef(0);
  const generateTopicsSession = useRef(0);
  
  // AbortControllers for Video Generation
  const videoControllers = useRef<Record<number, AbortController>>({});

  // --- State Persistence ---
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await get('viva_app_state');
        if (savedState) {
          if (savedState.step !== undefined) setStep(savedState.step);
          if (savedState.topic !== undefined) setTopic(savedState.topic);
          if (savedState.selectedStylePath !== undefined) setSelectedStylePath(savedState.selectedStylePath);
          if (savedState.selectedCategory !== undefined) setSelectedCategory(savedState.selectedCategory);
          if (savedState.selectedTemplate !== undefined) setSelectedTemplate(savedState.selectedTemplate);
          if (savedState.episodeCount !== undefined) setEpisodeCount(savedState.episodeCount);
          if (savedState.episodeDuration !== undefined) setEpisodeDuration(savedState.episodeDuration);
          if (savedState.videoDuration !== undefined) setVideoDuration(savedState.videoDuration);
          if (savedState.sceneCount !== undefined) setSceneCount(savedState.sceneCount);
          if (savedState.aspectRatio !== undefined) setAspectRatio(savedState.aspectRatio);
          if (savedState.draftScript !== undefined) setDraftScript(savedState.draftScript);
          if (savedState.scriptOptions !== undefined) setScriptOptions(savedState.scriptOptions);
          if (savedState.scenes !== undefined) {
            const resetScenes = savedState.scenes.map((scene: Scene) => ({
              ...scene,
              isGeneratingImage: false,
              isGeneratingVideo: false,
              isGeneratingVideoPrompt: false,
              isTranslatingVisual: false,
              isTranslatingVideo: false,
              audios: scene.audios?.map(audio => ({ ...audio, isGenerating: false }))
            }));
            setScenes(resetScenes);
          }
          if (savedState.textModel !== undefined) setTextModel(savedState.textModel);
          if (savedState.assetModel !== undefined) setAssetModel(savedState.assetModel);
          if (savedState.videoModel !== undefined) setVideoModel(savedState.videoModel);
          if (savedState.audioModel !== undefined) setAudioModel(savedState.audioModel);
          if (savedState.characters !== undefined) setCharacters(savedState.characters);
          if (savedState.coreScenes !== undefined) setCoreScenes(savedState.coreScenes);
          if (savedState.globalNarration !== undefined) setGlobalNarration(savedState.globalNarration);
          if (savedState.globalAudioUrl !== undefined) setGlobalAudioUrl(savedState.globalAudioUrl);
        }
      } catch (e) {
        console.error('Failed to load state', e);
      } finally {
        setIsStateLoaded(true);
      }
    };
    loadState();
  }, []);

  useEffect(() => {
    if (!isStateLoaded) return;
    const stateToSave = {
      step,
      topic,
      selectedStylePath,
      selectedCategory,
      selectedTemplate,
      episodeCount,
      episodeDuration,
      videoDuration,
      sceneCount,
      aspectRatio,
      draftScript,
      scriptOptions,
      episodesScenes,
      episodesNarration,
      episodesAudioUrl,
      episodesScript,
      textModel,
      assetModel,
      videoModel,
      audioModel,
      characters,
      coreScenes
    };
    
    const timeoutId = setTimeout(() => {
      set('viva_app_state', stateToSave).catch(e => console.error('Failed to save state', e));
    }, 1000); // 1 second debounce
    
    return () => clearTimeout(timeoutId);
  }, [isStateLoaded, step, topic, selectedStylePath, selectedCategory, selectedTemplate, videoDuration, sceneCount, aspectRatio, episodesScript, scriptOptions, episodesScenes, textModel, assetModel, videoModel, audioModel, characters, coreScenes, episodesNarration, episodesAudioUrl]);

  // Calculate Reachable Steps
  const enabledSteps = [AppStep.MODEL_CONFIG, AppStep.INPUT, AppStep.SCRIPT_EDIT, AppStep.ASSETS, AppStep.STORYBOARD];

  // Navigation Logic
  const handleStepClick = (targetStep: AppStep) => {
    setStep(targetStep);
  };

  // Helper to get active style modifier string
  const getFullStyleModifier = () => {
      const topStyle = selectedStylePath[0];
      if (!topStyle) return '';
      // Combine all modifiers in the path
      return selectedStylePath.map(s => s.promptModifier).join(' ');
  };

  const handleStyleSelect = (style: StyleOption, level: number) => {
      if (style.id === 'custom') {
          setCustomName('');
          setCustomPrompt('');
          setShowCustomStyleModal(true);
          return;
      }
      // Create new path up to this level
      const newPath = [...selectedStylePath.slice(0, level), style];
      setSelectedStylePath(newPath);
  };

  const saveCustomStyle = () => {
      if (!customName.trim() || !customPrompt.trim()) return;
      const customStyleOption: StyleOption = {
          id: 'custom_user',
          name: customName,
          description: 'User Custom Style',
          promptModifier: `Style: ${customPrompt}`,
          previewUrl: 'https://picsum.photos/seed/custom/300/200'
      };
      // Set the custom style as selected (replacing 'custom' placeholder logic)
      setSelectedStylePath([customStyleOption]);
      setShowCustomStyleModal(false);
  };

  // Check if current style selection is complete (is a leaf node)
  const isStyleSelectionComplete = () => {
      if (selectedStylePath.length === 0) return false;
      const lastStyle = selectedStylePath[selectedStylePath.length - 1];
      // If it has subStyles, we are not done yet
      if (lastStyle.subStyles && lastStyle.subStyles.length > 0) return false;
      return true;
  };

  // --- Asset Management Logic ---
  const addAssetSlot = (type: 'character' | 'scene' | 'prop', name: string = '') => {
      const newItem: AssetItem = { id: Date.now().toString() + Math.random(), type, name, data: '', mimeType: '', previewUrl: '', autoReference: true };
      if (type === 'character') setCharacters([...characters, newItem]);
      if (type === 'scene') setCoreScenes([...coreScenes, newItem]);
      if (type === 'prop') setPropsList([...propsList, newItem]);
  };

  // Safe update using functional state to prevent stale closures
  const updateAsset = (setList: React.Dispatch<React.SetStateAction<AssetItem[]>>, id: string, updates: Partial<AssetItem>) => {
      setList(prevList => prevList.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeAsset = (setList: React.Dispatch<React.SetStateAction<AssetItem[]>>, id: string) => {
      if (!window.confirm("确定要删除该元素吗？(此操作不可撤销)")) return;
      setList(prevList => prevList.filter(item => item.id !== id));
  };

  const clearAssetImage = (setList: React.Dispatch<React.SetStateAction<AssetItem[]>>, id: string) => {
      if (!window.confirm("确定要删除该生成的图片吗？")) return;
      updateAsset(setList, id, { data: '', mimeType: '', previewUrl: '' });
  };

  const handleAssetUpload = (setList: React.Dispatch<React.SetStateAction<AssetItem[]>>, id: string, file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          const result = reader.result as string;
          const matches = result.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
              updateAsset(setList, id, { mimeType: matches[1], data: matches[2], previewUrl: result });
              // Clear error if upload successful
              setAssetErrors(prev => {
                  const next = {...prev};
                  delete next[id];
                  return next;
              });
          }
      };
      reader.readAsDataURL(file);
  };
  
  const handleAssetGenerate = async (list: AssetItem[], setList: React.Dispatch<React.SetStateAction<AssetItem[]>>, id: string) => {
      const asset = list.find(i => i.id === id);
      if (!asset) return;
      if (!asset.name.trim()) { alert("请先输入元素名称"); return; }
      
      const stylePrompt = getFullStyleModifier();

      // Clear previous error
      setAssetErrors(prev => {
          const next = {...prev};
          delete next[asset.id];
          return next;
      });

      setGeneratingAssetIds(prev => new Set(prev).add(asset.id));
      try {
          // Find other scene assets with images to use as references for consistency
          const otherSceneRefs = list
              .filter(item => item.id !== id && item.type === 'scene' && item.data)
              .map(item => ({ data: item.data, mimeType: item.mimeType || 'image/png' }));

          const base64 = await generateAssetImage(asset.name, asset.type, stylePrompt, '16:9', asset.description, assetModel, otherSceneRefs);
          updateAsset(setList, id, { mimeType: 'image/png', data: base64, previewUrl: `data:image/png;base64,${base64}` });
      } catch (e: any) {
          setAssetErrors(prev => ({...prev, [asset.id]: e.message}));
      } finally {
          setGeneratingAssetIds(prev => {
              const next = new Set(prev);
              next.delete(asset.id);
              return next;
          });
      }
  };

  const handleBatchGenerateAssets = async (
      list: AssetItem[], 
      setList: React.Dispatch<React.SetStateAction<AssetItem[]>>,
      categoryName: string
  ) => {
      const targets = list.filter(item => !item.data && (item.occurrences === undefined || item.occurrences >= 2));

      if (targets.length === 0) {
          alert(`所有符合条件（出现次数≥2）的${categoryName}已有图片，或没有需要生成的元素。`);
          return;
      }

      const stylePrompt = getFullStyleModifier();

      setGeneratingAssetIds(prev => {
          const next = new Set(prev);
          targets.forEach(t => next.add(t.id));
          return next;
      });

      // Clear errors for targets
      setAssetErrors(prev => {
          const next = {...prev};
          targets.forEach(t => delete next[t.id]);
          return next;
      });

      // Use Concurrent Execution for batch generation
      await runConcurrent(targets, 3, async (asset) => {
          try {
              // For batch generation, we also want to look at what's already there
              // Note: this might not be perfect as some are being generated in parallel
              // but it's better than nothing.
              const otherSceneRefs = list
                  .filter(item => item.id !== asset.id && item.type === 'scene' && item.data)
                  .map(item => ({ data: item.data, mimeType: item.mimeType || 'image/png' }));

              const base64 = await generateAssetImage(asset.name, asset.type, stylePrompt, '16:9', asset.description, assetModel, otherSceneRefs);
              
              setList(currentList => {
                  return currentList.map(item => item.id === asset.id ? { 
                      ...item, 
                      mimeType: 'image/png', 
                      data: base64, 
                      previewUrl: `data:image/png;base64,${base64}` 
                  } : item);
              });
          } catch (e: any) {
              console.error(`Failed to generate ${asset.name}`, e);
              setAssetErrors(prev => ({...prev, [asset.id]: e.message}));
          } finally {
              setGeneratingAssetIds(prev => {
                  const next = new Set(prev);
                  next.delete(asset.id);
                  return next;
              });
          }
      });
  };

  const currentScriptTitle = scriptOptions[currentEpisode - 1]?.title || topic;

  const handleDownloadAsset = (asset: AssetItem) => {
      if (!asset.data) return;
      const link = document.createElement('a');
      link.href = asset.previewUrl;
      const fileName = currentScriptTitle ? `${currentScriptTitle.replace(/\s+/g, '_')}_${asset.name.replace(/\s+/g, '_')}` : `${asset.name.replace(/\s+/g, '_')}_${asset.type}`;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleApplyAssetToAll = (name: string) => {
    if (!name.trim()) return;
    if (window.confirm(`Add character "${name}" to all scenes for consistency?`)) {
        const updatedScenes = scenes.map(s => ({
            ...s,
            visualPrompt: s.visualPrompt + `, ${name}, consistent character`,
            visualPromptZh: (s.visualPromptZh || '') + `, ${name}, 角色一致`
        }));
        setScenes(updatedScenes);
        alert(`Done! "${name}" added to all prompts.`);
    }
  };

  // --- Video Generation Handlers ---
  const handleGenerateVideo = async (sceneIndex: number, duration: number, model: VideoModel) => {
    const scene = scenes[sceneIndex];
    if (!scene.imageUrl) return;

    if (videoControllers.current[sceneIndex]) {
      videoControllers.current[sceneIndex].abort();
    }
    const controller = new AbortController();
    videoControllers.current[sceneIndex] = controller;

    setScenes(prev => {
      const next = [...prev];
      next[sceneIndex] = { ...next[sceneIndex], isGeneratingVideo: true, error: undefined };
      return next;
    });

    try {
      let prompt = scene.videoPrompt || scene.visualPrompt || scene.script;
      
      // Filter characters to only include those mentioned in this scene to improve consistency
      const sceneCharacters = characters.filter(c => isAssetInScene(c.name, scene, true));

      if (sceneCharacters.length > 0) {
          prompt += `\n\n[Character Visual Mapping - Use this to identify characters in the image]`;
          sceneCharacters.forEach(c => {
              if (c.description) {
                  prompt += `\n- ${c.name}: ${c.description}`;
              } else {
                  prompt += `\n- ${c.name}`;
              }
          });
      }
      
      prompt += `\n\nCRITICAL INSTRUCTIONS: 
1. Identify the characters in the provided image based on the [Character Visual Mapping].
2. Ensure the actions described for each character are performed ONLY by that specific character.
3. Characters MUST NOT speak. Do not generate any lip movements or speech.`;
      
      if (scene.globalParams) {
        prompt += `\n\n[Global Environment Settings]`;
        prompt += `\n${scene.globalParams}`;
      }
      
      const videoUrl = await generateVideo(
        scene.imageUrl,
        prompt,
        aspectRatio,
        duration,
        controller.signal,
        model
      );

      setScenes(prev => {
        const next = [...prev];
        const existingUrls = next[sceneIndex].videoUrls || [];
        next[sceneIndex] = {
          ...next[sceneIndex],
          isGeneratingVideo: false,
          videoUrl: videoUrl,
          videoUrls: [videoUrl, ...existingUrls]
        };
        return next;
      });
    } catch (e: any) {
      if (e.message === 'Aborted') return;
      console.error("Video Generation Error", e);
      setScenes(prev => {
        const next = [...prev];
        next[sceneIndex] = { ...next[sceneIndex], isGeneratingVideo: false, error: e.message || "Video generation failed" };
        return next;
      });
    } finally {
      delete videoControllers.current[sceneIndex];
    }
  };

  const handleCancelVideoGeneration = (sceneIndex: number) => {
      // Abort the ongoing request if exists
      if (videoControllers.current[sceneIndex]) {
          videoControllers.current[sceneIndex].abort();
          delete videoControllers.current[sceneIndex];
      }

      // Force update UI state immediately
      setScenes(prev => {
          const next = [...prev];
          next[sceneIndex] = { ...next[sceneIndex], isGeneratingVideo: false, error: "Cancelled by user" };
          return next;
      });
  };

  const handleGenerateAudio = async (sceneIndex: number, prompt: string, voiceConfig: { voiceName?: string; multiSpeakerVoiceConfig?: { speakerVoiceConfigs: { speaker: string; voiceName: string }[] } }) => {
    console.log(`Generating audio for scene ${sceneIndex} with prompt: ${prompt}, voiceConfig:`, voiceConfig);
    const scene = scenes[sceneIndex];
    try {
        setScenes(prev => {
            const next = [...prev];
            next[sceneIndex] = { ...next[sceneIndex], isGeneratingAudio: true, error: undefined };
            return next;
        });
        const audioUrl = await generateAudio(prompt, voiceConfig, audioModel, scene.videoDuration);
        setScenes(prev => {
            const next = [...prev];
            next[sceneIndex] = { ...next[sceneIndex], isGeneratingAudio: false, audioUrl: audioUrl };
            return next;
        });
    } catch (error) {
        console.error("Failed to generate audio:", error);
        setScenes(prev => {
            const next = [...prev];
            next[sceneIndex] = { ...next[sceneIndex], isGeneratingAudio: false, error: "Failed to generate audio" };
            return next;
        });
    }
  };

  // --- Core Logic ---

  const handleGenerateTopics = async () => {
    if (!selectedCategory || !selectedTemplate) return;
    
    if (isGeneratingTopics) {
        // Cancel the current generation
        generateTopicsSession.current++;
        setIsGeneratingTopics(false);
        return;
    }

    const sessionId = ++generateTopicsSession.current;
    setIsGeneratingTopics(true);
    try {
        const ideas = await generateTopicIdeas(selectedCategory.name, selectedTemplate.name, selectedTemplate.description, "", textModel);
        if (generateTopicsSession.current !== sessionId) return; // Cancelled
        
        setTopicSuggestions(ideas);
        // Auto-fill random idea
        if (ideas.length > 0) {
            const randomIndex = Math.floor(Math.random() * ideas.length);
            setTopic(ideas[randomIndex]);
        }
    } catch (e: any) {
        if (generateTopicsSession.current !== sessionId) return; // Cancelled
        alert("Failed to generate ideas: " + e.message);
    } finally {
        if (generateTopicsSession.current === sessionId) {
            setIsGeneratingTopics(false);
        }
    }
  };

  const handleStartCreation = async () => {
    if (!topic.trim() || !selectedTemplate || selectedStylePath.length === 0) return;

    const stylePrompt = getFullStyleModifier();
    let styleNameCn = selectedStylePath.map(s => s.name).join(' + ');

    const sessionId = ++loadingSession.current;
    setLoading(true);
    setLoadingMessage(`AI is writing and optimizing your script for all episodes...`);
    setError(null);
    try {
        const result = await generateAllEpisodes(topic, stylePrompt, styleNameCn, selectedTemplate!.name, selectedTemplate!.description, episodeDuration, parseInt(episodeCount) || 1, sceneCount, aspectRatio, textModel);
        if (loadingSession.current !== sessionId) return;

        const newEpisodesScript: Record<number, string> = {};
        const newScriptOptions: ScriptOption[] = [];

        result.episodes.forEach((ep, index) => {
            const epNum = index + 1;
            newEpisodesScript[epNum] = ep.content;
            newScriptOptions.push({ title: ep.title, outline: `${sceneCount} scenes`, content: ep.content });
        });

        setEpisodesScript(newEpisodesScript);
        setScriptOptions(newScriptOptions);
        setEpisodesScenes({});
        setEpisodesNarration({});
        setEpisodesAudioUrl({});
        setCurrentEpisode(1);
        setTotalEpisodes(result.episodes.length);
        
        // Reset downstream state
        setCharacters([]);
        setCoreScenes([]);
        setAssetErrors({});

        setStep(AppStep.SCRIPT_EDIT);
    } catch (err: any) {
        if (loadingSession.current !== sessionId) return;
        setError(err.message || 'Script generation failed.');
    } finally {
        if (loadingSession.current === sessionId) setLoading(false);
    }
  };

  const handleGenerateEpisodeStoryboard = async (episodeNum: number) => {
      const scriptText = episodesScript[episodeNum];
      if (!scriptText) {
          console.error(`No script found for episode ${episodeNum}`);
          setError(`No script found for episode ${episodeNum}. Please go back and generate the script first.`);
          return;
      }

      const stylePrompt = getFullStyleModifier();
      const cleanTopic = topic.split(' 一句话简介：')[0];

      const sessionId = ++loadingSession.current;
      setLoading(true);
      setLoadingMessage(`Extracting scenes for episode ${episodeNum}...`);
      setError(null);
      try {
          const { scenes: generatedScenes, narration: extractedNarration } = await generateScript(scriptText, stylePrompt, characters.map(c => c.name), cleanTopic);
          
          if (loadingSession.current !== sessionId) return;

          if (!generatedScenes || generatedScenes.length === 0) {
              throw new Error(`Failed to extract scenes for episode ${episodeNum}. The script format might be incorrect.`);
          }

          setEpisodesNarration(prev => ({ ...prev, [episodeNum]: extractedNarration }));
          
          const scenesWithDuration = generatedScenes.map(s => ({ 
              ...s, 
              videoDuration: videoDuration as 8 | 10 | 15,
              isGeneratingImage: true,
              error: undefined,
              videoUrls: [],
              videoUrl: undefined
          }));
          
          setEpisodesScenes(prev => ({ ...prev, [episodeNum]: scenesWithDuration }));
          setCurrentEpisode(episodeNum);
          
          // Go directly to storyboard and start generating images
          setStep(AppStep.STORYBOARD);
          setLoadingMessage(`Drawing ${scenesWithDuration.length} frames for episode ${episodeNum}...`);
          
          // Use concurrent execution
          await runConcurrent<Scene>(scenesWithDuration, 3, async (scene, i) => {
              if (loadingSession.current !== sessionId) return;
              try {
                  const promptToUse = scene.visualPrompt || scene.script;
                  const sceneCharacters = characters.filter(c => isAssetInScene(c.name, scene, true));

                  const sceneLocations = coreScenes.filter(s => isAssetInScene(s.name, scene, false));
                  
                  const previousSceneContext = i > 0 ? (scenesWithDuration[i-1].visualPrompt || scenesWithDuration[i-1].script) : undefined;
                  const episodeNarration = episodesNarration[episodeNum] || '';
                  const sceneNarration = episodeNarration.split('\n')[i] || '';

                  const b64 = await generateSceneImage(promptToUse, scene.cameraPrompt || '', sceneCharacters, sceneLocations.length > 0 ? sceneLocations : coreScenes, aspectRatio, scene.sceneReferenceImages || [], assetModel, getFullStyleModifier(), previousSceneContext, sceneNarration);
                  
                  if (loadingSession.current !== sessionId) return;

                  setEpisodesScenes(prev => {
                      const updated = [...(prev[episodeNum] || [])];
                      if (updated[i]) {
                          updated[i] = { 
                              ...updated[i], 
                              imageUrl: b64, 
                              isGeneratingImage: false, 
                              error: undefined 
                          };
                      }
                      return { ...prev, [episodeNum]: updated };
                  });
              } catch (err: any) {
                   if (loadingSession.current !== sessionId) return;
                   console.error(`Error generating scene ${i + 1} for episode ${episodeNum}`, err);
                   setEpisodesScenes(prev => {
                      const updated = [...(prev[episodeNum] || [])];
                      if (updated[i]) {
                          updated[i] = { ...updated[i], isGeneratingImage: false, error: "Generation Failed" };
                      }
                      return { ...prev, [episodeNum]: updated };
                  });
              }
          });

      } catch (err: any) {
          if (loadingSession.current !== sessionId) return;
          console.error(`Error in handleGenerateEpisodeStoryboard for episode ${episodeNum}:`, err);
          setError(err.message || 'Scene extraction failed.');
      } finally {
          if (loadingSession.current === sessionId) setLoading(false);
      }
  };

  const handleFinalizeScript = async (finalScriptText: string) => {
      if (selectedStylePath.length === 0) { setError("No style selected"); return; }
      
      const stylePrompt = getFullStyleModifier();

      const sessionId = ++loadingSession.current;
      setLoading(true);
      setLoadingMessage('Finalizing script & extracting assets...');
      setError(null);
      try {
          setDraftScript(finalScriptText);
          // Clean topic: remove "一句话简介" and "标签"
          const cleanTopic = topic.split(' 一句话简介：')[0];
          const { scenes: generatedScenes, narration: extractedNarration } = await generateScript(finalScriptText, stylePrompt, characters.map(c => c.name), cleanTopic);
          setGlobalNarration(extractedNarration);
          
          // Extract assets from all episodes
          const allScenesScripts = generatedScenes.map(s => s.script).join('\n\n');
          const extraction = await extractAssetsFromScript(allScenesScripts);
          
          if (loadingSession.current !== sessionId) return;

          const countOccurrences = (text: string, word: string) => {
              if (!word) return 0;
              // Escape special characters in word for regex
              const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(escapedWord, 'gi');
              return (text.match(regex) || []).length;
          };

          const newCharacters = extraction.characters
              .filter(item => {
                  const n = item.name.toLowerCase();
                  return n !== '旁白' && !n.includes('声音') && !n.includes('旁白') && !n.includes('音效') && !n.includes('配音');
              })
              .map((item, i) => ({ id: `c-ext-${Date.now()}-${i}`, type: 'character' as const, name: item.name, description: item.description, data: '', mimeType: '', previewUrl: '', autoReference: true, occurrences: countOccurrences(allScenesScripts, item.name) }));
          const newCoreScenes = extraction.scenes.map((item, i) => ({ id: `s-ext-${Date.now()}-${i}`, type: 'scene' as const, name: item.name, description: item.description, data: '', mimeType: '', previewUrl: '', autoReference: true, occurrences: countOccurrences(allScenesScripts, item.name) }));
          const newProps = (extraction.props || []).map((item, i) => ({ id: `p-ext-${Date.now()}-${i}`, type: 'prop' as const, name: item.name, description: item.description, data: '', mimeType: '', previewUrl: '', autoReference: true, occurrences: countOccurrences(allScenesScripts, item.name) }));

          // Merge characters
          setCharacters(prev => {
              const merged = [...prev];
              newCharacters.forEach(nc => {
                  const existingIndex = merged.findIndex(ec => ec.name.toLowerCase() === nc.name.toLowerCase());
                  if (existingIndex === -1) {
                      merged.push(nc);
                  } else {
                      merged[existingIndex].occurrences = nc.occurrences;
                  }
              });
              return merged;
          });

          // Merge scenes
          setCoreScenes(prev => {
              const merged = [...prev];
              newCoreScenes.forEach(ns => {
                  const existingIndex = merged.findIndex(es => es.name.toLowerCase() === ns.name.toLowerCase());
                  if (existingIndex === -1) {
                      merged.push(ns);
                  } else {
                      merged[existingIndex].occurrences = ns.occurrences;
                  }
              });
              return merged;
          });

          // Merge props
          setPropsList(prev => {
              const merged = [...prev];
              newProps.forEach(np => {
                  const existingIndex = merged.findIndex(ep => ep.name.toLowerCase() === np.name.toLowerCase());
                  if (existingIndex === -1) {
                      merged.push(np);
                  } else {
                      merged[existingIndex].occurrences = np.occurrences;
                  }
              });
              return merged;
          });

          setAssetErrors({});
          
          if (extraction.characters.length === 0) addAssetSlot('character');
          if (extraction.scenes.length === 0) addAssetSlot('scene');
          if ((extraction.props || []).length === 0) addAssetSlot('prop');

          // Initialize scenes with selected video duration
          const scenesWithDuration = generatedScenes.map(s => ({ ...s, videoDuration: videoDuration as 8 | 10 | 15 }));
          setScenes(scenesWithDuration);
          setStep(AppStep.ASSETS);

      } catch (err: any) {
          if (loadingSession.current !== sessionId) return;
          setError(err.message || 'Finalization failed.');
      } finally {
          if (loadingSession.current === sessionId) setLoading(false);
      }
  };

  const handleGenerateStoryboard = async () => {
    const sessionId = ++loadingSession.current;
    // Removed setLoading(true) to skip the "AI IS WORKING" screen
    setError(null);
    setStep(AppStep.STORYBOARD);
    
    // Set all to generating initially, and CLEAR OLD VIDEOS as image will change
    setScenes(prev => prev.map(s => ({ 
        ...s, 
        isGeneratingImage: true, 
        error: undefined,
        videoUrls: [], // CRITICAL: Clear videos because start frame changed
        videoUrl: undefined 
    })));

    try {
        // Use concurrent execution (limit to 3 for rate limits)
        await runConcurrent<Scene>(scenes, 3, async (scene, i) => {
            if (loadingSession.current !== sessionId) return;
            try {
                // FIXED: Use visualPrompt || script to prioritize specialized prompt
                const promptToUse = scene.visualPrompt || scene.script;
                
                // Filter characters to only include those mentioned in this scene to improve consistency
                const sceneCharacters = characters.filter(c => isAssetInScene(c.name, scene, true));

                const sceneLocations = coreScenes.filter(s => isAssetInScene(s.name, scene, false));
                
                const previousSceneContext = i > 0 ? (scenes[i-1].visualPrompt || scenes[i-1].script) : undefined;
                const sceneNarration = globalNarration ? globalNarration.split('\n')[i] || '' : '';

                const b64 = await generateSceneImage(promptToUse, scene.cameraPrompt || '', sceneCharacters, sceneLocations.length > 0 ? sceneLocations : coreScenes, aspectRatio, scene.sceneReferenceImages || [], assetModel, getFullStyleModifier(), previousSceneContext, sceneNarration);
                
                if (loadingSession.current !== sessionId) return;

                setScenes(current => {
                    const updated = [...current];
                    updated[i] = { 
                        ...updated[i], 
                        imageUrl: b64, 
                        imageHistory: [b64], 
                        isGeneratingImage: false, 
                        error: undefined 
                    };
                    return updated;
                });
            } catch (err: any) {
                 if (loadingSession.current !== sessionId) return;
                 console.error(`Error generating scene ${i + 1}`, err);
                 setScenes(current => {
                    const updated = [...current];
                    updated[i] = { ...updated[i], isGeneratingImage: false, error: "Generation Failed" };
                    return updated;
                });
            }
        });

    } catch (err: any) {
        if (loadingSession.current !== sessionId) return;
        setError('Storyboard process error: ' + err.message);
    }
  };

  const handleRegenerateImage = async (index: number) => {
      setScenes(prev => {
          const next = [...prev];
          next[index] = { 
            ...next[index], 
            isGeneratingImage: true, 
            error: undefined,
            videoUrls: [], // Clear video since frame changed
            videoUrl: undefined 
          };
          return next;
      });
      try {
          const scene = scenes[index];
          const refScenesRaw = scene.sceneReferenceImages || [];
          // Redraw Logic: prefers visualPrompt
          const promptToUse = scene.visualPrompt || scene.script;
          
          const sceneCharacters = characters.filter(c => isAssetInScene(c.name, scene, true));

          const sceneLocations = coreScenes.filter(s => isAssetInScene(s.name, scene, false));

          const previousSceneContext = index > 0 ? (scenes[index-1].visualPrompt || scenes[index-1].script) : undefined;
          const sceneNarration = globalNarration ? globalNarration.split('\n')[index] || '' : '';

          const b64 = await generateSceneImage(promptToUse, scene.cameraPrompt, sceneCharacters, sceneLocations.length > 0 ? sceneLocations : coreScenes, aspectRatio, refScenesRaw, assetModel, getFullStyleModifier(), previousSceneContext, sceneNarration);
          setScenes(prev => {
              const next = [...prev];
              next[index] = { ...next[index], imageUrl: b64, imageHistory: [...(next[index].imageHistory || []), b64], isGeneratingImage: false };
              return next;
          });
      } catch(e: any) {
           setScenes(prev => {
              const next = [...prev];
              next[index] = { ...next[index], isGeneratingImage: false, error: "Redraw failed: " + e.message };
              return next;
          });
      }
  };

  const handleEditSceneImage = async (index: number, instruction: string) => {
      const updated = [...scenes];
      updated[index].isGeneratingImage = true;
      updated[index].error = undefined;
      updated[index].videoUrls = []; // Clear old videos as base image changed
      updated[index].videoUrl = undefined;
      setScenes(updated);
      try {
          const originalImage = updated[index].imageUrl;
          if (!originalImage) throw new Error("No image to edit");
          const b64 = await editSceneImage(originalImage, instruction, aspectRatio);
          updated[index].imageUrl = b64;
          updated[index].imageHistory = [...(updated[index].imageHistory || []), b64];
      } catch (e: any) {
          updated[index].error = "Edit failed: " + e.message;
      } finally {
          updated[index].isGeneratingImage = false;
          setScenes([...updated]);
      }
  };

  const handleManualSceneImageUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const matches = result.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
          const b64 = matches[2];
          const updated = [...scenes];
          updated[index].imageUrl = b64;
          updated[index].error = undefined; 
          updated[index].videoUrls = []; // Clear old video
          updated[index].videoUrl = undefined;
          updated[index].imageHistory = [...(updated[index].imageHistory || []), b64];
          setScenes(updated);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteSceneImage = (index: number) => {
      setScenes(prev => {
          const updated = [...prev];
          const oldScene = updated[index];
          const newScene = { ...oldScene, imageUrl: undefined, videoUrls: [], videoUrl: undefined };
          
          const currentUrl = oldScene.imageUrl;
          if (currentUrl && newScene.imageHistory) {
              newScene.imageHistory = newScene.imageHistory.filter(img => img !== currentUrl);
          }
          
          updated[index] = newScene;
          return updated;
      });
  };

  const handleInsertScene = async (index: number) => {
      setLoading(true);
      setLoadingMessage('正在分析剧本并补充关键帧...');
      try {
          const stylePrompt = getFullStyleModifier();
          const newPrompt = await generateMissingScenePrompt(
              scenes.map(s => s.script).join('\n'),
              scenes.map(s => ({ script: s.script, visualPrompt: s.visualPrompt })),
              stylePrompt
          );
          
          setScenes(prev => {
              const newScenes = [...prev];
              const newScene: Scene = {
                  sceneNumber: index + 2,
                  script: "【AI补充场景】",
                  visualPrompt: newPrompt,
                  videoPrompt: "",
                  videoPromptZh: "",
                  cameraPrompt: "",
                  imageUrl: ""
              };
              newScenes.splice(index + 1, 0, newScene);
              return newScenes.map((scene, i) => ({
                  ...scene,
                  sceneNumber: i + 1
              }));
          });
          
          // Trigger image generation for the new scene
          // The new scene will be at index + 1
          await handleRegenerateImage(index + 1);
      } catch (error) {
          console.error("Failed to insert scene:", error);
          setError("无法自动补充场景，请手动添加。");
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteScene = (index: number) => {
      setScenes(prev => {
          const newScenes = prev.filter((_, i) => i !== index);
          return newScenes.map((scene, i) => ({
              ...scene,
              sceneNumber: i + 1
          }));
      });
  };

  const handleDeleteVideo = (index: number) => {
      setScenes(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], videoUrls: [], videoUrl: undefined };
          return updated;
      });
  };
  
  const handleGenerateGlobalAudio = async (voiceName: string = 'Kore') => {
    if (!globalNarration) return;
    setIsGeneratingGlobalAudio(true);
    try {
      const url = await generateAudio(globalNarration, { 
        voiceName
      }, audioModel);
      setGlobalAudioUrl(url);
    } catch (e: any) {
      setError("Global audio generation failed: " + e.message);
    } finally {
      setIsGeneratingGlobalAudio(false);
    }
  };

  const resetAppData = async () => {
      console.log("Reset button clicked - executing directly due to sandbox restrictions");
      
      // Preserve API tokens and related settings
      const key1 = localStorage.getItem('viva_api_key');
      const key2 = localStorage.getItem('viva_api_key_2');
      const activeIndex = localStorage.getItem('viva_active_key_index');
      const baseUrl = localStorage.getItem('viva_base_url');
      const isConfigConfirmed = localStorage.getItem('is_config_confirmed');
      
      localStorage.clear();
      
      // Restore preserved settings
      if (key1) localStorage.setItem('viva_api_key', key1);
      if (key2) localStorage.setItem('viva_api_key_2', key2);
      if (activeIndex) localStorage.setItem('viva_active_key_index', activeIndex);
      if (baseUrl) localStorage.setItem('viva_base_url', baseUrl);
      if (isConfigConfirmed) localStorage.setItem('is_config_confirmed', isConfigConfirmed);
      
      await clear();
      window.location.reload();
  };

  const handleSaveConfig = () => {
      if(apiKeyInput.trim() || apiKey2Input.trim()) {
          setCustomConfig(apiKeyInput.trim(), baseUrlInput.trim(), apiKey2Input.trim(), activeKeyIndex);
          setShowConfigModal(false);
          alert(`Custom Config Saved: Using ${baseUrlInput} with Key ${activeKeyIndex}`);
      } else {
          alert("请输入至少一个 API 令牌 / Please enter at least one API Key");
      }
  };

  const handleTestConnection = async () => {
      const keyToTest = activeKeyIndex === 1 ? apiKeyInput.trim() : apiKey2Input.trim();
      if (!keyToTest) { alert(`请输入 API 令牌 ${activeKeyIndex} / Enter API Key ${activeKeyIndex}`); return; }
      setTestStatus('testing');
      const success = await testApiConnection(keyToTest, baseUrlInput.trim());
      setTestStatus(success ? 'success' : 'error');
  };
  
  const handleCancelLoading = () => {
    loadingSession.current++;
    setLoading(false);
  };

  const allAssets = { characters, coreScenes, propsList };

  const renderAssetSlotWrapper = (item: AssetItem, list: AssetItem[], setList: React.Dispatch<React.SetStateAction<AssetItem[]>>, index: number) => (
      <AssetSlot 
        type={item.type} 
        asset={item} 
        onUpload={(f) => handleAssetUpload(setList, item.id, f)} 
        onGenerate={() => handleAssetGenerate(list, setList, item.id)}
        onRemove={() => removeAsset(setList, item.id)}
        onClearImage={() => clearAssetImage(setList, item.id)}
        onNameChange={(name) => updateAsset(setList, item.id, { name })}
        onAutoReferenceChange={(checked) => updateAsset(setList, item.id, { autoReference: checked })}
        onApplyToAll={item.type === 'character' ? () => handleApplyAssetToAll(item.name) : undefined}
        onEnlarge={() => setViewingAsset(item)}
        onDownload={() => handleDownloadAsset(item)}
        isGenerating={generatingAssetIds.has(item.id)}
        aspectRatio="16:9"
        error={assetErrors[item.id]}
      />
  );

  const getCategoryIcon = (id: string) => {
      switch(id) {
          case 'story': return Clapperboard;
          case 'knowledge': return BookOpen;
          case 'product': return ShoppingBag;
          case 'lifestyle': return Camera;
          default: return Sparkles;
      }
  };

  const renderStyleSelection = (styles: StyleOption[], level: number = 0) => {
      const selectedStyle = selectedStylePath[level];
      return (
        <div className="animate-fade-in space-y-4">
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                 {styles.map((style) => {
                    const isSelected = selectedStyle?.id === style.id || selectedStyle?.id === 'custom_user' && style.id === 'custom';
                    
                    // Logic to show custom user name if selected
                    const displayName = (style.id === 'custom' && selectedStyle?.id === 'custom_user') ? selectedStyle.name : style.name;

                    return (
                        <button 
                            key={style.id} 
                            onClick={() => {
                                handleStyleSelect(style, level);
                            }} 
                            className={clsx(
                                "h-12 flex items-center justify-center transition-all px-2 font-normal tracking-wide relative border-2 border-black font-sans text-lg whitespace-nowrap",
                                isSelected 
                                    ? "bg-[#FACC15] text-black transform -translate-y-1" 
                                    : "bg-white text-black hover:bg-gray-50 hover:text-black"
                            )}
                            title={style.name}
                        >
                            {displayName}
                       </button>
                    )
                 })}
             </div>
             
             {selectedStyle && selectedStyle.subStyles && selectedStyle.subStyles.length > 0 && (
                 <div className="relative mt-4 pt-2 border-l-4 border-dotted border-black pl-6 ml-2">
                     <div className="animate-in slide-in-from-left-2 duration-300">
                         <h4 className="text-xl font-bangers text-white mb-4 flex items-center gap-2">
                             <ArrowRight className="text-[#FACC15]" size={24} />
                             SUB-STYLE ({selectedStyle.name})
                         </h4>
                         {renderStyleSelection(selectedStyle.subStyles, level + 1)}
                     </div>
                 </div>
             )}
        </div>
      );
  };
  
  const initialScriptContent = draftScript || (scriptOptions.length > 0 ? scriptOptions[0].content : '');
  const hasGeneratedStoryboardImages = scenes.some(s => !!s.imageUrl);

  // Dynamic Grid Class for Assets - Always use 16:9 layout for assets
  const assetGridClass = "grid grid-cols-1 md:grid-cols-2 gap-4";

  if (!isStateLoaded) return null;

  return (
    <div className="min-h-screen pb-20 font-sans relative">
      <header className="border-b-4 border-black bg-[#FACC15] sticky top-0 z-[100]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <Bot size={56} className="text-black" strokeWidth={2.5} />
             <h1 className="font-sans font-black text-4xl tracking-tight text-black uppercase">{agentConfig.appName}</h1>
          </div>
          <div className="flex items-center gap-6 relative z-[101]">
              <button onClick={() => setShowConfigModal(true)} className="text-black hover:text-red-600 transition-colors" title="系统设置">
                 <Settings size={40} strokeWidth={2} />
              </button>

              <button 
                onClick={() => setShowPricingModal(true)}
                className="text-black hover:text-red-600 transition-colors" 
                title="价格说明"
              >
                <BadgeDollarSign size={40} strokeWidth={2} />
              </button>

              <button 
                  onClick={() => setShowSupportModal(true)} 
                  className="text-black hover:text-red-600 transition-colors" 
                  title="联系客服"
              >
                 <MessageCircleQuestion size={40} strokeWidth={2} />
              </button>
              
              <button 
                  onClick={() => window.open(`${baseUrlInput}/console/log`, '_blank')}
                  className="text-black hover:text-red-600 transition-colors"
                  title="使用日志"
              >
                  <History size={40} strokeWidth={2} />
              </button>
          </div>
        </div>
      </header>

      {/* Lightbox */}
      {viewingAsset && (
          <div className="fixed inset-0 z-[210] bg-black/95 flex items-center justify-center backdrop-blur-md animate-fade-in" onClick={() => setViewingAsset(null)}>
              <button onClick={() => setViewingAsset(null)} className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-50">
                  <X size={64} strokeWidth={1.5} />
              </button>
              <div className="w-full h-full flex items-center justify-center p-4">
                  {viewingAsset.mimeType.startsWith('video/') ? (
                      <video 
                          src={viewingAsset.previewUrl} 
                          controls 
                          autoPlay 
                          loop 
                          className="max-w-full max-h-full"
                          onClick={e => e.stopPropagation()}
                      />
                  ) : (
                      <img 
                          src={viewingAsset.previewUrl} 
                          alt={viewingAsset.name} 
                          className="max-w-full max-h-full object-contain" 
                          onClick={e => e.stopPropagation()} 
                      />
                  )}
              </div>
          </div>
      )}
      
      {/* Support Modal (Updated) */}
      {showSupportModal && (
          <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
              <div className="bg-white border-4 border-black w-full max-w-2xl relative animate-in zoom-in duration-200">
                  <div className="bg-[#FACC15] border-b-4 border-black p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <MessageCircleQuestion className="w-8 h-8 text-black" strokeWidth={2.5} />
                          <h2 className="text-3xl font-black text-black tracking-wide font-sans uppercase">联系客服 / SUPPORT</h2>
                      </div>
                      <button 
                          onClick={() => setShowSupportModal(false)} 
                          className="bg-[#EF4444] hover:bg-[#DC2626] border-2 border-black text-white p-1 transition-colors"
                      >
                          <X size={24} strokeWidth={3} />
                      </button>
                  </div>
                  
                  <div className="p-6 bg-[#FFFBEB] relative overflow-hidden">
                      {/* ONLINE Badge */}
                      <div className="absolute top-0 right-0 bg-[#FACC15] border-l-2 border-b-2 border-black px-3 py-1 font-bold text-xs">
                          ONLINE
                      </div>

                      <div className="flex flex-col items-center space-y-4 mt-2">
                          {/* Icon - Removed Shadow */}
                          <div className="w-20 h-20 bg-[#3B82F6] rounded-full flex items-center justify-center border-2 border-black">
                              <MessageCircleQuestion className="text-white w-10 h-10" />
                          </div>

                          {/* Text */}
                          {/* Text */}
                          <h3 className="text-xl font-bold text-gray-500 tracking-wider font-sans uppercase">WECHAT SUPPORT</h3>

                          {/* WeChat Copy Box - Updated Color */}
                          <div 
                            className="w-full flex border-2 border-black cursor-pointer hover:translate-y-1 transition-transform bg-white"
                            onClick={() => {
                                navigator.clipboard.writeText(agentConfig.wechatSupportId);
                                alert(`WeChat ID copied: ${agentConfig.wechatSupportId}`);
                            }}
                            title="Click to copy"
                          >
                              <div className="bg-[#4ADE80] w-1/3 flex items-center justify-center border-r-2 border-black p-3">
                                  <span className="font-bold text-lg">微信客服</span>
                              </div>
                              <div className="flex-1 flex items-center justify-center p-3 bg-white">
                                  <span className="font-black text-2xl tracking-widest">{agentConfig.wechatSupportId}</span>
                              </div>
                          </div>
                          
                          {/* Removed Helper Text */}
                      </div>

                      {/* Divider */}
                      <div className="w-full border-t-2 border-dashed border-gray-300 my-6"></div>

                      {/* Recruitment Section */}
                      <div className="text-center space-y-3">
                          <h4 className="font-sans font-bold text-xl flex items-center justify-center gap-2">
                              <span className="w-3 h-3 bg-[#10B981] rounded-full border-2 border-black"></span>
                              招募优质API代理
                          </h4>
                          <p className="text-gray-600 font-bold text-sm">
                              名额有限，欢迎想通过AI创业的伙伴加入。
                          </p>
                          
                          {/* Link Button - Removed Shadow */}
                          <a 
                              href={agentConfig.recruitmentLink} 
                              target="_blank" 
                              className="block w-full bg-[#EF4444] text-white font-black text-xl py-4 border-2 border-black hover:translate-y-1 transition-all flex items-center justify-center gap-2"
                          >
                              查看更多详情 <ExternalLink size={20} />
                          </a>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Custom Style Input Modal */}
      {showCustomStyleModal && (
          <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
              <div className="bg-white border-4 border-black w-full max-w-lg relative animate-in zoom-in duration-200">
                  <div className="bg-[#FACC15] border-b-4 border-black p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <Wand2 className="w-6 h-6 text-black" strokeWidth={2.5} />
                          <h2 className="text-3xl font-black text-black tracking-wide font-sans">自定义风格 / Custom</h2>
                      </div>
                      <button 
                          onClick={() => setShowCustomStyleModal(false)} 
                          className="bg-[#EF4444] hover:bg-[#DC2626] border-2 border-black text-white p-1 transition-colors"
                      >
                          <X size={24} strokeWidth={3} />
                      </button>
                  </div>
                  
                  <div className="p-6 bg-white space-y-4">
                      <div className="space-y-2">
                          <label className="text-lg font-bold text-black">风格名称 / Style Name</label>
                          <input 
                            type="text" 
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            className="w-full border-2 border-black p-3 text-lg font-medium outline-none focus:bg-yellow-50"
                            placeholder="例如：赛博朋克"
                            autoFocus
                          />
                      </div>
                      
                      <div className="space-y-2">
                          <label className="text-lg font-bold text-black">核心视觉特征 / Core Visual Features</label>
                          <textarea 
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            className="w-full border-2 border-black p-3 text-lg font-medium h-32 resize-none outline-none focus:bg-yellow-50"
                            placeholder="例如：电影质感，高对比度，霓虹色彩..."
                          />
                      </div>

                      <div className="pt-2">
                          <button 
                            onClick={saveCustomStyle}
                            disabled={!customName.trim() || !customPrompt.trim()}
                            className="w-full bg-[#FACC15] hover:bg-[#EAB308] text-black border-2 border-black py-3 font-black text-xl tracking-wide uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 transition-all"
                          >
                              确认风格 / Confirm Style
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showVideoPreview && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl p-4 relative">
              <button onClick={() => setShowVideoPreview(false)} className="absolute top-2 right-2 text-black">
                <X size={24} />
              </button>
              <VideoPreview scenes={scenes} />
            </div>
          </div>
      )}

      {showConfigModal && (
          <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
              <div className="bg-white border-4 border-black w-full max-w-2xl relative animate-in zoom-in duration-200">
                   {/* Header */}
                   <div className="bg-[#FACC15] border-b-4 border-black p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Settings className="w-8 h-8 text-black" strokeWidth={2.5} />
                            <h2 className="text-3xl font-black text-black tracking-wide font-sans uppercase">系统设置 / SETTINGS</h2>
                        </div>
                        {/* Close Button - Integrated into header */}
                        <button 
                            onClick={() => setShowConfigModal(false)} 
                            className="bg-[#EF4444] hover:bg-[#DC2626] border-2 border-black text-white p-1 transition-colors"
                        >
                            <X size={24} strokeWidth={3} />
                        </button>
                   </div>
                   
                   <div className="p-6 space-y-4">
                      {/* Base URL Input */}
                      <div className="space-y-1">
                          <label className="text-base font-black text-black flex items-center justify-between">
                               <a href={`${baseUrlInput}/console/token`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                                   API令牌获取地址 <ExternalLink size={16} />
                               </a>
                               <a href={agentConfig.tutorialLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline font-bold">
                                   令牌设置教程-必看
                               </a>
                          </label>
                          <input 
                              type="text" 
                              value={baseUrlInput} 
                              onChange={(e) => setBaseUrlInput(e.target.value)} 
                              placeholder={agentConfig.baseUrl}
                              className="w-full bg-[#FFFBEB] border-2 border-black p-2 font-mono text-lg outline-none focus:bg-white transition-colors"
                          />
                      </div>

                      {/* API Key Input 1 */}
                      <div className="space-y-1">
                          <div className="flex items-center justify-between">
                              <label className="text-base font-black text-black">
                                  API令牌 1 (KEY 1)
                              </label>
                              <input 
                                  type="radio" 
                                  name="activeKey" 
                                  checked={activeKeyIndex === 1} 
                                  onChange={() => setActiveKeyIndex(1)}
                                  className="w-5 h-5 accent-[#FACC15] cursor-pointer"
                              />
                          </div>
                          <div className="relative">
                            <input 
                                type={showApiKey ? "text" : "password"}
                                value={apiKeyInput} 
                                onChange={e => setApiKeyInput(e.target.value)} 
                                className={clsx(
                                    "w-full border-2 border-black p-2 font-mono text-lg outline-none transition-colors tracking-widest pr-12",
                                    activeKeyIndex === 1 ? "bg-[#FFFBEB]" : "bg-gray-50 opacity-70"
                                )}
                                placeholder="sk-..."
                            />
                            <button 
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-black transition-colors"
                            >
                                {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                      </div>

                      {/* API Key Input 2 */}
                      <div className="space-y-1">
                          <div className="flex items-center justify-between">
                              <label className="text-base font-black text-black">
                                  API令牌 2 (KEY 2)
                              </label>
                              <input 
                                  type="radio" 
                                  name="activeKey" 
                                  checked={activeKeyIndex === 2} 
                                  onChange={() => setActiveKeyIndex(2)}
                                  className="w-5 h-5 accent-[#FACC15] cursor-pointer"
                              />
                          </div>
                          <div className="relative">
                            <input 
                                type={showApiKey2 ? "text" : "password"}
                                value={apiKey2Input} 
                                onChange={e => setApiKey2Input(e.target.value)} 
                                className={clsx(
                                    "w-full border-2 border-black p-2 font-mono text-lg outline-none transition-colors tracking-widest pr-12",
                                    activeKeyIndex === 2 ? "bg-[#FFFBEB]" : "bg-gray-50 opacity-70"
                                )}
                                placeholder="sk-..."
                            />
                            <button 
                                type="button"
                                onClick={() => setShowApiKey2(!showApiKey2)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-black transition-colors"
                            >
                                {showApiKey2 ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                      </div>

                      {/* Save Button */}
                      <button 
                          onClick={handleSaveConfig} 
                          className="w-full bg-[#FACC15] text-black border-2 border-black py-2.5 font-black text-lg tracking-wide uppercase hover:translate-y-1 transition-all mt-2 flex items-center justify-center gap-2"
                      >
                          <Save size={20} strokeWidth={2.5} />
                          保存设置/SAVE SETTINGS
                      </button>

                      {/* Reset Button */}
                      <button 
                          onClick={resetAppData} 
                          className="w-full bg-[#EF4444] text-white border-2 border-black py-2.5 font-black text-lg tracking-wide uppercase hover:translate-y-1 transition-all mt-2 flex items-center justify-center gap-2"
                      >
                          <Trash2 size={20} strokeWidth={2.5} />
                          重置应用数据/RESET DATA
                      </button>
                   </div>
              </div>
          </div>
      )}

      {showPricingModal && (
        <PricingModal onClose={() => setShowPricingModal(false)} />
      )}

      <main className="max-w-7xl mx-auto px-6 py-10">
        <StepIndicator currentStep={step} onStepClick={handleStepClick} enabledSteps={enabledSteps} isConfigConfirmed={isConfigConfirmed} />

        {error && (
          <div className="mb-8 bg-red-100 border-l-8 border-red-600 text-red-800 p-4 flex items-center gap-3">
            <AlertCircle size={32} />
            <span className="font-bold uppercase tracking-wide text-lg">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto font-bold underline hover:text-red-950">DISMISS</button>
          </div>
        )}

        {step === AppStep.MODEL_CONFIG && (
          <div className="max-w-7xl mx-auto space-y-10 pb-20">
             <div className="text-center space-y-3 mb-12 relative">
                 <h2 className="text-6xl font-bangers text-white uppercase tracking-wider">Step 1. The Configuration</h2>
                 <p className="text-white text-xl font-normal bg-black inline-block px-4 py-1 transform -skew-x-12 border-2 border-white">请配置您需要使用的AI大模型</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white border-4 border-black p-6 rounded-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col">
                    <div className="flex items-center gap-3 mb-4 border-b-2 border-black pb-3">
                        <div className="bg-[#FACC15] p-3 rounded-xl border-2 border-black">
                            <FileText size={28} strokeWidth={2.5} />
                        </div>
                        <h3 className="font-black text-2xl tracking-wide">文本模型</h3>
                    </div>
                    <div className="flex-1 space-y-4">
                        <p className="text-gray-600 text-sm mb-2">用于生成剧本、分镜描述和提示词。</p>
                        <div className="relative">
                            <select value={textModel} onChange={(e) => setTextModel(e.target.value)} className="w-full bg-gray-50 border-2 border-black p-4 font-bold text-lg rounded-xl appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-[#FACC15]">
                                <option value="gemini-3-pro-preview">Gemini-3-Pro</option>
                                <option value="gemini-3-flash-preview">Gemini-3-Flash</option>
                                <option value="gemini-3.1-flash-lite-preview">Gemini-3.1-Flash</option>
                                <option value="gpt-5.2">GPT-5.2</option>
                                <option value="gpt-5.3-chat-latest">GPT-5.3</option>
                                <option value="gpt-5.4">GPT-5.4</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronRight className="rotate-90" size={24} strokeWidth={3} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white border-4 border-black p-6 rounded-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col relative">
                    <a 
                        href="https://my.feishu.cn/wiki/SVISwqXbQiKH9OkBDR9c6HJDnZf?from=from_copylink" 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute -top-2 -right-2 text-black hover:text-[#FACC15] transition-all group z-10 bg-white border-2 border-black rounded-full p-1"
                        title="模型说明"
                    >
                        <MessageCircleQuestion size={40} />
                        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">模型说明</span>
                    </a>
                    <div className="flex items-center gap-3 mb-4 border-b-2 border-black pb-3">
                        <div className="bg-[#A855F7] text-white p-3 rounded-xl border-2 border-black">
                            <Image size={28} strokeWidth={2.5} />
                        </div>
                        <h3 className="font-black text-2xl tracking-wide">图片模型</h3>
                    </div>
                    <div className="flex-1 space-y-4">
                        <p className="text-gray-600 text-sm mb-2">用于生成角色设定图和分镜参考图。</p>
                        <div className="relative">
                            <select value={assetModel} onChange={(e) => setAssetModel(e.target.value as any)} className="w-full bg-gray-50 border-2 border-black p-4 font-bold text-lg rounded-xl appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-[#A855F7]">
                                <option value="gemini-3-pro-image-preview">Gemini-3-Pro-Image</option>
                                <option value="gemini-3.1-flash-image-preview">Gemini-3.1-Flash-Image</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronRight className="rotate-90" size={24} strokeWidth={3} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white border-4 border-black p-6 rounded-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col">
                    <div className="flex items-center gap-3 mb-4 border-b-2 border-black pb-3">
                        <div className="bg-[#3B82F6] text-white p-3 rounded-xl border-2 border-black">
                            <Film size={28} strokeWidth={2.5} />
                        </div>
                        <h3 className="font-black text-2xl tracking-wide">视频模型</h3>
                    </div>
                    <div className="flex-1 space-y-4">
                        <p className="text-gray-600 text-sm mb-2">用于将分镜图片转化为动态视频片段。</p>
                        <div className="relative">
                            <select value={videoModel} onChange={(e) => setVideoModel(e.target.value as VideoModel)} className="w-full bg-gray-50 border-2 border-black p-4 font-bold text-lg rounded-xl appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-[#3B82F6]">
                                <option value="veo_3_1-fast">Veo-3.1-Fast</option>
                                <option value="veo_3_1-fast-4K">Veo-3.1-Fast-4K</option>
                                <option value="veo_3_1">Veo-3.1</option>
                                <option value="veo_3_1-4K">Veo-3.1-4K</option>
                                <option value="veo3.1-fast">Veo3.1-Fast</option>
                                <option value="veo3.1">Veo3.1</option>
                                <option value="grok-video-3-10s">Grok-Video-3 (10s)</option>
                                <option value="grok-video-3-15s">Grok-Video-3 (15s)</option>
                                <option value="sora-2-all">Sora-2</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronRight className="rotate-90" size={24} strokeWidth={3} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white border-4 border-black p-6 rounded-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col">
                    <div className="flex items-center gap-3 mb-4 border-b-2 border-black pb-3">
                        <div className="bg-[#10B981] text-white p-3 rounded-xl border-2 border-black">
                            <Music size={28} strokeWidth={2.5} />
                        </div>
                        <h3 className="font-black text-2xl tracking-wide">音频模型</h3>
                    </div>
                    <div className="flex-1 space-y-4">
                        <p className="text-gray-600 text-sm mb-2">用于将文本转化为语音。</p>
                        <div className="relative">
                            <select value={audioModel} onChange={(e) => setAudioModel(e.target.value)} className="w-full bg-gray-50 border-2 border-black p-4 font-bold text-lg rounded-xl appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-[#10B981]">
                                <option value="gemini-2.5-flash-preview-tts">Gemini-2.5-Flash-TTS</option>
                                <option value="gemini-2.5-pro-preview-tts">gemini-2.5-pro-tts</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronRight className="rotate-90" size={24} strokeWidth={3} />
                            </div>
                        </div>
                    </div>
                </div>
             </div>
             <div className="text-center mt-16">
                <p className="text-white font-normal mb-6 text-xl">
                    温馨提示：为确保各模型成功应用，请按令牌设置教程创建令牌
                </p>
                <button 
                  onClick={() => { setIsConfigConfirmed(true); setStep(AppStep.INPUT); }}
                  className="bg-[#FACC15] text-black border-4 border-black px-16 py-5 rounded-full font-black text-2xl uppercase hover:-translate-y-2 transition-all active:translate-y-0 flex items-center gap-3 mx-auto"
                >
                    <span>确认配置 / CONFIRM</span>
                    <ArrowRight size={28} strokeWidth={3} />
                </button>
             </div>
          </div>
        )}

        {step === AppStep.INPUT && (
          <div className="max-w-7xl mx-auto space-y-6 pb-10">
            <div className="text-center space-y-3 mb-12">
                <h2 className="text-6xl font-bangers text-white uppercase tracking-wider">Step 2. The Concept</h2>
                <p className="text-white text-xl font-normal bg-black inline-block px-4 py-1 transform -skew-x-12 border-2 border-white">选择您的创作方向</p>
            </div>

            {/* 2. Template Selection */}
            {selectedCategory && (
                <div className="space-y-3 bg-black p-4 border-4 border-white relative mt-6">
                     <div className="absolute -top-4 left-6 bg-white border-2 border-black px-3 py-1 font-bangers text-lg transform -rotate-1">
                        SELECT TEMPLATE ({selectedCategory.name})
                     </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                        {selectedCategory.templates.map(tpl => (
                            <button 
                                key={tpl.id} 
                                onClick={() => setSelectedTemplate(tpl)}
                                className={clsx(
                                    "px-2 h-12 flex items-center justify-center font-normal text-lg border-2 border-black transition-all uppercase tracking-wide font-bangers text-center leading-tight",
                                    selectedTemplate?.id === tpl.id 
                                        ? "bg-[#FACC15] text-black"
                                        : "bg-white text-black hover:bg-gray-100"
                                )}
                            >
                                {tpl.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Visual Style Selection (Updated to VISUAL STYLE) */}
            {selectedCategory && selectedTemplate && (
                <div className="space-y-3 bg-black p-4 border-4 border-white relative mt-6">
                     <div className="absolute -top-4 left-6 bg-white border-2 border-black px-3 py-1 font-bangers text-lg transform -rotate-1">
                        VISUAL STYLE (视觉风格)
                     </div>
                     
                     <div className="pt-3">
                        {renderStyleSelection(STYLES, 0)}
                     </div>
                 </div>
            )}

            {/* 4. Topic Input & Duration */}
            {selectedTemplate && selectedStylePath.length > 0 && (
                <div className="space-y-4 bg-black p-4 border-4 border-white relative mt-6">
                     <div className="absolute -top-4 left-6 bg-white border-2 border-black px-3 py-1 font-bangers text-lg transform -rotate-1 flex items-center justify-center gap-2">
                        <span>CREATIVE IDEA (创意想法)</span>
                     </div>

                     <div className="space-y-4 pt-4">
                         <div className="relative group">
                            {isGeneratingTopics ? (
                               <button 
                                   onClick={handleGenerateTopics}
                                   className="absolute top-3.5 left-4 z-20 h-10 px-4 flex items-center gap-1 bg-[#EF4444] hover:bg-[#DC2626] border-2 border-black rounded-full transition-all cursor-pointer"
                                   title="点击终止生成"
                               >
                                   <Brain size={18} className="text-[#FACC15] animate-spin" />
                                   <span className="font-bold text-white tracking-wide text-xs animate-pulse font-sans">点击终止生成</span>
                               </button>
                            ) : (
                                <button 
                                     onClick={handleGenerateTopics}
                                     className="absolute top-3.5 left-4 z-20 w-10 h-10 flex items-center justify-center bg-[#8B5CF6] hover:bg-[#7C3AED] border-2 border-black rounded-full transition-all hover:scale-110"
                                     title="AI Brainstorm"
                                 >
                                     <Brain size={20} className="text-white" /> 
                                 </button>
                            )}

                            <textarea 
                                value={topic} 
                                onChange={(e) => setTopic(e.target.value)} 
                                placeholder={isGeneratingTopics ? "请耐心等待..." : "左侧图标点一下，AI创意马上来"}
                                className={clsx(
                                    "w-full h-24 bg-white border-4 border-black py-3 px-4 text-base font-normal font-comic outline-none resize-none text-black leading-relaxed placeholder:text-gray-400 focus:bg-yellow-50 transition-colors",
                                    isGeneratingTopics ? "pl-48" : "pl-16"
                                )}
                            />
                         </div>
                         
                         {topicSuggestions.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {topicSuggestions.map((suggestion, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setTopic(suggestion)}
                                        className="bg-white hover:bg-[#FACC15] border-2 border-black px-3 py-1.5 text-base uppercase transition-colors font-normal text-left truncate"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                         )}

                         <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6 border-t-2 border-dashed border-gray-600">
                            <div>
                                <h3 className="text-xl font-bangers text-white mb-2 flex items-center gap-2">
                                    <Film size={20} /> 
                                    <span>集数 <span className="text-lg ml-1 font-normal">(Episode Count)</span></span>
                                </h3>
                                <div className="relative flex items-center">
                                    <input
                                        type="number"
                                        value={episodeCount}
                                        onChange={(e) => setEpisodeCount(e.target.value)}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        placeholder="如：10"
                                        className="w-full h-12 bg-white border-4 border-black px-4 text-xl font-normal outline-none transition-colors hover:bg-gray-50"
                                    />
                                    <span className="absolute right-4 text-xl font-bangers text-black">集</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xl font-bangers text-white mb-2 flex items-center gap-2">
                                    <Clock size={20} /> 
                                    <span>单集时长 <span className="text-lg ml-1 font-normal">(Episode Duration)</span></span>
                                </h3>
                                <div className="relative">
                                    <select
                                        value={episodeDuration}
                                        onChange={(e) => setEpisodeDuration(e.target.value)}
                                        className="w-full h-12 bg-white border-4 border-black px-4 text-xl font-normal outline-none appearance-none cursor-pointer hover:bg-gray-50 uppercase"
                                    >
                                        <option value="10–20秒">10–20秒</option>
                                        <option value="20–30秒">20–30秒</option>
                                        <option value="30–40秒">30–40秒</option>
                                        <option value="40–50秒">40–50秒</option>
                                        <option value="50–60秒">50–60秒</option>
                                        <option value="60–70秒">60–70秒</option>
                                        <option value="70–80秒">70–80秒</option>
                                        <option value="80–90秒">80–90秒</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                                        <ChevronRight className="rotate-90" size={20} strokeWidth={3} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xl font-bangers text-white mb-2 flex items-center gap-2">
                                    <Maximize2 size={20} /> 
                                    <span>画面比例 <span className="text-lg ml-1 font-normal">(Aspect Ratio)</span></span>
                                </h3>
                                <div className="relative">
                                    <select
                                        value={aspectRatio}
                                        onChange={(e) => setAspectRatio(e.target.value as '9:16' | '16:9')}
                                        className="w-full h-12 bg-white border-4 border-black px-4 text-xl font-normal outline-none appearance-none cursor-pointer hover:bg-gray-50 uppercase"
                                    >
                                        <option value="9:16">9:16 (VERTICAL)</option>
                                        <option value="16:9">16:9 (HORIZONTAL)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                                        <ChevronRight className="rotate-90" size={20} strokeWidth={3} />
                                    </div>
                                </div>
                            </div>
                         </div>
                     </div>
                         
                    <div className="flex justify-center pt-4 pb-2">
                        <button 
                            onClick={() => handleStartCreation()} 
                            disabled={!topic.trim() || !isStyleSelectionComplete()} 
                            className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-8 py-3 font-bangers text-2xl tracking-widest uppercase border-4 border-black hover:-translate-y-1 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            <Sparkles className="text-[#FACC15]" size={24} /> 
                            <span>开始创作剧本</span>
                            <ArrowRight size={24} />
                        </button>
                    </div>
                </div>
            )}
          </div>
        )}

        {step === AppStep.SCRIPT_EDIT && (
           <ScriptEditor 
               initialScript={initialScriptContent} 
               onFinalize={handleFinalizeScript} 
               isGenerating={loading} 
               onNext={() => setStep(AppStep.ASSETS)}
               canGoNext={scenes.length > 0}
               onRegenerate={() => handleStartCreation()}
               onPolishScript={setDraftScript}
               currentEpisode={currentEpisode}
               totalEpisodes={totalEpisodes}
               onEpisodeChange={setCurrentEpisode}
               textModel={textModel}
           />
        )}

        {step === AppStep.ASSETS && (
            <div className="max-w-7xl mx-auto px-4 space-y-10 animate-fade-in pb-20">
                 <div className="flex flex-col md:flex-row justify-between items-end border-b-4 border-black pb-6 gap-6 relative">
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-4">
                            <h2 className="text-6xl font-bangers text-white uppercase tracking-wider">Step 4. The Cast</h2>
                            <div className="relative shrink-0 mb-2">
                                <select 
                                    value={currentEpisode}
                                    onChange={(e) => setCurrentEpisode(Number(e.target.value))}
                                    className="w-full bg-[#FACC15] border border-black px-6 py-1.5 text-lg font-normal uppercase outline-none appearance-none cursor-pointer hover:bg-[#EAB308] transition-colors text-black pr-10"
                                >
                                    {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map(ep => (
                                        <option key={ep} value={ep}>第{ep}集</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                                    <ChevronDown size={20} strokeWidth={3} />
                                </div>
                            </div>
                        </div>
                        <p className="text-white text-xl font-normal bg-black inline-block px-4 py-1 transform -skew-x-12 border-2 border-white">在此定义您的角色和核心场景</p>
                    </div>
                    
                    <div className="flex gap-4 self-end">
                        {hasGeneratedStoryboardImages && (
                             <button onClick={() => setStep(AppStep.STORYBOARD)} className="bg-white hover:bg-gray-100 text-black px-6 py-1.5 font-bangers text-lg tracking-wide flex items-center gap-2 border border-black hover:-translate-y-1 transition-all">
                                查看分镜 <ArrowRight size={20} />
                             </button>
                        )}
                        <button onClick={handleGenerateStoryboard} className="bg-[#FACC15] hover:bg-[#EAB308] text-black px-6 py-1.5 font-bangers text-lg tracking-wide flex items-center gap-2 border border-black hover:-translate-y-1 transition-all">
                            {hasGeneratedStoryboardImages ? <RefreshCw size={20}/> : <ArrowRight size={20} />}
                            {hasGeneratedStoryboardImages ? '全部重绘' : '生成分镜'}
                        </button>
                    </div>
                 </div>

                 {/* Characters Section */}
                 <div className="bg-[#1a1a1a] px-0 py-2">
                     <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#3B82F6] text-white flex items-center justify-center border-2 border-black">
                                <User size={28} />
                            </div>
                            <h3 className="text-4xl font-bangers text-white uppercase tracking-wide">CHARACTERS（角色）</h3>
                         </div>
                         <div className="flex gap-4">
                             <button 
                                onClick={() => handleBatchGenerateAssets(characters, setCharacters, 'Characters')}
                                className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] border border-black px-4 py-1.5 uppercase text-lg"
                            >
                                <Sparkles size={16} /> AI一键生成
                            </button>
                         </div>
                     </div>
                     {/* Asset Grid Layout for Characters - Updated */}
                     <div className={assetGridClass}>
                         {characters.map((c, i) => (
                             <React.Fragment key={c.id}>{renderAssetSlotWrapper(c, characters, setCharacters, i)}</React.Fragment>
                         ))}
                     </div>
                 </div>

                 {/* Core Scenes Section */}
                 <div className="bg-[#1a1a1a] px-0 pt-8 border-t-4 border-dashed border-gray-700">
                     <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#F97316] text-white flex items-center justify-center border-2 border-black">
                                <MapPin size={28} />
                            </div>
                            <h3 className="text-4xl font-bangers text-white uppercase tracking-wide">LOCATIONS（场景）</h3>
                         </div>
                         <div className="flex gap-4">
                            <button 
                                onClick={() => handleBatchGenerateAssets(coreScenes, setCoreScenes, 'Scenes')}
                                className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] border border-black px-4 py-1.5 uppercase text-lg"
                            >
                                <Sparkles size={16} /> AI一键生成
                            </button>
                         </div>
                     </div>
                     {/* Asset Grid Layout for Scenes - Updated */}
                     <div className={assetGridClass}>
                         {coreScenes.map((c, i) => (
                             <React.Fragment key={c.id}>{renderAssetSlotWrapper(c, coreScenes, setCoreScenes, i)}</React.Fragment>
                         ))}
                     </div>
                 </div>

                 {/* Props Section */}
                 <div className="bg-[#1a1a1a] px-0 pt-8 border-t-4 border-dashed border-gray-700">
                     <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#10B981] text-white flex items-center justify-center border-2 border-black">
                                <Box size={28} />
                            </div>
                            <h3 className="text-4xl font-bangers text-white uppercase tracking-wide">PROPS（道具）</h3>
                         </div>
                         <div className="flex gap-4">
                            <button 
                                onClick={() => handleBatchGenerateAssets(propsList, setPropsList, 'Props')}
                                className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] border border-black px-4 py-1.5 uppercase text-lg"
                            >
                                <Sparkles size={16} /> AI一键生成
                            </button>
                         </div>
                     </div>
                     {/* Asset Grid Layout for Props */}
                     <div className={assetGridClass}>
                         {propsList.map((c, i) => (
                             <React.Fragment key={c.id}>{renderAssetSlotWrapper(c, propsList, setPropsList, i)}</React.Fragment>
                         ))}
                     </div>
                 </div>
            </div>
        )}

        {step === AppStep.STORYBOARD && (
            <StoryboardGrid 
                scenes={scenes}
                assets={allAssets}
                onRegenerateImage={handleRegenerateImage}
                onUpdatePrompt={(i, v, l) => { 
                    const s = [...scenes]; 
                    s[i].visualPrompt = v; 
                    setScenes(s); 
                    
                    // Update raw script text
                    setEpisodesScript(prev => {
                        const script = prev[currentEpisode];
                        if (!script) return prev;
                        const promptRegex = new RegExp(`(分镜\\s*${i + 1}\\s*[：:]\\s*)(.*?)(?=\\n|$)`);
                        const newScript = script.replace(promptRegex, `$1${v}`);
                        return { ...prev, [currentEpisode]: newScript };
                    });
                }}
                onUpdateScript={(i, v) => { 
                    const s = [...scenes]; 
                    s[i].script = v; 
                    setScenes(s); 
                }}
                onSelectSceneImage={(i, h) => { const s=[...scenes]; if(s[i].imageHistory?.[h]) s[i].imageUrl=s[i].imageHistory[h]; setScenes(s); }}
                onManualUpload={handleManualSceneImageUpload}
                onDeleteImage={handleDeleteSceneImage}
                onInsertScene={handleInsertScene}
                onDeleteScene={handleDeleteScene}
                onEnlarge={(url, type) => setViewingAsset({ 
                    name: type === 'video' ? "Generated Video" : "Storyboard Image", 
                    type: 'scene', 
                    data: url, 
                    previewUrl: type === 'video' ? url : `data:image/png;base64,${url}`, 
                    id: 'viewing', 
                    mimeType: type === 'video' ? 'video/mp4' : 'image/png' 
                })}
                aspectRatio={aspectRatio}
                videoModel={videoModel}
                onEditImage={handleEditSceneImage}
                topic={currentScriptTitle}
                globalNarration={globalNarration}
                globalAudioUrl={globalAudioUrl}
                isGeneratingGlobalAudio={isGeneratingGlobalAudio}
                onUpdateGlobalNarration={setGlobalNarration}
                onUpdateNarration={(i, v) => {
                    if (!globalNarration) return;
                    const lines = globalNarration.split('\n');
                    lines[i] = v;
                    setGlobalNarration(lines.join('\n'));
                    
                    // Update raw script text
                    setEpisodesScript(prev => {
                        const script = prev[currentEpisode];
                        if (!script) return prev;
                        // Find "分镜 X" and then replace the next "配音：" line
                        const regex = new RegExp(`(分镜\\s*${i + 1}\\s*[：:][\\s\\S]*?配音\\s*[：:]\\s*)(.*?)(?=\\n|$)`);
                        const newScript = script.replace(regex, `$1${v}`);
                        return { ...prev, [currentEpisode]: newScript };
                    });
                }}
                onGenerateGlobalAudio={handleGenerateGlobalAudio}
                currentEpisode={currentEpisode}
                totalEpisodes={totalEpisodes}
                onGenerateEpisodeStoryboard={handleGenerateEpisodeStoryboard}
                onViewEpisode={setCurrentEpisode}
                episodesScenes={episodesScenes}
            />
        )}

      </main>
      {loading && <LoadingOverlay message={loadingMessage} onCancel={handleCancelLoading} />}
    </div>
  );
}

export default App;