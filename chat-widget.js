(function () {
	'use strict';

	// 支持 document.currentScript（同步加载）和动态注入（Streamlit 等场景）
	const scriptTag = document.currentScript || document.getElementById('docqa-widget-script') || document.querySelector('script[src*="chat-widget.js"]');
	// 脚本源域名（始终从 script src 推导，用于 CSS 等静态资源）
	const SCRIPT_ORIGIN = (() => {
		if (scriptTag && scriptTag.src) {
			try {
				return new URL(scriptTag.src).origin;
			} catch (e) {}
		}
		return window.location.origin;
	})();
	// API 服务地址（可通过 data-server 覆盖，默认跟脚本同域）
	const SERVER = (scriptTag && scriptTag.getAttribute('data-server')) || SCRIPT_ORIGIN;
	// 访客身份令牌（商家为登录用户签发，用于 AI Actions 调商家 API；webnav 不解析）。
	// 支持 data-user-token 属性，或运行时通过 window.WebnavWidget.setUserToken() 设置。
	let USER_TOKEN = (scriptTag && scriptTag.getAttribute('data-user-token')) || '';
	// 语音：data-voice="true" 开启麦克风语音输入 + AI 回复朗读（浏览器 Web Speech API）
	const VOICE_ENABLED = scriptTag && scriptTag.getAttribute('data-voice') === 'true';
	const _SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
	// 语音输入优先走服务端转写(/api/transcribe，需 MediaRecorder)，降级浏览器 Web Speech
	const _CAN_RECORD = typeof window !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
	const VOICE_ON = VOICE_ENABLED && (!!_SpeechRec || _CAN_RECORD);
	// 触屏设备（手机/平板）：语音改为「按住说话、松手转写」，体验比点击切换更直观
	const SUPPORTS_TOUCH = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);
	// data-base-url 支持逗号分隔多个 URL，第一个为主域名
	const BASE_URL_ATTR = scriptTag && scriptTag.getAttribute('data-base-url');
	const BASE_URLS = (BASE_URL_ATTR || window.location.origin)
		.split(',')
		.map(function (u) {
			return u.trim().replace(/\/+$/, '');
		})
		.filter(Boolean);
	const BASE_URL = BASE_URLS[0] || window.location.origin;
	const DOMAIN = (() => {
		try {
			return new URL(BASE_URL).hostname;
		} catch {
			return window.location.hostname;
		}
	})();
	// 只要用户显式配置了 data-base-url，就完整传给后端，由用户控制抓取目标；
	// 未配置时传空字符串，后端走默认的"当前域名 + docs.{顶级域名}"行为。
	const ALL_BASE_URLS = BASE_URL_ATTR ? BASE_URLS.join(',') : '';
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
			voiceInput: 'Voice input',
			voiceListening: 'Listening…',
			voiceTranscribing: 'Transcribing…',
			voiceHold: 'Hold to talk',
			voiceReleaseSend: 'Release to send…',
			voiceUnsupported: 'Voice input is not supported in this browser — please type instead',
			voiceSettings: 'Voice',
			sttLangLabel: 'Dictation language',
			sttLangAuto: 'Follow interface',
			autoSpeakLabel: 'Auto read-out replies',
			voiceNoSpeech: "Didn't catch that — please try again",
			voiceDenied: 'Please allow microphone access',
			voiceInsecure: 'Voice input requires HTTPS',
			voiceNoMic: 'No microphone found',
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
			aiDisabledTitle: 'Support unavailable',
			aiDisabledText: 'Customer support is not available on this site yet.',
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
			ticketError: 'Submission failed. Please try again.',
			actionRunning: 'Processing...',
			actionConfirmTitle: 'Please confirm this action',
			actionConfirm: 'Confirm',
			actionCancel: 'Cancel',
			actionCancelled: 'Cancelled.',
			actionProcessing: 'Processing...',
			actionDone: 'Done ✓',
			actionFailed: 'Action failed. Please try again or contact support.',
			actionConfirmSecurity: 'Runs once after you confirm. Secured by Webnav.',
			chooseGenerate: 'Generate order'
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
			voiceInput: '音声入力',
			voiceListening: '聞き取り中…',
			voiceTranscribing: '文字起こし中…',
			voiceHold: '押して話す',
			voiceReleaseSend: '離すと送信…',
			voiceUnsupported: 'このブラウザは音声入力に対応していません。キーボードで入力してください',
			voiceSettings: '音声',
			sttLangLabel: '音声認識の言語',
			sttLangAuto: '画面の言語に従う',
			autoSpeakLabel: '返信を自動読み上げ',
			voiceNoSpeech: '聞き取れませんでした。もう一度お試しください',
			voiceDenied: 'マイクへのアクセスを許可してください',
			voiceInsecure: '音声入力には HTTPS が必要です',
			voiceNoMic: 'マイクが見つかりません',
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
			aiDisabledTitle: 'サポート未開通',
			aiDisabledText: 'このサイトのカスタマーサポートはまだご利用いただけません。',
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
			voiceInput: '음성 입력',
			voiceListening: '듣는 중…',
			voiceTranscribing: '변환 중…',
			voiceHold: '눌러서 말하기',
			voiceReleaseSend: '놓으면 전송…',
			voiceUnsupported: '이 브라우저는 음성 입력을 지원하지 않습니다. 키보드로 입력해 주세요',
			voiceSettings: '음성',
			sttLangLabel: '받아쓰기 언어',
			sttLangAuto: '화면 언어 따름',
			autoSpeakLabel: '답변 자동 읽기',
			voiceNoSpeech: '잘 안 들렸어요. 다시 말씀해 주세요',
			voiceDenied: '마이크 권한을 허용해 주세요',
			voiceInsecure: '음성 입력은 HTTPS가 필요합니다',
			voiceNoMic: '마이크를 찾을 수 없습니다',
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
			aiDisabledTitle: '지원 미개통',
			aiDisabledText: '이 사이트의 고객 지원은 아직 이용할 수 없습니다.',
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
		},
		zh: {
			headerTitle: 'AI 客服',
			newChat: '新对话',
			newSession: '+ 新对话',
			inputPlaceholder: '输入消息...',
			emptyState: '有什么可以帮您的吗？',
			typing: '输入中...',
			errorReply: '抱歉，发生错误，请稍后再试。',
			noSessions: '没有对话记录',
			historySessions: '对话记录',
			themeToggle: '主题',
			historyBtn: '记录',
			settingsBtn: '设置',
			quotaTitle: '已达对话上限',
			quotaDesc: '本月已使用 {used} / {limit} 次对话。',
			quotaUpgrade: '升级方案 →',
			quotaDisabled: '已达对话上限，请升级以继续使用。',
			domainNotFoundTitle: '域名未配置',
			domainNotFoundDesc: '此域名未绑定有效账户。',
			ragSyncLabel: '知识库',
			ragSyncLoading: '加载中...',
			ragSyncTime: '最后更新：',
			ragSyncPages: ' 页',
			ragSyncNone: '尚未同步',
			closeBtn: '关闭',
			sendBtn: '发送',
			voiceInput: '语音输入',
			voiceListening: '聆听中…',
			voiceTranscribing: '转写中…',
			voiceHold: '按住说话',
			voiceReleaseSend: '松手发送…',
			voiceUnsupported: '当前浏览器不支持语音输入，请用键盘输入',
			voiceSettings: '语音',
			sttLangLabel: '听写语言',
			sttLangAuto: '跟随界面语言',
			autoSpeakLabel: '自动朗读回复',
			voiceNoSpeech: '没听清，请再说一次',
			voiceDenied: '请允许麦克风权限',
			voiceInsecure: '语音输入需要 HTTPS 环境',
			voiceNoMic: '未检测到麦克风',
			deleteBtn: '删除',
			loadingTitle: '正在准备 AI 助手',
			loadingSubtitle: '首次使用需要学习网站内容。<br>通常需要 1-2 分钟。',
			loadingInit: '初始化中...',
			loadingStarting: '启动中...',
			loadingLearning: (url, pages) => `正在学习 ${url}（已索引 ${pages} 页）`,
			loadingLearningGeneral: (pages) => `正在学习网站内容...（已索引 ${pages} 页）`,
			loadingRetrying: (n, max) => `重试中（第 ${n}/${max} 次）...`,
			loadingFailed: '无法加载网站内容，请稍后再试。',
			loadingRetryBtn: '重试',
			loadingRetryText: '重试中...',
			deniedTitle: '未授权',
			deniedText: (domain) => `域名 <strong class="denied-domain">${domain}</strong> 未获授权使用此服务。`,
			deniedCta: '立即开始 →',
			aiDisabledTitle: '客服未开通',
			aiDisabledText: '本网站的智能客服暂未开通。',
			sampleQuestionsLoading: '加载建议中...',
			humanAgentContact: '联系我们的客服团队：',
			humanAgentWaiting: '正在连接客服人员...',
			humanAgentQueue: (pos) => `等候位置：第 ${pos} 位`,
			humanAgentEstWait: (min) => `预计等候时间：约 ${min} 分钟`,
			humanAgentConnected: '客服人员已连接',
			humanAgentDisconnected: '客服人员已断开',
			returnToAi: '返回 AI',
			humanAgentNotified: '已收到您的请求，客服人员将尽快与您联系。',
			phone: '电话',
			email: '邮箱',
			wechat: '微信',
			telegram: 'Telegram',
			idleWarning: '长时间未收到消息，连接将在 1 分钟后关闭。',
			idleTimeout: '因闲置过久，连接已关闭。',
			keepAlive: '保持连接',
			switchToAi: '切换至 AI',
			switchToHuman: '人工客服',
			modeAi: 'AI 客服',
			modeHumanConnected: '人工客服已连接',
			modeHumanWaiting: '等待客服中...',
			restoring: '正在恢复连接...',
			switchConfirm: '您正在实时对话中，切换将会断开连接。是否继续？',
			ticketTitle: '提交工单',
			ticketContact: '联系方式（电话/邮箱/微信）',
			ticketDesc: '请描述您的问题',
			ticketSubmit: '提交工单',
			ticketSubmitting: '提交中...',
			ticketSuccess: '工单已提交！客服人员将尽快与您联系。',
			ticketError: '提交失败，请重试。',
			actionRunning: '正在处理…',
			actionConfirmTitle: '请确认本次操作',
			actionConfirm: '确认',
			actionCancel: '取消',
			actionCancelled: '已取消。',
			actionProcessing: '处理中…',
			actionDone: '已完成 ✓',
			actionFailed: '操作失败，请重试或联系人工客服。',
			actionConfirmSecurity: '确认后仅执行一次，由 Webnav 安全保障。',
			chooseGenerate: '生成订单'
		},
		zht: {
			headerTitle: 'AI 客服',
			newChat: '新對話',
			newSession: '+ 新對話',
			inputPlaceholder: '輸入訊息...',
			emptyState: '有什麼可以幫您的嗎？',
			typing: '輸入中...',
			errorReply: '抱歉，發生錯誤，請稍後再試。',
			noSessions: '沒有對話紀錄',
			historySessions: '對話紀錄',
			themeToggle: '主題',
			historyBtn: '紀錄',
			settingsBtn: '設定',
			quotaTitle: '已達對話上限',
			quotaDesc: '本月已使用 {used} / {limit} 次對話。',
			quotaUpgrade: '升級方案 →',
			quotaDisabled: '已達對話上限，請升級以繼續使用。',
			domainNotFoundTitle: '網域未設定',
			domainNotFoundDesc: '此網域未綁定有效帳戶。',
			ragSyncLabel: '知識庫',
			ragSyncLoading: '載入中...',
			ragSyncTime: '最後更新：',
			ragSyncPages: ' 頁',
			ragSyncNone: '尚未同步',
			closeBtn: '關閉',
			sendBtn: '發送',
			voiceInput: '語音輸入',
			voiceListening: '聆聽中…',
			voiceTranscribing: '轉寫中…',
			voiceHold: '按住說話',
			voiceReleaseSend: '鬆手發送…',
			voiceUnsupported: '當前瀏覽器不支援語音輸入，請用鍵盤輸入',
			voiceSettings: '語音',
			sttLangLabel: '聽寫語言',
			sttLangAuto: '跟隨介面語言',
			autoSpeakLabel: '自動朗讀回覆',
			voiceNoSpeech: '沒聽清，請再說一次',
			voiceDenied: '請允許麥克風權限',
			voiceInsecure: '語音輸入需要 HTTPS 環境',
			voiceNoMic: '未偵測到麥克風',
			deleteBtn: '刪除',
			loadingTitle: '正在準備 AI 助手',
			loadingSubtitle: '首次使用需要學習網站內容。<br>通常需要 1-2 分鐘。',
			loadingInit: '初始化中...',
			loadingStarting: '啟動中...',
			loadingLearning: (url, pages) => `正在學習 ${url}（已索引 ${pages} 頁）`,
			loadingLearningGeneral: (pages) => `正在學習網站內容...（已索引 ${pages} 頁）`,
			loadingRetrying: (n, max) => `重試中（第 ${n}/${max} 次）...`,
			loadingFailed: '無法載入網站內容，請稍後再試。',
			loadingRetryBtn: '重試',
			loadingRetryText: '重試中...',
			deniedTitle: '未授權',
			deniedText: (domain) => `網域 <strong class="denied-domain">${domain}</strong> 未獲授權使用此服務。`,
			deniedCta: '立即開始 →',
			aiDisabledTitle: '客服未開通',
			aiDisabledText: '本網站的智慧客服暫未開通。',
			sampleQuestionsLoading: '載入建議中...',
			humanAgentContact: '聯繫我們的客服團隊：',
			humanAgentWaiting: '正在連接客服人員...',
			humanAgentQueue: (pos) => `等候位置：第 ${pos} 位`,
			humanAgentEstWait: (min) => `預計等候時間：約 ${min} 分鐘`,
			humanAgentConnected: '客服人員已連接',
			humanAgentDisconnected: '客服人員已斷開',
			returnToAi: '返回 AI',
			humanAgentNotified: '已收到您的請求，客服人員將盡快與您聯繫。',
			phone: '電話',
			email: '電子郵件',
			wechat: 'WeChat',
			telegram: 'Telegram',
			idleWarning: '長時間未收到訊息，連接將在 1 分鐘後關閉。',
			idleTimeout: '因閒置過久，連線已關閉。',
			keepAlive: '保持連接',
			switchToAi: '切換至 AI',
			switchToHuman: '真人客服',
			modeAi: 'AI 客服',
			modeHumanConnected: '真人客服已連接',
			modeHumanWaiting: '等待客服中...',
			restoring: '正在恢復連接...',
			switchConfirm: '您正在即時對話中，切換將會斷開連接。是否繼續？',
			ticketTitle: '提交工單',
			ticketContact: '聯繫方式（電話/電郵/WeChat）',
			ticketDesc: '請描述您的問題',
			ticketSubmit: '提交工單',
			ticketSubmitting: '提交中...',
			ticketSuccess: '工單已提交！客服人員將盡快與您聯繫。',
			ticketError: '提交失敗，請重試。',
			actionRunning: '正在處理…',
			actionConfirmTitle: '請確認本次操作',
			actionConfirm: '確認',
			actionCancel: '取消',
			actionCancelled: '已取消。',
			actionProcessing: '處理中…',
			actionDone: '已完成 ✓',
			actionFailed: '操作失敗，請重試或聯繫真人客服。',
			actionConfirmSecurity: '確認後僅執行一次，由 Webnav 安全保障。',
			chooseGenerate: '生成訂單'
		}
	};

	// 检测语言：data-lang 属性 > <html lang> > navigator.language > 'en'
	function detectLang() {
		const attr = scriptTag && scriptTag.getAttribute('data-lang');
		const htmlLang = document.documentElement.lang;
		const raw = attr || htmlLang || navigator.language || 'en';
		const lower = raw.toLowerCase();
		// Exact code match (e.g. data-lang="zht", "zh", "en")
		if (LANGS[lower]) return lower;
		// Map zh variants: zh-TW/zh-HK/zh-Hant → zht, zh-CN/zh-Hans/zh → zh
		if (lower.startsWith('zh')) {
			if (lower.includes('tw') || lower.includes('hk') || lower.includes('hant') || lower.includes('mo')) return 'zht';
			return 'zh';
		}
		const code = lower.split('-')[0];
		return LANGS[code] ? code : 'en';
	}

	let LANG = detectLang();

	function t(key) {
		var v = LANGS[LANG][key];
		if (v === undefined) v = LANGS.en[key];   // 缺失时回退英文
		if (v === undefined) v = key;             // 仍缺失则返回键名，避免 undefined
		return v;
	}

	// 监听 <html lang> 变化，自动切换 Widget 语言
	new MutationObserver(function () {
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

	// HTML 转义，防止 XSS
	function escHtml(str) {
		if (!str) return '';
		return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

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

	// 把动作结果卡片(display: {title, fields, items})转成简短文字，
	// 供写入对话历史 —— 让 LLM 在后续轮次记住订单号/物流号/商品等上下文。
	function actionCardToText(display) {
		if (!display || typeof display !== 'object') return '';
		const parts = [];
		if (display.title) parts.push(String(display.title));
		if (Array.isArray(display.fields)) {
			for (const f of display.fields) {
				if (f && f.label != null) parts.push(`${f.label}：${f.value}`);
			}
		}
		if (Array.isArray(display.items)) {
			for (const it of display.items) {
				if (!it) continue;
				const seg = [it.title, it.desc, it.time].filter(Boolean).join(' ');
				if (seg) parts.push(seg);
			}
		}
		return parts.join('；');
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

		async addMessage(sessionId, role, content, cards) {
			const d = await this._db();
			const msg = { sessionId, role, content, createdAt: Date.now() };
			// 读操作结果卡片（商品/订单/物流等 display），用于刷新后还原
			if (Array.isArray(cards) && cards.length) {
				try { msg.cards = JSON.parse(JSON.stringify(cards)); } catch {}
			}
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
			return trimmed.map((m) => {
				let content = m.content || '';
				// 把动作结果卡片（订单/物流/商品等）并入历史文本，给 LLM 提供上下文
				if (Array.isArray(m.cards) && m.cards.length) {
					const cardsText = m.cards.map(actionCardToText).filter(Boolean).join('\n');
					if (cardsText) content = (content ? content + '\n' : '') + '[操作结果] ' + cardsText;
				}
				return { role: m.role, content };
			});
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
				body: JSON.stringify({ message, history, domain: DOMAIN, extra_urls: ALL_BASE_URLS, stream: false, visitor_id: VISITOR_ID, user_token: USER_TOKEN })
			});
			return res.json();
		},
		chatStream(message, history) {
			return fetch(`${SERVER}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message, history, domain: DOMAIN, extra_urls: ALL_BASE_URLS, stream: true, visitor_id: VISITOR_ID, user_token: USER_TOKEN })
			});
		},
		// 确认执行一个待确认的写操作（下单/退款）
		async confirmAction(pendingId, hmacSig) {
			const res = await fetch(`${SERVER}/api/action/confirm`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain: DOMAIN, visitor_id: VISITOR_ID, pending_id: pendingId, hmac: hmacSig, user_token: USER_TOKEN })
			});
			return res.json();
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
			} catch {
				return { mode: 'disabled' };
			}
		},
		async requestHumanAgent(visitorName, visitorInfo) {
			try {
				const res = await fetch(`${SERVER}/api/human-agent-request`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ domain: DOMAIN, visitor_id: VISITOR_ID, visitor_name: visitorName || '', visitor_info: visitorInfo || '' })
				});
				return res.json();
			} catch {
				return { error: 'network_error' };
			}
		},
		async submitTicket(contact, description) {
			try {
				const res = await fetch(`${SERVER}/api/submit-ticket`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ domain: DOMAIN, visitor_id: VISITOR_ID, contact, description })
				});
				return res.json();
			} catch {
				return { error: 'network_error' };
			}
		},
		// 线索收集（留资）
		async submitLead(data) {
			try {
				const res = await fetch(`${SERVER}/api/lead`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ domain: DOMAIN, visitor_id: VISITOR_ID, source: 'form', ...data })
				});
				return res.json();
			} catch {
				return { error: 'network_error' };
			}
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
			// 从挂件自己的域名加载（vendor 随 widget 一起部署）：
			// 接入方 CSP 只需放行挂件域名本身，且不依赖第三方 CDN 的可达性。
			const s = document.createElement('script');
			s.src = `${SCRIPT_ORIGIN}/widget/vendor/marked.min.js`;
			s.onload = () => resolve();
			s.onerror = () => resolve(); // 失败时 renderMarkdown 会降级为纯文本
			document.head.appendChild(s);
			setTimeout(resolve, 8000); // 兜底：不让 await loadMarked() 永久挂起
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
			// 提前获取主题策略，确保气泡球显示正确主题
			this._applyThemePolicyEarly();
			if (this._fullscreen) {
				this.$.fab.classList.add('hidden');
				this.$.win.classList.remove('hidden');
				this.$.win.classList.add('fullscreen');
				const closeBtn = this.shadowRoot.querySelector('.btn-close');
				if (closeBtn) closeBtn.style.display = 'none';
				this._open();
			}
		}

		async _applyThemePolicyEarly() {
			// BYOK 门控兜底：2.5s 内未拿到 cache-status（后端慢/挂/旧版本）则照常显示气泡，保持旧行为
			this._gateTimer = setTimeout(() => this._revealFab(), 2500);
			try {
				const status = await api.cacheStatus();
				clearTimeout(this._gateTimer);
				this._applyThemePolicy(status.themeSwitch);
				// 商家未配置模型且无平台豁免：显式 false 才拦（字段缺失 = 旧后端 = 照常显示）
				if (status.aiEnabled === false) {
					if (this._fullscreen) {
						this._showAiDisabledView();
					} else {
						this.remove(); // 整个组件移除，访客零感知
					}
					return;
				}
				this._revealFab();
			} catch {
				clearTimeout(this._gateTimer);
				this._applyThemePolicy(false);
				this._revealFab();
			}
		}

		_revealFab() {
			if (!this._fullscreen && this.$ && this.$.fab) this.$.fab.classList.remove('hidden');
		}

		// fullscreen 模式下商家未配置模型：复用 denied 视觉，换成「客服未开通」文案
		_showAiDisabledView() {
			var titleEl = this.shadowRoot.querySelector('.denied-title');
			var textEl = this.shadowRoot.querySelector('.denied-text');
			if (titleEl) titleEl.textContent = t('aiDisabledTitle');
			if (textEl) textEl.textContent = t('aiDisabledText');
			var ctaBtn = this.shadowRoot.querySelector('.denied-cta-btn');
			if (ctaBtn) ctaBtn.style.display = 'none';
			this._showDeniedView();
			if (this.$.textarea) { this.$.textarea.disabled = true; }
			if (this.$.sendBtn) { this.$.sendBtn.disabled = true; }
		}

		_applyLogoPolicy(customLogo) {
			if (customLogo !== false) return; // 付费用户不限制
			// 免费用户：强制使用平台 Logo（从站点配置的主域名拿）
			var siteBase = this._siteUrl || 'https://www.webnav.ai';
			var platformLogo = siteBase.replace(/\/+$/, '') + '/favicon.svg';
			var headerLogo = this.shadowRoot.querySelector('.header-logo');
			if (headerLogo) {
				headerLogo.src = platformLogo;
				headerLogo.style.display = '';
			}
			var loadingLogo = this.shadowRoot.querySelector('.loading-logo');
			if (loadingLogo) {
				loadingLogo.src = platformLogo;
				loadingLogo.style.display = '';
			}
		}

		async _loadCSS() {
			const cssURL = `${SCRIPT_ORIGIN}/widget/chat-widget.css`;
			// 首选：fetch + constructed stylesheet。
			// fetch 受宿主页 connect-src 管，而接入方本来就必须为 API 调用放行挂件域名；
			// adoptedStyleSheets 按规范不受 CSP style-src 限制 —— 因此不再要求接入方改 style-src。
			try {
				if (this.shadowRoot.adoptedStyleSheets !== undefined && typeof CSSStyleSheet !== 'undefined' && CSSStyleSheet.prototype.replaceSync) {
					const resp = await fetch(cssURL, { mode: 'cors' });
					if (resp.ok) {
						const sheet = new CSSStyleSheet();
						sheet.replaceSync(await resp.text());
						this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
						return;
					}
				}
			} catch { /* 降级 */ }
			// 降级：<link>（旧浏览器/fetch 被拦时的原行为，需宿主页 style-src 放行挂件域名）
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = cssURL;
			this.shadowRoot.prepend(link);
		}

		_buildDOM() {
			const wrap = document.createElement('div');
			const _siteUrl = 'https://www.webnav.ai'; // 默认值，运行时由 _siteUrl 覆盖
			wrap.innerHTML = `
				<button class="chat-fab hidden" aria-label="${t('headerTitle')}">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
					</svg>
				</button>
				<div class="chat-window hidden">
					<div class="chat-header">
						<img class="header-logo" src="${SITE_LOGO}" alt="">
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
							<img class="loading-logo" src="${SITE_LOGO}" alt="">
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
						<a class="powered-by" href="https://www.webnav.ai" target="_blank" rel="noopener">
							<svg width="14" height="14" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#3b82f6"/><path d="M12 13h16a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4-4-4h-4a2 2 0 01-2-2v-8a2 2 0 012-2z" fill="rgba(255,255,255,.95)"/></svg>
							<span>Powered by Webnav.ai</span>
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
							<div class="input-wrap">
								<textarea rows="1" placeholder="${t('inputPlaceholder')}"></textarea>
								${VOICE_ON ? `<div class="voice-status hidden"><span class="voice-spinner"></span><span class="voice-status-text"></span></div>` : ''}
							</div>
							${VOICE_ON ? `<button class="voice-btn" title="${t('voiceInput')}">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
							</button>` : ''}
							<button class="send-btn" title="${t('sendBtn')}">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
							</button>
						</div>
						<a class="powered-by" href="https://www.webnav.ai" target="_blank" rel="noopener">
							<svg width="14" height="14" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#3b82f6"/><path d="M12 13h16a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4-4-4h-4a2 2 0 01-2-2v-8a2 2 0 012-2z" fill="rgba(255,255,255,.95)"/></svg>
							<span>Powered by Webnav.ai</span>
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
						${VOICE_ON ? `
						<div class="settings-section settings-voice">
							<div class="settings-label">${t('voiceSettings')}</div>
							<div class="settings-row">
								<span class="settings-row-label">${t('sttLangLabel')}</span>
								<select class="settings-stt-lang">
									<option value="auto">${t('sttLangAuto')}</option>
									<option value="zh">中文</option>
									<option value="zht">繁體中文</option>
									<option value="en">English</option>
									<option value="ja">日本語</option>
									<option value="ko">한국어</option>
								</select>
							</div>
							<div class="settings-row">
								<span class="settings-row-label">${t('autoSpeakLabel')}</span>
								<button class="settings-switch settings-autospeak" role="switch" aria-checked="false"><span class="settings-switch-knob"></span></button>
							</div>
						</div>` : ''}
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
				voiceBtn: this.shadowRoot.querySelector('.voice-btn'),
				sidebar: this.shadowRoot.querySelector('.chat-sidebar'),
				sessionList: this.shadowRoot.querySelector('.session-list'),
				loadingBarFill: this.shadowRoot.querySelector('.loading-bar-fill'),
				loadingStatus: this.shadowRoot.querySelector('.loading-status'),
				loadingError: this.shadowRoot.querySelector('.loading-error'),
				loadingRetryBtn: this.shadowRoot.querySelector('.loading-retry-btn'),
				loadingProgress: this.shadowRoot.querySelector('.loading-progress'),
				settingsPanel: this.shadowRoot.querySelector('.chat-settings'),
				sttLangSelect: this.shadowRoot.querySelector('.settings-stt-lang'),
				autoSpeakBtn: this.shadowRoot.querySelector('.settings-autospeak'),
				inputArea: this.shadowRoot.querySelector('.chat-input-area'),
				voiceStatus: this.shadowRoot.querySelector('.voice-status'),
				voiceStatusText: this.shadowRoot.querySelector('.voice-status-text')
			};

			// logo 加载失败时隐藏（用监听器而非内联 onerror=：严格 CSP 下内联事件处理器会被拦截）
			this.shadowRoot.querySelectorAll('.header-logo, .loading-logo').forEach((img) => {
				img.addEventListener('error', () => { img.style.display = 'none'; });
			});
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
			this.shadowRoot.querySelectorAll('.settings-theme-btn').forEach(function (btn) {
				btn.onclick = function () {
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

			// 设置面板 — 语音（听写语言 + 自动朗读），访客偏好存浏览器本地
			this._sttLang = localStorage.getItem('chat-widget-stt-lang') || 'auto';
			this._autoSpeak = localStorage.getItem('chat-widget-autospeak') === '1';
			if ($.sttLangSelect) {
				$.sttLangSelect.value = this._sttLang;
				$.sttLangSelect.onchange = function () {
					_this._sttLang = this.value || 'auto';
					localStorage.setItem('chat-widget-stt-lang', _this._sttLang);
				};
			}
			if ($.autoSpeakBtn) {
				this._syncAutoSpeakBtn();
				$.autoSpeakBtn.onclick = function () {
					_this._autoSpeak = !_this._autoSpeak;
					localStorage.setItem('chat-widget-autospeak', _this._autoSpeak ? '1' : '0');
					_this._syncAutoSpeakBtn();
				};
			}

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
			if ($.voiceBtn) this._bindVoiceButton();
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
				if (status.aiEnabled === false) {
					// 商家未配置模型（BYOK）：兜底防护，正常情况下组件已被移除
					this._showAiDisabledView();
				} else if (status.status === 'denied') {
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
				// API 失败时强制 light 主题（免费用户兜底）
				this._applyThemePolicy(false);
				this._showChatView();
			}
		}

		_disableForQuota(used, limit) {
			// 隐藏聊天消息区和输入区，显示居中的超限提示
			this.$.messages.replaceChildren();
			var wrap = document.createElement('div');
			wrap.className = 'quota-exceeded-wrap';
			var inner = document.createElement('div');
			inner.className = 'quota-exceeded';
			var iconEl = document.createElement('div');
			iconEl.className = 'quota-icon';
			iconEl.textContent = '⚠️';
			var titleEl = document.createElement('div');
			titleEl.className = 'quota-title';
			titleEl.textContent = t('quotaTitle');
			var descEl = document.createElement('div');
			descEl.className = 'quota-desc';
			descEl.textContent = t('quotaDesc').replace('{used}', String(used || 0)).replace('{limit}', String(limit || 0));
			var link = document.createElement('a');
			link.className = 'quota-upgrade';
			link.href = (this._siteUrl || 'https://www.webnav.ai') + '/dashboard/upgrade';
			link.target = '_blank';
			link.textContent = t('quotaUpgrade');
			inner.append(iconEl, titleEl, descEl, link);
			wrap.appendChild(inner);
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
			} catch {
				this._haConfig = null;
			}
			// 检查是否有未结束的 live chat session 需要恢复
			try {
				const savedSession = sessionStorage.getItem('docqa-live-session');
				if (savedSession && this._haConfig && this._haConfig.mode === 'live_chat') {
					const statusRes = await fetch(`${SERVER}/api/live-chat-status?session_id=${encodeURIComponent(savedSession)}`).then((r) => r.json());
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
			container.innerHTML = '';
			picked.forEach((q) => {
				const btn = document.createElement('button');
				btn.className = 'sample-question';
				btn.textContent = q;
				btn.onclick = () => {
					this.$.textarea.value = q;
					this._send();
				};
				container.appendChild(btn);
			});
		}

		_appendMsg(role, content, cards) {
			const empty = this.$.messages.querySelector('.empty-state');
			if (empty) empty.remove();
			const div = document.createElement('div');
			// agent 角色（人工客服）复用 assistant 样式，加标记
			const cssRole = role === 'agent' ? 'assistant' : role;
			div.className = `msg ${cssRole}`;
			const hasCards = Array.isArray(cards) && cards.length;
			if (role === 'agent') {
				// 人工客服消息：纯文本 + 标记
				div.innerHTML = `<div class="ha-agent-tag">👤</div>${this._esc(content)}`;
			} else if (role === 'assistant') {
				loadMarked().then(() => {
					div.innerHTML = content ? renderMarkdown(content) : '';
					linkifyTextNodes(div);
					// 还原读操作结果卡片（商品/订单/物流等）
					if (hasCards) {
						for (const c of cards) div.appendChild(this._buildActionCard(c));
					}
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
					if (c.phone)
						items.push(`<div class="ha-contact-item"><span class="ha-icon">📞</span><span class="ha-label">${t('phone')}</span><a href="tel:${escHtml(c.phone)}">${escHtml(c.phone)}</a></div>`);
					if (c.email)
						items.push(`<div class="ha-contact-item"><span class="ha-icon">📧</span><span class="ha-label">${t('email')}</span><a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a></div>`);
					if (c.wechat) items.push(`<div class="ha-contact-item"><span class="ha-icon">💬</span><span class="ha-label">${t('wechat')}</span><span>${escHtml(c.wechat)}</span></div>`);
					if (c.telegram)
						items.push(
							`<div class="ha-contact-item"><span class="ha-icon">✈️</span><span class="ha-label">${t('telegram')}</span><a href="https://t.me/${escHtml(c.telegram.replace('@', ''))}" target="_blank">${escHtml(c.telegram)}</a></div>`
						);

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
						if (c.phone)
							items.push(`<div class="ha-contact-item"><span class="ha-icon">📞</span><span class="ha-label">${t('phone')}</span><a href="tel:${escHtml(c.phone)}">${escHtml(c.phone)}</a></div>`);
						if (c.email)
							items.push(`<div class="ha-contact-item"><span class="ha-icon">📧</span><span class="ha-label">${t('email')}</span><a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a></div>`);
						if (c.wechat) items.push(`<div class="ha-contact-item"><span class="ha-icon">💬</span><span class="ha-label">${t('wechat')}</span><span>${escHtml(c.wechat)}</span></div>`);
						if (c.telegram)
							items.push(
								`<div class="ha-contact-item"><span class="ha-icon">✈️</span><span class="ha-label">${t('telegram')}</span><a href="https://t.me/${escHtml(c.telegram.replace('@', ''))}" target="_blank">${escHtml(c.telegram)}</a></div>`
							);
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
				console.error('[Webnav.ai] Human agent trigger error:', err);
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
			const form = document.createElement('div');
			form.className = 'ha-ticket-form';
			const title = document.createElement('div');
			title.className = 'ha-ticket-title';
			title.textContent = t('ticketTitle');
			const contactInput = document.createElement('input');
			contactInput.className = 'ha-ticket-input';
			contactInput.type = 'text';
			contactInput.placeholder = t('ticketContact');
			const descInput = document.createElement('textarea');
			descInput.className = 'ha-ticket-textarea';
			descInput.placeholder = t('ticketDesc');
			descInput.rows = 3;
			const btn = document.createElement('button');
			btn.className = 'ha-ticket-btn';
			btn.textContent = t('ticketSubmit');
			form.append(title, contactInput, descInput, btn);
			div.appendChild(form);
			this.$.messages.appendChild(div);
			this.$.messages.scrollTop = this.$.messages.scrollHeight;

			btn.onclick = async () => {
				const contact = contactInput.value.trim();
				const desc = descInput.value.trim();
				if (!contact || !desc) return;
				btn.textContent = t('ticketSubmitting');
				btn.disabled = true;
				const res = await api.submitTicket(contact, desc);
				if (res.ok) {
					const successForm = document.createElement('div');
					successForm.className = 'ha-ticket-form';
					const successMsg = document.createElement('div');
					successMsg.className = 'ha-ticket-success';
					successMsg.textContent = t('ticketSuccess');
					successForm.appendChild(successMsg);
					div.replaceChildren(successForm);
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
			try {
				sessionStorage.setItem('docqa-live-session', sessionId);
			} catch {}

			const wsUrl = SERVER.replace(/^http/, 'ws') + '/ws/live-chat/' + sessionId + '?role=visitor';
			this._ws = new WebSocket(wsUrl);
			this._updateModeBar();

			this._ws.onopen = () => {
				this._updateModeBar();
			};

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
						try {
							sessionStorage.removeItem('docqa-live-session');
						} catch {}
					}
				} catch {}
			};

			this._ws.onclose = () => {
				if (this._liveChatActive) {
					this._returnToAi();
					this._showStatusCard('disconnected');
				}
				try {
					sessionStorage.removeItem('docqa-live-session');
				} catch {}
			};
		}

		_returnToAi() {
			this._liveChatActive = false;
			this._liveChatSessionId = null;
			if (this._ws) {
				this._ws.close();
				this._ws = null;
			}
			try {
				sessionStorage.removeItem('docqa-live-session');
			} catch {}
			this._updateModeBar();
		}

		_showStatusCard(type) {
			// 移除之前的状态卡片
			const old = this.$.messages.querySelector('.ha-status-card');
			if (old) old.remove();

			const div = document.createElement('div');
			div.className = 'msg assistant';

			if (type === 'disconnected') {
				const card = this._buildStatusCard('👋', t('humanAgentDisconnected'), t('modeAi'));
				div.appendChild(card);
			} else if (type === 'idle_warning') {
				const card = this._buildStatusCard('⏰', t('idleWarning'), null, 'ha-status-warning');
				const btn = document.createElement('button');
				btn.className = 'ha-status-btn';
				btn.textContent = t('keepAlive');
				btn.onclick = () => {
					if (this._ws && this._ws.readyState === WebSocket.OPEN) {
						this._ws.send(JSON.stringify({ type: 'heartbeat' }));
					}
					div.remove();
				};
				card.appendChild(btn);
				div.appendChild(card);
			} else if (type === 'idle_timeout') {
				const card = this._buildStatusCard('⏱️', t('idleTimeout'), t('modeAi'));
				div.appendChild(card);
				this._returnToAi();
			}

			this.$.messages.appendChild(div);
			this.$.messages.scrollTop = this.$.messages.scrollHeight;
		}

		_buildStatusCard(icon, text, hint, extraClass) {
			const card = document.createElement('div');
			card.className = 'ha-status-card' + (extraClass ? ' ' + extraClass : '');
			const iconEl = document.createElement('div');
			iconEl.className = 'ha-status-icon';
			iconEl.textContent = icon;
			const textEl = document.createElement('div');
			textEl.className = 'ha-status-text';
			textEl.textContent = text;
			card.append(iconEl, textEl);
			if (hint) {
				const hintEl = document.createElement('div');
				hintEl.className = 'ha-status-hint';
				hintEl.textContent = hint;
				card.appendChild(hintEl);
			}
			return card;
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
						const config = this._haConfig || (await api.getHumanAgentConfig());
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
			// 录音中点发送：先停止听写，保留已识别文字
			if (this._rec) this._stopVoice();
			const text = this.$.textarea.value.trim();
			if (!text) return;

			// 人工客服关键词检测
			const lowerText = text.toLowerCase().trim();
			const isHumanTrigger = HUMAN_AGENT_TRIGGERS.some((kw) => lowerText === kw || lowerText.includes(kw));
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
					console.error('[Webnav.ai] Human agent config check failed:', e);
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
			msgDiv.textContent = t('typing');
			const dots = document.createElement('span');
			dots.className = 'typing-dots';
			dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
			msgDiv.appendChild(dots);
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
				// AI Actions：工具状态/确认/结果卡片
				let confirmData = null;
				let actionCards = [];
				const setToolStatus = (label) => {
					msgDiv.classList.remove('typing');
					let s = msgDiv.querySelector('.action-status');
					if (!s) {
						s = document.createElement('div');
						s.className = 'action-status';
						s.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;opacity:.7;padding:2px 0;';
						msgDiv.appendChild(s);
					}
					s.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span> ' + this._esc(label);
					this.$.messages.scrollTop = this.$.messages.scrollHeight;
				};

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
								} else if (parsed.error.startsWith('[MODEL_ERROR]') || parsed.error.startsWith('[MODEL_NOT_CONFIGURED]')) {
									// 模型侧故障：只给通用提示，绝不显示上游错误细节
									fullText = t('errorReply');
								} else {
									fullText = parsed.error;
								}
								break;
							}
							// AI Actions 事件：正在执行某动作（临时状态气泡）
							if (parsed.tool_call) {
								setToolStatus(parsed.tool_call.label || t('actionRunning'));
								continue;
							}
							// 读操作结构化结果卡片
							if (parsed.action_result) {
								if (parsed.action_result.display) actionCards.push(parsed.action_result.display);
								continue;
							}
							// 写操作需用户确认 -> 记录，流结束后渲染按钮
							if (parsed.confirm_required) {
								confirmData = parsed.confirm_required;
								continue;
							}
							if (parsed.content) {
								if (firstChunk) {
									msgDiv.classList.remove('typing');
									var st = msgDiv.querySelector('.action-status');
									if (st) st.remove();
									if (!msgDiv.querySelector('.action-card')) msgDiv.textContent = '';
									firstChunk = false;
								}
								fullText += parsed.content;
								// 实时更新显示（纯文本，最终再渲染 Markdown）
								var existingCards = msgDiv.querySelector('.action-card');
								if (!existingCards) {
									msgDiv.textContent = fullText;
								}
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
					this.$.messages.replaceChildren();
					var dWrap = document.createElement('div');
					dWrap.className = 'quota-exceeded-wrap';
					var dInner = document.createElement('div');
					dInner.className = 'quota-exceeded';
					var dIcon = document.createElement('div');
					dIcon.className = 'quota-icon';
					dIcon.textContent = '🔒';
					var dTitle = document.createElement('div');
					dTitle.className = 'quota-title';
					dTitle.textContent = t('domainNotFoundTitle');
					var dDesc = document.createElement('div');
					dDesc.className = 'quota-desc';
					dDesc.textContent = t('domainNotFoundDesc');
					dInner.append(dIcon, dTitle, dDesc);
					dWrap.appendChild(dInner);
					this.$.messages.appendChild(dWrap);
					this.$.textarea.disabled = true;
					this.$.textarea.placeholder = t('domainNotFoundTitle');
					this.$.sendBtn.disabled = true;
				} else {
					await loadMarked();
					var st2 = msgDiv.querySelector('.action-status');
					if (st2) st2.remove();
					msgDiv.innerHTML = fullText ? renderMarkdown(fullText) : '';
					linkifyTextNodes(msgDiv);
					if (VOICE_ON && this._autoSpeak && fullText) this._speak(fullText);
					// 渲染读操作结果卡片
					for (var ci = 0; ci < actionCards.length; ci++) {
						msgDiv.appendChild(this._buildActionCard(actionCards[ci]));
					}
					// 渲染写操作确认卡片（下单/退款）
					if (confirmData) {
						msgDiv.appendChild(this._buildConfirmCard(confirmData, msgDiv));
					}
				}
				this.$.messages.scrollTop = this.$.messages.scrollHeight;

				// 保存 AI 回复到 IndexedDB（含读操作结果卡片，刷新后可还原）
				await db.addMessage(this.currentSessionId, 'assistant', fullText, actionCards);

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
						} catch (e) {
							return res.updatedAt;
						}
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
			this.shadowRoot.querySelectorAll('.settings-theme-btn').forEach(function (btn) {
				var active = (btn.getAttribute('data-theme') === 'dark') === isDark;
				btn.classList.toggle('active', active);
			});
		}

		// 反映自动朗读开关的视觉状态
		_syncAutoSpeakBtn() {
			if (!this.$ || !this.$.autoSpeakBtn) return;
			this.$.autoSpeakBtn.classList.toggle('on', !!this._autoSpeak);
			this.$.autoSpeakBtn.setAttribute('aria-checked', this._autoSpeak ? 'true' : 'false');
		}

		async _showSidebar() {
			this.$.settingsPanel.classList.add('hidden');
			this.$.sidebar.classList.remove('hidden');
			const sessions = await db.listSessions();
			this.$.sessionList.replaceChildren();

			if (sessions.length === 0) {
				const empty = document.createElement('div');
				empty.style.cssText = 'text-align:center;color:var(--text-secondary);padding:20px;font-size:13px;';
				empty.textContent = t('noSessions');
				this.$.sessionList.appendChild(empty);
				return;
			}

			for (const s of sessions) {
				const item = document.createElement('div');
				item.className = `session-item${s.id === this.currentSessionId ? ' active' : ''}`;
				const titleSpan = document.createElement('span');
				titleSpan.className = 'session-item-title';
				titleSpan.textContent = s.title;
				const delBtn = document.createElement('button');
				delBtn.className = 'session-item-delete';
				delBtn.title = '删除';
				delBtn.textContent = '\u00D7';
				item.append(titleSpan, delBtn);
				titleSpan.onclick = () => this._switchSession(s.id);
				delBtn.onclick = async (e) => {
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
			for (const m of msgs) this._appendMsg(m.role, m.content, m.cards);
		}

		_esc(str) {
			const d = document.createElement('div');
			d.textContent = str == null ? '' : String(str);
			return d.innerHTML;
		}

		// ===== 语音输入（Web Speech STT）=====
		// 听写体验：实时上屏(interimResults) + 连续听写(continuous)，把识别文字填入输入框，
		// 说完后由用户检查再发送，不自动发送、不覆盖已输入内容。
		// 绑定麦克风按钮：触屏设备用「按住说话、松手转写」；桌面用点击切换。
		_bindVoiceButton() {
			const btn = this.$.voiceBtn;
			if (!btn) return;
			if (SUPPORTS_TOUCH && _CAN_RECORD) {
				btn.title = t('voiceHold');
				btn.style.touchAction = 'none';
				const start = (e) => {
					if (e) e.preventDefault();
					if (this._mediaRec || this._holding) return;
					if (typeof window !== 'undefined' && window.isSecureContext === false) {
						this._voiceHint(t('voiceInsecure')); return;
					}
					try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
					this._holding = true;
					this._holdMode = true;
					this._startRecording();
				};
				const end = (e) => {
					if (!this._holding) return;
					this._holding = false;
					if (e) e.preventDefault();
					this._stopRecording();
				};
				btn.addEventListener('touchstart', start, { passive: false });
				btn.addEventListener('touchend', end);
				btn.addEventListener('touchcancel', end);
			} else if (SUPPORTS_TOUCH && !_CAN_RECORD) {
				// 触屏但不支持录音：点击给明确提示，避免静默无反应
				btn.onclick = () => this._voiceHint(t('voiceUnsupported'));
			} else {
				btn.onclick = () => this._toggleVoice();
			}
		}

		// 麦克风按钮（桌面点击）：优先服务端转写（MediaRecorder 录音 → /api/transcribe，国内可用、更准），
		// 不支持录音或后端不可用时降级到浏览器 Web Speech。两种模式都不自动发送。
		_toggleVoice() {
			if (!VOICE_ON) return;
			// 录音转写进行中 → 停止并转写
			if (this._mediaRec) { this._stopRecording(); return; }
			// Web Speech 进行中 → 停止
			if (this._rec) { this._stopVoice(); return; }

			// 非安全环境（非 https/localhost）浏览器会静默拒绝麦克风，先给提示而不是假装在录
			if (typeof window !== 'undefined' && window.isSecureContext === false) {
				this._voiceHint(t('voiceInsecure'));
				return;
			}
			// 开始前停掉正在进行的朗读，避免 TTS 与麦克风争抢音频通道
			try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}

			const canRecord = !this._sttBackendDown && navigator.mediaDevices &&
				navigator.mediaDevices.getUserMedia && typeof window.MediaRecorder !== 'undefined';
			if (canRecord) this._startRecording();
			else if (_SpeechRec) this._startWebSpeech();
			else this._voiceHint(t('voiceUnsupported'));
		}

		// 服务端转写：开始录音
		async _startRecording() {
			if (this._recStarting || this._mediaRec) return;
			this._recStarting = true;
			this._stopRequested = false;
			let stream;
			try {
				stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			} catch (e) {
				this._recStarting = false;
				this._holdMode = false;
				this._voiceHint(t('voiceDenied'));   // 权限被拒/无麦克风
				return;
			}
			let mime = '';
			const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
			for (let i = 0; i < cands.length; i++) {
				if (window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(cands[i])) { mime = cands[i]; break; }
			}
			let mr;
			try { mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
			catch (e) { try { stream.getTracks().forEach((tr) => tr.stop()); } catch {} this._recStarting = false; if (_SpeechRec && !SUPPORTS_TOUCH) this._startWebSpeech(); else this._voiceHint(t('voiceUnsupported')); return; }

			const chunks = [];
			mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
			mr.onstop = async () => {
				try { stream.getTracks().forEach((tr) => tr.stop()); } catch {}
				this._mediaRec = null;
				if (this.$.voiceBtn) this.$.voiceBtn.classList.remove('recording');
				const blob = new Blob(chunks, { type: (mr.mimeType || mime || 'audio/webm') });
				if (!blob.size) { this._setVoiceState('idle'); return; }
				await this._transcribeBlob(blob);
			};
			this._mediaRec = mr;
			this._recStarting = false;
			if (this.$.voiceBtn) this.$.voiceBtn.classList.add('recording');
			this._setVoiceState('recording');
			try { mr.start(); } catch (e) { this._stopRecording(); return; }
			// 「按住说话」时用户在授权/启动期间就松手了 → 立即停止，避免录音残留
			if (this._stopRequested) { this._stopRequested = false; this._stopRecording(); }
		}

		// 停止录音（触发 onstop → 转写）。启动期间被调用则标记，待 recorder 就绪后立即停。
		_stopRecording() {
			if (this._recStarting && !this._mediaRec) { this._stopRequested = true; return; }
			if (this._mediaRec) { try { this._mediaRec.stop(); } catch {} }
		}

		// 上传录音到后端转写，把润色后的文本填入输入框（不自动发送）
		async _transcribeBlob(blob) {
			this._setVoiceState('transcribing');   // 强调色边框 + 转圈 + 锁定输入框
			const dataUri = await new Promise((res) => {
				const fr = new FileReader();
				fr.onload = () => res(fr.result);
				fr.onerror = () => res(null);
				fr.readAsDataURL(blob);
			});
			if (!dataUri) { this._setVoiceState('idle'); this._voiceHint(t('voiceNoSpeech')); return; }
			try {
				const resp = await fetch(`${SERVER}/api/transcribe`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						domain: DOMAIN,
						audio: dataUri,
						lang: (this._sttLang && this._sttLang !== 'auto') ? this._sttLang : LANG,
					}),
				});
				if (!resp.ok) throw new Error('http ' + resp.status);
				const data = await resp.json();
				const text = ((data && (data.text || data.raw)) || '').trim();
				this._setVoiceState('idle');   // 先解锁输入框再填字
				if (!text) { this._voiceHint(t('voiceNoSpeech')); return; }
				const base = this.$.textarea.value;
				this.$.textarea.value = base ? (base.replace(/\s*$/, '') + ' ' + text) : text;
				this.$.textarea.dispatchEvent(new Event('input'));
				try { this.$.textarea.focus(); } catch {}
			} catch (e) {
				// 后端转写不可用 → 标记降级，下次改用浏览器 Web Speech；提示用户再说一次
				if (_SpeechRec) this._sttBackendDown = true;
				this._setVoiceState('idle');
				this._voiceHint(t('voiceNoSpeech'));
			}
		}

		// 浏览器 Web Speech 听写（降级方案）：实时上屏 + 连续听写，不自动发送
		_startWebSpeech() {
			let rec;
			try { rec = new _SpeechRec(); } catch (err) { this._rec = null; return; }

			// 听写语言：访客在设置里选的优先；auto 则跟随界面语言 LANG。语言不匹配是“识别不出”的首因。
			const langMap = { zh: 'zh-CN', zht: 'zh-TW', ja: 'ja-JP', ko: 'ko-KR', en: 'en-US' };
			const sttLang = (this._sttLang && this._sttLang !== 'auto') ? this._sttLang : LANG;
			rec.lang = langMap[sttLang] || 'en-US';
			rec.interimResults = true;   // 边说边实时显示
			rec.continuous = true;       // 连续听写，不被一次停顿打断
			rec.maxAlternatives = 1;

			// 以开始听写前已有的文本为基线，已确定的片段追加其后；临时结果实时拼接展示。
			this._voiceBase = this.$.textarea.value;
			this._voiceGotResult = false;   // 本次会话是否识别出过文字（用于无结果提示）
			this._voiceErr = false;         // 是否已因致命错误给过提示
			this._voiceRetries = 0;         // 连续空重启计数，防止静默空转

			rec.onresult = (e) => {
				this._voiceGotResult = true;
				this._voiceRetries = 0;
				let finalText = '';
				let interim = '';
				for (let i = e.resultIndex; i < e.results.length; i++) {
					const seg = e.results[i][0].transcript;
					if (e.results[i].isFinal) finalText += seg;
					else interim += seg;
				}
				if (finalText) this._voiceBase += finalText;
				this.$.textarea.value = this._voiceBase + interim;
				// 复用输入框的自动高度逻辑
				this.$.textarea.dispatchEvent(new Event('input'));
			};

			rec.onend = () => {
				// continuous 模式下部分浏览器会因静音自动结束；用户未主动停止则自动重启，保持流畅。
				// 但若一直没识别出文字（语言不符/无麦克风/无网络），限制重启次数，避免“在录却永远没字”。
				if (this._rec === rec && this._voiceActive) {
					if (this._voiceGotResult || this._voiceRetries < 3) {
						this._voiceRetries++;
						try { rec.start(); return; } catch {}
					}
				}
				this._rec = null;
				this._voiceActive = false;
				if (this.$.voiceBtn) this.$.voiceBtn.classList.remove('recording');
				this.$.textarea.placeholder = t('inputPlaceholder');
				// 整场没识别出任何文字，且没报过致命错误 → 提示“没听清”，避免静默失败
				if (!this._voiceGotResult && !this._voiceErr) this._voiceHint(t('voiceNoSpeech'));
				try { this.$.textarea.focus(); } catch {}
			};

			rec.onerror = (ev) => {
				const err = ev && ev.error;
				if (err === 'not-allowed' || err === 'service-not-allowed') {
					this._voiceActive = false;   // 权限问题，别再自动重启
					this._voiceErr = true;
					this._voiceHint(t('voiceDenied'));
				} else if (err === 'audio-capture') {
					this._voiceActive = false;   // 找不到麦克风
					this._voiceErr = true;
					this._voiceHint(t('voiceNoMic'));
				}
				// no-speech / aborted / network 等交给 onend 处理（受限重启 + 无结果提示）
			};

			this._rec = rec;
			this._voiceActive = true;
			this.$.voiceBtn.classList.add('recording');
			this.$.textarea.placeholder = t('voiceListening');
			try { rec.start(); } catch (err) { this._stopVoice(); }
		}

		// 主动停止听写：保留输入框内文字，由 onend 完成收尾（恢复占位符/聚焦）。
		_stopVoice() {
			this._voiceActive = false;
			if (this._rec) { try { this._rec.stop(); } catch {} }
		}

		// 听写反馈：把提示文案临时写进输入框 placeholder，几秒后或开始录音时恢复。
		_voiceHint(msg) {
			if (!msg || !this.$ || !this.$.textarea) return;
			const ta = this.$.textarea;
			ta.placeholder = msg;
			clearTimeout(this._voiceHintTimer);
			this._voiceHintTimer = setTimeout(() => {
				if (!this._voiceActive) ta.placeholder = t('inputPlaceholder');
			}, 3500);
		}

		// 语音状态视觉：'recording'(录音中,红点) / 'transcribing'(转写中,强调色边框+转圈) / 'idle'(恢复)
		// 录音与转写期间禁用输入框，让用户清楚正处在语音转文字流程中。
		_setVoiceState(state) {
			const $ = this.$;
			const ia = $.inputArea, ta = $.textarea, vs = $.voiceStatus, vt = $.voiceStatusText;
			if (ia) ia.classList.remove('voice-recording', 'voice-transcribing');
			if (state === 'recording' || state === 'transcribing') {
				if (ta) ta.disabled = true;
				if (ia) ia.classList.add(state === 'recording' ? 'voice-recording' : 'voice-transcribing');
				if (vt) {
					// 按住说话时提示“松手发送”，点击模式提示“聆听中”
					const recText = this._holdMode ? 'voiceReleaseSend' : 'voiceListening';
					vt.textContent = t(state === 'recording' ? recText : 'voiceTranscribing');
				}
				if (vs) vs.classList.remove('hidden');
			} else {
				if (ta) ta.disabled = false;
				if (vs) vs.classList.add('hidden');
				this._holdMode = false;
			}
		}

		// ===== 语音播报（Web Speech TTS）=====
		_speak(markdownText) {
			try {
				if (!('speechSynthesis' in window)) return;
				// 去除 markdown 标记，取纯文本
				const plain = String(markdownText).replace(/[#*`_>\[\]()]/g, '').replace(/!\S+/g, '').slice(0, 500);
				if (!plain.trim()) return;
				window.speechSynthesis.cancel();
				const u = new SpeechSynthesisUtterance(plain);
				const langMap = { zh: 'zh-CN', zht: 'zh-TW', ja: 'ja-JP', ko: 'ko-KR', en: 'en-US' };
				u.lang = langMap[LANG] || 'en-US';
				window.speechSynthesis.speak(u);
			} catch {}
		}

		// 渲染读操作（查单/查物流）的结构化结果卡片。
		// display 约定：{ title, fields:[{label,value}], items:[{title,desc,time}] }
		_buildActionCard(display) {
			const card = document.createElement('div');
			card.className = 'action-card';
			card.style.cssText = 'border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 12px;margin:8px 0;font-size:13px;background:rgba(127,127,127,.04);';
			let html = '';
			if (display && display.title) {
				html += `<div style="font-weight:600;margin-bottom:6px;">${this._esc(display.title)}</div>`;
			}
			if (display && display.subtitle) {
				html += `<div style="opacity:.65;margin-bottom:8px;line-height:1.45;">${this._esc(display.subtitle)}</div>`;
			}
			if (display && Array.isArray(display.fields)) {
				for (const f of display.fields) {
					html += `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;"><span style="opacity:.6;">${this._esc(f.label)}</span><span>${this._esc(f.value)}</span></div>`;
				}
			}
			if (display && Array.isArray(display.items)) {
				html += '<div style="margin-top:6px;border-left:2px solid var(--accent,#3b82f6);padding-left:10px;">';
				for (const it of display.items) {
					html += `<div style="padding:3px 0;"><div>${this._esc(it.title || it.desc)}</div>` +
						(it.time ? `<div style="opacity:.5;font-size:12px;">${this._esc(it.time)}</div>` : '') + '</div>';
				}
				html += '</div>';
			}
			// 商品推荐：横向滚动的商品卡（含多图轮播 / 规格 / 详情链接）
			if (display && Array.isArray(display.products) && display.products.length) {
				html += this._buildProductsHTML(display.products);
			}
			// 快捷入口按钮（通用）：把工具结果里的深链渲染为可点击按钮，新标签打开。
			if (display && Array.isArray(display.buttons) && display.buttons.length) {
				html += this._buildButtonsHTML(display.buttons);
			}
			card.innerHTML = html || this._esc(JSON.stringify(display));
			// 让商品列表与每张卡的多图轮播都支持鼠标拖拽滑动（触屏走原生滚动）
			card.querySelectorAll('.wn-prod-scroll, .wn-prod-gallery').forEach((el) => this._enableDragScroll(el));
			// 初始化每个商品的图片轮播（圆点/计数/箭头）
			card.querySelectorAll('.wn-gallery-wrap').forEach((w) => this._initGallery(w));
			// 单选表单：radio 选项 + 提交按钮（选中前禁用）。点击后把模板消息发回对话。
			if (display && Array.isArray(display.options) && display.options.length && display.submit) {
				this._appendChoiceForm(card, display);
			}
			return card;
		}

		// 通用单选卡：display.options=[{label,value,hint}] + display.submit={label?,prompt}。
		// 选中一项后启用提交按钮；点击则用所选项替换 prompt 里的 {value}/{label} 并作为用户消息发送。
		_appendChoiceForm(card, display) {
			const wrap = document.createElement('div');
			wrap.style.cssText = 'margin-top:10px;display:flex;flex-direction:column;gap:7px;';
			let selected = null;
			const rows = [];
			for (const opt of display.options) {
				if (!opt || opt.value == null) continue;
				const row = document.createElement('div');
				row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border,#e5e7eb);border-radius:12px;cursor:pointer;transition:border-color .15s,background .15s;';
				const dot = document.createElement('span');
				dot.style.cssText = 'flex:none;width:17px;height:17px;border-radius:50%;border:2px solid var(--border,#cbd5e1);box-sizing:border-box;transition:all .15s;';
				const txt = document.createElement('div');
				txt.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:1px;';
				const lbl = document.createElement('div');
				lbl.style.cssText = 'font-weight:500;';
				lbl.textContent = opt.label || String(opt.value);
				txt.appendChild(lbl);
				if (opt.hint) {
					const h = document.createElement('div');
					h.style.cssText = 'opacity:.55;font-size:12px;';
					h.textContent = opt.hint;
					txt.appendChild(h);
				}
				row.append(dot, txt);
				row.onclick = () => {
					selected = opt;
					for (const r of rows) {
						r.row.style.borderColor = 'var(--border,#e5e7eb)';
						r.row.style.background = 'transparent';
						r.dot.style.borderColor = 'var(--border,#cbd5e1)';
						r.dot.style.boxShadow = 'none';
					}
					row.style.borderColor = 'var(--accent,#3b82f6)';
					row.style.background = 'rgba(59,130,246,.07)';
					dot.style.borderColor = 'var(--accent,#3b82f6)';
					dot.style.boxShadow = 'inset 0 0 0 4px var(--accent,#3b82f6)';
					submitBtn.disabled = false;
					submitBtn.style.opacity = '1';
					submitBtn.style.cursor = 'pointer';
				};
				rows.push({ row, dot });
				wrap.appendChild(row);
			}
			const submitBtn = document.createElement('button');
			submitBtn.textContent = (display.submit && display.submit.label) || t('chooseGenerate');
			submitBtn.disabled = true;
			submitBtn.style.cssText = 'margin-top:3px;padding:10px;border:none;border-radius:12px;background:var(--accent,#3b82f6);color:#fff;font-size:13px;font-weight:600;cursor:not-allowed;opacity:.5;transition:opacity .15s;';
			submitBtn.onclick = () => {
				if (!selected || submitBtn.disabled) return;
				const sub = display.submit || {};
				const fill = (s) => String(s)
					.replace(/\{value\}/g, selected.value)
					.replace(/\{label\}/g, selected.label || selected.value);
				// 锁定本卡，避免重复提交
				submitBtn.disabled = true;
				submitBtn.style.opacity = '.6';
				submitBtn.style.cursor = 'default';
				for (const r of rows) {
					r.row.style.pointerEvents = 'none';
					r.row.style.opacity = '.65';
				}
				// 优先 url：直接导航（默认当前窗口）。root-relative 按宿主页面 origin 解析，
				// 不用 BASE_URL（本地可能是生产域名）。
				if (sub.url) {
					const u = fill(sub.url);
					const target = u.charAt(0) === '/' ? (window.location.origin + u) : u;
					if (sub.target === '_blank') {
						window.open(target, '_blank', 'noopener,noreferrer');
					} else {
						window.location.href = target;
					}
					return;
				}
				// 兜底：作为下一条用户消息发送，交给模型处理
				this.$.textarea.value = fill(sub.prompt || '{value}');
				this._send();
			};
			wrap.appendChild(submitBtn);
			card.appendChild(wrap);
		}

		// 通用按钮组：display.buttons = [{label, url, style?}]。相对路径自动前缀 BASE_URL，
		// 一律新标签打开。style==='secondary' 渲染描边次按钮，其余为主按钮。
		_buildButtonsHTML(buttons) {
			let h = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">';
			let any = false;
			for (const b of buttons) {
				if (!b || !b.url) continue;
				any = true;
				const raw = String(b.url);
				const href = raw.startsWith('/') ? `${BASE_URL}${raw}` : raw;
				const secondary = b.style === 'secondary';
				const skin = secondary
					? 'background:transparent;color:inherit;border:1px solid var(--border,#e5e7eb);'
					: 'background:var(--accent,#3b82f6);color:#fff;border:none;';
				h += `<a href="${this._esc(href)}" target="_blank" rel="noopener" style="${skin}text-decoration:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:500;white-space:nowrap;">${this._esc(b.label || 'Open')}</a>`;
			}
			h += '</div>';
			return any ? h : '';
		}

		// 鼠标拖拽横向滚动（桌面端补足，触屏沿用原生惯性滚动）。拖拽后吞掉误触 click。
		_enableDragScroll(el) {
			if (!el) return;
			el.style.cursor = 'grab';
			let down = false, moved = false, startX = 0, startScroll = 0;
			const onDown = (e) => {
				down = true; moved = false;
				startX = e.pageX; startScroll = el.scrollLeft;
				el.style.cursor = 'grabbing'; el.style.userSelect = 'none';
			};
			const onMove = (e) => {
				if (!down) return;
				const dx = e.pageX - startX;
				if (Math.abs(dx) > 3) moved = true;
				el.scrollLeft = startScroll - dx;
				e.preventDefault();
			};
			const onUp = () => { down = false; el.style.cursor = 'grab'; el.style.userSelect = ''; };
			el.addEventListener('mousedown', onDown);
			el.addEventListener('mousemove', onMove);
			el.addEventListener('mouseup', onUp);
			el.addEventListener('mouseleave', onUp);
			el.addEventListener('dragstart', (e) => e.preventDefault());
			// 拖拽过程中误触的链接点击不放行
			el.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
		}

		// 商品横向滚动区：每张卡含图片轮播（单图展示+滑动翻页）、名称、价格、规格、详情链接
		_buildProductsHTML(products) {
			const CARD_W = 196;            // 商品卡宽度
			let h = '<div class="wn-prod-scroll" style="display:flex;gap:12px;overflow-x:auto;margin-top:10px;padding-bottom:8px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none;">';
			for (const p of products) {
				const imgs = Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []);
				const url = p.url || '#';
				const multi = imgs.length > 1;
				// 图片轮播：每张图占满整个画廊宽度，scroll-snap 强制单图翻页
				const slides = imgs.map(u =>
					`<img src="${this._esc(u)}" alt="${this._esc(p.name || '')}" loading="lazy" draggable="false" style="width:100%;height:100%;flex:0 0 100%;object-fit:cover;scroll-snap-align:start;background:#f0f1f5;pointer-events:none;"/>`
				).join('');
				const counter = multi
					? `<div class="wn-gallery-count" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.5);color:#fff;font-size:11px;line-height:1;padding:3px 7px;border-radius:20px;backdrop-filter:blur(2px);">1/${imgs.length}</div>` : '';
				const dots = multi
					? `<div class="wn-gallery-dots" style="position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;gap:5px;pointer-events:none;">`
						+ imgs.map((_, i) => `<span style="width:6px;height:6px;border-radius:50%;background:${i === 0 ? '#fff' : 'rgba(255,255,255,.5)'};transition:all .2s;box-shadow:0 0 2px rgba(0,0,0,.3);"></span>`).join('')
						+ `</div>` : '';
				const arrows = multi
					? `<button class="wn-gallery-prev" aria-label="上一张" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;border:none;border-radius:50%;background:rgba(255,255,255,.85);color:#333;cursor:pointer;display:none;align-items:center;justify-content:center;font-size:15px;box-shadow:0 1px 4px rgba(0,0,0,.2);padding:0;">‹</button>`
						+ `<button class="wn-gallery-next" aria-label="下一张" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;border:none;border-radius:50%;background:rgba(255,255,255,.85);color:#333;cursor:pointer;display:none;align-items:center;justify-content:center;font-size:15px;box-shadow:0 1px 4px rgba(0,0,0,.2);padding:0;">›</button>` : '';
				const gallery = imgs.length
					? `<div class="wn-gallery-wrap" style="position:relative;width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;">`
						+ `<div class="wn-prod-gallery" style="display:flex;width:100%;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;touch-action:pan-x;scrollbar-width:none;">${slides}</div>`
						+ counter + dots + arrows
						+ `</div>`
					: '';
				const specs = Array.isArray(p.specs) && p.specs.length
					? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">`
						+ p.specs.slice(0, 6).map(s => `<span style="font-size:11px;border:1px solid var(--border,#e5e7eb);border-radius:6px;padding:1px 7px;opacity:.75;">${this._esc(s)}</span>`).join('')
						+ `</div>`
					: '';
				const price = (p.price !== undefined && p.price !== null)
					? `<span style="color:#f5222d;font-weight:700;font-size:16px;">¥${this._esc(p.price)}</span>` : '';
				h += `<div class="wn-prod-card" style="flex:0 0 ${CARD_W}px;width:${CARD_W}px;border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:10px;background:var(--bg,#fff);scroll-snap-align:start;box-shadow:0 1px 3px rgba(0,0,0,.05);">`
					+ gallery
					+ `<div style="font-weight:600;font-size:13px;margin-top:8px;line-height:1.35;">${this._esc(p.name || '')}</div>`
					+ (p.desc ? `<div style="opacity:.55;font-size:11px;margin-top:3px;line-height:1.4;">${this._esc(p.desc)}</div>` : '')
					+ specs
					+ `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:6px;">`
					+ price
					+ `<a href="${this._esc(url)}" target="_blank" rel="noopener" style="font-size:12px;text-decoration:none;background:var(--accent,#3b82f6);color:#fff;border-radius:7px;padding:5px 12px;white-space:nowrap;font-weight:500;">查看详情</a>`
					+ `</div></div>`;
			}
			h += '</div>';
			return h;
		}

		// 初始化单个商品图片轮播：滑动/箭头翻页 + 圆点&计数同步 + 悬停显示箭头
		_initGallery(wrap) {
			if (!wrap) return;
			const track = wrap.querySelector('.wn-prod-gallery');
			if (!track) return;
			const dots = wrap.querySelectorAll('.wn-gallery-dots span');
			const counter = wrap.querySelector('.wn-gallery-count');
			const prev = wrap.querySelector('.wn-gallery-prev');
			const next = wrap.querySelector('.wn-gallery-next');
			const total = track.children.length;
			const idxOf = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
			const sync = () => {
				const i = Math.min(total - 1, Math.max(0, idxOf()));
				dots.forEach((d, di) => {
					d.style.background = di === i ? '#fff' : 'rgba(255,255,255,.5)';
					d.style.width = d.style.height = '6px';
				});
				if (counter) counter.textContent = (i + 1) + '/' + total;
			};
			const go = (i) => {
				const t = Math.min(total - 1, Math.max(0, i));
				track.scrollTo({ left: t * track.clientWidth, behavior: 'smooth' });
			};
			track.addEventListener('scroll', () => { window.requestAnimationFrame(sync); }, { passive: true });
			if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); go(idxOf() - 1); });
			if (next) next.addEventListener('click', (e) => { e.stopPropagation(); go(idxOf() + 1); });
			// 桌面端悬停显示左右箭头
			wrap.addEventListener('mouseenter', () => { if (prev) prev.style.display = 'flex'; if (next) next.style.display = 'flex'; });
			wrap.addEventListener('mouseleave', () => { if (prev) prev.style.display = 'none'; if (next) next.style.display = 'none'; });
		}

		// 渲染写操作（下单/退款）的确认卡片，含 确认/取消 按钮。
		_buildConfirmCard(data, hostMsgDiv) {
			const card = document.createElement('div');
			card.className = 'action-card action-confirm';
			card.style.cssText = 'border:1px solid var(--accent,#3b82f6);border-radius:10px;padding:12px;margin:8px 0;font-size:13px;';
			const shieldIcon = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--accent,#3b82f6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>';
			let html = `<div style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:8px;">${shieldIcon}<span>${this._esc(data.summary || t('actionConfirmTitle'))}</span></div>`;
			const params = (data.params && typeof data.params === 'object') ? data.params : {};
			if (Array.isArray(params.items)) {
				// 多件下单：逐行列出商品 + 数量
				for (const it of params.items) {
					const obj = it || {};
					const nm = obj.name || obj.sku || '';
					const skuTag = (obj.name && obj.sku) ? ` <span style="opacity:.5;">${this._esc(obj.sku)}</span>` : '';
					const qty = (obj.quantity != null) ? obj.quantity : 1;
					html += `<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;"><span>${this._esc(nm)}${skuTag}</span><span>× ${this._esc(qty)}</span></div>`;
				}
				// 其余字段（如 address）
				for (const k of Object.keys(params)) {
					if (k === 'items') continue;
					html += `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;border-top:1px solid var(--border-color);margin-top:4px;padding-top:6px;"><span style="opacity:.6;">${this._esc(k)}</span><span>${this._esc(params[k])}</span></div>`;
				}
			} else {
				for (const k of Object.keys(params)) {
					html += `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;"><span style="opacity:.6;">${this._esc(k)}</span><span>${this._esc(params[k])}</span></div>`;
				}
			}
			card.innerHTML = html;
			const btnRow = document.createElement('div');
			btnRow.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
			const confirmBtn = document.createElement('button');
			confirmBtn.textContent = t('actionConfirm');
			confirmBtn.style.cssText = 'flex:1;padding:7px;border:none;border-radius:8px;background:var(--accent,#3b82f6);color:#fff;cursor:pointer;font-size:13px;';
			const cancelBtn = document.createElement('button');
			cancelBtn.textContent = t('actionCancel');
			cancelBtn.style.cssText = 'flex:1;padding:7px;border:1px solid var(--border,#e5e7eb);border-radius:8px;background:transparent;color:inherit;cursor:pointer;font-size:13px;';
			btnRow.append(confirmBtn, cancelBtn);
			// 安全说明：一次性 + 受 Webnav 保护，提升确认窗口的专业度与可信度。
			const security = document.createElement('div');
			security.style.cssText = 'opacity:.55;font-size:12px;margin-top:8px;';
			security.textContent = t('actionConfirmSecurity');
			card.appendChild(security);
			card.appendChild(btnRow);

			cancelBtn.onclick = () => {
				btnRow.remove();
				const note = document.createElement('div');
				note.style.cssText = 'opacity:.6;margin-top:6px;';
				note.textContent = t('actionCancelled');
				card.appendChild(note);
			};
			confirmBtn.onclick = async () => {
				confirmBtn.disabled = true;
				cancelBtn.disabled = true;
				confirmBtn.textContent = t('actionProcessing');
				try {
					const result = await api.confirmAction(data.pending_id, data.hmac);
					btnRow.remove();
					if (result && result.ok) {
						if (result.display) card.appendChild(this._buildActionCard(result.display));
						const ok = document.createElement('div');
						ok.style.cssText = 'color:#16a34a;margin-top:6px;';
						ok.textContent = t('actionDone');
						card.appendChild(ok);
						// 把写操作结果（如订单号）写入对话历史，供后续“刚刚的订单退款”等带上下文
						if (this.currentSessionId && result.display) {
							db.addMessage(this.currentSessionId, 'assistant', '', [result.display]).catch(() => {});
						}
					} else if (result && result.display) {
						// 结构化业务错误（如 AUTH_REQUIRED 未登录）——渲染卡片+按钮（含登录入口），
						// 而非仅一行红字，提升未登录等场景的确认窗口体验。
						card.appendChild(this._buildActionCard(result.display));
						if (result.message) {
							const note = document.createElement('div');
							note.style.cssText = 'opacity:.6;margin-top:6px;font-size:12px;';
							note.textContent = result.message;
							card.appendChild(note);
						}
					} else {
						const err = document.createElement('div');
						err.style.cssText = 'color:#dc2626;margin-top:6px;';
						err.textContent = (result && result.message) || t('actionFailed');
						card.appendChild(err);
					}
				} catch {
					const err = document.createElement('div');
					err.style.cssText = 'color:#dc2626;margin-top:6px;';
					err.textContent = t('actionFailed');
					card.appendChild(err);
				}
				this.$.messages.scrollTop = this.$.messages.scrollHeight;
			};
			return card;
		}
	}

	if (!customElements.get('chat-widget')) {
		customElements.define('chat-widget', ChatWidget);
	}

	// 对外 API：SPA 可在用户登录后动态设置访客身份令牌（用于 AI Actions）。
	window.WebnavWidget = window.WebnavWidget || {};
	window.WebnavWidget.setUserToken = function (token) {
		USER_TOKEN = token || '';
	};
	// 对外 API：宿主页面可主动上报线索（如自有表单提交时）。
	window.WebnavWidget.captureLead = function (data) {
		return api.submitLead(data || {});
	};

	// 路由排除：data-exclude 配置不显示 Widget 的路径（逗号分隔，支持 * 通配符）
	const excludeAttr = scriptTag && scriptTag.getAttribute('data-exclude');
	const shouldExclude = (() => {
		if (!excludeAttr) return false;
		const path = window.location.pathname;
		return excludeAttr.split(',').some((pattern) => {
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
