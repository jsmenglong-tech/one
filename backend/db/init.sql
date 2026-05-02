-- 一级建造师知识库系统数据库初始化

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 章节表
CREATE TABLE IF NOT EXISTS chapters (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    parent_id INT REFERENCES chapters(id),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 知识点核心表
CREATE TABLE IF NOT EXISTS knowledge_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id INT REFERENCES chapters(id),
    title TEXT,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    difficulty INT DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    source TEXT,
    content_hash TEXT UNIQUE,  -- 用于去重
    item_type TEXT DEFAULT 'knowledge' CHECK (item_type IN ('knowledge', 'example')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 迁移：为已存在的表补加 item_type 字段（幂等）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='knowledge_points' AND column_name='item_type'
    ) THEN
        ALTER TABLE knowledge_points
            ADD COLUMN item_type TEXT DEFAULT 'knowledge'
            CHECK (item_type IN ('knowledge', 'example'));
    END IF;
END$$;

-- 题库表
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT CHECK (type IN ('single', 'multiple', 'case')),
    question TEXT NOT NULL,
    options JSONB,
    answer TEXT NOT NULL,
    analysis TEXT,
    quality_checked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 关联表
CREATE TABLE IF NOT EXISTS question_knowledge_map (
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    knowledge_id UUID REFERENCES knowledge_points(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, knowledge_id)
);

-- 错题记录表（学习端使用）
CREATE TABLE IF NOT EXISTS wrong_records (
    id SERIAL PRIMARY KEY,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    wrong_count INT DEFAULT 1,
    last_wrong_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_knowledge_updated
    BEFORE UPDATE ON knowledge_points
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 预置顶级章节（一建实务常见章节）
INSERT INTO chapters (title, parent_id, sort_order) VALUES
    ('建设工程项目管理', NULL, 1),
    ('建设工程质量管理', NULL, 2),
    ('建设工程安全管理', NULL, 3),
    ('建设工程进度管理', NULL, 4),
    ('建设工程成本管理', NULL, 5),
    ('建设工程合同管理', NULL, 6),
    ('建设工程法规', NULL, 7)
ON CONFLICT DO NOTHING;
