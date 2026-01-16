
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { HorrorShortScript, Scene } from "../types";

// 가이드라인에 따른 수동 Base64 디코딩 구현
function decode(base64: string) {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Raw PCM 데이터를 표준 WAV 파일로 변환 (브라우저 재생용)
// Gemini TTS는 기본적으로 24000Hz, 16-bit Mono PCM을 반환함
function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier 'RIFF'
  view.setUint32(0, 0x52494646, false);
  // File length (header size - 8 + pcm size)
  view.setUint32(4, 36 + pcmData.length, true);
  // RIFF type 'WAVE'
  view.setUint32(8, 0x57415645, false);
  // Format chunk identifier 'fmt '
  view.setUint32(12, 0x666d7420, false);
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // Channel count (1 is Mono)
  view.setUint16(22, 1, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sampleRate * channels * bitsPerSample / 8)
  view.setUint32(28, sampleRate * 2, true);
  // Block align (channels * bitsPerSample / 8)
  view.setUint16(32, 2, true);
  // Bits per sample
  view.setUint16(34, 16, true);
  // Data chunk identifier 'data'
  view.setUint32(36, 0x64617461, false);
  // Data chunk length
  view.setUint32(40, pcmData.length, true);

  return new Blob([header, pcmData], { type: 'audio/wav' });
}

// JSON 추출 헬퍼 (마크다운 블록 제거 등)
function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export const generateHorrorScript = async (theme: string, duration: number): Promise<HorrorShortScript> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `당신은 전문 공포 미스터리 쇼츠 작가입니다. ${duration}초 분량의 세로형 영상 대본을 작성하세요.
      주제: ${theme}. 
      반드시 정확히 6개의 장면(scenes)으로 구성해야 합니다.
      모든 필드는 한국어로 작성하되, imagePrompt만은 Veo 비디오 생성 AI를 위해 매우 구체적이고 예술적인 영어로 작성하세요.
      imagePrompt에는 'cinematic horror movie', 'dark atmospheric shadows', 'hyper-realistic texture', 'eerie fog' 키워드를 포함하세요.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          concept: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sceneNumber: { type: Type.INTEGER },
                timeRange: { type: Type.STRING },
                screenDescription: { type: Type.STRING },
                narration: { type: Type.STRING },
                bgmMood: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ["sceneNumber", "timeRange", "screenDescription", "narration", "bgmMood", "imagePrompt"]
            }
          },
          productionTips: { type: Type.STRING }
        },
        required: ["title", "concept", "scenes", "productionTips"]
      }
    }
  });

  const rawText = response.text;
  try {
    return JSON.parse(extractJson(rawText));
  } catch (err) {
    console.error("JSON Parsing Error:", err, rawText);
    throw new Error("대본을 파싱하는 중 오류가 발생했습니다.");
  }
};

export const generateSceneVideo = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `A high-quality cinematic horror scene: ${prompt}. Dark atmosphere, hyper-realistic, eerie shadows.`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16'
      }
    });

    // 비디오 생성 완료까지 폴링
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("비디오 생성 결과가 유효하지 않습니다.");

    // 가이드라인에 따라 API 키를 파라미터로 붙여서 다운로드
    const separator = downloadLink.includes('?') ? '&' : '?';
    const finalUrl = `${downloadLink}${separator}key=${process.env.API_KEY}`;
    
    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error(`비디오 파일 다운로드 실패: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const videoBlob = new Blob([arrayBuffer], { type: 'video/mp4' });
    return URL.createObjectURL(videoBlob);
  } catch (error) {
    console.error("Video Generation Error:", error);
    throw error;
  }
};

export const generateSceneAudio = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `공포스럽고 소름끼치는 낮은 목소리로 천천히 읽어주세요: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("TTS 오디오 데이터를 받지 못했습니다.");

    const pcmData = decode(base64Audio);
    const audioBlob = pcmToWav(pcmData, 24000);
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error("Audio Generation Error:", error);
    throw error;
  }
};
