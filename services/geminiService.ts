

import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { Scene, AssetItem, ChatMessage, ScriptOption, VideoModel } from "../types";
import { AI_SCREENWRITER_INSTRUCTION, SHOT_FLOW_KB, VISUAL_STYLE_KB, EDITING_ANALYSIS_KB } from "../constants";
import { proxyConfig as agentConfig } from '../src/proxyConfig';

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

export const extractAssetsFromScript = async (script: string): Promise<{ characters: {name: string, description: string}[], scenes: {name: string, description: string}[], props: {name: string, description: string}[] }> => {
  return retryOperation(async () => {
    const prompt = `Analyze the script and extract specific character names, core location names, and key props.
    
    CRITICAL RULES for Characters:
    - ONLY extract characters that appear VISUALLY in the scenes.
    - EXTRACT THE EXACT NAME used in the script. Do not add descriptive prefixes or suffixes to the name (e.g., if the script says "男子", extract "男子", NOT "相亲男子").
    - DO NOT extract "声音" (voice), "旁白" (narrator), or any non-visual audio elements as characters.
    - For each character, carefully analyze the script context to infer their GENDER, age, and personality.
    - Pay close attention to relationship terms (e.g., "闺蜜" usually implies the protagonist is female, "兄弟" might imply male).
    - If the name is "我" or "主角", look for dialogue or descriptions that reveal their identity.
    - Provide a detailed Visual Description (Simplified Chinese) including gender, approximate age, clothing style, and key facial expressions.
    - If a character is just a voice (e.g., "母亲的声音"), DO NOT extract it as a character.

    CRITICAL RULES for Locations (Scenes):
    - Use ONLY static, physical concepts for location names.
    - AVOID dynamic, psychological, or emotional compound concepts.
    - AVOID redundant extraction: If a location is a sub-element or part of another location (e.g., a "closet", "window", "bedside table", "door", or "floor" in a "bedroom"), DO NOT extract it as a separate core location if the parent location ("bedroom") is already extracted. Instead, include these details in the parent location's description.
    - Example: Change "Confession in a Dark Apartment" (阴暗公寓的告解) to "Dark Apartment" (阴暗公寓).
    - Example: Change "Tense Office Meeting" (紧张的办公室会议) to "Office" (办公室).
    - If a location is a sub-element or part of another location, explicitly mention the parent location in its description to ensure visual consistency.
    - **EXTREMELY IMPORTANT**: Do not extract furniture or architectural details (like "床头柜", "地板", "门") as separate scenes. They should be part of the main room scene.

    CRITICAL RULES for Props (道具):
    - ONLY extract important, distinct physical objects that characters interact with or that are central to the plot.
    - DO NOT extract generic background objects (like "墙", "地板") as props.
    - Ensure the names of the props are unified and exactly as they appear in the script.
    - Provide a brief Visual Description (Simplified Chinese) including color, material, size, or any specific details mentioned.

    For each, provide a brief Visual Description based on the script content itself.
    
    Return JSON with structure:
    { 
      "characters": [ { "name": "Name", "description": "Detailed visual details including gender, age, outfit in Simplified Chinese..." } ], 
      "scenes": [ { "name": "Location Name", "description": "Environment details in Simplified Chinese..." } ],
      "props": [ { "name": "Prop Name", "description": "Visual details of the prop in Simplified Chinese..." } ]
    }
    Use Simplified Chinese for BOTH Names AND Descriptions.
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

    const sanitize = (list: any[]) => (Array.isArray(list) ? list : [])
        .map(item => {
            const name = item.name || (typeof item === 'string' ? item : "Unknown");
            const description = item.description || "";
            return { name, description };
        })
        .filter(item => {
            const n = item.name.toLowerCase();
            return n !== '旁白' && !n.includes('声音') && !n.includes('旁白') && !n.includes('音效') && !n.includes('配音') && !n.includes('音');
        });

    return { 
        characters: sanitize(result.characters || []), 
        scenes: sanitize(result.scenes || []),
        props: sanitize(result.props || [])
    };
  });
};

export const generateTopicIdeas = async (categoryName: string, templateName: string, templateDescription: string, styleName: string, model: string = 'gemini-3.1-flash-lite-preview'): Promise<string[]> => {
    return retryOperation(async () => {
        const prompt = `
角色：AI 故事汇创意策划师
任务：根据用户选择的故事题材，生成 10 个差异化的创意点子，用于内容创作

输入：
用户选择的题材：【${templateName}】
题材描述：${templateDescription}

输出格式（严格遵守）：
主题：（一句话核心亮点，≤20 字，可用于短视频标题）
简介：（60 字以内，讲清主角、核心设定、冲突、看点）
标签：采用“1 个题材标签 + 2-3 个情绪标签 + 1 个抖音通用大流量标签”，例如 #题材 #情绪1 #情绪2 #抖音热门

## 创作要求：
1. 严格贴合【${templateName}】的风格调性，比如沙雕脑洞要搞笑、修仙爽文要突出升级打脸、规则怪谈要突出诡异规则。
2. **逻辑严密性（硬性要求）**：创意点子必须符合基本逻辑，严禁出现过于幼稚、荒诞或毫无逻辑的设定（例如：“为了避开相亲，女子决定原地进化成仙人掌”等此类不合常理的幼稚想法）。
3. **内容深度**：创意应具有一定的叙事深度和情感共鸣，避免流于表面或低幼化。即使是搞笑题材，也应建立在合理的冲突和反转之上。
4. 10 个创意方向必须差异化（比如不同主角身份、不同核心冲突、不同结局走向）。
5. **地道表达（核心要求）**：语言要极度接地气，符合中国人的阅读和听觉习惯。使用生活化的大白话，避免任何翻译腔、书面语或“AI味”十足的排比句。要像真人在讲故事一样自然。
6. 简介不要太啰嗦，重点突出“钩子”，让用户一眼就想继续看下去。
7. 严禁在创意想法中使用第一人称（如“我”、“我们”），必须使用第三人称（如“他”、“她”、“男子”、“女孩”等）进行客观叙述。
8. 避免使用“总之”、“综上所述”、“不仅如此”等典型的 AI 常用连接词。用自然的叙事逻辑连接句子。

严格输出一个 JSON 数组（不要包含任何其他 markdown 标记或解释说明），格式如下：
[
  {
    "title": "主题内容",
    "intro": "简介内容",
    "tags": "#标签1 #标签2 #标签3"
  }
]
`;
        
        let jsonStr = "";
        if (getActiveApiKey()) {
            jsonStr = await callVivaTextAI(prompt, "AI 故事汇创意策划师", true, undefined, model);
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
                return topics.map((t: any) => `【${templateName}】主题：${t.title} 简介：${t.intro} 标签：${t.tags}`);
            }
            return [];
        } catch (e) {
            console.error("Failed to parse topic ideas", e);
            return [];
        }
    });
};

export const generateMissingScenePrompt = async (
    script: string,
    existingScenes: { script: string; visualPrompt: string }[],
    stylePrompt: string,
    model: string = 'gemini-3.1-flash-lite-preview'
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `
# 任务指令
分析以下剧本和现有的分镜画面提示词，找出故事中缺失的一个关键转折点或叙事空白，并生成一个详细的画面提示词来补充这个缺失的场景。

# 剧本正文
${script}

# 现有分镜画面提示词
${existingScenes.map((s, i) => `分镜 ${i + 1}: 剧本: ${s.script}, 画面: ${s.visualPrompt}`).join('\n')}

# 视觉风格要求
${stylePrompt}

# 输出要求
仅输出该缺失场景的详细画面提示词，不需要任何解释。提示词必须包含：时间、地点、光影、画面主体、场景、色彩、构图、视觉风格、视觉风格核心特征、镜头类型。并且这些描述必须与前后分镜连贯、不冲突。
`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
    });
    return response.text?.trim() || "";
};

export const polishScript = async (
    script: string,
    model: string = 'gemini-3.1-flash-lite-preview'
): Promise<string> => {
    return retryOperation(async () => {
        const prompt = `
# 任务指令
你是一位专业的动态漫剧本优化专家。请根据以下《动态漫剧本 AI 优化通用设定描述》对提供的剧本进行深度优化。

# 优化指南
1. **整体结构优化**：梳理逻辑，明确“基础信息-分镜-配音-时长”结构。
2. **分镜优化**：补充视觉细节（镜头角度、色调、光影、画面质感），确保衔接流畅，时长精准，强化画面感染力。特别注意分镜头之间的视觉逻辑连贯性（如角色手中的物品、衣着状态等在前后分镜中应保持一致，不凭空消失）。分镜画面内容必须包含明确的**时间**、**地点**和**光影**描述，并且这些描述在整个剧本中必须连贯、不冲突。
3. **音画同步（硬性要求）**：分镜画面内容必须与对应的配音内容高度一致。分镜描述的必须是配音中正在发生的事情、角色的动作或配音所描述的场景，绝不能出现“配音在讲A，分镜在画B”的割裂感。
4. **配音文案去AI化（核心要求）**：文案必须极度口语化、生活化。想象这是一个真人在你耳边讲故事，而不是机器在朗读。去掉所有修饰过度的形容词、翻译腔和死板的句式。每段配音文案（不含括号内的控制词）不要超过30个字。
5. **文案细节优化**：强化情节紧凑性，统一文案风格，补充必要动作/环境细节。
6. **适配性优化**：确保描述不复杂、不抽象，直接可用于制作。
7. **符合中国人习惯**：用词、语气、梗都要符合中国本土语境，少用生僻词，多用大白话。

# 优化禁忌
1. 不偏离原剧本的故事题材、创意主题、核心情节和视觉风格。
2. 不出现冗余、晦涩表述。
3. 不破坏原剧本的情绪基调。
4. 不出现时长分配混乱。

# 待优化剧本
${script}

# 输出要求
输出优化后的完整剧本，保持清晰的结构。
`;
        if (getActiveApiKey()) {
            return await callVivaTextAI(prompt, "You are a professional dynamic comic script optimization expert.", false, undefined, model);
        } else {
            const ai = getDefaultClient();
            const response = await ai.models.generateContent({
                model: model as any,
                contents: prompt,
            });
            return response.text?.trim() || "";
        }
    });
};

export const optimizeScript = async (
    script: string,
    model: string = 'gemini-3.1-flash-lite-preview'
): Promise<string> => {
    return retryOperation(async () => {
        const prompt = `
请帮我优化这篇短剧剧本，要求：
1. **仅优化“分镜”和“配音”部分**。保持原有的“故事题材”、“视觉风格”、“剧本名称”、“剧本集数”、“单集时长”、“画面比例”等元数据完全不变。
2. **命名一致性（硬性要求）**：
   - 检查并修正全剧所有角色的名称，确保每个角色只使用**唯一固定名称**，全程统一。
   - 严禁对同一角色使用不同的称呼（例如：一会儿是“外卖小哥”，一会儿是“外卖小哥王强”，一会儿是“他”，一会儿是“王强”）。必须全程使用最初定义的唯一名称。
   - 场景名称也必须保持高度一致。
   - 道具名称也必须保持高度一致。
3. 修补所有逻辑漏洞，让分镜衔接自然，角色行为合理、动机清晰、不突兀。**逻辑严密性（硬性要求）**：故事逻辑必须严密，情节发展应符合常理，严禁出现过于幼稚、荒诞或毫无逻辑的设定。
4. **画面连贯性（硬性要求）**：分镜画面内容必须包含明确的**时间**、**地点**和**光影**描述，并且这些描述在整个剧本中必须连贯、不冲突。例如，如果前一个镜头是“深夜的街道”，下一个紧接着的镜头不能突然变成“阳光明媚的室内”，除非有明确的时间跨度说明。这对于保证生成的画面风格统一至关重要。
5. **音画同步（硬性要求）**：分镜画面内容必须与对应的配音内容高度一致。分镜描述的必须是配音中正在发生的事情、角色的动作或配音所描述的场景，绝不能出现“配音在讲A，分镜在画B”的割裂感。
6. 强化故事题材氛围，节奏紧凑。
7. **配音格式要求**：必须严格按照“配音：（音色 + 情绪 + 语速 + 风格）第三人称讲解的剧本内容”这种格式书写。**务必完整保留剧本中的（语气标注 / 语气提示 / 节奏提示），严禁删除括号内的任何内容。**
8. **配音文案去AI化（核心要求）**：配音文案必须极度口语化、大白话，更有画面感、情绪递进自然。严禁使用翻译腔、书面语、或过于华丽的辞藻。要像真人在聊天讲故事一样，不重复、不啰嗦。且每段配音文案（不含括号内的控制词）不要超过30个字。**如果原剧本中有明确的语气标注（如：(惊讶地)、(低声地)等），必须在优化后的配音中予以保留或根据语境合理强化。**
9. **符合中国人习惯**：情节设计和对白要符合中国人的思维逻辑和生活常识。去掉那些一眼就能看出是 AI 生成的陈词滥调。

待优化剧本：
${script}

只输出优化后的完整剧本，不要额外解释。
`;
        if (getActiveApiKey()) {
            return await callVivaTextAI(prompt, "Script Optimizer", false, undefined, model);
        } else {
            const executeCall = async (currentModel: string) => {
                const ai = getDefaultClient();
                const response = await ai.models.generateContent({
                    model: currentModel as any,
                    contents: prompt,
                });
                return response.text?.trim() || "";
            };

            try {
                return await executeCall(model);
            } catch (e) {
                console.warn(`Default text model ${model} failed for optimization, trying fallback...`, e);
                const otherModels = ['gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-3-pro-preview'].filter(m => m !== model);
                for (const fallbackModel of otherModels) {
                    try {
                        return await executeCall(fallbackModel);
                    } catch (err) {
                        console.warn(`Fallback ${fallbackModel} failed.`);
                    }
                }
                throw e;
            }
        }
    });
};

export const generateAllEpisodes = async (topic: string, stylePrompt: string, styleName: string, templateName: string, templateDescription: string, duration: string, episodeCount: number, sceneCount: number, aspectRatio: string, model: string = 'gemini-3.1-flash-lite-preview'): Promise<{ episodes: { title: string; content: string }[] }> => {
    return retryOperation(async () => {
        const prompt = `
# 任务指令
请根据以下核心参数，生成 ${episodeCount} 集连贯的故事/剧本。
内容紧扣创意主题，语言适配演讲节奏。
剧本正文必须完全以“讲故事人（旁白）”的第三人称客观视角进行故事的叙述。
请确保各集之间情节连贯，故事发展有逻辑。

# 核心要求（非常重要）
1. **命名一致性（硬性要求）**：
   - 全剧所有角色必须使用**唯一固定名称**，全程统一，绝不更改。
   - 严禁对同一角色使用不同的称呼（例如：一会儿是“外卖小哥”，一会儿是“外卖小哥王强”，一会儿是“他”，一会儿是“王强”）。必须全程使用最初定义的唯一名称。
   - 场景名称也必须保持高度一致。例如：如果场景是“卧室”，则不能称呼为“卧房”。
   - 道具名称也必须保持高度一致。
   - 这些名称将直接作为绘图提示词，任何微小的名称差异都会导致 AI 生成的形象不统一。
2. **逻辑严密性（硬性要求）**：故事逻辑必须严密，情节发展应符合常理，严禁出现过于幼稚、荒诞或毫无逻辑的设定。
3. **画面连贯性（硬性要求）**：分镜画面内容必须包含明确的**时间**、**地点**和**光影**描述，并且这些描述在整个剧本中必须连贯、不冲突。例如，如果前一个镜头是“深夜的街道”，下一个紧接着的镜头不能突然变成“阳光明媚的室内”，除非有明确的时间跨度说明。这对于保证生成的画面风格统一至关重要。
4. **音画同步（硬性要求）**：分镜画面内容必须与对应的配音内容高度一致。分镜描述的必须是配音中正在发生的事情、角色的动作或配音所描述的场景，绝不能出现“配音在讲A，分镜在画B”的割裂感。
5. **故事分布**：请将整个故事合理地分布在 ${episodeCount} 集中。严禁在第 1 集就讲完整个故事。每一集都应该是故事的一个阶段，确保剧情的连贯性和悬念。
6. **题材契合度**：严格遵循题材描述中的核心要求和风格导向。
7. **去AI化与大白话（核心要求）**：剧本内容必须符合中国人的阅读习惯，语言表达要极度口语化、大白话。去掉所有“AI味”十足的翻译腔、书面语和死板的排比句。要像真人在讲故事一样自然、生动。不要用那些华而不实的形容词，用最直白的语言讲出最有冲击力的故事。
8. **拒绝陈词滥调**：不要使用 AI 常见的开头（如“在某个遥远的角落...”）或结尾（如“这告诉我们一个深刻的道理...”）。直接切入主题，用情节说话。

# 核心参数
1. 故事题材：${templateName}
2. 题材描述：${templateDescription}
3. 视觉风格：${styleName}
4. 创意主题：${topic || '自动构思'}
5. 单集时长：${duration}
6. 总集数：${episodeCount}
7. 画面比例：${aspectRatio}

# 生成要求
1. **画面提示词生成策略（必须严格执行）**：
   - **固定模板（所有分镜通用）**：必须包含角色（陆远）、场景（废弃工厂）、视觉风格（3D卡通皮克斯风）、光影（昏暗冷光）、墙面质感（粗糙墙面）等核心描述，且在所有分镜中保持一字不差。
   - **逻辑递进（镜头推进）**：必须遵循镜头推进逻辑（如：全景 -> 中景 -> 特写），确保平板电脑作为视觉锚点，在所有分镜中保持一致。
   - **状态继承**：必须在提示词中明确描述上一分镜的状态（如：平板电脑在怀里 -> 平板电脑亮起 -> 平板屏幕特写）。
   - **提示词格式**：[固定模板] + 镜头类型 + 构图 + 动作描述 + 视觉锚点状态。
2. 分镜：每集必须生成 ${sceneCount} 个分镜，以适配 ${duration} 的时长。确保镜头切换频繁（平均每 2-3 秒一个镜头），避免单张画面停留过久，增强动态漫的视觉观感。
3. 节奏：每集的最后个镜头及配音留悬念
4. 配音：口语化，情绪饱满，台词对应动作帧，方便剪辑，无冗余语句，贴合短视频传播。**务必严格按照“配音：（音色 + 情绪 + 语速 + 风格）第三人称讲解的剧本内容”这种格式书写。** 务必精简配音内容，确保每段配音能在 2-3 秒内读完，以匹配高频率的镜头切换。且每段配音文案（不含括号内的控制词）不要超过30个字。

# 输出要求
请严格按照以下 JSON 格式输出，不要包含任何其他 markdown 标记或解释说明：
{
  "episodes": [
    {
      "title": "第1集标题",
      "content": "故事题材：[题材]\\n视觉风格：${styleName}（核心视觉特征）\\n剧本名称：[名称]\\n剧本集数：第 1 集\\n单集时长：${duration}\\n画面比例：${aspectRatio}\\n--- 分镜&配音：\\n分镜 1：[时间] + [地点] + [光影] + 镜头与视角 + 构图 + 色彩 + 主体环境 + 质感 + 氛围 + 核心视觉特征\\n配音：（音色 + 情绪 + 语速 + 风格）第三人称讲解的剧本内容\\n分镜 2：[时间] + [地点] + [光影] + 镜头与视角 + 构图 + 色彩 + 主体环境 + 质感 + 氛围 + 核心视觉特征\\n配音：（音色 + 情绪 + 语速 + 风格）第三人称讲解的剧本内容\\n..."
    },
    ...
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
                config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } }
            });
            jsonStr = response.text || "{}";
        }

        try {
            const result = JSON.parse(cleanJson(jsonStr));
            return result;
        } catch (e) {
            console.error("Failed to parse multi-episode script", e);
            throw new Error("Failed to generate multi-episode script");
        }
    });
};

