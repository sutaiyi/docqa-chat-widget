# DocQA Chat Widget

An embeddable AI-powered customer support widget. Add one line of code to any website — AI automatically learns your content and answers visitor questions 24/7.

[English](#features) | [中文](#中文)

## Features

- **One line of code** — Copy a `<script>` tag, done
- **Auto-learns website content** — AI crawls and understands your site automatically
- **RAG semantic search** — Retrieves only relevant content per question, 10x faster
- **Streaming responses** — Real-time token-by-token output, first word in 500ms
- **Smart sample questions** — AI generates contextual suggestions in 4 languages
- **Multi-language** — Auto-detects zh / en / ja / ko
- **Multi-platform** — Web, Android (WebView), iOS (WKWebView), HarmonyOS
- **Theme support** — Light / dark mode via `data-theme` attribute
- **Route exclusion** — Hide widget on specific pages via `data-exclude`
- **Shadow DOM** — Zero style conflicts with your site
- **Chat history** — Stored in browser IndexedDB, per-domain isolation
- **Markdown rendering** — Full GFM support (tables, code blocks, links)

## Quick Start

```html
<script
  src="https://widget.docqa.xyz/widget/chat-widget.js"
  data-base-url="https://yoursite.com"
  data-theme="dark"
></script>
```

That's it. A chat bubble appears on your website.

## Configuration

| Attribute | Description | Example |
|-----------|-------------|---------|
| `data-server` | Backend server URL (defaults to same origin) | `https://widget.docqa.xyz` |
| `data-base-url` | Site URL(s) to learn from. Comma-separated for multi-domain. | `https://a.com,https://b.com` |
| `data-theme` | Initial theme: `light` or `dark` | `dark` |
| `data-lang` | Force language: `zh` / `en` / `ja` / `ko` | `zh` |
| `data-logo` | Custom logo URL | `https://yoursite.com/logo.png` |
| `data-mode` | Set to `fullscreen` for mobile WebView | `fullscreen` |
| `data-exclude` | Routes to hide widget (comma-separated, `*` wildcard) | `/admin/*,/login` |

## Multi-Platform

### Web
```html
<script src="https://widget.docqa.xyz/widget/chat-widget.js" data-base-url="https://yoursite.com"></script>
```

### Android (WebView)
```kotlin
webView.loadUrl("https://widget.docqa.xyz/widget/mobile.html")
```

### iOS (WKWebView)
```swift
let url = URL(string: "https://widget.docqa.xyz/widget/mobile.html")!
webView.load(URLRequest(url: url))
```

### HarmonyOS
```typescript
Web({ src: 'https://widget.docqa.xyz/widget/mobile.html', controller: this.controller })
```

## Architecture

```
User clicks chat bubble
  → Widget sends question + history to /api/chat (SSE streaming)
  → Backend: RAG retrieves relevant chunks → AI generates answer
  → Tokens stream back to widget in real-time
```

- **Shadow DOM** isolates widget styles from host page
- **IndexedDB** stores chat history locally per domain
- **Server-Sent Events** for real-time streaming
- **RAG** (Retrieval-Augmented Generation) for fast, accurate answers

## Files

| File | Description |
|------|-------------|
| `chat-widget.js` | Main widget logic (Shadow DOM, streaming, i18n, sample questions) |
| `chat-widget.css` | Widget styles (themes, responsive, dark mode, typing animation) |
| `mobile.html` | Fullscreen mode for mobile WebView integration |

## Documentation

- [Full Documentation](https://docs.docqa.xyz)
- [API Reference](https://docs.docqa.xyz/en/api)
- [Quick Start Guide](https://docs.docqa.xyz/en/quickstart)

## License

[Apache License 2.0](LICENSE)

---

## 中文

一行代码为任何网站添加 AI 智能客服。AI 自动学习网站内容，7×24 全天候为访客提供专业解答。

### 快速开始

```html
<script
  src="https://widget.docqa.xyz/widget/chat-widget.js"
  data-base-url="https://yoursite.com"
  data-theme="dark"
></script>
```

### 主要特性

- 一行代码接入，零配置
- RAG 语义检索，响应速度提升 10 倍
- 流式输出，500ms 内看到第一个字
- AI 生成推荐问题，四种语言自动缓存
- 多平台：Web / Android / iOS / 鸿蒙
- 暗色/亮色主题，`data-theme` 属性配置
- 路由排除，`data-exclude` 指定隐藏页面
- 多域名抓取，`data-base-url` 逗号分隔
- Shadow DOM 样式隔离，不影响宿主页面
- 对话历史存储在浏览器 IndexedDB

### 配置属性

| 属性 | 说明 | 示例 |
|------|------|------|
| `data-server` | 后端地址（默认同域） | `https://widget.docqa.xyz` |
| `data-base-url` | 网站 URL（逗号分隔多个） | `https://a.com,https://b.com` |
| `data-theme` | 主题：`light` / `dark` | `dark` |
| `data-lang` | 语言：`zh` / `en` / `ja` / `ko` | `zh` |
| `data-logo` | 自定义 Logo | `https://yoursite.com/logo.png` |
| `data-mode` | 全屏模式（移动端） | `fullscreen` |
| `data-exclude` | 隐藏客服的路由 | `/admin/*,/login` |

### 文档

- [完整文档](https://docs.docqa.xyz)
- [API 参考](https://docs.docqa.xyz/zh/api)
- [快速开始](https://docs.docqa.xyz/zh/quickstart)

### 开源协议

[Apache License 2.0](LICENSE)
