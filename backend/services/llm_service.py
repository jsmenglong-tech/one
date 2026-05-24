"""LLM调用服务 - 统一封装OpenAI兼容接口"""
import json
import re
import numpy as np
from openai import AsyncOpenAI
from config import get_settings

settings = get_settings()


def get_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.llm_api_key or "sk-placeholder",
        base_url=settings.llm_base_url,
    )


async def chat_completion(messages: list[dict], temperature: float = 0.3) -> str:
    client = get_client()
    resp = await client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        temperature=temperature,
    )
    return resp.choices[0].message.content.strip()


async def get_embedding(text: str) -> list[float]:
    """
    调用硅基流动 Embedding API（BAAI/bge-large-zh-v1.5，维度 1024）。
    若未配置 embedding_api_key，则降级为 hash 向量（不可语义搜索）。
    """
    api_key = settings.embedding_api_key or settings.llm_api_key
    if not api_key:
        # 降级：hash 伪随机向量
        import hashlib, struct
        text = text[:2000]
        seed = hashlib.md5(text.encode()).digest()
        rng = [int.from_bytes(seed[i:i+4], 'little') for i in range(0, 16, 4)]
        vec = []
        for s in rng:
            for _ in range(256):
                s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
                vec.append(struct.unpack('f', struct.pack('I', s))[0])
        arr = np.array(vec[:1024], dtype=np.float32)
        norm = np.linalg.norm(arr)
        return (arr / norm if norm > 0 else arr).tolist()

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=settings.embedding_base_url,
    )
    resp = await client.embeddings.create(
        model=settings.llm_embedding_model,
        input=text[:2000],
    )
    return resp.data[0].embedding


# 广告关键词正则：匹配讲义中常见的推销/联系方式文字
_AD_PATTERNS = re.compile(
    r'(名师面授|精华|央企内训|考点串讲|习题模考|考前三页纸|绝密押题'
    r'|押题|内训|面授|串讲|模考'
    r'|联系\s*(?:QQ|微信|qq|wechat)'
    r'|QQ[/／\\|]微信'
    r'|微信[/／\\|]QQ'
    r'|唯一.*?微信'
    r'|扫码|二维码'
    r'|[\d]{5,})'  # 5位以上纯数字（QQ号/微信号）
    r'.*',
    re.IGNORECASE,
)

# 逐行过滤：整行只要命中广告关键词即丢弃
_AD_LINE_PATTERN = re.compile(
    r'(?:'
    r'名师面授|精华课|央企内训|考点串讲|习题模考|考前三页纸|绝密押题'
    r'|押题联系|内训课|面授课|串讲课'
    r'|联系\s*(?:QQ|微信|qq)'
    r'|QQ[/／\\|]微信|微信[/／\\|]QQ'
    r'|唯一.*?联系|唯一.*?微信'
    r'|扫码.*?获取|扫码.*?领取'
    r'|二建.*?课程|监理.*?课程|一建.*?课程|一造.*?课程|二造.*?课程'
    r'|安全.*?课程|消防.*?课程|咨询.*?课程|检测.*?课程'
    r')',
    re.IGNORECASE,
)


def filter_ads(text: str) -> str:
    """
    清洗原始OCR/粘贴文本，逐行过滤广告推销内容。
    命中任一广告特征的行直接丢弃。
    """
    lines = text.splitlines()
    clean = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            clean.append(line)
            continue
        if _AD_LINE_PATTERN.search(stripped):
            continue  # 广告行，丢弃
        clean.append(line)
    return '\n'.join(clean)