export const generateScriptByScenes = async (topic: string, stylePrompt: string, styleName: string, templateName: string, templateDescription: string, duration: string, episodeCount: number, currentEpisode: number, sceneCount: number, aspectRatio: string, model: string = 'gemini-3.1-flash-lite-preview'): Promise<{ title: string; outline: string; content: string }> => {
    return retryOperation(async () => {
        const prompt = `
# 任务指令
请根据以下核心参数，生成一篇适配“关键镜头分镜图+专家级配音”的完整故事/剧本。
内容紧扣创意主题，语言适配演讲节奏。
剧本正文必须完全以“讲故事人（旁白）”的第三人称客观视角进行故事的叙述。

# 核心要求（非常重要）
1. **命名一致性（硬性要求）**：
   - 全剧所有角色必须使用**唯一固定名称**，全程统一，绝不更改。
   - 严禁对同一角色使用不同的称呼（例如：一会儿是“外卖小哥”，一会儿是“外卖小哥王强”，一会儿是“他”，一会儿是“王强”）。必须全程使用最初定义的唯一名称。
   - 场景名称也必须保持高度一致。例如：如果场景是“卧室”，则不能称呼为“卧房”。
   - 道具名称也必须保持高度一致。
   - 这些名称将直接作为绘图提示词，任何微小的名称差异都会导致 AI 生成的形象不统一。
2. **逻辑严密性（硬性要求）**：故事逻辑必须严密，情节发展应符合常理，严禁出现过于幼稚、荒诞或毫无逻辑的设定。
3. **画面连贯性（硬性要求）**：分镜画面内容必须包含明确的**时间**、**地点**和**光影**描述，并且这些描述在整个剧本中必须连贯、不冲突。例如，如果前一个镜头是“深夜的街道”，下一个紧接着的镜头不能突然变成“阳光明媚的室内”，除非有明确的时间跨度说明。这对于保证生成的画面风格统一至关重要。
4. **音画同步（硬性要求）**：分镜画面内容必须与对应的配音内容高度一致。分镜描述的必须是配音中正在发生的事情、角色的动作或配音所描述的场景，绝不能出现“配音在讲A，分镜在画B”的割裂感。
5. **题材契合度**：严格遵循题材描述中的核心要求和风格导向。
6. **去AI化与大白话（核心要求）**：剧本内容必须符合中国人的阅读习惯，语言表达要极度口语化、大白话。去掉所有“AI味”十足的翻译腔、书面语和死板的排比句。要像真人在讲故事一样自然、生动。不要用那些华而不实的形容词，用最直白的语言讲出最有冲击力的故事。
7. **拒绝陈词滥调**：不要使用 AI 常见的开头（如“在某个遥远的角落...”）或结尾（如“这告诉我们一个深刻的道理...”）。直接切入主题，用情节说话。

# 核心参数
1. 故事题材：${templateName}
2. 题材描述：${templateDescription}
3. 视觉风格：${styleName}
4. 创意主题：${topic || '自动构思'}
5. 单集时长：${duration}
6. 当前生成集数：第 ${currentEpisode} 集
7. 画面比例：${aspectRatio}

# 生成要求
1. 分镜：本集必须生成 ${sceneCount} 个分镜，以适配 ${duration} 的时长。确保镜头切换频繁（平均每 2-3 秒一个镜头），避免单张画面停留过久，增强动态漫的视觉观感。
2. 节奏：每集的最后个镜头及配音留悬念
3. 配音：口语化，情绪饱满，台词对应动作帧，方便剪辑，无冗余语句，贴合短视频传播。**务必严格按照“配音：（音色 + 情绪 + 语速 + 风格）第三人称讲解的剧本内容”这种格式书写。** 务必精简配音内容，确保每段配音能在 2-3 秒内读完，以匹配高频率的镜头切换。且每段配音文案（不含括号内的控制词）不要超过30个字。

# 输出格式要求
请严格按照以下格式输出：

故事题材：[填入题材]
视觉风格：${styleName}（核心视觉特征）
剧本名称：[填入名称]
剧本集数：第 ${currentEpisode} 集
单集时长：${duration}
画面比例：${aspectRatio}
--- 分镜&配音：
分镜 1：[时间] + [地点] + [光影] + 镜头与视角 + 构图 + 色彩 + 主体环境 + 质感 + 氛围 + 核心视觉特征
配音：（音色 + 情绪 + 语速 + 风格）第三人称讲解的剧本内容
分镜 2：[时间] + [地点] + [光影] + 镜头与视角 + 构图 + 色彩 + 主体环境 + 质感 + 氛围 + 核心视觉特征
配音：（音色 + 情绪 + 语速 + 风格）第三人称讲解的剧本内容
...
`;
        let textStr = "";
        if (getActiveApiKey()) {
            textStr = await callVivaTextAI(prompt, "Professional Director", false, undefined, model);
        } else {
            const ai = getDefaultClient();
            const response = await ai.models.generateContent({
                model: model as any,
                contents: prompt,
                config: { thinkingConfig: { thinkingBudget: 2048 } }
            });
            textStr = response.text || "";
        }

        return {
            title: topic || templateName,
            outline: `${sceneCount} scenes about ${topic || templateName}`,
            content: textStr
        };
    });
};


