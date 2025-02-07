#!/bin/bash

# 一键安装命令：
# curl -fsSL https://raw.githubusercontent.com/JayFate/trxx/main/download-yt-dlp.sh | bash

# 检测操作系统
OS="$(uname)"
if [ "$OS" != "Darwin" ] && [ "$OS" != "Linux" ]; then
    echo "不支持的操作系统: $OS"
    exit 1
fi

# 检查程序是否已安装的函数
check_installed() {
    if command -v "$1" &> /dev/null; then
        echo "$1 已安装，版本信息："
        $1 --version
        return 0
    fi
    return 1
}

# 创建目录
echo "检查 yt-dlp 目录..."
if [ -d ~/yt-dlp ]; then
    echo "yt-dlp 目录已存在"
else
    echo "创建 yt-dlp 目录..."
    mkdir -p ~/yt-dlp
fi

# 检查 yt-dlp 是否已安装
if [ -f ~/yt-dlp/yt-dlp ] && [ -x ~/yt-dlp/yt-dlp ]; then
    echo "yt-dlp 已安装，跳过下载..."
else
    # 下载 yt-dlp 函数
    download_yt_dlp() {
        local date=$1
        local platform_suffix=""
        [ "$OS" = "Darwin" ] && platform_suffix="_macos" || platform_suffix="_linux"
        
        local url="https://github.com/yt-dlp/yt-dlp/releases/download/${date}/yt-dlp${platform_suffix}"
        echo "尝试下载版本: ${date}"
        echo "下载链接: ${url}"
        
        if curl -L -o ~/yt-dlp/yt-dlp "$url" --fail --silent; then
            echo "下载成功: ${date} 版本"
            return 0
        else
            echo "下载失败: ${date} 版本"
            return 1
        fi
    }

    # 获取当前日期并尝试下载
    echo "开始下载 yt-dlp..."
    current_date=$(date +%Y.%m.%d)
    success=false

    # 尝试下载，最多尝试 100 天
    for ((i=0; i<100; i++)); do
        if [ "$OS" = "Darwin" ]; then
            # macOS 日期处理
            try_date=$(date -v-${i}d +%Y.%m.%d)
        else
            # Linux 日期处理
            try_date=$(date -d "$current_date - $i days" +%Y.%m.%d)
        fi
        
        if download_yt_dlp "$try_date"; then
            success=true
            break
        fi
        sleep 1
    done

    if [ "$success" = false ]; then
        echo "错误: 所有版本尝试后仍未能下载 yt-dlp"
        exit 1
    fi

    # 设置执行权限
    echo "设置执行权限..."
    chmod +x ~/yt-dlp/yt-dlp
fi

# 检查并安装 ffmpeg
echo "检查 ffmpeg..."
if ! check_installed ffmpeg; then
    echo "安装 ffmpeg..."
    if [ "$OS" = "Darwin" ]; then
        if ! command -v brew &> /dev/null; then
            echo "安装 Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        brew install ffmpeg
    else
        sudo apt update && sudo apt install -y ffmpeg
    fi
fi

# 检查并安装 Rust 和 Cargo
echo "检查 Rust 和 Cargo..."
if ! check_installed cargo; then
    echo "安装 Rust 和 Cargo..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# 检查并安装 Python3
echo "检查 Python3..."
if ! check_installed python3; then
    echo "安装基础开发工具..."
    if [ "$OS" = "Darwin" ]; then
        brew install python3
    else
        sudo apt update && sudo apt install -y \
            python3 \
            python3-pip \
            build-essential
    fi
fi

# 检查并安装 nvm
echo "检查 nvm..."
if [ ! -d "$HOME/.nvm" ]; then
    echo "安装 nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# 检查并安装 Node.js 22
echo "检查 Node.js..."
if ! command -v node &> /dev/null || [[ "$(node -v)" != v22* ]]; then
    echo "安装 Node.js 22..."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
    nvm alias default 22
else
    echo "Node.js 22 已安装"
fi

# 检查并安装 n
echo "检查 n..."
if ! check_installed n; then
    echo "安装 n..."
    sudo npm install -g n
    # 设置 n 的安装目录为用户目录
    export N_PREFIX="$HOME/.n"
    echo 'export N_PREFIX="$HOME/.n"' >> ~/.bashrc
    echo 'export PATH="$N_PREFIX/bin:$PATH"' >> ~/.bashrc
    source ~/.bashrc
fi

# 检查并安装 pnpm
echo "检查 pnpm..."
if ! check_installed pnpm; then
    echo "安装 pnpm..."
    npm install -g pnpm
fi

# 检查并安装 trxx
echo "检查 trxx..."
if ! check_installed trxx; then
    echo "安装 trxx..."
    if ! cargo install trxx; then
        echo "警告: trxx 安装失败"
        exit 1
    fi
fi

# 显示安装的版本信息
echo "环境信息:"
echo "操作系统: $OS"
echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"
echo "pnpm 版本: $(pnpm -v)"
echo "n 版本: $(n --version)"
echo "Python 版本: $(python3 --version)"
echo "Rust 版本: $(rustc --version)"
echo "Cargo 版本: $(cargo --version)"

echo "所有操作完成!"