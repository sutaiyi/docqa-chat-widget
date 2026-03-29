# DocQA – Free AI Customer Support Chatbot Widget

> Free, open-source AI chatbot widget for websites. One line of code adds 24/7 AI customer service to any site. Powered by RAG (Retrieval-Augmented Generation).

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Website](https://img.shields.io/badge/website-docqa.xyz-blue)](https://docqa.xyz)

**[Official Website](https://docqa.xyz)** | **[Documentation](https://docs.docqa.xyz)** | **[Live Demo](https://docqa.xyz)** | [English](#features) | [中文](#中文)

## Why DocQA?

- **100% Free tier** — No credit card, no trial period, free forever
- **Zero training needed** — AI auto-learns your website content via RAG
- **One line of code** — Copy a `<script>` tag and you're done
- **Self-hosted option** — Run on your own server, full control

## Features

- **AI Chatbot** — Intelligent customer service powered by large language models
- **RAG Semantic Search** — Retrieves only relevant content per question, 10x faster than full-text
- **Streaming Responses** — Real-time token-by-token output, first word in 500ms
- **Multi-language** — Auto-detects Chinese, English, Japanese, Korean (zh/en/ja/ko)
- **Smart Suggestions** — AI generates contextual sample questions in 4 languages
- **Theme Support** — Light / dark mode, configurable via `data-theme`
- **Multi-platform** — Web, Android (WebView), iOS (WKWebView)
- **Shadow DOM** — Zero CSS conflicts with your existing site styles
- **Chat History** — Stored locally in browser IndexedDB, per-domain isolation
- **Markdown** — Full GFM support (tables, code blocks, syntax highlighting)
- **Route Exclusion** — Hide widget on specific pages via `data-exclude`
- **Privacy First** — No conversation data stored on server, all chat history stays in user's browser

## Quick Start

```html
<script
  src="https://widget.docqa.xyz/widget/chat-widget.js"
  data-base-url="https://yoursite.com"
  data-theme="dark"
></script>
```

That's it. A chat bubble appears on your website with AI-powered customer support.

## Configuration

| Attribute | Description | Example |
|-----------|-------------|---------|
| `data-server` | Backend API URL (defaults to widget origin) | `https://widget.docqa.xyz` |
| `data-base-url` | Website URL(s) for AI to learn. Comma-separated for multi-domain. | `https://a.com,https://b.com` |
| `data-theme` | Theme: `light` or `dark` | `dark` |
| `data-lang` | Force language: `zh` / `en` / `ja` / `ko` | `en` |
| `data-logo` | Custom logo URL | `https://yoursite.com/logo.png` |
| `data-mode` | Set to `fullscreen` for mobile WebView | `fullscreen` |
| `data-exclude` | Routes to hide widget (comma-separated, `*` wildcard) | `/admin/*,/login` |

## Use Cases

- **SaaS websites** — Instant AI support for your product docs
- **E-commerce** — Answer product questions, shipping info, return policies
- **Documentation sites** — AI-powered search across your docs
- **Landing pages** — Convert visitors with instant AI responses
- **Blogs & portfolios** — Engage visitors with intelligent Q&A

## Multi-Platform Integration

### Web (Any website)
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

## How It Works (RAG Architecture)

```
User asks a question
  → Widget sends question + history to /api/chat (SSE streaming)
  → Backend: RAG retrieves relevant content chunks from your website
  → AI generates accurate answer based on retrieved context
  → Tokens stream back to widget in real-time
```

**Key technologies:**
- **RAG** (Retrieval-Augmented Generation) for accurate, grounded answers
- **Shadow DOM** for style isolation
- **IndexedDB** for local chat history storage
- **Server-Sent Events (SSE)** for real-time streaming
- **Embedding-based semantic search** for intelligent content retrieval

## Comparison with Alternatives

| Feature | DocQA | Intercom | Drift | Tidio |
|---------|-------|----------|-------|-------|
| Free tier | Forever free | 14-day trial | Limited | Limited |
| AI auto-learns site | Yes | No | No | No |
| RAG search | Yes | No | No | No |
| Self-hosted | Yes | No | No | No |
| Open source | Yes | No | No | No |
| One-line setup | Yes | No | No | No |

## Files

| File | Description |
|------|-------------|
| `chat-widget.js` | Main widget (Shadow DOM, streaming, i18n, RAG, sample questions) |
| `chat-widget.css` | Styles (themes, responsive, dark mode, typing animation) |
| `mobile.html` | Fullscreen mode for mobile WebView integration |

## Links

- [Official Website](https://docqa.xyz) — Product overview, pricing, live demo
- [Full Documentation](https://docs.docqa.xyz) — Integration guides, API reference
- [Quick Start Guide](https://docs.docqa.xyz/en/quickstart)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

[Apache License 2.0](LICENSE) — Free for commercial and personal use.

---

## 中文

### DocQA — 免费开源 AI 智能客服组件

> 免费、开源的 AI 客服系统。一行代码为任何网站添加 AI 智能客服，基于 RAG 语义检索，自动学习网站内容，7×24 全天候为访客提供专业解答。

### 为什么选择 DocQA？

- **完全免费** — 无需信用卡，无试用期限制，永久免费
- **零训练成本** — AI 通过 RAG 自动学习网站内容，无需人工上传文档
- **一行代码接入** — 复制一行 `<script>` 标签即可
- **可自部署** — 支持私有化部署，数据完全可控

### 主要特性

- AI 智能客服 — 大语言模型驱动的智能对话
- RAG 语义检索 — 精准提取相关内容，响应速度提升 10 倍
- 流式输出 — 实时逐字输出，500ms 内看到第一个字
- 多语言支持 — 自动识别中文、英文、日文、韩文
- AI 生成推荐问题 — 四种语言智能推荐
- 深浅主题 — 通过 `data-theme` 属性配置
- 多平台 — Web / Android / iOS
- Shadow DOM 样式隔离 — 不影响宿主页面
- 本地对话历史 — 存储在浏览器 IndexedDB
- 隐私安全 — 服务端不存储任何访客对话数据

### 快速开始

```html
<script
  src="https://widget.docqa.xyz/widget/chat-widget.js"
  data-base-url="https://yoursite.com"
  data-theme="dark"
></script>
```

### 适用场景

- **SaaS 产品** — 为产品文档提供即时 AI 客服
- **电商网站** — 回答商品、物流、退换货等问题
- **文档站点** — AI 驱动的智能文档搜索
- **企业官网** — 7×24 智能接待，提升转化率
- **个人博客** — 智能问答互动，提升访客体验

### 相关链接

- [官方网站](https://docqa.xyz) — 产品介绍、定价、在线体验
- [完整文档](https://docs.docqa.xyz) — 接入指南、API 参考
- [快速开始](https://docs.docqa.xyz/zh/quickstart)

### 开源协议

[Apache License 2.0](LICENSE) — 免费用于商业和个人项目。
