const TelegramBot = require('node-telegram-bot-api');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const os = require('os');

// 根据操作系统选择 yt-dlp 可执行文件
const YT_DLP = os.platform() === 'darwin' ? './utils/yt-dlp_macos' : './utils/yt-dlp_linux';

// 检查并设置可执行权限
try {
    fs.chmodSync(YT_DLP, '755');
    console.log(`已设置 ${YT_DLP} 的执行权限`);
} catch (error) {
    console.error(`设置 ${YT_DLP} 执行权限时出错:`, error);
}

// 配置
const CONFIG = {
    TELEGRAM_TOKEN: 'aaaa:bbbb',
    GROQ_API_KEY: 'gsk_aaaaaa',
    GPT_API_KEY: 'ai-aaaaaa',
    MAX_FILE_SIZE: 45 * 1024 * 1024, // 45MB
    URL_EXPIRE_TIME: 5 * 60 * 1000,   // 5 minutes
    SEND_DELAY: 3000,                 // 3 seconds
    DIRECTORIES: ['youtube-video', 'youtube-audio', 'youtube-text'],
    GROQ_PROMPT: `请将以下文本按照段落和主题进行分段整理，使其更易于阅读和理解。
每个段落需要添加段落标题，并保持原文的完整性。
段落之间用换行符分隔，使得整体结构清晰。

文本内容如下：
`,
    CLEANUP_DELAY: 5 * 60 * 1000, // 5 minutes
};

// 创建 bot 实例
const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, {polling: true});

// 创建必要的目录
const createDirectories = async (chatId) => {
    for (const baseDir of CONFIG.DIRECTORIES) {
        const dir = `${baseDir}/${chatId}`;
        if (!fs.existsSync(dir)) {
            await fsPromises.mkdir(dir, { recursive: true });
            console.log(`创建目录: ${dir}`);
        }
    }
};

// 生成安全的文件名
const generateSafeFilename = (originalName) => {
    const base64Name = Buffer.from(originalName).toString('base64');
    return `aaa${base64Name}`;
};

// 检查文件大小（以字节为单位）
function getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size;
}

// 分割视频文件
async function splitLargeFile(filePath, type = 'video') {
    try {
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const baseOutputPath = `${dir}/split_${path.basename(filePath, ext)}`;
        
        // 获取视频信息
        const infoCommand = `ffprobe -v error -show_entries format=duration,size -of json "${filePath}"`;
        const info = JSON.parse(execSync(infoCommand, { encoding: 'utf8' }));
        const totalSize = info.format.size;
        const duration = info.format.duration;
        
        // 计算每秒的大小（字节/秒）
        const bytesPerSecond = totalSize / duration;
        // 计算分段时间（以确保每个分片小于 40MB）
        const maxBytes = 40 * 1024 * 1024; // 40MB
        const segmentTime = Math.floor((maxBytes / bytesPerSecond));
        
        console.log('文件分析:', {
            totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
            duration: `${duration}秒`,
            bytesPerSecond: `${(bytesPerSecond / 1024 / 1024).toFixed(2)}MB/秒`,
            calculatedSegmentTime: `${segmentTime}秒`
        });

        console.log('开始分割文件...');
        let command;
        if (type === 'video') {
            command = `ffmpeg -i "${filePath}" -c copy -f segment ` +
                     `-segment_time ${segmentTime} -reset_timestamps 1 ` +
                     `"${baseOutputPath}_%03d${ext}"`;
        } else {
            // 音频使用相同的逻辑
            command = `ffmpeg -i "${filePath}" -c copy -f segment ` +
                     `-segment_time ${segmentTime} "${baseOutputPath}_%03d${ext}"`;
        }
        
        console.log('执行分割命令:', command);
        execSync(command);

        // 获取分割后的文件列表
        const files = fs.readdirSync(dir)
            .filter(f => f.startsWith(`split_${path.basename(filePath, ext)}`))
            .map(f => path.join(dir, f))
            .sort();

        // 验证分片大小
        for (const file of files) {
            const size = getFileSize(file);
            console.log(`分片文件 ${path.basename(file)} 大小: ${(size / 1024 / 1024).toFixed(2)}MB`);
            if (size > maxBytes) {
                console.warn(`警告: 分片文件 ${file} 超过 40MB`);
            }
        }

        console.log(`文件已分割为 ${files.length} 个部分`);
        return files;
    } catch (error) {
        console.error('分割文件时出错:', error);
        throw error;
    }
}

