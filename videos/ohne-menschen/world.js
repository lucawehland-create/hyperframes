// "Was wäre, wenn alle Menschen auf einmal verschwinden?" — one city, 10,000 years.
// Every frame is a pure function of timeline time t (seconds), drawn on hf-seek.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

window.THREE = THREE;

const W = 1080;
const H = 1920;
const VANISH = 4.95;

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
const tmpC = new THREE.Color();
const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

// growth of nature over the film
const grass = (t) => smooth(34, 44, t);
const overgrow = (t) => smooth(38, 48, t);
const forest = (t) => smooth(46, 66, t);

// ---------- renderer & scene ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 1200);
const fog = new THREE.Fog(0x1a2240, 80, 420);
scene.fog = fog;
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xc8d8ff, 0x403a34, 0.8);
scene.add(hemi);

// per-chapter look: [start, skyTop, skyBottom, sunI, hemiI, sun dir, fogNear, fogFar, night]
const LOOKS = [
  [0, "#24345e", "#f0a070", 1.2, 0.6, [-60, 20, -80], 80, 420, 0.6],
  [14, "#050916", "#121a34", 0.15, 0.25, [40, 60, -60], 60, 380, 1],
  [24, "#5a96d8", "#d6e8f2", 2.6, 1.0, [-50, 90, 30], 110, 520, 0],
  [36, "#6aa0d8", "#dceaf0", 2.6, 1.0, [50, 90, 40], 90, 480, 0],
  [48, "#6f7f8f", "#c4ccd2", 1.4, 1.0, [-40, 80, 60], 70, 420, 0],
  [60, "#4a7ab0", "#f4d4a0", 2.4, 0.9, [-80, 40, 40], 110, 600, 0],
  [70, "#3f8fe0", "#f8e8c8", 3.0, 1.0, [60, 90, 60], 200, 900, 0],
];
function lookAt(t) {
  let L = LOOKS[0];
  for (const l of LOOKS) if (t >= l[0]) L = l;
  return L;
}
const skyGeo = new THREE.SphereGeometry(1000, 32, 20);
const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
const sky = new THREE.Mesh(
  skyGeo,
  new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
);
scene.add(sky);
let lastLook = null;
function paintSky(L) {
  if (lastLook === L) return;
  lastLook = L;
  const top = C(L[1]),
    bot = C(L[2]);
  const p = skyGeo.attributes.position;
  for (let j = 0; j < p.count; j++) {
    const k = Math.pow(clamp(p.getY(j) / 500 + 0.05), 0.6);
    tmpC.copy(bot).lerp(top, k);
    skyCol[j * 3] = tmpC.r;
    skyCol[j * 3 + 1] = tmpC.g;
    skyCol[j * 3 + 2] = tmpC.b;
  }
  skyGeo.attributes.color.needsUpdate = true;
  fog.color.copy(bot);
}
const stars = (() => {
  const rnd = mulberry32(3);
  const n = 900;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rnd() * Math.PI * 2,
      y = 0.15 + rnd() * 0.85;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 900, y * 900, Math.sin(th) * r * 900], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(
    g,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }),
  );
  scene.add(p);
  return p;
})();

// ---------- textures ----------
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}
function windowTextures(seed, facade) {
  const rnd = mulberry32(seed);
  const cols = 8,
    rows = 16;
  const lit = [];
  for (let i = 0; i < cols * rows; i++) lit.push(rnd() < 0.55);
  const draw = (emissive) => (g, w, h) => {
    g.fillStyle = emissive ? "#000" : facade;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const on = lit[y * cols + x];
        g.fillStyle = emissive ? (on ? "#ffd58a" : "#000") : on ? "#3a3f4a" : "#2a2e36";
        g.fillRect(x * (w / cols) + 5, y * (h / rows) + 5, w / cols - 10, h / rows - 9);
      }
  };
  return [canvasTex(256, 512, draw(false)), canvasTex(256, 512, draw(true))];
}
const WIN = [
  windowTextures(1, "#8a8f99"),
  windowTextures(2, "#a39a8c"),
  windowTextures(3, "#6f7686"),
  windowTextures(4, "#b8b2a6"),
];

