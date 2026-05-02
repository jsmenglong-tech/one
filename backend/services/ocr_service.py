"""OCR服务 - 支持 GPT-4o-mini 视觉识别、百度OCR 和 easyocr 本地识别"""
import io
import base64
import asyncio
import httpx
from config import get_settings


# ── 视觉模型配置辅助 ────────────────────────────────────────────────────────

def _get_vision_client():
    """获取视觉模型 OpenAI 客户端"""
    from openai import AsyncOpenAI
    settings = get_settings()
    if not settings.vision_api_key:
        raise RuntimeError("未配置视觉模型 API Key，请在系统配置 → 图片AI识别中填写")
    return AsyncOpenAI(
        api_key=settings.vision_api_key,
        base_url=settings.vision_base_url,
    )


async def _vision_chat(client, model: str, messages: list, temperature: float, max_tokens: int) -> str:
    """
    兼容强制流式返回的代理服务器：始终使用 stream=True，
    手动拼接所有 chunk 的 delta.content，返回完整字符串。
    """
    full_content = []
    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            full_content.append(chunk.choices[0].delta.content)
    return "".join(full_content)


def _image_mime(image_bytes: bytes) -> str:
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif image_bytes[:4] == b'GIF8':
        return "image/gif"
    elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        return "image/webp"
    return "image/jpeg"


# ── GPT-4o-mini 视觉识别（直接识别图片并拆分知识点）──────────────────────────

VISION_SPLIT_PROMPT = """你是一建实务知识点提取专家。请仔细识别图片中的所有文字内容，然后将其拆分为多个最小条目。

严格遵守以下规则：
1. 每个条目必须可独立出题
2. 长度控制在100~300字
3. 不允许包含多个主题
4. 必须生成标题 + 内容
5. 判断每个条目的类型：
   - item_type = "knowledge"：纯概念、定义、规范、数据、流程、原则等知识性内容
   - item_type = "example"：含有题干+选项+答案/解析结构的例题、真题、案例题
6. 【过滤规则】以下内容属于无关广告，必须完全忽略：
   - 培训机构宣传语、推销/联系方式、课程推广、QQ号/微信号等

返回JSON数组，格式如下（不要有任何其他文字）：
[
  {
    "title": "知识点标题",
    "content": "知识点内容...",
    "tags": ["高频", "计算类"],
    "difficulty": 3,
    "item_type": "knowledge"
  }
]

difficulty取值：1=很易, 2=易, 3=中, 4=难, 5=很难
tags可选：高频、低频、计算类、理解类、记忆类、案例常考"""


VISION_CARD_PROMPT = """你是一建实务学习资料整理专家。请仔细识别并理解图片中的全部内容（包括文字、表格、流程图、思维导图等），然后将其转化为一份完整的结构化知识总结。

要求：
1. 完整提取图片中所有信息，不遗漏任何要点
2. 使用标准 Markdown 格式：## 标题、- 列表、| 表格
3. 保留原图的层次结构和逻辑关系
4. 生成一个简洁的标题（不超过20字）
5. 推断知识点标签（从：高频、低频、计算类、理解类、记忆类、案例常考 中选）
6. 评估难度（1=很易, 2=易, 3=中, 4=难, 5=很难）

返回 JSON（不要有任何其他文字）：
{
  "title": "图片内容的简洁标题",
  "content": "完整的 Markdown 格式内容...",
  "tags": ["高频", "记忆类"],
  "difficulty": 3
}"""