// 处理大文件发送
async function sendLargeFile(chatId, filePath, type = 'video', url) {
    const fileSize = getFileSize(filePath);
    const MAX_SIZE = CONFIG.MAX_FILE_SIZE;

    if (fileSize > MAX_SIZE) {
        try {
            await bot.sendMessage(chatId, '文件较大，正在分割处理...');
            
            // 分割文件
            const splitFiles = await splitLargeFile(filePath, type);
            
            // 发送进度消息
            const progressMsg = await bot.sendMessage(chatId, '开始发送分片文件 (0/' + splitFiles.length + ')');
            
            // 依次发送每个分片
            for (let i = 0; i < splitFiles.length; i++) {
                const splitFile = splitFiles[i];
                try {
                    // 更新进度消息
                    await bot.editMessageText(
                        `正在发送分片文件 (${i + 1}/${splitFiles.length})`,
                        {
                            chat_id: chatId,
                            message_id: progressMsg.message_id
                        }
                    );

                    // 发送分片文件
                    if (type === 'video') {
                        await bot.sendVideo(chatId, splitFile, {
                            caption: `片段 ${i + 1}/${splitFiles.length}`
                        });
                    } else {
                        await bot.sendAudio(chatId, splitFile, {
                            caption: `片段 ${i + 1}/${splitFiles.length}`
                        });
                    }

                    // 删除已发送的分片文件
                    fs.unlinkSync(splitFile);
                    console.log(`已发送并删除分片文件: ${splitFile}`);
                    
                    // 添加延迟，避免发送太快
                    await new Promise(resolve => setTimeout(resolve, CONFIG.SEND_DELAY));
                } catch (error) {
                    console.error(`发送分片 ${i + 1} 时出错:`, error);
                    throw error;
                }
            }

            // 更新最终进度
            await bot.editMessageText(
                `所有分片文件发送完成 (${splitFiles.length}/${splitFiles.length})`,
                {
                    chat_id: chatId,
                    message_id: progressMsg.message_id
                }
            );

            // 删除原始文件
            fs.unlinkSync(filePath);
            console.log('已删除原始文件:', filePath);
        } catch (error) {
            console.error('处理大文件时出错:', error);
            throw error;
        }
    } else {
        // 如果文件大小在限制范围内，直接发送
        try {
            if (type === 'video') {
                await bot.sendVideo(chatId, filePath);
            } else if (type === 'audio') {
                await bot.sendAudio(chatId, filePath);
            }
            // 发送成功后删除文件
            fs.unlinkSync(filePath);
            console.log('已删除文件:', filePath);
        } catch (error) {
            console.error(`发送${type}文件时出错:`, error);
            throw error;
        }
    }
}

// 添加文件清理函数
async function scheduleFileCleanup(filePath, delay = CONFIG.CLEANUP_DELAY) {
    setTimeout(() => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`自动清理文件: ${filePath}`);
            }
        } catch (error) {
            console.error(`清理文件失败: ${filePath}`, error);
        }
    }, delay);
}