// ---------- ground, roads, river ----------
const groundMat = std(0x55634e);
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
}
const roadMat = std(0x33353b);
const walkMat = std(0x9a9a94);
{
  const road = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    scene.add(m);
  };
  road(400, 10, 0, 0);
  road(10, 120, 30, 0);
  road(10, 120, -30, 0);
  const walk = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), walkMat);
    m.position.set(x, 0.12, z);
    scene.add(m);
  };
  walk(400, 4, 0, -7);
  walk(400, 4, 0, 7);
  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 22),
    new THREE.MeshStandardMaterial({ color: 0x3d6f8e, roughness: 0.3 }),
  );
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, 0.06, 70);
  scene.add(river);
}

// ---------- bridge ----------
const bridgeMat = std(0x7d8590, { roughness: 0.6 });
const span = new THREE.Group();
{
  const deckA = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 10), bridgeMat);
  deckA.position.set(0, 4, 59);
  const deckC = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 10), bridgeMat);
  deckC.position.set(0, 4, 81);
  scene.add(deckA, deckC);
  for (const z of [63.5, 76.5]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), bridgeMat);
    pil.position.set(0, 2, z);
    scene.add(pil);
    for (const x of [-4, 4]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.8, 12, 0.8), bridgeMat);
      tower.position.set(x, 10, z);
      scene.add(tower);
    }
  }
  const deckB = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 12), bridgeMat);
  deckB.position.set(0, 0, 6); // pivot at the near edge (z = 64)
  span.add(deckB);
  span.position.set(0, 4, 64);
  scene.add(span);
}
function updateBridge(t) {
  bridgeMat.color.set(0x7d8590).lerp(tmpC.set(0x7a4a2a), smooth(38, 52, t));
  const k = smooth(50.6, 52.2, t);
  span.rotation.x = k * k * 1.2;
  span.position.y = 4 - smooth(51.6, 53, t) * 4.6;
  span.visible = t < 60;
}

