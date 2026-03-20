

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Edit3, ArrowRight, Wand2, RefreshCw, Sparkles, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { polishScript, optimizeScript } from '../services/geminiService';

interface Props {
  initialScript: string;
  onFinalize: (finalScript: string) => void;
  isGenerating: boolean;
  onNext: () => void;
  canGoNext: boolean;
  onRegenerate: () => void;
  onPolishScript: (polishedScript: string) => void;
  currentEpisode: number;
  totalEpisodes: number;
  onEpisodeChange: (episode: number) => void;
  textModel: string;
}

const ScriptEditor: React.FC<Props> = ({ initialScript, onFinalize, isGenerating, onNext, canGoNext, onRegenerate, onPolishScript, currentEpisode, totalEpisodes, onEpisodeChange, textModel }) => {
  const [script, setScript] = useState(initialScript);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const cleanScript = (script: string) => {
    // 1. Remove Markdown symbols: **, ###, #
    let cleaned = script
        .replace(/\*\*/g, '')
        .replace(/###/g, '')
        .replace(/#/g, '');
    
    // 2. Remove Markdown table alignment row: | : | : | : | and similar patterns
    cleaned = cleaned.replace(/^\|\s*[:\-]+\s*\|\s*[:\-]+\s*\|\s*[:\-]+\s*\|$/gm, '');
    cleaned = cleaned.replace(/:    :    :    :   /g, '');
    
    // 3. Remove pipe separators | and replace with spaces
    cleaned = cleaned.replace(/\|/g, '  ');

    // 4. Left align: Remove leading spaces on each line
    cleaned = cleaned.replace(/^\s+/gm, '');

    // 5. Ensure consistent spacing and formatting for the new template style
    // Ensure "---" is preserved as a separator
    // Ensure section headers are formatted correctly
    cleaned = cleaned.replace(/分镜&配音：/g, '分镜&配音：');
    cleaned = cleaned.replace(/优化要求：/g, '优化要求：');
    cleaned = cleaned.replace(/制作提示/g, '制作提示');

    // 6. Ensure one-line gap between parts (replace 3+ newlines with exactly two newlines)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // 7. Merge "配音旁白及表现建议" into "配音文案"
    const suggestionRegex = /配音旁白及表现建议[:：\s]*([\s\S]*?)(?=\n\S|$)/;
    const scriptRegex = /配音文案[:：\s]*([\s\S]*?)(?=\n\S|$)/;
    
    const suggestionMatch = cleaned.match(suggestionRegex);
    const scriptMatch = cleaned.match(scriptRegex);
    
    if (suggestionMatch && scriptMatch) {
        const suggestion = suggestionMatch[1].trim();
        const scriptContent = scriptMatch[1].trim();
        
        const merged = `${scriptContent}\n${suggestion}`;
        
        cleaned = cleaned.replace(suggestionRegex, '');
        cleaned = cleaned.replace(scriptRegex, `配音: ${merged}`);
    }
    
    return cleaned;
  };

  useEffect(() => {
    setScript(cleanScript(initialScript));
  }, [initialScript]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
        const optimized = await optimizeScript(script, textModel);
        setScript(optimized);
        onPolishScript(optimized);
    } catch (error) {
        console.error("Failed to optimize script:", error);
        alert("剧本优化失败，请稍后再试。");
    } finally {
        setIsOptimizing(false);
    }
  };

  return (
    <div className="flex flex-col animate-fade-in max-w-7xl mx-auto pb-20">
      <div className="text-center space-y-3 mb-12">
            <h2 className="text-6xl font-bangers text-white uppercase tracking-wider">Step 3. The Script (Episode {currentEpisode}/{totalEpisodes})</h2>
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
             <div className="relative w-40 shrink-0">
                 <select 
                    value={currentEpisode}
                    onChange={(e) => {
                        onPolishScript(script);
                        onEpisodeChange(Number(e.target.value));
                    }}
                    className="w-full h-full bg-[#FACC15] border-2 border-black px-4 text-2xl font-bangers tracking-widest uppercase outline-none appearance-none cursor-pointer hover:bg-[#EAB308] transition-colors text-black"
                 >
                     {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map(ep => (
                         <option key={ep} value={ep}>第{ep}集</option>
                     ))}
                 </select>
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                     <ChevronDown size={20} strokeWidth={3} />
                 </div>
             </div>

             <button 
                onClick={handleOptimize}
                disabled={isGenerating || isOptimizing}
                className="flex-1 bg-[#FACC15] hover:bg-[#EAB308] text-black py-4 font-bangers text-2xl tracking-widest uppercase border-2 border-black transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                title="剧本优化"
             >
                {isOptimizing ? (
                    <RefreshCw size={24} className="animate-spin" />
                ) : (
                    <Sparkles size={24} />
                )}
                {isOptimizing ? '正在优化...' : '剧本优化'}
             </button>

             <button 
                onClick={onRegenerate}
                disabled={isGenerating || isOptimizing}
                className="flex-1 bg-gray-800 hover:bg-black text-white py-4 font-bangers text-2xl tracking-widest uppercase border-2 border-black transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
             >
                <RefreshCw size={24} className={isGenerating ? "animate-spin" : ""} />
                重新生成剧本
             </button>
             <button 
                onClick={() => onFinalize(script)}
                disabled={isGenerating || isOptimizing}
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
