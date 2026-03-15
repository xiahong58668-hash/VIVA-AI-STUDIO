import React from 'react';
import { X, BadgeDollarSign } from 'lucide-react';
import { agentConfig } from '../src/agentConfig';

interface PricingModalProps {
  onClose: () => void;
}

const p = (priceAt07: number) => ((priceAt07 / 0.7) * agentConfig.priceCoefficient).toFixed(3) + '元';

const PricingModal: React.FC<PricingModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-[#FACC15] border-b-4 border-black p-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <BadgeDollarSign className="w-8 h-8 text-black" strokeWidth={2.5} />
            <h2 className="text-3xl font-black text-black tracking-wide font-sans uppercase">价格说明 / PRICING</h2>
          </div>
          <button 
            onClick={onClose} 
            className="bg-[#EF4444] hover:bg-[#DC2626] border-2 border-black text-white p-1 transition-colors"
          >
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Text Models */}
          <section className="bg-gray-50 p-4 border-2 border-black rounded-xl">
            <h3 className="text-xl font-black mb-3 border-b-4 border-black pb-1 inline-block">文本模型</h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { name: 'Gemini-3-Pro', input: p(1.120), output: p(6.720) },
                { name: 'Gemini-3-Flash', input: p(0.280), output: p(1.680) },
                { name: 'Gemini-3.1-Flash', input: p(0.263), output: p(1.575) },
                { name: 'GPT-5.2', input: p(0.735), output: p(5.880) },
                { name: 'GPT-5.3', input: p(0.735), output: p(5.880) },
                { name: 'GPT-5.4', input: p(0.735), output: p(5.880) },
              ].map(m => (
                <div key={m.name} className="grid grid-cols-3 bg-white p-2 border-2 border-black rounded-lg items-center">
                  <span className="font-black text-md">{m.name}</span>
                  <span className="text-gray-600 text-sm">提示: {m.input}/1M</span>
                  <span className="text-gray-600 text-sm">补全: {m.output}/1M</span>
                </div>
              ))}
            </div>
          </section>

          {/* Image Models */}
          <section className="bg-gray-50 p-4 border-2 border-black rounded-xl">
            <h3 className="text-xl font-black mb-3 border-b-4 border-black pb-1 inline-block">图片模型</h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { name: 'Gemini-2.5-Flash-Image', price: `${p(0.063)}/张` },
                { name: 'Gemini-3-Pro-Image', price: `1K/2K ${p(0.139)}/张，4K ${p(0.248)}/张` },
                { name: 'Gemini-3.1-Flash-Image', price: `1K/2K ${p(0.070)}/张，4K ${p(0.087)}/张` },
              ].map(m => (
                <div key={m.name} className="grid grid-cols-2 bg-white p-2 border-2 border-black rounded-lg items-center">
                  <span className="font-black text-md">{m.name}</span>
                  <span className="text-gray-600 font-medium text-sm">{m.price}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Video Models */}
          <section className="bg-gray-50 p-4 border-2 border-black rounded-xl">
            <h3 className="text-xl font-black mb-3 border-b-4 border-black pb-1 inline-block">视频模型</h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { name: 'Veo-3.1-Fast', price: `${p(0.181)}/条` },
                { name: 'Veo-3.1-Fast-4K', price: `${p(0.181)}/条` },
                { name: 'Veo-3.1', price: `${p(0.307)}/条` },
                { name: 'Veo-3.1-4K', price: `${p(0.357)}/条` },
                { name: 'Veo3.1-Fast', price: `${p(0.490)}/条` },
                { name: 'Veo3.1', price: `${p(0.490)}/条` },
                { name: 'Grok-Video-3 (10s)', price: `${p(0.140)}/10秒` },
                { name: 'Grok-Video-3 (15s)', price: `${p(0.350)}/15秒` },
                { name: 'Sora-2', price: `${p(0.140)}/条` },
              ].map(m => (
                <div key={m.name} className="grid grid-cols-2 bg-white p-2 border-2 border-black rounded-lg items-center">
                  <span className="font-black text-md">{m.name}</span>
                  <span className="text-gray-600 font-medium text-sm">{m.price}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Audio Models */}
          <section className="bg-gray-50 p-4 border-2 border-black rounded-xl">
            <h3 className="text-xl font-black mb-3 border-b-4 border-black pb-1 inline-block">音频模型</h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { name: 'Gemini-2.5-Pro-TTS', price: `提示: ${p(1.050)}/1M   补全: ${p(21.000)}/1M` },
                { name: 'Gemini-2.5-Flash-TTS', price: `提示: ${p(0.525)}/1M   补全: ${p(10.500)}/1M` },
              ].map(m => (
                <div key={m.name} className="grid grid-cols-2 bg-white p-2 border-2 border-black rounded-lg items-center">
                  <span className="font-black text-md">{m.name}</span>
                  <span className="text-gray-600 font-medium text-sm whitespace-pre-wrap">{m.price}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;

