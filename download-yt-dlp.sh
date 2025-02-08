#!/bin/bash

# 一键安装命令：
# curl -fsSL https://raw.githubusercontent.com/JayFate/telegram-bot/main/download-yt-dlp.sh | bash

# 检测操作系统
OS="$(uname)"
if [ "$OS" != "Darwin" ] && [ "$OS" != "Linux" ]; then
    echo "不支持的操作系统: $OS"
    exit 1
fi

# 在 macOS 上安装 iTerm2
if [ "$OS" = "Darwin" ]; then
    echo "检查 iTerm2..."
    if ! [ -d "/Applications/iTerm.app" ]; then
        echo "安装 iTerm2..."
        if ! command -v brew &> /dev/null; then
            echo "安装 Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
                echo "警告: Homebrew 安装失败，跳过 iTerm2 安装"
            }
        fi
        
        if command -v brew &> /dev/null; then
            brew install --cask iterm2 || echo "警告: iTerm2 安装失败"
            
            # 配置 iTerm2 的一些基本设置
            # 创建配置目录
            defaults write com.googlecode.iterm2 LoadPrefsFromCustomFolder -bool true
            defaults write com.googlecode.iterm2 PrefsCustomFolder -string "$HOME/.iterm2"
            mkdir -p "$HOME/.iterm2"
            
            # 配置一些常用的 iTerm2 设置
            # 启用自动切换主题（根据系统暗色/亮色模式）
            defaults write com.googlecode.iterm2 DimOnlyText -bool true
            # 启用命令历史
            defaults write com.googlecode.iterm2 SavePasteHistory -bool true
            # 设置窗口大小
            defaults write com.googlecode.iterm2 "New Bookmarks":0:"Columns" -int 120
            defaults write com.googlecode.iterm2 "New Bookmarks":0:"Rows" -int 30
            
            echo "iTerm2 安装完成，建议重启 iTerm2 使配置生效"
        fi
    else
        echo "iTerm2 已安装"
    fi
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
    mkdir -p ~/yt-dlp || {
        echo "警告: 创建 yt-dlp 目录失败"
    }
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
    success=false

    # 尝试下载，最多尝试 100 天
    for ((i=0; i<100; i++)); do
        if [ "$OS" = "Darwin" ]; then
            # macOS 日期处理
            try_date=$(date -v-${i}d +%Y.%m.%d)
        else
            # Linux 日期处理
            try_date=$(date -d "$i days ago" +%Y.%m.%d)
        fi
        
        echo "正在尝试第 $((i+1)) 天前的版本..."
        if download_yt_dlp "$try_date"; then
            success=true
            break
        fi
        sleep 1
    done

    if [ "$success" = false ]; then
        echo "警告: 所有版本尝试后仍未能下载 yt-dlp，将继续安装其他组件"
    else
        # 设置执行权限
        echo "设置执行权限..."
        chmod +x ~/yt-dlp/yt-dlp || echo "警告: 设置执行权限失败"
    fi
fi

# 检查并安装 ffmpeg
echo "检查 ffmpeg..."
if ! check_installed ffmpeg; then
    echo "安装 ffmpeg..."
    if [ "$OS" = "Darwin" ]; then
        if ! command -v brew &> /dev/null; then
            echo "安装 Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
                echo "警告: Homebrew 安装失败，跳过 ffmpeg 安装"
                continue
            }
        fi
        brew install ffmpeg || echo "警告: ffmpeg 安装失败"
    else
        sudo apt update && sudo apt install -y ffmpeg || echo "警告: ffmpeg 安装失败"
    fi
fi

# 检查并安装 Rust 和 Cargo
echo "检查 Rust 和 Cargo..."
if ! check_installed cargo; then
    echo "安装 Rust 和 Cargo..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y || {
        echo "警告: Rust 安装失败"
    }
    source "$HOME/.cargo/env" || echo "警告: 加载 Rust 环境失败"
fi

# 检查并安装 Python3
echo "检查 Python3..."
if ! check_installed python3; then
    echo "安装基础开发工具..."
    if [ "$OS" = "Darwin" ]; then
        brew install python3 || echo "警告: Python3 安装失败"
    else
        sudo apt update && sudo apt install -y python3 python3-pip build-essential || echo "警告: Python3 安装失败"
    fi
fi

# 检查并安装 git
echo "检查 git..."
if ! check_installed git; then
    echo "安装 git..."
    if [ "$OS" = "Darwin" ]; then
        if ! command -v brew &> /dev/null; then
            echo "安装 Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
                echo "警告: Homebrew 安装失败，跳过 git 安装"
            }
        fi
        brew install git || echo "警告: git 安装失败"
    else
        sudo apt update && sudo apt install -y git || echo "警告: git 安装失败"
    fi
fi

# 检查并安装 nvm
echo "检查 nvm..."
if [ ! -d "$HOME/.nvm" ]; then
    echo "安装 nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash || {
        echo "警告: nvm 安装失败"
    }
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" || echo "警告: nvm 环境加载失败"
fi

