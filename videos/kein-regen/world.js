// "Was wäre, wenn es 1 Jahr lang nicht regnet?" — one valley drying out over a year.
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
function hash2(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi),
    b = hash2(xi + 1, yi),
    c = hash2(xi, yi + 1),
    d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
// distance to the nearest Voronoi edge (for cracks in dry soil)
function voronoiEdge(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  let d1 = 9,
    d2 = 9;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const cx = xi + i + hash2(xi + i, yi + j);
      const cy = yi + j + hash2(yi + j + 17, xi + i + 31);
      const d = Math.hypot(x - cx, y - cy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
  return d2 - d1;
}
const C = (hex) => new THREE.Color(hex);
const tmpC = new THREE.Color();
const tmpC2 = new THREE.Color();

// ---------- renderer & scene ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(52, W / H, 0.1, 600);
const fog = new THREE.Fog(0xcfe6f5, 60, 260);
scene.fog = fog;

const sunLight = new THREE.DirectionalLight(0xfff1d8, 2.6);
sunLight.position.set(-40, 60, -30);
scene.add(sunLight);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a3a28, 1.0);
scene.add(hemi);

// ---------- sky ----------
const skyGeo = new THREE.SphereGeometry(400, 32, 20);
const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
scene.add(
  new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  ),
);
const SKY = [
  // [time, top, bottom]
  [0, C("#4f8fd6"), C("#cfe6f5")],
  [14, C("#5d97d4"), C("#e6e6d6")],
  [36, C("#7aa6cf"), C("#f2e2bc")],
  [47, C("#86a8c4"), C("#f4dcb0")],
  [52, C("#4a2e24"), C("#e0864a")],
  [60, C("#5a3e2c"), C("#c99a6a")],
  [68, C("#6e5440"), C("#c8a47a")],
  [71, C("#2e3540"), C("#6c7682")],
  [80, C("#2a313c"), C("#646e7a")],
];
const skyTop = new THREE.Color(),
  skyBot = new THREE.Color();
function skyAt(t) {
  let i = 1;
  while (i < SKY.length - 1 && t > SKY[i][0]) i++;
  const k = smooth(SKY[i - 1][0], SKY[i][0], t);
  skyTop.copy(SKY[i - 1][1]).lerp(SKY[i][1], k);
  skyBot.copy(SKY[i - 1][2]).lerp(SKY[i][2], k);
}
function paintSky() {
  const p = skyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = clamp(p.getY(i) / 220 + 0.08);
    tmpC.copy(skyBot).lerp(skyTop, Math.pow(k, 0.7));
    skyCol[i * 3] = tmpC.r;
    skyCol[i * 3 + 1] = tmpC.g;
    skyCol[i * 3 + 2] = tmpC.b;
  }
  skyGeo.attributes.color.needsUpdate = true;
}
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(14, 32),
  new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false, transparent: true }),
);
sunDisc.position.set(-90, 120, -300);
sunDisc.lookAt(0, 0, 0);
scene.add(sunDisc);

// ---------- the valley ----------
const riverZ = (x) => 6 * Math.sin(x * 0.05) + 2;
const FIELD = { x0: -42, x1: 30, z0: 9, z1: 26 };
const RES = { x: 42, z: 34, r: 11 };
function inField(x, z) {
  return x > FIELD.x0 && x < FIELD.x1 && z > FIELD.z0 && z < FIELD.z1;
}
function height(x, z) {
  const d = Math.abs(z - riverZ(x));
  let h = 0.25 + vnoise(x * 0.08, z * 0.08) * 0.6;
  // river channel
  h -= 2.1 * (1 - smooth(0, 7.5, d));
  // hills behind the river
  h += smooth(-18, -60, z) * (10 + vnoise(x * 0.04, z * 0.04) * 10);
  // gentle rise in front
  h += smooth(40, 75, z) * 4;
  // reservoir basin
  const dr = Math.hypot(x - RES.x, z - RES.z);
  h -= 3.4 * (1 - smooth(0, RES.r, dr));
  // flatten fields
  if (inField(x, z)) h = lerp(h, 0.3, 0.85);
  return h;
}

