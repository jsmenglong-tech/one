# 部署教程

## 一、首次部署（只需做一次）

### 1. 本地准备：初始化 Git 仓库并推送到 GitHub

> 前提：先在 GitHub.com 新建一个**私有仓库**（free 账号可建私有仓库）

```bash
# 在项目根目录 d:\AI\one 执行
cd d:\AI\one

git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

---

### 2. 服务器准备：安装 Docker

SSH 登录服务器后执行：

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker（官方一键脚本）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

---

### 3. 服务器：克隆代码

```bash
# 创建目录
sudo mkdir -p /opt/jzs
sudo chown $USER:$USER /opt/jzs

# 克隆仓库（GitHub 私有仓库需要 token 或 SSH key）
git clone https://github.com/你的用户名/你的仓库名.git /opt/jzs
cd /opt/jzs
```

**配置 GitHub Token（私有仓库）：**
在 GitHub → Settings → Developer Settings → Personal Access Tokens → Generate new token，
勾选 `repo` 权限，生成后复制。

克隆时输入用户名和这个 token 作为密码，或者配置：
```bash
git config credential.helper store
# 第一次 git pull 时输入用户名+token，之后自动记住
```

---

### 4. 服务器：配置环境变量

```bash
cd /opt/jzs
cp .env.prod .env.prod.bak   # 备份模板

# 编辑配置文件（填写你的真实 API 密钥）
nano .env.prod
```

**生成 JWT 密钥（重要！）：**
```bash
openssl rand -hex 32
# 复制输出，填入 .env.prod 的 JWT_SECRET=
```

---

### 5. 服务器：首次启动

```bash
cd /opt/jzs
chmod +x deploy.sh

# 首次构建并启动（大约需要 5-10 分钟，取决于网速）
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 查看状态
docker compose -f docker-compose.prod.yml ps
```

启动成功后，访问 `http://你的服务器IP` 即可。

---

### 6. 导入知识库数据

首次部署后数据库是空的，需要从本地导入：

1. 本地管理端：**导出知识库** → 下载 `knowledge-pack.zip`
2. 服务器管理端（`http://服务器IP/admin`）：**导入知识库** → 上传 zip

---

## 二、日常更新代码（每次改完代码后）

### 本地操作

```bash
cd d:\AI\one
git add .
git commit -m "描述你改了什么"
git push
```

### 服务器更新（两种方式任选）

**方式 A：SSH 进服务器执行**
```bash
ssh root@你的服务器IP
cd /opt/jzs
./deploy.sh
```

**方式 B：本地一条命令搞定（推荐）**
```bash
ssh root@你的服务器IP "cd /opt/jzs && ./deploy.sh"
```

更新时间约 2-3 分钟，期间服务短暂不可访问。

---

## 三、常用运维命令

```bash
# 查看所有服务状态
docker compose -f docker-compose.prod.yml ps

# 查看实时日志
docker compose -f docker-compose.prod.yml logs -f

# 只看后端日志
docker compose -f docker-compose.prod.yml logs -f backend

# 重启某个服务
docker compose -f docker-compose.prod.yml restart backend

# 停止所有服务
docker compose -f docker-compose.prod.yml down

# 查看磁盘占用
docker system df
```

---

## 四、访问地址

| 端口 | 地址 | 说明 |
|------|------|------|
| 80 | `http://服务器IP` | 首页 |
| 80 | `http://服务器IP/study` | 学习端（需登录） |
| 80 | `http://服务器IP/admin` | 管理后台（需登录） |
| 80 | `http://服务器IP/api/docs` | 后端接口文档 |

---

## 五、默认账号

| 端 | 账号 | 密码 |
|----|------|------|
| 管理端 | cumtmenglong | 3220663 |
| 学习端 | jsmenglong | 3220663 |

> 首次登录后建议修改密码（管理端 → 账号管理）

---

## 六、数据备份

数据存在 Docker volume `jzs_backend_data` 中，备份命令：

```bash
# 备份数据库
docker run --rm -v jzs_backend_data:/data -v /opt/backup:/backup alpine \
  tar czf /backup/jzs-backup-$(date +%Y%m%d).tar.gz -C /data .

# 查看备份
ls -lh /opt/backup/
```
