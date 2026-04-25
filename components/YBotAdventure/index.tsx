'use client';

import * as THREE from 'three';
import { useEffect, useRef } from "react";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export default function YBotAdventureScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef({ forward: 0, turn: 0 })
  const rotateSpeed = 2.0;
  const walkSpeed = 2.0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let animationId: number;
    let mixer: THREE.AnimationMixer | null = null;
    let actions: Record<string, THREE.AnimationAction> | null = null;

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

        actions = {
          Idle: mixer.clipAction(animations[0]),
          JumpingUp: mixer.clipAction(animations[1]),
          Running: mixer.clipAction(animations[2]),
          Walking: mixer.clipAction(animations[3]),
        }

        actions.Idle.play();
      },
      undefined,
      (err) => console.error('YBot load failed', err),
    );

    function updateCharacter(delta: number) {
      const { forward, turn } = controlsRef.current;

      playerGroup.rotateY(turn * rotateSpeed * delta);
      playerGroup.getWorldDirection(worldForward);
      playerGroup.position.addScaledVector(worldForward, forward * walkSpeed * delta);
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