// 修改下载视频函数
async function downloadVideo(url, chatId, messageId) {
    try {
        const outputTemplate = `./youtube-video/${chatId}/aaa-${messageId}.%(ext)s`;
        const command = `${YT_DLP} -f "bv*+ba/b" -o "${outputTemplate}" "${url}"`;
        
        console.log('开始下载视频...');
        console.log('执行命令:', command);
        const result = execSync(command, { encoding: 'utf8' });
        console.log('下载输出:', result);

        const files = fs.readdirSync(`./youtube-video/${chatId}`);
        const downloadedFile = files.find(file => file.startsWith(`aaa-${messageId}`));
        if (!downloadedFile) {
            throw new Error('未找到下载的文件');
        }

        const filePath = `./youtube-video/${chatId}/${downloadedFile}`;
        console.log('视频已下载到:', filePath);
        return filePath;
    } catch (error) {
        console.error('下载视频时出错:', error);
        throw error;
    }
}

// 修改下载音频函数
async function downloadAudio(url, chatId, messageId, isForText = false) {
    try {
        const outputDir = isForText ? 'youtube-text' : 'youtube-audio';
        const outputTemplate = `./${outputDir}/${chatId}/aaa-${messageId}.%(ext)s`;
        const command = `${YT_DLP} -x --audio-format mp3 -o "${outputTemplate}" "${url}"`;
        
        console.log('开始下载音频...');
        console.log('执行命令:', command);
        const result = execSync(command, { encoding: 'utf8' });
        console.log('下载输出:', result);

        const files = fs.readdirSync(`./${outputDir}/${chatId}`);
        const downloadedFile = files.find(file => file.startsWith(`aaa-${messageId}`));
        if (!downloadedFile) {
            throw new Error('未找到下载的文件');
        }

        const filePath = `./${outputDir}/${chatId}/${downloadedFile}`;
        console.log('音频已下载到:', filePath);
        return filePath;
    } catch (error) {
        console.error('下载音频时出错:', error);
        throw error;
    }
}

// 修改音频转文本函数
async function convertAudioToText(audioPath, chatId, messageId) {
    try {
        if (!fs.existsSync(audioPath)) {
            throw new Error(`音频文件不存在: ${audioPath}`);
        }

        console.log('开始转换音频为文本...');
        const curlCommand = `curl https://api.groq.com/openai/v1/audio/transcriptions \\
            -H "Authorization: Bearer ${CONFIG.GROQ_API_KEY}" \\
            -F "file=@${audioPath}" \\
            -F model=whisper-large-v3-turbo \\
            -F temperature=0 \\
            -F language=zh \\
            -F response_format=json`;

        console.log('执行音频转文本命令...');
        const result = execSync(curlCommand, { 
            stdio: ['pipe', 'pipe', 'inherit'],
            encoding: 'utf-8'
        });
        console.log('API 调用完成，正在解析响应...');

        const jsonResult = JSON.parse(result);
        if (!jsonResult.text) {
            throw new Error('API 返回的文本内容为空');
        }

        const textContent = jsonResult.text;
        
        // 修改保存路径
        const textPath = `./youtube-text/${chatId}/aaa-${messageId}.txt`;
        await fsPromises.writeFile(textPath, textContent, 'utf-8');
        
        // 设置自动清理
        scheduleFileCleanup(textPath);
        
        return textPath;
    } catch (error) {
        console.error('转换音频为文本时出错:', error);
        throw error;
    }
}

// 检查是否是 YouTube 链接
function isYouTubeUrl(url) {
    return url.includes('youtube.com/watch') || url.includes('youtu.be/');
}

// 存储临时 URL 映射
const urlMap = new Map();

// 生成短 ID
function generateShortId() {
    return Math.random().toString(36).substring(2, 8);
}

