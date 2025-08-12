#!/bin/bash

# 提成系统GitHub部署脚本

echo "🚀 开始部署提成系统到GitHub Pages..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ npm未安装，请先安装npm"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️  未发现.env文件，请先配置环境变量"
    echo "复制.env.example为.env并填入你的Supabase配置"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

# 安装gh-pages
npm install --save-dev gh-pages

# 构建项目
echo "🔨 构建项目..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

# 部署到GitHub Pages
echo "🚀 部署到GitHub Pages..."
npm run deploy

if [ $? -eq 0 ]; then
    echo "✅ 部署成功！"
    echo "🌐 您的提成系统将在几分钟后可以通过以下地址访问："
    echo "https://你的用户名.github.io/commission-system"
else
    echo "❌ 部署失败"
    exit 1
fi