export const generateScript = async (finalScriptText: string, styleModifier: string, characters?: string[], topic?: string): Promise<{ scenes: Scene[], narration: string }> => {
  return retryOperation(async () => {
    const charList = characters && characters.length > 0 ? `\n    Core Characters to use: ${characters.join(', ')}` : '';
    const topicInfo = topic ? `\n    Creative Idea (创意想法): ${topic}` : '';
    const prompt = `
    Task: Parse the provided storyboard script text into a structured JSON object.${charList}${topicInfo}
    Script Source:
    "${finalScriptText}"
    
    Instructions:
    - The script is formatted with sections like "分镜 1：..." and "配音：...".
    - Extract the scenes from the "分镜&配音" section. Each "分镜 X" is a scene.
    - 'visualPrompt' = The full description of the keyframe (镜头与视角, 构图, 光影, 色彩, 主体环境, 质感, 氛围, 核心视觉特征).
    - 'cameraPrompt' = Extract the "镜头与视角" (Camera type/angle) from the keyframe description.
    - 'script' = The keyframe description.
    - 'videoPrompt' = The keyframe description adapted for video generation.
    - 'audios' = Extract the corresponding voiceover line from the "配音：" section that matches this scene.
    - Each entry in 'audios' must have a 'name' and a 'prompt'.
    - 'prompt' MUST include the voice acting instructions (e.g., "(语气/节奏/重音等...)") and the actual dialogue. DO NOT strip out the parentheses or the instructions within them.
    - 'name' should be "旁白" (Narrator) if it's a general voiceover, or the character's name if it's a specific character speaking.
    - 'narration' = Combine all the "配音：" sections into one full narration text, keeping all the voice acting instructions (e.g., "(语气/节奏/重音等...)") exactly as they appear in the source script. EACH dialogue/voiceover line MUST be separated by a newline character (\\n) so it displays one dialogue per row.
    
    Return JSON Object:
    {
      "scenes": [
        { 
          "sceneNumber": number, 
          "script": "Chinese description...", 
          "visualPrompt": "Chinese visual prompt...", 
          "videoPrompt": "Chinese video prompt...",
          "cameraPrompt": "Camera action...",
          "audios": [
            { "name": "Character Name or 旁白", "prompt": "(语气标注) 剧本内容..." }
          ],
          "character": "Main character name",
          "globalParams": "..."
        }
      ],
      "narration": "(语气标注) 剧本内容 1...\\n(语气标注) 剧本内容 2..."
    }
    `;
    
    let scenes: any[] = [];
    let narration = "";

    if (getActiveApiKey()) {
        const text = await callVivaTextAI(prompt, "Script Parser", true);
        const parsedObj = JSON.parse(cleanJson(text));
        scenes = Array.isArray(parsedObj.scenes) ? parsedObj.scenes : (Array.isArray(parsedObj) ? parsedObj : []);
        narration = parsedObj.narration || "";
    } else {
        const ai = getDefaultClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: prompt,
          config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } }
        });
        const parsedObj = JSON.parse(cleanJson(response.text || "{}"));
        scenes = Array.isArray(parsedObj.scenes) ? parsedObj.scenes : (Array.isArray(parsedObj) ? parsedObj : []);
        narration = parsedObj.narration || "";
    }

    const processedScenes = scenes.map(p => {
        let audios = p.audios && Array.isArray(p.audios) ? p.audios.map((a: any, idx: number) => ({
            name: a.name || (idx === 0 ? (p.character || '角色 A') : '角色 B'),
            prompt: a.prompt || '',
            voice: a.name === '旁白' ? 'Schedar' : (idx === 0 ? 'Kore' : 'Puck')
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

    return { scenes: processedScenes, narration };
  });
};

export const generateAssetImage = async (
    name: string,
    type: 'character' | 'scene' | 'prop',
    styleModifier: string,
    aspectRatio: '9:16' | '16:9' = '16:9',
    description?: string, // Derived from script
    model: string = 'gemini-3.1-flash-image-preview',
    referenceImages?: Array<{ data: string; mimeType: string }>
): Promise<string> => {
    return retryOperation(async () => {
        let specificPrompt = "";
        const descText = description ? `Visual Details: ${description}` : "";
        const parts: any[] = [];

        if (type === 'character') {
            const identityHint = (name === '我' || name === '主角' || name === '女主' || name === '男主') 
                ? `CRITICAL: This is the PROTAGONIST. Carefully follow the gender and appearance details in the Visual Details.` 
                : "";
            
            specificPrompt = `
            Task: Create a Character Sheet (Three-View) of "${name}" on PURE WHITE BACKGROUND (#FFFFFF).
            Prompt: 角色三视图，人物站立，双手自然下垂，严格固定布局。
            Layout:
            - Left: Front view, standing. (左侧：角色正视图，正面站立)
            - Middle: Side view, standing. (中间：角色侧视图，侧面站立)
            - Right: Back view, standing. (右侧：角色背视图，背面站立)
            Horizontal alignment. Same character, same clothes, same hairstyle, same height, same scale.
            Unified design, consistent face, consistent colors.
            ${identityHint}
            STYLE: ${styleModifier}. Apply this style ONLY to the character's appearance, clothing, and textures.
            ${descText}
            CRITICAL: The background must be 100% pure white, no shadows, no floor, no environment. 
            NO TEXT, NO SUBTITLES, NO CAPTIONS, NO WATERMARKS, NO LETTERS on the image.
            Purpose: Storyboard setting. High Definition. Consistent details.
            `;
        } else if (type === 'scene') {
            // Match user's requested format: Location + Core visual features
            const cleanStyle = styleModifier.replace(/核心视觉特征[：:]\s*/g, '');
            specificPrompt = `
            Task: Environment Concept Art.
            Prompt: ${name}，${cleanStyle}。
            Analysis: 分析剧本，理解出场景应该展示物理空间范围，景别范围，时间与氛围范围，叙事焦点范围。
            ${descText}
            Pure Scenery. NO PEOPLE.
            ${referenceImages && referenceImages.length > 0 ? `CRITICAL: This is a specific element or area from the provided reference images. 
            - If the reference image is a larger scene (e.g., a "Bedroom") and you are generating a sub-element (e.g., a "Bedside table"), you MUST find that exact element within the reference image and replicate its appearance (style, color, material, design) perfectly.
            - Ensure the visual style, colors, and details are EXACTLY consistent with how "${name}" appears in the reference images.` : ""}
            `;
        } else if (type === 'prop') {
            const cleanStyle = styleModifier.replace(/核心视觉特征[：:]\s*/g, '');
            specificPrompt = `
            Task: Prop Concept Art.
            Prompt: ${name}，${cleanStyle}。
            ${descText}
            CRITICAL: The background must be 100% pure white, no shadows, no floor, no environment.
            NO TEXT, NO SUBTITLES, NO CAPTIONS, NO WATERMARKS, NO LETTERS on the image.
            Purpose: Storyboard setting. High Definition. Consistent details.
            `;
        }

        if (referenceImages) {
            referenceImages.forEach(img => {
                parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
            });
        }

        const prompt = `Design a ${type}. ${specificPrompt} Aspect Ratio: ${aspectRatio}.`;
        parts.push({ text: prompt });

        return await callVivaImageGen(parts, aspectRatio, model);
    });
};

export const generateSceneImage = async (
  visualPrompt: string,
  cameraPrompt: string,
  characters: AssetItem[],
  coreScenes: AssetItem[],
  aspectRatio: '9:16' | '16:9' = '16:9',
  sceneReferenceImages?: Array<{ data: string; mimeType: string } | undefined>,
  model: string = 'gemini-3.1-flash-image-preview',
  styleModifier: string = '',
  previousSceneContext?: string,
  narrationText?: string
): Promise<string> => {
    const parts: any[] = [];
    // Constructed prompt handling Chinese visualPrompt gracefully
    let promptInstructions = `Task: Create a SINGLE, unified cinematic frame. 
    Main Subject & Action: "${visualPrompt}". 
    Shot Type & Camera Angle: "${cameraPrompt}". 
    Aspect Ratio: ${aspectRatio}.
    Style & Aesthetic: ${styleModifier || 'Cinematic, high quality'}.
    ${narrationText ? `Voiceover/Narration Context: "${narrationText}"` : ''}
    
    CRITICAL RULES:
    - Generate ONLY ONE single image frame. 
    - DO NOT generate a grid, storyboard, multi-panel, or sequence of images.
    - NO split screens.
    - NO text, captions, or watermarks.
    - Focus on the STARTING state of the scene.
    - Use the provided reference images for character and location consistency.
    ${narrationText ? `- **Narrative Alignment**: Ensure the generated image perfectly illustrates the action, emotion, and subject matter described in the Voiceover/Narration Context. The visual MUST match the story being told.` : ''}
    - **Spatial Integration**: Ensure characters are naturally integrated into the environment. They should interact with the lighting, shadows, and physical elements of the scene.
    - **Perspective Consistency**: The perspective and vanishing points of the characters MUST match the perspective of the background scene perfectly.
    - **Realistic Proportions**: Maintain accurate real-world scale and proportions between characters and their surroundings. No distorted or impossible sizes.
    - **Camera Facing**: Strictly follow the camera angle instructions. If the prompt implies facing the camera, show the front. If it implies back to camera, show the back.
    - **Material & Object Continuity**: Pay strict attention to the materials and states of objects. If an object is described as metal, it MUST look like metal. If it is broken, show the broken state accurately.
    - **Collective Terms Mapping**: If the prompt uses collective terms like "一家三口" (family of three), "一家人" (family), or "三人" (three people), you MUST map these terms to the provided character reference images (e.g., "男子", "妻子", "女儿") to maintain visual consistency. Ensure all characters in the group match their respective reference images.`;

    if (previousSceneContext) {
        promptInstructions += `\n    - **Contextual Continuity**: The previous scene was: "${previousSceneContext}". Ensure logical visual continuity from the previous scene (e.g., maintain exact materials, clothing damage, object states, and relative positioning).`;
    }
    
    const addImagePart = (data: string, mimeType: string) => { parts.push({ inlineData: { mimeType: mimeType, data: data } }); };
    
    if (characters.length > 0) {
        promptInstructions += `\n\n[Character References]`;
        characters.forEach(c => { 
            let charDesc = `\n- Character [${c.name}]: ${c.description || 'No description provided.'}`;
            if (c.data && c.autoReference !== false) { 
                addImagePart(c.data, c.mimeType); 
                charDesc += ` (Use the provided reference image for exact appearance).`; 
            }
            promptInstructions += charDesc;
        });
    }

    if (coreScenes.length > 0) {
        promptInstructions += `\n\n[Location References]`;
        coreScenes.forEach(s => { 
            let sceneDesc = `\n- Location [${s.name}]: ${s.description || 'No description provided.'}`;
            if (s.data && s.autoReference !== false) { 
                addImagePart(s.data, s.mimeType); 
                sceneDesc += ` (Use the provided reference image for exact environment style).`; 
            }
            promptInstructions += sceneDesc;
        });
    }

    if (sceneReferenceImages) sceneReferenceImages.forEach(img => { if (img?.data) { addImagePart(img.data, img.mimeType); promptInstructions += ` [Ref Composition]`; } });
    parts.push({ text: promptInstructions });
    return retryOperation(async () => await callVivaImageGen(parts, aspectRatio, model));
};

export const editSceneImage = async (imageBytes: string, instruction: string, aspectRatio: '9:16' | '16:9'): Promise<string> => {
    return retryOperation(async () => {
        const parts = [ { inlineData: { mimeType: 'image/png', data: imageBytes } }, { text: `Edit: ${instruction}. Aspect: ${aspectRatio}` } ];
        return await callVivaImageGen(parts, aspectRatio);
    });
};

export const generateAudio = async (
    prompt: string,
    voiceConfig: { 
        voiceName?: string; 
        multiSpeakerVoiceConfig?: { speakerVoiceConfigs: { speaker: string; voiceName: string }[] };
        style?: string;
        tone?: string;
        accent?: string;
        rhythm?: string;
        speed?: string;
    },
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
        
        if (voiceConfig.style || voiceConfig.tone || voiceConfig.accent || voiceConfig.rhythm || voiceConfig.speed) {
            const controls = [
                voiceConfig.style && `风格：${voiceConfig.style}`,
                voiceConfig.tone && `语气：${voiceConfig.tone}`,
                voiceConfig.accent && `口音：${voiceConfig.accent}`,
                voiceConfig.rhythm && `节奏：${voiceConfig.rhythm}`,
                voiceConfig.speed && `语速：${voiceConfig.speed}`,
            ].filter(Boolean).join('，');
            finalPrompt = `[${controls}]\n${finalPrompt}`;
        }
        
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
    let finalPrompt = `The input image is a 3-panel storyboard. Please ignore the borders and treat the 3 panels as consecutive keyframes (start, middle, end) for the video. Generate a smooth, continuous video that follows this sequence. ${prompt}`;
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

                    const images = [`data:image/png;base64,${imageBytes}`];

                    const body = {
                        model: model,
                        prompt: finalPrompt + " --mode=custom",
                        aspect_ratio: grokAspectRatio,
                        size: model === 'grok-video-3-15s' ? "1080P" : "720P",
                        images: images
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

    const referenceImages: any[] = [];
    referenceImages.push({
        image: { imageBytes: imageBytes, mimeType: 'image/png' },
        referenceType: 'ASSET'
    });

    let operation = await ai.models.generateVideos({
        model: googleModel as any,
        prompt: finalPrompt,
        config: { 
            numberOfVideos: 1, 
            resolution: model.includes('grok-video-3') ? '1080p' : '720p', 
            aspectRatio: aspectRatio,
            referenceImages: referenceImages
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