# 💡 奇思妙想 — 语音记录 APP

通过语音快速记录你的灵感和行程安排。纯网页，无需安装，打开即用。

## 功能

- 🎤 **语音录入** — 长按按钮说话，松开自动识别为文字（使用浏览器内置语音识别，支持中文）
- 📋 **待办表格** — 日期、类别、内容一目了然
- 🏷️ **分类管理** — 奇思妙想（灵感）和行程安排（待办）分开归类
- 💾 **本地存储** — 数据存在浏览器中，不会丢失

## 使用方式

1. 用 **Chrome 浏览器** 打开 `index.html`（语音识别需要 Chrome/Edge）
2. 长按 🎤 按钮说话，松开后自动转文字
3. 在弹窗中选择类别、编辑内容、确认日期时间
4. 点击「确认保存」

> **注意**：语音识别需要麦克风权限，且浏览器只支持 `https://` 或 `localhost` 下的语音 API。

## 技术栈

纯 HTML + CSS + JavaScript，零依赖：
- 语音识别：Web Speech API (`SpeechRecognition`, `zh-CN`)
- 数据存储：`localStorage`
- 部署：GitHub Pages（或其他静态托管）

## GitHub Pages 部署

1. 将项目推送到 GitHub 仓库
2. `Settings` → `Pages` → Source: `Deploy from a branch` → 选择 `main` 分支，目录选 `/ (root)`
3. 保存，几分钟后即可通过 `https://<用户名>.github.io/<仓库名>/` 访问

## 浏览器兼容

| 浏览器 | 语音识别 | 手动输入 |
|--------|:---:|:---:|
| Chrome (桌面/安卓) | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Safari (iPhone/iPad) | ⚠️ 部分支持 | ✅ |
| Firefox | ❌ | ✅ |

不在 Chrome/Edge 上时，会自动显示手动输入框作为降级方案。

## 后续规划

- [ ] PWA 支持（可安装到手机桌面）
- [ ] 云端同步（多设备共享数据）
- [ ] 导出为 CSV/Excel
- [ ] 深色模式
