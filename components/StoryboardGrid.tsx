
import React, { useState, useRef, useEffect } from 'react';
import { Scene, AssetItem, VideoModel } from '../types';
import { getValidDurations, VOICES } from '../constants';
import { RefreshCw, Download, Maximize2, Wand2, X, Archive, AlertTriangle, ImagePlus, Edit2, Upload, Film, Trash2, LayoutGrid, PlayCircle, Clapperboard, ChevronDown, Layers, Clock, Zap, FileText, Image as ImageIcon, Video, List, Music } from 'lucide-react';
import { clsx } from 'clsx';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { agentConfig } from '../agentConfig';

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
  onUpdateScript: (sceneIndex: number, newScript: string) => void;
  onUpdateVideoPrompt?: (sceneIndex: number, newPrompt: string) => void;
  onSelectSceneImage?: (sceneIndex: number, historyIndex: number) => void;
  onManualUpload: (sceneIndex: number, file: File) => void;
  onDeleteImage: (sceneIndex: number) => void;
  onEnlarge: (base64Image: string) => void;
  aspectRatio: '9:16' | '16:9';
  videoModel: VideoModel;
  onGenerateVideo?: (sceneIndex: number, duration: number, model: VideoModel) => void;
  onGenerateAudio?: (sceneIndex: number, prompt: string, voiceConfig: { voiceName?: string; multiSpeakerVoiceConfig?: { speakerVoiceConfigs: { speaker: string; voiceName: string }[] } }) => void;
  onBatchGenerateVideos?: (model: VideoModel) => void;
  onEditImage?: (sceneIndex: number, instruction: string) => void;
  onRefinePrompt?: (sceneIndex: number) => void;
  topic?: string;
  onCancelVideoGeneration?: (sceneIndex: number) => void;
}