def extract_json(text: str) -> any:
    """从LLM输出中提取JSON，兼容markdown代码块和多余包装"""
    # 去除 markdown 代码块
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = text.replace("```", "").strip()
    # 尝试直接解析
    try:
        result = json.loads(text)
        # 如果结果是字符串（被双重序列化），再解析一次
        if isinstance(result, str):
            result = json.loads(result)
        return result
    except json.JSONDecodeError:
        # 尝试提取第一个 [ ... ] 或 { ... } 块
        match = re.search(r'(\[.*\]|\{.*\})', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise


SPLIT_PROMPT = """你是一建实务知识点提取专家。

将以下章节内容拆分为多个最小条目，严格遵守规则：
1. 每个条目必须可独立出题
2. 长度控制在100~300字
3. 不允许包含多个主题
4. 必须生成标题 + 内容
5. 判断每个条目的类型：
   - item_type = "knowledge"：纯概念、定义、规范、数据、流程、原则等知识性内容
   - item_type = "example"：含有题干+选项+答案/解析结构的例题、真题、案例题
6. 【过滤规则】以下内容属于无关广告，必须完全忽略，不得提取为任何条目：
   - 培训机构宣传语，如"名师面授精华""央企内训""考点串讲""考前三页纸""绝密押题"等
   - 推销/联系方式，如"联系QQ/微信：xxxxx""唯一联系微信 xxxxx"等
   - 课程推广，如"二建、监理、一建……课程押题联系……"等
   - 任何包含QQ号、微信号（5位以上数字）的推销句子

返回JSON数组，格式如下（不要有其他文字）：
[
  {{
    "title": "知识点标题",
    "content": "知识点内容...",
    "tags": ["高频", "计算类"],
    "difficulty": 3,
    "item_type": "knowledge"
  }},
  {{
    "title": "【例题】题目标题",
    "content": "题目内容及答案解析...",
    "tags": ["案例常考"],
    "difficulty": 4,
    "item_type": "example"
  }}
]

difficulty取值：1=很易, 2=易, 3=中, 4=难, 5=很难
tags可选：高频、低频、计算类、理解类、记忆类、案例常考

章节内容：
{content}
"""


async def split_to_knowledge_points(content: str) -> list[dict]:
    """将章节内容拆分为知识点列表"""
    prompt = SPLIT_PROMPT.format(content=content)
    result = await chat_completion([
        {"role": "system", "content": "你是一建实务知识结构化专家，只输出JSON。"},
        {"role": "user", "content": prompt},
    ], temperature=0.2)
    return extract_json(result)


CONSOLIDATE_PROMPT = """你是一建实务知识点整理专家。下面是从同一来源（一张图片）中识别并初步拆分出的多个知识点条目（JSON 数组形式）。

请将它们**归类、整合、提炼**，合并为一个完整的大知识点。要求：

1. 围绕整体主题，给一个简洁的大标题（不超过 30 字）
2. content 使用结构化 Markdown 格式：
   - 用 `## 二级标题` 区分小节，归类相关条目
   - 用列表 / 表格保留要点和数据
   - 保留所有关键信息（数据、规范、流程、判定标准等）
3. 综合所有原始条目，**不遗漏要点，但去除重复和冗余**
4. 标签从原始条目标签中合并去重；难度取原始条目的最大值
5. 若原始条目中含有例题（item_type=example），单独放在 `## 配套例题` 小节内（保留题干+答案）
6. content 总长度建议不超过 1800 字，便于语义检索

原始拆分条目：
{raw_points}

返回 JSON（不要有任何其他文字）：
{{
  "title": "大知识点标题",
  "content": "完整的 Markdown 内容...",
  "tags": ["高频", "记忆类"],
  "difficulty": 3
}}"""


async def consolidate_points(points: list[dict]) -> dict:
    """DeepSeek (LLM_API_KEY) 归纳整合多条知识点为一条大知识点"""
    if not points:
        raise RuntimeError("无可归纳的知识点")
    raw_points_json = json.dumps(points, ensure_ascii=False, indent=2)
    prompt = CONSOLIDATE_PROMPT.format(raw_points=raw_points_json)
    result = await chat_completion([
        {"role": "system", "content": "你是一建实务知识结构化专家，只输出JSON。"},
        {"role": "user", "content": prompt},
    ], temperature=0.3)
    return extract_json(result)
