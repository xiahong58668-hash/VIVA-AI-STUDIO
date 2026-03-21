

import React from 'react';
import { AppStep } from '../types';
import { Package, Edit3, Database, MessageSquareText, ChevronRight, Settings } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  currentStep: AppStep;
  onStepClick: (step: AppStep) => void;
  enabledSteps?: AppStep[];
  isConfigConfirmed: boolean;
}

const steps = [
  { id: AppStep.MODEL_CONFIG, label: '模型配置', icon: Settings },
  { id: AppStep.INPUT, label: '核心需求', icon: Edit3 },
  { id: AppStep.SCRIPT_EDIT, label: '剧本创作', icon: MessageSquareText },
  { id: AppStep.ASSETS, label: '元素配置', icon: Database },
  { id: AppStep.STORYBOARD, label: '分镜制作', icon: Package },
];

const StepIndicator: React.FC<Props> = ({ currentStep, onStepClick, enabledSteps, isConfigConfirmed }) => {
  const currentIdx = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="w-full mb-10">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 relative bg-white border-2 border-black p-4 md:p-2 md:rounded-full">
        {steps.map((step, idx) => {
          const isActive = idx === currentIdx;
          const isCompleted = idx < currentIdx;
          const Icon = step.icon;
          const isLast = idx === steps.length - 1;

          const isEnabled = true; // Allow navigation to any step as requested

          return (
            <React.Fragment key={step.id}>
              <button 
                onClick={() => onStepClick(step.id)}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-full transition-all focus:outline-none relative group",
                  isActive 
                    ? "bg-[#FACC15] text-black border-2 border-black transform" 
                    : isEnabled
                        ? "bg-white text-black hover:bg-gray-100 cursor-pointer border-2 border-transparent"
                        : "bg-transparent text-gray-400 cursor-not-allowed border-2 border-transparent"
                )}
                disabled={!isEnabled && !isActive}
              >
                 <div className={clsx(
                     "w-10 h-10 rounded-full flex items-center justify-center border-2 border-black shrink-0",
                     isActive ? "bg-white text-black" : isEnabled ? "bg-black text-white" : "bg-gray-200 border-gray-400 text-gray-400"
                 )}>
                    <Icon size={20} strokeWidth={2.5} />
                 </div>
                 <div className="flex flex-col items-start justify-center h-full">
                     <span className={clsx("font-normal text-2xl leading-none tracking-wide", isActive ? "text-black" : isEnabled ? "text-black" : "text-gray-400")}>
                         {step.label}
                     </span>
                 </div>
              </button>
              
              {!isLast && (
                <div className="hidden md:flex text-black">
                    <ChevronRight size={24} strokeWidth={3} className="opacity-20" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
