"use client";

import { useEffect, useRef } from "react";

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

type Vec3 = [number, number, number];

interface Face {
  pts: [number, number][];
  depth: number;
  color: string;
}

const PALETTE = {
  yellow: ["#ffe055", "#f4c41b", "#c6960c"],
  lime: ["#dff396", "#c8df79", "#94ab48"],
  pink: ["#ff85bc", "#eb619f", "#b63874"],
  mint: ["#6cf3b7", "#3fdf97", "#21a96c"],
  teal: ["#4cc6cc", "#26a6ac", "#17767b"],
  cream: ["#e4f7fa", "#c3e6eb", "#89b2ba"],
} as const;

type Shade = keyof typeof PALETTE;

function rotate(v: Vec3, rx: number, ry: number): Vec3 {
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x1 = v[0] * cy + v[2] * sy;
  const z1 = -v[0] * sy + v[2] * cy;

  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y2 = v[1] * cx - z1 * sx;
  const z2 = v[1] * sx + z1 * cx;
  return [x1, y2, z2];
}

function addBox(
  faces: Face[],
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  shade: Shade,
  rx: number,
  ry: number,
  scale: number,
  ox: number,
  oy: number
) {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const corners: Vec3[] = [
    [cx - hw, cy - hh, cz - hd],
    [cx + hw, cy - hh, cz - hd],
    [cx + hw, cy + hh, cz - hd],
    [cx - hw, cy + hh, cz - hd],
    [cx - hw, cy - hh, cz + hd],
    [cx + hw, cy - hh, cz + hd],
    [cx + hw, cy + hh, cz + hd],
    [cx - hw, cy + hh, cz + hd],
  ].map((p) => rotate(p as Vec3, rx, ry));

  const quads: { idx: [number, number, number, number]; colorIdx: 0 | 1 | 2 }[] = [
    { idx: [3, 2, 6, 7], colorIdx: 0 }, // top
    { idx: [4, 5, 6, 7], colorIdx: 1 }, // front
    { idx: [1, 2, 6, 5], colorIdx: 2 }, // right
    { idx: [0, 3, 7, 4], colorIdx: 2 }, // left
    { idx: [0, 1, 2, 3], colorIdx: 1 }, // back
    { idx: [0, 1, 5, 4], colorIdx: 2 }, // bottom
  ];

  const [topColor, frontColor, sideColor] = PALETTE[shade];
  const colors = [topColor, frontColor, sideColor];

  for (const q of quads) {
    const a = corners[q.idx[0]];
    const b = corners[q.idx[1]];
    const c = corners[q.idx[2]];
    const e1x = b[0] - a[0];
    const e1y = b[1] - a[1];
    const e2x = c[0] - a[0];
    const e2y = c[1] - a[1];
    // Backface culling in orthographic view (+Z faces viewer)
    if (e1x * e2y - e1y * e2x <= 0) continue;

    let depth = 0;
    const pts: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const p = corners[q.idx[i]];
      depth += p[2];
      pts.push([ox + p[0] * scale, oy - p[1] * scale]);
    }
    faces.push({ pts, depth: depth / 4, color: colors[q.colorIdx] });
  }
}

function addPyramid(
  faces: Face[],
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  shade: Shade,
  rx: number,
  ry: number,
  scale: number,
  ox: number,
  oy: number
) {
  const halfH = height / 2;
  const raw: Vec3[] = [
    [cx, cy + halfH, cz],
    [cx + radius, cy - halfH, cz],
    [cx, cy - halfH, cz + radius],
    [cx - radius, cy - halfH, cz],
    [cx, cy - halfH, cz - radius],
  ];
  const v = raw.map((p) => rotate(p, rx, ry));
  const [c0, c1, c2] = PALETTE[shade];
  const tris: { idx: [number, number, number]; color: string }[] = [
    { idx: [0, 2, 1], color: c0 },
    { idx: [0, 3, 2], color: c1 },
    { idx: [0, 4, 3], color: c2 },
    { idx: [0, 1, 4], color: c2 },
  ];
  for (const t of tris) {
    const a = v[t.idx[0]];
    const b = v[t.idx[1]];
    const c = v[t.idx[2]];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross <= 0) continue;
    faces.push({
      pts: t.idx.map((i) => [ox + v[i][0] * scale, oy - v[i][1] * scale]),
      depth: (a[2] + b[2] + c[2]) / 3,
      color: t.color,
    });
  }
}

function addOctahedron(
  faces: Face[],
  cx: number,
  cy: number,
  cz: number,
  r: number,
  shade: Shade,
  rx: number,
  ry: number,
  scale: number,
  ox: number,
  oy: number
) {
  const raw: Vec3[] = [
    [cx, cy + r, cz],
    [cx + r, cy, cz],
    [cx, cy, cz + r],
    [cx - r, cy, cz],
    [cx, cy, cz - r],
    [cx, cy - r, cz],
  ];
  const v = raw.map((p) => rotate(p, rx, ry));
  const [c0, c1, c2] = PALETTE[shade];
  const tris: { idx: [number, number, number]; color: string }[] = [
    { idx: [0, 2, 1], color: c0 },
    { idx: [0, 3, 2], color: c1 },
    { idx: [0, 4, 3], color: c2 },
    { idx: [0, 1, 4], color: c2 },
    { idx: [5, 1, 2], color: c1 },
    { idx: [5, 2, 3], color: c2 },
    { idx: [5, 3, 4], color: c2 },
    { idx: [5, 4, 1], color: c2 },
  ];
  for (const t of tris) {
    const a = v[t.idx[0]];
    const b = v[t.idx[1]];
    const c = v[t.idx[2]];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross <= 0) continue;
    faces.push({
      pts: t.idx.map((i) => [ox + v[i][0] * scale, oy - v[i][1] * scale]),
      depth: (a[2] + b[2] + c[2]) / 3,
      color: t.color,
    });
  }
}

