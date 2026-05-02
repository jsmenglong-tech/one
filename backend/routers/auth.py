"""认证 API"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from database import get_db
from models import UserAccount
from config import get_settings

router = APIRouter(prefix="/auth", tags=["认证"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(data: dict) -> str:
    s = get_settings()
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(days=s.jwt_expire_days)
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


# ── 初始化默认学习端账号 ────────────────────────────────
async def ensure_default_study_account(db: AsyncSession):
    """确保默认学习端账号 jsmenglong 存在"""
    result = await db.execute(
        select(UserAccount).where(UserAccount.username == "jsmenglong")
    )
    if result.scalar_one_or_none() is None:
        db.add(UserAccount(
            username="jsmenglong",
            hashed_password=hash_password("3220663"),
            role="study",
        ))
        await db.commit()


# ── 请求/响应模型 ────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str
    role: str  # "admin" | "study"


class TokenResponse(BaseModel):
    token: str
    role: str
    username: str


# ── 登录接口 ──────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    await ensure_default_study_account(db)
    s = get_settings()

    if body.role == "admin":
        # 管理员：和 .env 里的账号比对
        get_settings.cache_clear()
        s = get_settings()
        if body.username != s.admin_username or body.password != s.admin_password:
            raise HTTPException(status_code=401, detail="账号或密码错误")
        token = create_token({"sub": body.username, "role": "admin"})
        return TokenResponse(token=token, role="admin", username=body.username)

    elif body.role == "study":
        # 学习端：查数据库
        result = await db.execute(
            select(UserAccount).where(
                UserAccount.username == body.username,
                UserAccount.role == "study",
            )
        )
        user = result.scalar_one_or_none()
        if user is None or not verify_password(body.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="账号或密码错误")
        token = create_token({"sub": user.username, "role": "study"})
        return TokenResponse(token=token, role="study", username=user.username)

    else:
        raise HTTPException(status_code=400, detail="无效的角色")


# ── 账号管理接口（仅管理员使用）────────────────────────────

class CreateStudyUser(BaseModel):
    username: str
    password: str


class ChangeAdminPassword(BaseModel):
    old_password: str
    new_password: str


@router.get("/study-users")
async def list_study_users(db: AsyncSession = Depends(get_db)):
    """获取所有学习端账号列表"""
    result = await db.execute(
        select(UserAccount).where(UserAccount.role == "study").order_by(UserAccount.created_at)
    )
    users = result.scalars().all()
    return {"users": [{"id": u.id, "username": u.username, "created_at": u.created_at.isoformat()} for u in users]}


@router.post("/study-users")
async def create_study_user(body: CreateStudyUser, db: AsyncSession = Depends(get_db)):
    """新增学习端账号"""
    result = await db.execute(select(UserAccount).where(UserAccount.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = UserAccount(
        username=body.username,
        hashed_password=hash_password(body.password),
        role="study",
    )
    db.add(user)
    await db.commit()
    return {"status": "ok", "message": f"账号 {body.username} 已创建"}


@router.delete("/study-users/{user_id}")
async def delete_study_user(user_id: int, db: AsyncSession = Depends(get_db)):
    """删除学习端账号"""
    result = await db.execute(select(UserAccount).where(UserAccount.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="账号不存在")
    await db.delete(user)
    await db.commit()
    return {"status": "ok", "message": "账号已删除"}


@router.post("/change-admin-password")
async def change_admin_password(body: ChangeAdminPassword):
    """修改管理员密码（写入 .env）"""
    import os, re
    get_settings.cache_clear()
    s = get_settings()
    if body.old_password != s.admin_password:
        raise HTTPException(status_code=401, detail="旧密码错误")
    # 写入 .env
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    line = f'ADMIN_PASSWORD={body.new_password}\n'
    if os.path.exists(env_file):
        content = open(env_file, encoding="utf-8").read()
        pattern = re.compile(r'^ADMIN_PASSWORD=.*$', re.MULTILINE)
        if pattern.search(content):
            content = pattern.sub(line.rstrip(), content)
        else:
            content += line
        open(env_file, 'w', encoding="utf-8").write(content)
    else:
        open(env_file, 'w', encoding="utf-8").write(line)
    get_settings.cache_clear()
    return {"status": "ok", "message": "管理员密码已更新"}
