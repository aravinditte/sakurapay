import { useState } from "react";
import { api } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function AuthModal({ isOpen, onClose, onAuthChange }) {
	const [email, setEmail] = useState("merchant@example.test");
	const [password, setPassword] = useState("demo-password");
	const [error, setError] = useState(null);
	const [isLoading, setIsLoading] = useState(false);
	const { t } = useLanguage();

	if (!isOpen) return null;

	const handleLogin = async (e) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);
		try {
			const res = await api.login(email, password);
			if (res.ok) {
				onAuthChange(api.user);
				onClose();
			} else {
				setError(res.error || "Authentication failed.");
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	};

	const quickFill = (demoEmail, demoPw) => {
		setEmail(demoEmail);
		setPassword(demoPw);
		setError(null);
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
				<div className="modal-head">
					<div className="modal-title">
						<span>{t("auth", "title")}</span>
						<span className="badge">{t("auth", "badge")}</span>
					</div>
					<button type="button" className="modal-close" onClick={onClose} aria-label="Close">
						X
					</button>
				</div>

				<div className="modal-body">
					{error && <div className="error-banner">{error}</div>}

					<form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
						<div className="input-group">
							<label className="input-label">{t("auth", "email")}</label>
							<input
								type="email"
								className="input-field"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>

						<div className="input-group">
							<label className="input-label">{t("auth", "password")}</label>
							<input
								type="password"
								className="input-field"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>

						<button type="submit" className="btn-sakura" style={{ width: "100%", marginTop: "0.5rem" }} disabled={isLoading}>
							{isLoading ? t("auth", "authenticating") : t("auth", "submit")}
						</button>
					</form>

					<div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--glass-stroke)" }}>
						<div className="input-label" style={{ marginBottom: "0.6rem" }}>
							{t("auth", "quickFill")}
						</div>
						<div style={{ display: "flex", gap: "0.5rem" }}>
							<button
								type="button"
								className="btn-outline-sm"
								style={{ flex: 1, padding: "0.45rem", fontSize: "0.78rem" }}
								onClick={() => quickFill("merchant@example.test", "demo-password")}
							>
								{t("auth", "merchantDemo")}
							</button>
							<button
								type="button"
								className="btn-outline-sm"
								style={{ flex: 1, padding: "0.45rem", fontSize: "0.78rem" }}
								onClick={() => quickFill("admin@example.test", "admin-password")}
							>
								{t("auth", "adminDemo")}
							</button>
						</div>
						<p style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "var(--paper-dim)", lineHeight: 1.5 }}>
							{t("auth", "securityNote")}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