const STAR_VOXELS: { x: number; y: number; shade: Shade }[] = [];
STAR.forEach((row, y) => {
  [...row].forEach((ch, x) => {
    if (ch !== "#") return;
    STAR_VOXELS.push({
      x: (x - 5) * 0.315 - 0.7,
      y: (4.5 - y) * 0.315 + 0.25,
      shade: (x + y) % 5 === 0 ? "lime" : "yellow",
    });
  });
});

const BLOCKS: readonly [number, number, number, number, Shade][] = [
  [-2.6, -1.45, 0.15, 0.88, "teal"],
  [-2.05, -1.12, 0.42, 0.62, "mint"],
  [2.16, -1.45, 0.65, 1.04, "pink"],
  [2.55, -0.87, 1.12, 0.48, "lime"],
  [2.84, 1.76, -0.2, 0.48, "cream"],
  [-2.77, 1.28, -0.4, 0.39, "mint"],
  [0.4, -2.24, 0.75, 0.36, "cream"],
];

export default function RetroTerminalScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      mount.dataset.webgl = "unavailable";
      return;
    }
    mount.appendChild(canvas);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;

    let width = 0;
    let height = 0;
    let targetX = 0;
    let targetY = 0;
    let rotX = 0.42;
    let rotY = -0.52;
    let time = 0;
    let visible = true;
    let lastRender = 0;
    let frame = 0;

    const renderFrame = () => {
      if (!width || !height) return;
      ctx.clearRect(0, 0, width, height);

      const scale = Math.min(width, height) / (width / height < 0.9 ? 9.6 : 8.1);
      const ox = width * 0.5;
      const oy = height * 0.52;
      const faces: Face[] = [];

      // Pixelated torus ring built from 12 chunky isometric segments
      const ringSegments = 12;
      const ringR = 1.08;
      for (let i = 0; i < ringSegments; i++) {
        const angle = (i / ringSegments) * Math.PI * 2 + time * 0.25;
        const lx = Math.cos(angle) * ringR;
        const ly = Math.sin(angle) * ringR;
        const wx = 1.65 + lx * 0.85;
        const wy = 0.52 + ly * 0.88;
        const wz = -1.3 + lx * 0.35;
        addBox(faces, wx, wy, wz, 0.42, 0.42, 0.42, i % 3 === 0 ? "teal" : "mint", rotX, rotY, scale, ox, oy);
      }

      // Floating geometric blocks
      for (const [x, y, z, size, shade] of BLOCKS) {
        addBox(faces, x, y, z, size, size, size, shade, rotX, rotY, scale, ox, oy);
      }

      // Pyramid & octahedron diamond
      addPyramid(faces, -2.9, 0.36, -1.25, 0.72, 1.25, "cream", rotX, rotY, scale, ox, oy);
      addOctahedron(faces, 2.85, 0.05, -0.35, 0.58, "pink", rotX, rotY, scale, ox, oy);

      // Iconic bobbing pixel star
      const bob = Math.sin(time) * 0.1;
      for (const voxel of STAR_VOXELS) {
        addBox(faces, voxel.x, voxel.y + bob, 0.7, 0.31, 0.31, 0.36, voxel.shade, rotX, rotY, scale, ox, oy);
      }

      // Painter's algorithm sort (back to front)
      faces.sort((a, b) => a.depth - b.depth);

      for (let i = 0; i < faces.length; i++) {
        const f = faces[i];
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(Math.round(f.pts[0][0]), Math.round(f.pts[0][1]));
        for (let j = 1; j < f.pts.length; j++) {
          ctx.lineTo(Math.round(f.pts[j][0]), Math.round(f.pts[j][1]));
        }
        ctx.closePath();
        ctx.fill();
      }
    };

    const resize = () => {
      const nextW = Math.max(1, Math.round(mount.clientWidth * 0.7));
      const nextH = Math.max(1, Math.round(mount.clientHeight * 0.7));
      if (nextW === width && nextH === height) return;
      width = nextW;
      height = nextH;
      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = false;
      renderFrame();
    };

    const onPointerMove = (event: PointerEvent) => {
      const box = mount.getBoundingClientRect();
      if (!box.width || !box.height) return;
      targetX = ((event.clientX - box.left) / box.width - 0.5) * 0.24;
      targetY = ((event.clientY - box.top) / box.height - 0.5) * 0.14;
    };
    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    mount.addEventListener("pointermove", onPointerMove, { passive: true });
    mount.addEventListener("pointerleave", onPointerLeave, { passive: true });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    visibilityObserver.observe(mount);

    const animate = (timestamp: number) => {
      frame = requestAnimationFrame(animate);
      if (!visible || document.hidden || timestamp - lastRender < (mobile ? 33 : 20)) return;
      lastRender = timestamp;
      time += mobile ? 0.024 : 0.014;
      rotY += (-0.52 + targetX - rotY) * 0.05;
      rotX += (0.42 + targetY - rotX) * 0.05;
      renderFrame();
    };

    if (!reducedMotion) {
      frame = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerleave", onPointerLeave);
      canvas.remove();
    };
  }, []);

  return <div ref={mountRef} className="retro-scene" aria-hidden="true" />;
}
