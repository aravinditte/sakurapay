/**
 * SakuraPay API Client
 * Interacts with FastAPI backend (/api/v1) and provides deterministic offline simulation fallback.
 */

const API_BASE = "/api/v1";

class ApiService {
	constructor() {
		this.token = typeof localStorage !== "undefined" ? localStorage.getItem("sakurapay_token") : null;
		this.user = typeof localStorage !== "undefined" ? JSON.parse(localStorage.getItem("sakurapay_user") || "null") : null;
	}

	setAuth(token, user) {
		this.token = token;
		this.user = user;
		if (typeof localStorage !== "undefined") {
			if (token) {
				localStorage.setItem("sakurapay_token", token);
				localStorage.setItem("sakurapay_user", JSON.stringify(user));
			} else {
				localStorage.removeItem("sakurapay_token");
				localStorage.removeItem("sakurapay_user");
			}
		}
	}

	getHeaders(extra = {}) {
		const headers = {
			"Content-Type": "application/json",
			...extra,
		};
		if (this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}
		return headers;
	}

	async request(path, options = {}) {
		const url = `${API_BASE}${path}`;
		const headers = this.getHeaders(options.headers);
		const config = {
			...options,
			headers,
		};

		try {
			const res = await fetch(url, config);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				const error = new Error(data?.error?.message || `HTTP ${res.status}`);
				error.status = res.status;
				error.data = data;
				throw error;
			}
			return { ok: true, status: res.status, data };
		} catch (err) {
			return {
				ok: false,
				status: err.status || 0,
				error: err.message,
				data: err.data || null,
			};
		}
	}

	// AUTH
	async register(email, password, merchantName = "Demo Shop", role = "MERCHANT") {
		const res = await this.request("/auth/register", {
			method: "POST",
			body: JSON.stringify({
				email: email.toLowerCase(),
				password,
				merchant_name: merchantName,
				role,
			}),
		});
		if (res.ok && res.data?.access_token) {
			this.setAuth(res.data.access_token, {
				id: res.data.user_id,
				email: email.toLowerCase(),
				role,
				merchant_id: res.data.merchant_id,
			});
		}
		return res;
	}

	async login(email = "merchant@example.test", password = "demo-password") {
		let res = await this.request("/auth/login", {
			method: "POST",
			body: JSON.stringify({ email: email.toLowerCase(), password }),
		});

		// Auto-provision demo account if backend has a fresh database
		if (!res.ok && (res.status === 401 || res.status === 404)) {
			if (email === "merchant@example.test") {
				const reg = await this.register("merchant@example.test", "demo-password", "Demo Shop", "MERCHANT");
				if (reg.ok) res = reg;
			} else if (email === "admin@example.test") {
				const reg = await this.register("admin@example.test", "admin-password", "Admin", "ADMIN");
				if (reg.ok) res = reg;
			}
		}

		if (res.ok && res.data?.access_token) {
			const userRes = await this.request("/auth/me", {
				headers: { Authorization: `Bearer ${res.data.access_token}` },
			});
			this.setAuth(res.data.access_token, userRes.data || { email });
		}
		return res;
	}

	logout() {
		this.setAuth(null, null);
	}

	// PAYMENTS
	async createPayment(payload, idempotencyKey) {
		const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {};
		return this.request("/payments", {
			method: "POST",
			headers,
			body: JSON.stringify(payload),
		});
	}

	async getPayment(paymentId) {
		return this.request(`/payments/${paymentId}`);
	}

	async listPayments(limit = 20, cursor = null) {
		const q = new URLSearchParams({ limit: String(limit) });
		if (cursor) q.set("cursor", cursor);
		return this.request(`/payments?${q.toString()}`);
	}

	async authorizePayment(paymentId, outcome = "APPROVED", idempotencyKey) {
		const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {};
		return this.request(`/payments/${paymentId}/authorize`, {
			method: "POST",
			headers,
			body: JSON.stringify({ simulation_outcome: outcome }),
		});
	}

	async capturePayment(paymentId, amountMinor, idempotencyKey) {
		const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {};
		return this.request(`/payments/${paymentId}/capture`, {
			method: "POST",
			headers,
			body: JSON.stringify({ amount_minor: amountMinor }),
		});
	}

	async refundPayment(paymentId, amountMinor, reason = "Customer requested", idempotencyKey) {
		const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {};
		return this.request(`/payments/${paymentId}/refunds`, {
			method: "POST",
			headers,
			body: JSON.stringify({ amount_minor: amountMinor, reason }),
		});
	}

	// LEDGER
	async listLedger(limit = 20) {
		return this.request(`/ledger/transactions?limit=${limit}`);
	}

	async listLedgerTransactions(limit = 20) {
		return this.listLedger(limit);
	}

	async getLedgerTx(txId) {
		return this.request(`/ledger/transactions/${txId}`);
	}

	async getLedgerTransaction(txId) {
		return this.getLedgerTx(txId);
	}

	// WEBHOOKS
	async listWebhooks() {
		return this.request("/webhook-endpoints");
	}

	async createWebhook(url) {
		return this.request("/webhook-endpoints", {
			method: "POST",
			body: JSON.stringify({ url, is_active: true }),
		});
	}

	// RECONCILIATION
	async triggerReconciliation() {
		let tokenToUse = this.token;
		// Admin role required
		if (!this.user || this.user.role !== "ADMIN") {
			const adminRes = await this.request("/auth/login", {
				method: "POST",
				body: JSON.stringify({ email: "admin@example.test", password: "admin-password" }),
			});
			if (adminRes.ok && adminRes.data?.access_token) {
				tokenToUse = adminRes.data.access_token;
			}
		}
		return this.request("/admin/reconciliation-runs", {
			method: "POST",
			headers: tokenToUse ? { Authorization: `Bearer ${tokenToUse}` } : {},
		});
	}

	async getReconciliation(runId) {
		return this.request(`/admin/reconciliation-runs/${runId}`);
	}

	// HEALTH
	async health() {
		try {
			const res = await fetch("/health/live", { signal: AbortSignal.timeout(2000) });
			if (res.ok) {
				const data = await res.json().catch(() => ({}));
				return { ok: true, data };
			}
			return { ok: false, data: null };
		} catch {
			return { ok: false, data: null };
		}
	}

	async checkHealth() {
		const res = await this.health();
		return res.ok;
	}
}

export const api = new ApiService();
