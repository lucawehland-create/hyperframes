// "Was wäre, wenn das Internet 24 Stunden ausfällt?" — one city through one offline day.
// Every frame is a pure function of timeline time t (seconds), drawn on hf-seek.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

window.THREE = THREE;

const W = 1080;
const H = 1920;
const OUTAGE = 5.0; // the network goes down
const BACK = 70.0; // and comes back

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

// ---------- clock ----------
const CLOCK = [
  [0, 0],
  [OUTAGE, 0],
  [14, 360],
  [24, 540],
  [36, 780],
  [48, 1020],
  [60, 1260],
  [69.95, 1439.9],
];
function minutesAt(t) {
  if (t >= BACK) return 1440 + (t - BACK) * 2;
  for (let i = 1; i < CLOCK.length; i++)
    if (t <= CLOCK[i][0]) {
      const [t0, m0] = CLOCK[i - 1],
        [t1, m1] = CLOCK[i];
      return t1 === t0 ? m1 : lerp(m0, m1, (t - t0) / (t1 - t0));
    }
  return 1440;
}

// ---------- renderer & scene ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 900);
const fog = new THREE.Fog(0x1a2240, 80, 420);
scene.fog = fog;
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xc8d8ff, 0x403a34, 0.8);
scene.add(hemi);

// sky
const skyGeo = new THREE.SphereGeometry(700, 32, 20);
const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
scene.add(
  new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  ),
);
const SKY = [
  // [hour, top, bottom]
  [0, C("#070b1c"), C("#1a2342")],
  [5, C("#0b1230"), C("#2a2f52")],
  [6.5, C("#3a4a7a"), C("#f0a878")],
  [8.5, C("#4f8fd6"), C("#cfe3f2")],
  [16.5, C("#4f8fd6"), C("#d8e6f0")],
  [18.6, C("#3b3f7a"), C("#f08a5a")],
  [20.5, C("#151a3a"), C("#4a3a5a")],
  [22, C("#070b1c"), C("#1a2342")],
  [25, C("#070b1c"), C("#1a2342")],
];
const skyTop = new THREE.Color(),
  skyBot = new THREE.Color();
function skyAt(h) {
  let i = 1;
  while (i < SKY.length - 1 && h > SKY[i][0]) i++;
  const k = smooth(SKY[i - 1][0], SKY[i][0], h);
  skyTop.copy(SKY[i - 1][1]).lerp(SKY[i][1], k);
  skyBot.copy(SKY[i - 1][2]).lerp(SKY[i][2], k);
  const p = skyGeo.attributes.position;
  for (let j = 0; j < p.count; j++) {
    const kk = Math.pow(clamp(p.getY(j) / 350 + 0.05), 0.6);
    tmpC.copy(skyBot).lerp(skyTop, kk);
    skyCol[j * 3] = tmpC.r;
    skyCol[j * 3 + 1] = tmpC.g;
    skyCol[j * 3 + 2] = tmpC.b;
  }
  skyGeo.attributes.color.needsUpdate = true;
}
// stars
const stars = (() => {
  const rnd = mulberry32(3);
  const n = 900;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rnd() * Math.PI * 2,
      y = 0.15 + rnd() * 0.85;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 600, y * 600, Math.sin(th) * r * 600], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    fog: false,
  });
  const p = new THREE.Points(g, m);
  scene.add(p);
  return p;
})();

// ---------- canvas textures ----------
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
const windowMats = [];

// ---------- ground & roads ----------
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std(0x4a5a48));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const road = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(0x33353b));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    scene.add(m);
  };
  road(400, 10, 0, 0); // main street
  road(10, 160, 30, 40); // cross street
  const walk = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), std(0x9a9a94));
    m.position.set(x, 0.12, z);
    scene.add(m);
  };
  walk(400, 4, 0, -7);
  walk(400, 4, 0, 7);
  for (let i = -40; i <= 40; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.25),
      new THREE.MeshBasicMaterial({ color: 0xd8d4c4 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(i * 5, 0.05, 0);
    scene.add(m);
  }
}

