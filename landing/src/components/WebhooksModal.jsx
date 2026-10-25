import { useState, useEffect } from "react";
import { api } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function WebhooksModal({ isOpen, onClose }) {
	const [endpoints, setEndpoints] = useState([]);
	const [url, setUrl] = useState("https://merchant-api.test/webhooks/sakurapay");
	const [msg, setMsg] = useState("");
	const { t } = useLanguage();

	useEffect(() => {
		if (isOpen) {
			loadWebhooks();
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const loadWebhooks = async () => {
		const res = await api.listWebhooks();
		if (res.ok && Array.isArray(res.data)) {
			setEndpoints(res.data);
		} else {
			setEndpoints([
				{
					id: "wh_ep_01a",
					url: "https://merchant-api.test/webhooks/sakurapay",
					signing_secret: "whsec_99182ab38c1192...",
					is_active: true,
				},
			]);
		}
	};

	const handleCreate = async (e) => {
		e.preventDefault();
		setMsg(t("webhooks", "registering"));
		const res = await api.createWebhook(url);
		if (res.ok) {
			setMsg("Webhook endpoint registered with HMAC secret!");
			loadWebhooks();
		} else {
			const mockEp = {
				id: `wh_ep_${Math.random().toString(36).substring(2, 6)}`,
				url,
				signing_secret: `whsec_${Math.random().toString(36).substring(2, 14)}`,
				is_active: true,
			};
			setEndpoints((prev) => [mockEp, ...prev]);
			setMsg(`[Simulated] Registered endpoint ${mockEp.id}`);
		}
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-card" onClick={(e) => e.stopPropagation()}>
				<div className="modal-head">
					<div className="modal-title">
						<span>{t("webhooks", "title")}</span>
						<span className="badge">{t("webhooks", "badge")}</span>
					</div>
					<button type="button" className="modal-close" onClick={onClose} aria-label="Close">
						X
					</button>
				</div>

				<div className="modal-body">
					<p style={{ fontSize: "0.88rem", color: "var(--paper-dim)", margin: "-0.5rem 0 1rem" }}>
						{t("webhooks", "expl")}
					</p>

					{/* Register Form */}
					<form onSubmit={handleCreate} style={{ display: "flex", gap: "0.6rem", marginBottom: "1.25rem" }}>
						<input
							type="url"
							className="input-field"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder={t("webhooks", "url")}
							required
							style={{ flex: 1 }}
						/>
						<button type="submit" className="btn-sakura" style={{ whiteSpace: "nowrap" }}>
							{t("webhooks", "regBtn")}
						</button>
					</form>

					{msg && (
						<div style={{ margin: "0.75rem 0", padding: "0.55rem 0.85rem", background: "rgba(52, 211, 153, 0.08)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "8px", fontSize: "0.82rem", color: "var(--paper)" }}>
							{msg}
						</div>
					)}

					{/* Endpoints List */}
					<div>
						<h5 style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--paper-dim)", marginBottom: "0.6rem" }}>
							{t("webhooks", "endpointsTitle")}
						</h5>
						<div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
							{endpoints.map((ep) => (
								<div
									key={ep.id}
									style={{
										padding: "0.85rem 1rem",
										background: "rgba(0,0,0,0.3)",
										border: "1px solid var(--glass-stroke)",
										borderRadius: "12px",
									}}
								>
									<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
										<span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--signal)" }}>{ep.id}</span>
										<span className="badge" style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.3)" }}>
											{t("webhooks", "active")}
										</span>
									</div>
									<div style={{ fontSize: "0.82rem", color: "var(--paper)", fontFamily: "var(--font-mono)", marginBottom: "0.3rem" }}>
										{ep.url}
									</div>
									<div style={{ fontSize: "0.74rem", color: "var(--paper-dim)", fontFamily: "var(--font-mono)" }}>
										{t("webhooks", "signingSecret")} {ep.signing_secret}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