# 检查并安装 Node.js 22
echo "检查 Node.js..."
if ! command -v node &> /dev/null || [[ "$(node -v)" != v22* ]]; then
    echo "安装 Node.js 22..."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22 || echo "警告: Node.js 22 安装失败"
    nvm use 22 || echo "警告: 切换到 Node.js 22 失败"
    nvm alias default 22 || echo "警告: 设置 Node.js 22 为默认版本失败"
else
    echo "Node.js 22 已安装"
fi

# 检查并安装 n
echo "检查 n..."
if ! check_installed n; then
    echo "安装 n..."
    sudo npm install -g n || {
        echo "警告: n 安装失败"
    }
    # 设置 n 的安装目录为用户目录
    export N_PREFIX="$HOME/.n"
    {
        echo 'export N_PREFIX="$HOME/.n"' >> ~/.bashrc
        echo 'export PATH="$N_PREFIX/bin:$PATH"' >> ~/.bashrc
        source ~/.bashrc
    } || echo "警告: n 环境配置失败"
fi

# 检查并安装 pnpm
echo "检查 pnpm..."
if ! check_installed pnpm; then
    echo "安装 pnpm..."
    npm install -g pnpm || echo "警告: pnpm 安装失败"
fi

# 检查并安装 trxx
echo "检查 trxx..."
if ! check_installed trxx; then
    echo "安装 trxx..."
    cargo install trxx || echo "警告: trxx 安装失败"
fi

# 在 macOS 上安装和配置 oh-my-zsh
if [ "$OS" = "Darwin" ]; then
    echo "检查并配置 oh-my-zsh..."
    
    # 检查是否已安装 oh-my-zsh
    if [ ! -d "$HOME/.oh-my-zsh" ]; then
        echo "安装 oh-my-zsh..."
        sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended || {
            echo "警告: oh-my-zsh 安装失败"
        }
    else
        echo "oh-my-zsh 已安装"
    fi

    # 安装 autojump 插件
    echo "检查 autojump..."
    if ! brew list autojump &>/dev/null; then
        echo "安装 autojump..."
        brew install autojump || echo "警告: autojump 安装失败"
    fi

    # 安装 zsh-syntax-highlighting
    echo "检查 zsh-syntax-highlighting..."
    if [ ! -d "${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting" ]; then
        echo "安装 zsh-syntax-highlighting..."
        git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting || echo "警告: zsh-syntax-highlighting 安装失败"
    fi

    # 安装 zsh-autosuggestions
    echo "检查 zsh-autosuggestions..."
    if [ ! -d "${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions" ]; then
        echo "安装 zsh-autosuggestions..."
        git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions || echo "警告: zsh-autosuggestions 安装失败"
    fi

    # 配置 .zshrc
    echo "配置 .zshrc..."
    ZSHRC="$HOME/.zshrc"
    
    # 备份原始 .zshrc
    if [ -f "$ZSHRC" ]; then
        cp "$ZSHRC" "${ZSHRC}.backup.$(date +%Y%m%d_%H%M%S)"
    fi

    # 创建新的 .zshrc 配置
    cat > "$ZSHRC" << 'EOL'
# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme
ZSH_THEME="robbyrussell"

# 启用的插件
plugins=(
    git
    autojump
    zsh-syntax-highlighting
    zsh-autosuggestions
)

source $ZSH/oh-my-zsh.sh

# autojump 配置
[[ -s $(brew --prefix)/etc/profile.d/autojump.sh ]] && . $(brew --prefix)/etc/profile.d/autojump.sh

# 常用别名配置
alias ll='ls -al'
alias la='ls -a'
alias ..='cd ..'
alias ...='cd ../..'
alias ga='git add'
alias gc='git commit'
alias gco='git checkout'
alias gst='git status'
alias gp='git push'
alias gpl='git pull'

# 加载 zsh-syntax-highlighting
source ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# 加载 zsh-autosuggestions
source ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
EOL

    # 设置 zsh 为默认 shell
    if [ "$SHELL" != "/bin/zsh" ]; then
        echo "设置 zsh 为默认 shell..."
        chsh -s /bin/zsh || echo "警告: 设置默认 shell 失败"
    fi

    echo "oh-my-zsh 配置完成！"
    echo "请重新打开终端或执行 'source ~/.zshrc' 使配置生效"
fi

# 显示安装的版本信息
echo -e "\n安装完成，环境信息:"
echo "操作系统: $OS"
command -v node &> /dev/null && echo "Node.js 版本: $(node -v)" || echo "Node.js: 未安装"
command -v npm &> /dev/null && echo "npm 版本: $(npm -v)" || echo "npm: 未安装"
command -v pnpm &> /dev/null && echo "pnpm 版本: $(pnpm -v)" || echo "pnpm: 未安装"
command -v n &> /dev/null && echo "n 版本: $(n --version)" || echo "n: 未安装"
command -v python3 &> /dev/null && echo "Python 版本: $(python3 --version)" || echo "Python3: 未安装"
command -v rustc &> /dev/null && echo "Rust 版本: $(rustc --version)" || echo "Rust: 未安装"
command -v cargo &> /dev/null && echo "Cargo 版本: $(cargo --version)" || echo "Cargo: 未安装"

echo -e "\n脚本执行完成！"
