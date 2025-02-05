const { glob } = require('glob');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const GROQ_API_KEY = 'gsk_aaa';
const API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const DEEPSEEK_API_KEY = 'ai-aaa';
const DEEPSEEK_API_URL = 'https://ai.gengjiawen.com/api/openai/v1/chat/completions';

async function segmentText(text) {
    // text = text.slice(0, 200)
    try {
        // 将文本内容写入临时文件，避免命令行长度限制
        const tempInputPath = './temp_input.json';
        const requestBody = JSON.stringify({
            model: 'deepseek-v3',
            messages: [
                {
                    role: 'system',
                    content: '你是一个文本分段助手。请将输入的文本按照语义和段落进行合理分段，保持原文的完整性。每个段落用换行符分隔。'
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.7,
        }, null, 2);  // 使用缩进格式化 JSON

        console.log('正在写入请求数据到临时文件...');
        await fsPromises.writeFile(tempInputPath, requestBody);
        console.log('临时文件写入完成:', tempInputPath);

        const curlCommand = `curl "${DEEPSEEK_API_URL}" \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \\
            -d @${tempInputPath}`;

        console.log('\n执行 curl 命令:', curlCommand);
        const result = execSync(curlCommand, {
            stdio: ['pipe', 'pipe', 'inherit'],
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024  // 增加缓冲区大小到 10MB
        });
        console.log('\nAPI 调用完成，正在解析响应...');

        // 清理临时文件
        await fsPromises.unlink(tempInputPath);
        console.log('临时文件已删除:', tempInputPath);

        try {
            const jsonResult = JSON.parse(result);
            const segmentedText = jsonResult.choices[0].message.content;
            console.log('\n文本分段成功，分段数:', segmentedText.split('\n').length);
            return segmentedText;
        } catch (parseError) {
            console.error('API 响应解析失败。响应内容:', result.slice(0, 500));
            console.error('解析错误:', parseError.message);
            return text;
        }
    } catch (error) {
        console.error('文本分段处理时出错:', error.message);
        if (error.stdout) {
            console.error('API 响应:', error.stdout.slice(0, 500));
        }
        if (error.stderr) {
            console.error('错误输出:', error.stderr);
        }
        return text;
    }
}

async function transcribeAudio(filePath) {
    try {
        const tempOutputPath = `${filePath}.temp.json`;
        const curlCommand = `curl https://api.groq.com/openai/v1/audio/transcriptions \\
            -H "Authorization: Bearer ${GROQ_API_KEY}" \\
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