async def extract_and_split_by_vision(image_bytes: bytes) -> list[dict]:
    """使用 GPT-4o-mini 视觉模型直接识别图片并拆分为知识点列表"""
    import json
    import re
    settings = get_settings()
    client = _get_vision_client()
    mime = _image_mime(image_bytes)
    b64 = base64.b64encode(image_bytes).decode()

    try:
        content = await _vision_chat(
            client, settings.vision_model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"}},
                    {"type": "text", "text": VISION_SPLIT_PROMPT},
                ],
            }],
            temperature=0.2,
            max_tokens=4096,
        )
    except Exception as e:
        raise RuntimeError(f"视觉API调用异常: {type(e).__name__}: {e}")

    content = re.sub(r"```(?:json)?\s*", "", content).replace("```", "").strip()
    try:
        result = json.loads(content)
        if isinstance(result, str):
            result = json.loads(result)
        return result
    except json.JSONDecodeError:
        match = re.search(r'(\[.*\])', content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise RuntimeError(f"视觉识别返回格式无法解析: {content[:300]}")


async def describe_image_for_card(image_bytes: bytes) -> dict:
    """使用 GPT-4o-mini 将图片总结为结构化知识卡（不拆分，保持整体）"""
    import json
    import re
    settings = get_settings()
    client = _get_vision_client()
    mime = _image_mime(image_bytes)
    b64 = base64.b64encode(image_bytes).decode()

    try:
        content = await _vision_chat(
            client, settings.vision_model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"}},
                    {"type": "text", "text": VISION_CARD_PROMPT},
                ],
            }],
            temperature=0.3,
            max_tokens=2048,
        )
    except Exception as e:
        raise RuntimeError(f"视觉API调用异常: {type(e).__name__}: {e}")

    content = re.sub(r"```(?:json)?\s*", "", content).replace("```", "").strip()
    try:
        result = json.loads(content)
        if isinstance(result, str):
            result = json.loads(result)
        return result
    except json.JSONDecodeError:
        match = re.search(r'(\{.*\})', content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise RuntimeError(f"图片总结卡返回格式无法解析: {content[:300]}")


async def extract_text_from_image(image_bytes: bytes) -> str:
    settings = get_settings()
    if settings.ocr_engine == "baidu" and settings.baidu_ocr_api_key and settings.baidu_ocr_secret_key:
        return await _baidu_ocr(image_bytes, settings.baidu_ocr_api_key, settings.baidu_ocr_secret_key)
    else:
        return await _easyocr(image_bytes)


# ── 百度 OCR ──────────────────────────────────────────────────────────────────

async def _baidu_ocr(image_bytes: bytes, api_key: str, secret_key: str) -> str:
    """调用百度通用文字识别（高精度版）"""
    async with httpx.AsyncClient(timeout=30) as client:
        # 1. 获取 access_token
        token_url = "https://aip.baidubce.com/oauth/2.0/token"
        token_resp = await client.post(token_url, params={
            "grant_type": "client_credentials",
            "client_id": api_key,
            "client_secret": secret_key,
        })
        token_resp.raise_for_status()
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise RuntimeError(f"百度OCR获取token失败: {token_resp.text}")

        # 2. 调用识别接口
        ocr_url = "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic"
        image_b64 = base64.b64encode(image_bytes).decode()
        ocr_resp = await client.post(
            ocr_url,
            params={"access_token": access_token},
            data={"image": image_b64},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        ocr_resp.raise_for_status()
        result = ocr_resp.json()

        if "error_code" in result:
            raise RuntimeError(f"百度OCR错误 {result['error_code']}: {result.get('error_msg')}")

        words = [item["words"] for item in result.get("words_result", [])]
        text = "\n".join(words)
        if not text.strip():
            raise RuntimeError("百度OCR未识别到文字，请确认图片清晰且包含文字")
        return text


# ── easyocr 本地识别（降级方案）──────────────────────────────────────────────

async def _easyocr(image_bytes: bytes) -> str:
    """使用 easyocr 本地识别，超时120秒"""
    try:
        loop = asyncio.get_event_loop()
        text = await asyncio.wait_for(
            loop.run_in_executor(None, _run_easyocr, image_bytes),
            timeout=120,
        )
        if not text.strip():
            raise RuntimeError("OCR未识别到文字，请确认图片清晰且包含文字")
        return text
    except asyncio.TimeoutError:
        raise RuntimeError("OCR超时（首次使用需下载中文模型约500MB，请稍后重试）")
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"OCR识别失败: {str(e)}")


def _run_easyocr(image_bytes: bytes) -> str:
    import easyocr
    import numpy as np
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_array = np.array(image)

    if not hasattr(_run_easyocr, '_reader'):
        _run_easyocr._reader = easyocr.Reader(['ch_sim', 'en'], gpu=False, verbose=False)

    reader = _run_easyocr._reader
    result = reader.readtext(img_array, detail=0, paragraph=True)
    return "\n".join(result)
