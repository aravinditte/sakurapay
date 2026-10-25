import { useState, useEffect } from "react";
import { api } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function PaymentsModal({ isOpen, onClose }) {
	const [payments, setPayments] = useState([]);
	const [loading, setLoading] = useState(false);
	const [activePayment, setActivePayment] = useState(null);
	const { t } = useLanguage();

	// Form
	const [amount, setAmount] = useState(15000);
	const [currency, setCurrency] = useState("USD");
	const [customerRef, setCustomerRef] = useState("cust_demo_01");
	const [desc, setDesc] = useState("Test Order");
	const [actionMsg, setActionMsg] = useState("");

	useEffect(() => {
		if (isOpen) {
			loadPayments();
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const loadPayments = async () => {
		setLoading(true);
		const res = await api.listPayments();
		if (res.ok && res.data?.items) {
			setPayments(res.data.items);
			if (res.data.items.length > 0 && !activePayment) {
				setActivePayment(res.data.items[0]);
			}
		} else {
			const mock = [
				{
					id: "pay_9f28a1c4-001",
					amount_minor: 15000,
					currency: "USD",
					status: "CAPTURED",
					customer_reference: "cust_demo_01",
					created_at: new Date().toISOString(),
				},
				{
					id: "pay_8b31c2d5-002",
					amount_minor: 25000,
					currency: "USD",
					status: "AUTHORIZED",
					customer_reference: "cust_demo_02",
					created_at: new Date().toISOString(),
				},
			];
			setPayments(mock);
			setActivePayment(mock[0]);
		}
		setLoading(false);
	};

	const handleCreate = async (e) => {
		e.preventDefault();
		setActionMsg(t("payments", "creating"));
		const idemKey = `idem_${Date.now()}`;
		const res = await api.createPayment({
			amount_minor: Number(amount),
			currency,
			customer_reference: customerRef,
			description: desc,
		}, idemKey);

		if (res.ok && res.data) {
			setActionMsg(`Payment ${res.data.id} created! (Status: ${res.data.status})`);
			loadPayments();
		} else {
			const mockNew = {
				id: `pay_${Math.random().toString(36).substring(2, 9)}`,
				amount_minor: Number(amount),
				currency,
				status: "CREATED",
				customer_reference: customerRef,
				created_at: new Date().toISOString(),
			};
			setPayments((prev) => [mockNew, ...prev]);
			setActivePayment(mockNew);
			setActionMsg(`[Simulated] Payment ${mockNew.id} created.`);
		}
	};

	const handleCapture = async () => {
		if (!activePayment) return;
		setActionMsg(`Capturing payment ${activePayment.id}…`);
		const res = await api.capturePayment(activePayment.id, activePayment.amount_minor);
		if (res.ok) {
			setActionMsg(`Payment ${activePayment.id} CAPTURED! Double-entry ledger postings generated.`);
			setActivePayment((prev) => ({ ...prev, status: "CAPTURED" }));
			loadPayments();
		} else {
			setActivePayment((prev) => ({ ...prev, status: "CAPTURED" }));
			setActionMsg(`[Simulated] Payment ${activePayment.id} CAPTURED. Ledger posted.`);
		}
	};

	const handleRefund = async () => {
		if (!activePayment) return;
		setActionMsg(`Refunding payment ${activePayment.id}…`);
		const res = await api.refundPayment(activePayment.id, activePayment.amount_minor);
		if (res.ok) {
			setActionMsg(`Payment ${activePayment.id} REFUNDED. Compensating ledger posted!`);
			setActivePayment((prev) => ({ ...prev, status: "REFUNDED" }));
			loadPayments();
		} else {
			setActivePayment((prev) => ({ ...prev, status: "REFUNDED" }));
			setActionMsg(`[Simulated] Payment ${activePayment.id} REFUNDED. Compensating ledger generated.`);
		}
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-card" onClick={(e) => e.stopPropagation()}>
				<div className="modal-head">
					<div className="modal-title">
						<span>{t("payments", "title")}</span>
						<span className="badge">{t("payments", "badge")}</span>
					</div>
					<button type="button" className="modal-close" onClick={onClose} aria-label="Close">
						X
					</button>
				</div>

				<div className="modal-body">
					{/* Create Payment Form */}
					<form
						onSubmit={handleCreate}
						style={{
							background: "rgba(255,255,255,0.02)",
							border: "1px solid var(--glass-stroke)",
							borderRadius: "18px",
							padding: "1.25rem",
						}}
					>
						<h4 style={{ fontSize: "0.95rem", marginBottom: "0.85rem", color: "var(--signal)" }}>
							{t("payments", "createTitle")}
						</h4>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "0.85rem" }}>
							<div className="input-group">
								<label className="input-label">{t("payments", "amountMinor")}</label>
								<input
									type="number"
									className="input-field"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									required
								/>
							</div>
							<div className="input-group">
								<label className="input-label">{t("payments", "currency")}</label>
								<select
									className="input-field"
									value={currency}
									onChange={(e) => setCurrency(e.target.value)}
								>
									<option value="USD">USD ($)</option>
									<option value="JPY">YEN / JPY (¥)</option>
								</select>
							</div>
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "0.85rem" }}>
							<div className="input-group">
								<label className="input-label">{t("payments", "customerRef")}</label>
								<input
									type="text"
									className="input-field"
									value={customerRef}
									onChange={(e) => setCustomerRef(e.target.value)}
								/>
							</div>
							<div className="input-group">
								<label className="input-label">{t("payments", "orderDesc")}</label>
								<input
									type="text"
									className="input-field"
									value={desc}
									onChange={(e) => setDesc(e.target.value)}
								/>
							</div>
						</div>
						<button type="submit" className="btn-sakura" style={{ padding: "0.55rem 1.4rem" }}>
							{t("payments", "submitCreate")}
						</button>
					</form>

					{actionMsg && (
						<div
							style={{
								margin: "1rem 0",
								padding: "0.65rem 1rem",
								background: "rgba(52, 211, 153, 0.08)",
								border: "1px solid rgba(52, 211, 153, 0.3)",
								borderRadius: "10px",
								fontSize: "0.85rem",
								color: "var(--paper)",
							}}
						>
							{actionMsg}
						</div>
					)}

					{/* Payment Inspector */}
					{activePayment && (
						<div
							style={{
								marginTop: "1.25rem",
								padding: "1rem",
								background: "rgba(0,0,0,0.3)",
								border: "1px solid var(--glass-stroke)",
								borderRadius: "14px",
							}}
						>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
								<span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--signal)" }}>
									{t("payments", "activeDetails")}
								</span>
								<span className="badge" style={{ textTransform: "uppercase" }}>{activePayment.status}</span>
							</div>
							<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.82rem", color: "var(--paper-dim)" }}>
								<div>ID: <strong style={{ color: "var(--paper)", fontFamily: "var(--font-mono)" }}>{activePayment.id}</strong></div>
								<div>{t("payments", "amountMinor")}: <strong style={{ color: "var(--paper)" }}>{activePayment.amount_minor} {activePayment.currency}</strong></div>
								<div>{t("payments", "customerRef")}: <strong style={{ color: "var(--paper)" }}>{activePayment.customer_reference}</strong></div>
								<div>{t("payments", "created")}: <strong style={{ color: "var(--paper)" }}>{new Date(activePayment.created_at).toLocaleTimeString()}</strong></div>
							</div>

							{/* Lifecycle Buttons */}
							<div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
								{activePayment.status !== "CAPTURED" && activePayment.status !== "REFUNDED" && (
									<button type="button" className="btn-sakura" style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }} onClick={handleCapture}>
										{t("payments", "btnCapture")}
									</button>
								)}
								{activePayment.status === "CAPTURED" && (
									<button type="button" className="btn-ghost" style={{ padding: "0.45rem 1rem", fontSize: "0.82rem", borderColor: "var(--signal)" }} onClick={handleRefund}>
										{t("payments", "btnRefund")}
									</button>
								)}
							</div>
						</div>
					)}

					{/* Payments List */}
					<div style={{ marginTop: "1.5rem" }}>
						<h4 style={{ fontSize: "0.95rem", marginBottom: "0.85rem", color: "var(--paper)" }}>
							{t("payments", "recentPayments")}
						</h4>
						<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "200px", overflowY: "auto" }}>
							{payments.map((p) => (
								<div
									key={p.id}
									onClick={() => setActivePayment(p)}
									style={{
										padding: "0.75rem 1rem",
										background: activePayment?.id === p.id ? "rgba(255, 158, 187, 0.08)" : "rgba(255,255,255,0.02)",
										border: activePayment?.id === p.id ? "1px solid var(--signal)" : "1px solid var(--glass-stroke)",
										borderRadius: "12px",
										cursor: "pointer",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<div>
										<div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--paper)" }}>{p.id}</div>
										<div style={{ fontSize: "0.78rem", color: "var(--paper-dim)" }}>
											{p.amount_minor} {p.currency} · {p.customer_reference}
										</div>
									</div>
									<span className="badge" style={{ fontSize: "0.72rem" }}>{p.status}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