const StoryboardGrid: React.FC<Props> = ({ 
    scenes, assets, onRegenerateImage, onUpdatePrompt, onUpdateScript, onUpdateVideoPrompt,
    onSelectSceneImage, onManualUpload, onDeleteImage, onEnlarge, aspectRatio, videoModel, onGenerateVideo, onGenerateAudio, onBatchGenerateVideos, onEditImage, onRefinePrompt, topic,
    onCancelVideoGeneration
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  
  const handleDownloadImage = (base64Data: string, sceneNum: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Data}`;
    link.download = `scene_${sceneNum}.png`;
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

  const submitEdit = () => {
      if (editingSceneIndex !== null && editInstruction.trim() && onEditImage) {
          onEditImage(editingSceneIndex, editInstruction.trim());
          setEditingSceneIndex(null);
          setEditInstruction('');
      }
  };

  return (
    <div className="space-y-12 pb-20 max-w-7xl mx-auto animate-fade-in relative">
      {/* Edit Modal */}
      {editingSceneIndex !== null && (
          <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4">
              <div className="bg-white border-4 border-black p-8 max-w-lg w-full comic-shadow-lg animate-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
                      <h3 className="text-3xl font-normal text-black flex items-center gap-2">
                          <Wand2 className="text-[#FACC15]" size={32} /> 
                          AI 魔法编辑
                      </h3>
                      <button onClick={() => setEditingSceneIndex(null)} className="text-black hover:text-red-500 transition-colors">
                          <X size={32} strokeWidth={3} />
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      {scenes[editingSceneIndex].imageUrl && (
                          <div className="w-full h-48 bg-black border-2 border-black overflow-hidden mb-4 relative">
                              <img src={`data:image/png;base64,${scenes[editingSceneIndex].imageUrl}`} className="w-full h-full object-contain" />
                          </div>
                      )}
                      
                      <div>
                          <label className="text-xl font-normal text-black mb-2 block">修改指令</label>
                          <textarea 
                              value={editInstruction}
                              onChange={(e) => setEditInstruction(e.target.value)}
                              placeholder="例如：让角色转过身，或者让天开始下雨..."
                              className="w-full bg-gray-100 border-2 border-black p-4 text-black focus:bg-white outline-none resize-none h-32 text-lg font-normal"
                              autoFocus
                          />
                      </div>
                      
                      <div className="flex justify-end gap-3 pt-4">
                          <button onClick={() => setEditingSceneIndex(null)} className="px-6 py-3 bg-gray-200 border-2 border-black hover:bg-gray-300 text-black font-normal tracking-wide text-xl">
                              取消
                          </button>
                          <button 
                            onClick={submitEdit}
                            disabled={!editInstruction.trim()}
                            className="px-8 py-3 bg-[#FACC15] border-2 border-black hover:bg-[#EAB308] text-black font-normal tracking-wide text-xl disabled:opacity-50"
                          >
                              应用魔法
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end border-b-4 border-black pb-6 gap-6">
        <div className="flex-1 space-y-3">
            <h2 className="text-6xl font-bangers text-white uppercase tracking-wider drop-shadow-[4px_4px_0_#000]">Step 5. The Production</h2>
            <p className="text-white text-xl font-normal bg-black inline-block px-4 py-1 transform -skew-x-12 border-2 border-white">分镜完成。您可以调整、重绘并生成视频</p>
            
            <div className="flex flex-wrap items-center gap-4 mt-6">
                <span className="text-sm font-bold text-black bg-[#FACC15] px-3 py-1 border-2 border-black transform -skew-x-12">
                RATIO: {aspectRatio}
                </span>
            </div>
        </div>
        
        <div className="flex gap-3">
            <a 
                href={`${getBaseUrl()}/console/task`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 bg-white hover:bg-gray-100 text-black px-8 py-3 border-4 border-black font-normal text-xl hover:-translate-y-1 transition-all no-underline"
            >
                <List size={20} /> 任务 (查询进度)
            </a>

            <button 
                onClick={handleExportProject}
                disabled={isExporting}
                className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] text-black px-8 py-3 border-4 border-black font-normal text-xl hover:-translate-y-1 transition-all"
            >
                <Archive size={20} /> {isExporting ? '压缩中...' : '导出 ZIP（素材下载）'}
            </button>
        </div>
      </div>

      <div className="flex flex-col gap-10">
          {scenes.map((scene, index) => (
             <SceneRow 
                key={scene.sceneNumber}
                scene={scene}
                index={index}
                aspectRatio={aspectRatio}
                videoModel={videoModel}
                characters={assets.characters}
                onRegenerate={() => onRegenerateImage(index)}
                onUpdatePrompt={onUpdatePrompt}
                onUpdateScript={onUpdateScript}
                onUpdateVideoPrompt={onUpdateVideoPrompt}
                onEnlarge={onEnlarge}
                onDownload={() => scene.imageUrl && handleDownloadImage(scene.imageUrl, scene.sceneNumber)}
                onUpload={(f) => onManualUpload(index, f)}
                onDelete={() => onDeleteImage(index)}
                onGenerateVideo={(duration) => onGenerateVideo && onGenerateVideo(index, duration, videoModel)}
                onGenerateAudio={(prompt, voiceConfig) => onGenerateAudio && onGenerateAudio(index, prompt, voiceConfig)}
                onEditImage={() => setEditingSceneIndex(index)}
                onCancelVideo={() => onCancelVideoGeneration && onCancelVideoGeneration(index)}
             />
          ))}
      </div>
    </div>
  );
};

interface CardProps {
    scene: Scene;
    index: number;
    aspectRatio: '9:16' | '16:9';
    videoModel: VideoModel;
    characters: AssetItem[];
    onRegenerate: () => void;
    onUpdatePrompt: (i: number, p: string, l: 'en' | 'zh') => void;
    onUpdateScript: (i: number, s: string) => void;
    onUpdateVideoPrompt?: (i: number, p: string) => void;
    onEnlarge: (img: string) => void;
    onDownload: () => void;
    onUpload: (f: File) => void;
    onDelete: () => void;
    onGenerateVideo: (duration: number) => void;
    onGenerateAudio: (prompt: string, voiceConfig: { voiceName?: string; multiSpeakerVoiceConfig?: { speakerVoiceConfigs: { speaker: string; voiceName: string }[] } }) => void;
    onEditImage: () => void;
    onCancelVideo?: () => void;
}

const SceneRow: React.FC<CardProps> = ({ 
    scene, index, aspectRatio, videoModel, characters, onRegenerate, onUpdatePrompt, onUpdateScript, onUpdateVideoPrompt,
    onEnlarge, onDownload, onUpload, onDelete, onGenerateVideo, onGenerateAudio, onEditImage, onCancelVideo
}) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const aspectClass = aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video';
    const gridItemAspectClass = aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video';
    
    // Tab state
    const [activeTab, setActiveTab] = useState<'script' | 'visual' | 'video'>('script');
    const [showImage, setShowImage] = useState(false);
    
    // Audio state
    const [speakerA, setSpeakerA] = useState({ name: characters[0]?.name || '角色 A', voice: 'Kore', prompt: '' });
    const [speakerB, setSpeakerB] = useState({ name: characters[1]?.name || '角色 B', voice: 'Puck', prompt: '' });

    // Sync speaker state with scene.audios
    useEffect(() => {
        if (scene.audios && scene.audios.length >= 2) {
            setSpeakerA({
                name: scene.audios[0].name || characters[0]?.name || '角色 A',
                voice: scene.audios[0].voice || 'Kore',
                prompt: scene.audios[0].prompt || ''
            });
            setSpeakerB({
                name: scene.audios[1].name || characters[1]?.name || '角色 B',
                voice: scene.audios[1].voice || 'Puck',
                prompt: scene.audios[1].prompt || ''
            });
        }
    }, [scene.audios, characters]);

    // Duration Logic
    const isVeo = videoModel.includes('veo');
    const isGrok10 = videoModel === 'grok-video-3-10s';
    const isGrok15 = videoModel === 'grok-video-3-15s';
    
    const [selectedDuration, setSelectedDuration] = useState<8 | 10 | 15>(scene.videoDuration || (isVeo ? 8 : isGrok10 ? 10 : isGrok15 ? 15 : 10) as 8 | 10 | 15);

    // Sync duration when model changes
    useEffect(() => {
        const validDurations = getValidDurations(videoModel);
        if (!validDurations.includes(selectedDuration)) {
            setSelectedDuration(validDurations[0]);
        }
    }, [videoModel]);

    const videoUrls = scene.videoUrls || (scene.videoUrl ? [scene.videoUrl] : []);
    const hasMultipleVideos = videoUrls.length > 1;

    const uploadBtnClass = "flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] text-black px-6 py-2 border-2 border-black font-bangers text-xl hover:-translate-y-1 transition-all";

    return (
        <div className="bg-white border-4 border-black p-0 flex flex-col relative h-auto">
            <div className="flex flex-col md:flex-row relative h-auto">
                 {/* Left Column: Image/Video Display (Expanded Space) */}
            <div className={`relative flex-1 bg-black border-b-4 md:border-b-0 md:border-r-4 border-black min-h-[400px] overflow-hidden flex items-center justify-center`}>
                 {/* Blurred Background for both orientations */}
                 {scene.imageUrl && (
                     <div 
                        className="absolute inset-0 z-0 opacity-60 blur-3xl scale-125"
                        style={{ 
                            backgroundImage: `url(data:image/png;base64,${scene.imageUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                     />
                 )}
                 <div className={`relative w-full h-full flex items-center justify-center z-10 p-2`}>
                    <div className={clsx(
                        "relative w-full h-full max-h-[800px] transition-all group shadow-2xl flex items-center justify-center", 
                        !hasMultipleVideos && aspectClass
                    )}>
                        
                        {/* Image Display */}
                        {scene.imageUrl && (
                            <img 
                                src={`data:image/png;base64,${scene.imageUrl}`} 
                                className={clsx("w-full h-full object-contain", (videoUrls.length > 0 && !showImage) ? "opacity-50" : "opacity-100")} 
                                alt={`Scene ${scene.sceneNumber}`}
                            />
                        )}

                        {/* Video Overlay/Display */}
                        {videoUrls.length > 0 && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
                                {videoUrls.slice(0, 1).map((url, idx) => (
                                    <div key={idx} className="relative bg-black/20 w-full h-full flex items-center justify-center">
                                        <video 
                                            src={url} 
                                            controls 
                                            className="w-full h-full object-contain shadow-2xl"
                                            autoPlay={idx === 0}
                                            loop
                                            muted
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Generation Overlays */}
                        {scene.isGeneratingVideo && (
                             <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center text-center p-4">
                                    {/* Stop Button */}
                                    {onCancelVideo && (
                                        <button 
                                            onClick={onCancelVideo}
                                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full border-2 border-white shadow-md z-50 transition-transform hover:scale-110"
                                            title="Stop Video Generation"
                                        >
                                            <X size={24} strokeWidth={3} />
                                        </button>
                                    )}
                                    <RefreshCw className="animate-spin text-[#FACC15] mb-4" size={48} />
                                    <span className="font-bangers text-white text-3xl tracking-wider uppercase">GENERATING {videoModel.replace('_', ' ').replace('-fast', '').toUpperCase()}...</span>
                                    <p className="text-gray-300 font-sans font-normal mt-2 text-sm">THIS MAY TAKE A FEW MINUTES</p>
                                </div>
                        )}
                        {scene.isGeneratingImage && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-20 border-2 border-black">
                                <RefreshCw className="animate-spin text-black mb-2" size={32} />
                                <span className="font-bangers text-black text-xl animate-pulse">DRAWING...</span>
                            </div>
                        )}
                        
                        {/* Hover Overlay Controls (Only for Image) */}
                        {!scene.isGeneratingVideo && scene.imageUrl && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col items-center justify-center gap-3 p-4">
                                <div className="flex gap-2">
                                    <button onClick={() => onEnlarge(scene.imageUrl!)} className="bg-white border-2 border-black p-3 hover:bg-gray-100 transform hover:scale-110 transition-transform" title="放大">
                                        <Maximize2 size={24} />
                                    </button>
                                    <button onClick={onDownload} className="bg-[#FACC15] border-2 border-black p-3 hover:bg-[#EAB308] transform hover:scale-110 transition-transform" title="下载图片">
                                        <Download size={24} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2">
                                    <button onClick={onEditImage} className="bg-[#A78BFA] border-2 border-black px-4 py-2 font-normal tracking-wide text-white hover:bg-[#8B5CF6] flex items-center gap-2 text-xl">
                                        <Wand2 size={20} /> 编辑
                                    </button>
                                    <button onClick={() => fileRef.current?.click()} className={uploadBtnClass} title="上传新图片">
                                        <Upload size={20} /> 上传
                                    </button>
                                    <button onClick={onRegenerate} className="bg-[#3B82F6] border-2 border-black px-4 py-2 font-normal tracking-wide text-white hover:bg-[#2563EB] flex items-center gap-2 text-xl">
                                        <RefreshCw size={20} /> 重绘
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* No Image State */}
                        {!scene.imageUrl && !scene.isGeneratingImage && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center border-2 border-black bg-gray-200">
                                {scene.error ? (
                                    <>
                                        <AlertTriangle className="text-red-500 mb-2" size={32} />
                                        <p className="text-xs font-normal text-red-600 mb-2">{scene.error}</p>
                                        <button onClick={onRegenerate} className="bg-red-100 border-2 border-red-500 text-red-600 px-3 py-1 font-normal text-xs uppercase hover:bg-red-200">重试</button>
                                    </>
                                ) : (
                                    <>
                                        <ImagePlus className="text-gray-400 mb-2" size={48} />
                                        <span className="text-gray-500 font-normal text-xl">无图片</span>
                                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                                            <button onClick={onRegenerate} className="bg-black text-white border-2 border-black px-4 py-2 font-normal text-xl hover:bg-gray-800 flex items-center gap-2">
                                                <RefreshCw size={20} /> 生成
                                            </button>
                                            <button onClick={() => fileRef.current?.click()} className={uploadBtnClass}>
                                                <Upload size={20} /> 上传
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        
                        <div className="absolute top-0 left-0 bg-black text-white px-3 py-1 font-normal text-lg z-40">
                            场景 {String(scene.sceneNumber).padStart(2,'0')}
                        </div>
                     </div>
                 </div>
                 <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
            </div>
            
            {/* Right Column: Content & Actions (Fixed Width) */}
            <div className="md:w-[480px] p-6 flex flex-col gap-4 bg-white relative shrink-0">
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 flex flex-col">
                        {/* Redesigned Tabs - Optimized Style */}
                        <div className="flex p-1 bg-gray-200 border-2 border-black rounded-lg mb-4">
                            <button
                                onClick={() => setActiveTab('script')}
                                className={clsx(
                                    "flex-1 py-2 text-lg font-normal flex items-center justify-center gap-2 rounded-md transition-all border-2",
                                    activeTab === 'script' ? "bg-white border-black text-black" : "border-transparent text-gray-500 hover:text-black"
                                )}
                            >
                                <FileText size={16} /> 剧本
                            </button>
                            <button
                                onClick={() => setActiveTab('visual')}
                                className={clsx(
                                    "flex-1 py-2 text-lg font-normal flex items-center justify-center gap-2 rounded-md transition-all border-2",
                                    activeTab === 'visual' ? "bg-white border-black text-black" : "border-transparent text-gray-500 hover:text-black"
                                )}
                            >
                                <ImageIcon size={16} /> 画面
                            </button>
                            <button
                                onClick={() => setActiveTab('video')}
                                className={clsx(
                                    "flex-1 py-2 text-lg font-normal flex items-center justify-center gap-2 rounded-md transition-all border-2",
                                    activeTab === 'video' ? "bg-white border-black text-black" : "border-transparent text-gray-500 hover:text-black"
                                )}
                            >
                                <Video size={16} /> 视频
                            </button>
                        </div>

                        {activeTab === 'video' && (
                            <div className="mb-2 text-sm text-gray-600 bg-yellow-100 p-2 border-2 border-yellow-400 rounded">
                                💡 提示：因 veo、grok 等视频模型对中文台词的呈现效果欠佳，故视频中人物暂不设置口型动作，台词统一通过音频生成以旁白形式配音呈现。
                            </div>
                        )}
                        <textarea 
                            value={
                                activeTab === 'script' ? scene.script : 
                                activeTab === 'visual' ? scene.visualPrompt : 
                                activeTab === 'video' ? (scene.videoPrompt || `${scene.script}\n${scene.visualPrompt}`) : ''
                            }
                            onChange={(e) => {
                                if (activeTab === 'script') onUpdateScript(index, e.target.value);
                                else if (activeTab === 'visual') onUpdatePrompt(index, e.target.value, 'en');
                                else if (activeTab === 'video') {
                                    onUpdateVideoPrompt && onUpdateVideoPrompt(index, e.target.value);
                                }
                            }}
                            className="w-full bg-yellow-50 border-2 border-black p-4 text-lg font-medium font-sans resize-none flex-1 min-h-[500px] outline-none focus:bg-white transition-colors leading-relaxed"
                            placeholder={
                                activeTab === 'video' ? "视频生成提示词..." : ""
                            }
                        />
                    </div>
                </div>
                
                <div className="pt-4 border-t-2 border-gray-100 flex flex-col gap-3">
                     <div className="flex justify-between items-center mb-2">
                        <div className="text-xs font-normal text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            {aspectRatio} / {videoModel.toUpperCase().replace('-FAST','')}
                        </div>
                     </div>

                     <div className="flex gap-2 items-center">
                        <div className="relative flex-shrink-0">
                            {isVeo || isGrok10 || isGrok15 ? (
                                <div className="bg-white border-2 border-black px-3 py-3 font-normal text-lg h-full flex items-center justify-center min-w-[60px]">
                                    {selectedDuration}s
                                </div>
                            ) : (
                                <>
                                    <select 
                                        value={selectedDuration}
                                        onChange={(e) => setSelectedDuration(Number(e.target.value) as 8 | 10 | 15)}
                                        className="appearance-none bg-white border-2 border-black px-3 py-3 pr-8 font-normal text-lg focus:outline-none cursor-pointer hover:bg-gray-50 h-full"
                                    >
                                        {getValidDurations(videoModel).map(d => (
                                            <option key={d} value={d}>{d}s</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" size={16} />
                                </>
                            )}
                        </div>
                        
                        <button 
                            onClick={() => onGenerateVideo(selectedDuration)}
                            disabled={scene.isGeneratingVideo || !scene.imageUrl}
                            className={clsx(
                                "flex-1 px-4 py-3 font-normal tracking-wide text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg",
                                videoUrls.length > 0 ? "bg-[#10B981] hover:bg-[#059669] border-2 border-black" : "bg-black hover:bg-gray-800 border-2 border-black"
                            )}
                        >
                            {scene.isGeneratingVideo ? <RefreshCw className="animate-spin" size={20} /> : (videoUrls.length > 0 ? <PlayCircle size={20} /> : <Film size={20} />)}
                            {scene.isGeneratingVideo ? '制作中...' : (videoUrls.length > 0 ? '重新生成' : '生成视频')}
                        </button>
                     </div>
                     
                     {videoUrls.length > 0 && !scene.isGeneratingVideo && (
                         <div className="space-y-2 mt-2">
                            {videoUrls.map((url, i) => (
                                <a 
                                    key={i}
                                    href={url}
                                    download={`scene_${scene.sceneNumber}_v${i+1}.mp4`}
                                    className="w-full flex items-center justify-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] border-2 border-black py-2 font-normal tracking-wide text-black text-lg transition-colors uppercase"
                                >
                                    <Download size={18} /> 下载视频 V.{i+1}
                                </a>
                            ))}
                         </div>
                     )}
                </div>
            </div>
            </div>

            {/* Audio Section */}
            <div className="border-t-4 border-black p-2 bg-gray-50 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Music className="text-[#FACC15]" size={20} />
                    <h4 className="font-normal text-lg tracking-wide">音频生成</h4>
                </div>
                <div className="flex flex-col gap-2 border-2 border-black p-2 bg-white">
                    <div className="flex gap-2">
                        {/* Speaker A */}
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input type="text" value={speakerA.name} onChange={(e) => setSpeakerA({...speakerA, name: e.target.value})} placeholder="角色 A" className="border-2 border-black p-1 flex-1 font-normal text-lg tracking-wide" />
                                <select value={speakerA.voice} onChange={(e) => setSpeakerA({...speakerA, voice: e.target.value})} className="border-2 border-black p-1 font-normal text-lg tracking-wide">
                                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
                            <textarea
                                value={speakerA.prompt}
                                onChange={(e) => setSpeakerA({...speakerA, prompt: e.target.value})}
                                placeholder="角色 A 提示词..."
                                className="w-full bg-yellow-50 border-2 border-black p-2 text-lg font-medium font-sans resize-none h-32 outline-none focus:bg-white transition-colors"
                            />
                        </div>
                        {/* Speaker B */}
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input type="text" value={speakerB.name} onChange={(e) => setSpeakerB({...speakerB, name: e.target.value})} placeholder="角色 B" className="border-2 border-black p-1 flex-1 font-normal text-lg tracking-wide" />
                                <select value={speakerB.voice} onChange={(e) => setSpeakerB({...speakerB, voice: e.target.value})} className="border-2 border-black p-1 font-normal text-lg tracking-wide">
                                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
                            <textarea
                                value={speakerB.prompt}
                                onChange={(e) => setSpeakerB({...speakerB, prompt: e.target.value})}
                                placeholder="角色 B 提示词..."
                                className="w-full bg-yellow-50 border-2 border-black p-2 text-lg font-medium font-sans resize-none h-32 outline-none focus:bg-white transition-colors"
                            />
                        </div>
                    </div>
                    {scene.audioUrl && (
                        <div className="flex items-center gap-2">
                            <audio controls src={scene.audioUrl} className="flex-1 h-8" />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onGenerateAudio(
                                `${speakerA.name}: ${speakerA.prompt}\n${speakerB.name}: ${speakerB.prompt}`, 
                                {
                                    multiSpeakerVoiceConfig: {
                                        speakerVoiceConfigs: [
                                            { speaker: speakerA.name, voiceName: speakerA.voice },
                                            { speaker: speakerB.name, voiceName: speakerB.voice }
                                        ]
                                    }
                                }
                            )}
                            disabled={scene.isGeneratingAudio || (!speakerA.prompt?.trim() && !speakerB.prompt?.trim())}
                            className="flex-1 bg-[#FACC15] border-2 border-black py-2 font-normal text-lg hover:bg-[#EAB308] disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                        >
                            {scene.isGeneratingAudio ? <RefreshCw className="animate-spin" size={20} /> : (scene.audioUrl ? <RefreshCw size={20} /> : <PlayCircle size={20} />)}
                            {scene.isGeneratingAudio ? '生成中...' : (scene.audioUrl ? '重新生成' : '生成音频')}
                        </button>
                        {scene.audioUrl && (
                            <a 
                                href={scene.audioUrl} 
                                download={`scene-${scene.sceneNumber}-audio.wav`}
                                className="bg-[#FACC15] hover:bg-[#EAB308] text-black p-2 border-2 border-black transition-all flex items-center justify-center flex-1 font-normal text-lg"
                                title="下载音频"
                            >
                                <Download size={24} className="mr-2" /> 下载音频
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoryboardGrid;
