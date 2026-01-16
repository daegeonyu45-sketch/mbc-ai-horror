
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
        // API_KEY 환경변수 자체가 비어있는지도 함께 확인
        setHasKey(selected && !!process.env.API_KEY);
      } else {
        // AI Studio 환경이 아닐 경우 환경변수 직접 확인
        setHasKey(!!process.env.API_KEY);
      }
    } catch (err) {
      console.error("API 키 상태 확인 실패:", err);
      setHasKey(false);
    }
  };

  const handleOpenKey = async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.openSelectKey === 'function') {
        await aistudio.openSelectKey();
        // 키 선택 창을 연 후에는 선택했다고 가정하고 진행 (가이드라인 준수)
        setHasKey(true);
        setError(null);
      } else {
        alert("이 환경에서는 API 키 선택기를 열 수 없습니다. 직접 API_KEY를 설정해야 합니다.");
      }
    } catch (err) {
      console.error("키 선택기 열기 실패:", err);
    }
  };

  const startGeneration = async () => {
    // 런타임 최종 방어막
    if (!process.env.API_KEY) {
      setError("시스템에 API 키가 주입되지 않았습니다. API 키를 다시 선택하거나 설정해 주세요.");
      setHasKey(false);
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
              console.error(`장면 ${i} 음성 생성 실패`, e);
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
            setError("선택된 API 키에 Veo 모델 권한이 없습니다. 유료 프로젝트 키를 다시 선택해 주세요.");
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
        <p className="text-red-500 font-bold uppercase tracking-[0.3em] text-xs animate-pulse">심연의 문을 확인 중...</p>
      </div>
    );
  }

  if (hasKey === false) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-12 bg-black border border-red-900/40 rounded-[2rem] shadow-[0_0_60px_rgba(153,27,27,0.15)] text-center space-y-10 animate-in fade-in zoom-in duration-1000">
        <div className="space-y-4">
          <h2 className="horror-title text-4xl text-red-600">REQUIRED</h2>
          <div className="h-0.5 bg-gradient-to-r from-transparent via-red-900 to-transparent w-full"></div>
          <p className="text-neutral-400 text-sm font-light leading-relaxed">
            비디오 및 오디오를 생성하기 위해서는<br/>
            <span className="text-red-500 font-bold uppercase">Paid Google Cloud Project</span>와 연결된<br/>
            API 키가 반드시 필요합니다.
          </p>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={handleOpenKey}
            className="w-full py-5 bg-red-700 hover:bg-red-600 text-white font-black rounded-2xl uppercase tracking-[0.25em] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl"
          >
            API 키 선택하기
          </button>
          <p className="text-[10px] text-neutral-600 uppercase tracking-widest">
            키 선택 없이는 의식을 진행할 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="grid md:grid-cols-3 gap-8 p-10 bg-neutral-950/50 border border-white/5 rounded-3xl shadow-3xl backdrop-blur-xl">
        <div className="md:col-span-2 space-y-3">
          <label className="text-red-600 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
            공포 시나리오 테마
          </label>
          <input 
            type="text" 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-xl p-5 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all"
            placeholder="주제를 입력하세요..."
          />
        </div>

        <div className="space-y-3">
          <label className="text-neutral-500 font-bold text-[10px] uppercase tracking-widest">영상 분량</label>
          <select 
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-xl p-5 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all cursor-pointer"
          >
            <option value={15}>15초</option>
            <option value={30}>30초</option>
            <option value={60}>60초</option>
          </select>
        </div>

        <button 
          onClick={startGeneration}
          disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
          className={`md:col-span-3 w-full font-black py-6 rounded-2xl transition-all transform shadow-2xl uppercase tracking-[0.4em] text-xs ${
            status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS
            ? 'bg-neutral-900 text-neutral-700 cursor-not-allowed'
            : 'bg-red-800 hover:bg-red-700 text-white active:scale-[0.99]'
          }`}
        >
          {status === GenerationStatus.GENERATING_SCRIPT ? '기록 소환 중...' : 
           status === GenerationStatus.GENERATING_ASSETS ? '영상을 빚는 중...' : '금단의 의식 시작'}
        </button>
      </div>

      {error && (
        <div className="p-6 bg-red-950/30 border border-red-900/40 text-red-500 rounded-2xl text-center text-xs font-bold animate-pulse">
          {error}
          <button onClick={handleOpenKey} className="ml-4 underline hover:text-white">다시 선택</button>
        </div>
      )}

      {script && (
        <div className="space-y-20 pb-32">
          <div className="text-center space-y-6">
            <h2 className="horror-title text-5xl md:text-7xl text-red-600 tracking-tighter drop-shadow-2xl uppercase">{script.title}</h2>
            <p className="max-w-2xl mx-auto text-neutral-500 italic text-sm font-light">"{script.concept}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {script.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} />
            ))}
          </div>

          <div className="p-10 border border-white/5 bg-black/40 rounded-[2rem] backdrop-blur-md">
             <h3 className="text-red-700 font-black mb-6 flex items-center gap-4 uppercase tracking-[0.3em] text-[10px]">
               <span className="w-10 h-0.5 bg-red-900"></span>
               Production Tips
             </h3>
             <p className="text-neutral-400 leading-relaxed font-light text-sm whitespace-pre-wrap">{script.productionTips}</p>
          </div>
        </div>
      )}
    </div>
  );
};
