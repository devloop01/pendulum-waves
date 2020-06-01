console.clear();

import * as THREE from "three";
import OrbitControls from "three-orbitcontrols";
import * as POSTPROCESSING from "postprocessing";
import Water from "../libs/Water.js";
import gsap from "gsap";
import * as dat from "dat.gui";
import Pendulum from "./Pendulum.js";
import AudioPlayer from "./AudioPlayer.js";

import "../css/main.css";

class App {
	constructor() {
		this.pendulumProps = {
			length: 10,
			startAngle: Math.PI + Math.PI / 8,
			position: {
				x: 0,
				y: -3,
				z: 0,
			},
		};

		this.pendulumGap = 2;

		this.audioUrl = "/Mountains.e7b3cc42.ogg";

		this.startMotion = false;

		this.width = window.innerWidth;
		this.height = window.innerHeight;
	}

	init() {
		this.initAudio();
		this.renderGUI();
		this.createScene();
		this.createCamera();
		this.createComposer();
		this.addLights();
		this.addCameraControls();
		this.addSupportRod();
		this.addPendulums(this.settings.pendulums.current);
		this.addFloor();
		this.render();

		window.addEventListener("resize", this.onResize.bind(this), {
			passive: true,
		});
	}

	createScene() {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(this.settings.bgColor);
		this.scene.fog = new THREE.Fog(
			this.settings.fogColor,
			this.settings.fog.min,
			this.settings.fog.max
		);

		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(window.innerWidth, window.innerHeight);

		document.body.appendChild(this.renderer.domElement);
	}

	createComposer() {
		const areaImage = new Image();
		areaImage.src = POSTPROCESSING.SMAAEffect.areaImageDataURL;
		const searchImage = new Image();
		searchImage.src = POSTPROCESSING.SMAAEffect.searchImageDataURL;
		const smaaEffect = new POSTPROCESSING.SMAAEffect(
			searchImage,
			areaImage,
			1
		);

		const bloomPass = new POSTPROCESSING.EffectPass(
			this.camera,
			new POSTPROCESSING.BloomEffect()
		);
		bloomPass.renderToScreen = true;

		const renderPass = new POSTPROCESSING.RenderPass(
			this.scene,
			this.camera
		);
		this.composer = new POSTPROCESSING.EffectComposer(this.renderer);

		this.composer.addPass(renderPass);
		this.composer.addPass(bloomPass);
	}

	createCamera() {
		this.camera = new THREE.PerspectiveCamera(
			40,
			this.width / this.height,
			0.1,
			1000
		);
		this.camera.position.set(0, 0, 25);

		this.scene.add(this.camera);
	}

	addCameraControls() {
		this.controls = new OrbitControls(
			this.camera,
			this.renderer.domElement
		);
		this.controls.maxPolarAngle = Math.PI / 2;
		this.controls.minDistance = 10;
		this.controls.maxDistance = 100;
	}

