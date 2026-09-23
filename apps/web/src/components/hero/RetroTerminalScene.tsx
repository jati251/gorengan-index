"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const STAR = [
  ".....#.....",
  "....###....",
  "...#####...",
  "###########",
  ".#########.",
  "..#######..",
  "..#######..",
  ".###...###.",
  "###.....###",
  "##.......##",
];

export default function RetroTerminalScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
    } catch {
      mount.dataset.webgl = "unavailable";
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, 100);
    camera.position.set(6, 5, 10);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const light = new THREE.DirectionalLight(0xffd7a0, 3.2);
    light.position.set(-4, 8, 7);
    scene.add(light);
    const fill = new THREE.DirectionalLight(0x8ee0b2, 1.2);
    fill.position.set(6, 3, -4);
    scene.add(fill);

    const orange = new THREE.MeshLambertMaterial({ color: 0xf09649 });
    const orangeLight = new THREE.MeshLambertMaterial({ color: 0xffc16e });
    const orangeDark = new THREE.MeshLambertMaterial({ color: 0xb85039 });
    const mint = new THREE.MeshLambertMaterial({ color: 0x7ccf9a });
    const green = new THREE.MeshLambertMaterial({ color: 0x315e4d });
    const cream = new THREE.MeshLambertMaterial({ color: 0xf3e7bd });
    const materials = [orange, orangeLight, orangeDark, mint, green, cream];
    const geometries: THREE.BufferGeometry[] = [];
    const group = new THREE.Group();
    scene.add(group);

    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group = group) => {
      geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    const star = new THREE.Group();
    star.position.set(-0.7, 0.25, 0.7);
    STAR.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (pixel !== "#") return;
        const material = (x + y) % 5 === 0 ? orangeLight : orange;
        add(new THREE.BoxGeometry(0.31, 0.31, 0.36), material, (x - 5) * 0.315, (4.5 - y) * 0.315, 0, star);
      });
    });
    group.add(star);

    const ring = add(new THREE.TorusGeometry(1.12, 0.28, 4, 12), mint, 1.65, 0.52, -1.3);
    ring.rotation.set(0.5, 0.48, 0.17);
    const ringInner = add(new THREE.TorusGeometry(0.66, 0.08, 4, 12), green, 1.65, 0.52, -1.26);
    ringInner.rotation.copy(ring.rotation);

    const blocks = [
      [-2.6, -1.45, 0.15, 0.88, 0.88, 0.88, green],
      [-2.05, -1.12, 0.42, 0.62, 0.62, 0.62, mint],
      [2.16, -1.45, 0.65, 1.04, 1.04, 1.04, orangeDark],
      [2.55, -0.87, 1.12, 0.48, 0.48, 0.48, orangeLight],
      [2.84, 1.76, -0.2, 0.48, 0.48, 0.48, cream],
      [-2.77, 1.28, -0.4, 0.39, 0.39, 0.39, mint],
      [0.4, -2.24, 0.75, 0.36, 0.36, 0.36, cream],
    ] as const;
    blocks.forEach(([x, y, z, w, h, d, material]) => add(new THREE.BoxGeometry(w, h, d), material, x, y, z));
    const pyramid = add(new THREE.ConeGeometry(0.75, 1.25, 4), cream, -2.9, 0.36, -1.25);
    pyramid.rotation.y = Math.PI / 4;
    const diamond = add(new THREE.OctahedronGeometry(0.58, 0), orangeDark, 2.85, 0.05, -0.35);
    diamond.rotation.z = 0.18;

    let targetX = 0;
    let targetY = 0;
    const onPointerMove = (event: PointerEvent) => {
      const box = mount.getBoundingClientRect();
      targetX = ((event.clientX - box.left) / box.width - 0.5) * 0.22;
      targetY = ((event.clientY - box.top) / box.height - 0.5) * 0.12;
    };
    const onPointerLeave = () => { targetX = 0; targetY = 0; };
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerleave", onPointerLeave);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      const scale = aspect < 0.9 ? 4.9 : 4.05;
      camera.left = -scale * aspect;
      camera.right = scale * aspect;
      camera.top = scale;
      camera.bottom = -scale;
      camera.updateProjectionMatrix();
      renderer.setSize(Math.round(width * 0.7), Math.round(height * 0.7), false);
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    let frame = 0;
    let time = 0;
    const animate = () => {
      time += 0.012;
      group.rotation.y += (targetX - group.rotation.y) * 0.035;
      group.rotation.x += (targetY - group.rotation.x) * 0.035;
      star.position.y = 0.25 + Math.sin(time) * 0.08;
      ring.rotation.z += 0.002;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    if (!reducedMotion) animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerleave", onPointerLeave);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="retro-scene" aria-hidden="true" />;
}
