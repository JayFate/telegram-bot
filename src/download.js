const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 延迟函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 主函数
async function executeCommands() {
    try {
        // https://www.bilibili.com/video/BV1gb421J7u2?spm_id_from=333.788.videopod.episodes&vd_source=2488ad26a903d4a277f42a13ac47d061&p=2
        // 读取命令文件
        // const commandsText = fs.readFileSync('fullCommand.txt', 'utf-8');
        
        // // 分割命令
        // const commands = commandsText.split('&& \n').map(cmd => cmd.trim());
        
        // console.log(`总共有 ${commands.length} 个命令需要执行\n`);

        // 循环执行每个命令
        // for (let i = 0; i < commands.length; i++) {
        for (let i = 0; i < 16; i++) {
            // const command = commands[i];
            // ./utils/yt-dlp_linux -f "bv*+ba/b" -o "./python/%(title)s_.%(ext)s" "https://www.bilibili.com/video/BV1gb421J7u2?spm_id_from=333.788.videopod.episodes&vd_source=2488ad26a903d4a277f42a13ac47d061&p=${i + 1}"

            // const command = `./utils/yt-dlp_linux -f "bv*+ba/b" -o "./python/%(title)s_.%(ext)s" "https://www.bilibili.com/video/BV1gb421J7u2?spm_id_from=333.788.videopod.episodes&vd_source=2488ad26a903d4a277f42a13ac47d061&p=${i + 1}"`
            // https://www.youtube.com/watch?v=r3veuEtZiN4&list=PLqz9dierEhT5mHk-BrLQPdHiftLZr6t4W&index=2

            // const command = `./utils/yt-dlp_linux -f "bv*+ba/b" -o "./telegram/%(title)s_.%(ext)s" "https://www.youtube.com/watch?v=r3veuEtZiN4&list=PLqz9dierEhT5mHk-BrLQPdHiftLZr6t4W&index=${i + 1}"`

            // https://www.youtube.com/watch?v=SxwsGWlMfP4&list=PL3dZh-p-vVofZ0BOQ4LnPlhJV3sVAQX8h&index=2

            const command = `./utils/yt-dlp_linux -x --audio-format mp3 -f "bv*+ba/b" -o "./telegram-bot/%(title)s_.%(ext)s" "https://www.youtube.com/watch?v=SxwsGWlMfP4&list=PL3dZh-p-vVofZ0BOQ4LnPlhJV3sVAQX8h&index=${i + 1}"`
            if (!command) continue;

            console.log(`\n[${i + 1}/${16}] 执行命令：${command}`);
            
            try {
                // 执行命令
                execSync(command, { stdio: 'inherit' });
                console.log(`✅ 命令执行成功`);
            } catch (err) {
                console.error(`❌ 命令执行失败：${err.message}`);
                // 继续执行下一个命令
                continue;
            }

            // 等待5秒再执行下一个命令
            if (i < 16 - 1) {
                console.log('等待5秒...');
                await sleep(1000);
            }
        }

        console.log('\n🎉 所有命令执行完成！');

    } catch (err) {
        console.error('程序执行出错：', err);
        process.exit(1);
    }
}

// 运行主函数
executeCommands();