// ---------- downtown ----------
{
  const rnd = mulberry32(17);
  for (let gx = -100; gx <= 100; gx += 13) {
    for (let gz = -16; gz >= -110; gz -= 13) {
      if (Math.abs(gx - 5) < 9 && gz > -30) continue; // tower plot
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
      windowMats.push(mat);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(gx + rnd() * 2, h / 2, gz);
      scene.add(b);
    }
  }
}

// ---------- the cell tower ----------
const TOWER = new THREE.Vector3(5, 0, -20);
const towerLights = [];
const rings = [];
{
  const steel = std(0xb8bcc4, { roughness: 0.6 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 52, 6), steel);
  mast.position.set(TOWER.x, 26, TOWER.z);
  scene.add(mast);
  for (let i = 1; i <= 5; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5 - i * 0.5, 0.3, 0.3), steel);
    bar.position.set(TOWER.x, i * 9, TOWER.z);
    scene.add(bar);
  }
  for (const [dx, dz] of [
    [1.6, 0],
    [-1.6, 0],
    [0, 1.6],
  ]) {
    const ant = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.25), std(0xe8e8e8));
    ant.position.set(TOWER.x + dx, 46, TOWER.z + dz);
    scene.add(ant);
  }
  for (const y of [52.5, 40, 28]) {
    const l = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false }),
    );
    l.position.set(TOWER.x, y, TOWER.z);
    scene.add(l);
    towerLights.push(l);
  }
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.06, 6, 64),
      new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.8, fog: false }),
    );
    r.position.set(TOWER.x, 46, TOWER.z);
    r.rotation.x = Math.PI / 2;
    scene.add(r);
    rings.push(r);
  }
}
function networkOn(t) {
  return t < OUTAGE || t >= BACK;
}
function updateTower(t) {
  const on = networkOn(t);
  const blink = Math.sin(t * Math.PI * 1.6) > 0;
  for (const l of towerLights) l.visible = on && blink;
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    const ph = (t * 0.55 + i / rings.length) % 1;
    // after the comeback the rings pulse big and fast
    const big = t >= BACK ? 2.2 : 1;
    r.visible = on;
    const s = (2 + ph * 40) * big;
    r.scale.set(s, s, s);
    r.material.opacity = 0.75 * (1 - ph);
  }
}

// ---------- people ----------
const SKIN = [0xf1c7a5, 0xd9a07a, 0x8d5a3b, 0xe8b894, 0x6b4430];
const CLOTH = [0x3d6fd9, 0xd94a3a, 0x2fa38a, 0xe8c547, 0x6a4c93, 0x3a3a44, 0xe07a2f, 0xf0f0f0];
const people = [];
function person(x, z, yaw, seed, scale = 1) {
  const rnd = mulberry32(seed);
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
  g.position.set(x, 0.25, z);
  g.rotation.y = yaw;
  g.scale.setScalar(scale * (0.9 + rnd() * 0.2));
  scene.add(g);
  const p = { g, seed: rnd() * 10, x, z, yaw };
  people.push(p);
  return p;
}
function updatePeople(t) {
  for (const p of people) {
    p.g.rotation.z = Math.sin(t * 1.7 + p.seed) * 0.04;
    p.g.rotation.y = p.yaw + Math.sin(t * 0.6 + p.seed) * 0.15;
  }
}