// ---------- buildings ----------
const buildings = [];
{
  const rnd = mulberry32(17);
  for (let gx = -110; gx <= 110; gx += 13) {
    for (let gz = -16; gz >= -120; gz -= 13) {
      if (rnd() < 0.12) continue;
      const w = 8 + rnd() * 3,
        d = 8 + rnd() * 3;
      const near = gz > -40 ? 0.6 : 1;
      const h = (8 + rnd() * rnd() * 46) * near + 6;
      const [map, emap] = WIN[Math.floor(rnd() * 4)];
      const mapC = map.clone(),
        emapC = emap.clone();
      for (const tx of [mapC, emapC]) {
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        tx.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 12)));
        tx.needsUpdate = true;
      }
      const mat = new THREE.MeshStandardMaterial({
        map: mapC,
        emissiveMap: emapC,
        emissive: 0xffffff,
        emissiveIntensity: 1,
        roughness: 0.9,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.y = h / 2;
      const pivot = new THREE.Group();
      pivot.position.set(gx + rnd() * 2, 0, gz);
      pivot.add(mesh);
      scene.add(pivot);
      const tall = h > 30 && Math.abs(gx) < 70 && gz < -30;
      buildings.push({
        pivot,
        mesh,
        mat,
        h,
        out: 14.6 + rnd() * 8,
        fall: tall && rnd() < 0.75 ? 54.2 + rnd() * 3.6 : null,
        dir: rnd() < 0.5 ? -1 : 1,
        axis: rnd() < 0.5 ? "x" : "z",
        ruin: 0.12 + rnd() * 0.25,
      });
    }
  }
  // front row of low houses on the near side of the street
  for (let x = -100; x <= 100; x += 9) {
    if (Math.abs(x - 30) < 8 || Math.abs(x + 30) < 8) continue;
    const h = 7 + rnd() * 6;
    const [map, emap] = WIN[Math.floor(rnd() * 4)];
    const mat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap: emap,
      emissive: 0xffffff,
      emissiveIntensity: 1,
      roughness: 0.9,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(7, h, 8), mat);
    mesh.position.y = h / 2;
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, 15);
    pivot.add(mesh);
    scene.add(pivot);
    buildings.push({ pivot, mesh, mat, h, out: 14.6 + rnd() * 8, fall: null, ruin: 0.3 });
  }
}
// the four tallest towers in view fall one after another
{
  const cands = buildings
    .filter((b) => Math.abs(b.pivot.position.x) < 45 && b.pivot.position.z < -25)
    .sort((a, b) => b.h - a.h);
  for (const b of buildings) b.fall = null;
  cands.slice(0, 4).forEach((b, i) => {
    b.fall = 54.2 + i * 1.1;
    b.dir = i % 2 ? 1 : -1;
    b.axis = "z";
  });
}
const VINE = C("#5f7a4a");
function updateBuildings(t) {
  const L = lookAt(t);
  const og = overgrow(t),
    fo = forest(t);
  for (const b of buildings) {
    // windows: lit at dusk, going dark one by one in the night chapter, dark after
    let lit = 0;
    if (t < 14) lit = 1;
    else if (t < 24) lit = t < b.out ? 1 : 0;
    b.mat.emissiveIntensity = lit * (L[8] > 0.8 ? 1.2 : 0.8);
    b.mat.color.set(0xffffff).lerp(VINE, 0.55 * og + 0.3 * fo);
    // falls
    b.pivot.rotation.set(0, 0, 0);
    b.pivot.visible = true;
    if (b.fall !== null && t >= b.fall) {
      const k = clamp((t - b.fall) / 2.7);
      const ang = k * k * 1.45 * b.dir;
      if (b.axis === "x") b.pivot.rotation.x = ang;
      else b.pivot.rotation.z = ang;
      b.pivot.visible = t < 60;
    }
    // long after: only stumps remain
    const ruin = smooth(59.9, 60, t);
    const sy = lerp(1, b.fall !== null ? 0.06 : b.ruin, ruin);
    b.mesh.scale.y = sy;
    b.mesh.position.y = (b.h * sy) / 2;
    if (ruin > 0) b.pivot.visible = true;
    if (t >= 70) b.pivot.visible = false;
  }
}

// ---------- cars ----------
const cars = [];
{
  const rnd = mulberry32(41);
  const CAR = [0xd94a3a, 0x3d6fd9, 0xe8c547, 0xeeeeee, 0x2fa38a, 0x333a44, 0x9a9aa4];
  const car = (x, z, yaw) => {
    const g = new THREE.Group();
    const mat = std(CAR[Math.floor(rnd() * CAR.length)], { roughness: 0.5 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1.9), mat);
    b.position.y = 0.7;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.7), mat);
    top.position.set(-0.2, 1.55, 0);
    g.add(b, top);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    scene.add(g);
    cars.push({ g, mat, base: mat.color.clone(), tilt: (rnd() - 0.5) * 0.3 });
  };
  for (let i = 0; i < 18; i++) car(-60 + i * 7 + rnd() * 2, -2.4, 0);
  for (let i = 0; i < 18; i++) car(60 - i * 7 - rnd() * 2, 2.4, Math.PI);
  for (let i = 0; i < 6; i++) car(27.6, -12 - i * 6, Math.PI / 2);
}
const RUST = C("#6e4128");
function updateCars(t) {
  const r = smooth(38, 47, t);
  for (const c of cars) {
    c.mat.color.copy(c.base).lerp(RUST, r);
    c.g.rotation.z = c.tilt * r; // flat tyres
    c.g.position.y = -0.25 * r;
    c.g.visible = t < 60;
  }
}