const terrGeo = new THREE.PlaneGeometry(200, 200, 120, 120).toNonIndexed();
terrGeo.rotateX(-Math.PI / 2);
const tp = terrGeo.attributes.position;
const faceN = tp.count / 3;
const tCol = new Float32Array(tp.count * 3);
terrGeo.setAttribute("color", new THREE.BufferAttribute(tCol, 3));
for (let i = 0; i < tp.count; i++) tp.setY(i, height(tp.getX(i), tp.getZ(i)));
terrGeo.computeVertexNormals();
const terrain = new THREE.Mesh(
  terrGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
);
scene.add(terrain);

// per-face kind and crack mask
const KIND_GRASS = 0,
  KIND_FIELD = 1,
  KIND_BED = 2,
  KIND_FOREST = 3;
const faceKind = new Uint8Array(faceN);
const faceCrack = new Float32Array(faceN);
const facePatch = new Uint8Array(faceN);
const faceH = new Float32Array(faceN);
for (let f = 0; f < faceN; f++) {
  let x = 0,
    y = 0,
    z = 0;
  for (let k = 0; k < 3; k++) {
    x += tp.getX(f * 3 + k);
    y += tp.getY(f * 3 + k);
    z += tp.getZ(f * 3 + k);
  }
  x /= 3;
  y /= 3;
  z /= 3;
  faceH[f] = y;
  if (y < 0.05) faceKind[f] = KIND_BED;
  else if (inField(x, z)) faceKind[f] = KIND_FIELD;
  else if (z < -16) faceKind[f] = KIND_FOREST;
  else faceKind[f] = KIND_GRASS;
  facePatch[f] = (Math.floor((x - FIELD.x0) / 12) + Math.floor((z - FIELD.z0) / 6)) % 3;
  faceCrack[f] = voronoiEdge(x * 0.22, z * 0.22) < 0.07 ? 1 : 0;
}

const PAL = {
  grass: [C("#5f9e45"), C("#b9ae58"), C("#a2804c")],
  field: [[C("#6aa848"), C("#4f8f3a"), C("#7fb04e")], C("#d8bf62"), C("#a88a58")],
  bed: [C("#6d6450"), C("#b8a47e")],
  forest: [C("#3f7a3a"), C("#8a7a3e"), C("#2a2420")],
  crack: C("#3a2c20"),
};

function terrainColor(f, t, level) {
  const kind = faceKind[f];
  const d1 = smooth(5, 22, t); // first yellowing
  const d2 = smooth(20, 62, t); // deep drought
  if (kind === KIND_GRASS) {
    tmpC.copy(PAL.grass[0]).lerp(PAL.grass[1], d1).lerp(PAL.grass[2], d2);
  } else if (kind === KIND_FIELD) {
    tmpC
      .copy(PAL.field[0][facePatch[f]])
      .lerp(PAL.field[1], smooth(10, 22, t))
      .lerp(PAL.field[2], smooth(22, 60, t));
  } else if (kind === KIND_BED) {
    // wet mud just above the water line, pale where it has dried longer
    const above = faceH[f] - level;
    tmpC.copy(PAL.bed[0]).lerp(PAL.bed[1], clamp(above / 0.8));
  } else {
    tmpC.copy(PAL.forest[0]).lerp(PAL.forest[1], smooth(10, 46, t));
    tmpC.lerp(PAL.forest[2], smooth(49, 58, t) * 0.85);
  }
  // cracks in the dry soil
  const kc = smooth(56, 63, t) * faceCrack[f] * (kind === KIND_FOREST ? 0.5 : 1);
  if (kc > 0) tmpC.lerp(PAL.crack, kc * 0.85);
  // the rain darkens everything
  const wet = smooth(71, 76, t);
  if (wet > 0) tmpC.multiplyScalar(1 - 0.35 * wet);
  return tmpC;
}
function paintTerrain(t, level) {
  for (let f = 0; f < faceN; f++) {
    const c = terrainColor(f, t, level);
    for (let k = 0; k < 3; k++) {
      const i = (f * 3 + k) * 3;
      tCol[i] = c.r;
      tCol[i + 1] = c.g;
      tCol[i + 2] = c.b;
    }
  }
  terrGeo.attributes.color.needsUpdate = true;
}

