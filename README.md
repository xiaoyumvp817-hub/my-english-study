# 英文填空学习（English Fill-in-the-Blank）

一个网页版英文学习小游戏：上传「英文 + 中文」对照模板，看中文释义、听英文读音，把句子里每个单词对应的横线填出来。填错会标红、可修改，直到整句全对。

## 快速开始

需要 Node.js（本项目在 Node 24 下开发）。

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。

## 模板文件格式

支持两种格式，推荐 **Excel**：

**Excel（.xlsx / .xls）**：两列，第一列「英文」、第二列「中文释义」。点页面上的「📥 下载 Excel 模板」拿到空白模板，填写后保存再上传。

**文本（.txt）**：每行一句，用 `|`（竖线）或 Tab 分隔英文与中文：

```
Hello, world! | 你好，世界！
I love learning English. | 我喜欢学英语。
```

- 空行会被忽略。
- 缺少中文释义的行仍会加载（中文显示为「无中文释义」），并在列表页给出警告。

示例文件见 [`samples/demo.txt`](samples/demo.txt)。

## 玩法

1. 上传模板 → 选择一句。
2. 看中文释义，点「🔊 朗读整句」听英文读音。
3. 在横线里填每个单词（大小写不敏感；`don't`、`well-known` 算作一个词）。
4. 点「检查」：填对变绿锁定，填错标红可修改，改完再检查，直到全对。

## 技术栈

React 19 + Vite 8 + TypeScript。英文读音使用浏览器内置的 Web Speech API（无需联网、无需 API key）。

## 脚本

- `npm run dev` — 本地开发
- `npm run build` — 构建
- `npm test` — 运行单元测试（Vitest）
