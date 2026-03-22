
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Scene, AssetItem, VideoModel } from '../types';
import { getValidDurations, VOICES } from '../constants';
import { RefreshCw, Download, Maximize2, Wand2, X, Archive, AlertTriangle, ImagePlus, Edit2, Edit3, Upload, Film, Trash2, LayoutGrid, PlayCircle, Clapperboard, ChevronDown, Layers, Clock, Zap, FileText, Image as ImageIcon, Video, List, Music, Plus, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { proxyConfig as agentConfig } from '../src/proxyConfig';

const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('viva_base_url') || agentConfig.baseUrl;
    }
    return agentConfig.baseUrl;
};

interface Props {
  scenes: Scene[];
  assets: { characters: AssetItem[], coreScenes: AssetItem[] };
  onRegenerateImage: (sceneIndex: number) => void;
  onUpdatePrompt: (sceneIndex: number, newPrompt: string, lang: 'en' | 'zh') => void;
  onUpdateScript?: (sceneIndex: number, newScript: string) => void;
  onUpdateVideoPrompt?: (sceneIndex: number, newPrompt: string) => void;
  onSelectSceneImage?: (sceneIndex: number, historyIndex: number) => void;
  onManualUpload: (sceneIndex: number, file: File) => void;
  onDeleteImage: (sceneIndex: number) => void;
  onEnlarge: (url: string, type: 'image' | 'video') => void;
  aspectRatio: '9:16' | '16:9';
  videoModel: VideoModel;
  onEditImage?: (sceneIndex: number, instruction: string) => void;
  onRefinePrompt?: (sceneIndex: number) => void;
  topic?: string;
  globalNarration?: string;
  globalAudioUrl?: string;
  isGeneratingGlobalAudio?: boolean;
  onUpdateGlobalNarration?: (narration: string) => void;
  onGenerateGlobalAudio?: (voiceName: string) => void;
  onInsertScene?: (index: number) => void;
  onDeleteScene?: (index: number) => void;
  currentEpisode: number;
  totalEpisodes: number;
  onGenerateEpisodeStoryboard: (episode: number) => void;
  onViewEpisode: (episode: number) => void;
  episodesScenes: Record<number, Scene[]>;
}

