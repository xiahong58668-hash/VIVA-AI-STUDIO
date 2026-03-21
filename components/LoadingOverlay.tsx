import React, { useState, useEffect } from 'react';
import { Bot, X } from 'lucide-react';
import { LOADING_TIPS } from '../tips';

interface Props {
  message: string;
  onCancel?: () => void;
}

const LoadingOverlay: React.FC<Props> = ({ message, onCancel }) => {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    // Pick a random tip on mount
    setTipIndex(Math.floor(Math.random() * LOADING_TIPS.length));
    
    // Change tip every 4 seconds
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#1a1a1a]/90 backdrop-blur-sm z-[300] flex flex-col items-center justify-center text-white">
      <div className="bg-white text-black p-10 comic-border max-w-md w-full text-center relative overflow-visible">
          {/* Cancel Button - Moved inside top-right corner for better reliability */}
          {onCancel && (
            <button 
                onClick={onCancel}
                className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full border-2 border-black z-50 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                title="Stop / Cancel"
            >
                <X size={24} strokeWidth={3} />
            </button>
          )}

          <div className="halftone-pattern absolute inset-0 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center mt-2">
              <div className="relative mb-6 flex justify-center items-center">
                  <Bot className="w-16 h-16 animate-pulse text-black" strokeWidth={2.5} />
                  <div className="absolute -top-2 -right-4 flex space-x-1">
                      <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
              </div>
              <h3 className="text-4xl font-bangers tracking-widest uppercase mb-4 animate-pulse">AI IS WORKING...</h3>
              <div className="h-12 flex items-center justify-center overflow-hidden w-full">
                  <p 
                      key={tipIndex} 
                      className="text-gray-600 font-medium font-sans text-sm animate-[fadeIn_0.5s_ease-in-out]"
                  >
                      {LOADING_TIPS[tipIndex]}
                  </p>
              </div>
          </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;