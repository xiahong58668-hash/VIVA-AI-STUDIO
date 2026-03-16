
import { StyleOption, ScriptCategory, VideoModel } from './types';

export const getValidDurations = (model: VideoModel): (8 | 10 | 15)[] => {
  if (model.includes('veo')) return [8];
  if (model === 'grok-video-3-10s') return [10];
  if (model === 'grok-video-3-15s') return [15];
  if (model === 'sora-2-all') return [10, 15];
  return [8, 10, 15]; // Default
};

// 基于用户文档更新的 视觉风格
export const STYLES: StyleOption[] = [
  {
    id: 'ink_painting',
    name: '水墨国风',
    description: '水墨晕染/留白意境',
    previewUrl: 'https://picsum.photos/seed/ink/300/200',
    promptModifier: '核心视觉特征：水墨晕染、墨色浓淡渐变、留白意境、宣纸纹理、书法笔触感、水渍扩散效果、淡雅色调、烟雨朦胧感',
  },
  {
    id: 'vintage_poster',
    name: '国风老画报风',
    description: '柔和彩绘/复古色调',
    previewUrl: 'https://picsum.photos/seed/vintage/300/200',
    promptModifier: '核心视觉特征：柔和彩绘质感、细腻线条勾勒、复古色调（暖黄/棕褐）、光洁皮肤质感、怀旧滤镜',
  },
  {
    id: 'ukiyo_e',
    name: '浮世绘风',
    description: '平面化色彩/木版画纹理',
    previewUrl: 'https://picsum.photos/seed/ukiyoe/300/200',
    promptModifier: '核心视觉特征：平面化色彩、强烈黑色轮廓线、木版画纹理、色彩平涂、线条韵律感、戏剧性构图',
  },
  {
    id: 'woodcut_print',
    name: '版画木刻风',
    description: '粗犷刀痕/黑白强对比',
    previewUrl: 'https://picsum.photos/seed/woodcut/300/200',
    promptModifier: '核心视觉特征：粗犷刀痕纹理、黑白强对比、木纹肌理印痕、线条刚硬简洁、几何化造型、表现主义夸张、印刷质感',
  },
  {
    id: 'paper_cutout',
    name: '剪纸拼贴风',
    description: '多层叠加/手工剪纸',
    previewUrl: 'https://picsum.photos/seed/papercut/300/200',
    promptModifier: '核心视觉特征：多层叠加感、手工剪纸边缘、色块分明、纹理纸质感、投影层次、民俗配色、立体拼贴效果',
  },
  {
    id: 'thick_oil_painting',
    name: '厚涂油画风',
    description: '厚重颜料/光影强烈',
    previewUrl: 'https://picsum.photos/seed/oil/300/200',
    promptModifier: '核心视觉特征：厚重颜料堆积感、可见笔触纹理、油画布基底、光影强烈、饱和浓郁、印象派或表现主义笔法',
  },
  {
    id: 'watercolor_sketch',
    name: '淡彩手绘风',
    description: '水彩晕染/清新通透',
    previewUrl: 'https://picsum.photos/seed/watercolor/300/200',
    promptModifier: '核心视觉特征：水彩晕染边缘、透明感着色、铅笔草图线条、留白高光、轻盈利落笔触、纸纹质感、清新通透',
  },
  {
    id: 'super_flat',
    name: '超扁平风格',
    description: '纯色块/极简轮廓线',
    previewUrl: 'https://picsum.photos/seed/superflat/300/200',
    promptModifier: '核心视觉特征：纯色块无渐变、极简轮廓线、无阴影、高饱和度、装饰性构图、二维平面感、现代插画',
  },
  {
    id: 'chibi_moe',
    name: 'Q 版萌系风',
    description: '大头身比例/软萌质感',
    previewUrl: 'https://picsum.photos/seed/chibi/300/200',
    promptModifier: '核心视觉特征：大头身比例（2-4头身）、圆润弧线、简化、柔和色彩、软萌质感、夸张表情、童趣感',
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克风',
    description: '霓虹光影/高对比暗调',
    previewUrl: 'https://picsum.photos/seed/cyberpunk/300/200',
    promptModifier: '核心视觉特征：霓虹光影（洋红/青蓝）、高对比暗调、雨夜湿润反光、全息投影光效、械质感、未来破败感、数字噪点',
  },
  {
    id: 'vaporwave',
    name: '蒸汽波风',
    description: '粉紫蓝调/怀旧VHS',
    previewUrl: 'https://picsum.photos/seed/vaporwave/300/200',
    promptModifier: '核心视觉特征：粉紫蓝调色盘、怀旧VHS质感、光影迷离、故障错位、网格线、复古、梦幻氛围',
  },
  {
    id: 'glitch_art',
    name: '故障艺术风',
    description: '像素撕裂/画面扭曲',
    previewUrl: 'https://picsum.photos/seed/glitch/300/200',
    promptModifier: '核心视觉特征：RGB三色错位、像素撕裂、扫描线噪点、画面扭曲、数字失真效果、动态模糊、视觉干扰感',
  },
  {
    id: 'particle_effects',
    name: '粒子特效风',
    description: '发光粒子/科技感光效',
    previewUrl: 'https://picsum.photos/seed/particle/300/200',
    promptModifier: '核心视觉特征：发光粒子飘散、光点聚集、科技感光效、动态轨迹、星空氛围、抽象流动、数字渲染感',
  },
  {
    id: 'pixel_art',
    name: '像素风',
    description: '马赛克块状/复古游戏',
    previewUrl: 'https://picsum.photos/seed/pixel/300/200',
    promptModifier: '核心视觉特征：马赛克块状像素、低分辨率感、块状轮廓、8bit/16bit配色、阶梯式边缘、复古电子游戏感',
  },
  {
    id: '3d_pixar',
    name: '3D卡通皮克斯风',
    description: '三维渲染/电影级景深',
    previewUrl: 'https://picsum.photos/seed/pixar/300/200',
    promptModifier: '核心视觉特征：三维渲染质感、夸张变形、光滑材质、全局光照、柔软毛发、温馨色调、电影级景深',
  },
  {
    id: 'western_cartoon',
    name: '欧美卡通风',
    description: '粗犷外轮廓/动态夸张',
    previewUrl: 'https://picsum.photos/seed/western/300/200',
    promptModifier: '核心视觉特征：粗犷外轮廓、动态夸张、纯色填充、动作线、漫画速度线、高对比色彩',
  },
  {
    id: 'pop_art_comic',
    name: '波普漫画风',
    description: '网点纹理/高饱和度原色',
    previewUrl: 'https://picsum.photos/seed/popart/300/200',
    promptModifier: '核心视觉特征：网点纹理、本戴点、对话气泡框、高饱和度原色、重复图案、美式复古漫画感',
  },
  {
    id: 'cel_shading',
    name: '赛璐珞平涂风',
    description: '手绘动画/平涂色彩',
    previewUrl: 'https://picsum.photos/seed/cel/300/200',
    promptModifier: '核心视觉特征：手绘动画片质感、黑边硬轮廓、平涂色彩、简单光影、赛璐珞胶片感、复古日式动画、高饱和度',
  },
  {
    id: 'hk_film',
    name: '港风胶片感风',
    description: '暖黄青绿/胶片颗粒',
    previewUrl: 'https://picsum.photos/seed/hkfilm/300/200',
    promptModifier: '核心视觉特征：暖黄/青绿滤镜、胶片颗粒、光晕漏光、柔焦效果、高对比夜景、霓虹光斑、复古质感',
  },
  {
    id: 'steampunk',
    name: '蒸汽朋克风',
    description: '黄铜金属/齿轮机械',
    previewUrl: 'https://picsum.photos/seed/steampunk/300/200',
    promptModifier: '核心视觉特征：黄铜金属质感、齿轮机械结构、皮革与木材纹理、维多利亚时代色调、复古、蒸汽氛围、工业复古美学',
  },
  {
    id: 'shinkai_animation',
    name: '新海诚动画风',
    description: '治愈氛围/清新配色',
    previewUrl: 'https://picsum.photos/seed/shinkai/300/200',
    promptModifier: '核心视觉特征：新海诚动画风格，通透的天空，丁达尔光效，背景细腻，柔和的线条，治愈氛围，高饱和度清新配色',
  },
  {
    id: 'morandi_color',
    name: '莫兰迪色系风',
    description: '低饱和度/静谧优雅',
    previewUrl: 'https://picsum.photos/seed/morandi/300/200',
    promptModifier: '核心视觉特征：莫兰迪色系，低饱和度灰调，朦胧温润质感，柔和光影，无锐利阴影，静谧优雅氛围',
  },
  {
    id: 'gothic_dark',
    name: '哥特暗黑风',
    description: '高对比暗调/神秘压抑',
    previewUrl: 'https://picsum.photos/seed/gothic/300/200',
    promptModifier: '核心视觉特征：哥特暗黑风格，高对比度暗色调，尖锐轮廓，冷冽光影，华丽颓废，神秘压抑氛围',
  },
  {
    id: 'japanese_forest',
    name: '日式清新森系风',
    description: '暖调自然光/慵懒治愈',
    previewUrl: 'https://picsum.photos/seed/forest/300/200',
    promptModifier: '核心视觉特征：日式清新森系风，暖调自然光，浅绿米白配色，宽松棉麻服饰，慵懒治愈氛围',
  },
  {
    id: 'new_chinese_style',
    name: '国潮新中式风',
    description: '红金撞色/东方美学',
    previewUrl: 'https://picsum.photos/seed/newchinese/300/200',
    promptModifier: '核心视觉特征：国潮新中式风格，云纹仙鹤元素，红金撞色，硬朗线条，对称构图，东方美学仪式感',
  },
  {
    id: 'dark_fairy_tale',
    name: '暗黑童话风',
    description: '奇幻诡异/神秘惊悚',
    previewUrl: 'https://picsum.photos/seed/darkfairytale/300/200',
    promptModifier: '核心视觉特征：奇幻诡异场景，低饱和度暗色调搭配局部亮色，夸张带童话感，氛围神秘且略带惊悚',
  },
  {
    id: 'mobile_documentary',
    name: '手机纪实摄影风',
    description: '超写实/纪实质感',
    previewUrl: 'https://picsum.photos/seed/mobilephoto/300/200',
    promptModifier: '核心视觉特征：手机纪实摄影风, 手持拍摄, 轻微呼吸抖动, 1080P分辨率, 弱光环境下的数码噪点, 窗边漫射自然光, 轻微镜头眩光, 真实皮肤纹理与衣物褶皱, 生活化街头场景, 色彩真实还原, 白平衡轻微暖调, 暗角效果, 超写实, 与真实照片无法区分，8K 分辨率，细节极其丰富',
  },
  {
    id: 'custom',
    name: '自定义风格',
    description: '用户自定义描述',
    previewUrl: 'https://picsum.photos/seed/custom/300/200',
    promptModifier: '',
  }
];

