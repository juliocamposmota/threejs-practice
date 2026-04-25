'use client';

import * as THREE from 'three';
import { useEffect, useRef } from "react";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

type Animations = 'Idle' | 'Walking';

export default function YBotAdventureScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const facingTurnSpeed = 8;
  const fadeDuration = 0.25;
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

    const inputDirection = new THREE.Vector3();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const targetQuaternion = new THREE.Quaternion();

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

    function getMoveAxes(keys: Set<string>) {
      const x = (keys.has('KeyD') ? 1 : 0) + (keys.has('KeyA') ? -1 : 0);
      const z = (keys.has('KeyW') ? -1 : 0) + (keys.has('KeyS') ? 1 : 0);
      return { x, z };
    }

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
      const keys = pressedKeysRef.current;
      const { x: moveX, z: moveZ } = getMoveAxes(keys);

      inputDirection.set(moveX, 0, moveZ);

      const isMoving = inputDirection.lengthSq() > 0;

      if (isMoving) {
        const azimuth = orbitControls.getAzimuthalAngle();
        const targetYaw = Math.atan2(inputDirection.x, inputDirection.z);
        
        inputDirection.normalize();
        inputDirection.applyAxisAngle(upAxis, azimuth);
        targetQuaternion.setFromAxisAngle(upAxis, targetYaw);
        playerGroup.quaternion.rotateTowards(targetQuaternion, facingTurnSpeed * delta);
        playerGroup.position.addScaledVector(inputDirection, walkSpeed * delta);
      }

      if (isMoving) setAnimation('Walking');
      else setAnimation('Idle');  
    }

    function onKeyDown(event: KeyboardEvent) {
      // optional: ignore auto-repeat noise
      if (event.repeat) return;

      const { code } = event;

      if (code === 'KeyW' || code === 'KeyS' || code === 'KeyA' || code === 'KeyD') {
        pressedKeysRef.current.add(code);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      // optional: ignore auto-repeat noise
      if (event.repeat) return;

      const { code } = event;

      if (code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD') {
        pressedKeysRef.current.delete(code);
      }
    }

    function onWindowBlur() {
      pressedKeysRef.current.clear();
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
    window.addEventListener('blur', onWindowBlur);

    animate();

    return () => {
      mounted = false;
      mixer?.stopAllAction();
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      orbitControls.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="w-full h-full" ref={containerRef} />;
}
