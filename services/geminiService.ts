

import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { Scene, AssetItem, ChatMessage, ScriptOption, VideoModel } from "../types";
import { AI_SCREENWRITER_INSTRUCTION, SHOT_FLOW_KB, VISUAL_STYLE_KB, EDITING_ANALYSIS_KB } from "../constants";
import { agentConfig } from '../src/agentConfig';

// Helper to add WAV header to raw PCM data
const addWavHeader = (pcmData: Uint8Array, sampleRate: number): Uint8Array => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    
    // RIFF header
    view.setUint32(0, 0x46464952, true); // "RIFF"
    view.setUint32(4, 36 + pcmData.length, true); // File size - 8
    view.setUint32(8, 0x45564157, true); // "WAVE"
    
    // fmt chunk
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true); // Chunk size
    view.setUint16(20, 1, true); // Audio format (1 = PCM)
    view.setUint16(22, 1, true); // Channels (1 = Mono)
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    
    // data chunk
    view.setUint32(36, 0x61746164, true); // "data"
    view.setUint32(40, pcmData.length, true); // Data size
    
    const wav = new Uint8Array(header.byteLength + pcmData.length);
    wav.set(new Uint8Array(header), 0);
    wav.set(pcmData, 44);
    return wav;
};

// Viva API Configuration - Initialize from LocalStorage
let vivaApiKey: string | null = typeof window !== 'undefined' ? localStorage.getItem('viva_api_key') : null;
let vivaApiKey2: string | null = typeof window !== 'undefined' ? localStorage.getItem('viva_api_key_2') : null;
let vivaActiveKeyIndex: number = typeof window !== 'undefined' ? parseInt(localStorage.getItem('viva_active_key_index') || '1') : 1;
let vivaBaseUrl: string = (typeof window !== 'undefined' ? localStorage.getItem('viva_base_url') : null) || agentConfig.baseUrl;

const getActiveApiKey = () => {
    if (vivaActiveKeyIndex === 2) return vivaApiKey2 || vivaApiKey;
    return vivaApiKey || vivaApiKey2;
};

// Legacy custom config (for Gemini direct)
let customApiKey: string | null = typeof window !== 'undefined' ? (vivaActiveKeyIndex === 2 ? (localStorage.getItem('viva_api_key_2') || localStorage.getItem('viva_api_key')) : (localStorage.getItem('viva_api_key') || localStorage.getItem('viva_api_key_2'))) : null;
let customBaseUrl: string | null = typeof window !== 'undefined' ? localStorage.getItem('viva_base_url') : null;

// Unified Setter with Persistence
export const setCustomConfig = (key: string, baseUrl?: string, key2?: string, activeIndex?: number) => {
  vivaApiKey = key;
  if (typeof window !== 'undefined') {
      localStorage.setItem('viva_api_key', key);
  }
  
  if (key2 !== undefined) {
      vivaApiKey2 = key2;
      if (typeof window !== 'undefined') {
          localStorage.setItem('viva_api_key_2', key2);
      }
  }

  if (activeIndex !== undefined) {
      vivaActiveKeyIndex = activeIndex;
      if (typeof window !== 'undefined') {
          localStorage.setItem('viva_active_key_index', activeIndex.toString());
      }
  }
  
  if (baseUrl) {
      vivaBaseUrl = baseUrl;
      if (typeof window !== 'undefined') localStorage.setItem('viva_base_url', baseUrl);
  }
  
  // Legacy
  customApiKey = getActiveApiKey();
  if (typeof window !== 'undefined') {
      localStorage.setItem('custom_api_key', customApiKey || '');
  }
  
  if (baseUrl) {
      customBaseUrl = baseUrl;
      if (typeof window !== 'undefined') localStorage.setItem('custom_base_url', baseUrl);
  }
};

// Deprecated legacy setter
export const setCustomApiKey = (key: string) => {
  setCustomConfig(key);
};

export const openKeySelection = async () => {
  const win = window as any;
  if (win.aistudio) {
    await win.aistudio.openSelectKey();
  }
};

/**
 * Client for Standard Operations (Always Google Official / Default)
 */
const getDefaultClient = () => {
  // If custom key is set, try to use it (assuming proxy supports Google protocol)
  const activeKey = getActiveApiKey();
  if (activeKey) {
      return new GoogleGenAI({ 
          apiKey: activeKey, 
          baseUrl: customBaseUrl || undefined 
      } as any);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("系统默认 API Key 未配置且未检测到自定义 Key。");
  }
  return new GoogleGenAI({ apiKey });
};

const translateErrorMessage = (error: any): string => {
    const msg = String(error).toLowerCase();
    if (msg.includes('400') || msg.includes('invalid argument')) return "参数错误 (400)。";
    if (msg.includes('401') || msg.includes('unauthenticated')) return "认证失败 (401): API Key 无效。";
    if (msg.includes('403') || msg.includes('permission denied')) return "权限不足 (403)。";
    if (msg.includes('404') || msg.includes('not found')) return "模型/端点未找到 (404)。";
    if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted')) return "配额超限 (429)。";
    if (msg.includes('500') || msg.includes('internal')) return "服务器错误 (500)。";
    return `错误: ${msg.substring(0, 100)}...`;
};

