(function () {
	'use strict';

	// 支持 document.currentScript（同步加载）和动态注入（Streamlit 等场景）
	const scriptTag = document.currentScript || document.getElementById('docqa-widget-script') || document.querySelector('script[src*="chat-widget.js"]');
	// 脚本源域名（始终从 script src 推导，用于 CSS 等静态资源）
	const SCRIPT_ORIGIN = (() => {
		if (scriptTag && scriptTag.src) {
			try { return new URL(scriptTag.src).origin; } catch (e) {}
		}
		return window.location.origin;
	})();
	// API 服务地址（可通过 data-server 覆盖，默认跟脚本同域）
	const SERVER = (scriptTag && scriptTag.getAttribute('data-server')) || SCRIPT_ORIGIN;
	// data-base-url 支持逗号分隔多个 URL，第一个为主域名
	const BASE_URLS = ((scriptTag && scriptTag.getAttribute('data-base-url')) || window.location.origin)
		.split(',').map(function(u) { return u.trim().replace(/\/+$/, ''); }).filter(Boolean);
	const BASE_URL = BASE_URLS[0] || window.location.origin;
	const DOMAIN = (() => {
		try {
			return new URL(BASE_URL).hostname;
		} catch {
			return window.location.hostname;
		}
	})();
	// 所有配置的 URL（传给后端用于多域名抓取）
	const ALL_BASE_URLS = BASE_URLS.length > 1 ? BASE_URLS.join(',') : '';
	const SITE_LOGO = (() => {
		if (scriptTag && scriptTag.getAttribute('data-logo')) return scriptTag.getAttribute('data-logo');
		const link = document.querySelector('link[rel*="icon"]');
		if (link) return link.href;
		return window.location.origin + '/favicon.ico';
	})();

	// ============ 匿名访客 ID ============
	const VISITOR_ID = (() => {
		let id = localStorage.getItem('docqa-visitor-id');
		if (!id) {
			id = 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
			localStorage.setItem('docqa-visitor-id', id);
		}
		return id;
	})();

	// ============ i18n 多语言 ============
	const LANGS = {
		en: {
			headerTitle: 'AI Support',
			newChat: 'New Chat',
			newSession: '+ New Chat',
			inputPlaceholder: 'Type a message...',
			emptyState: 'How can I help you?',
			typing: 'Typing...',
			errorReply: 'Sorry, an error occurred. Please try again later.',
			noSessions: 'No chat history',
			historySessions: 'Chat History',
			themeToggle: 'Theme',
			historyBtn: 'History',
			settingsBtn: 'Settings',
			quotaTitle: 'Chat limit reached',
			quotaDesc: 'You have used {used} of {limit} chats this month.',
			quotaUpgrade: 'Upgrade Plan →',
			quotaDisabled: 'Chat limit reached. Upgrade to continue.',
			domainNotFoundTitle: 'Domain not configured',
			domainNotFoundDesc: 'This domain is not linked to an active account.',
			ragSyncLabel: 'Knowledge Base',
			ragSyncLoading: 'Loading...',
			ragSyncTime: 'Last updated: ',
			ragSyncPages: ' pages',
			ragSyncNone: 'Not synced yet',
			closeBtn: 'Close',
			sendBtn: 'Send',
			deleteBtn: 'Delete',
			loadingTitle: 'Preparing AI Assistant',
			loadingSubtitle: 'Learning website content for the first time.<br>This usually takes 1-2 minutes.',
			loadingInit: 'Initializing...',
			loadingStarting: 'Starting...',
			loadingLearning: (url, pages) => `Learning ${url} (${pages} pages indexed)`,
			loadingLearningGeneral: (pages) => `Learning website content... (${pages} pages indexed)`,
			loadingRetrying: (n, max) => `Retrying (attempt ${n}/${max})...`,
			loadingFailed: 'Failed to load website content. Please try again later.',
			loadingRetryBtn: 'Retry',
			loadingRetryText: 'Retrying...',
			deniedTitle: 'Unauthorized',
			deniedText: (domain) => `The domain <strong class="denied-domain">${domain}</strong> is not authorized to use this service.`,
			deniedCta: 'Get Started →',
			sampleQuestionsLoading: 'Loading suggestions...',
			humanAgentContact: 'Contact our support team:',
			humanAgentWaiting: 'Connecting to a human agent...',
			humanAgentQueue: (pos) => `Queue position: ${pos}`,
			humanAgentEstWait: (min) => `Estimated wait: ~${min} min`,
			humanAgentConnected: 'Human agent connected',
			humanAgentDisconnected: 'Agent disconnected',
			returnToAi: 'Return to AI',
			humanAgentNotified: 'Our team has been notified and will reach out to you shortly.',
			phone: 'Phone',
			email: 'Email',
			wechat: 'WeChat',
			telegram: 'Telegram',
			idleWarning: 'No messages for a while. Connection will close in 1 minute.',
			idleTimeout: 'Session closed due to inactivity.',
			keepAlive: 'Stay connected',
			switchToAi: 'Switch to AI',
			switchToHuman: 'Human Agent',
			modeAi: 'AI Support',
			modeHumanConnected: 'Human agent connected',
			modeHumanWaiting: 'Waiting for agent...',
			restoring: 'Restoring connection...',
			switchConfirm: 'You are in a live chat. Switching will disconnect. Continue?',
			ticketTitle: 'Submit a Ticket',
			ticketContact: 'Your contact (phone/email/WeChat)',
			ticketDesc: 'Describe your issue',
			ticketSubmit: 'Submit Ticket',
			ticketSubmitting: 'Submitting...',
			ticketSuccess: 'Ticket submitted! Our team will reach out to you shortly.',
			ticketError: 'Submission failed. Please try again.'
		},
		zh: {
			headerTitle: 'AI 智能客服',
			newChat: '新对话',
			newSession: '+ 新建对话',
			inputPlaceholder: '输入消息...',
			emptyState: '有什么可以帮您的？',
			typing: '正在输入...',
			errorReply: '抱歉，发生了错误，请稍后重试。',
			noSessions: '暂无历史会话',
			historySessions: '历史会话',
			themeToggle: '主题',
			historyBtn: '历史会话',
			settingsBtn: '设置',
			quotaTitle: '对话次数已用完',
			quotaDesc: '本月已使用 {used} / {limit} 次对话。',
			quotaUpgrade: '升级套餐 →',
			quotaDisabled: '对话次数已用完，升级套餐以继续使用。',
			domainNotFoundTitle: '域名未配置',
			domainNotFoundDesc: '此域名未关联到有效账户，请在控制台添加域名。',
			ragSyncLabel: '知识库',
			ragSyncLoading: '加载中...',
			ragSyncTime: '最近更新：',
			ragSyncPages: ' 个页面',
			ragSyncNone: '尚未同步',
			closeBtn: '关闭',
			sendBtn: '发送',
			deleteBtn: '删除',
			loadingTitle: '正在准备智能客服',
			loadingSubtitle: '首次使用需要学习网站内容<br>通常需要 1~2 分钟，请稍候',
			loadingInit: '正在初始化...',
			loadingStarting: '正在启动...',
			loadingLearning: (url, pages) => `正在学习 ${url}（已收录 ${pages} 页）`,
			loadingLearningGeneral: (pages) => `正在学习网站内容...（已收录 ${pages} 页）`,
			loadingRetrying: (n, max) => `正在重试（第 ${n}/${max} 次）...`,
			loadingFailed: '获取网站内容失败，请稍后再试',
			loadingRetryBtn: '重新尝试',
			loadingRetryText: '正在重新尝试...',
			deniedTitle: '未授权使用',
			deniedText: (domain) => `当前域名 <strong class="denied-domain">${domain}</strong> 未获得智能客服服务授权。`,
			deniedCta: '立即开通 →',
			sampleQuestionsLoading: '正在生成推荐问题...',
			humanAgentContact: '请通过以下方式联系客服：',
			humanAgentWaiting: '正在连接人工客服...',
			humanAgentQueue: (pos) => `排队位置：第 ${pos} 位`,
			humanAgentEstWait: (min) => `预计等待：约 ${min} 分钟`,
			humanAgentConnected: '人工客服已接入',
			humanAgentDisconnected: '客服已断开连接',
			returnToAi: '返回 AI 客服',
			humanAgentNotified: '我们已收到您的请求，客服将尽快与您联系。',
			phone: '电话',
			email: '邮箱',
			wechat: '微信',
			telegram: 'Telegram',
			idleWarning: '长时间未发送消息，连接将在 1 分钟后自动断开',
			idleTimeout: '会话因超时已自动断开',
			keepAlive: '继续会话',
			switchToAi: '切换到 AI',
			switchToHuman: '转人工',
			modeAi: 'AI 客服',
			modeHumanConnected: '人工客服已连接',
			modeHumanWaiting: '等待人工客服...',
			restoring: '正在恢复连接...',
			switchConfirm: '正在人工客服中，切换将断开连接，是否继续？',
			ticketTitle: '提交工单',
			ticketContact: '您的联系方式（手机/邮箱/微信）',
			ticketDesc: '请描述您的问题',
			ticketSubmit: '提交工单',
			ticketSubmitting: '提交中...',
			ticketSuccess: '工单已提交，客服将尽快通过您留下的联系方式与您联系。',
			ticketError: '提交失败，请稍后重试'
		},
		ja: {
			headerTitle: 'AI サポート',
			newChat: '新しい会話',
			newSession: '+ 新規チャット',
			inputPlaceholder: 'メッセージを入力...',
			emptyState: 'ご質問はありますか？',
			typing: '入力中...',
			errorReply: '申し訳ございません。エラーが発生しました。後ほどお試しください。',
			noSessions: '履歴がありません',
			historySessions: '会話履歴',
			themeToggle: 'テーマ',
			historyBtn: '履歴',
			settingsBtn: '設定',
			quotaTitle: 'チャット上限に達しました',
			quotaDesc: '今月 {used} / {limit} 回の会話を使用しました。',
			quotaUpgrade: 'プランをアップグレード →',
			quotaDisabled: 'チャット上限に達しました。アップグレードして続行してください。',
			domainNotFoundTitle: 'ドメイン未設定',
			domainNotFoundDesc: 'このドメインは有効なアカウントに関連付けられていません。',
			ragSyncLabel: 'ナレッジベース',
			ragSyncLoading: '読込中...',
			ragSyncTime: '最終更新：',
			ragSyncPages: ' ページ',
			ragSyncNone: '未同期',
			closeBtn: '閉じる',
			sendBtn: '送信',
			deleteBtn: '削除',
			loadingTitle: 'AIアシスタントを準備中',
			loadingSubtitle: '初回はサイト内容の学習が必要です。<br>通常1〜2分かかります。',
			loadingInit: '初期化中...',
			loadingStarting: '起動中...',
			loadingLearning: (url, pages) => `${url} を学習中（${pages}ページ取得済）`,
			loadingLearningGeneral: (pages) => `サイト内容を学習中...（${pages}ページ取得済）`,
			loadingRetrying: (n, max) => `リトライ中（${n}/${max}回目）...`,
			loadingFailed: 'サイト内容の取得に失敗しました。後ほどお試しください。',
			loadingRetryBtn: '再試行',
			loadingRetryText: '再試行中...',
			deniedTitle: '未認証',
			deniedText: (domain) => `ドメイン <strong class="denied-domain">${domain}</strong> はサービスの利用が許可されていません。`,
			deniedCta: '利用を開始 →',
			sampleQuestionsLoading: '提案を読み込み中...',
			humanAgentContact: 'サポートチームの連絡先：',
			humanAgentWaiting: 'オペレーターに接続中...',
			humanAgentQueue: (pos) => `待機位置：${pos}番目`,
			humanAgentEstWait: (min) => `推定待ち時間：約${min}分`,
			humanAgentConnected: 'オペレーターが接続しました',
			humanAgentDisconnected: 'オペレーターが切断しました',
			returnToAi: 'AIに戻る',
			humanAgentNotified: 'リクエストを受け付けました。担当者が間もなくご連絡いたします。',
			phone: '電話',
			email: 'メール',
			wechat: 'WeChat',
			telegram: 'Telegram',
			idleWarning: 'メッセージがありません。1分後に接続が切断されます。',
			idleTimeout: 'タイムアウトにより切断されました。',
			keepAlive: '接続を維持',
			switchToAi: 'AIに切替',
			switchToHuman: 'オペレーター',
			modeAi: 'AIサポート',
			modeHumanConnected: 'オペレーター接続中',
			modeHumanWaiting: 'オペレーター待機中...',
			restoring: '接続を復元中...',
			switchConfirm: 'ライブチャット中です。切替すると切断されます。続けますか？',
			ticketTitle: 'チケットを送信',
			ticketContact: '連絡先（電話/メール/WeChat）',
			ticketDesc: '問題の説明',
			ticketSubmit: 'チケットを送信',
			ticketSubmitting: '送信中...',
			ticketSuccess: 'チケットが送信されました。担当者が間もなくご連絡いたします。',
			ticketError: '送信に失敗しました。もう一度お試しください。'
		},
		ko: {
			headerTitle: 'AI 고객지원',
			newChat: '새 대화',
			newSession: '+ 새 대화',
			inputPlaceholder: '메시지를 입력하세요...',
			emptyState: '무엇을 도와드릴까요?',
			typing: '입력 중...',
			errorReply: '죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
			noSessions: '대화 기록이 없습니다',
			historySessions: '대화 기록',
			themeToggle: '테마',
			historyBtn: '기록',
			settingsBtn: '설정',
			quotaTitle: '대화 한도에 도달했습니다',
			quotaDesc: '이번 달 {used} / {limit} 대화를 사용했습니다.',
			quotaUpgrade: '플랜 업그레이드 →',
			quotaDisabled: '대화 한도에 도달했습니다. 업그레이드하여 계속하세요.',
			domainNotFoundTitle: '도메인 미설정',
			domainNotFoundDesc: '이 도메인은 활성 계정에 연결되어 있지 않습니다.',
			ragSyncLabel: '지식 베이스',
			ragSyncLoading: '로딩 중...',
			ragSyncTime: '최근 업데이트: ',
			ragSyncPages: ' 페이지',
			ragSyncNone: '아직 동기화되지 않음',
			closeBtn: '닫기',
			sendBtn: '전송',
			deleteBtn: '삭제',
			loadingTitle: 'AI 어시스턴트 준비 중',
			loadingSubtitle: '처음 사용 시 웹사이트 학습이 필요합니다.<br>보통 1~2분 소요됩니다.',
			loadingInit: '초기화 중...',
			loadingStarting: '시작 중...',
			loadingLearning: (url, pages) => `${url} 학습 중 (${pages}페이지 수집)`,
			loadingLearningGeneral: (pages) => `웹사이트 학습 중... (${pages}페이지 수집)`,
			loadingRetrying: (n, max) => `재시도 중 (${n}/${max}회)...`,
			loadingFailed: '웹사이트 콘텐츠를 불러오지 못했습니다. 나중에 다시 시도해주세요.',
			loadingRetryBtn: '다시 시도',
			loadingRetryText: '다시 시도 중...',
			deniedTitle: '미인증',
			deniedText: (domain) => `도메인 <strong class="denied-domain">${domain}</strong>은(는) 서비스 사용 권한이 없습니다.`,
			deniedCta: '시작하기 →',
			sampleQuestionsLoading: '추천 질문 로딩 중...',
			humanAgentContact: '고객지원 연락처:',
			humanAgentWaiting: '상담원에 연결 중...',
			humanAgentQueue: (pos) => `대기 위치: ${pos}번째`,
			humanAgentEstWait: (min) => `예상 대기 시간: 약 ${min}분`,
			humanAgentConnected: '상담원이 연결되었습니다',
			humanAgentDisconnected: '상담원이 연결을 종료했습니다',
			returnToAi: 'AI로 돌아가기',
			humanAgentNotified: '요청이 접수되었습니다. 곧 연락드리겠습니다.',
			phone: '전화',
			email: '이메일',
			wechat: 'WeChat',
			telegram: 'Telegram',
			idleWarning: '메시지가 없습니다. 1분 후 연결이 종료됩니다.',
			idleTimeout: '시간 초과로 세션이 종료되었습니다.',
			keepAlive: '연결 유지',
			switchToAi: 'AI로 전환',
			switchToHuman: '상담원 연결',
			modeAi: 'AI 지원',
			modeHumanConnected: '상담원 연결됨',
			modeHumanWaiting: '상담원 대기 중...',
			restoring: '연결 복원 중...',
			switchConfirm: '라이브 채팅 중입니다. 전환하면 연결이 끊어집니다. 계속하시겠습니까?',
			ticketTitle: '티켓 제출',
			ticketContact: '연락처 (전화/이메일/WeChat)',
			ticketDesc: '문제를 설명해 주세요',
			ticketSubmit: '티켓 제출',
			ticketSubmitting: '제출 중...',
			ticketSuccess: '티켓이 제출되었습니다. 곧 연락드리겠습니다.',
			ticketError: '제출에 실패했습니다. 다시 시도해 주세요.'
		}
	};

	// 检测语言：data-lang 属性 > <html lang> > navigator.language > 'en'
	function detectLang() {
		const attr = scriptTag && scriptTag.getAttribute('data-lang');
		const htmlLang = document.documentElement.lang;
		const raw = attr || htmlLang || navigator.language || 'en';
		const code = raw.toLowerCase().split('-')[0]; // 'zh-CN' → 'zh'
		return LANGS[code] ? code : 'en';
	}

	let LANG = detectLang();

	function t(key) {
		return LANGS[LANG][key];
	}

	// 监听 <html lang> 变化，自动切换 Widget 语言
	new MutationObserver(function() {
		var newLang = detectLang();
		if (newLang !== LANG) {
			LANG = newLang;
			// 刷新 Widget UI 文本
			var widget = document.querySelector('chat-widget');
			if (widget && widget.shadowRoot) {
				var title = widget.shadowRoot.querySelector('.chat-header-title');
				if (title) title.textContent = t('headerTitle');
				var textarea = widget.shadowRoot.querySelector('textarea');
				if (textarea) textarea.placeholder = t('inputPlaceholder');
			}
		}
	}).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

	// 示例问题缓存
	let _sampleQuestionsCache = null;

	async function fetchSampleQuestions() {
		if (_sampleQuestionsCache) return _sampleQuestionsCache;
		try {
			const res = await fetch(`${SERVER}/api/sample-questions?domain=${encodeURIComponent(DOMAIN)}&lang=${LANG}`);
			const data = await res.json();
			if (data.questions && data.questions.length > 0) {
				_sampleQuestionsCache = data.questions;
				return data.questions;
			}
		} catch {}
		return [];
	}

	function pickRandom(arr, count) {
		const shuffled = [...arr].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, count);
	}

	// 最多发送给后端的历史轮数
	const MAX_HISTORY_ROUNDS = 5;

	// ============ IndexedDB 存储层 ============
	const DB_NAME = 'chat-widget-db';
	const DB_VERSION = 1;

	function openDB() {
		return new Promise((resolve, reject) => {
			const req = indexedDB.open(DB_NAME, DB_VERSION);
			req.onupgradeneeded = () => {
				const db = req.result;
				if (!db.objectStoreNames.contains('sessions')) {
					const store = db.createObjectStore('sessions', { keyPath: 'id' });
					store.createIndex('domain', 'domain', { unique: false });
					store.createIndex('updatedAt', 'updatedAt', { unique: false });
				}
				if (!db.objectStoreNames.contains('messages')) {
					const store = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
					store.createIndex('sessionId', 'sessionId', { unique: false });
				}
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}

	const db = {
		async _db() {
			if (!this._inst) this._inst = await openDB();
			return this._inst;
		},

		async createSession() {
			const d = await this._db();
			const session = {
				id: crypto.randomUUID().slice(0, 12),
				title: t('newChat'),
				domain: DOMAIN,
				createdAt: Date.now(),
				updatedAt: Date.now()
			};
			return new Promise((resolve, reject) => {
				const tx = d.transaction('sessions', 'readwrite');
				tx.objectStore('sessions').add(session);
				tx.oncomplete = () => resolve(session);
				tx.onerror = () => reject(tx.error);
			});
		},

		async updateSessionTitle(id, title) {
			const d = await this._db();
			return new Promise((resolve, reject) => {
				const tx = d.transaction('sessions', 'readwrite');
				const store = tx.objectStore('sessions');
				const req = store.get(id);
				req.onsuccess = () => {
					const s = req.result;
					if (s) {
						s.title = title;
						s.updatedAt = Date.now();
						store.put(s);
					}
				};
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		},

		async listSessions() {
			const d = await this._db();
			return new Promise((resolve, reject) => {
				const tx = d.transaction('sessions', 'readonly');
				const store = tx.objectStore('sessions');
				const idx = store.index('domain');
				const req = idx.getAll(DOMAIN);
				req.onsuccess = () => {
					const list = req.result.sort((a, b) => b.updatedAt - a.updatedAt);
					resolve(list);
				};
				req.onerror = () => reject(req.error);
			});
		},

		async deleteSession(id) {
			const d = await this._db();
			return new Promise((resolve, reject) => {
				const tx = d.transaction(['sessions', 'messages'], 'readwrite');
				tx.objectStore('sessions').delete(id);
				// 删除该会话的所有消息
				const msgStore = tx.objectStore('messages');
				const idx = msgStore.index('sessionId');
				const cursor = idx.openCursor(id);
				cursor.onsuccess = () => {
					const c = cursor.result;
					if (c) {
						c.delete();
						c.continue();
					}
				};
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		},

		async addMessage(sessionId, role, content) {
			const d = await this._db();
			const msg = { sessionId, role, content, createdAt: Date.now() };
			return new Promise((resolve, reject) => {
				const tx = d.transaction(['messages', 'sessions'], 'readwrite');
				tx.objectStore('messages').add(msg);
				// 更新 session 的 updatedAt
				const sStore = tx.objectStore('sessions');
				const sReq = sStore.get(sessionId);
				sReq.onsuccess = () => {
					const s = sReq.result;
					if (s) {
						s.updatedAt = Date.now();
						sStore.put(s);
					}
				};
				tx.oncomplete = () => resolve(msg);
				tx.onerror = () => reject(tx.error);
			});
		},

		async getMessages(sessionId) {
			const d = await this._db();
			return new Promise((resolve, reject) => {
				const tx = d.transaction('messages', 'readonly');
				const idx = tx.objectStore('messages').index('sessionId');
				const req = idx.getAll(sessionId);
				req.onsuccess = () => {
					const list = req.result.sort((a, b) => a.createdAt - b.createdAt);
					resolve(list);
				};
				req.onerror = () => reject(req.error);
			});
		},

		async getRecentHistory(sessionId) {
			const msgs = await this.getMessages(sessionId);
			const maxMsgs = MAX_HISTORY_ROUNDS * 2;
			const trimmed = msgs.length > maxMsgs ? msgs.slice(-maxMsgs) : msgs;
			return trimmed.map((m) => ({ role: m.role, content: m.content }));
		}
	};

	// ============ 服务端 API ============
	const api = {
		async verifyDomain() {
			const res = await fetch(`${SERVER}/api/verify-domain?domain=${encodeURIComponent(DOMAIN)}`);
			return res.json();
		},
		async chat(message, history) {
			const res = await fetch(`${SERVER}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message, history, domain: DOMAIN, extra_urls: ALL_BASE_URLS, stream: false, visitor_id: VISITOR_ID })
			});
			return res.json();
		},
		chatStream(message, history) {
			return fetch(`${SERVER}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message, history, domain: DOMAIN, extra_urls: ALL_BASE_URLS, stream: true, visitor_id: VISITOR_ID })
			});
		},
		async cacheStatus(retry = false) {
			const eu = ALL_BASE_URLS ? `&extra_urls=${encodeURIComponent(ALL_BASE_URLS)}` : '';
			const params = `domain=${encodeURIComponent(DOMAIN)}${retry ? '&retry=true' : ''}${eu}`;
			const res = await fetch(`${SERVER}/api/cache-status?${params}`);
			return res.json();
		},
		async getHumanAgentConfig() {
			try {
				const res = await fetch(`${SERVER}/api/human-agent-config?domain=${encodeURIComponent(DOMAIN)}`);
				return res.json();
			} catch { return { mode: 'disabled' }; }
		},
		async requestHumanAgent(visitorName, visitorInfo) {
			try {
				const res = await fetch(`${SERVER}/api/human-agent-request`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ domain: DOMAIN, visitor_id: VISITOR_ID, visitor_name: visitorName || '', visitor_info: visitorInfo || '' })
				});
				return res.json();
			} catch { return { error: 'network_error' }; }
		},
		async submitTicket(contact, description) {
			try {
				const res = await fetch(`${SERVER}/api/submit-ticket`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ domain: DOMAIN, visitor_id: VISITOR_ID, contact, description })
				});
				return res.json();
			} catch { return { error: 'network_error' }; }
		}
	};

	// ============ 人工客服关键词检测 ============
	const HUMAN_AGENT_TRIGGERS = ['人工', '人工客服', '转人工', 'human', 'human agent', 'talk to human', 'talk to agent', 'real person', 'オペレーター', '人間', '상담원', '상담사'];

	// ============ 加载 marked.js ============
	let _markedReady = null;

	function loadMarked() {
		if (_markedReady) return _markedReady;
		_markedReady = new Promise((resolve) => {
			if (window.marked) return resolve();
			const s = document.createElement('script');
			s.src = 'https://cdn.jsdelivr.net/npm/marked@15/marked.min.js';
			s.onload = () => resolve();
			document.head.appendChild(s);
		});
		return _markedReady;
	}

	loadMarked();

	// ============ Markdown 渲染 ============
	function renderMarkdown(text) {
		if (!window.marked) {
			return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
		}
		const renderer = new marked.Renderer();
		renderer.link = function ({ href, title, text }) {
			const fullHref = href.startsWith('/') ? `${BASE_URL}${href}` : href;
			const titleAttr = title ? ` title="${title}"` : '';
			return `<a href="${fullHref}" target="_blank" rel="noopener"${titleAttr}>${text}</a>`;
		};
		return marked.parse(text, { renderer, breaks: true, gfm: true });
	}

	const URL_RE = /https?:\/\/[^\s<，。；！？、）》\]]+/g;

	function linkifyTextNodes(container) {
		const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
		const textNodes = [];
		while (walker.nextNode()) textNodes.push(walker.currentNode);
		for (const node of textNodes) {
			if (node.parentElement.closest('a, code, pre')) continue;
			const text = node.textContent;
			if (!URL_RE.test(text)) continue;
			URL_RE.lastIndex = 0;
			const frag = document.createDocumentFragment();
			let lastIdx = 0;
			let match;
			while ((match = URL_RE.exec(text))) {
				let url = match[0].replace(/[.)'"]+$/, '');
				if (match.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
				const a = document.createElement('a');
				a.href = url;
				a.target = '_blank';
				a.rel = 'noopener';
				a.textContent = url;
				frag.appendChild(a);
				lastIdx = match.index + url.length;
				URL_RE.lastIndex = lastIdx;
			}
			if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
			node.parentNode.replaceChild(frag, node);
		}
	}

	// ============ Widget 类 ============
	class ChatWidget extends HTMLElement {
		constructor() {
			super();
			this.attachShadow({ mode: 'open' });
			this.currentSessionId = null;
			this.sending = false;
			this._pollTimer = null;
		}

		connectedCallback() {
			this._fullscreen = scriptTag && scriptTag.getAttribute('data-mode') === 'fullscreen';
			this._loadCSS();
			this._buildDOM();
			this._bindEvents();
			// 主题优先级：script data-theme 属性 > localStorage > 默认 light
			const attrTheme = scriptTag && scriptTag.getAttribute('data-theme');
			if (attrTheme === 'dark') {
				this.classList.add('dark');
			} else if (attrTheme === 'light') {
				this.classList.remove('dark');
			} else if (localStorage.getItem('chat-widget-theme') === 'dark') {
				this.classList.add('dark');
			}
			if (this._fullscreen) {
				this.$.fab.classList.add('hidden');
				this.$.win.classList.remove('hidden');
				this.$.win.classList.add('fullscreen');
				const closeBtn = this.shadowRoot.querySelector('.btn-close');
				if (closeBtn) closeBtn.style.display = 'none';
				this._open();
			}

		}

		_applyLogoPolicy(customLogo) {
			if (customLogo !== false) return; // 付费用户不限制
			// 免费用户：强制使用平台 Logo（从站点配置的主域名拿）
			var siteBase = this._siteUrl || 'https://docqa.xyz';
			var platformLogo = siteBase.replace(/\/+$/, '') + '/favicon.svg';
			var headerLogo = this.shadowRoot.querySelector('.header-logo');
			if (headerLogo) { headerLogo.src = platformLogo; headerLogo.style.display = ''; }
			var loadingLogo = this.shadowRoot.querySelector('.loading-logo');
			if (loadingLogo) { loadingLogo.src = platformLogo; loadingLogo.style.display = ''; }
		}

		async _loadCSS() {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = `${SCRIPT_ORIGIN}/widget/chat-widget.css`;
			this.shadowRoot.prepend(link);
		}

		_buildDOM() {
			const wrap = document.createElement('div');
			const _siteUrl = 'https://docqa.xyz'; // 默认值，运行时由 _siteUrl 覆盖
			wrap.innerHTML = `
				<button class="chat-fab" aria-label="${t('headerTitle')}">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
					</svg>
				</button>
				<div class="chat-window hidden">
					<div class="chat-header">
						<img class="header-logo" src="${SITE_LOGO}" alt="" onerror="this.style.display='none'">
						<span class="chat-header-title">${t('headerTitle')}</span>
						<button class="btn-history" title="${t('historyBtn')}">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
						</button>
						<button class="btn-settings" title="${t('settingsBtn') || 'Settings'}">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
						</button>
						<button class="btn-close" title="${t('closeBtn')}">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>
					<div class="loading-view hidden">
						<div class="loading-logo-wrap">
							<img class="loading-logo" src="${SITE_LOGO}" alt="" onerror="this.style.display='none'">
						</div>
						<div class="loading-title">${t('loadingTitle')}</div>
						<div class="loading-subtitle">${t('loadingSubtitle')}</div>
						<div class="loading-progress">
							<div class="loading-bar"><div class="loading-bar-fill"></div></div>
							<div class="loading-status">${t('loadingInit')}</div>
						</div>
						<div class="loading-error hidden"></div>
						<button class="loading-retry-btn hidden">${t('loadingRetryBtn')}</button>
					</div>
					<div class="denied-view hidden">
						<div class="denied-icon">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
						</div>
						<div class="denied-title">${t('deniedTitle')}</div>
						<div class="denied-text">${t('deniedText')(DOMAIN)}</div>
						<a class="denied-cta-btn" href="${_siteUrl}" target="_blank" rel="noopener">${t('deniedCta')}</a>
						<a class="powered-by" href="https://docqa.xyz" target="_blank" rel="noopener">
							<svg width="14" height="14" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#3b82f6"/><path d="M12 13h16a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4-4-4h-4a2 2 0 01-2-2v-8a2 2 0 012-2z" fill="rgba(255,255,255,.95)"/></svg>
							<span>Powered by DocQA</span>
						</a>
					</div>
					<div class="mode-bar hidden">
						<span class="mode-dot"></span>
						<span class="mode-label"></span>
						<button class="mode-switch-btn"></button>
					</div>
					<div class="chat-body">
						<div class="chat-messages">
							<div class="empty-state">
								<div class="icon">
									<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
								</div>
								<div class="empty-state-text">${t('emptyState')}</div>
							</div>
						</div>
						<div class="chat-input-area">
							<textarea rows="1" placeholder="${t('inputPlaceholder')}"></textarea>
							<button class="send-btn" title="${t('sendBtn')}">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
							</button>
						</div>
						<a class="powered-by" href="https://docqa.xyz" target="_blank" rel="noopener">
							<svg width="14" height="14" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#3b82f6"/><path d="M12 13h16a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4-4-4h-4a2 2 0 01-2-2v-8a2 2 0 012-2z" fill="rgba(255,255,255,.95)"/></svg>
							<span>Powered by DocQA</span>
						</a>
					</div>
					<div class="chat-sidebar hidden">
						<div class="sidebar-header">
							<span>${t('historySessions')}</span>
							<button class="btn-sidebar-close" title="${t('closeBtn')}">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							</button>
						</div>
						<button class="new-chat-btn">${t('newSession')}</button>
						<div class="session-list"></div>
					</div>
					<div class="chat-settings hidden">
						<div class="sidebar-header">
							<span>${t('settingsBtn') || 'Settings'}</span>
							<button class="btn-settings-close" title="${t('closeBtn')}">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							</button>
						</div>
						<div class="settings-section settings-theme">
							<div class="settings-label">${t('themeToggle')}</div>
							<div class="settings-theme-row">
								<button class="settings-theme-btn" data-theme="light">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
									<span>Light</span>
								</button>
								<button class="settings-theme-btn" data-theme="dark">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
									<span>Dark</span>
								</button>
							</div>
						</div>
						<div class="settings-section">
							<div class="settings-label">${t('ragSyncLabel')}</div>
							<div class="settings-rag-info">
								<div class="rag-status-row">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
									<span class="rag-updated-time">-</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			`;
			this.shadowRoot.appendChild(wrap);

			this.$ = {
				fab: this.shadowRoot.querySelector('.chat-fab'),
				win: this.shadowRoot.querySelector('.chat-window'),
				loadingView: this.shadowRoot.querySelector('.loading-view'),
				deniedView: this.shadowRoot.querySelector('.denied-view'),
				modeBar: this.shadowRoot.querySelector('.mode-bar'),
				chatBody: this.shadowRoot.querySelector('.chat-body'),
				messages: this.shadowRoot.querySelector('.chat-messages'),
				textarea: this.shadowRoot.querySelector('textarea'),
				sendBtn: this.shadowRoot.querySelector('.send-btn'),
				sidebar: this.shadowRoot.querySelector('.chat-sidebar'),
				sessionList: this.shadowRoot.querySelector('.session-list'),
				loadingBarFill: this.shadowRoot.querySelector('.loading-bar-fill'),
				loadingStatus: this.shadowRoot.querySelector('.loading-status'),
				loadingError: this.shadowRoot.querySelector('.loading-error'),
				loadingRetryBtn: this.shadowRoot.querySelector('.loading-retry-btn'),
				loadingProgress: this.shadowRoot.querySelector('.loading-progress'),
				settingsPanel: this.shadowRoot.querySelector('.chat-settings')
			};
		}

		_bindEvents() {
			const $ = this.$;
			$.fab.onclick = () => this._open();
			this.shadowRoot.querySelector('.btn-close').onclick = () => this._close();
			this.shadowRoot.querySelector('.btn-history').onclick = () => this._showSidebar();
			this.shadowRoot.querySelector('.btn-settings').onclick = () => this._showSettings();
			this.shadowRoot.querySelector('.btn-sidebar-close').onclick = () => $.sidebar.classList.add('hidden');
			this.shadowRoot.querySelector('.btn-settings-close').onclick = () => $.settingsPanel.classList.add('hidden');
			this.shadowRoot.querySelector('.new-chat-btn').onclick = () => this._prepareNewChat();

			// 设置面板 — 主题切换
			var _this = this;
			this.shadowRoot.querySelectorAll('.settings-theme-btn').forEach(function(btn) {
				btn.onclick = function() {
					var theme = this.getAttribute('data-theme');
					if (theme === 'dark') {
						_this.classList.add('dark');
					} else {
						_this.classList.remove('dark');
					}
					localStorage.setItem('chat-widget-theme', theme);
					_this._updateThemeButtons();
				};
			});

			$.loadingRetryBtn.onclick = async () => {
				$.loadingError.classList.add('hidden');
				$.loadingRetryBtn.classList.add('hidden');
				$.loadingProgress.classList.remove('hidden');
				$.loadingBarFill.style.width = '5%';
				$.loadingStatus.textContent = t('loadingRetryText');
				await api.cacheStatus(true);
				this._startPolling();
			};

			$.sendBtn.onclick = () => this._send();
			$.textarea.onkeydown = (e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					this._send();
				}
			};
			$.textarea.oninput = () => {
				$.textarea.style.height = 'auto';
				$.textarea.style.height = Math.min($.textarea.scrollHeight, 80) + 'px';
			};
		}

		async _open() {
			if (!this._fullscreen) {
				this.$.fab.classList.add('hidden');
				this.$.win.classList.remove('hidden');
			}

			// 先验证域名白名单
			try {
				const verify = await api.verifyDomain();
				if (!verify.allowed) {
					this._showDeniedView();
					return;
				}
			} catch {
				// 网络错误跳过验证（可能是开发模式）
			}

			// 检查缓存是否就绪 + 配额
			try {
				const status = await api.cacheStatus();
				// 记录官网地址 + 主题权限
				if (status.siteUrl) this._siteUrl = status.siteUrl;
				this._applyThemePolicy(status.themeSwitch);
				this._applyLogoPolicy(status.customLogo);
				if (status.status === 'denied') {
					this._showDeniedView();
				} else if (status.quotaExceeded) {
					// 配额已超限，显示聊天界面但禁用输入
					this._showChatView();
					this._disableForQuota(status.monthlyChats, status.chatLimit);
				} else if (status.ready) {
					this._showChatView();
				} else {
					this._showLoadingView();
					this._startPolling();
				}
			} catch {
				this._showChatView();
			}
		}

		_disableForQuota(used, limit) {
			// 隐藏聊天消息区和输入区，显示居中的超限提示
			this.$.messages.innerHTML = '';
			var wrap = document.createElement('div');
			wrap.className = 'quota-exceeded-wrap';
			wrap.innerHTML = '<div class="quota-exceeded">' +
				'<div class="quota-icon">⚠️</div>' +
				'<div class="quota-title">' + t('quotaTitle') + '</div>' +
				'<div class="quota-desc">' + t('quotaDesc').replace('{used}', String(used || 0)).replace('{limit}', String(limit || 0)) + '</div>' +
				'<a class="quota-upgrade" href="' + (this._siteUrl || 'https://docqa.xyz') + '/dashboard/upgrade" target="_blank">' + t('quotaUpgrade') + '</a>' +
			'</div>';
			this.$.messages.appendChild(wrap);
			// 禁用输入
			this.$.textarea.disabled = true;
			this.$.textarea.placeholder = t('quotaDisabled');
			this.$.sendBtn.disabled = true;
		}

		_applyThemePolicy(themeSwitch) {
			if (themeSwitch === true) return; // 付费用户不限制
			// 免费用户：强制 light 主题，隐藏主题切换按钮
			this.classList.remove('dark');
			localStorage.setItem('chat-widget-theme', 'light');
			var themeSection = this.shadowRoot.querySelector('.settings-theme');
			if (themeSection) themeSection.style.display = 'none';
		}

		_showDeniedView() {
			// 动态更新官网链接
			var ctaBtn = this.shadowRoot.querySelector('.denied-cta-btn');
			if (ctaBtn && this._siteUrl) ctaBtn.href = this._siteUrl;
			this.$.deniedView.classList.remove('hidden');
			this.$.loadingView.classList.add('hidden');
			this.$.chatBody.classList.add('hidden');
		}

		_showLoadingView() {
			this.$.deniedView.classList.add('hidden');
			this.$.loadingView.classList.remove('hidden');
			this.$.chatBody.classList.add('hidden');
		}

		_showChatView() {
			this.$.deniedView.classList.add('hidden');
			this.$.loadingView.classList.add('hidden');
			this.$.chatBody.classList.remove('hidden');
			if (!this.currentSessionId) this._prepareNewChat();
			this.$.textarea.focus();
			// 初始化人工客服模式栏 + 恢复断线会话
			this._initHumanAgentMode();
		}

		async _initHumanAgentMode() {
			if (this._haInitDone) return;
			this._haInitDone = true;
			try {
				this._haConfig = await api.getHumanAgentConfig();
			} catch { this._haConfig = null; }
			// 检查是否有未结束的 live chat session 需要恢复
			try {
				const savedSession = sessionStorage.getItem('docqa-live-session');
				if (savedSession && this._haConfig && this._haConfig.mode === 'live_chat') {
					const statusRes = await fetch(`${SERVER}/api/live-chat-status?session_id=${encodeURIComponent(savedSession)}`).then(r => r.json());
					if (statusRes.status === 'pending' || statusRes.status === 'active') {
						// 恢复连接
						this._liveChatActive = true;
						this._liveChatSessionId = savedSession;
						const div = document.createElement('div');
						div.className = 'msg assistant ha-status';
						div.textContent = t('restoring');
						this.$.messages.appendChild(div);
						this._connectLiveChat(savedSession);
						return;
					} else {
						sessionStorage.removeItem('docqa-live-session');
					}
				}
			} catch {}
			this._updateModeBar();
		}

		_startPolling() {
			if (this._pollTimer) return;
			this._pollTimer = setInterval(async () => {
				try {
					const status = await api.cacheStatus();
					this._updateLoadingProgress(status);
					if (status.ready) {
						this._stopPolling();
						this._showChatView();
					}
				} catch {}
			}, 2000);
		}

		_stopPolling() {
			if (this._pollTimer) {
				clearInterval(this._pollTimer);
				this._pollTimer = null;
			}
		}

		_updateLoadingProgress(status) {
			const $ = this.$;
			if (status.status === 'crawling') {
				$.loadingProgress.classList.remove('hidden');
				$.loadingError.classList.add('hidden');
				$.loadingRetryBtn.classList.add('hidden');
				const total = status.total_urls || 1;
				const completed = status.completed_urls || 0;
				const pages = status.page_count || 0;
				const pct = Math.min((completed / total) * 80 + (pages > 0 ? 15 : 0), 95);
				$.loadingBarFill.style.width = pct + '%';
				if (status.current_url) {
					$.loadingStatus.textContent = t('loadingLearning')(status.current_url.replace(/^https?:\/\//, ''), pages);
				} else {
					$.loadingStatus.textContent = t('loadingLearningGeneral')(pages);
				}
			} else if (status.status === 'retrying') {
				$.loadingBarFill.style.width = '10%';
				$.loadingStatus.textContent = t('loadingRetrying')(status.retry, status.max_retries);
			} else if (status.status === 'failed') {
				this._stopPolling();
				$.loadingProgress.classList.add('hidden');
				$.loadingError.classList.remove('hidden');
				$.loadingError.textContent = t('loadingFailed');
				$.loadingRetryBtn.classList.remove('hidden');
			} else if (status.status === 'pending') {
				$.loadingBarFill.style.width = '5%';
				$.loadingStatus.textContent = t('loadingStarting');
			}
		}

		_close() {
			if (this._fullscreen) return;
			this.$.win.classList.add('hidden');
			this.$.fab.classList.remove('hidden');
			this._stopPolling();
		}

		_prepareNewChat() {
			if (this._liveChatActive) {
				if (!confirm(t('switchConfirm'))) return;
				this._returnToAi();
			}
			this.currentSessionId = null;
			this.$.sidebar.classList.add('hidden');
			this._clearMessages();
		}

		_clearMessages() {
			this.$.messages.innerHTML = `
				<div class="empty-state">
					<div class="icon">
						<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					</div>
					<div>${t('emptyState')}</div>
					<div class="sample-questions"><div class="sample-loading">${t('sampleQuestionsLoading')}</div></div>
				</div>
			`;
			this._loadSampleQuestions();
		}

		async _loadSampleQuestions() {
			const container = this.$.messages.querySelector('.sample-questions');
			if (!container) return;

			const allQuestions = await fetchSampleQuestions();
			// 可能用户已经开始聊天了，container 已被移除
			if (!this.$.messages.querySelector('.sample-questions')) return;

			if (allQuestions.length === 0) {
				container.innerHTML = '';
				return;
			}

			const picked = pickRandom(allQuestions, 3);
			container.innerHTML = picked.map(q =>
				`<button class="sample-question">${q}</button>`
			).join('');

			container.querySelectorAll('.sample-question').forEach(btn => {
				btn.onclick = () => {
					this.$.textarea.value = btn.textContent;
					this._send();
				};
			});
		}

		_appendMsg(role, content) {
			const empty = this.$.messages.querySelector('.empty-state');
			if (empty) empty.remove();
			const div = document.createElement('div');
			// agent 角色（人工客服）复用 assistant 样式，加标记
			const cssRole = role === 'agent' ? 'assistant' : role;
			div.className = `msg ${cssRole}`;
			if (role === 'agent') {
				// 人工客服消息：纯文本 + 标记
				div.innerHTML = `<div class="ha-agent-tag">👤</div>${this._esc(content)}`;
			} else if (role === 'assistant') {
				loadMarked().then(() => {
					div.innerHTML = renderMarkdown(content);
					linkifyTextNodes(div);
					this.$.messages.scrollTop = this.$.messages.scrollHeight;
				});
				div.textContent = content;
			} else {
				div.textContent = content;
			}
			this.$.messages.appendChild(div);
			this.$.messages.scrollTop = this.$.messages.scrollHeight;
			return div;
		}

		async _handleHumanAgentTrigger(config) {
			try {
				if (!config || config.mode === 'disabled') return;

				// 确保有本地会话（用于存储人工客服消息到历史）
				if (!this.currentSessionId) {
					const session = await db.createSession();
					this.currentSessionId = session.id;
					await db.updateSessionTitle(session.id, t('humanAgentConnected'));
				}

				if (config.mode === 'ticket') {
					this._showTicketForm();
					return;
				}

				// 通知后端有人请求人工客服（contact_info / live_chat）
				const result = await api.requestHumanAgent('', JSON.stringify({ page: window.location.href, lang: LANG }));

				if (config.mode === 'contact_info' && config.contacts) {
					// 联系方式模式：展示联系方式卡片
					const c = config.contacts;
					const items = [];
					if (c.phone) items.push(`<div class="ha-contact-item"><span class="ha-icon">📞</span><span class="ha-label">${t('phone')}</span><a href="tel:${c.phone}">${c.phone}</a></div>`);
					if (c.email) items.push(`<div class="ha-contact-item"><span class="ha-icon">📧</span><span class="ha-label">${t('email')}</span><a href="mailto:${c.email}">${c.email}</a></div>`);
					if (c.wechat) items.push(`<div class="ha-contact-item"><span class="ha-icon">💬</span><span class="ha-label">${t('wechat')}</span><span>${c.wechat}</span></div>`);
					if (c.telegram) items.push(`<div class="ha-contact-item"><span class="ha-icon">✈️</span><span class="ha-label">${t('telegram')}</span><a href="https://t.me/${c.telegram.replace('@','')}" target="_blank">${c.telegram}</a></div>`);

					const cardHtml = `<div class="ha-contact-card"><div class="ha-contact-title">${t('humanAgentContact')}</div>${items.join('')}<div class="ha-contact-note">${t('humanAgentNotified')}</div></div>`;
					const div = document.createElement('div');
					div.className = 'msg assistant';
					div.innerHTML = cardHtml;
					this.$.messages.appendChild(div);
					this.$.messages.scrollTop = this.$.messages.scrollHeight;
				} else if (config.mode === 'live_chat' && result && result.session_id) {
					// 在线客服模式：展示联系方式 + 排队等待
					this._liveChatActive = true;
					this._liveChatSessionId = result.session_id;
					const queuePos = result.queue_position || 1;
					const estWait = result.estimated_wait || 2;

					const queueText = typeof t('humanAgentQueue') === 'function' ? t('humanAgentQueue')(queuePos) : `#${queuePos}`;
					const waitText = typeof t('humanAgentEstWait') === 'function' ? t('humanAgentEstWait')(estWait) : `~${estWait} min`;

					// 联系方式卡片（如果有配置）
					let contactHtml = '';
					if (config.contacts) {
						const c = config.contacts;
						const items = [];
						if (c.phone) items.push(`<div class="ha-contact-item"><span class="ha-icon">📞</span><span class="ha-label">${t('phone')}</span><a href="tel:${c.phone}">${c.phone}</a></div>`);
						if (c.email) items.push(`<div class="ha-contact-item"><span class="ha-icon">📧</span><span class="ha-label">${t('email')}</span><a href="mailto:${c.email}">${c.email}</a></div>`);
						if (c.wechat) items.push(`<div class="ha-contact-item"><span class="ha-icon">💬</span><span class="ha-label">${t('wechat')}</span><span>${c.wechat}</span></div>`);
						if (c.telegram) items.push(`<div class="ha-contact-item"><span class="ha-icon">✈️</span><span class="ha-label">${t('telegram')}</span><a href="https://t.me/${c.telegram.replace('@','')}" target="_blank">${c.telegram}</a></div>`);
						if (items.length > 0) {
							contactHtml = `<div class="ha-contact-card" style="margin-bottom:12px"><div class="ha-contact-title">${t('humanAgentContact')}</div>${items.join('')}</div>`;
						}
					}

					const waitDiv = document.createElement('div');
					waitDiv.className = 'msg assistant ha-waiting';
					waitDiv.innerHTML = `${contactHtml}<div class="ha-waiting-content"><span class="typing-dots"><span></span><span></span><span></span></span> ${t('humanAgentWaiting')}</div><div class="ha-queue-info"><div>${queueText}</div><div>${waitText}</div></div>`;
					this.$.messages.appendChild(waitDiv);
					this.$.messages.scrollTop = this.$.messages.scrollHeight;

					// 启动 WebSocket 连接
					this._connectLiveChat(result.session_id);
				}
			} catch (err) {
				console.error('[DocQA] Human agent trigger error:', err);
				// 出错时在聊天中提示
				const div = document.createElement('div');
				div.className = 'msg assistant';
				div.textContent = t('errorReply');
				this.$.messages.appendChild(div);
				this.$.messages.scrollTop = this.$.messages.scrollHeight;
			}
		}

		_showTicketForm() {
			const div = document.createElement('div');
			div.className = 'msg assistant';
			div.innerHTML = `<div class="ha-ticket-form">
				<div class="ha-ticket-title">${t('ticketTitle')}</div>
				<input class="ha-ticket-input" type="text" placeholder="${t('ticketContact')}" />
				<textarea class="ha-ticket-textarea" placeholder="${t('ticketDesc')}" rows="3"></textarea>
				<button class="ha-ticket-btn">${t('ticketSubmit')}</button>
			</div>`;
			this.$.messages.appendChild(div);
			this.$.messages.scrollTop = this.$.messages.scrollHeight;

			const btn = div.querySelector('.ha-ticket-btn');
			const contactInput = div.querySelector('.ha-ticket-input');
			const descInput = div.querySelector('.ha-ticket-textarea');

			btn.onclick = async () => {
				const contact = contactInput.value.trim();
				const desc = descInput.value.trim();
				if (!contact || !desc) return;
				btn.textContent = t('ticketSubmitting');
				btn.disabled = true;
				const res = await api.submitTicket(contact, desc);
				if (res.ok) {
					div.innerHTML = `<div class="ha-ticket-form"><div class="ha-ticket-success">${t('ticketSuccess')}</div></div>`;
					// 存到历史
					if (this.currentSessionId) {
						await db.addMessage(this.currentSessionId, 'assistant', t('ticketSuccess'));
					}
				} else {
					btn.textContent = t('ticketSubmit');
					btn.disabled = false;
					const err = document.createElement('div');
					err.className = 'ha-ticket-error';
					err.textContent = t('ticketError');
					div.querySelector('.ha-ticket-form').appendChild(err);
					setTimeout(() => err.remove(), 3000);
				}
			};
		}

		_connectLiveChat(sessionId) {
			// 持久化会话 ID（刷新恢复用）
			try { sessionStorage.setItem('docqa-live-session', sessionId); } catch {}

			const wsUrl = SERVER.replace(/^http/, 'ws') + '/ws/live-chat/' + sessionId + '?role=visitor';
			this._ws = new WebSocket(wsUrl);
			this._updateModeBar();

			this._ws.onopen = () => { this._updateModeBar(); };

			this._ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type === 'status' && data.content === 'agent_connected') {
						const waiting = this.$.messages.querySelector('.ha-waiting');
						if (waiting) waiting.remove();
						const div = document.createElement('div');
						div.className = 'msg assistant ha-status';
						div.textContent = t('humanAgentConnected');
						this.$.messages.appendChild(div);
						this.$.messages.scrollTop = this.$.messages.scrollHeight;
						this._updateModeBar();
					} else if (data.type === 'message' && data.sender === 'agent') {
						this._appendMsg('agent', data.content);
						if (this.currentSessionId) db.addMessage(this.currentSessionId, 'agent', data.content).catch(() => {});
					} else if (data.type === 'status' && data.content === 'agent_disconnected') {
						this._returnToAi();
						this._showStatusCard('disconnected');
					} else if (data.type === 'status' && data.content === 'idle_warning') {
						this._showStatusCard('idle_warning');
					} else if (data.type === 'status' && data.content === 'idle_timeout') {
						this._liveChatActive = false;
						this._showStatusCard('idle_timeout');
						this._updateModeBar();
						try { sessionStorage.removeItem('docqa-live-session'); } catch {}
					}
				} catch {}
			};

			this._ws.onclose = () => {
				if (this._liveChatActive) {
					this._returnToAi();
					this._showStatusCard('disconnected');
				}
				try { sessionStorage.removeItem('docqa-live-session'); } catch {}
			};
		}

		_returnToAi() {
			this._liveChatActive = false;
			this._liveChatSessionId = null;
			if (this._ws) { this._ws.close(); this._ws = null; }
			try { sessionStorage.removeItem('docqa-live-session'); } catch {}
			this._updateModeBar();
		}

		_showStatusCard(type) {
			// 移除之前的状态卡片
			const old = this.$.messages.querySelector('.ha-status-card');
			if (old) old.remove();

			const div = document.createElement('div');
			div.className = 'msg assistant';

			if (type === 'disconnected') {
				div.innerHTML = `<div class="ha-status-card">
					<div class="ha-status-icon">👋</div>
					<div class="ha-status-text">${t('humanAgentDisconnected')}</div>
					<div class="ha-status-hint">${t('modeAi')}</div>
				</div>`;
			} else if (type === 'idle_warning') {
				div.innerHTML = `<div class="ha-status-card ha-status-warning">
					<div class="ha-status-icon">⏰</div>
					<div class="ha-status-text">${t('idleWarning')}</div>
					<button class="ha-status-btn">${t('keepAlive')}</button>
				</div>`;
				div.querySelector('.ha-status-btn').onclick = () => {
					if (this._ws && this._ws.readyState === WebSocket.OPEN) {
						this._ws.send(JSON.stringify({ type: 'heartbeat' }));
					}
					div.remove();
				};
			} else if (type === 'idle_timeout') {
				div.innerHTML = `<div class="ha-status-card">
					<div class="ha-status-icon">⏱️</div>
					<div class="ha-status-text">${t('idleTimeout')}</div>
					<div class="ha-status-hint">${t('modeAi')}</div>
				</div>`;
				this._returnToAi();
			}

			this.$.messages.appendChild(div);
			this.$.messages.scrollTop = this.$.messages.scrollHeight;
		}

		_updateModeBar() {
			const bar = this.$.modeBar;
			if (!bar) return;
			if (!this._haConfig || this._haConfig.mode === 'disabled') {
				bar.classList.add('hidden');
				return;
			}
			bar.classList.remove('hidden');
			const dot = bar.querySelector('.mode-dot');
			const label = bar.querySelector('.mode-label');
			const btn = bar.querySelector('.mode-switch-btn');

			if (this._liveChatActive && this._ws && this._ws.readyState === WebSocket.OPEN) {
				// 人工客服已连接
				dot.className = 'mode-dot green';
				label.textContent = t('modeHumanConnected');
				btn.textContent = t('switchToAi');
				btn.onclick = () => this._returnToAi();
			} else if (this._liveChatActive) {
				// 等待中
				dot.className = 'mode-dot yellow';
				label.textContent = t('modeHumanWaiting');
				btn.textContent = t('switchToAi');
				btn.onclick = () => this._returnToAi();
			} else {
				// AI 模式
				dot.className = 'mode-dot blue';
				label.textContent = t('modeAi');
				btn.textContent = t('switchToHuman');
				btn.onclick = async () => {
					try {
						const config = this._haConfig || await api.getHumanAgentConfig();
						if (config && config.mode && config.mode !== 'disabled') {
							this._appendMsg('user', t('switchToHuman'));
							await this._handleHumanAgentTrigger(config);
						}
					} catch {}
				};
			}
		}

		async _send() {
			if (this.sending) return;
			const text = this.$.textarea.value.trim();
			if (!text) return;

			// 人工客服关键词检测
			const lowerText = text.toLowerCase().trim();
			const isHumanTrigger = HUMAN_AGENT_TRIGGERS.some(kw => lowerText === kw || lowerText.includes(kw));
			if (isHumanTrigger && !this._liveChatActive) {
				try {
					const haConfig = await api.getHumanAgentConfig();
					if (haConfig && haConfig.mode && haConfig.mode !== 'disabled') {
						this.$.textarea.value = '';
						this.$.textarea.style.height = 'auto';
						this._appendMsg('user', text);
						await this._handleHumanAgentTrigger(haConfig);
						return;
					}
				} catch (e) {
					console.error('[DocQA] Human agent config check failed:', e);
				}
				// disabled 或出错：继续走正常 AI 流程
			}

			// 在线客服模式：通过 WebSocket 发送
			if (this._liveChatActive && this._ws && this._ws.readyState === WebSocket.OPEN) {
				this.$.textarea.value = '';
				this.$.textarea.style.height = 'auto';
				this._appendMsg('user', text);
				this._ws.send(JSON.stringify({ type: 'message', content: text, sender: 'visitor' }));
				// 保存到 IndexedDB
				if (this.currentSessionId) db.addMessage(this.currentSessionId, 'user', text).catch(() => {});
				return;
			}

			this.$.textarea.value = '';
			this.$.textarea.style.height = 'auto';
			this._appendMsg('user', text);

			// 创建空的 assistant 消息容器，用于流式填充
			const empty = this.$.messages.querySelector('.empty-state');
			if (empty) empty.remove();
			const msgDiv = document.createElement('div');
			msgDiv.className = 'msg assistant typing';
			msgDiv.innerHTML = `${t('typing')}<span class="typing-dots"><span></span><span></span><span></span></span>`;
			this.$.messages.appendChild(msgDiv);
			this.$.messages.scrollTop = this.$.messages.scrollHeight;

			this.sending = true;
			this.$.sendBtn.disabled = true;

			try {
				// 首条消息时创建本地会话
				if (!this.currentSessionId) {
					const session = await db.createSession();
					this.currentSessionId = session.id;
				}

				// 保存用户消息到 IndexedDB
				await db.addMessage(this.currentSessionId, 'user', text);

				// 获取最近历史发送给后端
				const history = await db.getRecentHistory(this.currentSessionId);
				// 移除最后一条（刚加的 user 消息，会通过 message 字段发送）
				history.pop();

				// 流式请求
				const res = await api.chatStream(text, history);
				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let fullText = '';
				let buffer = '';
				let firstChunk = true;

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop(); // 保留不完整的行

					for (const line of lines) {
						if (!line.startsWith('data: ')) continue;
						const payload = line.slice(6).trim();
						if (payload === '[DONE]') continue;

						try {
							const parsed = JSON.parse(payload);
							if (parsed.error) {
								// 结构化错误处理
								if (parsed.error.startsWith('[QUOTA_EXCEEDED]')) {
									var parts = parsed.error.replace('[QUOTA_EXCEEDED]', '').split('/');
									fullText = '__QUOTA_EXCEEDED__' + parts[0] + '/' + parts[1];
								} else if (parsed.error.startsWith('[DOMAIN_NOT_FOUND]')) {
									fullText = '__DOMAIN_NOT_FOUND__';
								} else {
									fullText = parsed.error;
								}
								break;
							}
							if (parsed.content) {
								if (firstChunk) {
									msgDiv.classList.remove('typing');
									msgDiv.textContent = '';
									firstChunk = false;
								}
								fullText += parsed.content;
								// 实时更新显示（纯文本，最终再渲染 Markdown）
								msgDiv.textContent = fullText;
								this.$.messages.scrollTop = this.$.messages.scrollHeight;
							}
						} catch {}
					}
				}

				// 流结束后渲染
				if (fullText.startsWith('__QUOTA_EXCEEDED__')) {
					var qParts = fullText.replace('__QUOTA_EXCEEDED__', '').split('/');
					msgDiv.remove();
					this._disableForQuota(parseInt(qParts[0]) || 0, parseInt(qParts[1]) || 0);
				} else if (fullText === '__DOMAIN_NOT_FOUND__') {
					msgDiv.remove();
					this.$.messages.innerHTML = '';
					var dWrap = document.createElement('div');
					dWrap.className = 'quota-exceeded-wrap';
					dWrap.innerHTML = '<div class="quota-exceeded">' +
						'<div class="quota-icon">🔒</div>' +
						'<div class="quota-title">' + t('domainNotFoundTitle') + '</div>' +
						'<div class="quota-desc">' + t('domainNotFoundDesc') + '</div>' +
					'</div>';
					this.$.messages.appendChild(dWrap);
					this.$.textarea.disabled = true;
					this.$.textarea.placeholder = t('domainNotFoundTitle');
					this.$.sendBtn.disabled = true;
				} else {
					await loadMarked();
					msgDiv.innerHTML = renderMarkdown(fullText);
					linkifyTextNodes(msgDiv);
				}
				this.$.messages.scrollTop = this.$.messages.scrollHeight;

				// 保存 AI 回复到 IndexedDB
				await db.addMessage(this.currentSessionId, 'assistant', fullText);

				// 首条消息用作会话标题
				const allMsgs = await db.getMessages(this.currentSessionId);
				if (allMsgs.length === 2) {
					const title = text.length > 30 ? text.slice(0, 30) + '...' : text;
					await db.updateSessionTitle(this.currentSessionId, title);
				}
			} catch {
				msgDiv.classList.remove('typing');
				msgDiv.textContent = t('errorReply');
			} finally {
				this.sending = false;
				this.$.sendBtn.disabled = false;
				this.$.textarea.focus();
			}
		}

		_showSettings() {
			this.$.settingsPanel.classList.remove('hidden');
			this.$.sidebar.classList.add('hidden');
			this._updateThemeButtons();
			this._loadRagSyncInfo();
		}

		async _loadRagSyncInfo() {
			var el = this.shadowRoot.querySelector('.rag-updated-time');
			if (!el) return;
			el.textContent = t('ragSyncLoading');
			try {
				var res = await api.cacheStatus();
				if (res.updatedAt) {
					var localTime = (() => {
						try {
							var d = new Date(res.updatedAt.replace(' ', 'T') + 'Z');
							if (isNaN(d.getTime())) return res.updatedAt;
							return d.toLocaleString();
						} catch(e) { return res.updatedAt; }
					})();
					el.textContent = t('ragSyncTime') + localTime;
				} else {
					el.textContent = t('ragSyncNone');
				}
			} catch (e) {
				el.textContent = t('ragSyncNone');
			}
		}

		_updateThemeButtons() {
			var isDark = this.classList.contains('dark');
			this.shadowRoot.querySelectorAll('.settings-theme-btn').forEach(function(btn) {
				var active = (btn.getAttribute('data-theme') === 'dark') === isDark;
				btn.classList.toggle('active', active);
			});
		}

		async _showSidebar() {
			this.$.settingsPanel.classList.add('hidden');
			this.$.sidebar.classList.remove('hidden');
			const sessions = await db.listSessions();
			this.$.sessionList.innerHTML = '';

			if (sessions.length === 0) {
				this.$.sessionList.innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:20px;font-size:13px;">${t('noSessions')}</div>`;
				return;
			}

			for (const s of sessions) {
				const item = document.createElement('div');
				item.className = `session-item${s.id === this.currentSessionId ? ' active' : ''}`;
				item.innerHTML = `
					<span class="session-item-title">${this._esc(s.title)}</span>
					<button class="session-item-delete" title="删除">&times;</button>
				`;
				item.querySelector('.session-item-title').onclick = () => this._switchSession(s.id);
				item.querySelector('.session-item-delete').onclick = async (e) => {
					e.stopPropagation();
					await db.deleteSession(s.id);
					item.remove();
					if (s.id === this.currentSessionId) this._prepareNewChat();
				};
				this.$.sessionList.appendChild(item);
			}
		}

		async _switchSession(id) {
			if (this._liveChatActive) {
				if (!confirm(t('switchConfirm'))) return;
				this._returnToAi();
			}
			this.currentSessionId = id;
			this.$.sidebar.classList.add('hidden');
			this.$.messages.innerHTML = '';

			const msgs = await db.getMessages(id);
			if (msgs.length === 0) {
				this._clearMessages();
				return;
			}
			for (const m of msgs) this._appendMsg(m.role, m.content);
		}

		_esc(str) {
			const d = document.createElement('div');
			d.textContent = str;
			return d.innerHTML;
		}
	}

	if (!customElements.get('chat-widget')) {
		customElements.define('chat-widget', ChatWidget);
	}

	// 路由排除：data-exclude 配置不显示 Widget 的路径（逗号分隔，支持 * 通配符）
	const excludeAttr = scriptTag && scriptTag.getAttribute('data-exclude');
	const shouldExclude = (() => {
		if (!excludeAttr) return false;
		const path = window.location.pathname;
		return excludeAttr.split(',').some(pattern => {
			const p = pattern.trim();
			if (!p) return false;
			if (p.endsWith('*')) {
				return path.startsWith(p.slice(0, -1));
			}
			return path === p || path === p + '/';
		});
	})();

	if (!shouldExclude && !document.querySelector('chat-widget')) {
		document.body.appendChild(document.createElement('chat-widget'));
	}
})();