// ---------- the shop and the queue (06:00–09:00) ----------
{
  const shop = new THREE.Mesh(new THREE.BoxGeometry(16, 6.5, 9), std(0xe6dccb));
  shop.position.set(-12, 3.25, 14.5);
  scene.add(shop);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x8fb7c9, emissive: 0x6a8a99, emissiveIntensity: 0.4 }),
  );
  glass.position.set(-12, 2.1, 9.95);
  glass.rotation.y = Math.PI;
  scene.add(glass);
  const signTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = "#1f6f4a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.font = "bold 84px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("MARKT", w / 2, h / 2 + 4);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 2.2),
    new THREE.MeshBasicMaterial({ map: signTex }),
  );
  sign.position.set(-12, 5.2, 9.94);
  sign.rotation.y = Math.PI;
  scene.add(sign);
  const cashTex = canvasTex(512, 300, (g, w, h) => {
    g.fillStyle = "#fffdf4";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#c62828";
    g.lineWidth = 14;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#c62828";
    g.font = "bold 92px sans-serif";
    g.textAlign = "center";
    g.fillText("NUR", w / 2, 128);
    g.fillText("BARGELD", w / 2, 236);
  });
  const cash = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.9),
    new THREE.MeshBasicMaterial({ map: cashTex }),
  );
  cash.position.set(-15.5, 2.4, 9.9);
  cash.rotation.y = Math.PI;
  scene.add(cash);
  // the queue, out of the door and down the pavement
  for (let i = 0; i < 14; i++) person(-6.5 + i * 1.25, 7.2 + (i % 2) * 0.3, Math.PI / 2, 100 + i);
}

// ---------- traffic jam (09:00–11:00) ----------
const cars = [];
{
  const rnd = mulberry32(41);
  const CAR = [0xd94a3a, 0x3d6fd9, 0xe8c547, 0xeeeeee, 0x2fa38a, 0x333a44, 0x9a9aa4];
  const car = (x, z, yaw) => {
    const g = new THREE.Group();
    const col = CAR[Math.floor(rnd() * CAR.length)];
    const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1.9), std(col, { roughness: 0.5 }));
    b.position.y = 0.7;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.7), std(col, { roughness: 0.5 }));
    top.position.set(-0.2, 1.55, 0);
    const brake = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.25, 1.6),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    );
    brake.position.set(-2.02, 0.85, 0);
    g.add(b, top, brake);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    scene.add(g);
    cars.push({ g, brake, seed: rnd() * 10 });
  };
  for (let i = 0; i < 16; i++) car(-30 + i * 5.2 + rnd(), -2.4, 0);
  for (let i = 0; i < 16; i++) car(90 - i * 5.2 - rnd(), 2.4, Math.PI);
  for (let i = 0; i < 9; i++) car(27.6, 10 + i * 5.4, -Math.PI / 2);
  for (let i = 0; i < 4; i++) car(32.4, -12 - i * 5.4, Math.PI / 2);
  // trucks queued at the depot
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 2.6), std(0xd94a3a));
    cab.position.set(4.4, 1.9, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 2.7), std(0xf2f2ee));
    box.position.set(-1, 2.3, 0);
    g.add(cab, box);
    g.position.set(27.6, 0, 62 + i * 11);
    g.rotation.y = -Math.PI / 2;
    scene.add(g);
  }
  // depot hall
  const hall = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 40), std(0xa8adb4));
  hall.position.set(52, 5, 70);
  scene.add(hall);
  const depTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = "#24476b";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.font = "bold 76px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("LOGISTIK", w / 2, h / 2 + 4);
  });
  const dep = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.5),
    new THREE.MeshBasicMaterial({ map: depTex }),
  );
  dep.position.set(36.9, 7.5, 70);
  dep.rotation.y = -Math.PI / 2;
  scene.add(dep);
  // traffic lights at the crossing
  for (const [x, z] of [
    [24, -6],
    [36, 6],
  ]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), std(0x2a2a2a));
    pole.position.set(x, 2.5, z);
    scene.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), std(0x1a1a1a));
    box.position.set(x, 5.2, z);
    scene.add(box);
  }
}
function updateCars(t) {
  for (const c of cars) {
    c.brake.visible = Math.sin(t * 2 + c.seed) > -0.6;
  }
}

