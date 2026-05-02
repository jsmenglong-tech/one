#!/bin/bash
set -e

echo "=============================="
echo " 一建知识库系统 - 一键更新"
echo "=============================="

# 拉取最新代码
echo "[1/3] 拉取最新代码..."
git pull origin main

# 重新构建镜像
echo "[2/3] 构建 Docker 镜像..."
docker compose -f docker-compose.prod.yml build --no-cache

# 重启服务（数据卷不受影响）
echo "[3/3] 重启服务..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "✅ 更新完成！服务已在后台运行。"
echo "   查看日志：docker compose -f docker-compose.prod.yml logs -f"
