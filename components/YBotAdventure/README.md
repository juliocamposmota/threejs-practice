## The basic set up for this project.

### ThreeJS first steps:

1. Renderer + resize
WebGLRenderer, setPixelRatio, setSize, ResizeObserver or window resize. Output: a gray (or clear) full-area canvas that resizes.

2. Scene + camera + one loop
Scene, PerspectiveCamera, requestAnimationFrame, one rotating Mesh (BoxGeometry + MeshStandardMaterial). Output: a spinning cube.

3. Lights
AmbientLight + DirectionalLight (or HemisphereLight). Output: cube reads as 3D, not flat.

4. Controls (pick one)
OrbitControls is fine for inspection. Output: you can orbit the cube without touching movement code yet.

5. Load one GLTF (YBot)
GLTFLoader, useDraco only if needed, scene.add(model). Output: YBot visible, maybe huge/tiny — you fix with scale / position once.

. AnimationMixer
List animations from the glTF, clipAction, play Idle. Output: character animates on load.

7. Clock + delta
Replace any “fixed per frame” rotation with clock.getDelta() for the mixer. Output: animation speed stable when FPS changes.

8. Input → state
Keyboard (or later: virtual joystick) only updates a small state object ({ forward, turn }). Output: numbers change on screen or in console — still no fancy movement.

9. Move a root Group, not vertices
Parent the model under a Group, move/rotate the group. Output: YBot slides/turns without breaking skinning.

10. Second clip + crossfade
Walk vs idle, fadeIn/fadeOut or crossfading pattern. Output: smooth transition when you press move.

11. Ground + simple collision
Raycaster downward from character, snap to floor height. Output: no sinking into the plane.

### Blender + Mixamo first steps

1. Find the models
2. Find animations
3. Add animations to the model
4. Adjust animations loopings
