import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

/**
 * Public HLS test streams, tried in order. The first one that produces
 * playable media wins; fatal errors advance to the next source.
 */
const SOURCES = [
	"/hls/JAPANESE-STREET-CHERRY-BLOSSOM-LIVE-WALLPAPER_1080.m3u8",
];

/**
 * Full-screen HLS video layer. Uses hls.js where MSE is available and
 * falls back to native HLS playback (Safari). Reports live stream
 * telemetry (resolution / bitrate / buffer) upward via onTelemetry.
 */
export default function HlsBackground({ muted, onTelemetry }) {
	const videoRef = useRef(null);
	const onTelemetryRef = useRef(onTelemetry);
	const [visible, setVisible] = useState(false);

	onTelemetryRef.current = onTelemetry;

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return undefined;

		let hls = null;
		let pollId = null;
		let disposed = false;
		let sourceIndex = 0;

		const markReady = () => {
			if (!disposed) setVisible(true);
		};

		const emitTelemetry = (partial) => {
			if (!disposed) onTelemetryRef.current?.(partial);
		};

		const pollBuffer = () => {
			pollId = window.setInterval(() => {
				const { buffered, currentTime } = video;
				let ahead = 0;
				for (let i = 0; i < buffered.length; i += 1) {
					if (
						buffered.start(i) <= currentTime &&
						currentTime <= buffered.end(i)
					) {
						ahead = buffered.end(i) - currentTime;
						break;
					}
				}
				emitTelemetry({ buffer: ahead });
			}, 1000);
		};

		const attachNative = () => {
			video.src = SOURCES[sourceIndex];
			video.addEventListener(
				"loadedmetadata",
				() => {
					emitTelemetry({
						width: video.videoWidth,
						height: video.videoHeight,
						protocol: "NATIVE HLS",
					});
				},
				{ once: true },
			);
			video.play().catch(() => {
				/* Autoplay is allowed for muted video; ignore transient rejections. */
			});
		};

		const attachHls = () => {
			hls = new Hls({
				capLevelToPlayerSize: true,
				startLevel: -1,
				maxBufferLength: 30,
			});

			hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
				const level = hls.levels[data.level];
				if (level) {
					emitTelemetry({
						width: level.width,
						height: level.height,
						bitrate: level.bitrate,
						level: data.level,
						levels: hls.levels.length,
						protocol: "HLS.JS / MSE",
					});
				}
			});

			hls.on(Hls.Events.ERROR, (_event, data) => {
				if (!data.fatal) return;
				if (sourceIndex < SOURCES.length - 1) {
					sourceIndex += 1;
					hls.destroy();
					attachHls();
				} else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
					hls.recoverMediaError();
				}
			});

			hls.loadSource(SOURCES[sourceIndex]);
			hls.attachMedia(video);
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				video.play().catch(() => {
					/* Muted autoplay should succeed; ignore transient rejections. */
				});
			});
		};

		let isRestarting = false;
		const restartPlayback = () => {
			if (disposed || isRestarting) return;
			isRestarting = true;
			if (hls) {
				hls.startLoad(0);
			}
			video.currentTime = 0;
			video.play().catch(() => {}).finally(() => {
				setTimeout(() => {
					isRestarting = false;
				}, 400);
			});
		};

		const handleEnded = () => {
			restartPlayback();
		};

		const handleTimeUpdate = () => {
			if (video.duration > 0 && video.currentTime >= video.duration - 0.25) {
				restartPlayback();
			}
		};

		video.addEventListener("ended", handleEnded);
		video.addEventListener("timeupdate", handleTimeUpdate);
		video.addEventListener("playing", markReady, { once: true });
		pollBuffer();

		if (Hls.isSupported()) {
			attachHls();
		} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
			attachNative();
		}

		return () => {
			disposed = true;
			window.clearInterval(pollId);
			video.removeEventListener("playing", markReady);
			video.removeEventListener("ended", handleEnded);
			video.removeEventListener("timeupdate", handleTimeUpdate);
			if (hls) hls.destroy();
			video.removeAttribute("src");
		};
	}, []);

	return (
		<div className="video-stage" aria-hidden="true">
			<video
				ref={videoRef}
				className={`video-stage__media${visible ? " is-live" : ""}`}
				muted={muted}
				autoPlay
				playsInline
				crossOrigin="anonymous"
				tabIndex={-1}
			/>
			<div className="video-stage__tint" />
			<div className="video-stage__vignette" />
			<div className="video-stage__floor" />
			<div className="video-stage__grain" />
		</div>
	);
}