// ---------- people (gone at VANISH) ----------
const SKIN = [0xf1c7a5, 0xd9a07a, 0x8d5a3b, 0xe8b894, 0x6b4430];
const CLOTH = [0x3d6fd9, 0xd94a3a, 0x2fa38a, 0xe8c547, 0x6a4c93, 0x3a3a44, 0xe07a2f, 0xf0f0f0];
const people = [];
{
  const rnd = mulberry32(7);
  for (let i = 0; i < 70; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.8, 3, 8),
      std(CLOTH[Math.floor(rnd() * CLOTH.length)]),
    );
    body.position.y = 0.95;
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 3, 8), std(0x2a2e3a));
    legs.position.y = 0.45;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 10, 8),
      std(SKIN[Math.floor(rnd() * SKIN.length)]),
    );
    head.position.y = 1.72;
    g.add(legs, body, head);
    const side = rnd() < 0.5 ? -1 : 1;
    const x = -40 + rnd() * 70;
    g.position.set(x, 0.25, side * (6 + rnd() * 2));
    g.rotation.y = rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(g);
    people.push({
      g,
      x,
      dir: g.rotation.y > 0 ? 1 : -1,
      speed: 0.8 + rnd() * 0.6,
      gone: VANISH + rnd() * 0.12,
    });
  }
}
function updatePeople(t) {
  for (const p of people) {
    p.g.visible = t < p.gone;
    p.g.position.x = p.x + p.dir * p.speed * t;
  }
}

// ---------- animals (weeks to months) ----------
const animals = [];
function quad(color, len, hgt, headCol) {
  const g = new THREE.Group();
  const m = std(color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, hgt * 0.45, hgt * 0.4), m);
  body.position.y = hgt * 0.75;
  g.add(body);
  for (const [dx, dz] of [
    [0.38, 0.13],
    [0.38, -0.13],
    [-0.38, 0.13],
    [-0.38, -0.13],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(hgt * 0.1, hgt * 0.55, hgt * 0.1), m);
    leg.position.set(dx * len, hgt * 0.28, dz * hgt * 1.2);
    g.add(leg);
  }
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(hgt * 0.3, hgt * 0.3, hgt * 0.28),
    std(headCol),
  );
  head.position.set(len * 0.58, hgt * 1.05, 0);
  g.add(head);
  scene.add(g);
  return g;
}
{
  const rnd = mulberry32(23);
  // dogs
  for (let i = 0; i < 5; i++) {
    const g = quad([0x8a6a4a, 0x2a2a2a, 0xd8c8a8][i % 3], 1.0, 0.8, 0x6a4a30);
    animals.push({
      g,
      x0: -8 - i * 2.4 - rnd() * 2,
      z: -1.5 + rnd() * 3,
      v: 1.4 + rnd() * 0.4,
      t0: 24,
      t1: 36,
    });
  }
  // deer
  for (let i = 0; i < 4; i++) {
    const g = quad(0xa0703f, 1.6, 1.7, 0x8a5a30);
    const antl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 4), std(0xd8c8a0));
    antl.position.set(1.0, 2.2, 0);
    g.add(antl);
    animals.push({ g, x0: -22 - i * 3.5, z: -3 + rnd() * 6, v: 1.0 + rnd() * 0.3, t0: 29, t1: 48 });
  }
}
function updateAnimals(t) {
  for (const a of animals) {
    const on = t >= a.t0 && t < a.t1;
    a.g.visible = on;
    if (!on) continue;
    const dt = t - a.t0;
    a.g.position.set(a.x0 + a.v * dt, Math.abs(Math.sin(dt * 7)) * 0.08, a.z);
  }
}

// ---------- grass and trees (instanced) ----------
const tuftN = 1400,
  treeN = 900;