// ---------- water: one plane, the terrain decides where it shows ----------
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200, 1, 1),
  new THREE.MeshStandardMaterial({
    color: 0x3d7fae,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  }),
);
water.rotation.x = -Math.PI / 2;
scene.add(water);
function waterLevel(t) {
  return lerp(-0.1, -1.55, smooth(12, 40, t)) - 0.25 * smooth(40, 64, t);
}

// ---------- crops (instanced) ----------
const crops = [];
{
  const rnd = mulberry32(11);
  for (let x = FIELD.x0 + 1; x < FIELD.x1 - 0.5; x += 1.3)
    for (let z = FIELD.z0 + 0.8; z < FIELD.z1 - 0.5; z += 1.3) {
      crops.push({ x: x + rnd() * 0.3, z: z + rnd() * 0.3, h: 0.8 + rnd() * 0.4, s: rnd() });
    }
}
const cropMesh = new THREE.InstancedMesh(
  new THREE.ConeGeometry(0.32, 1.1, 5),
  new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }),
  crops.length,
);
scene.add(cropMesh);
const dummy = new THREE.Object3D();
const CROP_G = C("#5fa63e"),
  CROP_Y = C("#d9b84e"),
  CROP_B = C("#8a6a40");
function updateCrops(t) {
  const wilt = smooth(11, 24, t);
  const dead = smooth(24, 60, t);
  const gone = smooth(62, 69, t); // blown away by the dust storm
  for (let i = 0; i < crops.length; i++) {
    const c = crops[i];
    const sy = c.h * lerp(1, 0.45, wilt) * lerp(1, 0.7, dead) * (1 - 0.9 * gone);
    dummy.position.set(c.x, 0.3 + 0.55 * sy, c.z);
    dummy.rotation.set(wilt * (0.5 + c.s * 0.4), c.s * 6, wilt * 0.2);
    dummy.scale.set(1, Math.max(sy, 0.02), 1);
    dummy.updateMatrix();
    cropMesh.setMatrixAt(i, dummy.matrix);
    tmpC2.copy(CROP_G).lerp(CROP_Y, wilt).lerp(CROP_B, dead);
    cropMesh.setColorAt(i, tmpC2);
  }
  cropMesh.instanceMatrix.needsUpdate = true;
  cropMesh.instanceColor.needsUpdate = true;
}

// ---------- village ----------
{
  const rnd = mulberry32(31);
  const walls = [0xece2cf, 0xd8c3a2, 0xc9d3dc, 0xe6cdb8];
  const roofs = [0x9a3f33, 0x6b4f43, 0x7a4632];
  for (let i = 0; i < 16; i++) {
    const x = -34 + (i % 8) * 4.2 + rnd();
    const z = 31 + Math.floor(i / 8) * 6 + rnd() * 1.5;
    const w = 2.6 + rnd(),
      h = 2 + rnd() * 1.2;
    const y0 = height(x, z);
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 2.8),
      new THREE.MeshStandardMaterial({ color: walls[i % 4], flatShading: true }),
    );
    b.position.set(x, y0 + h / 2, z);
    scene.add(b);
    const r = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.85, 1.4, 4),
      new THREE.MeshStandardMaterial({ color: roofs[i % 3], flatShading: true }),
    );
    r.position.set(x, y0 + h + 0.7, z);
    r.rotation.y = Math.PI / 4;
    scene.add(r);
  }
  // water tower
  const tower = new THREE.Group();
  const legs = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.6, 7, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, flatShading: true }),
  );
  legs.position.y = 3.5;
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8dde2, flatShading: true }),
  );
  tank.position.y = 8;
  tower.add(legs, tank);
  tower.position.set(-40, height(-40, 40), 40);
  scene.add(tower);
}

