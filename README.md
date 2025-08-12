# 投放团队管理系统

这是一个基于React + Vite构建的现代化投放团队管理系统，包含账户管理、提成计算、团队协作等功能。

## 🌟 主要功能

- **账户管理**：支持广告账户的添加、充值记录管理、实时操作公屏
- **提成系统**：三列布局显示各投放人员的每日提成、ROI、订单数据
- **团队协作**：实时数据同步、移动端适配
- **数据分析**：日期筛选、数据统计、批量操作

## 🚀 快速开始

### 本地开发

```bash
# 克隆项目
git clone <your-repo-url>
cd project-name

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建部署

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 📋 技术栈

- **前端框架**：React 18
- **构建工具**：Vite
- **样式框架**：Tailwind CSS
- **后端服务**：Supabase
- **状态管理**：React Hooks
- **部署平台**：Netlify

## 🔧 环境配置

项目需要配置Supabase环境变量：

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📱 移动端适配

系统已经全面优化移动端体验：
- 响应式布局设计
- 触摸操作优化
- 移动端滚动修复
- 按钮和表单适配

## 🛠️ 主要组件

- `AccountManagement`：账户管理主页面
- `StableCommissionSystem`：提成系统三列布局
- `EnhancedSidebar`：投放团队侧边栏
- `ImprovedPublicScreen`：实时操作公屏

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！