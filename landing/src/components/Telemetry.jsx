import { useLanguage } from "../context/LanguageContext.jsx";

const formatBitrate = (bps) =>
	bps == null ? "— — —" : `${(bps / 1_000_000).toFixed(2)} MBPS`;

const formatRes = (w, h) => (w && h ? `${w}×${h}` : "— — —");

const formatBuffer = (s) => (s == null ? "— — —" : `${s.toFixed(1)}S`);

const formatLadder = (level, levels) =>
	level == null || !levels ? "— — —" : `L${level + 1}/${levels}`;

export default function Telemetry({ stats, muted, onToggleMute }) {
	const { t } = useLanguage();

	const rows = [
		{ label: t("telemetry", "signal"), value: formatRes(stats.width, stats.height) },
		{ label: t("telemetry", "bitrate"), value: formatBitrate(stats.bitrate) },
		{ label: t("telemetry", "buffer"), value: formatBuffer(stats.buffer) },
		{ label: t("telemetry", "ladder"), value: formatLadder(stats.level, stats.levels) },
	];

	return (
		<aside
			className="telemetry reveal"
			style={{ "--reveal-order": 7 }}
			aria-label="Live demo telemetry"
		>
			<header className="telemetry__head">
				<span className="telemetry__title">{stats.protocol ?? t("telemetry", "tuning")}</span>
				<button
					type="button"
					className="telemetry__mute"
					onClick={onToggleMute}
					aria-pressed={!muted}
					aria-label={muted ? t("telemetry", "unmute") : t("telemetry", "mute")}
				>
					{muted ? (
						<svg viewBox="0 0 16 16" aria-hidden="true">
							<path d="M2.5 6v4h2.7L9 13V3L5.2 6H2.5Z" fill="currentColor" />
							<path
								d="m11 6 4 4m0-4-4 4"
								stroke="currentColor"
								strokeWidth="1.4"
								strokeLinecap="round"
							/>
						</svg>
					) : (
						<svg viewBox="0 0 16 16" aria-hidden="true">
							<path d="M2.5 6v4h2.7L9 13V3L5.2 6H2.5Z" fill="currentColor" />
							<path
								d="M11 5.5a3.6 3.6 0 0 1 0 5m1.6-7a6 6 0 0 1 0 9"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.3"
								strokeLinecap="round"
							/>
						</svg>
					)}
				</button>
			</header>
			<dl className="telemetry__body">
				{rows.map((row) => (
					<div key={row.label} className="telemetry__row">
						<dt className="telemetry__dt">{row.label}</dt>
						<dd className="telemetry__dd">{row.value}</dd>
					</div>
				))}
			</dl>
		</aside>
	);
}
