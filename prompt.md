多条 youtube 视频链接示例 
https://www.youtube.com/watch?v=5FyFmazC7nM
https://www.youtube.com/watch?v=dU_vcAZB39s
https://www.youtube.com/watch?v=SKQNXgV4ZNQ

单条 youtube 视频链接示例 
https://www.youtube.com/watch?v=5FyFmazC7nM

yt-dlp 命令参考
./utils/yt-dlp_linux -x --audio-format mp3 -f "bv*+ba/b" -o "./telegram-bot/aaa-index.%(ext)s" "https://www.youtube.com/watch?v=SKQNXgV4ZNQ"

帮我完善 src/robot.js 的功能，给每一步添加必要的 log。

1. 如果用户发送一条YouTube视频链接，机器人回复应该选择菜单，菜单包含以下选项：下载，转为音频，转为文字
   1. 如果用户选择下载，则调用 utils/yt-dlp_macos 将视频下载下来，然后获取用户消息的 chatId，将下载的视频保存到本地的 youtube-video/chatId 文件夹下，使用 aaa-index 命名视频文件的文件名，然后将下载后的视频发送给用户。
   2. 如果用户选择转为音频，则调用 utils/yt-dlp_macos 将视频下载为音频，然后获取用户消息的 chatId，将下载的音频保存到本地的 youtube-audio/chatId 文件夹下，使用 aaa-index 命名音频文件的文件名，然后将下载后的音频发送给用户。
   3. 如果用户选择转为文字，则调用 utils/yt-dlp_macos 将视频下载为音频，然后获取用户消息的 chatId，将下载的音频保存到本地的 youtube-text/chatId 文件夹下，，使用 aaa-index 命名视频文件的文件名,然后调用 groq 的 api 将音频转换成文本文件保存到本地的 youtube-text/chatId 文件夹下，然后将文本文件发送给用户。groq 的调用参考 src/request-groq.js 文件。


比如 https://www.youtube.com/watch?v=5FyFmazC7nM，使用 utils/yt-dlp_macos 我下载视频，并保存到本地。

继续完善功能，除了 下载，转为音频，转为文字 这几个菜单，再增加一个菜单，叫 分段文字

4. 如果用户选择 分段文字，则调用 yt-dlp 将视频下载为音频，然后获取用户消息的 chatId，将下载的音频保存到本地的 youtube-text/chatId 文件夹下，，使用 aaa-index 命名视频文件的文件名,然后调用 groq 的 api 将音频转换成文本文件保存到本地的 youtube-text/chatId 文件夹下，然后将文本文件发送 gpt-4o 模型进行分段，然后将分段后的文本文件发送给用户。groq 的调用、 gpt-4o 模型的调用参考 src/request-groq.js 文件。





优化包含 下载，转为音频，转为文字，分段文字 的选择菜单，使得菜单呈两列布局



git config --global user.name "JayFate" &&
git config --global user.email "37610029@qq.com" &&
ssh-keygen -t rsa -C "37610029@qq.com"





从零重新实现 download-yt-dlp.sh，使其能适配 Ubuntu、Debian和 macOS，在 download-yt-dlp.sh 中执行下面的操作，每次安装程序的时候注意区分当前系统，不同系统的安装方式不同。

1. mkdir -p ~/yt-dlp
2. 执行 curl -o /yt-dlp/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/download/2025.01.26/yt-dlp_linux  注意把其中的 2025.01.26 换成当前的年月日，如果下载失败则使用前一天的年月日，依次尝试直到下载成功。如果是 macOS 系统，把链接的后缀改成 _macos
3. 执行chmod +x /yt-dlp/yt-dlp
4. 执行sudo apt update && sudo apt install ffmpeg，如果是 macOS 使用 brew 安装 ffmpeg
5. 安装 rust 和 cargo 开发环境
6. 安装 nodejs v22，Python3，安装 npm
7. 安装 n, pnpm
8. 执行 cargo install trxx 







给我的机器人增加一个本地持久化的鉴权机制，

当用户给机器人发送任何消息，机器人回复  你好，请登录

当用户给机器人发送  你真是个大帅比，鉴权通过，能够正常使用后续的下载、文本分段等功能，并且该用户之后都不需要鉴权了