const StoryboardGrid: React.FC<Props> = ({ 
    scenes, assets, onRegenerateImage, onUpdatePrompt, onUpdateScript,
    onSelectSceneImage, onManualUpload, onDeleteImage, onEnlarge, aspectRatio, videoModel, onEditImage, onRefinePrompt, topic,
    globalNarration,
    globalAudioUrl,
    isGeneratingGlobalAudio,
    onUpdateGlobalNarration,
    onGenerateGlobalAudio,
    onInsertScene,
    onDeleteScene,
    currentEpisode,
    totalEpisodes,
    onGenerateEpisodeStoryboard,
    onViewEpisode,
    episodesScenes
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isRefining, setIsRefining] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  const handleAIRefine = async () => {
      if (!globalNarration) return;
      setIsRefining(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const systemInstruction = `你是一个动态漫剧本优化专家。请根据以下《动态漫剧本 AI 优化通用设定描述》对用户提供的剧本进行优化。
优化核心目标：适配动态漫制作、强化画面适配性、提升内容感染力、贴合原创意核心。
具体要求：
1. 整体结构优化：确保基础信息、分镜、配音、时长清晰对应。
2. 分镜优化：补充视觉细节（镜头角度、色调、光影、质感），确保镜头衔接流畅，时长精准，画面感染力强。
3. 配音文案优化：
   - 必须使用第三人称讲故事者的身份，严禁出现第一人称（如“我”、“我的”）。
   - 格式严格限制为：(语气/节奏/重音等...) 文案。
   - 严禁包含数字、镜号、秒数等任何非配音内容。
   - 必须按一段对话一排（一行）的方式显示，每段对话之间使用换行符分隔。
4. 文案细节优化：强化情节紧凑性，统一风格，补充动作/环境细节。
5. 格式保留：严格保持原剧本的原有格式、标注形式和规范。
请直接输出优化后的剧本内容。`;

          const response = await ai.models.generateContent({
              model: "gemini-3.1-pro-preview",
              contents: `请优化以下剧本：\n${globalNarration}`,
              config: {
                  systemInstruction: systemInstruction,
              },
          });
          if (response.text) {
              onUpdateGlobalNarration?.(response.text);
          }
      } catch (error) {
          console.error("AI 润色失败:", error);
      } finally {
          setIsRefining(false);
      }
  };

  const handleDownloadAudio = () => {
    if (!globalAudioUrl) return;
    const link = document.createElement('a');
    link.href = globalAudioUrl;
    link.download = `${topic || 'video'}_narration.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadImage = (base64Data: string, sceneNum: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Data}`;
    link.download = `${topic || 'video'}_scene_${sceneNum}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportProject = async () => {
      setIsExporting(true);
      try {
          const zip = new JSZip();
          const imgFolder = zip.folder(`storyboards_${aspectRatio.replace(':','x')}`);
          const excelData = scenes.map(scene => ({
              "场景编号": scene.sceneNumber,
              "剧本/动作": scene.script,
              "画面提示词": scene.visualPrompt || "",
              "Sora提示词(中)": scene.videoPromptZh || "",
              "Sora提示词(英)": scene.videoPrompt || "",
              "图片文件名": `scene_${scene.sceneNumber}.png`,
              "视频链接": scene.videoUrls?.join(', ') || ""
          }));
          
          scenes.forEach(scene => { if (scene.imageUrl) imgFolder?.file(`scene_${scene.sceneNumber}.png`, scene.imageUrl, { base64: true }); });
          
          const worksheet = XLSX.utils.json_to_sheet(excelData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Script & Prompts");
          const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
          zip.file("project_data.xlsx", excelBuffer);
          const content = await zip.generateAsync({ type: "blob" });
          const url = window.URL.createObjectURL(content);
          const link = document.createElement('a'); link.href = url; 
          // Use topic as filename if available
          const safeTopic = topic ? topic.trim().replace(/[\\/:*?"<>|]/g, '_') : `${agentConfig.appName}_Project`;
          link.download = `${safeTopic}.zip`; 
          document.body.appendChild(link); link.click(); document.body.removeChild(link);
      } catch (error) { console.error("Export failed:", error); } finally { setIsExporting(false); }
  };

  const startFullPreview = () => {
      setCurrentPreviewIndex(0);
      setIsPreviewOpen(true);
  };

  const nextPreviewScene = () => {
      if (currentPreviewIndex < scenes.length - 1) {
          setCurrentPreviewIndex(prev => prev + 1);
      } else {
          setIsPreviewOpen(false);
      }
  };

  useEffect(() => {
      if (isPreviewOpen) {
          const currentScene = scenes[currentPreviewIndex];
          const video = previewVideoRef.current;
          const audio = previewAudioRef.current;

          if (audio && currentScene.audioUrl) {
              audio.src = currentScene.audioUrl;
              audio.play().catch(e => console.error("Audio play failed", e));
          }

          if (video && currentScene.videoUrls && currentScene.videoUrls.length > 0) {
              video.src = currentScene.videoUrls[0];
              video.play().catch(e => console.error("Video play failed", e));
          }
      }
  }, [isPreviewOpen, currentPreviewIndex, scenes]);

  return (
    <div className="space-y-12 pb-20 max-w-[1600px] mx-auto animate-fade-in relative px-4">
      {/* Full Preview Modal */}
      {isPreviewOpen && (
          <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 md:p-10">
              <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="absolute top-6 right-6 text-white hover:text-[#FACC15] transition-colors z-50"
              >
                  <X size={48} strokeWidth={3} />
              </button>

              <div className="w-full max-w-5xl flex flex-col gap-6">
                  <div className="relative bg-black border-4 border-white overflow-hidden flex items-center justify-center" style={{ aspectRatio: aspectRatio === '9:16' ? '9/16' : '16/9', maxHeight: '70vh', margin: '0 auto' }}>
                      {scenes[currentPreviewIndex].videoUrls && scenes[currentPreviewIndex].videoUrls!.length > 0 ? (
                          <video 
                              ref={previewVideoRef}
                              className="w-full h-full object-contain"
                              onEnded={() => {
                                  if (!scenes[currentPreviewIndex].audioUrl) {
                                      nextPreviewScene();
                                  }
                              }}
                              autoPlay
                              muted={!!scenes[currentPreviewIndex].audioUrl}
                          />
                      ) : (
                          <img 
                              src={scenes[currentPreviewIndex].imageUrl ? `data:image/png;base64,${scenes[currentPreviewIndex].imageUrl}` : 'https://picsum.photos/seed/placeholder/800/450'} 
                              className="w-full h-full object-contain"
                              alt="Preview"
                          />
                      )}
                      
                      {/* Audio element (hidden) */}
                      <audio 
                          ref={previewAudioRef}
                          onEnded={nextPreviewScene}
                          autoPlay
                      />

                      {/* Subtitles/Script Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-6 text-center">
                          <p className="text-white text-2xl font-bold tracking-wide">
                              {scenes[currentPreviewIndex].script}
                          </p>
                      </div>

                      {/* Progress Indicator */}
                      <div className="absolute top-0 left-0 right-0 h-2 bg-gray-800 flex">
                          {scenes.map((_, i) => (
                              <div 
                                  key={i} 
                                  className={clsx(
                                      "h-full transition-all duration-300",
                                      i < currentPreviewIndex ? "bg-[#10B981] w-full" : 
                                      i === currentPreviewIndex ? "bg-[#FACC15] w-full" : "bg-transparent w-full"
                                  )}
                                  style={{ borderRight: i < scenes.length - 1 ? '1px solid black' : 'none' }}
                              />
                          ))}
                      </div>
                  </div>

                  <div className="flex justify-between items-center text-white">
                      <div className="flex flex-col">
                          <span className="font-bangers text-3xl text-[#FACC15]">分镜 {currentPreviewIndex + 1} / {scenes.length}</span>
                          <span className="text-xl opacity-80">分镜 {scenes[currentPreviewIndex].sceneNumber}</span>
                      </div>
                      <div className="flex gap-4">
                          <button 
                              onClick={() => setCurrentPreviewIndex(prev => Math.max(0, prev - 1))}
                              disabled={currentPreviewIndex === 0}
                              className="p-4 bg-white/10 hover:bg-white/20 border-2 border-white disabled:opacity-30"
                          >
                              <ChevronDown className="rotate-90" size={32} />
                          </button>
                          <button 
                              onClick={nextPreviewScene}
                              className="p-4 bg-[#FACC15] text-black border-2 border-black hover:scale-105 transition-transform"
                          >
                              <ChevronDown className="-rotate-90" size={32} />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6 relative">
        <div className="flex-1 space-y-3">
            <div className="flex items-center gap-4">
                <h2 className="text-6xl font-bangers text-white uppercase tracking-wider">Step 5. Storyboard</h2>
                <div className="relative group">
                    <select 
                        value={currentEpisode}
                        onChange={(e) => onViewEpisode(Number(e.target.value))}
                        className="appearance-none bg-[#FACC15] text-black font-normal text-lg px-6 py-1.5 border border-black pr-10 cursor-pointer hover:bg-yellow-300 transition-colors"
                    >
                        {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map(ep => (
                            <option key={ep} value={ep}>第 {ep} 集</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black" size={20} strokeWidth={3} />
                </div>
            </div>
            <p className="text-white text-xl font-normal bg-black inline-block px-4 py-1 transform -skew-x-12 border-2 border-white">分镜完成。您可以编辑、重绘分镜图</p>
        </div>
        
        <div className="flex gap-3 pb-2">
            <button 
                onClick={handleExportProject}
                disabled={isExporting}
                className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] text-black px-6 py-1.5 border border-black font-normal text-lg hover:-translate-y-1 transition-all"
            >
                <Archive size={20} /> {isExporting ? '压缩中...' : '素材下载'}
            </button>
        </div>
      </div>

      <div className="bg-black p-8 border-4 border-white relative mt-8">
          <div className="absolute -top-5 left-10 bg-white border-2 border-black px-4 py-1 font-bangers text-xl transform -rotate-1">
             STORYBOARD (分镜画面)
          </div>
          <div className={clsx(
              "grid gap-8 pt-4",
              aspectRatio === '9:16' 
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
                : "grid-cols-1 md:grid-cols-2"
          )}>
              {scenes.map((scene, index) => (
                  <SceneImageCard 
                      key={scene.sceneNumber}
                      scene={scene}
                      index={index}
                      aspectRatio={aspectRatio}
                      onRegenerate={() => onRegenerateImage(index)}
                      onUpdatePrompt={onUpdatePrompt}
                      onUpdateScript={onUpdateScript}
                      onEnlarge={onEnlarge}
                      onDownload={() => scene.imageUrl && handleDownloadImage(scene.imageUrl, scene.sceneNumber)}
                      onUpload={(f) => onManualUpload(index, f)}
                      onEditImage={onEditImage}
                      onInsertScene={onInsertScene}
                      onDeleteScene={onDeleteScene}
                  />
              ))}
          </div>
      </div>

      {/* Global Audio Generation Section */}
      <div className="bg-black p-8 border-4 border-white relative mt-10">
          <div className="absolute -top-5 left-10 bg-white border-2 border-black px-4 py-1 font-bangers text-xl transform -rotate-1">
             NARRATION (配音文案)
          </div>
          <div className="space-y-4">
              <div className="space-y-2">
                  {(globalNarration || '').split('\n').map((line, idx) => (
                      <div key={idx} className="flex items-start gap-2 group">
                          <textarea 
                              value={line}
                              onChange={(e) => {
                                  const newLines = (globalNarration || '').split('\n');
                                  newLines[idx] = e.target.value;
                                  onUpdateGlobalNarration?.(newLines.join('\n'));
                              }}
                              onPaste={(e) => {
                                  const pastedText = e.clipboardData.getData('text');
                                  if (pastedText.includes('\n')) {
                                      e.preventDefault();
                                      const pastedLines = pastedText.split('\n').map(l => l.trim()).filter(Boolean);
                                      if (pastedLines.length === 0) return;
                                      const currentLines = (globalNarration || '').split('\n');
                                      const newLines = [
                                          ...currentLines.slice(0, idx),
                                          currentLines[idx] + pastedLines[0],
                                          ...pastedLines.slice(1),
                                          ...currentLines.slice(idx + 1)
                                      ];
                                      onUpdateGlobalNarration?.(newLines.join('\n'));
                                  }
                              }}
                              placeholder="（语气/节奏/重音等..）文案"
                              className="flex-1 h-10 bg-white border-2 border-black py-1.5 px-4 text-lg font-normal font-comic outline-none resize-none overflow-hidden text-black leading-relaxed placeholder:text-gray-400 focus:bg-yellow-50 transition-colors"
                          />
                          <button
                              onClick={() => {
                                  const newLines = (globalNarration || '').split('\n').filter((_, i) => i !== idx);
                                  onUpdateGlobalNarration?.(newLines.join('\n'));
                              }}
                              className="mt-1.5 p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              title="删除此行"
                          >
                              <Trash2 size={18} />
                          </button>
                      </div>
                  ))}
                  <button
                      onClick={() => {
                          const newLines = [...(globalNarration || '').split('\n'), ''];
                          onUpdateGlobalNarration?.(newLines.join('\n'));
                      }}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-2"
                  >
                      <Plus size={18} />
                      <span>添加一行配音</span>
                  </button>
              </div>
              <div className="flex flex-col gap-4 pt-4 border-t-2 border-gray-800">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex-1 flex items-center gap-4">
                          <div className="relative w-[270px] shrink-0">
                              <select 
                                value={selectedVoice}
                                onChange={(e) => setSelectedVoice(e.target.value)}
                                className="w-full h-12 bg-white border-4 border-black px-4 text-lg font-normal outline-none appearance-none cursor-pointer hover:bg-gray-50 uppercase"
                              >
                                  {VOICES.map(v => (
                                      <option key={v.id} value={v.id}>{v.name}</option>
                                  ))}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                                  <ChevronDown className="rotate-90" size={16} strokeWidth={3} />
                              </div>
                          </div>
                          
                          <button 
                              onClick={() => onGenerateGlobalAudio?.(selectedVoice)}
                              disabled={isGeneratingGlobalAudio || !globalNarration}
                              className={clsx(
                                  "flex items-center justify-center gap-2 h-12 px-6 border-4 border-black text-lg font-normal transition-all hover:-translate-y-1",
                                  isGeneratingGlobalAudio 
                                      ? "bg-gray-400 text-gray-200 cursor-not-allowed" 
                                      : "bg-[#FACC15] text-black hover:bg-[#EAB308]"
                              )}
                          >
                              {isGeneratingGlobalAudio ? <RefreshCw size={20} className="animate-spin" /> : <Wand2 size={20} />}
                              {isGeneratingGlobalAudio ? '生成中...' : '生成音频'}
                          </button>

                          {globalAudioUrl ? (
                              <div className="flex items-center bg-white px-2 border-4 border-black flex-1 h-12">
                                  <audio src={globalAudioUrl} controls controlsList="nodownload" className="flex-1 h-8 outline-none" />
                              </div>
                          ) : (
                              <div className="text-gray-400 italic text-lg flex-1 flex items-center h-12">尚未生成音频</div>
                          )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                          {globalAudioUrl && (
                              <button 
                                  onClick={handleDownloadAudio}
                                  className="flex items-center justify-center h-12 w-12 bg-white border-4 border-black hover:bg-gray-100 transition-all hover:-translate-y-1 text-black"
                                  title="下载音频"
                              >
                                  <Download size={20} />
                              </button>
                          )}
                      </div>
                  </div>

                  {(currentEpisode > 1 || currentEpisode < totalEpisodes) && (
                      <div className="flex items-center justify-end gap-4 pt-4 border-t-2 border-gray-800">
                          {currentEpisode > 1 && (
                              <button 
                                  onClick={() => onViewEpisode(currentEpisode - 1)}
                                  className="flex items-center justify-center gap-2 h-12 px-6 bg-[#3B82F6] hover:bg-[#2563EB] text-white border-4 border-black text-lg font-normal transition-all hover:-translate-y-1"
                              >
                                  <PlayCircle size={20} className="rotate-180" />
                                  查看第{currentEpisode - 1}集
                              </button>
                          )}
                          {currentEpisode < totalEpisodes && (
                              (episodesScenes[currentEpisode + 1] && episodesScenes[currentEpisode + 1].length > 0) ? (
                                <button 
                                    onClick={() => onViewEpisode(currentEpisode + 1)}
                                    className="flex items-center justify-center gap-2 h-12 px-6 bg-[#3B82F6] hover:bg-[#2563EB] text-white border-4 border-black text-lg font-normal transition-all hover:-translate-y-1"
                                >
                                    <PlayCircle size={20} />
                                    查看第{currentEpisode + 1}集
                                </button>
                              ) : (
                                <button 
                                    onClick={() => onGenerateEpisodeStoryboard(currentEpisode + 1)}
                                    className="flex items-center justify-center gap-2 h-12 px-6 bg-[#EF4444] hover:bg-[#DC2626] text-white border-4 border-black text-lg font-normal transition-all hover:-translate-y-1"
                                >
                                    <Sparkles size={20} />
                                    生成第{currentEpisode + 1}集
                                </button>
                              )
                          )}
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

interface SceneImageCardProps {
    scene: Scene;
    index: number;
    aspectRatio: '9:16' | '16:9';
    onRegenerate: () => void;
    onUpdatePrompt: (i: number, p: string, l: 'en' | 'zh') => void;
    onUpdateScript?: (i: number, s: string) => void;
    onEnlarge: (url: string, type: 'image' | 'video') => void;
    onDownload: () => void;
    onUpload: (f: File) => void;
    onEditImage?: (index: number, instruction: string) => void;
    onInsertScene?: (index: number) => void;
    onDeleteScene?: (index: number) => void;
}

const SceneImageCard: React.FC<SceneImageCardProps> = ({ 
    scene, index, aspectRatio, onRegenerate, onUpdatePrompt, onUpdateScript,
    onEnlarge, onDownload, onUpload, onEditImage, onInsertScene, onDeleteScene
}) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const editBoxRef = useRef<HTMLDivElement>(null);
    const redrawBoxRef = useRef<HTMLDivElement>(null);
    const [isEditingInstruction, setIsEditingInstruction] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [localInstruction, setLocalInstruction] = useState('');
    const [localPrompt, setLocalPrompt] = useState(scene.visualPromptZh || scene.visualPrompt || '');
    const [localScript, setLocalScript] = useState(scene.script || '');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isEditingInstruction && editBoxRef.current && !editBoxRef.current.contains(event.target as Node)) {
                setIsEditingInstruction(false);
            }
            if (isEditingPrompt && redrawBoxRef.current && !redrawBoxRef.current.contains(event.target as Node)) {
                setIsEditingPrompt(false);
            }
        };

        if (isEditingInstruction || isEditingPrompt) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isEditingInstruction, isEditingPrompt]);

    useEffect(() => {
        if (isEditingPrompt) {
            setLocalPrompt(scene.visualPromptZh || scene.visualPrompt || '');
            setLocalScript(scene.script || '');
        }
    }, [isEditingPrompt, scene.visualPromptZh, scene.visualPrompt, scene.script]);

    const aspectClass = aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video';

    const handleInstructionSubmit = () => {
        if (localInstruction.trim() && onEditImage) {
            onEditImage(index, localInstruction.trim());
            setIsEditingInstruction(false);
            setLocalInstruction('');
        }
    };

    const handleRegenerateSubmit = () => {
        if (localPrompt !== (scene.visualPromptZh || scene.visualPrompt)) {
            onUpdatePrompt(index, localPrompt, 'zh');
        }
        if (localScript !== scene.script && onUpdateScript) {
            onUpdateScript(index, localScript);
        }
        onRegenerate();
        setIsEditingPrompt(false);
    };

    return (
        <div className="bg-black border-0 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="relative w-full bg-black overflow-hidden flex items-center justify-center">
                 {/* Blurred Background */}
                 {scene.imageUrl && (
                     <div 
                        className="absolute inset-0 z-0 opacity-40 blur-2xl scale-125"
                        style={{ 
                            backgroundImage: `url(data:image/png;base64,${scene.imageUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                     />
                 )}
                 <div className="relative w-full h-full flex items-center justify-center z-10">
                    <div className={clsx("relative w-full transition-all group flex items-center justify-center", aspectClass)}>
                        {/* Image Display */}
                        {scene.imageUrl && (
                            <img 
                                src={`data:image/png;base64,${scene.imageUrl}`} 
                                className="w-full h-full object-contain block" 
                                alt={`Scene ${scene.sceneNumber}`}
                            />
                        )}

                        {/* Generation Overlays */}
                        {scene.isGeneratingImage && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-20 border-2 border-black">
                                <RefreshCw className="animate-spin text-black mb-2" size={32} />
                                <span className="font-bangers text-black text-xl animate-pulse">正在绘制...</span>
                            </div>
                        )}
                        
                        {/* Top-Right Icon Controls */}
                        {!scene.isGeneratingImage && (
                            <div className="absolute top-2 right-2 flex gap-2 z-50">
                                {scene.imageUrl && (
                                    <button onClick={() => onEnlarge(scene.imageUrl!, 'image')} className="bg-black/60 text-white border border-white/40 p-1.5 hover:bg-[#FACC15] hover:text-black transition-colors rounded-sm" title="放大">
                                        <Maximize2 size={18} />
                                    </button>
                                )}
                                {scene.imageUrl && (
                                    <button 
                                        onClick={() => {
                                            setIsEditingInstruction(!isEditingInstruction);
                                            setIsEditingPrompt(false);
                                        }} 
                                        className={clsx(
                                            "border border-white/40 p-1.5 transition-colors rounded-sm",
                                            isEditingInstruction ? "bg-[#FACC15] text-black" : "bg-black/60 text-white hover:bg-[#FACC15] hover:text-black"
                                        )} 
                                        title="编辑"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                )}
                                <button 
                                    onClick={() => {
                                        setIsEditingPrompt(!isEditingPrompt);
                                        setIsEditingInstruction(false);
                                    }} 
                                    className={clsx(
                                        "border border-white/40 p-1.5 transition-colors rounded-sm",
                                        isEditingPrompt ? "bg-[#FACC15] text-black" : "bg-black/60 text-white hover:bg-[#FACC15] hover:text-black"
                                    )} 
                                    title="重绘/修改"
                                >
                                    <RefreshCw size={18} />
                                </button>
                                <button onClick={() => onDeleteScene?.(index)} className="bg-black/60 text-white border border-white/40 p-1.5 hover:bg-red-500 hover:text-white transition-colors rounded-sm" title="删除此场景">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                        
                        {/* No Image State */}
                        {!scene.imageUrl && !scene.isGeneratingImage && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center border-2 border-black bg-gray-200">
                                {scene.error ? (
                                    <>
                                        <AlertTriangle className="text-red-500 mb-2" size={24} />
                                        <p className="text-[10px] font-normal text-red-600 mb-2 leading-tight">{scene.error}</p>
                                        <button onClick={onRegenerate} className="bg-red-100 border-2 border-red-500 text-red-600 px-2 py-1 font-normal text-[10px] uppercase hover:bg-red-200">重试</button>
                                    </>
                                ) : (
                                    <>
                                        <ImagePlus className="text-gray-400 mb-2" size={32} />
                                        <span className="text-gray-500 font-normal text-lg">无图片</span>
                                        <div className="flex flex-wrap gap-2 justify-center mt-2 relative z-50">
                                            <button 
                                                onClick={() => setIsEditingPrompt(true)} 
                                                className="bg-white text-black border-2 border-black px-3 py-1 font-normal text-lg hover:bg-gray-100 flex items-center gap-2"
                                            >
                                                <Edit2 size={16} /> 编辑
                                            </button>
                                            <button onClick={onRegenerate} className="bg-black text-white border-2 border-black px-3 py-1 font-normal text-lg hover:bg-gray-800 flex items-center gap-2">
                                                <RefreshCw size={16} /> 生成
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        
                        <div className="absolute top-0 left-0 flex items-center z-40">
                            <div className="bg-black text-white px-2 py-0.5 font-normal text-sm">
                                场景 {String(scene.sceneNumber).padStart(2,'0')}
                            </div>
                        </div>

                        {/* Inline Instruction Box (Inside image area at bottom) */}
                        {isEditingInstruction && (
                            <div ref={editBoxRef} className="absolute bottom-0 left-0 right-0 bg-black/80 p-3 text-white z-50 backdrop-blur-md border-t border-white/20 animate-in slide-in-from-bottom duration-200">
                                <textarea 
                                    value={localInstruction}
                                    onChange={(e) => setLocalInstruction(e.target.value)}
                                    placeholder="输入修改指令，例如：让角色笑得更开心..."
                                    className="w-full bg-white/10 border border-white/20 p-2 text-xs text-white outline-none focus:border-[#FACC15] resize-none h-20"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-6 mt-2">
                                    <button 
                                        onClick={() => setIsEditingInstruction(false)}
                                        className="text-xs text-white hover:text-[#FACC15] hover:scale-105 transition-all"
                                    >
                                        取消
                                    </button>
                                    <button 
                                        onClick={handleInstructionSubmit}
                                        disabled={!localInstruction.trim()}
                                        className="text-xs text-white hover:text-[#FACC15] hover:scale-105 transition-all font-normal disabled:opacity-50"
                                    >
                                        执行修改
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Inline Redraw Box (Same style as instruction box) */}
                        {isEditingPrompt && (
                            <div ref={redrawBoxRef} className="absolute bottom-0 left-0 right-0 bg-black/80 p-3 text-white z-50 backdrop-blur-md border-t border-white/20 animate-in slide-in-from-bottom duration-200 flex flex-col gap-2">
                                <textarea 
                                    value={localScript}
                                    onChange={(e) => setLocalScript(e.target.value)}
                                    placeholder="修改剧本/动作..."
                                    className="w-full bg-white/10 border border-white/20 p-2 text-xs text-white outline-none focus:border-[#FACC15] resize-none h-16"
                                />
                                <textarea 
                                    value={localPrompt}
                                    onChange={(e) => setLocalPrompt(e.target.value)}
                                    placeholder="修改绘画提示词..."
                                    className="w-full bg-white/10 border border-white/20 p-2 text-xs text-white outline-none focus:border-[#FACC15] resize-none h-20"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-6 mt-1">
                                    <button 
                                        onClick={() => setIsEditingPrompt(false)}
                                        className="text-xs text-white hover:text-[#FACC15] hover:scale-105 transition-all"
                                    >
                                        取消
                                    </button>
                                    <button 
                                        onClick={handleRegenerateSubmit}
                                        className="text-xs text-white hover:text-[#FACC15] hover:scale-105 transition-all font-normal"
                                    >
                                        确认重绘
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default StoryboardGrid;
