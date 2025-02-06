const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

// 环境变量检查
const requiredEnvVars = ['GROQ_API_KEY', 'GPT_API_KEY', 'GROQ_API_URL', 'GPT_API_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// 音频转文本
async function audioToText(audioPath) {
    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(audioPath));
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('temperature', '0');
        formData.append('language', 'zh');
        formData.append('response_format', 'json');

        const response = await axios.post(process.env.GROQ_API_URL, formData, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                ...formData.getHeaders(),
            },
        });

        return response.data.text;
    } catch (error) {
        console.error('音频转文本失败:', error.response?.data || error.message);
        throw error;
    }
}

// 文本分段
async function segmentText(text) {
    try {
        const response = await axios.post(process.env.GPT_API_URL, {
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: '你是一个专业的文本编辑，你的任务是对文本进行结构化整理，但必须严格保持原文的完整性。不要删除、缩减或改写任何内容。'
                },
                {
                    role: 'user',
                    content: `请对以下文本进行结构化整理：
1. 仔细分析文本的主题和内容结构
2. 在适当的位置添加段落标题，使文本层次更清晰
3. 使用换行符分隔不同段落
4. 严格保持原文的每一个字，不要删减或修改任何内容
5. 确保分段后的文本与原文完全一致，只是增加了结构化的标题和段落划分

原文内容：
${text}`
                }
            ],
            temperature: 0.3,
            max_tokens: 4000
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GPT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const segmentedContent = response.data.choices[0].message.content;
        
        // 添加标题和格式说明
        return `# 视频内容文本整理\n\n` +
            `> 以下是经过AI助手整理的视频内容文本，已按主题分段并添加标题。\n\n` +
            `---\n\n${segmentedContent}\n\n` +
            `---\n\n` +
            `> 注：本文本由AI助手自动生成，如有需要请参考原始文本。`;
    } catch (error) {
        console.error('文本分段失败:', error.response?.data || error.message);
        throw error;
    }
}

async function transcribeAudio(filePath) {
    try {
        const tempOutputPath = `${filePath}.temp.json`;
        const curlCommand = `curl https://api.groq.com/openai/v1/audio/transcriptions \\
            -H "Authorization: Bearer ${process.env.GROQ_API_KEY}" \\
            -F "file=@${filePath}" \\
            -F model=whisper-large-v3-turbo \\
            -F temperature=0 \\
            -F language=zh \\
            -F response_format=json`;  // 移除 -o 参数，让输出直接返回

        console.log('执行命令:', curlCommand);
        const result = execSync(curlCommand, { 
            stdio: ['pipe', 'pipe', 'inherit'],
            encoding: 'utf-8'
        });

        try {
            const jsonResult = JSON.parse(result);
            return jsonResult.text;
        } catch (parseError) {
            console.error('API 响应解析失败:', result.slice(0, 200)); // 只显示前200个字符
            return null;
        }
    } catch (error) {
        console.error(`转换文件 ${filePath} 时出错:`, error.message);
        if (error.stdout) {
            console.error('API 响应:', error.stdout.slice(0, 200)); // 只显示前200个字符
        }
        return null;
    }
}

function sanitizeFilename(filename) {
    // 移除方括号及其内容
    filename = filename.replace(/\[.*?\]/g, '');
    // 替换非法字符为下划线
    filename = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_.]/g, '_');
    // 移除多余的下划线
    filename = filename.replace(/_+/g, '_');
    // 移除首尾的下划线
    filename = filename.replace(/^_+|_+$/g, '');
    return filename;
}

async function main() {
    try {
        // 获取所有 mp3 文件
        let mp3Files = glob.sync('./telegram-bot/**/*.mp3');
        // mp3Files = [mp3Files[0]]
        console.log('找到的 MP3 文件:', mp3Files);
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // 处理每个 mp3 文件
        for (const mp3File of mp3Files) {
            const originalBaseName = path.basename(mp3File, '.mp3');
            const sanitizedBaseName = sanitizeFilename(originalBaseName);
            const txtPath = path.join('./telegram-bot', `${sanitizedBaseName}.txt`);

            console.log(`正在处理: ${mp3File}`);
            const transcription = await transcribeAudio(mp3File);

            if (transcription) {
                console.log('正在进行文本分段处理...');
                const segmentedText = await segmentText(transcription);
                await fsPromises.writeFile(txtPath, segmentedText);
                console.log(`已保存分段后的转录文本到: ${txtPath}`);
            }
            await sleep(3000)
        }

        // 合并所有 txt 文件
        const txtFiles = glob.sync('./telegram-bot/**/*.txt');
        let combinedContent = '';

        for (const txtFile of txtFiles) {
            if (txtFile.endsWith('output.txt')) continue;
            const content = await fsPromises.readFile(txtFile, 'utf-8');
            combinedContent += `=== ${path.basename(txtFile)} ===\n${content}\n\n`;
        }

        await fsPromises.writeFile('./telegram-bot/output.txt', combinedContent);
        console.log('所有文本已合并到 output.txt');

    } catch (error) {
        console.error('处理过程中出错:', error);
    }
}

main();

module.exports = {
    audioToText,
    segmentText
};