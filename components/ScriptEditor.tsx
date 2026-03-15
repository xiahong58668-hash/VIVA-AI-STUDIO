

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Edit3, ArrowRight, Wand2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  initialScript: string;
  onFinalize: (finalScript: string) => void;
  isGenerating: boolean;
  onNext: () => void;
  canGoNext: boolean;
  onRegenerate: () => void;
}

const ScriptEditor: React.FC<Props> = ({ initialScript, onFinalize, isGenerating, onNext, canGoNext, onRegenerate }) => {
  const [script, setScript] = useState(initialScript);

  useEffect(() => {
    setScript(initialScript);
  }, [initialScript]);

  return (
    <div className="flex flex-col animate-fade-in max-w-7xl mx-auto pb-20">
      <div className="text-center space-y-3 mb-12">
            <h2 className="text-6xl font-bangers text-white uppercase tracking-wider drop-shadow-[4px_4px_0_#000]">Step 3. The Script</h2>
            <p className="text-white text-xl font-normal bg-black inline-block px-4 py-1 transform -skew-x-12 border-2 border-white">在提取分镜前审查并完善剧本</p>
      </div>

      <div className="w-full h-[800px] flex flex-col bg-white border-2 border-black relative overflow-hidden">
         <div className="bg-[#EF4444] border-b-2 border-black p-4 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <Edit3 className="text-white" size={24} strokeWidth={2.5} /> 
                <h3 className="text-2xl font-bangers text-white tracking-wide">剧本编辑器</h3>
             </div>
         </div>
         
         <div className="flex-1 p-8 bg-[#fffdf5] relative">
             <div className="absolute top-0 left-8 bottom-0 w-px bg-red-300/50 pointer-events-none"></div>
             <textarea 
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="w-full h-full bg-transparent text-black font-comic text-xl leading-loose resize-none outline-none z-10 relative p-6 tracking-wide"
                placeholder="Start writing your masterpiece..."
             />
         </div>

         <div className="p-4 bg-white border-t-2 border-black flex gap-4">
             {canGoNext && (
                <button 
                    onClick={onNext}
                    className="flex-1 bg-white hover:bg-gray-100 text-black py-4 font-sans text-2xl font-bold tracking-widest uppercase border-2 border-black transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3"
                >
                    继续 (跳过) <ArrowRight size={24} />
                </button>
             )}
             <button 
                onClick={onRegenerate}
                disabled={isGenerating}
                className="flex-1 bg-gray-800 hover:bg-black text-white py-4 font-bangers text-2xl tracking-widest uppercase border-2 border-black transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
             >
                <RefreshCw size={24} className={isGenerating ? "animate-spin" : ""} />
                重新生成剧本
             </button>
             <button 
                onClick={() => onFinalize(script)}
                disabled={isGenerating}
                className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white py-4 font-bangers text-2xl tracking-widest uppercase border-2 border-black transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
             >
                {isGenerating ? <Wand2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                {isGenerating ? '提取中...' : (canGoNext ? '更新并提取' : '完成并提取')}
             </button>
         </div>
      </div>
    </div>
  );
};

export default ScriptEditor;
