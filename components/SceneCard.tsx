
import React, { useRef, useEffect } from 'react';
import { Scene } from '../types';

interface SceneCardProps {
  scene: Scene;
}

export const SceneCard: React.FC<SceneCardProps> = ({ scene }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 새로운 URL이 설정되면 로드
  useEffect(() => {
    if (videoRef.current && scene.videoUrl) {
      videoRef.current.load();
    }
  }, [scene.videoUrl]);

  useEffect(() => {
    if (audioRef.current && scene.audioUrl) {
      audioRef.current.load();
    }
  }, [scene.audioUrl]);

  return (
    <div className="flex flex-col bg-neutral-900/40 rounded-3xl overflow-hidden border border-neutral-800 hover:border-red-900/50 transition-all duration-500 shadow-2xl">
      <div className="relative aspect-[9/16] bg-black flex items-center justify-center">
        {scene.videoUrl ? (
          <video 
            ref={videoRef}
            key={scene.videoUrl}
            src={scene.videoUrl} 
            className="w-full h-full object-cover"
            loop
            muted
            controls
            playsInline
            autoPlay
          />
        ) : scene.isGeneratingVideo ? (
          <div className="flex flex-col items-center gap-6 text-red-600 p-8 text-center">
             <div className="relative">
                <div className="h-20 w-20 rounded-full border-4 border-red-900/20"></div>
                <div className="absolute top-0 h-20 w-20 rounded-full border-4 border-t-red-600 animate-spin"></div>
             </div>
             <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">Veo 영상 구현 중</p>
                <p className="text-[10px] text-neutral-600 uppercase tracking-tighter">심연에서 형상을 가져오는 중...</p>
             </div>
          </div>
        ) : (
          <div className="text-neutral-800 font-mono text-[10px] uppercase tracking-widest">준비되지 않은 공포</div>
        )}
        
        <div className="absolute top-6 left-6 z-10 flex gap-2">
          <span className="bg-red-700/90 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md">장면 {scene.sceneNumber}</span>
          <span className="bg-black/60 text-neutral-300 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md">{scene.timeRange}</span>
        </div>
        
        <div className="absolute bottom-6 inset-x-6 z-10">
          {scene.audioUrl ? (
            <audio 
              ref={audioRef}
              key={scene.audioUrl}
              src={scene.audioUrl} 
              controls 
              className="w-full h-8 opacity-60 hover:opacity-100 transition-all rounded-full filter invert contrast-125"
            />
          ) : scene.isGeneratingAudio && (
            <div className="flex items-center justify-center gap-2 bg-black/40 py-2 rounded-full backdrop-blur-md border border-red-900/20">
              <div className="h-1.5 w-1.5 bg-red-600 rounded-full animate-ping"></div>
              <span className="text-[9px] text-red-500 font-black tracking-widest uppercase">목소리 소환 중</span>
            </div>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none opacity-60"></div>
      </div>

      <div className="p-6 space-y-5 bg-neutral-900/80 backdrop-blur-xl border-t border-neutral-800">
        <div className="space-y-2">
          <h4 className="text-red-500 text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
             나레이션
          </h4>
          <p className="text-sm text-neutral-100 font-medium italic leading-relaxed">"{scene.narration}"</p>
        </div>

        <div className="space-y-2">
          <h4 className="text-neutral-600 text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
             시각적 구성
          </h4>
          <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed font-light">{scene.screenDescription}</p>
        </div>

        <div className="pt-3 border-t border-neutral-800/50 flex items-center gap-2">
          <span className="text-[9px] text-neutral-700 font-black uppercase tracking-tighter">{scene.bgmMood}</span>
        </div>
      </div>
    </div>
  );
};