// ---------- airport (13:00–15:00) ----------
const board = { tex: null, ctx: null, shown: -1 };
{
  const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(140, 120), std(0x5a5c62));
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(150, 0.04, 60);
  scene.add(tarmac);
  const term = new THREE.Mesh(
    new THREE.BoxGeometry(90, 14, 16),
    new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.3, metalness: 0.2 }),
  );
  term.position.set(150, 7, 34);
  scene.add(term);
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 640;
  board.ctx = c.getContext("2d");
  board.tex = new THREE.CanvasTexture(c);
  board.tex.colorSpace = THREE.SRGBColorSpace;
  const bm = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 11.25),
    new THREE.MeshBasicMaterial({ map: board.tex, fog: false }),
  );
  bm.position.set(140, 8, 42.1);
  scene.add(bm);
  // planes
  const plane = (x, z, yaw) => {
    const g = new THREE.Group();
    const white = std(0xf4f4f4, { roughness: 0.5 });
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 22, 12), white);
    fus.rotation.z = Math.PI / 2;
    fus.position.y = 3;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), white);
    nose.position.set(11, 3, 0);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 26), white);
    wing.position.set(0, 2.6, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.3), std(0x2f5f9a));
    tail.position.set(-9.5, 5.5, 0);
    const stab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 9), white);
    stab.position.set(-9.8, 3.4, 0);
    g.add(fus, nose, wing, tail, stab);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    scene.add(g);
  };
  plane(112, 62, Math.PI / 2);
  plane(168, 64, Math.PI / 2);
  plane(190, 90, 0.3);
  for (let i = 0; i < 10; i++) person(128 + i * 1.6, 44 + (i % 3) * 0.8, Math.PI, 300 + i);
}
const FLIGHTS = [
  ["13:10", "BERLIN"],
  ["13:45", "PARIS"],
  ["14:20", "LONDON"],
  ["15:05", "ROM"],
  ["16:30", "MADRID"],
  ["17:15", "WIEN"],
];
function updateBoard(t) {
  const n = clamp(Math.floor((t - 36.6) / 0.7) + 1, 0, FLIGHTS.length);
  if (n === board.shown) return;
  board.shown = n;
  const g = board.ctx;
  g.fillStyle = "#0d1420";
  g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#ffd27a";
  g.font = "bold 64px sans-serif";
  g.fillText("ABFLUG", 40, 82);
  g.font = "bold 52px monospace";
  FLIGHTS.forEach(([time, city], i) => {
    const y = 170 + i * 82;
    g.fillStyle = "#e8eef6";
    g.fillText(time, 40, y);
    g.fillText(city, 250, y);
    const cancelled = i < n;
    g.fillStyle = cancelled ? "#ff4a3a" : "#7fd48a";
    g.fillText(cancelled ? "ANNULLIERT" : "PLANMÄSSIG", 620, y);
  });
  board.tex.needsUpdate = true;
}

// ---------- hospital (15:00–17:00) ----------
const ambulanceLight = { m: null };
{
  const hosp = new THREE.Mesh(
    new THREE.BoxGeometry(34, 22, 14),
    new THREE.MeshStandardMaterial({
      map: WIN[3][0],
      emissiveMap: WIN[3][1],
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
    }),
  );
  windowMats.push(hosp.material);
  hosp.position.set(-100, 11, 60);
  scene.add(hosp);
  const crossTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#d62828";
    g.fillRect(96, 32, 64, 192);
    g.fillRect(32, 96, 192, 64);
  });
  const cross = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({ map: crossTex }),
  );
  cross.position.set(-100, 12, 52.95);
  cross.rotation.y = Math.PI;
  scene.add(cross);
  const signTex = canvasTex(1024, 160, (g, w, h) => {
    g.fillStyle = "#d62828";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.font = "bold 100px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("KRANKENHAUS", w / 2, h / 2 + 6);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 3.1),
    new THREE.MeshBasicMaterial({ map: signTex }),
  );
  sign.position.set(-100, 19.6, 52.95);
  sign.rotation.y = Math.PI;
  scene.add(sign);
  // ambulance
  const amb = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2.8, 2.4), std(0xf4f4f0));
  body.position.y = 1.7;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.02, 0.4, 2.42), std(0xd62828));
  stripe.position.y = 1.6;
  const light = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.35, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x2a6aff }),
  );
  light.position.y = 3.3;
  amb.add(body, stripe, light);
  amb.position.set(-92, 0, 47);
  amb.rotation.y = 0.2;
  scene.add(amb);
  ambulanceLight.m = light;
  // staff carrying paper files
  for (let i = 0; i < 6; i++) {
    const p = person(-108 + i * 2.6, 49 + (i % 2) * 1.2, Math.PI + (i % 2 ? 0.6 : -0.4), 500 + i);
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.06), std(0xffffff));
    paper.position.set(0.25, 1.1, 0.4);
    p.g.add(paper);
  }
}

