// Shared building blocks for the "Was wäre, wenn …?" videos.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

export { THREE };
window.THREE = THREE;

export const W = 1080;
export const H = 1920;

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const C = (hex) => new THREE.Color(hex);
export const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
export const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(c));
export function ellipsoid(rx, ry, rz, c, seg = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.max(6, seg - 2)), std(c));
  m.scale.set(rx, ry, rz);
  return m;
}
export const cone = (r, h, c, seg = 8) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), std(c));
export const cyl = (r0, r1, h, c, seg = 8) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), std(c));
export const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function makeRenderer() {
  const host = document.getElementById("world");
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  return renderer;
}

export function skyDome(scene, top, bottom, { radius = 1500, center = [0, 0, 0] } = {}) {
  const geo = new THREE.SphereGeometry(radius, 32, 20);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const t = C(top),
    b = C(bottom),
    c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(b).lerp(t, Math.pow(clamp(p.getY(i) / (radius * 0.5) + 0.05), 0.6));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  m.position.set(center[0], center[1], center[2]);
  scene.add(m);
  return m;
}

export function starField(scene, n = 1800, radius = 900, seed = 5) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rnd() * Math.PI * 2,
      ph = Math.acos(2 * rnd() - 1);
    pos.set(
      [
        radius * Math.sin(ph) * Math.cos(th),
        radius * Math.cos(ph),
        radius * Math.sin(ph) * Math.sin(th),
      ],
      i * 3,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    g,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, fog: false }),
  );
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}

export function textSprite(text, color = "#ffffff", w = 3, h = 0.75) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d");
  g.font = "bold 130px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 18;
  g.strokeStyle = "rgba(0,0,0,0.75)";
  g.strokeText(text, 512, 128);
  g.fillStyle = color;
  g.fillText(text, 512, 128);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true }),
  );
  s.scale.set(w, h, 1);
  return s;
}

const SKIN = [0xf1c7a5, 0xd9a07a, 0x8d5a3b, 0xe8b894, 0x6b4430];
const CLOTH = [0x3d6fd9, 0xd94a3a, 0x2fa38a, 0xe8c547, 0x6a4c93, 0xe07a2f, 0xf0f0f0];
export function makePerson(rnd, scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.7, 3, 8),
    std(CLOTH[Math.floor(rnd() * CLOTH.length)]),
  );
  body.position.y = 0.88;
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 3, 8), std(0x2a2e3a));
  legs.position.y = 0.4;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    std(SKIN[Math.floor(rnd() * SKIN.length)]),
  );
  head.position.y = 1.58;
  g.add(legs, body, head);
  g.scale.setScalar(scale);
  return g;
}

// HUD
const hud = document.getElementById("hud");
const els = ["hud-label", "hud-value", "hud-sub", "hud-sub2"].map((id) =>
  document.getElementById(id),
);
export function setHud(t, label, value, sub = " ", sub2 = " ") {
  [label, value, sub, sub2].forEach((v, i) => {
    if (els[i].textContent !== v) els[i].textContent = v;
  });
  let op = 1;
  if (t < 4.8) op = 0;
  else if (t < 5.3) op = (t - 4.8) / 0.5;
  else if (t > 74.0) op = clamp((74.5 - t) / 0.5);
  hud.style.opacity = op;
}

export function register(renderAt) {
  window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
  renderAt(0);
  window.__hf = window.__hf || {};
  window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady.world = Promise.resolve();
}