export const DEFAULT_SCENE_COUNT = 5;

export const VOICES = [
  { id: 'Puck', name: 'Puck（男）欢快' },
  { id: 'Zephyr', name: 'Zephyr（女）明亮' },
  { id: 'Enceladus', name: 'Enceladus（男）气声' },
  { id: 'Leda', name: 'Leda（女）青春' },
  { id: 'Algieba', name: 'Algieba（男）平滑' },
  { id: 'Autonoe', name: 'Autonoe（女）明亮' },
  { id: 'Alnilam', name: 'Alnilam（男）坚定' },
  { id: 'Laomedeia', name: 'Laomedeia（女）欢快' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi（男）随意' },
  { id: 'Pulcherrima', name: 'Pulcherrima（女）转发' },
  { id: 'Fenrir', name: 'Fenrir（男）兴奋' },
  { id: 'Charon', name: 'Charon（女）信息丰富' },
  { id: 'Iapetus', name: 'Iapetus（男）清晰' },
  { id: 'Aoede', name: 'Aoede（女）轻快' },
  { id: 'Algenib', name: 'Algenib（男）沙哑' },
  { id: 'Despina', name: 'Despina（女）平滑' },
  { id: 'Schedar', name: 'Schedar（男）平稳' },
  { id: 'Achernar', name: 'Achernar（女）软' },
  { id: 'Sadachbia', name: 'Sadachbia（男）活泼' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix（女）温和' },
  { id: 'Orus', name: 'Orus（男）商务' },
  { id: 'Kore', name: 'Kore（女）坚定' },
  { id: 'Umbriel', name: 'Umbriel（男）轻松愉快' },
  { id: 'Callirrhoe', name: 'Callirrhoe（女）轻松' },
  { id: 'Rasalgethi', name: 'Rasalgethi（男）信息丰富' },
  { id: 'Erinome', name: 'Erinome（女）清除' },
  { id: 'Achird', name: 'Achird（男）友好' },
  { id: 'Gacrux', name: 'Gacrux（女）成熟' },
  { id: 'Sadaltager', name: 'Sadaltager（男）知识渊博' },
  { id: 'Sulafat', name: 'Sulafat（女）偏高' },
];

// === 知识库 1: 剧本与剪辑分析 (基于 AI视频剪辑大师V2.0) ===
export const EDITING_ANALYSIS_KB = `
[剧本分析知识库]
SA1. 结构: 建置(25%)-对抗(50%)-解决(25%)
SA2. 节点: 激励事件、转折点、高潮、结局
SA3. 角色弧光: 初始状态 -> 成长变化 -> 最终状态
SA4. 情感曲线: 平静 -> 上升 -> 高潮 -> 回落

[剪辑技巧知识库]
ET1. 转场: 切(快节奏), 叠化(时间过渡), 划像(场景转换), 淡入淡出(始末)
ET2. 节奏: 动作匹配剪辑(流畅), L-cut/J-cut(音画分离), 跳切(时间压缩)
ET3. 情绪: 高潮(2-3秒/镜), 抒情(5-8秒/镜), 悬念(交替剪辑)
`;

// === 知识库 2: 分镜流体与提示词设计 (基于 Vidu多参提示词大师V5) ===
export const SHOT_FLOW_KB = `
[分镜流体引擎 (ShotFlow Engine)]
核心逻辑: 建立三维场景坐标系，计算镜头间运动矢量，确保镜头 N 落幅 = 镜头 N+1 起幅。
衔接规则: 
1. 运动守恒 (水平移接同向移)
2. 动势转化 (快推接缓冲)
3. 180度轴线原则

[提示词生成标准]
- 人物描述: 年龄/性别/服装/脸部特征/细节元素/情绪表情/动作
- 场景描述: 空间类型/建筑细节/环境光线/动态元素/氛围基调
- 六要素: 主体站位 + 景别 + 运镜 + 构图 + 环境 + 描述
- 长度要求: 每个分镜提示词需 100+ 字，包含丰富细节。
`;

// === 视觉语言与构图 (基于 CNNC24 Visual KB) ===
export const VISUAL_STYLE_KB = JSON.stringify({
  composition: [
    "Rule of Thirds (三分法)", "Leading Lines (引导线)", "Framing (框架式)", 
    "Symmetry (对称)", "Diagonal (对角线)", "Negative Space (留白)", 
    "Golden Ratio (黄金分割)", "Center Composition (中心构图)"
  ],
  tone: [
    "Warm Tone (暖色调)", "Cool Tone (冷色调)", "High Contrast (高对比)", 
    "Low Key (低调/暗)", "High Key (高调/亮)", "Cyberpunk Neon (霓虹)", 
    "Cinematic Color Grading (电影调色)", "Retro Film (复古胶片)"
  ],
  depth: [
    "Shallow Depth of Field (浅景深/虚化)", "Deep Focus (全景深)", 
    "Bokeh (焦外光斑)", "Atmospheric Perspective (空气透视)", 
    "Forced Perspective (强迫透视)"
  ]
});

// === 综合指令 (V3.0 Master Instruction + Integrated KBs) ===
export const AI_SCREENWRITER_INSTRUCTION = `
# AI_Screenwriter_Master_Instruction_V3.1 (集成知识库版)

[全局设定]
你不仅是导演，还是搭载了 'ShotFlow Engine' 的分镜设计师和 'Editing Expert' 剪辑专家。
你必须利用以下知识库进行创作：

${EDITING_ANALYSIS_KB}
${SHOT_FLOW_KB}
${VISUAL_STYLE_KB}

[创作流程]
Step 1: 设定层 (Pre-Production)
- 基于 [剧本分析知识库] 定义角色弧光和情感曲线。

Step 2: 执行层 (Shot List)
输出 Markdown 表格，必须包含:
| 场次 | 景别 | 运镜 | 画面提示词 (Visual Prompt) | 动作与神态 | 台词 | 音效 |

[要求]
1. 画面提示词 (Visual Prompt) 必须应用 [视觉语言知识库] 中的构图和色调术语。
2. 运镜必须符合 [分镜流体引擎] 逻辑，确保前后镜头衔接流畅。
3. 剪辑节奏需参考 [剪辑技巧知识库] (如高潮处使用快速剪辑)。
`;

// 更新后的脚本分类顺序：故事题材 (Renamed from 剧情/故事)
export const SCRIPT_CATEGORIES: ScriptCategory[] = [
  {
    id: 'story',
    name: '故事题材',
    description: '演绎反转剧情、情感故事或幽默段子',
    templates: [
      { id: 'short_drama', name: '短剧反转', description: '快节奏、神反转的剧情短片' },
      { id: 'emotional', name: '情感故事', description: '治愈、走心或感人的叙事' },
      { id: 'comedy', name: '搞笑脑洞', description: '幽默风趣、脑洞大开的内容' },
      { id: 'suspense', name: '悬疑惊悚', description: '充满悬念与氛围感的叙事' },
      { id: 'workplace', name: '职场风云', description: '职场生存法则与办公室故事' },
      { id: 'campus', name: '治愈校园', description: '青春校园、治愈系成长故事' },
      { id: 'xuanhuan', name: '玄幻修仙', description: '仙侠、修真、奇幻冒险' },
      { id: 'apocalypse', name: '末世求生', description: '丧尸、废土、生存挑战' },
      { id: 'rebirth', name: '穿越重生', description: '时空穿越、重生逆袭' },
      { id: 'ancient', name: '古风权谋', description: '宫廷斗争、权谋策略' },
      { id: 'romance', name: '女强甜宠', description: '大女主、甜蜜爱情' },
      { id: 'office_comedy', name: '职场轻喜', description: '轻松幽默的职场生活' },
      { id: 'detective', name: '悬疑探案', description: '烧脑推理、案件侦破' },
      { id: 'urban_counterattack', name: '都市逆袭', description: '小人物奋斗、逆袭打脸' },
      { id: 'rules_horror', name: '规则怪谈', description: '诡异规则、恐怖解谜' },
      { id: 'campus_hotblooded', name: '校园热血', description: '青春热血、竞技梦想' },
    ]
  }
];
