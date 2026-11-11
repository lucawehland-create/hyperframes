// "Was wäre, wenn du in einen Tunnel quer durch die Erde springst?"
// Every frame is a pure function of timeline time t (seconds), drawn on hf-seek.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

window.THREE = THREE;

const W = 1080;
const H = 1920;

// ---------- helpers ----------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const C = (hex) => new THREE.Color(hex);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });

// ---------- the physics of the fall (uniform-density Earth, one way ≈ 42 min) ----------
const R_KM = 6371;
const T_MIN = 42.2;
const tau = (t) => clamp((t - 5) / 61) * T_MIN; // minutes since the jump
const depthKm = (t) => R_KM * (1 - Math.cos((Math.PI * tau(t)) / T_MIN));
const speedKmh = (t) => R_KM * (Math.PI / T_MIN) * Math.sin((Math.PI * tau(t)) / T_MIN) * 60;
function layer(d) {
  const x = d > R_KM ? 2 * R_KM - d : d;
  if (x < 35) return 0;
  if (x < 2900) return 1;
  if (x < 5150) return 2;
  return 3;
}
const LAYER_NAMES = ["KRUSTE", "MANTEL", "ÄUSSERER KERN", "INNERER KERN"];

// ---------- renderer ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const cam = new THREE.PerspectiveCamera(45, W / H, 0.01, 2000);

function starField(scene) {
  const rnd = mulberry32(5);
  const n = 1600;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rnd() * Math.PI * 2,
      ph = Math.acos(2 * rnd() - 1);
    pos.set(
      [500 * Math.sin(ph) * Math.cos(th), 500 * Math.cos(ph), 500 * Math.sin(ph) * Math.sin(th)],
      i * 3,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(
    new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false }),
    ),
  );
}
function textSprite(text, color = "#ffffff", size = 1) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  g.font = "bold 64px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 10;
  g.strokeStyle = "rgba(0,0,0,0.7)";
  g.strokeText(text, 256, 64);
  g.fillStyle = color;
  g.fillText(text, 256, 64);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false }));
  s.scale.set(2.4 * size, 0.6 * size, 1);
  return s;
}

// =====================================================================
// CUTAWAY
// =====================================================================
const cut = new THREE.Scene();
cut.background = C("#03040a");
starField(cut);
cut.add(new THREE.AmbientLight(0xffffff, 0.6));
const cSun = new THREE.DirectionalLight(0xfff2e0, 2.2);
cSun.position.set(10, 6, 8);
cut.add(cSun);
const ER = 6;
const cutLabels = [];
const sc = (km) => (km / R_KM) * ER;
{
  // back hemisphere with continents
  const geo = new THREE.SphereGeometry(ER, 64, 40, Math.PI, Math.PI);
  const rnd = mulberry32(9);
  const col = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const land =
      Math.sin(geo.attributes.position.getX(i) * 1.3 + rnd() * 0.3) *
        Math.cos(geo.attributes.position.getY(i) * 0.9) >
      0.3;
    const c = C(land ? "#4c8f3e" : "#1d5d8f");
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  cut.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.8,
      }),
    ),
  );
  // the layers in the cut plane
  const ring = (r0, r1, color, emissive, z) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(sc(r0), sc(r1), 96),
      new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 0.8,
        side: THREE.DoubleSide,
      }),
    );
    m.position.z = z;
    cut.add(m);
  };
  ring(R_KM - 35 - 60, R_KM, 0x7a5a40, 0x2a1a10, 0.004); // crust (drawn a bit thicker to be visible)
  ring(2900, R_KM - 95, 0xd8582a, 0x8a2a0a, 0.003);
  ring(1221, 2900, 0xf0a030, 0xb86010, 0.002);
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(sc(1221), 64),
    new THREE.MeshStandardMaterial({
      color: 0xfff2c0,
      emissive: 0xffd080,
      emissiveIntensity: 1,
      side: THREE.DoubleSide,
    }),
  );
  inner.position.z = 0.005;
  cut.add(inner);
  const tunnel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, ER * 2),
    new THREE.MeshBasicMaterial({ color: 0x0a0a0a }),
  );
  tunnel.position.z = 0.01;
  cut.add(tunnel);
  const labels = [
    ["KRUSTE", 0, sc(R_KM - 40), "#e8d0b0"],
    ["MANTEL", 2.0, sc(4300), "#ffe0c8"],
    ["ÄUSSERER KERN", 1.6, sc(2050), "#fff0c0"],
    ["INNERER KERN", 0, -sc(600), "#ffffff"],
    ["DEUTSCHLAND", 0, ER + 0.8, "#ffd27a"],
    ["NEUSEELAND", 0, -ER - 0.8, "#ffd27a"],
  ];
  for (const [txt, x, y, color] of labels) {
    const s = textSprite(txt, color, txt.length > 10 ? 0.9 : 0.8);
    s.position.set(x === 0 ? 1.9 : x + 1.2, y, 0.05);
    if (txt === "DEUTSCHLAND" || txt === "NEUSEELAND") s.position.x = 0;
    cut.add(s);
    cutLabels.push(s);
  }
}
const dot = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0x7fe0ff }),
);
dot.position.z = 0.06;
cut.add(dot);
const dotGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.4, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.3 }),
);
dot.add(dotGlow);

