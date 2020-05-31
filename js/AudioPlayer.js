import gsap from "gsap";

class AudioPlayer {
	constructor(url, callback) {
		this.audioPath = url;
		this.callback = callback;
		this.audioContext = new AudioContext();
		this.buffer = undefined;
		this.sourceNode = undefined;
		this.staredAt = undefined;
		this.pausedAt = undefined;
		this.paused = true;
		this.currentVolume = 0.3;

		this.load();
	}

	load() {
		this.audioContext = new AudioContext();
		this.audio = null;

		fetch(this.audioPath)
			.then((data) => data.arrayBuffer())
			.then((arrayBuffer) => this.audioContext.decodeAudioData(arrayBuffer))
			.then((audio) => {
				this.audio = audio;
				this.callback();
				this.addNodes();
			});
	}

	addNodes() {
		this.sourceNode = this.audioContext.createBufferSource();
		this.sourceNode.buffer = this.audio;
		this.sourceNode.loop = true;
		this.sourceNode.connect(this.audioContext.destination);

		this.gainNode = this.audioContext.createGain();
		this.sourceNode.connect(this.gainNode);
		this.gainNode.connect(this.audioContext.destination);
	}

	play() {
		this.addNodes();
		this.paused = false;
		this.setVolume(this.currentVolume);

		if (this.pausedAt) {
			this.startedAt = Date.now() - this.pausedAt;
			this.sourceNode.start(0, this.pausedAt / 1000);
		} else {
			this.startedAt = Date.now();
			this.sourceNode.start(0);
		}

		gsap.fromTo(
			this.gainNode.gain,
			{
				value: -1,
			},
			{
				duration: 0.5,
				value: this.currentVolume,
			}
		);
	}

	stop() {
		gsap.to(this.gainNode.gain, {
			duration: 0.5,
			value: -1,
			onComplete: () => {
				this.sourceNode.stop(0);
				this.pausedAt = Date.now() - this.startedAt;
				this.paused = true;
			},
		});
	}

	reset() {
		if (!this.paused) {
			gsap.to(this.gainNode.gain, {
				duration: 0.5,
				value: -1,
				onComplete: () => {
					this.sourceNode.stop(0);
					this.pausedAt = 0;
					this.paused = true;
				},
			});
		}
	}

	setVolume(volume) {
		this.gainNode.gain.value = volume;
		this.currentVolume = volume;
	}
}

export default AudioPlayer;