// ---------- the evening square (17:00–21:00) ----------
const stringLights = [];
{
  const rnd = mulberry32(61);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(16, 24), std(0xb8ac98));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(-18, 0.06, 44);
  scene.add(plaza);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const x = -18 + Math.cos(a) * 18,
      z = 44 + Math.sin(a) * 18;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.5, 6), std(0x5a3d2b));
    trunk.position.set(x, 1.25, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), std(0x3f7a3a));
    crown.position.set(x, 3.8, z);
    scene.add(trunk, crown);
  }
  // groups of people talking, facing each other
  const groups = [
    [-22, 40, 4],
    [-13, 42, 3],
    [-18, 50, 5],
    [-26, 49, 3],
    [-10, 50, 4],
  ];
  let s = 700;
  for (const [cx, cz, n] of groups)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd();
      const x = cx + Math.cos(a) * 1.3,
        z = cz + Math.sin(a) * 1.3;
      person(x, z, Math.atan2(cx - x, cz - z), s++);
    }
  // a guitarist and two kids
  person(-18, 44, Math.PI, s++);
  person(-15, 37, 0.4, s++, 0.65);
  person(-14, 36.2, 2.4, s++, 0.6);
  // string lights between the trees
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const r = 17;
    const sag = Math.abs(Math.sin(a * 4.5));
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd27a }),
    );
    b.position.set(-18 + Math.cos(a) * r, 5.2 - 0.9 * (1 - sag), 44 + Math.sin(a) * r);
    scene.add(b);
    stringLights.push(b);
  }
}

// ---------- phones lighting up (after 00:00) ----------
const phones = [];
for (const p of people) {
  const ph = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.38, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ff }),
  );
  ph.position.set(0, 1.25, 0.42);
  p.g.add(ph);
  phones.push(ph);
}

// ---------- night street crowd (21:00–24:00) ----------
{
  for (let i = 0; i < 16; i++) {
    const x = -4 + (i % 8) * 2.2;
    const z = 22 + Math.floor(i / 8) * 2.6;
    const p = person(x, z, Math.PI, 900 + i);
    p.lookUp = true;
  }
}