// ---------- boats ----------
const boats = [];
for (const [x, col] of [
  [8, 0xc9452f],
  [-16, 0x2f5f9a],
  [24, 0xe0b23a],
]) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 0.8, 1.7),
    new THREE.MeshStandardMaterial({ color: col, flatShading: true }),
  );
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.9, 1.3),
    new THREE.MeshStandardMaterial({ color: 0xf0ece4, flatShading: true }),
  );
  cabin.position.set(1.6, 0.85, 0);
  g.add(hull, cabin);
  const z = riverZ(x);
  g.position.set(x, 0, z);
  g.rotation.y = -Math.atan(0.3 * Math.cos(x * 0.05));
  scene.add(g);
  boats.push({ g, x, z, bed: height(x, z) });
}

// ---------- power plant with cooling tower ----------
const steam = [];
{
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const y = i / 10;
    pts.push(new THREE.Vector2(3.4 - 1.4 * Math.sin(y * Math.PI * 0.85), y * 9));
  }
  const ct = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 16),
    new THREE.MeshStandardMaterial({
      color: 0xbfc4c8,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  );
  ct.position.set(46, height(46, -12), -12);
  scene.add(ct);
  const hall = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, flatShading: true }),
  );
  hall.position.set(39, height(39, -10) + 1.5, -10);
  scene.add(hall);
  const rnd = mulberry32(55);
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf4f4f4,
        flatShading: true,
        transparent: true,
        opacity: 0.85,
      }),
    );
    scene.add(m);
    steam.push({ m, s: rnd(), base: ct.position.clone().add(new THREE.Vector3(0, 9, 0)) });
  }
}
function updateSteam(t) {
  const amount = 1 - smooth(28, 35, t); // no cooling water, plant throttles down
  for (const p of steam) {
    const age = (t * 0.25 + p.s) % 1;
    const vis = amount > 0.02 && p.s < amount;
    p.m.visible = vis;
    if (!vis) continue;
    p.m.position.set(p.base.x + age * 6 + p.s * 1.5, p.base.y + age * 10, p.base.z - age * 2);
    const sc = 1.2 + age * 3;
    p.m.scale.set(sc, sc, sc);
    p.m.material.opacity = 0.8 * (1 - age) * amount;
  }
}

// ---------- forest & fire ----------
const trees = [];
{
  const rnd = mulberry32(77);
  for (let i = 0; i < 220; i++) {
    const x = -80 + rnd() * 160;
    const z = -20 - rnd() * 48;
    const y = height(x, z);
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, 1.6, 5),
      new THREE.MeshStandardMaterial({ color: 0x5a3d2b, flatShading: true }),
    );
    trunk.position.y = 0.8;
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x2f6b33,
      flatShading: true,
      emissive: 0x000000,
    });
    const s = 1 + rnd() * 0.8;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.3 * s, 3.4 * s, 6), crownMat);
    crown.position.y = 1.6 + 1.7 * s;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(1.2 * s, 4 * s, 6),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 }),
    );
    flame.position.y = 1.6 + 2.2 * s;
    g.add(trunk, crown, flame);
    g.position.set(x, y, z);
    scene.add(g);
    const shade = rnd();
    trees.push({
      g,
      crown,
      crownMat,
      flame,
      ignite: 48.4 + (Math.abs(x - 2) / 80) * 7 + rnd() * 1.4,
      seed: rnd() * 10,
      lush: C(shade < 0.5 ? "#2f6b33" : "#3f8038"),
    });
  }
}
const TREE_DRY = C("#8a7a38"),
  TREE_BURN = C("#ff6a1a"),
  TREE_CHAR = C("#1c1714");
