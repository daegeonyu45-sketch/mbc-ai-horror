
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
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
        const selected = await aistudio.hasSelectedApiKey();
        // API Studio 환경: 키 선택 여부 확인
        setHasKey(selected);
      } else {
        // AI Studio 환경이 아니거나 키가 이미 환경변수에 있는 경우 바로 진입 허용
        const apiKey = process.env.API_KEY;
        setHasKey(!!apiKey && apiKey !== "undefined");
      }
    } catch (err) {
      console.error("Key status check failed", err);
      setHasKey(false);
    }
  };

  const handleOpenKey = async () => {
    // 1. 즉시 UI를 메인 화면으로 전환 (가이드라인 준수: 레이스 컨디션 방지)
    setHasKey(true);
    setError(null);

    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.openSelectKey === 'function') {
        // 2. 키 선택 창 띄우기
        await aistudio.openSelectKey();
      }
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  const startGeneration = async () => {
    const currentApiKey = process.env.API_KEY;
    if (!currentApiKey || currentApiKey === "" || currentApiKey === "undefined") {
      setError("API 키가 아직 감지되지 않았습니다. 잠시 기다리시거나 키 선택 버튼을 다시 눌러주세요.");
      setHasKey(false);
      return;
    }

    try {
      setError(null);
      setStatus(GenerationStatus.GENERATING_SCRIPT);
      const generatedScript = await generateHorrorScript(theme, duration);
      setScript(generatedScript);
      
      setStatus(GenerationStatus.GENERATING_ASSETS);
      
      for (let i = 0; i < generatedScript.scenes.length; i++) {
        setScript(prev => {
          if (!prev) return null;
          const newScenes = [...prev.scenes];
          newScenes[i] = { ...newScenes[i], isGeneratingVideo: true, isGeneratingAudio: true };
          return { ...prev, scenes: newScenes };
        });

        try {
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
              console.error(`Audio fail ${i}`, e);
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
              if (e.message?.includes("Requested entity was not found")) throw e;
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
            setError("API 키 권한 문제: Veo 모델 사용이 가능한 유료 프로젝트 키를 선택해야 합니다.");
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

  if (hasKey === null) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 border-4 border-red-900/20 border-t-red-600 rounded-full animate-spin"></div>
        <p className="text-red-500 font-bold uppercase tracking-[0.3em] text-xs animate-pulse">심연 확인 중...</p>
      </div>
    );
  }

  if (hasKey === false) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-12 bg-black border border-red-900/40 rounded-[2.5rem] shadow-[0_0_80px_rgba(153,27,27,0.25)] text-center space-y-12 animate-in fade-in zoom-in duration-700">
        <div className="space-y-4">
          <h2 className="horror-title text-5xl text-red-600 tracking-tighter drop-shadow-2xl">ACCESS REQUIRED</h2>
          <div className="h-0.5 bg-gradient-to-r from-transparent via-red-900 to-transparent w-full"></div>
          <p className="text-neutral-400 text-sm font-light leading-relaxed px-6">
            고성능 공포 영상(Veo)을 생성하기 위해서는 <br/>
            반드시 <span className="text-white font-bold underline decoration-red-600 underline-offset-4">유료 API 키</span>를 선택해야 합니다.
          </p>
        </div>
        
        <div className="space-y-6">
          <button 
            onClick={handleOpenKey}
            className="w-full py-6 bg-red-800 hover:bg-red-700 text-white font-black rounded-3xl uppercase tracking-[0.4em] transition-all transform hover:scale-[1.03] active:scale-95 shadow-[0_0_30px_rgba(185,28,28,0.4)] border border-red-500/30"
          >
            API 키 선택하기
          </button>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="block text-[10px] text-neutral-600 hover:text-red-400 uppercase tracking-widest transition-colors">
            결제 등록 및 가이드 확인
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      <div className="grid md:grid-cols-3 gap-8 p-10 bg-neutral-950/70 border border-white/5 rounded-[3rem] shadow-3xl backdrop-blur-3xl">
        <div className="md:col-span-2 space-y-3">
          <label className="text-red-600 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
            시나리오 주제
          </label>
          <input 
            type="text" 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-2xl p-5 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all placeholder-neutral-800"
          />
        </div>

        <div className="space-y-3">
          <label className="text-neutral-500 font-bold text-[10px] uppercase tracking-widest">영상 길이</label>
          <select 
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-2xl p-5 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all cursor-pointer"
          >
            <option value={15}>15초</option>
            <option value={30}>30초</option>
            <option value={60}>60초</option>
          </select>
        </div>

        <button 
          onClick={startGeneration}
          disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
          className={`md:col-span-3 w-full font-black py-7 rounded-3xl transition-all transform shadow-2xl uppercase tracking-[0.5em] text-xs border border-white/5 ${
            status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS
            ? 'bg-neutral-900 text-neutral-700 cursor-not-allowed opacity-50'
            : 'bg-red-900 hover:bg-red-800 text-white active:scale-[0.99] shadow-[0_0_40px_rgba(153,27,27,0.4)]'
          }`}
        >
          {status === GenerationStatus.GENERATING_SCRIPT ? '어둠의 기록 작성 중...' : 
           status === GenerationStatus.GENERATING_ASSETS ? '영혼을 빚는 중 (약 5-10분)...' : '의식 시작'}
        </button>
      </div>

      {error && (
        <div className="p-6 bg-red-950/20 border border-red-900/30 text-red-500 rounded-3xl text-center text-[11px] font-bold animate-pulse tracking-wide flex items-center justify-center gap-6">
          <span>{error}</span>
          <button onClick={handleOpenKey} className="px-5 py-2.5 bg-red-900/40 hover:bg-red-900/60 text-white rounded-xl transition-colors uppercase text-[9px] border border-red-500/20">키 다시 선택</button>
        </div>
      )}

      {script && (
        <div className="space-y-24 pb-48">
          <div className="text-center space-y-6">
            <h2 className="horror-title text-6xl md:text-8xl text-red-700 tracking-tighter drop-shadow-[0_0_50px_rgba(220,38,38,0.3)] uppercase">{script.title}</h2>
            <p className="max-w-2xl mx-auto text-neutral-500 italic text-sm font-light tracking-widest opacity-70">"{script.concept}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-14">
            {script.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