	addLights() {
		const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.1);
		const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.1);
		directionalLight1.position.set(-1, 1, -1);
		directionalLight2.position.set(1, 1, 1);

		this.spotLight = new THREE.SpotLight(0xffffff, 1);
		this.spotLight.angle = Math.PI / 4;
		this.spotLight.decay = 10;
		this.spotLight.position.set(
			0,
			this.pendulumProps.length,
			-this.pendulumProps.length / 2
		);

		const pointLight = new THREE.PointLight(0xffffff, 0.2);

		this.camera.add(pointLight);
		this.scene.add(this.spotLight);
		this.scene.add(directionalLight1);
		this.scene.add(directionalLight2);
	}

	addSupportRod() {
		// this variable holds the total length the array of pendulums across z-axis.
		this.totalRodLength =
			this.pendulumGap * this.settings.pendulums.current;
		const rodGeomtery = new THREE.CylinderGeometry(
			0.09,
			0.09,
			this.totalRodLength,
			12
		);
		const rodMaterial = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			metalness: 1,
			roughness: 0.25,
		});
		this.rod = new THREE.Mesh(rodGeomtery, rodMaterial);
		this.rod.rotation.set(0, Math.PI / 2, Math.PI / 2);
		this.rod.position.set(
			this.pendulumProps.position.x,
			this.pendulumProps.position.y + this.pendulumProps.length,
			this.pendulumProps.position.z + 1
		);

		this.scene.add(this.rod);
	}

	addPendulums(n) {
		this.pendulums = [];

		for (let i = 0; i < n; i++) {
			this.pendulums.push(
				new Pendulum(this.scene, {
					z: i * -this.pendulumGap,
					phaseDiff: i * 0.00001,
					length: this.pendulumProps.length,
					startAngle: this.pendulumProps.startAngle,
					position: this.pendulumProps.position,
					sphereMaterialProps: this.settings.materialProps.sphere,
				})
			);
		}

		this.pendulums.forEach((pendulum) => {
			// loop through the pendulums and bring it a little forward.
			pendulum.z += this.totalRodLength / 2;
			pendulum.updatePosition();
			pendulum.addToScene();
		});
	}

	addFloor() {
		const floorGeometry = new THREE.PlaneBufferGeometry(80, 80, 50, 50);

		let positionAttribute = floorGeometry.attributes.position;
		for (let i = 0; i < positionAttribute.count; i++) {
			let x = positionAttribute.getX(i);
			let y = positionAttribute.getY(i);
			let z = positionAttribute.getZ(i);

			z += Math.random() * 0.4;

			positionAttribute.setXYZ(i, x, y, z);
		}

		this.floor = new THREE.Water(floorGeometry, {
			textureWidth: 512,
			textureHeight: 512,
			distortionScale: 0,
			fog: this.scene.fog !== undefined,
		});

		this.floor.position.y = this.pendulumProps.position.y - 1.5;
		this.floor.rotateX(-Math.PI / 2);

		this.scene.add(this.floor);
	}

	render() {
		if (this.startMotion) {
			this.pendulums.forEach((pendulum) => {
				pendulum.updatePosition();
				pendulum.updateAngles();
			});
		}

		// ---- If you want to render the without composites, Then disable the composer renderer & enable the WEBGL renderer
		this.composer.render();
		// this.renderer.render(this.scene, this.camera);

		this.raf = requestAnimationFrame(this.render.bind(this));
	}

	initAudio() {
		this.audio = new AudioPlayer(this.audioUrl, () => {
			console.info("audio loaded");
			this.hideLoader();
		});
	}

	start() {
		let duration = 2;
		for (let i = 0; i < this.pendulums.length; i++) {
			let pendulum = this.pendulums[i];
			gsap.timeline()
				.to(pendulum, duration, {
					angle: this.pendulumProps.startAngle,
					onUpdate: function() {
						pendulum.updatePosition();
					},
					ease: "Linear.easeNone",
				})
				.call(() => {
					pendulum.angleVelocity = 0;
					pendulum.angleAcceleration = 0;
				});
		}
		setTimeout(() => {
			this.startMotion = true;
			this.audio.play();
		}, duration * 1000);
	}

	resetScene() {
		console.info("reseting...");

		while (this.scene.children.length > 0) {
			this.scene.remove(this.scene.children[0]);
		}

		// this.audio.reset();
		this.startMotion = false;

		cancelAnimationFrame(this.raf);
		this.createCamera();
		this.createComposer();
		this.addCameraControls();
		this.addLights();
		this.addSupportRod();
		this.addPendulums(this.settings.pendulums.current);
		this.addFloor();
		this.render();
	}

	renderGUI() {
		this.settings = {
			audioConfig: {
				volume: {
					current: 0.3,
					min: -1,
					max: 1,
					step: 0.1,
				},
				pauseAudio: () => {
					if (this.startMotion) {
						this.audio.setVolume(
							this.settings.audioConfig.volume.current
						);
						this.audio.stop();
					}
				},
				playAudio: () => {
					if (this.startMotion && this.audio.paused)
						this.audio.play();
				},
			},
			materialProps: {
				sphere: {
					color: 0xffdf40,
					emissive: 0xbd1816,
					emissiveIntensity: 10,
					metalness: 0,
					roughness: 0,
				},
			},
			bgColor: "#000000",
			fogColor: "#000000",
			fog: {
				enabled: true,
				min: 1,
				max: 60,
			},
			pendulums: {
				current: 10,
				min: 5,
				max: 20,
				step: 1,
			},
			start: () => {
				if (!this.startMotion) this.start();
			},
			resetAndUpdate: () => {
				this.resetScene();
			},
		};

		const GUI = new dat.GUI();

		const audioFolder = GUI.addFolder("Audio");
		audioFolder
			.add(
				this.settings.audioConfig.volume,
				"current",
				this.settings.audioConfig.volume.min,
				this.settings.audioConfig.volume.max
			)
			.name("Volume")
			.step(this.settings.audioConfig.volume.step)
			.onChange((e) => {
				this.audio.setVolume(e);
			});
		audioFolder
			.add(this.settings.audioConfig, "playAudio")
			.name("Play Audio");
		audioFolder
			.add(this.settings.audioConfig, "pauseAudio")
			.name("Pause Audio");

		const colorFolder = GUI.addFolder("Color");
		colorFolder
			.addColor(this.settings, "bgColor")
			.name("Background")
			.onChange(() => this.onPropsChange());
		colorFolder
			.addColor(this.settings, "fogColor")
			.name("Fog")
			.onChange(() => this.onPropsChange());

		const fogFolder = GUI.addFolder("FOG");
		fogFolder
			.add(this.settings.fog, "enabled")
			.onChange(() => this.onPropsChange());
		fogFolder
			.add(this.settings.fog, "min", 0.1, 10)
			.onChange(() => this.onPropsChange());
		fogFolder
			.add(this.settings.fog, "max", 40, 100)
			.onChange(() => this.onPropsChange());

		const metarialsFolder = GUI.addFolder("Material Props");
		const sphereMaterialFolder = metarialsFolder.addFolder("Sphere");
		sphereMaterialFolder
			.addColor(this.settings.materialProps.sphere, "color")
			.onChange(() => this.onPropsChange());
		sphereMaterialFolder
			.addColor(this.settings.materialProps.sphere, "emissive")
			.onChange(() => this.onPropsChange());
		sphereMaterialFolder
			.add(this.settings.materialProps.sphere, "emissiveIntensity", 0, 10)
			.onChange(() => this.onPropsChange());
		sphereMaterialFolder
			.add(this.settings.materialProps.sphere, "metalness", 0, 1)
			.step(0.1)
			.onChange(() => this.onPropsChange());
		sphereMaterialFolder
			.add(this.settings.materialProps.sphere, "roughness", 0, 1)
			.step(0.1)
			.onChange(() => this.onPropsChange());

		GUI.add(
			this.settings.pendulums,
			"current",
			this.settings.pendulums.min,
			this.settings.pendulums.max
		)
			.name("Pendulums")
			.step(this.settings.pendulums.step);

		GUI.add(this.settings, "start").name("Start");
		GUI.add(this.settings, "resetAndUpdate").name("Reset Scene");
	}

	onPropsChange() {
		this.scene.background = new THREE.Color(this.settings.bgColor);

		if (this.settings.fog.enabled) {
			this.renderer.alpha = false;
			this.scene.fog = new THREE.Fog(
				this.settings.bgColor,
				this.settings.fog.min,
				this.settings.fog.max
			);
		} else {
			this.renderer.alpha = true;
			if (this.scene.fog) {
				this.scene.fog.near = 0.1;
				this.scene.fog.far = 0;
			}
		}

		this.pendulums.forEach((pendulum) => {
			pendulum.removeFromScene();
			pendulum.updateSphereMaterial(this.settings.materialProps.sphere);
			pendulum.addToScene();
		});
	}

	onResize() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;

		this.camera.aspect = this.width / this.height;
		this.camera.updateProjectionMatrix();

		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(this.width, this.height);

		this.createComposer();
	}

	hideLoader() {
		const loadingWrapper = document.querySelector(".loading__wrapper");
		gsap.to(loadingWrapper, {
			duration: 0.5,
			opacity: 0,
			pointerEvents: "none",
		});
	}
}

const app = new App();
app.init();