function updateTrees(t) {
  const dry = smooth(14, 46, t);
  for (const tr of trees) {
    const b = t - tr.ignite;
    tr.crownMat.color.copy(tr.lush).lerp(TREE_DRY, dry * 0.85);
    tr.crownMat.emissive.setRGB(0, 0, 0);
    let fl = 0;
    let crownScale = 1;
    if (b > 0) {
      const burn = clamp(b / 2.5);
      tr.crownMat.color.lerp(TREE_BURN, Math.min(1, burn * 2)).lerp(TREE_CHAR, smooth(2, 5, b));
      const glow = (1 - smooth(3, 6, b)) * (0.7 + 0.3 * Math.sin(t * 23 + tr.seed));
      tr.crownMat.emissive.setRGB(0.9 * glow, 0.3 * glow, 0.05 * glow);
      fl = smooth(0, 0.8, b) * (1 - smooth(3.5, 6, b));
      crownScale = lerp(1, 0.55, smooth(2, 5, b));
    }
    tr.flame.visible = fl > 0.01;
    if (tr.flame.visible) {
      const f = fl * (0.85 + 0.25 * Math.sin(t * 31 + tr.seed * 3));
      tr.flame.scale.set(f, f * (1 + 0.2 * Math.sin(t * 17 + tr.seed)), f);
      tr.flame.material.color.setRGB(1, 0.45 + 0.2 * Math.sin(t * 13 + tr.seed), 0.1);
    }
    tr.crown.scale.set(crownScale, crownScale, crownScale);
  }
}

// smoke: billboards drifting up from the burning hill
const smokeN = 160;
const smoke = [];
{
  const rnd = mulberry32(91);
  const mat = new THREE.MeshBasicMaterial({ color: 0x3a3330, transparent: true, opacity: 0.5 });
  for (let i = 0; i < smokeN; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat.clone());
    scene.add(m);
    const tr = trees[Math.floor(rnd() * trees.length)];
    smoke.push({ m, tr, s: rnd(), d: rnd() });
  }
}
function updateSmoke(t) {
  for (const p of smoke) {
    const b = t - p.tr.ignite - p.d * 1.5;
    const on = b > 0 && t < 70;
    p.m.visible = on;
    if (!on) continue;
    const age = (b * 0.22 + p.s) % 1;
    const base = p.tr.g.position;
    p.m.position.set(base.x + age * 14, base.y + 5 + age * 26, base.z + age * 4);
    const sc = 2 + age * 7;
    p.m.scale.set(sc, sc * 0.8, sc);
    p.m.material.opacity = 0.55 * Math.sin(age * Math.PI) * (1 - smooth(64, 70, t));
  }
}

// ---------- dust storm ----------
const dustN = 2600;
const dustSeed = new Float32Array(dustN * 4);
{
  const rnd = mulberry32(5);
  for (let i = 0; i < dustN * 4; i++) dustSeed[i] = rnd();
}
const dustPos = new Float32Array(dustN * 3);
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0xc8a070,
  size: 0.35,
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
const dustPts = new THREE.Points(dustGeo, dustMat);
scene.add(dustPts);
function updateDust(t) {
  const k = smooth(60.5, 63, t) * (1 - smooth(69, 70.5, t));
  dustPts.visible = k > 0.01;
  dustMat.opacity = 0.8 * k;
  if (!dustPts.visible) return;
  for (let i = 0; i < dustN; i++) {
    const s = dustSeed.subarray(i * 4, i * 4 + 4);
    const span = 140;
    dustPos[i * 3] = ((s[0] * span + t * (18 + s[3] * 26)) % span) - 70;
    dustPos[i * 3 + 1] = 0.2 + s[1] * s[1] * 14;
    dustPos[i * 3 + 2] = -20 + s[2] * 70;
  }
  dustGeo.attributes.position.needsUpdate = true;
}

