import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function GlassNav({ user, onOpenModal, onLogout }) {
	const [open, setOpen] = useState(false);
	const { lang, setLang, t } = useLanguage();

	const NAV_ITEMS = [
		{ id: "simulator", label: t("nav", "simulator") },
		{ id: "payments", label: t("nav", "payments") },
		{ id: "ledger", label: t("nav", "ledger") },
		{ id: "webhooks", label: t("nav", "webhooks") },
		{ id: "reconciliation", label: t("nav", "reconciliation") },
		{ id: "docs", label: t("nav", "docs") },
	];

	useEffect(() => {
		if (!open) return undefined;
		const close = (event) => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", close);
		return () => window.removeEventListener("keydown", close);
	}, [open]);

	const handleNavClick = (id) => {
		setOpen(false);
		onOpenModal(id);
	};

	return (
		<header className="nav reveal" style={{ "--reveal-order": 0 }}>
			<div className="nav__glass">
				<a
					className="nav__brand"
					href="#top"
					aria-label="SakuraPay home"
					onClick={(e) => {
						e.preventDefault();
						onOpenModal("simulator");
					}}
				>
					<svg className="nav__mark" viewBox="0 0 32 32" aria-hidden="true">
						<circle
							cx="16"
							cy="16"
							r="6"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.4"
						/>
						<circle
							cx="16"
							cy="16"
							r="12"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.2"
							strokeDasharray="3.4 4.6"
							opacity="0.55"
						/>
					</svg>
					<span className="nav__wordmark">
						SakuraPay
					</span>
				</a>

				<nav className="nav__links" aria-label="Primary">
					{NAV_ITEMS.map((item) => (
						<button
							key={item.id}
							type="button"
							className="nav__link"
							style={{ background: "none", border: "none", cursor: "pointer" }}
							onClick={() => handleNavClick(item.id)}
						>
							{item.label}
						</button>
					))}
				</nav>

				<div className="nav__actions">
					<button
						type="button"
						className="nav__lang-toggle"
						onClick={() => setLang((prev) => (prev === "ENG" ? "日本語" : "ENG"))}
						aria-label="Toggle language / 言語切替"
						title="Toggle language / 言語切替"
					>
						<span className={`nav__lang-label${lang === "ENG" ? " is-active" : ""}`}>ENG</span>
						<span className="nav__lang-sep">/</span>
						<span className={`nav__lang-label${lang === "日本語" ? " is-active" : ""}`}>日本語</span>
					</button>

					<a
						href="https://github.com/aravinditte/sakurapay"
						target="_blank"
						rel="noopener noreferrer"
						className="nav__github"
						aria-label="GitHub Repository"
						title="GitHub: aravinditte/sakurapay"
					>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
							<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
						</svg>
					</a>

					{user ? (
						<div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
							<span
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: "0.74rem",
									color: "var(--signal)",
									background: "rgba(255, 158, 187, 0.1)",
									border: "1px solid rgba(255, 158, 187, 0.25)",
									padding: "0.25rem 0.6rem",
									borderRadius: "999px",
								}}
							>
								{user.role || "MERCHANT"}
							</span>
							<button
								type="button"
								className="nav__signin"
								style={{ background: "none", border: "none", cursor: "pointer" }}
								onClick={onLogout}
							>
								{t("nav", "signOut")}
							</button>
						</div>
					) : (
						<button
							type="button"
							className="nav__signin"
							style={{ background: "none", border: "none", cursor: "pointer" }}
							onClick={() => onOpenModal("auth")}
						>
							{t("nav", "signIn")}
						</button>
					)}

					<button
						type="button"
						className="nav__cta"
						style={{ border: "none", cursor: "pointer" }}
						onClick={() => onOpenModal("simulator")}
					>
						{t("nav", "runDemo")}
						<span className="nav__cta-dot" aria-hidden="true" />
					</button>

					<button
						type="button"
						className={`nav__burger${open ? " is-open" : ""}`}
						aria-expanded={open}
						aria-controls="mobile-menu"
						aria-label={open ? t("nav", "closeMenu") : t("nav", "openMenu")}
						onClick={() => setOpen((v) => !v)}
					>
						<span />
						<span />
					</button>
				</div>
			</div>

			<div id="mobile-menu" className={`nav__sheet${open ? " is-open" : ""}`}>
				{NAV_ITEMS.map((item, i) => (
					<button
						key={item.id}
						type="button"
						className="nav__sheet-link"
						style={{ "--sheet-order": i, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
						onClick={() => handleNavClick(item.id)}
					>
						<span className="nav__sheet-index">0{i + 1}</span>
						{item.label}
					</button>
				))}
				<button
					type="button"
					className="nav__sheet-link nav__sheet-link--cta"
					style={{ "--sheet-order": NAV_ITEMS.length, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
					onClick={() => handleNavClick("simulator")}
				>
					<span className="nav__sheet-index">→</span>
					{t("nav", "runDemo")}
				</button>

				<div className="nav__sheet-footer">
					<button
						type="button"
						className="nav__lang-toggle"
						onClick={() => setLang((prev) => (prev === "ENG" ? "日本語" : "ENG"))}
						aria-label="Toggle language / 言語切替"
					>
						<span className={`nav__lang-label${lang === "ENG" ? " is-active" : ""}`}>ENG</span>
						<span className="nav__lang-sep">/</span>
						<span className={`nav__lang-label${lang === "日本語" ? " is-active" : ""}`}>日本語</span>
					</button>

					<a
						href="https://github.com/aravinditte/sakurapay"
						target="_blank"
						rel="noopener noreferrer"
						className="nav__sheet-github"
						aria-label="GitHub Repository"
					>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
							<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
						</svg>
						<span>GitHub</span>
					</a>
				</div>
			</div>
		</header>
	);
}
