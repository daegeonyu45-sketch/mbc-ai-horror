
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { HorrorShortScript, Scene } from "../types";

function decode(base64: string) {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  view.setUint32(0, 0x52494646, false); // RIFF
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false); // WAVE
  view.setUint32(12, 0x666d7420, false); // fmt 
  view.setUint16(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // data
  view.setUint32(40, pcmData.length, true);

  return new Blob([header, pcmData], { type: 'audio/wav' });
}

function extractJson(text: string): string {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return text.substring(start, end + 1);
    }
  } catch (e) {
    console.error("JSON extraction error", e);
  }
  return text;
}

const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "" || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateHorrorScript = async (theme: string, duration: number): Promise<HorrorShortScript> => {
  const ai = getAiInstance();
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `당신은 세계적인 공포 미스터리 쇼츠 작가입니다. ${duration}초 분량의 세로형 영상 대본을 작성하세요.
      주제: ${theme}. 
      정확히 6개의 장면(scenes)으로 구성해야 합니다.
      한국어로 작성하되, imagePrompt만은 Veo AI를 위해 매우 구체적인 영어로 작성하세요.
      imagePrompt 필수 키워드: 'cinematic horror movie', 'dark atmospheric shadows', 'hyper-realistic texture', 'eerie fog', 'dramatic lighting'.`,
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

  const rawText = response.text || "";
  try {
    return JSON.parse(extractJson(rawText));
  } catch (err) {
    throw new Error("대본을 파싱할 수 없습니다. 다시 시도해 주세요.");
  }
};

export const generateSceneVideo = async (prompt: string): Promise<string> => {
  const ai = getAiInstance();
  
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Horror masterpiece: ${prompt}. Cinematic lighting, 1080p look, hyper-realistic.`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video URI not found");

    const separator = downloadLink.includes('?') ? '&' : '?';
    const response = await fetch(`${downloadLink}${separator}key=${process.env.API_KEY}`);
    const arrayBuffer = await response.arrayBuffer();
    return URL.createObjectURL(new Blob([arrayBuffer], { type: 'video/mp4' }));
  } catch (error) {
    console.error("Video Error:", error);
    throw error;
  }
};

export const generateSceneAudio = async (text: string): Promise<string> => {
  const ai = getAiInstance();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `공포 영화 나레이션 톤으로 매우 천천히 속삭이듯 읽으세요: ${text}` }] }],
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
    if (!base64Audio) throw new Error("Audio data empty");

    const pcmData = decode(base64Audio);
    return URL.createObjectURL(pcmToWav(pcmData, 24000));
  } catch (error) {
    console.error("Audio Error:", error);
    throw error;
  }
};
