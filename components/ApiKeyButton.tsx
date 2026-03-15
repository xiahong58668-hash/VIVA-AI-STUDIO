import React from 'react';
import { Key } from 'lucide-react';
import { openKeySelection } from '../services/geminiService';

const ApiKeyButton: React.FC = () => {
  return (
    <button
      onClick={openKeySelection}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#FACC15] comic-border comic-shadow hover:bg-[#EAB308] text-black px-6 py-3 rounded-none transform hover:-translate-y-1 transition-all"
      title="登录 Google 账号以使用个人配额 (Veo)"
    >
      <div className="bg-black text-[#FACC15] p-1 rounded-full border-2 border-black">
        <Key size={16} />
      </div>
      <span className="font-bangers tracking-wider text-lg">SECRET KEY (Veo)</span>
    </button>
  );
};

export default ApiKeyButton;