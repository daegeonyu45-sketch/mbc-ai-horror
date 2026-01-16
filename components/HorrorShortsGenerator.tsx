
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
  const [hasKey, setHasKey] = useState<boolean | null>(null); // null means checking

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
        const selected = await aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback for local development or non-AI Studio environments
        setHasKey(true);
      }
    } catch (err) {
      console.error("Failed to check API key status:", err);
      setHasKey(false);
    }
  };

  const handleOpenKey = async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.openSelectKey === 'function') {
        await aistudio.openSelectKey();
        // Mandatory instruction: Assume successful after triggering
        setHasKey(true);
        setError(null);
      } else {
        setHasKey(true);
      }
    } catch (err) {
      console.error("Failed to open key selector:", err);
      setHasKey(true);
    }
  };

  const startGeneration = async () => {
    if (!hasKey) {
      setError("비디오 생성을 위해 유료 프로젝트 API 키가 반드시 필요합니다.");
      return;
    }

    try {
      setError(null);
      setStatus(GenerationStatus.GENERATING_SCRIPT);
      const generatedScript = await generateHorrorScript(theme, duration);
      setScript(generatedScript);
      
      setStatus(GenerationStatus.GENERATING_ASSETS);
      
      const scenesCount = generatedScript.scenes.length;

      for (let i = 0; i < scenesCount; i++) {
        setScript(prev => {
          if (!prev) return null;
          const newScenes = [...prev.scenes];
          newScenes[i] = { ...newScenes[i], isGeneratingVideo: true, isGeneratingAudio: true };
          return { ...prev, scenes: newScenes };
        });

        try {
          // Process current scene assets in parallel
          const audioPromise = generateSceneAudio(generatedScript.scenes[i].narration)
            .then(audioUrl => {
              setScript(prev => {
                if (!prev) return null;
                const newScenes = [...prev.scenes];
                newScenes[i] = { ...newScenes[i], audioUrl, isGeneratingAudio: false };
                return { ...prev, scenes: newScenes };
              });
            })
            .catch(e => {
              console.error(`Audio fail at scene ${i}`, e);
              setScript(prev => {
                if (!prev) return null;
                const newScenes = [...prev.scenes];
                newScenes[i] = { ...newScenes[i], isGeneratingAudio: false };
                return { ...prev, scenes: newScenes };
              });
            });

          const videoPromise = generateSceneVideo(generatedScript.scenes[i].imagePrompt)
            .then(videoUrl => {
              setScript(prev => {
                if (!prev) return null;
                const newScenes = [...prev.scenes];
                newScenes[i] = { ...newScenes[i], videoUrl, isGeneratingVideo: false };
                return { ...prev, scenes: newScenes };
              });
            })
            .catch(e => {
              console.error(`Video fail at scene ${i}`, e);
              // Handle "Requested entity was not found" error by resetting key status
              if (e.message?.includes("Requested entity was not found")) {
                throw e;
              }
              setScript(prev => {
                if (!prev) return null;
                const newScenes = [...prev.scenes];
                newScenes[i] = { ...newScenes[i], isGeneratingVideo: false };
                return { ...prev, scenes: newScenes };
              });
            });

          await Promise.allSettled([audioPromise, videoPromise]);
        } catch (assetErr: any) {
          if (assetErr.message?.includes("Requested entity was not found")) {
            setHasKey(false);
            setError("API 키 권한 오류: Veo 모델을 사용할 수 없는 키입니다. 유료 프로젝트 키를 다시 선택해주세요.");
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

  // 1. Loading state for key check
  if (hasKey === null) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-900/30 border-t-red-600 rounded-full animate-spin"></div>
        <p className="text-red-500 font-bold uppercase tracking-widest text-xs">영매 연결 중...</p>
      </div>
    );
  }

  // 2. Gatekeeper Screen: Must select key to enter
  if (hasKey === false) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-10 bg-black border border-red-900/50 rounded-3xl shadow-[0_0_50px_rgba(127,29,29,0.2)] text-center space-y-8 animate-in fade-in zoom-in duration-1000">
        <div className="horror-title text-4xl text-red-600 mb-2">ACCESS DENIED</div>
        <div className="h-px bg-gradient-to-r from-transparent via-red-900 to-transparent"></div>
        <p className="text-neutral-400 text-sm leading-relaxed">
          이 도구는 <span className="text-red-500 font-bold">Veo (고성능 비디오 AI)</span>를 사용합니다.<br/>
          금지된 환영을 불러내기 위해서는 반드시 <span className="text-white">유료 프로젝트의 API 키</span>가 필요합니다.
        </p>
        <div className="space-y-4 pt-4">
          <button 
            onClick={handleOpenKey}
            className="w-full py-4 bg-red-700 hover:bg-red-600 text-white font-black rounded-xl uppercase tracking-[0.2em] transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(185,28,28,0.4)]"
          >
            API 키 선택하고 시작하기
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noreferrer" 
            className="block text-xs text-neutral-600 hover:text-red-500 transition-colors uppercase tracking-widest"
          >
            결제 및 빌링 가이드 확인하기
          </a>
        </div>
      </div>
    );
  }

  // 3. Main Generator Screen
  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      <div className="grid md:grid-cols-3 gap-6 p-8 bg-neutral-950/80 border border-red-900/20 rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="md:col-span-2 space-y-2">
          <label className="text-red-600 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
            공포 시나리오 테마
          </label>
          <input 
            type="text" 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-lg p-4 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all placeholder-neutral-800"
            placeholder="예: 깊은 밤의 나홀로 엘리베이터"
          />
        </div>

        <div className="space-y-2">
          <label className="text-neutral-500 font-bold text-[10px] uppercase tracking-widest">예상 분량</label>
          <select 
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-lg p-4 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all cursor-pointer"
          >
            <option value={15}>15초 (강렬한 찰나)</option>
            <option value={30}>30초 (깊어지는 공포)</option>
            <option value={60}>60초 (끝없는 심연)</option>
          </select>
        </div>

        <button 
          onClick={startGeneration}
          disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
          className={`md:col-span-3 w-full font-black py-5 rounded-lg transition-all transform shadow-lg uppercase tracking-[0.3em] text-sm ${
            status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS
            ? 'bg-neutral-900 text-neutral-600 cursor-wait'
            : 'bg-red-800 hover:bg-red-700 text-white active:scale-[0.98]'
          }`}
        >
          {status === GenerationStatus.GENERATING_SCRIPT ? '어둠의 기록 작성 중...' : 
           status === GenerationStatus.GENERATING_ASSETS ? '영상을 구현하는 중 (최대 10분 소요)...' : '금단의 의식 시작'}
        </button>
      </div>

      {error && (
        <div className="p-5 bg-red-950/40 border border-red-900/50 text-red-400 rounded-xl text-center text-xs animate-pulse font-medium shadow-lg">
          {error}
          <button onClick={handleOpenKey} className="ml-4 underline hover:text-white uppercase tracking-tighter">키 다시 선택</button>
        </div>
      )}

      {script && (
        <div className="space-y-16 pb-20">
          <div className="text-center space-y-4">
            <h2 className="horror-title text-4xl md:text-6xl text-red-600 tracking-wider drop-shadow-[0_0_20px_rgba(220,38,38,0.5)] uppercase">{script.title}</h2>
            <p className="max-w-2xl mx-auto text-neutral-500 italic text-sm font-light tracking-wide">"{script.concept}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {script.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} />
            ))}
          </div>

          <div className="p-8 border-l-4 border-red-900 bg-neutral-950/40 rounded-r-2xl backdrop-blur-sm">
             <h3 className="text-red-700 font-black mb-4 flex items-center gap-3 uppercase tracking-widest text-[10px]">
               제작 사념 (Director's Note)
             </h3>
             <p className="text-neutral-400 leading-relaxed font-light text-sm whitespace-pre-wrap">{script.productionTips}</p>
          </div>
        </div>
      )}
    </div>
  );
};