// ---------- camera ----------
const CAM = [
  // [t, pos xyz, look xyz]
  [0, [-28, 34, 110, 5, 18, -20]],
  [13.9, [-6, 22, 70, 5, 18, -20]],
  [14, [10, 3, -4, -9, 2.6, 9]],
  [23.9, [6, 2.8, -3, -11, 2.4, 10]],
  [24, [72, 14, 5, 28, 0, 1]],
  [29.9, [64, 12, 4, 28, 0, 2]],
  [30, [16, 9, 108, 30, 3, 70]],
  [35.9, [18, 8, 96, 30, 3, 68]],
  [36, [140, 7, 86, 140, 4.6, 42]],
  [41.9, [140, 7, 78, 140, 4.6, 42]],
  [42, [-96, 5, 0, -100, 9, 60]],
  [47.9, [-98, 5, 5, -100, 9, 60]],
  [48, [-2, 6, 26, -18, 2, 44]],
  [59.9, [-6, 5, 30, -18, 2, 45]],
  [60, [3, 2.4, 44, 5, 22, -20]],
  [69.9, [3, 3.4, 34, 5, 26, -20]],
  [70, [3, 3.4, 34, 5, 26, -20]],
  [80, [2, 6, 44, 5, 22, -20]],
];
function cameraAt(t) {
  let i = 1;
  while (i < CAM.length - 1 && t > CAM[i][0]) i++;
  const [t0, a] = CAM[i - 1],
    [t1, b] = CAM[i];
  const k = clamp((t - t0) / (t1 - t0));
  const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
  const v = a.map((x, j) => lerp(x, b[j], e));
  cam.position.set(v[0], v[1], v[2]);
  cam.lookAt(v[3], v[4], v[5]);
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const pad = (n) => String(Math.floor(n)).padStart(2, "0");
function renderHud(t) {
  const m = minutesAt(t);
  const mm = m % 1440;
  hudValue.textContent = pad(mm / 60) + ":" + pad(mm % 60);
  if (t >= BACK) {
    hudSub.textContent = "WIEDER ONLINE";
    hudSub2.textContent = " ";
  } else {
    const hrs = Math.floor(m / 60);
    hudSub.textContent = hrs < 1 ? "INTERNET AUSGEFALLEN" : hrs + " STUNDEN OHNE INTERNET";
    hudSub2.textContent =
      "≈ " + fmt((100e9 * m) / 1440) + "\nWHATSAPP-NACHRICHTEN NICHT ZUGESTELLT";
  }
  let op = 1;
  if (t < 4.8) op = 0;
  else if (t < 5.3) op = (t - 4.8) / 0.5;
  else if (t > 74.0) op = clamp((74.5 - t) / 0.5);
  hud.style.opacity = op;
}

// ---------- frame ----------
function renderAt(t) {
  const hour = minutesAt(t) / 60;
  skyAt(hour);
  fog.color.copy(skyBot);
  const day = smooth(5.5, 8, hour) * (1 - smooth(18.3, 21, hour));
  stars.material.opacity = 1 - smooth(0, 0.6, day);
  stars.visible = day < 0.6;

  // sun arc over the day
  const sa = ((hour - 6) / 12) * Math.PI;
  sun.position.set(Math.cos(sa) * 100, Math.max(5, Math.sin(sa) * 120), -60);
  sun.intensity = 2.6 * day + 0.25;
  sun.color
    .set(0xfff1dc)
    .lerp(tmpC.set(0xff9a5a), smooth(16.5, 18.6, hour) * (1 - smooth(19.5, 21, hour)));
  hemi.intensity = 0.35 + 0.75 * day;
  hemi.color.set(day > 0.3 ? 0xc8d8ff : 0x5a6aa8);
  fog.near = lerp(60, 120, day);
  fog.far = lerp(380, 600, day);

  // windows: lit at night; flash blue-white when the phones come back
  const back = smooth(BACK, BACK + 0.3, t) * (1 - smooth(BACK + 2.5, BACK + 4.5, t));
  const winI = lerp(0.05, 1.1, 1 - day) + back * 0.8;
  for (const m of windowMats) {
    m.emissiveIntensity = winI;
    m.emissive.set(0xffffff).lerp(tmpC.set(0x9fd8ff), back);
  }
  const nightGlow = smooth(18.5, 20, hour) * (t < BACK + 10 ? 1 : 1);
  for (const b of stringLights) b.visible = nightGlow > 0.05;

  // phones: dark all day, all light up at 00:00
  for (let i = 0; i < phones.length; i++) {
    const on = t >= BACK + (i % 7) * 0.08 || t < OUTAGE;
    phones[i].visible = on;
  }
  for (const p of people) if (p.lookUp) p.g.visible = t >= 60;

  if (ambulanceLight.m)
    ambulanceLight.m.material.color.set(Math.sin(t * 9) > 0 ? 0x2a6aff : 0x0a1a40);
  updateTower(t);
  updatePeople(t);
  updateCars(t);
  updateBoard(t);
  cameraAt(t);
  renderer.render(scene, cam);
  renderHud(t);
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.world = Promise.resolve();
