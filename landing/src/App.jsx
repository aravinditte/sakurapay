import { useCallback, useState } from "react";
import { LanguageProvider, useLanguage } from "./context/LanguageContext.jsx";
import GlassNav from "./components/GlassNav.jsx";
import Hero from "./components/Hero.jsx";
import HlsBackground from "./components/HlsBackground.jsx";
import Telemetry from "./components/Telemetry.jsx";
import SimulatorModal from "./components/SimulatorModal.jsx";
import PaymentsModal from "./components/PaymentsModal.jsx";
import LedgerModal from "./components/LedgerModal.jsx";
import WebhooksModal from "./components/WebhooksModal.jsx";
import ReconciliationModal from "./components/ReconciliationModal.jsx";
import DocsModal from "./components/DocsModal.jsx";
import AuthModal from "./components/AuthModal.jsx";
import { api } from "./services/api.js";
import "./styles/modals.css";

function AppContent() {
	const [muted, setMuted] = useState(true);
	const [stats, setStats] = useState({});
	const [activeModal, setActiveModal] = useState(null);
	const [user, setUser] = useState(api.user);
	const { t } = useLanguage();

	const handleTelemetry = useCallback((partial) => {
		setStats((prev) => ({ ...prev, ...partial }));
	}, []);

	const handleLogout = () => {
		api.logout();
		setUser(null);
	};

	return (
		<div className="page">
			<HlsBackground muted={muted} onTelemetry={handleTelemetry} />
			<GlassNav
				user={user}
				onOpenModal={(id) => setActiveModal(id)}
				onLogout={handleLogout}
			/>
			<main className="stage">
				<Hero onOpenModal={(id) => setActiveModal(id)} />
				<Telemetry
					stats={stats}
					muted={muted}
					onToggleMute={() => setMuted((v) => !v)}
				/>
			</main>
			<span className="edge-label edge-label--left" aria-hidden="true">
				{t("edge", "left")}
			</span>
			<span className="edge-label edge-label--right" aria-hidden="true">
				{t("edge", "right")}
			</span>

			{/* Interactive Modals */}
			<SimulatorModal
				isOpen={activeModal === "simulator"}
				onClose={() => setActiveModal(null)}
			/>
			<PaymentsModal
				isOpen={activeModal === "payments"}
				onClose={() => setActiveModal(null)}
			/>
			<LedgerModal
				isOpen={activeModal === "ledger"}
				onClose={() => setActiveModal(null)}
			/>
			<WebhooksModal
				isOpen={activeModal === "webhooks"}
				onClose={() => setActiveModal(null)}
			/>
			<ReconciliationModal
				isOpen={activeModal === "reconciliation"}
				onClose={() => setActiveModal(null)}
			/>
			<DocsModal
				isOpen={activeModal === "docs"}
				onClose={() => setActiveModal(null)}
			/>
			<AuthModal
				isOpen={activeModal === "auth"}
				onClose={() => setActiveModal(null)}
				onAuthChange={(u) => setUser(u)}
			/>
		</div>
	);
}

export default function App() {
	return (
		<LanguageProvider>
			<AppContent />
		</LanguageProvider>
	);
}