const retryOperation = async <T>(
  operation: () => Promise<T>, 
  retries = 3, 
  delay = 2000
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const msg = String(error).toLowerCase();
    if (msg.includes('400') || msg.includes('401') || msg.includes('403') || msg.includes('404') || msg.includes('safety')) {
         throw new Error(translateErrorMessage(error));
    }
    if (retries > 0) {
      console.warn(`API Error. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2); 
    }
    throw new Error(translateErrorMessage(error));
  }
};

const cleanJson = (text: string): string => {
    const firstOpenBrace = text.indexOf('{');
    const lastCloseBrace = text.lastIndexOf('}');
    const firstOpenBracket = text.indexOf('[');
    const lastCloseBracket = text.lastIndexOf(']');
    let start = -1;
    let end = -1;
    if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
        start = firstOpenBrace;
        end = lastCloseBrace;
    } else if (firstOpenBracket !== -1) {
        start = firstOpenBracket;
        end = lastCloseBracket;
    }
    if (start !== -1 && end !== -1 && end > start) {
        return text.substring(start, end + 1);
    }
    return text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
};

const TEXT_MODELS = [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gpt-5.2',
    'gpt-5.3-chat-latest',
    'gpt-5.4'
];

const IMAGE_MODELS = [
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview',
    'gemini-3.1-flash-image-preview'
];

const callVivaTextAI = async (
    prompt: string, 
    systemInstruction?: string, 
    jsonMode: boolean = false,
    imageBytes?: string,
    model: string = 'gemini-3.1-flash-lite-preview'
): Promise<string> => {
    const executeCall = async (currentModel: string) => {
        const messages: any[] = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

        if (imageBytes) {
            messages.push({
                role: 'user',
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:image/png;base64,${imageBytes}` } }
                ]
            });
        } else {
            messages.push({ role: 'user', content: prompt });
        }

        const body: any = {
            model: currentModel,
            messages: messages,
            stream: false
        };

        // Support for GPT-5 models with thinking mode
        if (currentModel === 'gpt-5.2') {
            body.extra_body = { enable_thinking: true };
            body.tools = [];
            body.tool_choice = "none";
        }

        if (jsonMode) {
            const jsonInstruction = "\n\nIMPORTANT: Return ONLY valid JSON. Do not use Markdown code blocks (no ```json). Do not add explanations. Just the JSON object/array.";
            const lastMsgIndex = body.messages.length - 1;
            const lastMsg = body.messages[lastMsgIndex];
            if (Array.isArray(lastMsg.content)) {
                 const textPart = lastMsg.content.find((c: any) => c.type === 'text');
                 if (textPart) textPart.text += jsonInstruction;
            } else {
                 lastMsg.content += jsonInstruction;
            }
        }

        const resp = await fetch(`${vivaBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getActiveApiKey()}`
            },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Viva API Error ${resp.status}: ${errText}`);
        }

        const data = await resp.json();
        return data.choices?.[0]?.message?.content || "";
    };

    try {
        return await executeCall(model);
    } catch (e) {
        console.warn(`Text model ${model} failed, trying fallback...`, e);
        // Fallback logic: try other models randomly
        const otherModels = TEXT_MODELS.filter(m => m !== model);
        const shuffled = [...otherModels].sort(() => Math.random() - 0.5);
        
        for (const fallbackModel of shuffled) {
            try {
                console.log(`Trying fallback text model: ${fallbackModel}`);
                return await executeCall(fallbackModel);
            } catch (fallbackError) {
                console.warn(`Fallback text model ${fallbackModel} also failed.`);
            }
        }
        throw e;
    }
};

const callVivaImageGen = async (promptParts: any[], aspectRatio: string, model: string = 'gemini-3.1-flash-image-preview'): Promise<string> => {
    const executeImageCall = async (currentModel: string) => {
        const apiKey = getActiveApiKey() || customApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key missing");
        const baseUrl = vivaBaseUrl.replace(/\/+$/, '');
        const url = `${baseUrl}/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
        const isHighQualityModel = currentModel.includes('gemini-3-pro-image') || currentModel.includes('gemini-3.1-flash-image');
        const imageConfig: any = { aspectRatio: aspectRatio };
        const modalities = ["IMAGE"];
        if (isHighQualityModel) {
            imageConfig.imageSize = "1K"; 
            modalities.push("TEXT");
        }
        const body = {
            contents: [{ role: "user", parts: promptParts }],
            generationConfig: { responseModalities: modalities, imageConfig: imageConfig }
        };
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`Viva Image API Error ${response.status}: ${await response.text()}`);
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inline_data && part.inline_data.data) return part.inline_data.data;
            if (part.inlineData && part.inlineData.data) return part.inlineData.data;
        }
        throw new Error("No image data found");
    };

    try {
        return await executeImageCall(model);
    } catch (e) {
        console.warn(`Image model ${model} failed, trying fallback...`, e);
        const otherModels = IMAGE_MODELS.filter(m => m !== model);
        const shuffled = [...otherModels].sort(() => Math.random() - 0.5);

        for (const fallbackModel of shuffled) {
            try {
                console.log(`Trying fallback image model: ${fallbackModel}`);
                return await executeImageCall(fallbackModel);
            } catch (fallbackError) {
                console.warn(`Fallback image model ${fallbackModel} also failed.`);
            }
        }
        throw e;
    }
};

