import { useLanguage } from "../context/LanguageContext.jsx";

export default function Hero({ onOpenModal }) {
	const { t } = useLanguage();

	return (
		<section className="hero" id="top">
			<p className="hero__kicker reveal" style={{ "--reveal-order": 1 }}>
				<span className="hero__pulse" aria-hidden="true" />
				{t("hero", "kicker")}
			</p>

			<h1 className="hero__title">
				<span className="hero__line reveal" style={{ "--reveal-order": 2 }}>
					{t("hero", "titleLine1")}
				</span>
				<span className="hero__line reveal" style={{ "--reveal-order": 3 }}>
					{t("hero", "titleLine2")}
				</span>
				<span
					className="hero__line hero__line--accent reveal"
					style={{ "--reveal-order": 4 }}
				>
					{t("hero", "titleLine3")}
				</span>
			</h1>

			<p className="hero__copy reveal" style={{ "--reveal-order": 5 }}>
				{t("hero", "copy")}
			</p>

			<div className="hero__actions reveal" style={{ "--reveal-order": 6 }}>
				<button
					type="button"
					className="btn btn--solid"
					style={{ border: "none", cursor: "pointer" }}
					onClick={() => onOpenModal("simulator")}
				>
					{t("hero", "ctaDemo")}
				</button>
				<button
					type="button"
					className="btn btn--ghost"
					style={{ border: "none", cursor: "pointer" }}
					onClick={() => onOpenModal("docs")}
				>
					{t("hero", "ctaDocs")}
					<svg viewBox="0 0 16 16" aria-hidden="true">
						<path
							d="M3 8h9M9 4.5 12.5 8 9 11.5"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.6"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
			</div>
		</section>
	);
}
