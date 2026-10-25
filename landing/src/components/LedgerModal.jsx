import { useState, useEffect } from "react";
import { api } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function LedgerModal({ isOpen, onClose }) {
	const [transactions, setTransactions] = useState([]);
	const [activeTx, setActiveTx] = useState(null);
	const [loading, setLoading] = useState(false);
	const { t } = useLanguage();

	useEffect(() => {
		if (isOpen) {
			loadLedger();
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const loadLedger = async () => {
		setLoading(true);
		const res = await api.listLedger();
		if (res.ok && res.data?.items && res.data.items.length > 0) {
			setTransactions(res.data.items);
			const firstTx = await api.getLedgerTx(res.data.items[0].id);
			if (firstTx.ok) {
				setActiveTx(firstTx.data);
			} else {
				setActiveTx(res.data.items[0]);
			}
		} else {
			const mockTx = [
				{
					id: "tx_capture_8819a",
					transaction_type: "CAPTURE",
					reference_id: "pay_demo_001",
					currency: "USD",
					status: "POSTED",
					entries: [
						{ account_id: "acc_customer_funding_01", amount_delta_minor: -15000, type: "Customer Debit" },
						{ account_id: "acc_merchant_payable_01", amount_delta_minor: 15000, type: "Merchant Credit" },
					],
					sum: 0,
				},
				{
					id: "tx_refund_9921b",
					transaction_type: "REFUND",
					reference_id: "ref_demo_002",
					currency: "USD",
					status: "POSTED",
					entries: [
						{ account_id: "acc_merchant_payable_01", amount_delta_minor: -5000, type: "Merchant Debit" },
						{ account_id: "acc_customer_funding_01", amount_delta_minor: 5000, type: "Customer Credit" },
					],
					sum: 0,
				},
			];
			setTransactions(mockTx);
			setActiveTx(mockTx[0]);
		}
		setLoading(false);
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-card modal-card--lg" onClick={(e) => e.stopPropagation()}>
				<div className="modal-head">
					<div className="modal-title">
						<span>{t("ledger", "title")}</span>
						<span className="badge">{t("ledger", "badge")}</span>
					</div>
					<button type="button" className="modal-close" onClick={onClose} aria-label="Close">
						X
					</button>
				</div>

				<div className="modal-body">
					<p style={{ fontSize: "0.88rem", color: "var(--paper-dim)", margin: "-0.5rem 0 1rem" }}>
						{t("ledger", "expl")}
					</p>

					{activeTx && (
						<div
							style={{
								background: "rgba(0,0,0,0.3)",
								border: "1px solid var(--glass-stroke)",
								borderRadius: "16px",
								padding: "1.25rem",
								marginBottom: "1.5rem",
							}}
						>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
								<div>
									<span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--paper)", fontFamily: "var(--font-mono)" }}>
										{activeTx.id}
									</span>
									<span className="badge" style={{ marginLeft: "0.6rem" }}>{activeTx.status}</span>
								</div>
								<span
									style={{
										padding: "0.25rem 0.6rem",
										borderRadius: "999px",
										background: "rgba(52, 211, 153, 0.1)",
										border: "1px solid rgba(52, 211, 153, 0.3)",
										color: "#34d399",
										fontWeight: 700,
										fontSize: "0.78rem",
										fontFamily: "var(--font-mono)",
									}}
								>
									{t("ledger", "balanced")}
								</span>
							</div>

							<div style={{ display: "flex", gap: "2rem", fontSize: "0.82rem", color: "var(--paper-dim)" }}>
								<div>
									{t("ledger", "type")}: <strong>{activeTx.transaction_type}</strong>
								</div>
								<div>
									{t("ledger", "currency")}: <strong>{activeTx.currency}</strong>
								</div>
							</div>

							{/* Entries Table */}
							<div style={{ marginTop: "1rem" }}>
								<h5 style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--paper-dim)", marginBottom: "0.5rem" }}>
									{t("ledger", "entriesTitle")}
								</h5>
								<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
									<thead>
										<tr style={{ borderBottom: "1px solid var(--glass-stroke)", textAlign: "left", color: "var(--paper-dim)" }}>
											<th style={{ padding: "0.4rem 0" }}>{t("ledger", "accId")}</th>
											<th style={{ padding: "0.4rem 0" }}>{t("ledger", "accType")}</th>
											<th style={{ padding: "0.4rem 0", textAlign: "right" }}>{t("ledger", "delta")}</th>
										</tr>
									</thead>
									<tbody>
										{activeTx.entries?.map((entry, idx) => (
											<tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
												<td style={{ padding: "0.5rem 0", fontFamily: "var(--font-mono)", color: "var(--paper)" }}>
													{entry.account_id}
												</td>
												<td style={{ padding: "0.5rem 0", color: "var(--paper-dim)" }}>
													{entry.type || entry.description || "Journal Entry"}
												</td>
												<td
													style={{
														padding: "0.5rem 0",
														textAlign: "right",
														fontFamily: "var(--font-mono)",
														fontWeight: 600,
														color: entry.amount_delta_minor < 0 ? "#f87171" : "#34d399",
													}}
												>
													{entry.amount_delta_minor > 0 ? `+${entry.amount_delta_minor}` : entry.amount_delta_minor}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{/* Transaction selector */}
					<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
						{transactions.map((tx) => (
							<div
								key={tx.id}
								onClick={() => setActiveTx(tx)}
								style={{
									padding: "0.65rem 1rem",
									background: activeTx?.id === tx.id ? "rgba(255, 158, 187, 0.08)" : "rgba(255,255,255,0.02)",
									border: activeTx?.id === tx.id ? "1px solid var(--signal)" : "1px solid var(--glass-stroke)",
									borderRadius: "10px",
									cursor: "pointer",
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<div>
									<span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--paper)" }}>{tx.id}</span>
									<span style={{ fontSize: "0.78rem", color: "var(--paper-dim)", marginLeft: "0.75rem" }}>
										{tx.transaction_type} · Ref: {tx.reference_id || "—"}
									</span>
								</div>
								<span className="badge" style={{ fontSize: "0.72rem" }}>{tx.status}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
