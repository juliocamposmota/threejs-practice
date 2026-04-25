'use client';

import * as THREE from 'three';
import { useEffect, useRef } from "react";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

type Animations = 'Idle' | 'Walking';

export default function YBotAdventureScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef({ forward: 0, turn: 0 })
  const fadeDuration = 0.25;
  const rotateSpeed = 2.0;
  const walkSpeed = 2.0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let animationId: number;
    let mixer: THREE.AnimationMixer | null = null;
    let actions: Record<string, THREE.AnimationAction> | null = null;
    let currentAnimation: Animations = 'Idle';

    const size = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      return { width: w, height: h };
    };

    const { width, height } = size();

    const clock = new THREE.Clock();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const playerGroup = new THREE.Group();

    scene.add(playerGroup);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 10, 20);

    const light = new THREE.AmbientLight( 0x404040 );
    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);
    scene.add(light);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;

    const worldForward = new THREE.Vector3();

    const loader = new GLTFLoader();
    loader.load(
      '/ybot.glb',
      (gltf) => {
        if (!mounted) return;
        const { scene: model, animations } = gltf;

        playerGroup.add(model);

        mixer = new THREE.AnimationMixer(model);

        const idleClip = THREE.AnimationClip.findByName(animations, 'idle');
        const jumpingUpClip = THREE.AnimationClip.findByName(animations, 'jumping_up');
        const runningClip = THREE.AnimationClip.findByName(animations, 'running');
        const walkingClip = THREE.AnimationClip.findByName(animations, 'walking');

        actions = {
          Idle: mixer.clipAction(idleClip!),
          JumpingUp: mixer.clipAction(jumpingUpClip!),
          Running: mixer.clipAction(runningClip!),
          Walking: mixer.clipAction(walkingClip!),
        }

        for (const key of Object.keys(actions)) {
          const action = actions[key];
          action.enabled = true;
          action.setEffectiveTimeScale(1);
          if (key !== 'Idle') action.setEffectiveWeight(0);
        }

        actions.Idle.play();
      },
      undefined,
      (err) => console.error('YBot load failed', err),
    );

    function setAnimation(animation: Animations) {
      if (!actions) return;
      if (currentAnimation === animation) return;

      const from = actions[currentAnimation];
      const to = actions[animation];

      to.reset()
        .setEffectiveWeight(1)
        .fadeIn(fadeDuration)
        .setEffectiveTimeScale(1)
        .play();

      from.fadeOut(fadeDuration);

      currentAnimation = animation;
    }

    function updateCharacter(delta: number) {
      const { forward, turn } = controlsRef.current;

      playerGroup.rotateY(turn * rotateSpeed * delta);
      playerGroup.getWorldDirection(worldForward);
      playerGroup.position.addScaledVector(worldForward, forward * walkSpeed * delta);

      if (forward !== 0) {
        setAnimation('Walking');
      } else {
        setAnimation('Idle');
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const controls = controlsRef.current;

      switch (event.code) {
        case 'KeyW': controls.forward = 1; break;
        case 'KeyS': controls.forward = -1; break;
        case 'KeyA': controls.turn = 1; break;
        case 'KeyD': controls.turn = -1; break;
        default: break;
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const controls = controlsRef.current;

      switch (event.code) {
        case 'KeyW': controls.forward = 0; break;
        case 'KeyS': controls.forward = 0; break;
        case 'KeyA': controls.turn = 0; break;
        case 'KeyD': controls.turn = 0; break;
        default: break;
      }
    }

    const animate = () => {
      if (!mounted) return;
      const delta = clock.getDelta();
      updateCharacter(delta);
      if (mixer) mixer.update(delta);
      orbitControls.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    animate();

    return () => {
      mounted = false;
      mixer?.stopAllAction();
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      orbitControls.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="w-full h-full" ref={containerRef} />;
}