function renderCut(t) {
  // y position of the jumper: +ER (Germany) to -ER (New Zealand); after 66 s, back and forth
  let y;
  if (t < 66) y = ER * Math.cos((Math.PI * tau(t)) / T_MIN);
  else y = ER * Math.cos(Math.PI * (1 + (t - 66) / 3.2)); // sped-up oscillation in the finale
  dot.position.y = y;
  dotGlow.scale.setScalar(1 + 0.25 * Math.sin(t * 6));
  for (const l of cutLabels) l.visible = t < 5 || t >= 70;
  let pos, look;
  if (t < 5) {
    pos = V(lerp(3, 2, t / 5), 1, lerp(27, 25, t / 5));
    look = V(0, 0.5, 0);
  } else if (t < 36) {
    pos = V(2.2, y + 1.2, 8);
    look = V(0, y - 0.6, 0);
  } else if (t < 60) {
    pos = V(2.2, y - 0.8, 8.5);
    look = V(0, y + 0.4, 0);
  } else {
    const k = smooth(70, 80, t);
    pos = V(lerp(2, 3, k), 0.6, lerp(25, 28, k));
    look = V(0, 0.4, 0);
  }
  cam.position.copy(pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(look);
  renderer.render(cut, cam);
}

// =====================================================================
// POV: falling down the shaft
// =====================================================================
const pov = new THREE.Scene();
pov.background = C("#000000");
const wallMat = new THREE.MeshStandardMaterial({
  color: 0x6a5040,
  emissive: 0x000000,
  side: THREE.BackSide,
  flatShading: true,
  roughness: 1,
});
{
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 400, 24, 40, true), wallMat);
  pov.add(shaft);
}
const rings = [];
for (let i = 0; i < 40; i++) {
  const r = new THREE.Mesh(
    new THREE.TorusGeometry(1.96, 0.05, 6, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true }),
  );
  r.rotation.x = Math.PI / 2;
  pov.add(r);
  rings.push(r);
}
const streakN = 500;
const streakSeed = [];
{
  const rnd = mulberry32(13);
  for (let i = 0; i < streakN; i++) streakSeed.push([rnd() * 6.28, 1.4 + rnd() * 0.5, rnd()]);
}
const streakPos = new Float32Array(streakN * 6);
const streakGeo = new THREE.BufferGeometry();
streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3));
const streaks = new THREE.LineSegments(
  streakGeo,
  new THREE.LineBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.6 }),
);
streaks.frustumCulled = false;
pov.add(streaks);
const povLight = new THREE.PointLight(0xffffff, 10, 30, 1.2);
pov.add(povLight);
pov.add(new THREE.AmbientLight(0xffffff, 0.25));
const skyHole = new THREE.Mesh(
  new THREE.CircleGeometry(2, 32),
  new THREE.MeshBasicMaterial({ color: 0x9fd0ff }),
);
skyHole.rotation.x = Math.PI / 2;
pov.add(skyHole);

const LAYER_COL = [
  [0x6a5040, 0x000000],
  [0xc8481a, 0x6a1a04],
  [0xf09a28, 0xa85008],
  [0xfff0c0, 0xffc860],
];
let travel = 0;
function renderPov(t) {
  const d = depthKm(t);
  const L = layer(d);
  const v = speedKmh(t);
  // integrate travel distance for ring motion (deterministic)
  travel = 0;
  const dt = 0.05;
  for (let s = 5; s < t; s += dt) travel += (0.5 + speedKmh(s) / 2500) * Math.min(dt, t - s);
  wallMat.color.set(LAYER_COL[L][0]);
  wallMat.emissive.set(LAYER_COL[L][1]);
  wallMat.emissiveIntensity = L === 0 ? 0 : 0.9;
  povLight.color.set(L === 0 ? 0xffffff : LAYER_COL[L][1]);
  rings.forEach((r, i) => {
    r.position.y = -((i * 6 - ((travel * 6) % 6) + 240) % 240) + 2;
    r.material.color.set(L === 0 ? 0x9a8a7a : LAYER_COL[L][0]);
    r.material.opacity = 0.7;
  });
  const sp = 0.3 + v / 12000;
  for (let i = 0; i < streakN; i++) {
    const [a, r, s] = streakSeed[i];
    const y = -((s * 80 + travel * 40) % 80) + 4;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    streakPos.set([x, y, z, x, y + sp * 3, z], i * 6);
  }
  streakGeo.attributes.position.needsUpdate = true;
  streaks.material.opacity = clamp(v / 15000) * 0.8;
  // the opening above, shrinking after the jump
  skyHole.visible = t < 14;
  skyHole.position.y = 2 + (t - 5) * 4;
  cam.position.set(0, 0, 0);
  const weightless = t >= 36 && t < 48 ? smooth(36, 38, t) : 0;
  cam.up.set(Math.sin(t * 0.6 * weightless), 0, Math.cos(t * 0.6 * weightless) || 1);
  cam.lookAt(0, -10, 0.0001);
  cam.fov = 75;
  cam.updateProjectionMatrix();
  renderer.render(pov, cam);
  cam.fov = 45;
  cam.updateProjectionMatrix();
}

