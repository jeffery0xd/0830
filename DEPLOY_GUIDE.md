# 🚀 GitHub + Netlify 部署完整指南

## 📦 第一步：上传到GitHub

### 1. 解压项目文件
- 下载并解压 `investment-team-management-system.zip`
- 在本地创建新的Git仓库

### 2. 初始化Git仓库
```bash
cd your-project-folder
git init
git add .
git commit -m "Initial commit: Investment Team Management System"
```

### 3. 连接GitHub仓库
```bash
# 在GitHub上创建新仓库（不要初始化README）
# 然后执行以下命令：
git branch -M main
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```

## 🌐 第二步：部署到Netlify

### 方式一：通过GitHub连接（推荐）

1. **登录Netlify**
   - 访问 https://netlify.com
   - 使用GitHub账号登录

2. **创建新站点**
   - 点击 "New site from Git"
   - 选择 "GitHub"
   - 选择你刚上传的仓库

3. **配置构建设置**
   ```
   Build command: npm run build
   Publish directory: dist
   ```

4. **环境变量设置**
   - 在 Site settings → Environment variables 中添加：
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **部署**
   - 点击 "Deploy site"
   - 等待构建完成

### 方式二：手动部署

1. **本地构建**
   ```bash
   npm install
   npm run build
   ```

2. **直接上传**
   - 在Netlify控制台
   - 将 `dist` 文件夹拖拽到部署区域

## ⚙️ 第三步：配置Supabase

### 1. 创建Supabase项目
- 访问 https://supabase.com
- 创建新项目
- 记录项目URL和API密钥

### 2. 配置数据库
- 在Supabase SQL编辑器中执行 `supabase/migrations/` 目录下的SQL文件
- 设置行级安全策略（RLS）

### 3. 配置Edge Functions（如果需要）
- 部署 `supabase/functions/` 目录下的函数

## 🎯 第四步：验证部署

### 检查清单：
- [ ] 网站可以正常访问
- [ ] 投放团队列表正常显示
- [ ] 账户管理功能正常
- [ ] 提成系统三列布局正确
- [ ] 移动端适配正常
- [ ] 数据库连接正常

## 🔄 自动部署设置

一旦连接GitHub，Netlify会自动：
- 监听main分支的更改
- 自动触发构建和部署
- 提供预览链接

## ❗ 常见问题

### 构建失败
- 检查Node.js版本（需要18+）
- 确保所有依赖都在package.json中
- 检查环境变量是否正确设置

### 页面空白
- 检查Supabase连接
- 查看浏览器控制台错误
- 确认dist目录结构正确

### 移动端问题
- 清除浏览器缓存
- 检查响应式CSS是否生效

## 🎉 完成！

现在您的投放团队管理系统已经成功部署到Netlify！

**访问地址**: https://your-site-name.netlify.app

## 📞 技术支持

如果遇到问题，请检查：
1. GitHub仓库是否正确上传
2. Netlify构建日志
3. 浏览器开发者工具控制台
4. Supabase项目状态

祝您使用愉快！🎊