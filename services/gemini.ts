import { GoogleGenAI, Type } from "@google/genai";
import { VideoClip, GeneratedSequence, SequenceConfig } from '../types';

// Initialize Gemini Client
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateSmartSequence = async (
  clips: VideoClip[],
  config: SequenceConfig
): Promise<GeneratedSequence> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const clipsMetadata = clips.map(c => ({
    id: c.id,
    name: c.name,
    duration: Math.round(c.duration)
  }));

  const prompt = `
    我有一组视频素材。请根据它们的文件名所暗示的内容，将其中一部分（或全部）排列成一个有逻辑、有叙事感的视频序列。
    
    约束条件:
    1. 总时长必须在 ${config.minDuration} 秒到 ${config.maxDuration} 秒之间。
    2. 尝试讲述一个故事或按主题分组（例如：按时间顺序、按活动逻辑）。
    3. 充分利用文件名称来推断视频内容和上下文。
    4. 必须使用中文返回结果。
    
    可用素材片段:
    ${JSON.stringify(clipsMetadata)}
    
    请返回一个 JSON 对象，包含：
    - title: 生成视频的创意标题（中文）。
    - reasoning: 简短解释排列顺序背后的逻辑和叙事思路（中文）。
    - sequence: 按照播放顺序排列的素材 ID 数组。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            sequence: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "reasoning", "sequence"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    if (!result.sequence || !Array.isArray(result.sequence)) {
      throw new Error("AI 返回的格式无效");
    }

    // Map back IDs to actual clip objects
    const orderedClips = result.sequence
      .map((id: string) => clips.find(c => c.id === id))
      .filter((c: VideoClip | undefined): c is VideoClip => !!c);

    const totalDuration = orderedClips.reduce((acc: number, c: VideoClip) => acc + c.duration, 0);

    return {
      clips: orderedClips,
      totalDuration,
      narrativeReasoning: result.reasoning,
      title: result.title
    };

  } catch (error) {
    console.error("Gemini AI generation failed:", error);
    throw error;
  }
};