// ---------- rain ----------
const rainN = 3000;
const rainSeed = new Float32Array(rainN * 3);
{
  const rnd = mulberry32(13);
  for (let i = 0; i < rainN * 3; i++) rainSeed[i] = rnd();
}
const rainPos = new Float32Array(rainN * 6);
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0 });
const rain = new THREE.LineSegments(rainGeo, rainMat);
scene.add(rain);
function updateRain(t) {
  const k = smooth(70.2, 72.5, t);
  rain.visible = k > 0.01;
  rainMat.opacity = 0.6 * k;
  if (!rain.visible) return;
  const count = Math.floor(rainN * k);
  for (let i = 0; i < rainN; i++) {
    const o = i * 6;
    if (i >= count) {
      rainPos.fill(0, o, o + 6);
      continue;
    }
    const x = -30 + rainSeed[i * 3] * 50;
    const z = 4 + rainSeed[i * 3 + 1] * 32;
    const top = 22;
    const y = top - ((t * 26 + rainSeed[i * 3 + 2] * top) % top);
    rainPos[o] = x;
    rainPos[o + 1] = y;
    rainPos[o + 2] = z;
    rainPos[o + 3] = x - 0.15;
    rainPos[o + 4] = y + 1.1;
    rainPos[o + 5] = z;
  }
  rainGeo.attributes.position.needsUpdate = true;
}

// rain clouds rolling in
const clouds = [];
{
  const rnd = mulberry32(19);
  const mat = new THREE.MeshStandardMaterial({ color: 0x5d6570, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + rnd() * 5, 0), mat);
    m.scale.set(2, 0.6, 1.4);
    scene.add(m);
    clouds.push({ m, x: -40 + rnd() * 120, y: 26 + rnd() * 10, z: -40 + rnd() * 70 });
  }
}
function updateClouds(t) {
  const k = smooth(67.5, 71, t);
  for (const c of clouds) {
    c.m.visible = k > 0.01;
    c.m.position.set(c.x - (1 - k) * 140 + (t - 70) * 0.8, c.y, c.z);
  }
}

