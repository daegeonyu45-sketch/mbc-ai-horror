
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
        // API Studio 환경에서는 실제 선택 여부와 API_KEY 존재 여부를 모두 확인
        setHasKey(selected && !!process.env.API_KEY && process.env.API_KEY !== "undefined");
      } else {
        // 일반 브라우저 환경
        setHasKey(!!process.env.API_KEY && process.env.API_KEY !== "undefined");
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
        // 지침: openSelectKey 호출 후 즉시 성공으로 가정하고 진행
        // 하지만 실제 process.env.API_KEY가 들어오기까지 시간이 걸릴 수 있으므로 
        // 하단 startGeneration에서 한번 더 검증함
        setHasKey(true);
        setError(null);
      } else {
        setError("이 환경에서는 API 키 선택기를 지원하지 않습니다.");
      }
    } catch (err) {
      console.error("키 선택기 열기 실패:", err);
    }
  };

  const startGeneration = async () => {
    // 최종 관문: 실제 API_KEY가 존재하는지 확인
    const currentApiKey = process.env.API_KEY;
    if (!currentApiKey || currentApiKey === "" || currentApiKey === "undefined") {
      setError("API 키가 아직 시스템에 반영되지 않았습니다. 잠시 후 다시 시도하거나 키를 다시 선택해주세요.");
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
              if (e.message?.includes("Requested entity was not found") || e.message?.includes("API_KEY_NOT_SET")) {
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
          if (assetErr.message?.includes("Requested entity was not found") || assetErr.message?.includes("API_KEY_NOT_SET")) {
            setHasKey(false);
            setError("API 키 권한 문제 또는 키 미설정 오류가 발생했습니다. 유료 프로젝트 API 키를 다시 선택해주세요.");
            setStatus(GenerationStatus.ERROR);
            return;
          }
        }
      }

      setStatus(GenerationStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("API_KEY_NOT_SET")) {
        setHasKey(false);
        setError("API 키가 설정되지 않았습니다. 다시 선택해주세요.");
      } else {
        setError(err.message || '요청 처리 중 오류가 발생했습니다.');
      }
      setStatus(GenerationStatus.ERROR);
    }
  };

  if (hasKey === null) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 border-4 border-red-900/20 border-t-red-600 rounded-full animate-spin"></div>
        <p className="text-red-500 font-bold uppercase tracking-[0.3em] text-xs animate-pulse">심연의 권한 확인 중...</p>
      </div>
    );
  }

  if (hasKey === false) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-12 bg-black border border-red-900/40 rounded-[2rem] shadow-[0_0_60px_rgba(153,27,27,0.2)] text-center space-y-10 animate-in fade-in zoom-in duration-1000">
        <div className="space-y-4">
          <h2 className="horror-title text-4xl text-red-600 drop-shadow-lg">FORBIDDEN</h2>
          <div className="h-0.5 bg-gradient-to-r from-transparent via-red-900 to-transparent w-full opacity-50"></div>
          <p className="text-neutral-400 text-sm font-light leading-relaxed">
            비디오 및 오디오 소환 의식을 위해서는<br/>
            <span className="text-red-500 font-bold uppercase tracking-widest">Paid Project API Key</span>가 필요합니다.
          </p>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={handleOpenKey}
            className="w-full py-5 bg-red-700 hover:bg-red-600 text-white font-black rounded-2xl uppercase tracking-[0.3em] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl border border-red-500/20"
          >
            API 키 선택하기
          </button>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="block text-[10px] text-neutral-600 hover:text-red-400 transition-colors uppercase tracking-[0.2em]">
            결제 및 빌링 문서 확인
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="grid md:grid-cols-3 gap-8 p-10 bg-neutral-950/60 border border-white/5 rounded-[2.5rem] shadow-3xl backdrop-blur-2xl">
        <div className="md:col-span-2 space-y-3">
          <label className="text-red-600 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
            공포 시나리오 테마
          </label>
          <input 
            type="text" 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-2xl p-5 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all placeholder-neutral-800"
            placeholder="예: 낯선 이의 목소리가 들리는 아기 모니터"
          />
        </div>

        <div className="space-y-3">
          <label className="text-neutral-500 font-bold text-[10px] uppercase tracking-widest">영상 분량</label>
          <select 
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
            className="w-full bg-black border border-neutral-800 rounded-2xl p-5 focus:ring-1 focus:ring-red-600 focus:outline-none text-gray-200 transition-all cursor-pointer"
          >
            <option value={15}>15초 (강렬함)</option>
            <option value={30}>30초 (몰입)</option>
            <option value={60}>60초 (심연)</option>
          </select>
        </div>

        <button 
          onClick={startGeneration}
          disabled={status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS}
          className={`md:col-span-3 w-full font-black py-6 rounded-2xl transition-all transform shadow-2xl uppercase tracking-[0.4em] text-xs border border-white/5 ${
            status === GenerationStatus.GENERATING_SCRIPT || status === GenerationStatus.GENERATING_ASSETS
            ? 'bg-neutral-900 text-neutral-700 cursor-not-allowed'
            : 'bg-red-800 hover:bg-red-700 text-white active:scale-[0.99] shadow-[0_0_30px_rgba(153,27,27,0.3)]'
          }`}
        >
          {status === GenerationStatus.GENERATING_SCRIPT ? '기록을 소환하는 중...' : 
           status === GenerationStatus.GENERATING_ASSETS ? '영혼을 빚는 중 (약 5-10분)...' : '금단의 의식 시작'}
        </button>
      </div>

      {error && (
        <div className="p-6 bg-red-950/20 border border-red-900/30 text-red-500 rounded-3xl text-center text-[11px] font-bold animate-pulse tracking-wide flex items-center justify-center gap-4">
          <span>{error}</span>
          <button onClick={handleOpenKey} className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-white rounded-lg transition-colors uppercase text-[10px]">키 다시 선택</button>
        </div>
      )}

      {script && (
        <div className="space-y-24 pb-40">
          <div className="text-center space-y-6">
            <h2 className="horror-title text-5xl md:text-8xl text-red-600 tracking-tighter drop-shadow-[0_0_30px_rgba(220,38,38,0.4)] uppercase animate-in fade-in duration-1000">{script.title}</h2>
            <p className="max-w-2xl mx-auto text-neutral-500 italic text-sm font-light tracking-[0.1em] opacity-80">"{script.concept}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-2">
            {script.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} />
            ))}
          </div>

          <div className="p-12 border border-white/5 bg-neutral-950/40 rounded-[3rem] backdrop-blur-xl shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-1 h-full bg-red-900 group-hover:bg-red-600 transition-colors"></div>
             <h3 className="text-red-700 font-black mb-6 flex items-center gap-5 uppercase tracking-[0.4em] text-[10px]">
               <span className="w-12 h-[1px] bg-red-900"></span>
               DIRECTOR'S RITUAL NOTES
             </h3>
             <p className="text-neutral-400 leading-relaxed font-light text-sm whitespace-pre-wrap tracking-wide">{script.productionTips}</p>
          </div>
        </div>
      )}
    </div>
  );
};
