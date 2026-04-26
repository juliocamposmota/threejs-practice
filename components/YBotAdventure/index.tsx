'use client';

import * as THREE from 'three';
import { useEffect, useRef } from "react";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

type Animations = 'Idle' | 'Walking' | 'Running' | 'JumpingUp';

export default function YBotAdventureScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const facingTurnSpeed = 8;
  const fadeDuration = 0.25;
  const walkSpeed = 2.0;
  const runSpeed = 4.0;
  const characterHeight = 1.0;
  const rayStartOffset = 2.0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let animationId: number;
    let isJumpingUp = false;
    let isMoving = false;
    let isRunning = false;
    let jumpingUpRequested = false;
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

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.0 })
    );
    const grid = new THREE.GridHelper(200, 40, 0x666666, 0x333333);

    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(grid);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;

    // controls direction
    const inputDirection = new THREE.Vector3();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const targetQuaternion = new THREE.Quaternion();

    // floor raycast
    const groundRay = new THREE.Raycaster();
    const rayOrigin = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    const raycastTargets: THREE.Object3D[] = [floor];

    // camera following
    const cameraFollowOffset = new THREE.Vector3(0, 1.0, 0);
    const previousPlayerPosition = new THREE.Vector3();
    const framePlayerDelta = new THREE.Vector3();
    previousPlayerPosition.copy(playerGroup.position);

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

        const jumpingUp = actions.JumpingUp;
        jumpingUp.setLoop(THREE.LoopOnce, 1);
        jumpingUp.clampWhenFinished = true;

        actions.Idle.play();
      },
      undefined,
      (err) => console.error('YBot load failed', err),
    );

    function playJumpingUp() {
      if (!actions || isJumpingUp) return;
      isJumpingUp = true;
      const from = actions[currentAnimation];
      const jumpingUp = actions.JumpingUp;

      jumpingUp
        .reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(fadeDuration)
        .play();

      from.fadeOut(fadeDuration);
      currentAnimation = 'JumpingUp';
      jumpingUp.getMixer()?.addEventListener('finished', onJumpingUpFinished);
    }

    function onJumpingUpFinished(e: THREE.Event) {
      const action = (e as unknown as { action?: THREE.AnimationAction }).action;
      if (!action || action !== actions!.JumpingUp) return;
    
      action.getMixer()?.removeEventListener('finished', onJumpingUpFinished);
      isJumpingUp = false;

      handleSetAnimation();
    }

    function snapCharacterToGround() {
      rayOrigin.copy(playerGroup.position);
      rayOrigin.y += rayStartOffset;
      groundRay.set(rayOrigin, down);
      const hits = groundRay.intersectObjects(raycastTargets, false);
      if (hits.length === 0) return;
      const hitY = hits[0].point.y;
      playerGroup.position.y = hitY + characterHeight;
    }

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

    function handleSetAnimation() {
      if (!isMoving) setAnimation('Idle');
      else if (isRunning) setAnimation('Running');
      else setAnimation('Walking');
    }

    function updateCharacter(delta: number) {
      const keys = pressedKeysRef.current;
      const { x: moveX, z: moveZ } = getMoveAxes(keys);

      inputDirection.set(moveX, 0, moveZ);

      isMoving = inputDirection.lengthSq() > 0;
      isRunning = keys.has('ShiftLeft');

      const speed = isRunning ? runSpeed : walkSpeed;

      if (jumpingUpRequested && !isJumpingUp) {
        jumpingUpRequested = false;
        if (!isRunning) playJumpingUp();
      }

      if (!isJumpingUp && isMoving) {
        const azimuth = orbitControls.getAzimuthalAngle();
        
        inputDirection.normalize();
        inputDirection.applyAxisAngle(upAxis, azimuth);

        const targetYaw = Math.atan2(inputDirection.x, inputDirection.z);

        targetQuaternion.setFromAxisAngle(upAxis, targetYaw);
        playerGroup.quaternion.rotateTowards(targetQuaternion, facingTurnSpeed * delta);
        playerGroup.position.addScaledVector(inputDirection, speed * delta);
      }

      if (!isJumpingUp) snapCharacterToGround();

      framePlayerDelta.copy(playerGroup.position).sub(previousPlayerPosition);
      camera.position.add(framePlayerDelta);
      orbitControls.target.copy(playerGroup.position).add(cameraFollowOffset);
      previousPlayerPosition.copy(playerGroup.position);

      if (!isJumpingUp) handleSetAnimation();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;

      const { code } = event;

      if (event.code === 'Space') {
        event.preventDefault();
        jumpingUpRequested = true;
        return;
      }

      if (
        code === 'KeyW' ||
        code === 'KeyS' ||
        code === 'KeyA' ||
        code === 'KeyD' ||
        code === 'ShiftLeft'
      ) {
        pressedKeysRef.current.add(code);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.repeat) return;

      const { code } = event;

      if (
        code === 'KeyW' ||
        code === 'KeyA' ||
        code === 'KeyS' ||
        code === 'KeyD' ||
        code === 'ShiftLeft'
      ) {
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
