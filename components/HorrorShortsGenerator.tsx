
import React, { useState, useEffect } from 'react';
import { generateHorrorScript, generateSceneVideo, generateSceneAudio } from '../services/geminiService';
import { HorrorShortScript, GenerationStatus, Scene } from '../types';
import { SceneCard } from './SceneCard';

export const HorrorShortsGenerator: React.FC = () => {
  const [theme, setTheme] = useState('한밤중의 버려진 정신병원');
  const [duration, setDuration] = useState(60);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [script, setScript] = useState<HorrorShortScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(false);

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      const selected = await aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
  };

  const handleOpenKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const startGeneration = async () => {
    if (!hasKey) {
      setError("비디오 생성을 위해 유료 프로젝트 API 키가 필요합니다.");
      return;
    }

    try {
      setError(null);
      setStatus(GenerationStatus.GENERATING_SCRIPT);
      const generatedScript = await generateHorrorScript(theme, duration);
      setScript(generatedScript);
      
      setStatus(GenerationStatus.GENERATING_ASSETS);
      
      const scenesCount = generatedScript.scenes.length;

      // 각 장면을 순차적으로 처리하되, 한 장면 내에서는 오디오와 비디오를 병렬로 생성
      for (let i = 0; i < scenesCount; i++) {
        // 로딩 상태 표시
        setScript(prev => {
          if (!prev) return null;
          const newScenes = [...prev.scenes];
          newScenes[i] = { ...newScenes[i], isGeneratingVideo: true, isGeneratingAudio: true };
          return { ...prev, scenes: newScenes };
        });

        try {
          // 오디오 생성 (상대적으로 빠름)
          const audioPromise = generateSceneAudio(generatedScript.scenes[i].narration)
            .then(audioUrl => {
              setScript(prev => {
                if (!prev) return null;
                const newScenes = [...prev.scenes];
                newScenes[i] = { ...newScenes[i], audioUrl, isGeneratingAudio: false };
                return { ...prev, scenes: newScenes };
              });
              return audioUrl;
            })
            .catch(err => {
              console.error(`Audio ${i} generation fail:`, err);
              setScript(prev => {
                if (!prev) return null;
                const newScenes = [...prev.scenes];
                newScenes[i] = { ...newScenes[i], isGeneratingAudio: false };
                return { ...prev, scenes: newScenes };
              });
              return null;
            });

          // 비디오 생성 (상대적으로 느림)
          const videoPromise = generateSceneVideo(generatedScript.scenes[i].imagePrompt)
            .then(videoUrl => {
              setScript(prev => {
                if (!prev) return null;
                const newScenes = [...prev.scenes];
                newScenes[i] = { ...newScenes[i], videoUrl, isGeneratingVideo: false };
                return { ...prev, scenes: newScenes };
              });
              return videoUrl;
            })
            .catch(err => {
              console.error(`Video ${i} generation fail:`, err);
              if (err.message?.includes("Requested entity was not found")) {
                throw err; // API 키 문제일 경우 중단
              }
              setScript(prev => {
                if (!prev) return null;
                const newScenes = [...prev.scenes];
                newScenes[i] = { ...newScenes[i], isGeneratingVideo: false };
                return { ...prev, scenes: newScenes };
              });
              return null;
            });

          await Promise.all([audioPromise, videoPromise]);
        } catch (assetErr: any) {
          if (assetErr.message?.includes("Requested entity was not found")) {
            setHasKey(false);
            setError("API 키를 다시 선택해주세요 (Veo 모델 권한 없음).");
            setStatus(GenerationStatus.ERROR);
            return;
          }
        }
      }

      setStatus(GenerationStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '요청 처리 중 오류가 발생했습니다.');
      setStatus(GenerationStatus.ERROR);
    }
  };

  return (
    <div className="space-y-12">
      {!hasKey && (
        <div className="p-6 bg-red-950/30 border border-red-600/50 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-bold text-red-500 mb-1">⚠️ 비디오 생성 기능 안내</p>
            <p className="text-neutral-300">Veo 모델을 사용하려면 유료 티어의 API 키를 선택해야 합니다.</p>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-red-400 underline text-xs">결제 관련 문서 확인</a>
          </div>
          <button 
            onClick={handleOpenKey}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded uppercase tracking-widest transition-colors"
          >
            API 키 선택
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 p-8 bg-neutral-950 border border-red-900/30 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="md:col-span-2 space-y-2">
          <label className="text-red-500 font-bold text-xs uppercase tracking-widest">공포 테마</label>
          <input 
            type="text" 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-lg p-4 focus:ring-2 focus:ring-red-600 focus:outline-none text-gray-200 transition-all"
            placeholder="주제를 입력하세요..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-red-500 font-bold text-xs uppercase tracking-widest">영상 길이 (초)</label>
          <select 
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-lg p-4 focus:ring-2 focus:ring-red-600 focus:outline-none text-gray-200 transition-all cursor-pointer"
          >
            <option value={15}>15초 (단편)</option>
            <option value={30}>30초 (표준)</option>
            <option value={60}>60초 (장편)</option>
          </select>
        </div>

        <button 
          onClick={startGeneration}
          disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS || !hasKey}
          className="md:col-span-3 w-full bg-red-700 hover:bg-red-600 disabled:bg-neutral-800 text-white font-bold py-5 rounded-lg transition-all transform active:scale-[0.98] shadow-lg uppercase tracking-widest"
        >
          {status === GenerationStatus.GENERATING_SCRIPT ? '대본을 소환하는 중...' : 
           status === GenerationStatus.GENERATING_ASSETS ? '영혼을 형성하는 중 (약 5-10분 소요)...' : '의식 시작'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-600/50 text-red-200 rounded-lg text-center animate-pulse">
          {error}
        </div>
      )}

      {script && (
        <div className="space-y-16 pb-20">
          <div className="text-center space-y-4">
            <h2 className="horror-title text-5xl text-red-600 tracking-wider drop-shadow-lg">{script.title}</h2>
            <p className="max-w-2xl mx-auto text-neutral-400 italic">"{script.concept}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {script.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} />
            ))}
          </div>

          <div className="p-8 eerie-border bg-black/40 rounded-xl backdrop-blur-sm">
             <h3 className="text-red-600 font-bold mb-4 flex items-center gap-2 uppercase tracking-widest">
               제작 가이드
             </h3>
             <p className="text-neutral-300 leading-relaxed font-light whitespace-pre-wrap">{script.productionTips}</p>
          </div>
        </div>
      )}
    </div>
  );
};
