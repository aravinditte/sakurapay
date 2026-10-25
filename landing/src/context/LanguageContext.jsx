import { createContext, useContext, useState, useEffect } from "react";

export const translations = {
	ENG: {
		nav: {
			simulator: "Simulator",
			payments: "Payments",
			ledger: "Ledger",
			webhooks: "Webhooks",
			reconciliation: "Reconciliation",
			docs: "Docs",
			signIn: "Sign in",
			signOut: "Sign out",
			runDemo: "Run the demo",
			openMenu: "Open menu",
			closeMenu: "Close menu",
		},
		hero: {
			kicker: "Live · Payment reliability simulator · Tokyo",
			titleLine1: "Every payment,",
			titleLine2: "settled",
			titleLine3: "exactly once.",
			copy: "SakuraPay stays correct under retries, races and failures — idempotent payments, a balanced double-entry ledger, and webhooks that always arrive.",
			ctaDemo: "Try the live demo",
			ctaDocs: "Read the docs",
		},
		telemetry: {
			signal: "Signal",
			bitrate: "Bitrate",
			buffer: "Buffer",
			ladder: "Ladder",
			tuning: "Tuning…",
			unmute: "Unmute background video",
			mute: "Mute background video",
		},
		edge: {
			left: "SAKURAPAY · PAYMENT RELIABILITY PLATFORM",
			right: "35.68°N — 139.69°E · TOKYO · LEDGER NODE 01",
		},
		auth: {
			title: "Authenticate",
			badge: "JWT + Argon2id",
			email: "Email Address",
			password: "Password",
			submit: "Authenticate with Backend",
			authenticating: "Authenticating…",
			quickFill: "Quick-fill Test Credentials:",
			merchantDemo: "Merchant Demo",
			adminDemo: "Admin Auditor",
			securityNote: "Passwords hashed via Argon2id. Tokens signed via HMAC-SHA256 with 60-minute expiry.",
		},
		sim: {
			title: "Payment Simulator Console",
			badge: "Live Backend & Chaos Engine",
			targetApi: "Target API:",
			scenarios: "Scenarios",
			runScenario: "Run Selected Scenario",
			running: "Executing Scenario…",
			clearConsole: "Clear Console",
			dbInspector: "PostgreSQL State Inspector",
			paymentId: "Payment ID",
			status: "Payment Status",
			captured: "Captured Amount",
			ledgerSum: "Double-Entry Ledger Delta",
			demo1Title: "Demo 1: End-to-End Payment (Happy Path)",
			demo1Desc: "Intent creation → Authorization (APPROVED) → Capture → Balanced double-entry ledger postings.",
			demo2Title: "Demo 2: Idempotency Protection (Duplicate Request)",
			demo2Desc: "Submit payment twice with identical key → returns cached 200 response → zero duplicate rows.",
			demo3Title: "Demo 3: Concurrent Over-Refund Protection",
			demo3Desc: "Row-level locking serializes concurrent requests → rejects over-refund exceeding captured amount.",
			demo4Title: "Demo 4: Webhook Outbox & HMAC Verification",
			demo4Desc: "Atomic outbox event → HMAC-SHA256 signature → exponential backoff delivery retry.",
			demo5Title: "Demo 5: Financial Reconciliation Sweep",
			demo5Desc: "Audit ledger balance consistency (Sum = 0) → detect deliberate financial discrepancies.",
		},
		payments: {
			title: "Payments Lifecycle",
			badge: "State Machine",
			createTitle: "Create Payment Intent",
			amountMinor: "Amount (Minor Units / Cents / Yen)",
			currency: "Currency",
			customerRef: "Customer Reference",
			orderDesc: "Order Description",
			submitCreate: "Create Payment",
			creating: "Creating payment…",
			activeDetails: "Active Payment Details",
			status: "Status",
			created: "Created",
			actions: "Lifecycle Actions",
			btnCapture: "Capture Payment",
			btnRefund: "Refund Payment",
			recentPayments: "Recent Payments",
		},
		ledger: {
			title: "Double-Entry Ledger",
			badge: "Append-Only Immutable",
			expl: "Every financial transfer posts balanced debits and credits. Historical records are immutable; corrections require compensating transactions.",
			balanced: "Balanced: Sum = 0",
			type: "Transaction Type",
			currency: "Currency",
			entriesTitle: "Posted Journal Entries",
			accId: "Account ID",
			accType: "Entry Description",
			delta: "Amount Delta",
		},
		recon: {
			title: "Financial Reconciliation",
			badge: "Auditing Engine",
			expl: "Reconciliation independently re-computes ledger account balances, verifies parent payment state vs ledger entries, and detects discrepancies without altering historical evidence.",
			trigger: "Trigger Reconciliation Sweep",
			auditing: "Auditing Records…",
			runId: "Run ID",
			recordsInspected: "Records Inspected",
			checksPassed: "Checks Passed",
			checksFailed: "Checks Failed",
			check1: "All posted double-entry transactions sum to zero",
			check2: "Ledger currencies match parent transaction currency",
			check3: "Every capture operation has a posted ledger transaction",
			check4: "Cumulative refunds do not exceed captured amounts",
			check5: "Materialized account balances match ledger-derived calculation",
		},
		webhooks: {
			title: "Webhook Management & HMAC",
			badge: "Transactional Outbox",
			expl: "Webhooks are stored atomically in a database outbox within the same transaction as the payment state change, signed with HMAC-SHA256, and dispatched with exponential backoff retry.",
			regTitle: "Register Webhook Endpoint",
			url: "Callback URL",
			regBtn: "Register Endpoint",
			registering: "Registering endpoint…",
			endpointsTitle: "Configured Endpoints",
			signingSecret: "HMAC Signing Secret:",
			status: "Status:",
			active: "ACTIVE",
		},
		docs: {
			title: "Engineering Architecture & Formal Methods",
			badge: "Technical Whitepaper",
			tabMethods: "Engineering Methods",
			tabAdrs: "Architectural Decision Records (ADRs)",
			tabPapers: "Research Papers & References",
		},
	},
	日本語: {
		nav: {
			simulator: "シミュレーター",
			payments: "決済",
			ledger: "台帳",
			webhooks: "Webhook",
			reconciliation: "財務照合",
			docs: "ドキュメント",
			signIn: "ログイン",
			signOut: "ログアウト",
			runDemo: "デモ実行",
			openMenu: "メニューを開く",
			closeMenu: "メニューを閉じる",
		},
		hero: {
			kicker: "稼働中 · 決済信頼性シミュレーター · 東京",
			titleLine1: "すべての決済を、",
			titleLine2: "確実に",
			titleLine3: "一度だけ。",
			copy: "SakuraPayは再試行、並行競合、ネットワーク障害時でも厳密な整合性を保証します — 冪等性決済、不変の複式簿記台帳、そして確実に到達するWebhook。",
			ctaDemo: "ライブデモを実行",
			ctaDocs: "技術文書を読む",
		},
		telemetry: {
			signal: "映像信号",
			bitrate: "ビットレート",
			buffer: "バッファ",
			ladder: "画質階層",
			tuning: "調整中…",
			unmute: "動画音声を再生",
			mute: "動画をミュート",
		},
		edge: {
			left: "SAKURAPAY · 決済信頼性検証プラットフォーム",
			right: "35.68°N — 139.69°E · 東京 · 元帳ノード 01",
		},
		auth: {
			title: "加盟店認証",
			badge: "JWT + Argon2id",
			email: "メールアドレス",
			password: "パスワード",
			submit: "バックエンドで認証する",
			authenticating: "認証処理中…",
			quickFill: "テスト用認証情報の自動入力:",
			merchantDemo: "加盟店デモアカウント",
			adminDemo: "監査人デモアカウント",
			securityNote: "パスワードはArgon2idでハッシュ化。トークンはHMAC-SHA256で署名され60分間有効です。",
		},
		sim: {
			title: "決済シミュレーター・コンソール",
			badge: "ライブバックエンド & カオス障害エンジン",
			targetApi: "対象API:",
			scenarios: "検証シナリオ",
			runScenario: "選択したシナリオを実行",
			running: "シナリオ実行中…",
			clearConsole: "コンソール消去",
			dbInspector: "PostgreSQL 状態インスペクター",
			paymentId: "決済ID",
			status: "決済ステータス",
			captured: "売上確定額",
			ledgerSum: "複式簿記差引合計",
			demo1Title: "シナリオ 1: エンドツーエンド決済 (正常系)",
			demo1Desc: "インテント作成 → 承認 (APPROVED) → 売上確定 → 平衡した複式簿記台帳への記帳。",
			demo2Title: "シナリオ 2: 冪等性保護 (重複リクエスト)",
			demo2Desc: "同一キーで2度送信 → キャッシュされた200レスポンスを返却 → 重複レコード発生ゼロ。",
			demo3Title: "シナリオ 3: 並行超過返金保護",
			demo3Desc: "行レベルロックで行を直列化 → 売上確定額を超える超過返金を安全に拒否。",
			demo4Title: "シナリオ 4: Webhook Outbox & HMAC署名検証",
			demo4Desc: "不可分なOutboxイベント → HMAC-SHA256署名 → 指数バックオフによる自動再試行。",
			demo5Title: "シナリオ 5: 財務照合スイープ",
			demo5Desc: "元帳残高の整合性（合算ゼロ）を監査 → 人為的な不整合や乖離を即座に検出。",
		},
		payments: {
			title: "決済ライフサイクル",
			badge: "有限状態機械",
			createTitle: "新規決済インテント作成",
			amountMinor: "金額 (最小通貨単位 / セント・円)",
			currency: "通貨",
			customerRef: "顧客参照コード",
			orderDesc: "注文摘要",
			submitCreate: "決済を作成する",
			creating: "決済を作成中…",
			activeDetails: "選択中の決済詳細",
			status: "ステータス",
			created: "作成日時",
			actions: "ライフサイクル操作",
			btnCapture: "売上確定 (Capture)",
			btnRefund: "全額返金 (Refund)",
			recentPayments: "最近の決済一覧",
		},
		ledger: {
			title: "複式簿記台帳",
			badge: "追記型・不変元帳",
			expl: "すべての資金移動は平衡する借方（Debit）と貸方（Credit）として記帳されます。過去のレコードは不変であり、修正には必ず反対仕訳を発行します。",
			balanced: "貸借平衡: 合計 = 0",
			type: "取引種別",
			currency: "通貨",
			entriesTitle: "記帳された仕訳エントリー",
			accId: "勘定科目ID",
			accType: "仕訳摘要",
			delta: "変動額",
		},
		recon: {
			title: "財務照合エンジン",
			badge: "監査エンジン",
			expl: "財務照合機能は元帳口座残高を独立して再計算し、親決済ステータスと元帳エントリーを突合して、証跡レコードを変更することなく不整合を検出します。",
			trigger: "照合監査スイープを実行",
			auditing: "監査実行中…",
			runId: "実行ID",
			recordsInspected: "検査レコード数",
			checksPassed: "合格チェック項目",
			checksFailed: "不合格項目",
			check1: "すべての記帳済み複式簿記取引の合計がゼロ（貸借平衡）",
			check2: "元帳の通貨コードが親トランザクションと一致",
			check3: "すべての売上確定操作に対応する元帳仕訳が存在",
			check4: "累計返金額が売上確定総額を超過していない",
			check5: "マテリアライズド口座残高が元帳からの再計算値と完全一致",
		},
		webhooks: {
			title: "Webhook管理 & HMAC署名",
			badge: "トランザクショナルOutbox",
			expl: "Webhookは決済状態の変更と同一のトランザクション内でデータベースOutboxに不可分に保存され、HMAC-SHA256で署名されて指数バックオフで配信されます。",
			regTitle: "Webhookエンドポイントの登録",
			url: "コールバックURL",
			regBtn: "エンドポイントを登録",
			registering: "エンドポイントを登録中…",
			endpointsTitle: "登録済みエンドポイント一覧",
			signingSecret: "HMAC署名秘密鍵:",
			status: "状態:",
			active: "有効",
		},
		docs: {
			title: "アーキテクチャ・設計手法・学術参照",
			badge: "技術ホワイトペーパー",
			tabMethods: "設計手法 & 不変条件",
			tabAdrs: "意思決定記録 (ADR)",
			tabPapers: "学術論文 & 標準仕様",
		},
	},
};

export const LanguageContext = createContext({
	lang: "ENG",
	setLang: () => {},
	toggleLang: () => {},
	isJa: false,
	t: (section, key) => key,
});

export function LanguageProvider({ children }) {
	const [lang, setLang] = useState("ENG");

	useEffect(() => {
		document.documentElement.lang = lang === "日本語" ? "ja" : "en";
		if (lang === "日本語") {
			document.body.classList.add("is-ja");
		} else {
			document.body.classList.remove("is-ja");
		}
	}, [lang]);

	const toggleLang = () => {
		setLang((prev) => (prev === "ENG" ? "日本語" : "ENG"));
	};

	const isJa = lang === "日本語";

	const t = (section, key) => {
		const dict = translations[lang] || translations.ENG;
		return dict[section]?.[key] ?? translations.ENG[section]?.[key] ?? key;
	};

	return (
		<LanguageContext.Provider value={{ lang, setLang, toggleLang, isJa, t }}>
			{children}
		</LanguageContext.Provider>
	);
}

export function useLanguage() {
	return useContext(LanguageContext);
}
