# 智剪 AI 导演 (Smart Clip Director)

**智剪 AI 导演** 是一款基于 Google Gemini AI 的智能视频编排工具。它能够根据上传视频的文件名理解内容，自动构思叙事逻辑，并将零散的视频片段拼接成一个有故事感的完整长视频。

主要功能：
- **AI 智能编排**：利用 Gemini Pro/Flash 模型分析视频语义，生成叙事结构。
- **批量生成模式**：支持同时上传多首 BGM，一次性生成多个视频。系统会自动进行**智能去重**，确保不同视频间使用的素材尽量不重复。
- **专业级音频处理**：采用 Web Audio API 与双缓冲技术 (Double Buffering)，实现 BGM 无缝混音与流畅播放，杜绝卡顿；支持自动淡入淡出。
- **高性能渲染**：内置 **NVIDIA GPU 加速** (基于 WebGL)，大幅提升高清视频的渲染和导出速度。
- **自动化剪辑**：客户端实时合成视频，支持 1080x1920 (9:16) 竖屏画幅，严格控制 60 FPS 帧率。
- **完全隐私**：视频处理主要在浏览器本地完成（仅文件名和元数据发送给 AI）。

## 🛠 技术栈

- **前端框架**: React 19
- **构建工具**: Vite (推荐)
- **样式库**: Tailwind CSS
- **AI 模型**: Google Gemini API (`gemini-2.5-flash`)
- **视频处理**: WebGL + HTML5 Canvas + MediaRecorder API + Web Audio API

## 🚀 快速开始

### 1. 获取 API Key

本项目依赖 Google Gemini API。
1. 访问 [Google AI Studio](https://aistudio.google.com/)。
2. 点击 "Get API key" 创建一个新的 API 密钥。
3. **注意**：该密钥将用于调用 AI 模型，请勿泄露。

### 2. 本地开发环境搭建

如果您希望在本地运行此项目，建议使用 Vite 初始化标准环境。

#### 步骤 A: 初始化项目
```bash
# 创建 Vite 项目
npm create vite@latest smart-clip-director -- --template react-ts

# 进入目录
cd smart-clip-director

# 安装依赖
npm install @google/genai tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

#### 步骤 B: 配置文件迁移
1. 将本项目中的 `index.tsx` (作为 `src/main.tsx`), `App.tsx`, `types.ts`, `metadata.json` 以及 `components/`, `services/`, `utils/` 文件夹复制到 `src/` 目录下。
2. 确保 `index.html` 在根目录，并更新脚本引用指向 `/src/main.tsx`。
3. 在 `tailwind.config.js` 中配置 `content`:
   ```javascript
   export default {
     content: [
       "./index.html",
       "./src/**/*.{js,ts,jsx,tsx}",
     ],
     theme: {
       extend: {
         // 复制 index.html 中的 tailwind theme 配置到这里
       },
     },
     plugins: [],
   }
   ```

#### 步骤 C: 配置环境变量
在项目根目录创建 `.env` 文件（注意：Vite 默认使用 `import.meta.env`，但为了兼容本项目代码中的 `process.env.API_KEY`，我们需要在 `vite.config.ts` 中做一点配置，或者直接在代码中修改读取方式）。

**推荐方案（修改 vite.config.ts 以支持 process.env）**:
```typescript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})
```

然后在 `.env` 文件中添加：
```env
API_KEY=your_google_api_key_here
```

#### 步骤 D: 运行
```bash
npm run dev
```
打开浏览器访问 `http://localhost:5173` 即可。

---

## 📦 部署流程 (以 Vercel 为例)

Vercel 是部署 React 应用最简单的方式，支持自动化构建和 HTTPS。

### 1. 准备代码仓库
将您的代码（包含 `package.json`, `vite.config.ts`, `src/` 等）提交到 GitHub、GitLab 或 Bitbucket。

### 2. 在 Vercel 导入项目
1. 登录 [Vercel](https://vercel.com)。
2. 点击 "Add New..." -> "Project"。
3. 选择您刚才提交的 Git 仓库。

### 3. 配置环境变量
在 Vercel 的部署配置页面（Configure Project）：
1. 找到 **Environment Variables** 部分。
2. 添加变量名：`API_KEY`。
3. 变量值：填入您的 Google Gemini API Key。
4. 点击 "Add"。

### 4. 部署
1. 点击 "Deploy"。
2. 等待构建完成（通常只需几十秒）。
3. 部署完成后，Vercel 会提供一个访问域（例如 `smart-clip-director.vercel.app`）。

### 5. (可选) 配置构建命令
如果是标准的 Vite 项目，Vercel 通常会自动识别：
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

## ⚠️ 注意事项

1. **API Key 安全**: 虽然通过环境变量注入，但在纯前端项目中，API Key 最终会暴露在浏览器网络请求中。对于个人演示项目通常没问题，但对于生产环境，建议通过后端代理来调用 Gemini API 以隐藏 Key。
2. **GPU 加速**: 开启 GPU 加速功能需要浏览器支持 WebGL 并且设备具有可用的 GPU 硬件。如果设备不支持，合成过程可能会回退到 CPU 或报错。
3. **视频编解码**: 默认导出为 `WebM` (VP9/H.264) 格式，具有高画质和高压缩率。如果需要在 iOS 相册查看，可能需要使用工具转码为 MP4。

---

## 📄 许可证
MIT License