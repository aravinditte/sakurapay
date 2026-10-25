import { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const METHODS = [
	{
		id: "METHOD-01",
		title: "Pessimistic Concurrency & Row Locks",
		titleJa: "悲観的並行制御 & 行レベルロック直列化",
		tag: "PostgreSQL · SELECT FOR UPDATE",
		description:
			"Pessimistic row-level locking via PostgreSQL `SELECT ... FOR UPDATE` serializes concurrent mutations on payment intents. Prevents race conditions and over-refunding when multiple concurrent requests attempt to capture or refund the same transaction simultaneously.",
		descriptionJa:
			"PostgreSQLの行レベル排他ロック（SELECT ... FOR UPDATE）により、同一決済に対する並行操作を直列化します。複数のワーカープロセスが同時に売上確定や返金を要求した場合でも、行ロックが競合を解決し、売上額を超える超過返金や状態破損を完全に防ぎます。",
		invariants: [
			"Exclusive row acquisition before balance evaluation",
			"Non-blocking inspection via SKIP LOCKED where applicable",
			"Strict serialization across concurrent worker threads",
		],
		invariantsJa: [
			"残高判定前に必ず排他行ロックを獲得",
			"適時SKIP LOCKEDによるノンブロッキング検証",
			"並行ワーカープロセス間での確実な直列化保証",
		],
	},
	{
		id: "METHOD-02",
		title: "Double-Entry Ledger & Algebraic Invariance",
		titleJa: "複式簿記台帳 & 貸借ゼロサム代数的不変性",
		tag: "Double-Entry · Balanced Zero-Sum",
		description:
			"All financial value transfers post balanced, signed double-entry ledger transactions (`ledger_entries`). Historical ledger rows are immutable and append-only. Corrections and full/partial refunds require compensating journal entries, never destructive row mutation.",
		descriptionJa:
			"すべての資金移動は平衡する借方（Debit）と貸方（Credit）の仕訳エントリーとして不変元帳に記帳されます。過去のレコードの更新・削除は厳格に禁止されており、返金や修正はすべて反対仕訳（補償トランザクション）を発行して監査可能性を担保します。",
		invariants: [
			"Algebraic zero-sum rule: sum(amount_delta) = 0 for every transaction",
			"Historical ledger immutability: zero UPDATE or DELETE permissions",
			"Account balance reconstruction: sum(entries) equals current ledger balance",
		],
		invariantsJa: [
			"代数的ゼロサム則: 取引ごとの仕訳合算が厳密にゼロ",
			"台帳の不変性: 追記専用でありUPDATE/DELETEを禁止",
			"口座残高の再計算: 過去の仕訳累計が現在残高と完全一致",
		],
	},
	{
		id: "METHOD-03",
		title: "Transactional Outbox Pattern",
		titleJa: "トランザクショナルOutboxパターン",
		tag: "Dual-Write Elimination · At-Least-Once",
		description:
			"Domain state changes and outgoing webhook event records are committed within the same atomic database transaction (`outbox_events`). An asynchronous background worker polls pending outbox entries, eliminating the distributed dual-write hazard between the database and external network calls.",
		descriptionJa:
			"決済状態の変更と送信対象のWebhookイベントは、単一のデータベーストランザクション内で不可分にコミットされます。非同期バックグラウンドワーカーが保留中のOutboxをポーリング配信することで、DBコミット成功と外部通信失敗による二重書き込み不整合（Dual-Write Hazard）を根本から排除します。",
		invariants: [
			"Zero lost webhooks on application process crashes",
			"Atomic linkage between business state transitions and event emission",
			"Decoupled publisher latency from user-facing checkout response time",
		],
		invariantsJa: [
			"プロセス強制終了時でもイベント消失ゼロを保証",
			"ビジネス状態遷移とイベント生成の不可分な結合",
			"外部HTTP遅延をユーザー向けレスポンスから完全分離",
		],
	},
	{
		id: "METHOD-04",
		title: "Deterministic Idempotency Key Engine",
		titleJa: "決定論的冪等性キー制御エンジン",
		tag: "IETF Draft · SHA-256 Fingerprinting",
		description:
			"Mutation endpoints require a unique client `Idempotency-Key` and SHA-256 payload fingerprint. If a duplicate request arrives with the exact same payload, the engine serves the cached response without re-executing business logic. Reusing a key with mismatched parameters rejects with 409 Conflict.",
		descriptionJa:
			"データ更新APIはクライアント生成のIdempotency-Keyとリクエスト全体のSHA-256ハッシュを要求します。同一キーかつ同一パラメータの再試行にはキャッシュされた200/201レスポンスを返却し、二重課金を防ぎます。パラメータが異なる同一キーの再利用は409 Conflictとして安全に拒絶します。",
		invariants: [
			"Exactly-once mutation semantics under aggressive network retries",
			"Cryptographic hash fingerprinting prevents payload tampering under the same key",
			"Atomic lock acquisition guarantees zero duplicate database records",
		],
		invariantsJa: [
			"頻繁なネットワーク再試行時でも1回のみの処理を保証",
			"暗号学的ハッシュ照合によりキー再利用時のパラメータ改ざんを検知",
			"アトミックなキーロックにより重複レコードの発生を完全に排除",
		],
	},
	{
		id: "METHOD-05",
		title: "HMAC-SHA256 Signatures & Jittered Backoff",
		titleJa: "HMAC-SHA256署名 & 指数バックオフ配信",
		tag: "RFC 2104 · FIPS 198-1 · Exponential Backoff",
		description:
			"Webhook payloads are cryptographically signed using symmetric HMAC-SHA256 secret keys transmitted in the `X-SakuraPay-Signature` header. Delivery retries employ exponential backoff with full randomized jitter to prevent thundering-herd degradation on merchant endpoints.",
		descriptionJa:
			"Webhookペイロードは共有秘密鍵を用いたHMAC-SHA256ダイジェストで署名され、X-SakuraPay-Signatureヘッダーとして送信されます。障害時の配信再試行にはランダムジッターを加えた指数バックオフを採用し、加盟店サーバーへのリクエスト集中（Thundering Herd）を防ぎます。",
		invariants: [
			"Cryptographic payload authenticity and integrity verification",
			"Retry ceiling with dead-letter queue classification on terminal failure",
			"Randomized jitter smoothing prevents server-side synchronization spikes",
		],
		invariantsJa: [
			"暗号学的署名によるペイロード完全性と改ざん検知",
			"再試行上限と最終失敗時のデッドレター分類",
			"ランダムジッターによる負荷スパイクの平滑化",
		],
	},
	{
		id: "METHOD-06",
		title: "Offline Financial Reconciliation Sweeps",
		titleJa: "非同期オフライン財務照合スイープ",
		tag: "Read-Only Auditor · Invariant Verification",
		description:
			"An isolated scheduled audit process sweeps PostgreSQL state to mathematically audit integrity rules: verified zero ledger discrepancy (Sum = 0), currency parity, refund-to-capture ceiling compliance, and materialized balance identity—without taking locks on live checkout operations.",
		descriptionJa:
			"本番決済トランザクションの行ロックを妨げることなく、独立したオフラインバッチがデータベース状態を網羅的に走査します。台帳貸借平衡（合計ゼロ）、通貨一致、返金上限額、マテリアライズド残高一致などの数学的整合性ルールを厳密に監査・レポートします。",
		invariants: [
			"Zero contention with online OLTP checkout transactions",
			"Read-only non-mutating audit guarantees audit trail purity",
			"Immediate reporting and alerting on balance discrepancies",
		],
		invariantsJa: [
			"本番OLTP決済処理とのロック競合ゼロ",
			"読み取り専用監査により証跡レコードの汚染を防止",
			"残高不整合や乖離を即座に検出・レポート",
		],
	},
];

const ADRS = [
	{
		id: "ADR-001",
		title: "Why a Modular Monolith?",
		titleJa: "なぜモジュラーモノリスなのか？",
		text: "Starting with microservices introduces distributed 2PC/Sagas before basic financial invariants are proven. A modular monolith simplifies database transactions across payments, ledger, and refunds while preserving modular boundaries for future extraction.",
		textJa: "基本の金融不変条件が証明される前にマイクロサービスを導入すると、分散2PCやSagaパターンの複雑さに直面します。モジュラーモノリスは、将来の分離境界を維持しながら、決済・元帳・返金にまたがる単一DBトランザクションを明快に保証します。",
	},
	{
		id: "ADR-002",
		title: "Why PostgreSQL for Concurrency?",
		titleJa: "なぜ並行制御にPostgreSQLを採用したのか？",
		text: "PostgreSQL provides robust row-level locking (SELECT ... FOR UPDATE, SKIP LOCKED), unique constraints, and ACID transactions. In-memory locks fail immediately across multiple worker processes.",
		textJa: "PostgreSQLは堅牢な行レベルロック（SELECT ... FOR UPDATE, SKIP LOCKED）、ユニーク制約、ACIDトランザクションを提供します。インメモリロックは複数ワーカープロセス間で破綻しますが、DBロックは確実に直列化します。",
	},
	{
		id: "ADR-003",
		title: "Why Integer Minor Units?",
		titleJa: "なぜ最小通貨単位の整数型(BIGINT)なのか？",
		text: "Floating-point numbers produce binary approximation errors (0.1 + 0.2 = 0.30000000000000004). Using BIGINT integer units (paise/cents/sen) completely eliminates rounding discrepancy.",
		textJa: "浮動小数点数（Float/Double）は二進数近似誤差を生じさせます。最小通貨単位（パイサ/セント/銭）をBIGINT整数で扱うことで、金融計算における端数ズレや丸め誤差を完全に排除します。",
	},
	{
		id: "ADR-004",
		title: "Why an Immutable Ledger?",
		titleJa: "なぜ追記型の不変台帳なのか？",
		text: "Historical ledger entries are append-only audit records. Errors are corrected through compensating transactions rather than editing historical records.",
		textJa: "台帳レコードは追記専用の監査証跡です。過去のレコードを更新・削除することは禁止され、誤記や返金はすべて新たな反対仕訳（補償トランザクション）を記録して修正します。",
	},
	{
		id: "ADR-005",
		title: "Why At-Least-Once Delivery?",
		titleJa: "なぜAt-Least-Once（少なくとも1回到達）なのか？",
		text: "Over lossy networks, exactly-once delivery is impossible under partitions (Two Generals Problem). Webhooks provide at-least-once delivery; the receiver deduplicates using event IDs.",
		textJa: "通信障害のあるネットワークにおいて、完全なExactly-Once配信は理論上不可能です（二人の将軍問題）。WebhookはAt-Least-Onceを保証し、受信側がイベントIDを用いて安全に重複排除を行います。",
	},
	{
		id: "ADR-006",
		title: "Why Separate Reconciliation?",
		titleJa: "なぜ照合プロセスを分離するのか？",
		text: "OLTP transactions optimize for low latency. Reconciliation audits truth-sources offline on scheduled intervals without contending for locks on live checkout operations.",
		textJa: "OLTP（決済処理）は低レイテンシに最適化する必要があります。財務照合はスケジュールされたオフラインバッチで実行され、本番決済トランザクションの行ロックを奪い合うことなく整合性を監査します。",
	},
];

const PAPERS = [
	{
		id: "REF-01",
		author: "Pat Helland",
		year: "2016",
		title: "Life beyond Distributed Transactions: An Apostate's Opinion",
		venue: "ACM Queue, Vol. 14, Issue 5; and CIDR",
		summary:
			"Demonstrates why distributed transactions across independent boundaries fail at scale. Proves that reliable distributed systems must rely on entity-scoped atomic transactions, idempotency keys, and at-least-once messaging with receiver-side deduplication.",
		summaryJa:
			"スケーラブルな分散システムにおいて分散2PCトランザクションが破綻する理由を論証。エンティティ単位の局所的ACIDトランザクション、冪等性キー、および受信側での重複排除を前提としたAt-Least-Onceメッセージングの必然性を提示した金字塔的論文。",
		relevance:
			"Direct theoretical basis for SakuraPay's modular entity boundaries, avoiding distributed Sagas/2PC in favor of localized PostgreSQL transactions and outbox idempotency.",
		relevanceJa:
			"SakuraPayのモジュラー境界設計の基礎理論。分散Sagaや2PCを避け、PostgreSQLの単一DBトランザクションとOutbox冪等性による非同期連携を採用した根拠。",
	},
	{
		id: "REF-02",
		author: "Jim Gray & Andreas Reuter",
		year: "1993",
		title: "Transaction Processing: Concepts and Techniques",
		venue: "Morgan Kaufmann Publishers, ISBN: 978-1558601901",
		summary:
			"The definitive text establishing the formal foundations of transaction processing: ACID guarantees, isolation levels, serializability, Write-Ahead Logging (WAL), and compensating transactions for non-undoable real-world side effects.",
		summaryJa:
			"トランザクション処理の学術的基礎を確立した決定的一冊。ACID特性、分離レベル、直列化可能性、先行書き込みログ（WAL）、および物理的に取り消せない実世界アクションに対する補償トランザクションの概念を体系化。",
		relevance:
			"Establishes SakuraPay's row-level lock serialization (SELECT FOR UPDATE) and compensating ledger transactions instead of destructive row deletion.",
		relevanceJa:
			"SakuraPayの行レベルロック直列化（SELECT FOR UPDATE）および過去レコードを削除・変更せず補償仕訳で修正する台帳設計の基礎。",
	},
	{
		id: "REF-03",
		author: "Martin Kleppmann",
		year: "2017",
		title: "Designing Data-Intensive Applications",
		venue: "O'Reilly Media, Chapters 7 (Transactions) & 11 (Stream Processing)",
		summary:
			"Provides rigorous analysis of concurrency anomalies, the dual-write problem between databases and message queues, linearizability vs. serializability, and state machine replication.",
		summaryJa:
			"データベースとメッセージキュー間の二重書き込み問題（Dual-Write Hazard）、並行処理アノマリー、線形化可能性と直列化可能性の違い、および堅牢な状態遷移の設計原則を詳述。",
		relevance:
			"Direct implementation blueprint for SakuraPay's Transactional Outbox pattern and atomic event state dispatching.",
		relevanceJa:
			"SakuraPayのTransactional Outboxパターンおよび状態遷移とイベント発行を不可分にコミットするアーキテクチャの直接的設計基盤。",
	},
	{
		id: "REF-04",
		author: "IETF HTTPAPI Working Group",
		year: "2023",
		title: "The Idempotency-Key HTTP Header Field",
		venue: "IETF Internet-Draft (draft-ietf-httpapi-idempotency-key)",
		summary:
			"Formal specification standardizing the client-provided Idempotency-Key HTTP header to prevent duplicate execution of mutating REST requests under network timeouts and connection drops.",
		summaryJa:
			"ネットワークタイムアウトや接続切断時におけるREST APIの二重実行を防止するため、クライアントが送信するIdempotency-Keyヘッダーの標準的な処理仕様を規定したIETF標準ドラフト。",
		relevance:
			"SakuraPay implements standard-compliant Idempotency-Key headers, request payload fingerprinting via SHA-256, cached 200/201 replay, and 409 Conflict detection.",
		relevanceJa:
			"SakuraPayにおけるIdempotency-Keyヘッダー、SHA-256ペイロードフィンガープリント、キャッシュ応答再利用、および409 Conflict検知の実装標準。",
	},
	{
		id: "REF-05",
		author: "H. Akkoyunlu, K. Ekanadham, & R. Huber",
		year: "1975",
		title: "Some Constraints and Trade-offs in the Design of Network Communications",
		venue: "Proceedings of the 5th ACM Symposium on Operating Systems Principles (SOSP), pp. 67-74",
		summary:
			"Formulates the foundational Two Generals Problem, mathematically proving that two entities communicating over an unreliable network cannot reach guaranteed common agreement with a bounded number of messages.",
		summaryJa:
			"「二人の将軍問題（Two Generals Problem）」を定式化し、障害が発生しうる通信路を介した2者間では有限回数のメッセージで完全な合意に達することが数学的に不可能であることを証明。",
		relevance:
			"Theoretical basis for rejecting naive exactly-once transport over HTTP and designing SakuraPay webhooks around at-least-once delivery with receiver deduplication.",
		relevanceJa:
			"ネットワークを越えた完全なExactly-Once配信の不可能性を前提とし、WebhookをAt-Least-Once配信＋受信側重複排除として設計する理論的根拠。",
	},
	{
		id: "REF-06",
		author: "Fra Luca Pacioli",
		year: "1494",
		title: "Summa de arithmetica, geometria, proportioni et proportionalita (Particularis de Computis et Scripturis)",
		venue: "Venice, Italy",
		summary:
			"The earliest published mathematical treatise on double-entry bookkeeping (the Venetian method), introducing the fundamental identity that debits must equal credits for every financial transaction.",
		summaryJa:
			"複式簿記（ヴェネツィア方式）に関する人類最古の体系的数学著作。すべての取引において借方（Debit）と貸方（Credit）の総和が完全に一致しなければならない基本恒等式を確立。",
		relevance:
			"SakuraPay's ledger structure strictly enforces Pacioli's invariance: every monetary motion creates balanced debit/credit entries with net zero delta.",
		relevanceJa:
			"SakuraPayの台帳アーキテクチャが厳格に遵守する不変条件。すべての資金移動は平衡する貸借エントリーとして記帳され、合計差分ゼロを保持。",
	},
	{
		id: "REF-07",
		author: "NIST & IETF",
		year: "2002 / 1997",
		title: "The Keyed-Hash Message Authentication Code (HMAC)",
		venue: "NIST FIPS PUB 198-1 & IETF RFC 2104",
		summary:
			"Cryptographic standard specifying message authentication mechanisms utilizing cryptographic hash functions (such as SHA-256) combined with a secret shared key to guarantee message integrity and authenticity.",
		summaryJa:
			"秘密鍵と暗号学的ハッシュ関数（SHA-256等）を組み合わせて、メッセージの改ざん検知と送信元認証を保証する国際暗号標準仕様（FIPS 198-1およびRFC 2104）。",
		relevance:
			"Applied in SakuraPay's webhook delivery pipeline (X-SakuraPay-Signature), allowing merchants to cryptographically verify payload integrity and authenticity.",
		relevanceJa:
			"SakuraPayのWebhook配信パイプライン（X-SakuraPay-Signature）に適用され、加盟店が受信ペイロードの正当性と完全性を検証可能。",
	},
];

export default function DocsModal({ isOpen, onClose }) {
	const [tab, setTab] = useState("methods"); // 'methods' | 'adrs' | 'papers'
	const { t, isJa } = useLanguage();

	if (!isOpen) return null;

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-card modal-card--docs" onClick={(e) => e.stopPropagation()}>
				<div className="modal-head">
					<div className="modal-title">
						<span>{t("docs", "title")}</span>
						<span className="badge">{t("docs", "badge")}</span>
					</div>
					<button type="button" className="modal-close" onClick={onClose} aria-label="Close">
						X
					</button>
				</div>

				<div className="modal-body" style={{ maxHeight: "calc(88dvh - 100px)", overflowY: "auto" }}>
					<div className="modal-tabs">
						<button
							type="button"
							className={`modal-tab${tab === "methods" ? " is-active" : ""}`}
							onClick={() => setTab("methods")}
						>
							{t("docs", "tabMethods")}
						</button>
						<button
							type="button"
							className={`modal-tab${tab === "adrs" ? " is-active" : ""}`}
							onClick={() => setTab("adrs")}
						>
							{t("docs", "tabAdrs")}
						</button>
						<button
							type="button"
							className={`modal-tab${tab === "papers" ? " is-active" : ""}`}
							onClick={() => setTab("papers")}
						>
							{t("docs", "tabPapers")}
						</button>
					</div>

					{/* Methods Tab */}
					{tab === "methods" && (
						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
							{METHODS.map((m) => (
								<div key={m.id} className="qa-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
									<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
										<span style={{ fontSize: "0.74rem", fontFamily: "var(--font-mono)", color: "var(--signal)", letterSpacing: "0.06em" }}>
											{m.id}
										</span>
										<span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", background: "rgba(255, 255, 255, 0.06)", padding: "0.18rem 0.55rem", borderRadius: "999px", color: "var(--paper-dim)" }}>
											{m.tag}
										</span>
									</div>
									<h4 style={{ fontSize: "1.02rem", color: "var(--paper)", fontWeight: 600 }}>
										{isJa ? m.titleJa : m.title}
									</h4>
									<p style={{ fontSize: "0.85rem", color: "var(--paper-dim)", lineHeight: 1.65 }}>
										{isJa ? m.descriptionJa : m.description}
									</p>
									<div style={{ marginTop: "auto", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "0.6rem" }}>
										<div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--signal)", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
											{isJa ? "保証される不変条件:" : "Enforced Invariants:"}
										</div>
										<ul style={{ paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--paper-faint)", lineHeight: 1.6 }}>
											{(isJa ? m.invariantsJa : m.invariants).map((inv, idx) => (
												<li key={idx}>{inv}</li>
											))}
										</ul>
									</div>
								</div>
							))}
						</div>
					)}

					{/* ADR Tab */}
					{tab === "adrs" && (
						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
							{ADRS.map((adr) => (
								<div key={adr.id} className="qa-card">
									<div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--signal)", letterSpacing: "0.05em" }}>
										{adr.id}
									</div>
									<h4 style={{ fontSize: "1rem", color: "var(--paper)", fontWeight: 600 }}>
										{isJa ? adr.titleJa : adr.title}
									</h4>
									<p style={{ fontSize: "0.85rem", color: "var(--paper-dim)", lineHeight: 1.65 }}>
										{isJa ? adr.textJa : adr.text}
									</p>
								</div>
							))}
						</div>
					)}

					{/* Research Papers & References Tab */}
					{tab === "papers" && (
						<div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
							{PAPERS.map((ref) => (
								<div key={ref.id} className="qa-card" style={{ gap: "0.8rem" }}>
									<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
										<div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
											<span style={{ fontSize: "0.74rem", fontFamily: "var(--font-mono)", color: "var(--signal)", fontWeight: 600 }}>
												{ref.id}
											</span>
											<h4 style={{ fontSize: "1.02rem", color: "var(--paper)", fontWeight: 600 }}>
												{ref.title}
											</h4>
										</div>
										<span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--paper-faint)" }}>
											{ref.author} ({ref.year})
										</span>
									</div>

									<div style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--signal-deep, #ff9ebb)" }}>
										Source: {ref.venue}
									</div>

									<p style={{ fontSize: "0.86rem", color: "var(--paper-dim)", lineHeight: 1.65 }}>
										{isJa ? ref.summaryJa : ref.summary}
									</p>

									<div style={{ padding: "0.7rem 0.95rem", borderRadius: "10px", background: "rgba(255, 158, 187, 0.06)", borderLeft: "3px solid var(--signal)" }}>
										<div style={{ fontSize: "0.74rem", fontFamily: "var(--font-mono)", color: "var(--signal)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
											{isJa ? "SakuraPayにおける実装根拠:" : "SakuraPay Architectural Application:"}
										</div>
										<div style={{ fontSize: "0.83rem", color: "var(--paper)", lineHeight: 1.55 }}>
											{isJa ? ref.relevanceJa : ref.relevance}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
