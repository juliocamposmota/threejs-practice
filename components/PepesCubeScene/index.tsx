'use client';

import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default function PepesCubeScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container ) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const cameraAspect = width / height;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(30, cameraAspect, 0.1, 1000);
    camera.position.y = 5;
    camera.position.z = 10;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Geometry + Materials
    const geometry = new THREE.BoxGeometry();
    const textureLoader = new THREE.TextureLoader();

    const images = [
      '/assets/face1.png',
      '/assets/face2.png',
      '/assets/face3.png',
      '/assets/face4.png',
      '/assets/face5.png',
      '/assets/face6.png',
    ];

    const materials = images.map((image) => {
      const texture = textureLoader.load(image);
      return new THREE.MeshBasicMaterial({ map: texture });
    });

    const cube = new THREE.Mesh(geometry, materials);
    scene.add(cube);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;

    // Resize handler
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    let animationId: number;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
}
