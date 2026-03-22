'use client';

import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

/** Same assets as [webgl_animation_walk](https://threejs.org/examples/#webgl_animation_walk), served from the official examples host. */
const EXAMPLES_BASE = 'https://threejs.org/examples/';

const PI = Math.PI;
const PI90 = Math.PI / 2;

type AnimationActionWithFading = THREE.AnimationAction & {
  _scheduleFading: (duration: number, weightNow: number, weightThen: number) => void;
};

function scheduleFading(
  action: THREE.AnimationAction,
  duration: number,
  weightNow: number,
  weightThen: number,
) {
  (action as AnimationActionWithFading)._scheduleFading(duration, weightNow, weightThen);
}

function unwrapRad(r: number) {
  return Math.atan2(Math.sin(r), Math.cos(r));
}

export default function OpenWorldScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let animationId = 0;

    const clock = new THREE.Clock();
    const fixeTransition = true;

    const controlsState = {
      key: [0, 0, 0] as [number, number, number],
      ease: new THREE.Vector3(),
      position: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      rotate: new THREE.Quaternion(),
      current: 'Idle' as 'Idle' | 'Walk' | 'Run',
      fadeDuration: 0.5,
      runVelocity: 5,
      walkVelocity: 1.8,
      rotateSpeed: 0.05,
      floorDecale: 0,
    };

    const size = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      return { width: w, height: h };
    };

    const { width, height } = size();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2, -5);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5e5d5d);
    scene.fog = new THREE.Fog(0x5e5d5d, 2, 20);

    const group = new THREE.Group();
    scene.add(group);

    const followGroup = new THREE.Group();
    scene.add(followGroup);

    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(-2, 5, -3);
    dirLight.castShadow = true;
    const cam = dirLight.shadow.camera;
    cam.top = cam.right = 2;
    cam.bottom = cam.left = -2;
    cam.near = 3;
    cam.far = 8;
    dirLight.shadow.mapSize.set(1024, 1024);
    followGroup.add(dirLight);
    followGroup.add(dirLight.target);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(0, 1, 0);
    orbitControls.enableDamping = true;
    orbitControls.enablePan = false;
    orbitControls.maxPolarAngle = PI90 - 0.05;
    orbitControls.update();

    let floor: THREE.Mesh | null = null;
    let model: THREE.Group | null = null;
    let skeleton: THREE.SkeletonHelper | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let actions: Record<string, THREE.AnimationAction> | null = null;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const envTextures: THREE.Texture[] = [];
    const floorTextures: THREE.Texture[] = [];

    function addFloor() {
      const floorSize = 50;
      const repeat = 16;
      const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

      const floorT = textureLoader.load(
        `${EXAMPLES_BASE}textures/floors/FloorsCheckerboard_S_Diffuse.jpg`,
      );
      floorTextures.push(floorT);
      floorT.colorSpace = THREE.SRGBColorSpace;
      floorT.repeat.set(repeat, repeat);
      floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
      floorT.anisotropy = maxAnisotropy;

      const floorN = textureLoader.load(
        `${EXAMPLES_BASE}textures/floors/FloorsCheckerboard_S_Normal.jpg`,
      );
      floorTextures.push(floorN);
      floorN.repeat.set(repeat, repeat);
      floorN.wrapS = floorN.wrapT = THREE.RepeatWrapping;
      floorN.anisotropy = maxAnisotropy;

      const mat = new THREE.MeshStandardMaterial({
        map: floorT,
        normalMap: floorN,
        normalScale: new THREE.Vector2(0.5, 0.5),
        color: 0x404040,
        depthWrite: false,
        roughness: 0.85,
      });

      const g = new THREE.PlaneGeometry(floorSize, floorSize, 50, 50);
      g.rotateX(-PI90);

      floor = new THREE.Mesh(g, mat);
      floor.receiveShadow = true;
      scene.add(floor);

      controlsState.floorDecale = (floorSize / repeat) * 4;

      const bulbGeometry = new THREE.SphereGeometry(0.05, 16, 8);
      const bulbLight = new THREE.PointLight(0xffee88, 2, 500, 2);
      const bulbMat = new THREE.MeshStandardMaterial({
        emissive: 0xffffee,
        emissiveIntensity: 1,
        color: 0x000000,
      });
      bulbLight.add(new THREE.Mesh(bulbGeometry, bulbMat));
      bulbLight.position.set(1, 0.1, -3);
      bulbLight.castShadow = true;
      floor.add(bulbLight);
    }

    function setWeight(action: THREE.AnimationAction, weight: number) {
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(weight);
    }

    function loadModel() {
      const loader = new GLTFLoader();
      loader.load(
        `${EXAMPLES_BASE}models/gltf/Soldier.glb`,
        (gltf) => {
          if (disposed) return;

          model = gltf.scene;
          group.add(model);
          model.rotation.y = PI;
          group.rotation.y = PI;

          model.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const mesh = object;

            if (mesh.name === 'vanguard_Mesh') {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.metalness = 1.0;
              mat.roughness = 0.2;
              mat.color.set(1, 1, 1);
              mat.metalnessMap = mat.map;
            } else {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.metalness = 1;
              mat.roughness = 0;
              mat.transparent = true;
              mat.opacity = 0.8;
              mat.color.set(1, 1, 1);
            }
          });

          skeleton = new THREE.SkeletonHelper(model);
          skeleton.setColors(new THREE.Color(0xe000ff), new THREE.Color(0x00e0ff));
          skeleton.visible = false;
          scene.add(skeleton);

          const animations = gltf.animations;
          mixer = new THREE.AnimationMixer(model);

          actions = {
            Idle: mixer.clipAction(animations[0]),
            Walk: mixer.clipAction(animations[3]),
            Run: mixer.clipAction(animations[1]),
          };

          for (const m of Object.keys(actions)) {
            const act = actions[m];
            act.enabled = true;
            act.setEffectiveTimeScale(1);
            if (m !== 'Idle') act.setEffectiveWeight(0);
          }

          actions.Idle.play();
        },
        undefined,
        (err) => {
          console.error('OpenWorldScene: failed to load Soldier.glb', err);
        },
      );
    }

    function updateCharacter(delta: number) {
      const fade = controlsState.fadeDuration;
      const key = controlsState.key;
      const up = controlsState.up;
      const ease = controlsState.ease;
      const rotate = controlsState.rotate;
      const position = controlsState.position;
      const azimuth = orbitControls.getAzimuthalAngle();

      const active = key[0] === 0 && key[1] === 0 ? false : true;
      const play: 'Idle' | 'Walk' | 'Run' = active ? (key[2] ? 'Run' : 'Walk') : 'Idle';

      if (actions && mixer && controlsState.current !== play) {
        const current = actions[play];
        const old = actions[controlsState.current];
        controlsState.current = play;

        if (fixeTransition) {
          current.reset();
          current.weight = 1.0;
          current.stopFading();
          old.stopFading();
          if (play !== 'Idle') {
            current.time =
              old.time * (current.getClip().duration / old.getClip().duration);
          }
          scheduleFading(old, fade, old.getEffectiveWeight(), 0);
          scheduleFading(current, fade, current.getEffectiveWeight(), 1);
          current.play();
        } else {
          setWeight(current, 1.0);
          old.fadeOut(fade);
          current.reset().fadeIn(fade).play();
        }
      }

      if (controlsState.current !== 'Idle') {
        const velocity =
          controlsState.current === 'Run' ? controlsState.runVelocity : controlsState.walkVelocity;

        ease.set(key[1], 0, key[0]).multiplyScalar(velocity * delta);

        const angle = unwrapRad(Math.atan2(ease.x, ease.z) + azimuth);
        rotate.setFromAxisAngle(up, angle);

        ease.applyAxisAngle(up, azimuth);

        position.add(ease);
        camera.position.add(ease);

        group.position.copy(position);
        group.quaternion.rotateTowards(rotate, controlsState.rotateSpeed);

        orbitControls.target.copy(position).add(new THREE.Vector3(0, 1, 0));
        followGroup.position.copy(position);

        if (floor) {
          const dx = position.x - floor.position.x;
          const dz = position.z - floor.position.z;
          if (Math.abs(dx) > controlsState.floorDecale) floor.position.x += dx;
          if (Math.abs(dz) > controlsState.floorDecale) floor.position.z += dz;
        }
      }

      if (mixer) mixer.update(delta);
      orbitControls.update();
    }

    function onKeyDown(event: KeyboardEvent) {
      const key = controlsState.key;
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyZ':
          key[0] = -1;
          break;
        case 'ArrowDown':
        case 'KeyS':
          key[0] = 1;
          break;
        case 'ArrowLeft':
        case 'KeyA':
        case 'KeyQ':
          key[1] = -1;
          break;
        case 'ArrowRight':
        case 'KeyD':
          key[1] = 1;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          key[2] = 1;
          break;
        default:
          break;
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = controlsState.key;
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyZ':
          key[0] = key[0] < 0 ? 0 : key[0];
          break;
        case 'ArrowDown':
        case 'KeyS':
          key[0] = key[0] > 0 ? 0 : key[0];
          break;
        case 'ArrowLeft':
        case 'KeyA':
        case 'KeyQ':
          key[1] = key[1] < 0 ? 0 : key[1];
          break;
        case 'ArrowRight':
        case 'KeyD':
          key[1] = key[1] > 0 ? 0 : key[1];
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          key[2] = 0;
          break;
        default:
          break;
      }
    }

    function onWindowResize() {
      const { width: w, height: h } = size();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    function animate() {
      if (disposed) return;
      const delta = clock.getDelta();
      updateCharacter(delta);
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    }

    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    const hdrLoader = new HDRLoader();
    hdrLoader.load(
      `${EXAMPLES_BASE}textures/equirectangular/venice_sunset_1k.hdr`,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        envTextures.push(texture);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.environmentIntensity = 1.5;
        loadModel();
        addFloor();
        animate();
      },
      undefined,
      () => {
        if (disposed) return;
        console.warn('OpenWorldScene: HDR load failed, continuing without IBL.');
        loadModel();
        addFloor();
        animate();
      },
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      orbitControls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      envTextures.forEach((t) => t.dispose());
      floorTextures.forEach((t) => t.dispose());

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = obj.material;
          if (Array.isArray(mats)) mats.forEach((m) => m.dispose());
          else if (mats) mats.dispose();
        }
      });

      if (skeleton) scene.remove(skeleton);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '99vw', height: '99vh' }}>
      <div
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.55)',
          color: '#eee',
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
          borderRadius: 6,
          pointerEvents: 'none',
          maxWidth: 'min(90vw, 360px)',
          lineHeight: 1.45,
        }}
      >
        Arrows or WASD to move · Shift to run · Orbit with mouse (same as the{' '}
        <a
          href="https://threejs.org/examples/#webgl_animation_walk"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#8cf', pointerEvents: 'auto' }}
        >
          three.js walk example
        </a>
        )
      </div>
    </div>
  );
}
