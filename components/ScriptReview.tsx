import React, { useRef } from 'react';
import { Scene, AssetItem } from '../types';
import { Film, Zap, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  scenes: Scene[];
  assets: { characters: AssetItem[], coreScenes: AssetItem[] };
  onConfirm: () => void;
  onUpdateSceneRef: (sceneIndex: number, slotIndex: number, file: File | null) => void;
  onUpdatePrompt: (sceneIndex: number, newPrompt: string, lang: 'en' | 'zh') => void;
  onUpdateScript: (sceneIndex: number, newScript: string) => void;
  onTranslate: (sceneIndex: number, field: 'visual' | 'video', sourceLang: 'en' | 'zh') => void;
  isGenerating: boolean;
}

const ScriptReview: React.FC<Props> = ({ 
    scenes, assets, onConfirm, onUpdateSceneRef, onUpdatePrompt, onUpdateScript, isGenerating 
}) => {
  return (
    <div className="space-y-10 animate-fade-in pb-20 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-end border-b-4 border-black pb-6 gap-6">
        <div className="space-y-3">
            <h2 className="text-6xl font-bangers text-white uppercase tracking-wider drop-shadow-[4px_4px_0_#000]">Step 3. Visuals</h2>
            <p className="text-white text-xl font-normal bg-black inline-block px-4 py-1 transform -skew-x-12 border-2 border-white">在生成图片前微调提示词。</p>
        </div>
        <button
          onClick={onConfirm}
          disabled={isGenerating}
          className="flex items-center gap-3 bg-[#EF4444] hover:bg-[#DC2626] border-2 border-black text-white px-10 py-4 font-bangers text-2xl tracking-wide uppercase comic-shadow hover:-translate-y-1 transition-all disabled:opacity-50"
        >
          {isGenerating ? 'GENERATING...' : 'DRAW STORYBOARD'}
          {!isGenerating && <Zap size={24} fill="currentColor" />}
        </button>
      </div>

      <div className="grid gap-10">
        {scenes.map((scene, index) => (
          <SceneCard 
            key={scene.sceneNumber} 
            scene={scene} 
            index={index} 
            assets={assets}
            onUpdateRef={onUpdateSceneRef}
            onUpdatePrompt={onUpdatePrompt}
            onUpdateScript={onUpdateScript}
          />
        ))}
      </div>
    </div>
  );
};

interface CardProps {
    scene: Scene;
    index: number;
    assets: { characters: AssetItem[], coreScenes: AssetItem[] };
    onUpdateRef: (sceneIndex: number, slotIndex: number, file: File | null) => void;
    onUpdatePrompt: (sceneIndex: number, newPrompt: string, lang: 'en' | 'zh') => void;
    onUpdateScript: (sceneIndex: number, newScript: string) => void;
}

const AssetToolbar: React.FC<{ 
    assets: { characters: AssetItem[], coreScenes: AssetItem[] }, 
    onInsert: (name: string) => void 
}> = ({ assets, onInsert }) => {
    const hasAssets = assets.characters.length > 0 || assets.coreScenes.length > 0;
    if (!hasAssets) return null;

    const renderBtn = (item: AssetItem, bgClass: string) => {
        const hasImage = !!item.data;
        return (
            <button 
                key={item.id} 
                onClick={() => onInsert(item.name)} 
                className={clsx(
                    "px-3 py-1 text-xs font-bold border-2 border-black uppercase transition-all",
                    hasImage ? `${bgClass} text-black hover:brightness-110 comic-shadow-sm` : "bg-white border-dashed text-gray-500 hover:text-black"
                )} 
                title={hasImage ? "Insert & Reference" : "Insert Text Only"}
            >
                {item.name}
            </button>
        );
    };

    return (
        <div className="flex flex-wrap gap-2 mb-4 bg-gray-100 p-3 border-2 border-black">
            <span className="text-xs text-black flex items-center mr-2 font-black uppercase tracking-wider">INSERT:</span>
            {assets.characters.map(c => renderBtn(c, "bg-[#3B82F6]"))}
            {assets.coreScenes.map(s => renderBtn(s, "bg-[#F97316]"))}
        </div>
    )
}

const SceneCard: React.FC<CardProps> = ({ scene, index, assets, onUpdateRef, onUpdatePrompt, onUpdateScript }) => {
    const slots = [0, 1, 2];

    const insertIntoScript = (name: string) => {
        const current = scene.script || "";
        const newVal = current + (current.trim().length > 0 ? " " : "") + name;
        onUpdateScript(index, newVal);
        onUpdatePrompt(index, newVal, 'en'); 
    };

    return (
        <div className="bg-white border-4 border-black comic-shadow-lg p-0 relative overflow-hidden group">
            <div className="bg-black text-white px-6 py-2 border-b-4 border-black flex justify-between items-center">
                 <span className="font-bangers text-2xl">SCENE {String(scene.sceneNumber).padStart(2, '0')}</span>
            </div>
            
            <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-4">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 text-black font-bangers text-xl"><Film size={24} /><span>VISUAL PROMPT (SCRIPT)</span></div>
                    <AssetToolbar assets={assets} onInsert={insertIntoScript} />
                    <textarea 
                        value={scene.script} 
                        onChange={(e) => {
                            onUpdateScript(index, e.target.value);
                            onUpdatePrompt(index, e.target.value, 'en');
                        }}
                        className="w-full bg-yellow-50 border-2 border-black text-black text-lg p-5 font-comic outline-none focus:bg-white resize-none leading-relaxed comic-shadow-sm h-48" 
                        placeholder="Describe the visual action here..."
                    />
                  </div>
              </div>
              <div className="lg:col-span-1 bg-gray-100 border-2 border-black p-6 flex flex-col">
                  <div className="flex items-center gap-2 text-black font-bangers text-xl mb-4"><ImageIcon size={24} /><span>REFERENCES (MAX 3)</span></div>
                  <div className="grid grid-cols-3 gap-3">
                      {slots.map((slotIndex) => (
                         <RefImageSlot key={slotIndex} image={scene.sceneReferenceImages?.[slotIndex]} onUpload={(file) => onUpdateRef(index, slotIndex, file)} onDelete={() => onUpdateRef(index, slotIndex, null)} slotLabel={slotIndex + 1} />
                      ))}
                  </div>
              </div>
            </div>
        </div>
    );
};

const RefImageSlot: React.FC<{ image?: { previewUrl: string }, onUpload: (f:File)=>void, onDelete: ()=>void, slotLabel: number }> = ({ image, onUpload, onDelete, slotLabel }) => {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <div className="aspect-square relative">
            {image ? (
                 <div className="w-full h-full relative group border-2 border-black overflow-hidden bg-white">
                    <img src={image.previewUrl} className="w-full h-full object-cover" />
                    <button onClick={onDelete} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={24} className="text-white" /></button>
                 </div>
            ) : (
                <button onClick={() => ref.current?.click()} className="w-full h-full border-2 border-dashed border-gray-400 hover:border-black hover:bg-white bg-transparent flex flex-col items-center justify-center transition-all">
                    <Upload size={20} className="text-gray-400 mb-1" /><span className="text-xs font-bold text-gray-400">{slotLabel}</span>
                </button>
            )}
            <input type="file" ref={ref} className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </div>
    );
}

export default ScriptReview;