// =====================================================================
// ARRIVAL: popping out in the Pacific
// =====================================================================
const sea = new THREE.Scene();
sea.background = C("#7fb8e8");
sea.fog = new THREE.Fog(0xb8daf2, 40, 220);
sea.add(new THREE.HemisphereLight(0xdfefff, 0x2a5a7a, 1.1));
const seaSun = new THREE.DirectionalLight(0xfff2e0, 2.2);
seaSun.position.set(30, 40, -20);
sea.add(seaSun);
const waterGeo = new THREE.PlaneGeometry(300, 300, 60, 60);
waterGeo.rotateX(-Math.PI / 2);
const waterBase = Float32Array.from(waterGeo.attributes.position.array);
sea.add(
  new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({ color: 0x2a7aa8, roughness: 0.25, flatShading: true }),
  ),
);
{
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.35, 8, 32),
    std(0x8a8f99, { metalness: 0.5 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.3;
  sea.add(rim);
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x050505 }),
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.32;
  sea.add(hole);
  // New Zealand on the horizon
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(8 + i * 3, 6 + i * 2, 6), std(0x3f6a3a));
    m.position.set(-40 + i * 12, 0, -120 - i * 6);
    sea.add(m);
  }
  const sign = textSprite("NEUSEELAND", "#ffffff", 2.2);
  sign.position.set(-14, 14, -110);
  sea.add(sign);
}
const diver = new THREE.Group();
{
  const suit = std(0xf2f2ee);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 4, 10), suit);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), suit);
  head.position.y = 0.72;
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 14, 10, -1, 2, 0.9, 1.2),
    std(0xd8a84a, { metalness: 0.8 }),
  );
  visor.position.set(0, 0.72, 0.1);
  diver.add(body, head, visor);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 3, 8), suit);
    arm.position.set(s * 0.42, 0.3, 0);
    arm.rotation.z = s * 2.6;
    diver.add(arm);
  }
  sea.add(diver);
}
function renderSea(t) {
  const a = waterGeo.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) {
    const r = Math.hypot(waterBase[i], waterBase[i + 2]);
    a[i + 1] =
      r < 2.2
        ? -0.5
        : Math.sin(waterBase[i] * 0.15 + t * 1.4) * 0.3 +
          Math.cos(waterBase[i + 2] * 0.12 - t) * 0.3;
  }
  waterGeo.attributes.position.needsUpdate = true;
  waterGeo.computeVertexNormals();
  // rises out, hangs at the top, falls back in
  const u = (t - 61.5) / 6;
  const y = u < 0 ? -2 : u > 1 ? -2 : -2 + 6 * Math.sin(Math.PI * u);
  diver.position.set(0, y, 0);
  diver.rotation.set(0, t * 0.4, 0);
  diver.visible = u > 0 && u < 1;
  const k = smooth(60, 70, t);
  cam.position.set(lerp(5, 4, k), lerp(4, 3.5, k), lerp(12, 10, k));
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 2, 0);
  renderer.render(sea, cam);
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudLabel = document.getElementById("hud-label");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const pad = (n) => String(Math.floor(n)).padStart(2, "0");
function renderHud(t) {
  if (t < 70) {
    const d = depthKm(t);
    hudLabel.textContent = "TIEFE";
    hudValue.textContent = fmt(d) + " km";
    hudSub.textContent = "TEMPO: " + fmt(speedKmh(t)) + " KM/H";
    const m = tau(t);
    hudSub2.textContent =
      LAYER_NAMES[layer(d)] + " · ZEIT " + pad(m) + ":" + pad((m % 1) * 60) + " MIN";
    if (t >= 66) {
      hudSub.textContent = "ANGEKOMMEN: PAZIFIK";
      hudSub2.textContent = "ZEIT 42:12 MIN";
    }
  } else {
    hudLabel.textContent = "REISEZEIT";
    hudValue.textContent = "≈ 40 Minuten";
    hudSub.textContent = "EINMAL DURCH DIE GANZE ERDE";
    hudSub2.textContent = " ";
  }
  let op = 1;
  if (t < 4.8) op = 0;
  else if (t < 5.3) op = (t - 4.8) / 0.5;
  else if (t > 74.0) op = clamp((74.5 - t) / 0.5);
  hud.style.opacity = op;
}

// ---------- frame ----------
function renderAt(t) {
  const isPov = (t >= 5 && t < 24) || (t >= 36 && t < 48);
  if (isPov) renderPov(t);
  else if (t >= 60 && t < 70) renderSea(t);
  else renderCut(t);
  renderHud(t);
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.world = Promise.resolve();