const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 1, 5), std(0x5a8a3a), tuftN);
const trunks = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.25, 0.4, 1, 6),
  std(0x5a3d2b),
  treeN,
);
const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std(0x3f7a3a), treeN);
scene.add(tufts, trunks, crowns);
const tuftData = [],
  treeData = [];
{
  const rnd = mulberry32(99);
  for (let i = 0; i < tuftN; i++)
    tuftData.push({ x: -110 + rnd() * 220, z: -10 + rnd() * 22, s: 0.5 + rnd(), d: rnd() * 4 });
  for (let i = 0; i < treeN; i++) {
    const onStreet = i < 260;
    treeData.push({
      x: -120 + rnd() * 240,
      z: onStreet ? -9 + rnd() * 18 : -130 + rnd() * 185,
      s: 0.7 + rnd() * 0.9,
      d: onStreet ? rnd() * 6 : 4 + rnd() * 12,
      c: rnd(),
    });
  }
}
const dummy = new THREE.Object3D();
const TREE_A = C("#3f7a3a"),
  TREE_B = C("#5d8f3c"),
  TREE_GOLD = C("#7a8a3a");
function updatePlants(t) {
  const g = grass(t);
  for (let i = 0; i < tuftN; i++) {
    const p = tuftData[i];
    const s = smooth(0, 1, g * 1.6 - p.d * 0.15) * p.s;
    dummy.position.set(p.x, s * 0.5, p.z);
    dummy.rotation.set(0, i, 0);
    dummy.scale.set(s, Math.max(s * 1.4, 0.001), s);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
  }
  tufts.instanceMatrix.needsUpdate = true;
  tufts.visible = g > 0 && t < 70;
  const tg = smooth(38, 66, t);
  for (let i = 0; i < treeN; i++) {
    const p = treeData[i];
    const k = clamp(tg * 1.4 - p.d / 16);
    const s = k * p.s * (t >= 60 ? 1.6 : 1);
    const h = 2 + s * 7;
    dummy.position.set(p.x, (h * k) / 2, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(Math.max(s, 0.001), Math.max(h * k, 0.001), Math.max(s, 0.001));
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, h * k + 1.5 * s, p.z);
    dummy.rotation.set(0, i, 0);
    const cs = Math.max(2.4 * s, 0.001);
    dummy.scale.set(cs, cs * 1.1, cs);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
    tmpC.copy(TREE_A).lerp(TREE_B, p.c);
    if (t >= 60) tmpC.lerp(TREE_GOLD, 0.25 * p.c);
    crowns.setColorAt(i, tmpC);
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  crowns.instanceColor.needsUpdate = true;
  trunks.visible = crowns.visible = tg > 0 && t < 70;
}

// ---------- the pyramids, far away ----------
const desert = new THREE.Group();
{
  const sand = new THREE.Mesh(new THREE.CircleGeometry(500, 48), std(0xd9b77a));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(600, 0.1, 0);
  desert.add(sand);
  const stone = std(0xcfa868, { roughness: 1 });
  for (const [x, z, r, h] of [
    [600, -30, 32, 30],
    [560, -90, 26, 24],
    [650, -110, 18, 17],
  ]) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), stone);
    p.position.set(x, h / 2, z);
    p.rotation.y = Math.PI / 4;
    desert.add(p);
  }
  // a plastic bottle half buried in the sand
  const bottle = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fd0f0,
    transparent: true,
    opacity: 0.75,
    roughness: 0.15,
  });
  const bodyB = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.0, 14), glass);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.28, 0.3, 14), glass);
  neck.position.y = 0.65;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), std(0x2a6ad9));
  cap.position.y = 0.86;
  bottle.add(bodyB, neck, cap);
  bottle.rotation.set(0, 0.6, Math.PI / 2 - 0.15);
  bottle.position.set(590.5, 0.32, 66);
  desert.add(bottle);
  scene.add(desert);
}

