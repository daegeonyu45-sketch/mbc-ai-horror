
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
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
        const selected = await aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    } catch (err) {
      console.error("Failed to check API key status:", err);
    }
  };

  const handleOpenKey = async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.openSelectKey === 'function') {
        await aistudio.openSelectKey();
        // 가이드라인: openSelectKey 호출 후 즉시 성공으로 가정하고 진행
        setHasKey(true);
        setError(null);
      } else {
        // Fallback: 샌드박스 환경이 아닐 경우 등
        setHasKey(true);
      }
    } catch (err) {
      console.error("Failed to open key selector:", err);
      // 에러가 나더라도 사용자가 진행할 수 있게 시도
      setHasKey(true);
    }
  };

  const startGeneration = async () => {
    if (!hasKey) {
      setError("먼저 API 키를 선택해야 의식을 시작할 수 있습니다.");
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
          // 비디오와 오디오 생성 (병렬 처리)
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
              console.error(`Scene ${i} Audio fail`, e);
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
              console.error(`Scene ${i} Video fail`, e);
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
            setError("API 키가 올바르지 않거나 권한이 없습니다. 다시 선택해주세요.");
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
        <div className="p-6 bg-red-950/30 border border-red-600/50 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in duration-700">
          <div className="text-sm">
            <p className="font-bold text-red-500 mb-1">⚠️ 비디오 생성 준비</p>
            <p className="text-neutral-300">Veo 모델을 사용하려면 유료 티어의 API 키를 선택해야 합니다.</p>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-red-400 underline text-xs">결제 가이드 확인</a>
          </div>
          <button 
            onClick={handleOpenKey}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
          >
            API 키 선택하기
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 p-8 bg-neutral-950 border border-red-900/30 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="md:col-span-2 space-y-2">
          <label className="text-red-500 font-bold text-[10px] uppercase tracking-widest">공포 시나리오 테마</label>
          <input 
            type="text" 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-lg p-4 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all placeholder-neutral-700"
            placeholder="예: 지하실에서 들리는 웃음소리"
          />
        </div>

        <div className="space-y-2">
          <label className="text-red-500 font-bold text-[10px] uppercase tracking-widest">영상 분량</label>
          <select 
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-lg p-4 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all cursor-pointer"
          >
            <option value={15}>15초 (강렬함)</option>
            <option value={30}>30초 (균형)</option>
            <option value={60}>60초 (심연)</option>
          </select>
        </div>

        <button 
          onClick={startGeneration}
          disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS || !hasKey}
          className={`md:col-span-3 w-full font-bold py-5 rounded-lg transition-all transform shadow-lg uppercase tracking-[0.2em] text-sm ${
            !hasKey ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-red-700 hover:bg-red-600 text-white active:scale-[0.99]'
          }`}
        >
          {status === GenerationStatus.GENERATING_SCRIPT ? '어둠의 기록 작성 중...' : 
           status === GenerationStatus.GENERATING_ASSETS ? '영혼을 형성하는 중 (약 5-10분)' : '금단의 의식 시작'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-900/50 text-red-400 rounded-lg text-center text-xs animate-pulse font-medium">
          {error}
        </div>
      )}

      {script && (
        <div className="space-y-16 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="text-center space-y-4">
            <h2 className="horror-title text-4xl md:text-5xl text-red-600 tracking-wider drop-shadow-[0_0_15px_rgba(220,38,38,0.4)] uppercase">{script.title}</h2>
            <p className="max-w-2xl mx-auto text-neutral-500 italic text-sm">"{script.concept}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {script.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} />
            ))}
          </div>

          <div className="p-8 border border-neutral-900 bg-black/60 rounded-2xl backdrop-blur-md">
             <h3 className="text-red-700 font-black mb-4 flex items-center gap-3 uppercase tracking-widest text-xs">
               <div className="w-8 h-[1px] bg-red-900"></div>
               제작 사념 (Production Tips)
             </h3>
             <p className="text-neutral-400 leading-relaxed font-light text-sm whitespace-pre-wrap">{script.productionTips}</p>
          </div>
        </div>
      )}
    </div>
  );
};
