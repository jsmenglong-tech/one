import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey,
    Boolean, JSON
)
from sqlalchemy.orm import relationship
from database import Base


def new_uuid():
    return str(uuid.uuid4())


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(Text, nullable=False)
    parent_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    children = relationship("Chapter", backref="parent", remote_side=[id])
    knowledge_points = relationship("KnowledgePoint", back_populates="chapter")


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"

    id = Column(Text, primary_key=True, default=new_uuid)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    title = Column(Text)
    content = Column(Text, nullable=False)
    tags = Column(JSON, default=list)
    difficulty = Column(Integer, default=3)
    source = Column(Text)
    content_hash = Column(Text, unique=True)
    item_type = Column(Text, default='knowledge')  # 'knowledge' | 'example'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    chapter = relationship("Chapter", back_populates="knowledge_points")
    question_maps = relationship("QuestionKnowledgeMap", back_populates="knowledge")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Text, primary_key=True, default=new_uuid)
    type = Column(Text)
    question = Column(Text, nullable=False)
    options = Column(JSON)
    answer = Column(Text, nullable=False)
    analysis = Column(Text)
    quality_checked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    knowledge_maps = relationship("QuestionKnowledgeMap", back_populates="question")


class QuestionKnowledgeMap(Base):
    __tablename__ = "question_knowledge_map"

    question_id = Column(Text, ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True)
    knowledge_id = Column(Text, ForeignKey("knowledge_points.id", ondelete="CASCADE"), primary_key=True)

    question = relationship("Question", back_populates="knowledge_maps")
    knowledge = relationship("KnowledgePoint", back_populates="question_maps")


class UserAccount(Base):
    """学习端账号表"""
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(Text, unique=True, nullable=False)
    hashed_password = Column(Text, nullable=False)
    role = Column(Text, default="study")  # 'study' | 'admin'
    created_at = Column(DateTime, default=datetime.utcnow)


class WrongRecord(Base):
    __tablename__ = "wrong_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Text, ForeignKey("questions.id", ondelete="CASCADE"))
    wrong_count = Column(Integer, default=1)
    last_wrong_at = Column(DateTime, default=datetime.utcnow)

    question = relationship("Question", foreign_keys=[question_id])
