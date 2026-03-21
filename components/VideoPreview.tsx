import React, { useState, useEffect, useRef } from 'react';
import { Scene } from '../types';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface Props {
  scenes: Scene[];
}

const VideoPreview: React.FC<Props> = ({ scenes }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  useEffect(() => {
    if (isPlaying) {
      const playScene = async (index: number) => {
        if (index >= scenes.length) {
          setIsPlaying(false);
          setCurrentSceneIndex(0);
          return;
        }
        setCurrentSceneIndex(index);
        
        // Play all audios for this scene
        const audioElements = audioRefs.current.filter((_, i) => i === index);
        await Promise.all(audioElements.map(audio => audio?.play()));
        
        // Wait for the duration of the scene
        const duration = (scenes[index].videoDuration || 8) * 1000;
        await new Promise(resolve => setTimeout(resolve, duration));
        
        playScene(index + 1);
      };
      playScene(currentSceneIndex);
    }
  }, [isPlaying, currentSceneIndex, scenes]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-black text-white">
      <div className="w-full aspect-video bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-white">
        {scenes[currentSceneIndex]?.imageUrl ? (
          <img src={scenes[currentSceneIndex].imageUrl} alt="Scene" className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-500">No image for this scene</div>
        )}
      </div>
      
      <div className="flex gap-4">
        <button onClick={() => setIsPlaying(!isPlaying)} className="p-4 bg-white text-black rounded-full">
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button onClick={() => { setIsPlaying(false); setCurrentSceneIndex(0); }} className="p-4 bg-gray-700 text-white rounded-full">
          <RotateCcw />
        </button>
      </div>

      {scenes.map((scene, index) => (
        scene.audios?.map((audio, audioIndex) => (
          <audio 
            key={`${index}-${audioIndex}`} 
            ref={el => { audioRefs.current[index] = el; }} 
            src={audio.url} 
          />
        ))
      ))}
    </div>
  );
};

export default VideoPreview;
