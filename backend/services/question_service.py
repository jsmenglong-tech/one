"""出题引擎"""
import uuid
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import Question, KnowledgePoint, QuestionKnowledgeMap
from services.llm_service import chat_completion, extract_json

SINGLE_PROMPT = """你是一建实务出题专家。根据以下知识点生成1道单选题。

要求：
1. 选项有迷惑性，答案唯一，必须生成详细解析
2. 从不同角度出题，可以是：概念理解、数字记忆、条件判断、流程顺序、例外情况、对比辨析等
3. 避免平铺直叙，题干要有情境感

{existing_hint}

知识点：
{content}

返回JSON（不要有其他文字）：
{{"question":"题目","options":{{"A":"...","B":"...","C":"...","D":"..."}},"answer":"A","analysis":"解析..."}}
"""

MULTIPLE_PROMPT = """你是一建实务出题专家。根据以下知识点生成1道多选题（正确答案2-4个）。

要求：
1. 选项有迷惑性，说明每个正确选项原因
2. 从不同角度出题：多条件并列、排除法、综合应用等
3. 干扰项要合理，不能一眼看出错误

{existing_hint}

知识点：
{content}

返回JSON（不要有其他文字）：
{{"question":"题目","options":{{"A":"...","B":"...","C":"...","D":"...","E":"..."}},"answer":"ABD","analysis":"解析..."}}
"""

CASE_PROMPT = """你是一建实务出题专家。根据以下知识点生成1道案例分析题。

要求：
1. 设计真实施工场景，提2~3个分问，给出参考答案
2. 场景要具体（时间、地点、工程背景），问题要有层次
3. 避免与以往题目情境雷同

{existing_hint}

知识点：
{content}

返回JSON（不要有其他文字）：
{{"question":"背景+问题","options":null,"answer":"参考答案（分点）","analysis":"评分要点"}}
"""

QUALITY_CHECK_PROMPT = """检查题目质量：
{question_json}
检查：1.是否有明确答案 2.是否歧义 3.选项是否完整
返回JSON：{{"pass":true,"reason":"说明"}}
"""

PROMPTS = {"single": SINGLE_PROMPT, "multiple": MULTIPLE_PROMPT, "case": CASE_PROMPT}

# 出题角度轮换，增加多样性
ANGLES = [
    "请从【概念定义】角度出题",
    "请从【数字/限值记忆】角度出题，题干含具体数字",
    "请从【条件判断/适用范围】角度出题",
    "请从【流程顺序/步骤】角度出题",
    "请从【对比辨析/易混淆点】角度出题",
    "请从【例外情况/特殊规定】角度出题",
    "请从【案例应用/情景判断】角度出题",
]


async def _get_existing_questions_hint(db: AsyncSession, knowledge_ids: list[str], q_type: str) -> str:
    """查询该知识点已有题目，生成避免重复的提示"""
    result = await db.execute(
        select(QuestionKnowledgeMap.question_id)
        .where(QuestionKnowledgeMap.knowledge_id.in_(knowledge_ids))
    )
    qids = [r[0] for r in result.fetchall()]
    if not qids:
        return ""

    result2 = await db.execute(
        select(Question.question)
        .where(Question.id.in_(qids), Question.type == q_type)
        .limit(10)
    )
    existing = [r[0] for r in result2.fetchall()]
    if not existing:
        return ""

    lines = "\n".join(f"- {q}" for q in existing)
    return f"【已有题目，严禁重复或高度相似，必须换角度出题】\n{lines}\n"


async def generate_question(
    db: AsyncSession,
    knowledge_ids: list[str],
    q_type: str = "single",
) -> Question:
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.id.in_(knowledge_ids))
    )
    kps = result.scalars().all()
    if not kps:
        raise ValueError("未找到对应知识点")

    # 查询已有题目数量，选择出题角度
    result_count = await db.execute(
        select(func.count()).select_from(
            select(QuestionKnowledgeMap.question_id)
            .where(QuestionKnowledgeMap.knowledge_id.in_(knowledge_ids))
            .subquery()
        )
    )
    existing_count = result_count.scalar() or 0
    angle = ANGLES[existing_count % len(ANGLES)]

    existing_hint = await _get_existing_questions_hint(db, knowledge_ids, q_type)
    existing_hint = (existing_hint + "\n" + angle) if existing_hint else angle

    combined_content = "\n\n".join(f"【{kp.title}】\n{kp.content}" for kp in kps)
    prompt_template = PROMPTS.get(q_type, SINGLE_PROMPT)
    prompt = prompt_template.format(content=combined_content, existing_hint=existing_hint)

    raw = await chat_completion([
        {"role": "system", "content": "你是一建实务出题专家，只输出JSON，不重复已有题目。"},
        {"role": "user", "content": prompt},
    ], temperature=0.9)
    q_data = extract_json(raw)

    quality_raw = await chat_completion([
        {"role": "system", "content": "你是题目质量审查员，只输出JSON。"},
        {"role": "user", "content": QUALITY_CHECK_PROMPT.format(
            question_json=json.dumps(q_data, ensure_ascii=False)
        )},
    ], temperature=0.1)
    quality = extract_json(quality_raw)

    question = Question(
        id=str(uuid.uuid4()),
        type=q_type,
        question=q_data["question"],
        options=q_data.get("options"),
        answer=q_data["answer"],
        analysis=q_data.get("analysis", ""),
        quality_checked=quality.get("pass", False),
    )
    db.add(question)
    await db.flush()

    for kid in knowledge_ids:
        db.add(QuestionKnowledgeMap(question_id=question.id, knowledge_id=kid))

    await db.commit()
    return question


async def list_questions(
    db: AsyncSession,
    q_type: str | None = None,
    page: int = 1,
    size: int = 20,
) -> dict:
    query = select(Question)
    if q_type:
        query = query.where(Question.type == q_type)
    query = query.order_by(Question.created_at.desc())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    items = (await db.execute(query.offset((page - 1) * size).limit(size))).scalars().all()
    return {"total": total, "page": page, "size": size, "items": items}