// ---------- camera ----------
const CAM = [
  // [t, pos xyz, look xyz]
  [0, [0, 30, 74, 0, 2, 0]],
  [13.9, [5, 24, 62, 0, 1, 2]],
  [14, [-24, 7, 38, -12, 0, 14]],
  [23.9, [-14, 6, 31, -8, 0, 13]],
  [24, [-8, 8, 26, 14, -1, 0]],
  [35.9, [4, 7.5, 21, 26, -1, -2]],
  [36, [26, 15, 64, 40, -1, 32]],
  [47.9, [30, 12, 56, 40, -1, 32]],
  [48, [-4, 9, 22, 2, 7, -40]],
  [59.9, [6, 13, 16, 4, 9, -40]],
  [60, [-12, 22, 54, 0, 0, 2]],
  [69.9, [-2, 17, 42, 0, 0, 2]],
  [70, [-8, 5, 30, -2, 1.5, 12]],
  [80, [-5, 4.4, 26, -1, 1.5, 12]],
];
function cameraAt(t) {
  // piecewise: inside a segment drift linearly, cuts are hard
  let i = 1;
  while (i < CAM.length - 1 && t > CAM[i][0]) i++;
  const [t0, a] = CAM[i - 1],
    [t1, b] = CAM[i];
  const k = clamp((t - t0) / (t1 - t0));
  const v = a.map((x, j) => lerp(x, b[j], k));
  cam.position.set(v[0], v[1], v[2]);
  // heat shimmer in the drought, shake in fire and dust
  const shake = smooth(60, 62, t) * (1 - smooth(69, 70, t)) * 0.12;
  cam.position.x += Math.sin(t * 41) * shake;
  cam.position.y += Math.cos(t * 37) * shake;
  cam.lookAt(v[3], v[4], v[5]);
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudLabel = document.getElementById("hud-label");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
const DAYS = [
  [0, 0],
  [5, 1],
  [14, 14],
  [24, 45],
  [36, 100],
  [48, 180],
  [60, 270],
  [69.6, 365],
];
function daysAt(t) {
  if (t <= DAYS[0][0]) return 0;
  for (let i = 1; i < DAYS.length; i++)
    if (t <= DAYS[i][0])
      return lerp(DAYS[i - 1][1], DAYS[i][1], (t - DAYS[i - 1][0]) / (DAYS[i][0] - DAYS[i - 1][0]));
  return 365;
}
const comma = (n, d = 1) => n.toFixed(d).replace(".", ",");
function renderHud(t) {
  let label = "TAGE OHNE REGEN",
    value,
    sub = " ",
    sub2 = " ";
  if (t >= 69.9) {
    value = "0";
    sub = "ES REGNET";
  } else {
    const d = Math.floor(daysAt(t));
    value = String(d);
    if (t >= 5)
      sub = d < 30 ? "WOCHE " + Math.max(1, Math.ceil(d / 7)) : "MONAT " + Math.ceil(d / 30.4);
  }
  if (t >= 24 && t < 36) {
    const m = lerp(3.2, 0.3, smooth(24, 35, t));
    sub2 = "FLUSSPEGEL " + comma(m) + " m";
  } else if (t >= 36 && t < 48) {
    sub2 = "STAUSEE " + Math.round(lerp(64, 14, smooth(36, 47, t))) + " % VOLL";
  }
  let op = 1;
  if (t < 4.8) op = 0;
  else if (t < 5.3) op = (t - 4.8) / 0.5;
  else if (t > 74.0) op = clamp((74.5 - t) / 0.5);
  hud.style.opacity = op;
  hudLabel.textContent = label;
  hudValue.textContent = value;
  hudSub.textContent = sub;
  hudSub2.textContent = sub2;
}

// ---------- frame ----------
function renderAt(t) {
  const level = waterLevel(t);
  water.position.y = level;
  water.material.color
    .set(t < 36 ? 0x3d7fae : 0x4a7a8a)
    .lerp(tmpC.set(0x6a6a50), smooth(30, 60, t));

  skyAt(t);
  paintSky();
  fog.color.copy(skyBot);
  const haze =
    smooth(14, 40, t) * 0.4 +
    smooth(50, 54, t) * 0.4 +
    smooth(60, 63, t) * 0.5 -
    smooth(70, 73, t) * 0.4;
  fog.near = lerp(70, 6, clamp(haze));
  fog.far = lerp(280, 90, clamp(haze));

  // sun: harsh through the drought, dim in smoke, gone in the rain
  const sunI =
    lerp(2.4, 3.4, smooth(10, 40, t)) *
    (1 - 0.55 * smooth(50, 54, t)) *
    (1 - 0.6 * smooth(69, 71, t));
  sunLight.intensity = sunI;
  sunLight.color
    .set(0xfff1d8)
    .lerp(tmpC.set(0xff9a5a), smooth(50, 54, t) * (1 - smooth(68, 71, t)));
  hemi.intensity = lerp(1.0, 0.75, smooth(69, 72, t));
  sunDisc.visible = t < 69;
  sunDisc.material.opacity = 1 - 0.6 * smooth(50, 54, t);
  sunDisc.material.color.set(0xfff6d8).lerp(tmpC.set(0xff7a3a), smooth(50, 54, t));

  paintTerrain(t, level);
  updateCrops(t);
  for (const b of boats) {
    const floatY = level - 0.15;
    const ground = b.bed + 0.45;
    const grounded = smooth(-0.05, 0.4, ground - floatY);
    b.g.position.y = Math.max(floatY, ground);
    b.g.rotation.z = 0.22 * grounded;
    b.g.rotation.x = 0.08 * grounded;
  }
  updateSteam(t);
  updateTrees(t);
  updateSmoke(t);
  updateDust(t);
  updateRain(t);
  updateClouds(t);
  cameraAt(t);
  renderer.render(scene, cam);
  renderHud(t);
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.world = Promise.resolve();