export const testApiConnection = async (apiKey: string, baseUrl?: string): Promise<boolean> => {
  try {
      const url = baseUrl || vivaBaseUrl;
      const resp = await fetch(`${url}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'gemini-3.1-flash-lite-preview', messages: [{role: 'user', content: 'ping'}] })
      });
      return resp.ok;
  } catch (e) { return false; }
};

export const translateText = async (text: string, targetLang: 'en' | 'zh'): Promise<string> => {
  return retryOperation(async () => {
    const prompt = `Translate to ${targetLang === 'en' ? 'English' : 'Chinese (Simplified)'}. Return ONLY the translated text.\nText: "${text}"`;
    if (getActiveApiKey()) return await callVivaTextAI(prompt);
    const ai = getDefaultClient();
    const response = await ai.models.generateContent({ model: 'gemini-3.1-flash-lite-preview', contents: prompt });
    return response.text?.trim() || "";
  });
};

export const analyzeImageForPrompt = async (imageBytes: string): Promise<string> => {
  return retryOperation(async () => {
    const prompt = `Act as a 'Shot Designer'. Analyze this image. Identify the Composition, Tone, and Depth techniques used. Return a concise analysis in Chinese (Simplified) suitable for a visual prompt.`;
    if (getActiveApiKey()) return await callVivaTextAI(prompt, undefined, false, imageBytes);
    const ai = getDefaultClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: { parts: [ { inlineData: { mimeType: 'image/png', data: imageBytes } }, { text: prompt } ] }
    });
    return response.text?.trim() || "";
  });
};

export const extractAssetsFromScript = async (script: string): Promise<{ characters: {name: string, description: string}[], scenes: {name: string, description: string}[] }> => {
  return retryOperation(async () => {
    const prompt = `Analyze the script and extract specific character names and core location names.
    For each, provide a brief Visual Description based on the "步骤二" (Visual Prompts) section or the script content itself.
    CRITICAL: Return JSON with structure:
    { 
      "characters": [ { "name": "Name", "description": "Visual details in Simplified Chinese..." } ], 
      "scenes": [ { "name": "Location Name", "description": "Environment details in Simplified Chinese..." } ] 
    }
    Use Simplified Chinese for BOTH Names AND Descriptions (for consistent image generation).
    Script: "${script}"`;
    
    let result: any;
    if (getActiveApiKey()) {
        const text = await callVivaTextAI(prompt, "You are a precise script analyzer.", true);
        result = JSON.parse(cleanJson(text));
    } else {
        const ai = getDefaultClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: prompt,
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 1024 } }
        });
        result = JSON.parse(cleanJson(response.text || "{}"));
    }

    const sanitize = (list: any[]) => (Array.isArray(list) ? list : []).map(item => {
        const name = item.name || (typeof item === 'string' ? item : "Unknown");
        const description = item.description || "";
        return { name, description };
    });

    return { 
        characters: sanitize(result.characters || []), 
        scenes: sanitize(result.scenes || []) 
    };
  });
};

export const generateTopicIdeas = async (categoryName: string, templateName: string, styleName: string, model: string = 'gemini-3.1-flash-lite-preview'): Promise<string[]> => {
    return retryOperation(async () => {
        const prompt = `
你是一位顶级的短视频创意策划专家。请根据以下题材，生成 10 条不同的爆款创意想法。

【题材名称】：${templateName}

【生成要求】：
1. 每一条创意必须严格包含以下三个部分：
   - 核心钩子：一句话戳中爽点/泪点/好奇心。
   - 一句话简介：用 15-25 字讲清核心冲突 + 反转/看点。
   - 标签：包含 #题材关键词 #爽点/情绪词 #爆款标签。
2. 创意要具有极强的吸引力，符合短视频平台的传播逻辑。
3. 严格输出一个 JSON 数组（不要包含任何其他 markdown 标记或解释说明），格式如下：
[
  {
    "hook": "一句话戳中爽点/泪点/好奇心",
    "intro": "15-25字的简介，讲清冲突与反转",
    "tags": "#标签1 #标签2 #标签3"
  }
]
`;
        
        let jsonStr = "";
        if (getActiveApiKey()) {
            jsonStr = await callVivaTextAI(prompt, "Creative Director", true, undefined, model);
        } else {
            const ai = getDefaultClient();
            const response = await ai.models.generateContent({
                model: model as any,
                contents: prompt,
                config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 1024 } }
            });
            jsonStr = response.text || "[]";
        }

        try {
            const topics = JSON.parse(cleanJson(jsonStr));
            if (Array.isArray(topics)) {
                return topics.map((t: any) => `【${templateName}】：${t.hook} 一句话简介：${t.intro} 标签：${t.tags}`);
            }
            return [];
        } catch (e) {
            console.error("Failed to parse topic ideas", e);
            return [];
        }
    });
};
export const generateScriptByScenes = async (topic: string, stylePrompt: string, styleName: string, templateName: string, duration: number, sceneCount: number, aspectRatio: string, model: string = 'gemini-3.1-flash-lite-preview'): Promise<{ title: string; outline: string; content: string }> => {
    return retryOperation(async () => {
        const prompt = `

# 短剧 AI 生成全流程预设提示

## 一、剧本创作核心需求
### 生成逻辑
1. **核心锚定**：以用户选择的「故事题材」为叙事基底，结合「创意想法」提炼核心冲突/亮点，将完整故事拆解为「视频数量」个独立且连贯的短视频单元。
2. **节奏适配**：每个单元严格匹配「单视频时长」，控制台词/动作密度，保证节奏紧凑不拖沓；同时适配「视频比例」，在场景描述中明确竖屏构图重点。
3. **风格融合**：将「视觉风格」的核心视觉特征融入场景氛围、人物造型和画面细节。
4. **结构规范**：剧本采用「总起设定 → 分镜列表 → 收尾衔接」的结构，每个分镜对应 1 个短视频，清晰标注场景、人物、首帧起始动作、台词、情绪和风格提示；适配 AI 图生视频，核心动作需为视频首帧的「动作刚发生/正准备发生的起始态」。

### 输入参数
- 故事题材：${templateName}
- 视觉风格：${styleName}
- 风格附加要求：${stylePrompt}
- 创意想法：${topic || '请基于“故事题材”自动构思一个极具吸引力、有戏剧冲突的故事'}
- 单视频时长：${duration}秒/个
- 视频数量：${sceneCount}个
- 视频比例：${aspectRatio}（${aspectRatio === '9:16' ? '竖屏' : '横屏'}）

## 二、AI 图生视频-首帧图中文 AI 绘画提示词
### 生成逻辑
1. **画面提取**：以剧本中每个分镜的首帧起始动作为核心，提取场景、人物、起始动作、情绪等核心视觉元素，锁定视频动态起点。
2. **动作时间锚定**：明确动作处于「刚发生/准备发生」的临界状态，避免生成动作已完成画面。使用“即将、刚、准备、尚未”等时间状语强化瞬间感。
3. **风格强化**：精准融入「视觉风格」的核心视觉特征，仅做静态画面描述，不添加动态效果。
4. **构图适配**：锚定 1 个核心视觉焦点，避免画面元素杂乱。
5. **细节补充**：添加光影、色彩、质感等细节，贴合题材氛围。

## 三、AI 图生视频-中文 AI 视频提示词
### 生成逻辑
1. **动态扩展**：以首帧图为动态起点，自然延续为动态视频指令，严格匹配「单视频时长」的节奏控制。
2. **镜头语言**：明确镜头运动（如推镜、拉镜、固定镜头）、转场方式。
3. **风格动态化**：将「视觉风格」转化为动态效果。
4. **氛围营造**：添加音效/氛围音提示。
5. **全局统一参数强制引用**：所有视频片段必须遵守预设的「全局统一参数」（背景音、音效、风格动态），保证多片段间的听觉与风格一致性。
6. **禁止人声**：生成视频中的人物禁止说话及有旁白说话声音产出，因为人物说话需要单独配音。视频提示词中不要包含任何关于人物说话、台词或旁白的描述。

## 四、AI 配音（语音）提示词生成逻辑与输入要求
### 生成逻辑
1. **剧本提取**：以剧本分镜中的「人物」「台词」「情绪氛围」为核心，锁定每句台词的演绎基调。
2. **情感细化**：结合剧情上下文，明确每句台词的具体情感（如紧张、窃喜、愤怒、疲惫）及情绪变化（如从平静到激动）。
3. **语速与节奏控制**：根据台词内容、人物性格及剧情张力，设定语速（快/中/慢）、停顿位置、重音强调等细节。
4. **纯净人声**：音频只会生成人物说话声音，不会生成什么“轻快且略带搞笑的背景音乐高潮、伴随着清脆的键盘敲击声和成功提交的系统提示音、急促的时钟滴答声、快递员发出夸张的憋气声音“等之类的音效。
5. **台词字数控制**：角色的台词数量必须严格考虑剧本的单视频时长（${duration}秒）。正常语速约为每秒4-5个字，请确保生成的台词字数在合理范围内，避免台词过长导致音频超出视频时长。

### 示例参考
音频提示词的内容必须严格区分角色，格式为“[角色名]：(情绪/语气)台词内容”。
1. 单人发言：[小明]：(自信且略带神经质)社交牛逼症插件，安装中...。
2. 多位发言：[小明]：(疲惫)那么……今天有什么安排？[旁白]：(低沉)他并不知道，危险正在靠近。[小红]：(兴奋)你绝对猜不到，我会给你一个惊喜！
3. 旁白也算一个角色，请务必标注为“[旁白]”。

## 五、全局统一参数预设生成
请根据题材，生成一套完整的全局统一参数预设，包含：
- 配音全局统一参数（主角、配角、旁白音色，音量平衡，语言等）
- 背景环境音统一设定（主场景、转场场景、音量）
- 音效统一设定（动作音效、情绪音效、响应速度）
- 风格动态统一设定（视觉风格动态表现、动态节奏）

## 六、输出格式
请严格输出一个 JSON 对象（不要包含任何其他 markdown 标记或解释说明），格式如下：
{
  "global_params": {
    "voice_setting": "...",
    "background_audio": "...",
    "sound_effects": "...",
    "style_dynamics": "..."
  },
  "scenes": [
    {
      "scene_number": 1,
      "scene_name": "场景名称",
      "character": "人物",
      "start_action": "首帧起始动作",
      "visual_description": "画面描述",
      "visual_prompt": "中文AI绘画提示词",
      "video_prompt": "中文AI视频提示词",
      "audio_prompt": "角色音色设定 + 情绪语气 + 台词/旁白 + 语速/停顿/重音等细节"
    }
  ]
}
`;
        let jsonStr = "";
        if (getActiveApiKey()) {
            jsonStr = await callVivaTextAI(prompt, "Professional Director", true, undefined, model);
        } else {
            const ai = getDefaultClient();
            const response = await ai.models.generateContent({
                model: model as any,
                contents: prompt,
                config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 4096 } }
            });
            jsonStr = response.text || "{}";
        }

        let result: any;
        try {
            result = JSON.parse(cleanJson(jsonStr));
        } catch (e) {
            console.error("Failed to parse script JSON", e);
            throw new Error("Failed to generate valid script JSON.");
        }

        const scenes = result.scenes || [];
        const globalParams = result.global_params || {};

        // Format as structured text for the editor using Chinese labels
        let contentText = "";
        contentText += `人声设定: ${globalParams.voice_setting || ''}\n`;
        contentText += `背景环境音: ${globalParams.background_audio || ''}\n`;
        contentText += `音效设定: ${globalParams.sound_effects || ''}\n`;
        contentText += `风格动态设定: ${globalParams.style_dynamics || ''}\n\n`;

        const globalParamsText = contentText;

        if (Array.isArray(scenes)) {
            scenes.forEach((scene: any) => {
                contentText += `[视频 ${scene.scene_number}]\n`;
                contentText += `场景名称: ${scene.scene_name || ''}\n`;
                contentText += `角色名称: ${scene.character || ''}\n`;
                contentText += `画面描述: ${scene.visual_description || ''}\n`;
                contentText += `绘画提示词: ${scene.visual_prompt || ''}\n`;
                contentText += `视频提示词: ${scene.video_prompt || ''}\n`;
                contentText += `音频提示词: ${scene.audio_prompt || ''}\n\n`;
            });
        }

        return {
            title: topic || templateName,
            outline: `${sceneCount} scenes about ${topic || templateName}`,
            content: contentText
        };
    });
};

export const generateScript = async (finalScriptText: string, styleModifier: string, characters?: string[], topic?: string): Promise<Scene[]> => {
  return retryOperation(async () => {
    const charList = characters && characters.length > 0 ? `\n    Core Characters to use: ${characters.join(', ')}` : '';
    const topicInfo = topic ? `\n    Creative Idea (创意想法): ${topic}` : '';
    const prompt = `
    Task: Parse the provided storyboard script text into a structured JSON list.${charList}${topicInfo}
    Script Source:
    "${finalScriptText}"
    
    Instructions:
    - The script is formatted with [视频 X] headers.
    - Extract fields from labels: 场景名称, 角色名称, 画面描述, 绘画提示词, 视频提示词, 音频提示词.
    - Map to the output JSON structure below.
    - 'visualPrompt' = 绘画提示词
    - 'script' = (If Creative Idea is provided, prepend it: "创意想法: " + Creative Idea + "\\n\\n") + 场景名称 + "\\n" + 画面描述 + "\\n" + 音频提示词
    - 'videoPrompt' = 视频提示词
    - 'cameraPrompt' = 视频提示词
    - 'character' = 角色名称 (Try to match with Core Characters if provided)
    - 'globalParams' = 全局统一参数预设 (The section before [视频 1])
    - CRITICAL: If '音频提示词' (Audio Prompt) contains dialogue between multiple characters (e.g., "角色1: ... 角色2: ...") or a narrator and a character, you MUST split them into separate entries in the 'audios' array.
    - Each entry in 'audios' must have a 'name' and a 'prompt'.
    - 'prompt' should include the emotion and the actual dialogue for THAT character.
    - Narrator (旁白) counts as a character.
    - If fields are missing, infer them from context.
    
    Return JSON Array:
    [
      { 
        "sceneNumber": number, 
        "script": "Chinese description and audio prompt...", 
        "visualPrompt": "Chinese visual prompt...", 
        "videoPrompt": "Chinese video prompt...",
        "cameraPrompt": "Camera action...",
        "audios": [
          { "name": "Character Name", "prompt": "Audio prompt for this character..." }
        ],
        "character": "Main character name",
        "globalParams": "..."
      },
      ...
    ]
    `;
    if (getActiveApiKey()) {
        const text = await callVivaTextAI(prompt, "Script Parser", true);
        const parsed = JSON.parse(cleanJson(text)) as any[];
        return parsed.map(p => {
            let audios = p.audios && Array.isArray(p.audios) ? p.audios.map((a: any, idx: number) => ({
                name: a.name || (idx === 0 ? (p.character || '角色 A') : '角色 B'),
                prompt: a.prompt || '',
                voice: a.name === '旁白' ? 'Schedar' : (idx === 0 ? 'Kore' : 'Puck')
            })) : [];

            if (audios.length === 0) {
                // Fallback if model didn't return audios array
                audios = [
                    { prompt: p.audioPrompt || '', voice: 'Kore', name: p.character || (characters?.[0] || '角色 A') },
                    { prompt: '', voice: 'Puck', name: characters?.[1] || '角色 B' }
                ];
            }
            
            // Ensure at least 2 slots for UI consistency
            if (audios.length === 1) {
                audios.push({ prompt: '', voice: 'Puck', name: characters?.[1] || '角色 B' });
            }

            return { ...p, audios };
        }) as Scene[];
    }
    const ai = getDefaultClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } }
    });
    const parsed = JSON.parse(cleanJson(response.text || "[]")) as any[];
    return parsed.map(p => {
        let audios = p.audios && Array.isArray(p.audios) ? p.audios.map((a: any, idx: number) => ({
            name: a.name || (idx === 0 ? (p.character || '角色 A') : '角色 B'),
            prompt: a.prompt || '',
            voice: idx === 0 ? 'Kore' : 'Puck'
        })) : [];

        if (audios.length === 0) {
            audios = [
                { prompt: p.audioPrompt || '', voice: 'Kore', name: p.character || (characters?.[0] || '角色 A') },
                { prompt: '', voice: 'Puck', name: characters?.[1] || '角色 B' }
            ];
        } else if (audios.length === 1) {
            audios.push({ prompt: '', voice: 'Puck', name: characters?.[1] || '角色 B' });
        }

        return { ...p, audios };
    }) as Scene[];
  });
};

export const generateAssetImage = async (
    name: string,
    type: 'character' | 'scene',
    styleModifier: string,
    aspectRatio: '9:16' | '16:9' = '16:9',
    description?: string, // Derived from script
    model: string = 'gemini-3.1-flash-image-preview'
): Promise<string> => {
    return retryOperation(async () => {
        let specificPrompt = "";
        const descText = description ? `Visual Details: ${description}` : "";

        if (type === 'character') {
            specificPrompt = `
            Task: Create full-body image of "${name}" on PURE WHITE BACKGROUND (#FFFFFF).
            STYLE: ${styleModifier}. Apply this style ONLY to the character's appearance, clothing, and textures.
            ${descText}
            POSTURE: If human, stand upright. If ANIMAL or NON-HUMAN, use its NATURAL POSTURE.
            CRITICAL: The background must be 100% pure white, no shadows, no floor, no environment. 
            NO TEXT, NO SUBTITLES, NO CAPTIONS, NO WATERMARKS, NO LETTERS on the image.
            `;
        } else {
            specificPrompt = `
            Task: Environment Concept Art for "${name}". 
            STYLE: ${styleModifier}.
            ${descText}
            Pure Scenery. NO PEOPLE.
            `;
        }
        const prompt = `Design a ${type}. ${specificPrompt} Aspect Ratio: ${aspectRatio}.`;
        return await callVivaImageGen([{ text: prompt }], aspectRatio, model);
    });
};

export const generateSceneImage = async (
  visualPrompt: string,
  cameraPrompt: string,
  characters: AssetItem[],
  coreScenes: AssetItem[],
  aspectRatio: '9:16' | '16:9' = '16:9',
  sceneReferenceImages?: Array<{ data: string; mimeType: string } | undefined>,
  model: string = 'gemini-3.1-flash-image-preview'
): Promise<string> => {
    const parts: any[] = [];
    // Constructed prompt handling Chinese visualPrompt gracefully
    let promptInstructions = `Generate a cinematic image. Visual Prompt: "${visualPrompt}". Camera: "${cameraPrompt}". Aspect Ratio: ${aspectRatio}.`;
    
    const addImagePart = (data: string, mimeType: string) => { parts.push({ inline_data: { mime_type: mimeType, data: data } }); };
    characters.forEach(c => { if (c.data && c.autoReference !== false) { addImagePart(c.data, c.mimeType); promptInstructions += ` [Ref Character: ${c.name}]`; } });
    coreScenes.forEach(s => { if (s.data && s.autoReference !== false) { addImagePart(s.data, s.mimeType); promptInstructions += ` [Ref Location: ${s.name}]`; } });
    if (sceneReferenceImages) sceneReferenceImages.forEach(img => { if (img?.data) { addImagePart(img.data, img.mimeType); promptInstructions += ` [Ref Composition]`; } });
    parts.push({ text: promptInstructions });
    return retryOperation(async () => await callVivaImageGen(parts, aspectRatio, model));
};

export const editSceneImage = async (imageBytes: string, instruction: string, aspectRatio: '9:16' | '16:9'): Promise<string> => {
    return retryOperation(async () => {
        const parts = [ { inline_data: { mime_type: 'image/png', data: imageBytes } }, { text: `Edit: ${instruction}. Aspect: ${aspectRatio}` } ];
        return await callVivaImageGen(parts, aspectRatio);
    });
};

export const generateAudio = async (
    prompt: string,
    voiceConfig: { voiceName?: string; multiSpeakerVoiceConfig?: { speakerVoiceConfigs: { speaker: string; voiceName: string }[] } },
    model: string = 'gemini-2.5-flash-preview-tts',
    duration?: number
): Promise<string> => {
    return retryOperation(async () => {
        const apiKey = vivaApiKey || customApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key missing");
        
        const config: any = {
            responseModalities: [Modality.AUDIO],
        };

        if (voiceConfig.multiSpeakerVoiceConfig) {
            config.speechConfig = {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: voiceConfig.multiSpeakerVoiceConfig.speakerVoiceConfigs.map(s => ({
                        speaker: s.speaker,
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voiceName } }
                    }))
                }
            };
        } else if (voiceConfig.voiceName) {
            config.speechConfig = {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceConfig.voiceName } }
            };
        }
        
        const baseUrl = vivaBaseUrl.replace(/\/+$/, '');
        const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

        let finalPrompt = voiceConfig.multiSpeakerVoiceConfig 
            ? `TTS the following conversation:\n${prompt}`
            : prompt;
        
        if (duration) {
            finalPrompt += `\n\nIMPORTANT: The audio must fit within approximately ${duration} seconds.`;
        }

        const body = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: config,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Viva Audio API Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const part = data.candidates?.[0]?.content?.parts?.[0];
        let base64Audio = part?.inlineData?.data || part?.inline_data?.data;

        if (!base64Audio) throw new Error("Audio generation failed: No audio data returned");
        
        if (base64Audio.startsWith('data:')) {
            base64Audio = base64Audio.split(',')[1];
        }
        
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Add WAV header if it's raw PCM
        const wavData = addWavHeader(bytes, 24000);
        const blob = new Blob([wavData as any], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    });
};


export const generateVideo = async (

  imageBytes: string,
  prompt: string,
  aspectRatio: '9:16' | '16:9',
  duration: number = 5,
  signal?: AbortSignal,
  model: VideoModel = 'sora-2-all'
): Promise<string> => {
    let finalPrompt = prompt;
    if (!prompt.toLowerCase().includes('language')) finalPrompt += ", speaking language: Chinese (Mandarin)";
    const activeKey = getActiveApiKey();
    if (activeKey) {
        let attempts = 0;
        while (attempts < 3) {
            try {
                if (signal?.aborted) throw new Error("Aborted");
                
                if (model.includes('grok-video-3')) {
                    let grokAspectRatio = '1:1';
                    if (aspectRatio === '16:9') grokAspectRatio = '3:2';
                    if (aspectRatio === '9:16') grokAspectRatio = '2:3';

                    const body = {
                        model: model,
                        prompt: finalPrompt + " --mode=custom",
                        aspect_ratio: grokAspectRatio,
                        size: model === 'grok-video-3-15s' ? "1080P" : "720P",
                        images: [`data:image/png;base64,${imageBytes}`]
                    };

                    const createResp = await fetch(`${vivaBaseUrl}/v1/video/create`, {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${activeKey}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(body),
                        signal: signal
                    });

                    if (!createResp.ok) {
                        const errText = await createResp.text();
                        if (createResp.status === 500 && errText.includes('get_channel_failed')) {
                            throw new Error("RETRYABLE_LOAD_ERROR");
                        }
                        throw new Error(`Grok Video API Error ${createResp.status}: ${errText}`);
                    }

                    const createData = await createResp.json();
                    const taskId = createData.id;
                    if (!taskId) throw new Error("No Task ID returned from Grok API");

                    let videoUrl = null;
                    let checkAttempts = 0;
                    while (!videoUrl && checkAttempts < 120) {
                        if (signal?.aborted) throw new Error("Aborted");
                        await new Promise(r => setTimeout(r, 5000)); 
                        checkAttempts++;
                        const checkResp = await fetch(`${vivaBaseUrl}/v1/video/query?id=${taskId}`, { 
                            headers: { 
                                'Authorization': `Bearer ${getActiveApiKey()}`,
                                'Accept': 'application/json'
                            }, 
                            signal 
                        });
                        
                        if (checkResp.ok) {
                            const checkData = await checkResp.json();
                            if (checkData.status === 'completed' && checkData.video_url) {
                                videoUrl = checkData.video_url;
                            } else if (checkData.status === 'failed') {
                                throw new Error("Grok Video Generation Failed");
                            }
                        }
                    }
                    if (!videoUrl) throw new Error("Timeout waiting for Grok video");
                    return videoUrl;
                } else {
                    const formData = new FormData();
                    formData.append('model', model);
                    formData.append('prompt', finalPrompt);
                    formData.append('seconds', duration.toString()); 
                    formData.append('size', aspectRatio === '16:9' ? '16x9' : '9x16'); 
                    const blob = await (await fetch(`data:image/png;base64,${imageBytes}`)).blob();
                    formData.append('input_reference', blob, 'image.png');
                    const createResp = await fetch(`${vivaBaseUrl}/v1/videos`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${getActiveApiKey()}` },
                        body: formData,
                        signal: signal
                    });
                    if (!createResp.ok) {
                        const errText = await createResp.text();
                        if (createResp.status === 500 && errText.includes('get_channel_failed')) {
                            throw new Error("RETRYABLE_LOAD_ERROR");
                        }
                        throw new Error(`Video API Error ${createResp.status}: ${errText}`);
                    }
                    const createData = await createResp.json();
                    const taskId = createData.id;
                    if (!taskId) throw new Error("No Task ID returned");
                    let videoUrl = null;
                    let checkAttempts = 0;
                    while (!videoUrl && checkAttempts < 120) {
                        if (signal?.aborted) throw new Error("Aborted");
                        await new Promise(r => setTimeout(r, 5000)); 
                        checkAttempts++;
                        const checkResp = await fetch(`${vivaBaseUrl}/v1/videos/${taskId}`, { headers: { 'Authorization': `Bearer ${getActiveApiKey()}` }, signal });
                        if (checkResp.ok) {
                            const checkData = await checkResp.json();
                            if (checkData.status === 'completed' && checkData.video_url) videoUrl = checkData.video_url;
                            else if (checkData.status === 'failed') throw new Error("Video Generation Failed");
                        }
                    }
                    if (!videoUrl) throw new Error("Timeout");
                    return videoUrl;
                }
            } catch (error: any) {
                if (error.message === "RETRYABLE_LOAD_ERROR") {
                    attempts++;
                    console.warn(`Video API load saturated. Retrying (${attempts}/3)...`);
                    await new Promise(r => setTimeout(r, 10000));
                    continue;
                }
                throw error;
            }
        }
        throw new Error("Video generation failed after retries.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Map selected model to supported Google models
    let googleModel = 'veo-3.1-fast-generate-preview';
    if (model.includes('veo_3_1')) {
        googleModel = 'veo-3.1-generate-preview';
    } else if (model.includes('grok-video-3')) {
        // Grok models: HD first, then SD
        googleModel = model; 
    }

    let operation = await ai.models.generateVideos({
        model: googleModel as any,
        prompt: finalPrompt,
        image: { imageBytes: imageBytes, mimeType: 'image/png' },
        config: { 
            numberOfVideos: 1, 
            resolution: model.includes('grok-video-3') ? '1080p' : '720p', 
            aspectRatio: aspectRatio 
        }
    });
    
    // Fallback logic for Grok
    if (model.includes('grok-video-3')) {
        try {
            while (!operation.done) {
                if (signal?.aborted) throw new Error("Aborted");
                await new Promise(r => setTimeout(r, 5000));
                operation = await ai.operations.getVideosOperation({ operation });
            }
        } catch (error) {
            console.warn("HD generation failed, trying SD...", error);
            // Retry with SD if HD fails
            operation = await ai.models.generateVideos({
                model: googleModel as any,
                prompt: finalPrompt,
                image: { imageBytes: imageBytes, mimeType: 'image/png' },
                config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio }
            });
        }
    }
    while (!operation.done) {
        if (signal?.aborted) throw new Error("Aborted");
        await new Promise(r => setTimeout(r, 5000));
        operation = await ai.operations.getVideosOperation({ operation });
    }
    const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
    const res = await fetch(`${uri}${uri?.includes('?') ? '&' : '?'}key=${process.env.GEMINI_API_KEY}`, { signal });
    return URL.createObjectURL(await res.blob());
};