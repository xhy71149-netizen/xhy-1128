
import { GoogleGenAI, Type } from "@google/genai";
import { VideoClip, GeneratedSequence, SequenceConfig, TimelineItem } from '../types';

// Initialize Gemini Client
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      }
    };
    reader.readAsDataURL(file);
  });
  
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

/**
 * Generate sequences for multiple BGMs.
 * Maintains a usage counter for clips to ensure variety across the batch.
 */
export const generateBatchSequences = async (
  clips: VideoClip[],
  bgmFiles: File[],
  config: SequenceConfig,
  onProgress: (msg: string) => void
): Promise<GeneratedSequence[]> => {
    if (!apiKey) {
        throw new Error("API Key is missing.");
    }
    
    // Track global usage count for each clip across this batch generation session
    // Map<ClipID, Count>
    const globalUsageCount = new Map<string, number>();
    const results: GeneratedSequence[] = [];

    // If no BGMs, treat as single silent generation (or handled by UI policy)
    // But requirement says: "Multiple BGMs = Multiple Videos"
    const iterationCount = bgmFiles.length > 0 ? bgmFiles.length : 1;
    const filesToProcess = bgmFiles.length > 0 ? bgmFiles : [null];

    for (let i = 0; i < iterationCount; i++) {
        const bgm = filesToProcess[i];
        const currentBgmName = bgm ? bgm.name : `Video ${i + 1}`;
        
        onProgress(`正在生成第 ${i + 1}/${iterationCount} 个视频 (${currentBgmName})...`);

        // Identify overused clips (used >= 2 times)
        // Note: The requirement "Every 10 videos, max 2 repetitions" effectively means
        // we should try to avoid clips that have already been used 2 times in the current session.
        const overusedClipIds = Array.from(globalUsageCount.entries())
            .filter(([_, count]) => count >= 2)
            .map(([id, _]) => id);

        const sequence = await generateSingleSequence(
            clips, 
            bgm, 
            config, 
            overusedClipIds, 
            `Batch ${i+1}`
        );

        // Update usage counts
        sequence.timeline.forEach(item => {
            const current = globalUsageCount.get(item.clip.id) || 0;
            globalUsageCount.set(item.clip.id, current + 1);
        });

        results.push(sequence);
    }

    return results;
};

const generateSingleSequence = async (
  clips: VideoClip[],
  bgmFile: File | null,
  config: SequenceConfig,
  avoidClipIds: string[],
  contextId: string
): Promise<GeneratedSequence> => {

  const clipsMetadata = clips.map(c => ({
    id: c.id,
    name: c.name,
    fullDuration: Math.round(c.duration * 100) / 100
  }));

  const parts: any[] = [];

  // Add BGM if exists
  let bgmPromptPart = "";
  if (bgmFile) {
    const audioPart = await fileToGenerativePart(bgmFile);
    parts.push(audioPart);
    bgmPromptPart = `
    我同时也上传了一个背景音乐(BGM)文件。
    请仔细聆听这段音乐，识别其节奏、强拍或转换点。
    你需要在生成的 timeline 中，为每个视频片段分配一个具体的播放时长 'cutDuration'。
    这个 'cutDuration' 应该尽量卡在音乐的节奏点上，或者符合音乐的情绪变化。
    注意：'cutDuration' 必须小于或等于该素材的 'fullDuration'。
    `;
  } else {
    bgmPromptPart = `
    请为每个视频片段分配一个合适的播放时长 'cutDuration'，通常在 2-5 秒之间，除非内容需要更长。
    `;
  }

  // Construct avoidance prompt
  let avoidancePrompt = "";
  if (avoidClipIds.length > 0) {
      avoidancePrompt = `
      注意：以下素材ID在之前的视频中已经使用了多次，请尽量避免再次使用它们，除非为了叙事连续性绝对必要，或者没有其他可用素材：
      [${avoidClipIds.join(', ')}]
      优先选择未使用过的素材。
      `;
  }

  const promptText = `
    我有一组视频素材。请根据它们的文件名所暗示的内容，将其中一部分（或全部）排列成一个有逻辑、有叙事感的视频序列。
    
    ${bgmPromptPart}

    ${avoidancePrompt}

    约束条件:
    1. 总时长必须在 ${config.minDuration} 秒到 ${config.maxDuration} 秒之间。
    2. 尝试讲述一个故事或按主题分组（例如：按时间顺序、按活动逻辑）。
    3. 充分利用文件名称来推断视频内容和上下文。
    4. 必须使用中文返回结果。
    5. 返回的 timeline 数组中的元素必须包含 clipId 和 cutDuration (秒)。
    
    可用素材片段 (JSON):
    ${JSON.stringify(clipsMetadata)}
    
    请返回一个 JSON 对象，Schema如下：
    {
      "title": "视频标题",
      "reasoning": "整体叙事逻辑解释",
      "timeline": [
        { "clipId": "素材ID", "cutDuration": 3.5, "reasoning": "该片段的简要说明" }
      ]
    }
  `;

  parts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            timeline: { 
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                    clipId: { type: Type.STRING },
                    cutDuration: { type: Type.NUMBER },
                    reasoning: { type: Type.STRING }
                },
                required: ["clipId", "cutDuration"]
              }
            }
          },
          required: ["title", "reasoning", "timeline"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    if (!result.timeline || !Array.isArray(result.timeline)) {
      throw new Error("AI 返回的格式无效");
    }

    // Map back IDs to actual clip objects and structure as TimelineItems
    const timeline: TimelineItem[] = result.timeline
      .map((item: any) => {
        const clip = clips.find(c => c.id === item.clipId);
        if (!clip) return null;
        // Ensure cutDuration doesn't exceed actual duration
        const safeDuration = Math.min(item.cutDuration, clip.duration);
        return {
          clip,
          cutDuration: safeDuration,
          reasoning: item.reasoning
        };
      })
      .filter((item: TimelineItem | null): item is TimelineItem => !!item);

    const totalDuration = timeline.reduce((acc, item) => acc + item.cutDuration, 0);

    return {
      id: crypto.randomUUID(),
      bgmName: bgmFile?.name,
      bgmFile: bgmFile || undefined,
      timeline,
      totalDuration,
      narrativeReasoning: result.reasoning,
      title: result.title
    };

  } catch (error) {
    console.error("Gemini AI generation failed:", error);
    throw error;
  }
};