// ---------- camera ----------
const CAM = [
  [0, [-34, 4.5, 4, 20, 3, -3]],
  [13.9, [-26, 4.2, 3, 24, 3, -3]],
  [14, [0, 44, 120, 0, 14, -40]],
  [23.9, [0, 38, 100, 0, 14, -40]],
  [24, [16, 3, 0, -14, 1.4, 0]],
  [35.9, [10, 3, 0, -18, 1.4, 0]],
  [36, [-38, 5, 0, 10, 2, 0]],
  [47.9, [-30, 4.5, 0, 14, 2, 0]],
  [48, [24, 12, 126, 0, 12, 20]],
  [59.9, [20, 11, 116, 0, 12, 20]],
  [60, [0, 48, 130, 0, 6, -20]],
  [69.9, [0, 38, 108, 0, 6, -20]],
  [70, [588, 2.6, 74, 600, 10, -40]],
  [80, [589, 3, 80, 600, 11, -40]],
];
function cameraAt(t) {
  let i = 1;
  while (i < CAM.length - 1 && t > CAM[i][0]) i++;
  const [t0, a] = CAM[i - 1],
    [t1, b] = CAM[i];
  const k = clamp((t - t0) / (t1 - t0));
  const v = a.map((x, j) => lerp(x, b[j], k));
  cam.position.set(v[0], v[1], v[2]);
  cam.lookAt(v[3], v[4], v[5]);
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const HOURS = [
  [VANISH, 1 / 60],
  [14, 48],
  [24, 720],
  [36, 8760],
  [48, 8760 * 20],
  [60, 8760 * 300],
  [69.6, 8760 * 10000],
];
function hoursAt(t) {
  if (t <= HOURS[0][0]) return 0;
  for (let i = 1; i < HOURS.length; i++)
    if (t <= HOURS[i][0]) {
      const [t0, h0] = HOURS[i - 1],
        [t1, h1] = HOURS[i];
      const k = (t - t0) / (t1 - t0);
      return Math.exp(lerp(Math.log(h0), Math.log(h1), k));
    }
  return 8760 * 10000;
}
const plural = (n, one, many) => fmt(n) + " " + (Math.round(n) === 1 ? one : many);
function duration(h) {
  if (h < 1) return plural(Math.max(1, h * 60), "Minute", "Minuten");
  if (h < 48) return plural(h, "Stunde", "Stunden");
  if (h < 24 * 60) return plural(h / 24, "Tag", "Tage");
  if (h < 730 * 24) return plural(h / 730, "Monat", "Monate");
  const y = h / 8760;
  return plural(y >= 1000 ? Math.round(y / 100) * 100 : y, "Jahr", "Jahre");
}
function renderHud(t) {
  hudValue.textContent = duration(hoursAt(t));
  hudSub.textContent = "WELTBEVÖLKERUNG: 0";
  if (t >= 14 && t < 24) {
    const dark = buildings.filter((b) => t >= b.out).length / buildings.length;
    hudSub2.textContent = "STROMNETZ: " + Math.round(100 * (1 - dark)) + " %";
  } else hudSub2.textContent = " ";
  let op = 1;
  if (t < 4.8) op = 0;
  else if (t < 5.3) op = (t - 4.8) / 0.5;
  else if (t > 74.0) op = clamp((74.5 - t) / 0.5);
  hud.style.opacity = op;
}

// ---------- frame ----------
function renderAt(t) {
  const L = lookAt(t);
  paintSky(L);
  stars.visible = L[8] > 0.5;
  sun.intensity = L[3];
  hemi.intensity = L[4];
  sun.position.set(L[5][0], L[5][1], L[5][2]);
  if (t >= 70) sun.position.x += 600;
  sun.target.position.set(t >= 70 ? 600 : 0, 0, 0);
  sun.target.updateMatrixWorld();
  fog.near = L[6];
  fog.far = L[7];

  roadMat.color.set(0x33353b).lerp(tmpC.set(0x4f6a3e), grass(t) * 0.6 + forest(t) * 0.4);
  walkMat.color.set(0x9a9a94).lerp(tmpC.set(0x5f7a4a), grass(t) * 0.7);
  groundMat.color.set(0x55634e).lerp(tmpC.set(0x3f6a34), forest(t));

  updateBuildings(t);
  updateCars(t);
  updatePeople(t);
  updateAnimals(t);
  updatePlants(t);
  updateBridge(t);
  desert.visible = t >= 70;
  cameraAt(t);
  renderer.render(scene, cam);
  renderHud(t);
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.world = Promise.resolve();