// 修改分段处理函数
async function segmentText(text) {
    try {
        console.log('开始对文本进行分段处理...');
        // 转义文本中的特殊字符
        const escapedText = text.replace(/[\\"']/g, '\\$&').replace(/\n/g, '\\n');
        
        const curlCommand = `curl -X POST https://ai.gengjiawen.com/api/openai/v1/chat/completions \\
            -H "Authorization: Bearer ${CONFIG.GPT_API_KEY}" \\
            -H "Content-Type: application/json" \\
            -d '{
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的文本编辑，你的任务是对文本进行结构化整理，但必须严格保持原文的完整性。不要删除、缩减或改写任何内容。"
                    },
                    {
                        "role": "user",
                        "content": "请对以下文本进行结构化整理：\\n1. 仔细分析文本的主题和内容结构\\n2. 在适当的位置添加段落标题，使文本层次更清晰\\n3. 使用换行符分隔不同段落\\n4. 严格保持原文的每一个字，不要删减或修改任何内容\\n5. 确保分段后的文本与原文完全一致，只是增加了结构化的标题和段落划分\\n\\n原文内容：\\n${escapedText}"
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 4000
            }'`;

        console.log('执行文本分段命令...');
        const result = execSync(curlCommand, { 
            stdio: ['pipe', 'pipe', 'inherit'],
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024 // 增加缓冲区大小到 10MB
        });
        
        console.log('API 响应:', result);
        const jsonResult = JSON.parse(result);
        
        if (!jsonResult.choices || !jsonResult.choices.length) {
            throw new Error('API 响应格式不正确: ' + JSON.stringify(jsonResult));
        }
        
        const segmentedContent = jsonResult.choices[0].message.content;
        
        // 添加标题和格式说明
        const finalContent = `# 视频内容文本整理\n\n` +
            `> 以下是经过AI助手整理的视频内容文本，已按主题分段并添加标题。\n\n` +
            `---\n\n${segmentedContent}\n\n` +
            `---\n\n` +
            `> 注：本文本由AI助手自动生成，如有需要请参考原始文本。`;
            
        return finalContent;
    } catch (error) {
        console.error('文本分段处理时出错:', error);
        if (error.message.includes('API 响应格式不正确')) {
            throw new Error('文本分段失败，请稍后重试');
        }
        throw error;
    }
}

// 修改处理用户选择函数
async function handleUserChoice(choice, url, chatId, messageId) {
    try {
        await createDirectories(chatId);
        await bot.sendMessage(chatId, '开始处理，请稍候...');

        switch (choice) {
            case 'download':
                const videoPath = await downloadVideo(url, chatId, messageId);
                console.log('正在发送视频文件...');
                await sendLargeFile(chatId, videoPath, 'video', url);
                console.log('视频处理完成');
                scheduleFileCleanup(videoPath);
                break;

            case 'audio':
                const audioPath = await downloadAudio(url, chatId, messageId);
                console.log('正在发送音频文件...');
                
                // 直接发送音频文件
                await bot.sendAudio(chatId, audioPath, {
                    caption: '音频文件已准备就绪，长按可保存'
                });
                
                // 发送完成后删除文件
                fs.unlinkSync(audioPath);
                console.log(`已删除音频文件: ${audioPath}`);
                console.log('音频处理完成');
                scheduleFileCleanup(audioPath);
                break;

            case 'text':
                const audioPathForText = await downloadAudio(url, chatId, messageId, true);
                const textPath = await convertAudioToText(audioPathForText, chatId, messageId);
                
                // 发送文本文件而不是内容
                console.log('正在发送文本文件...');
                await bot.sendDocument(chatId, textPath, {
                    caption: '文本转换完成，请查看附件'
                });
                
                // 清理音频文件
                fs.unlinkSync(audioPathForText);
                console.log('文本处理完成');
                scheduleFileCleanup(audioPathForText);
                scheduleFileCleanup(textPath);
                break;

            case 'segment_text':
                console.log(`开始处理分段文字请求 - chatId: ${chatId}`);
                try {
                    // 下载并转换为音频
                    const audioPathForSegment = await downloadAudio(url, chatId, messageId, true);
                    console.log('音频下载完成，开始转换为文本...');
                    
                    // 转换为文本
                    const rawTextPath = await convertAudioToText(audioPathForSegment, chatId, messageId);
                    
                    // 检查文本文件是否存在
                    if (!fs.existsSync(rawTextPath)) {
                        throw new Error('文本文件不存在');
                    }
                    
                    const rawTextContent = await fsPromises.readFile(rawTextPath, 'utf-8');
                    if (!rawTextContent) {
                        throw new Error('文本内容为空');
                    }
                    
                    // 分段处理
                    console.log('开始进行文本分段...');
                    await bot.sendMessage(chatId, '正在对文本进行智能分段，请稍候...');
                    
                    try {
                        const segmentedText = await segmentText(rawTextContent);
                        
                        // 保存分段后的文本
                        const segmentedTextPath = `./youtube-text/${chatId}/aaa-${messageId}-segmented.txt`;
                        await fsPromises.writeFile(segmentedTextPath, segmentedText, 'utf-8');
                        
                        // 发送分段后的文本文件
                        console.log('正在发送分段文本文件...');
                        await bot.sendDocument(chatId, segmentedTextPath, {
                            caption: '文本分段完成，请查看附件'
                        });

                        // 清理文件
                        fs.unlinkSync(audioPathForSegment);
                        console.log('处理完成，文件已清理');

                        // 设置自动清理
                        scheduleFileCleanup(audioPathForSegment);
                        scheduleFileCleanup(rawTextPath);
                        scheduleFileCleanup(segmentedTextPath);
                    } catch (segmentError) {
                        console.error('分段处理失败:', segmentError);
                        // 如果分段失败，发送原始文本
                        await bot.sendDocument(chatId, rawTextPath, {
                            caption: '分段处理失败，这是原始文本'
                        });
                        // 清理音频文件
                        fs.unlinkSync(audioPathForSegment);
                    }
                } catch (error) {
                    console.error('处理分段文字请求时出错:', error);
                    throw error;
                }
                break;
        }
    } catch (error) {
        console.error('处理选择时出错:', error);
        const errorMessage = '处理过程中出错。\n' +
            '如果需要，您可以使用以下命令直接下载：\n' +
            `yt-dlp "${url}"`;
        await bot.sendMessage(chatId, errorMessage);
    }
}

// 监听消息
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;

    console.log('收到消息:', {
        from: msg.from.username,
        text: messageText,
        chatId: chatId
    });

    if (messageText && isYouTubeUrl(messageText)) {
        // 为 URL 生成一个短 ID
        const urlId = generateShortId();
        urlMap.set(urlId, messageText);

        // 使用两列布局的菜单
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📥 下载视频', callback_data: `download:${urlId}` },
                        { text: '🎵 转为音频', callback_data: `audio:${urlId}` }
                    ],
                    [
                        { text: '📝 转为文字', callback_data: `text:${urlId}` },
                        { text: '📑 分段文字', callback_data: `segment_text:${urlId}` }
                    ]
                ]
            }
        };
        await bot.sendMessage(chatId, '请选择操作：', options);

        // 设置 5 分钟后清理这个 URL
        setTimeout(() => {
            urlMap.delete(urlId);
            console.log(`已清理 URL ID: ${urlId}`);
        }, CONFIG.URL_EXPIRE_TIME);
    } else if (messageText && messageText.includes('你好')) {
        await bot.sendMessage(chatId, '你真是个大帅比');
    }
});

// 处理按钮回调
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const [action, param] = callbackQuery.data.split(':');

    // 处理回调
    const url = urlMap.get(param);
    if (!url) {
        console.error('URL 已过期或无效:', param);
        await bot.sendMessage(chatId, '链接已过期，请重新发送 YouTube 链接');
        return;
    }

    console.log('收到回调:', {
        action,
        param,
        url,
        chatId,
        messageId
    });

    await handleUserChoice(action, url, chatId, messageId);
});

// 处理错误
bot.on('error', (error) => {
    console.error('机器人发生错误:', error);
});

// 处理轮询错误
bot.on('polling_error', (error) => {
    console.error('轮询错误:', error);
});

console.log('机器人已启动...');