// "Was wäre, wenn ein Tag nur noch 1 Stunde dauert?" — the Earth spins up.
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
const tmpC = new THREE.Color();
const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y, z) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = x - xi,
    yf = y - yi,
    zf = z - zi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf),
    w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dx = 0; dx < 2; dx++)
    for (let dy = 0; dy < 2; dy++)
      for (let dz = 0; dz < 2; dz++)
        r +=
          (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w) * hash3(xi + dx, yi + dy, zi + dz);
  return r;
}

// ---------- the length of a day ----------
const DAY = [
  [0, 24],
  [5, 24],
  [14, 12],
  [24, 6],
  [36, 3],
  [48, 2],
  [59.5, 1.41],
  [69, 1.0],
];
function dayLen(t) {
  if (t <= DAY[0][0]) return 24;
  for (let i = 1; i < DAY.length; i++)
    if (t <= DAY[i][0]) {
      const [t0, d0] = DAY[i - 1],
        [t1, d1] = DAY[i];
      return Math.exp(lerp(Math.log(d0), Math.log(d1), (t - t0) / (t1 - t0)));
    }
  return 1;
}
// spin angle: integrate the visual angular speed (deterministic, from 0 every frame)
function spinAngle(t) {
  let a = 0;
  const dt = 0.02;
  for (let s = 0; s < t; s += dt) a += 0.22 * Math.pow(24 / dayLen(s), 0.8) * Math.min(dt, t - s);
  return a;
}

// ---------- renderer ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const cam = new THREE.PerspectiveCamera(38, W / H, 0.05, 2000);

// =====================================================================
// SPACE
// =====================================================================
const space = new THREE.Scene();
space.background = C("#03040a");
{
  const rnd = mulberry32(5);
  const n = 1800;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rnd() * Math.PI * 2,
      ph = Math.acos(2 * rnd() - 1);
    pos.set(
      [300 * Math.sin(ph) * Math.cos(th), 300 * Math.cos(ph), 300 * Math.sin(ph) * Math.sin(th)],
      i * 3,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  space.add(
    new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false }),
    ),
  );
}
const sun = new THREE.DirectionalLight(0xfff2e0, 3.0);
sun.position.set(6, 2.5, 5);
space.add(sun);
space.add(new THREE.AmbientLight(0x4a5070, 0.4));

const tilt = new THREE.Group();
tilt.rotation.z = 0.41;
space.add(tilt);
const spin = new THREE.Group();
const shape = new THREE.Group(); // non-spinning flattening (symmetric about the axis)
tilt.add(shape);
shape.add(spin);

const earthGeo = new THREE.IcosahedronGeometry(1, 4);
const faceN = earthGeo.attributes.position.count / 3;
const earthCol = new Float32Array(faceN * 9);
earthGeo.setAttribute("color", new THREE.BufferAttribute(earthCol, 3));
const earth = new THREE.Mesh(earthGeo, std(0xffffff, { vertexColors: true }));
spin.add(earth);
const faceC = [],
  faceLand = [],
  faceBase = [];
{
  const p = earthGeo.attributes.position;
  const OCEAN = C("#1d5d8f"),
    LAND = C("#4c8f3e"),
    FOREST = C("#2f6b33"),
    DESERT = C("#c9a35e"),
    ICE = C("#eef3f7");
  for (let f = 0; f < faceN; f++) {
    const c = V(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(V(p.getX(f * 3 + k), p.getY(f * 3 + k), p.getZ(f * 3 + k)));
    c.normalize();
    faceC.push(c);
    const n =
      0.6 * vnoise(c.x * 1.8 + 3, c.y * 1.8 + 1, c.z * 1.8 + 5) +
      0.4 * vnoise(c.x * 4 + 1, c.y * 4, c.z * 4);
    const land = n > 0.5;
    faceLand.push(land);
    let col;
    if (Math.abs(c.y) > 0.9) col = ICE;
    else if (land) {
      const d = vnoise(c.x * 6, c.y * 6, c.z * 6);
      col = Math.abs(c.y) < 0.35 && d > 0.55 ? DESERT : d > 0.45 ? FOREST : LAND;
    } else col = OCEAN;
    faceBase.push(col.clone());
  }
}
const atmo = new THREE.Mesh(
  new THREE.SphereGeometry(1.045, 48, 32),
  new THREE.MeshBasicMaterial({
    color: 0x6fb6ff,
    transparent: true,
    opacity: 0.1,
    side: THREE.BackSide,
  }),
);
shape.add(atmo);
// cloud bands: stretched by the fast spin
const clouds = new THREE.Group();
spin.add(clouds);
{
  const rnd = mulberry32(21);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
    transparent: true,
    opacity: 0.9,
  });
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + rnd() * 0.05, 0), mat);
    const th = rnd() * Math.PI * 2,
      y = (rnd() * 2 - 1) * 0.8;
    const r = Math.sqrt(1 - y * y) * 1.04;
    m.position.set(Math.cos(th) * r, y * 1.04, Math.sin(th) * r);
    m.lookAt(0, 0, 0);
    m.userData.base = 1.4 + rnd() * 0.6;
    clouds.add(m);
  }
}
// glowing rift along the equator
const rift = new THREE.Mesh(
  new THREE.TorusGeometry(1.0, 0.025, 8, 160),
  new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true }),
);
rift.rotation.x = Math.PI / 2;
shape.add(rift);
// debris flung off the equator
const debN = 2200;
const debData = [];
{
  const rnd = mulberry32(77);
  for (let i = 0; i < debN; i++)
    debData.push({
      th: rnd() * Math.PI * 2,
      launch: 61.5 + rnd() * 7,
      v: 0.12 + rnd() * 0.25,
      y: (rnd() - 0.5) * 0.08,
      hot: rnd(),
    });
}
const debPos = new Float32Array(debN * 3);
const debCol = new Float32Array(debN * 3);
const debGeo = new THREE.BufferGeometry();
debGeo.setAttribute("position", new THREE.BufferAttribute(debPos, 3));
debGeo.setAttribute("color", new THREE.BufferAttribute(debCol, 3));
const debris = new THREE.Points(
  debGeo,
  new THREE.PointsMaterial({
    size: 4,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
  }),
);
debris.frustumCulled = false;
tilt.add(debris);

const ROCK = C("#8a7a6a");
const DEEP = C("#14466f"),
  DRYBED = C("#b89a6a"),
  POLEICE = C("#e8eef2");
function paintEarth(t) {
  const k = smooth(24.5, 34, t);
  for (let f = 0; f < faceN; f++) {
    const c = faceC[f];
    tmpC.copy(faceBase[f]);
    if (k > 0) {
      const lat = Math.abs(c.y);
      const edge = 0.42 + (vnoise(c.x * 5, c.y * 5, c.z * 5) - 0.5) * 0.12;
      if (lat < edge) tmpC.lerp(DEEP, k);
      else if (lat > 0.88) tmpC.lerp(POLEICE, k * 0.6);
      else if (!faceLand[f]) tmpC.lerp(DRYBED, k);
    }
    for (let j = 0; j < 3; j++) earthCol.set([tmpC.r, tmpC.g, tmpC.b], (f * 3 + j) * 3);
  }
  earthGeo.attributes.color.needsUpdate = true;
}

function renderSpace(t) {
  spin.rotation.y = spinAngle(t);
  paintEarth(t);
  const bulge = 0.06 * smooth(24, 36, t) + 0.2 * smooth(55, 68, t);
  shape.scale.set(1 + bulge, 1 - bulge * 0.9, 1 + bulge);
  // clouds stretch into bands as the spin rises
  const stretch = Math.min(2.6, Math.pow(24 / dayLen(t), 0.45));
  for (const m of clouds.children) m.scale.set(m.userData.base * stretch, 0.7, 0.3);
  rift.visible = t >= 60;
  rift.material.opacity = smooth(60.5, 62.5, t) * (0.7 + 0.3 * Math.sin(t * 13));
  debris.visible = t >= 61.5;
  if (debris.visible) {
    for (let i = 0; i < debN; i++) {
      const d = debData[i];
      const age = t - d.launch;
      const r = age > 0 ? Math.min(2.8, (1 + bulge) * 1.0 + age * d.v) : 0;
      const a = d.th + (age * 0.9) / Math.max(r, 1);
      debPos.set(age > 0 ? [Math.cos(a) * r, d.y * r, Math.sin(a) * r] : [0, 0, 0], i * 3);
      tmpC.set(0xffa040).lerp(ROCK, clamp(age / 3 + d.hot * 0.4));
      debCol.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    }
    debGeo.attributes.position.needsUpdate = true;
    debGeo.attributes.color.needsUpdate = true;
  }
  let dist, elev, az;
  if (t < 14) {
    dist = lerp(7.2, 6.2, smooth(0, 14, t));
    elev = 0.15;
    az = 0.3;
  } else if (t < 36) {
    dist = lerp(6.4, 6.0, smooth(24, 36, t));
    elev = 0.05;
    az = 0.15;
  } else {
    const k = smooth(60, 80, t);
    dist = lerp(7.4, 8.6, k);
    elev = lerp(0.3, 0.45, k);
    az = lerp(0.2, 0.5, k);
  }
  cam.position.set(
    Math.sin(az) * Math.cos(elev) * dist,
    Math.sin(elev) * dist,
    Math.cos(az) * Math.cos(elev) * dist,
  );
  cam.lookAt(0, 0, 0);
  if (t >= 62 && t < 63) {
    const s = (1 - (t - 62)) * 0.06;
    cam.position.x += Math.sin(t * 80) * s;
    cam.position.y += Math.cos(t * 71) * s;
  }
  renderer.render(space, cam);
}

// =====================================================================
// TOWN
// =====================================================================
const town = new THREE.Scene();
const tFog = new THREE.Fog(0xb8c8d8, 30, 140);
town.fog = tFog;
const tSun = new THREE.DirectionalLight(0xfff1dc, 2.4);
town.add(tSun);
const tHemi = new THREE.HemisphereLight(0xc8d8ff, 0x405030, 0.8);
town.add(tHemi);
const skyGeo = new THREE.SphereGeometry(300, 32, 20);
const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
town.add(
  new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  ),
);
const skyTop = new THREE.Color(),
  skyBot = new THREE.Color();
function paintSky() {
  const p = skyGeo.attributes.position;
  for (let j = 0; j < p.count; j++) {
    const k = Math.pow(clamp(p.getY(j) / 160 + 0.05), 0.6);
    tmpC.copy(skyBot).lerp(skyTop, k);
    skyCol.set([tmpC.r, tmpC.g, tmpC.b], j * 3);
  }
  skyGeo.attributes.color.needsUpdate = true;
}
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(9, 32),
  new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false }),
);
const moonDisc = new THREE.Mesh(
  new THREE.CircleGeometry(5, 32),
  new THREE.MeshBasicMaterial({ color: 0xdfe6f2, fog: false }),
);
town.add(sunDisc, moonDisc);

{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), std(0x4f7a3e));
  ground.rotation.x = -Math.PI / 2;
  town.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 6), std(0x3a3a42));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, 3);
  town.add(road);
}
const lamps = [];
const movers = []; // things wind and weightlessness act on
{
  const rnd = mulberry32(99);
  const walls = [0xe9e1d0, 0xc9a98a, 0xd7c6a5, 0xa8b6c4, 0xe3c7b8];
  const roofs = [0x8b3a32, 0x5b4a5f, 0x704030];
  const add = (obj, kind, extra = {}) => {
    town.add(obj);
    movers.push({
      obj,
      kind,
      p0: obj.position.clone(),
      r0: obj.rotation.clone(),
      seed: rnd(),
      d: rnd(),
      ...extra,
    });
  };
  for (const side of [-1, 1])
    for (let x = -50; x <= 50; x += 8 + Math.floor(rnd() * 3)) {
      const z = side < 0 ? -6 - rnd() * 2 : 11 + rnd() * 3;
      const w = 3.4 + rnd() * 1.4,
        h = 2.6 + rnd() * 1.6;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 3.4),
        std(walls[Math.floor(rnd() * walls.length)]),
      );
      body.position.set(x, h / 2, z);
      town.add(body);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, 3.4) * 0.78, 1.6, 4),
        std(roofs[Math.floor(rnd() * 3)]),
      );
      roof.position.set(x, h + 0.8, z);
      roof.rotation.y = Math.PI / 4;
      add(roof, "roof");
    }
  for (let i = 0; i < 40; i++) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 5), std(0x5a3d2b));
    trunk.position.y = 0.7;
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 2.4, 6),
      std(rnd() < 0.5 ? 0x2f6b33 : 0x47803a),
    );
    crown.position.y = 2.3;
    g.add(trunk, crown);
    g.position.set(-50 + rnd() * 100, 0, rnd() < 0.5 ? -2 - rnd() * 12 : 7 + rnd() * 14);
    add(g, "tree");
  }
  const carCols = [0xd94a3a, 0x3d6fd9, 0xe8c547, 0xeeeeee, 0x2fa38a];
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const col = carCols[i % carCols.length];
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.1), std(col, { roughness: 0.5 }));
    b.position.y = 0.45;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.0), std(col, { roughness: 0.5 }));
    top.position.set(-0.1, 0.95, 0);
    g.add(b, top);
    g.position.set(-30 + i * 6.5 + rnd() * 2, 0, rnd() < 0.5 ? 2 : 4);
    add(g, "car");
  }
  const SKIN = [0xf1c7a5, 0xd9a07a, 0x8d5a3b, 0xe8b894];
  const CLOTH = [0x3d6fd9, 0xd94a3a, 0x2fa38a, 0xe8c547, 0x6a4c93, 0xe07a2f];
  for (let i = 0; i < 24; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.7, 3, 8),
      std(CLOTH[i % CLOTH.length]),
    );
    body.position.y = 0.85;
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 3, 8), std(0x2a2e3a));
    legs.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), std(SKIN[i % SKIN.length]));
    head.position.y = 1.55;
    g.add(legs, body, head);
    g.position.set(-20 + rnd() * 40, 0, rnd() < 0.5 ? 0 + rnd() : 5.5 + rnd());
    g.rotation.y = rnd() * 6;
    add(g, "person");
  }
  for (let x = -48; x <= 48; x += 12) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.5, 6), std(0x4a4e56));
    pole.position.set(x, 2.25, 6.6);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd28a }),
    );
    bulb.position.set(x, 4.5, 6.6);
    town.add(pole, bulb);
    lamps.push(bulb);
  }
}
// streaks of wind-driven rain
const rainN = 1600;
const rainSeed = [];
{
  const rnd = mulberry32(13);
  for (let i = 0; i < rainN; i++) rainSeed.push([rnd(), rnd(), rnd()]);
}
const rainPos = new Float32Array(rainN * 6);
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(
  rainGeo,
  new THREE.LineBasicMaterial({ color: 0xcfd8e4, transparent: true, opacity: 0.55 }),
);
rain.frustumCulled = false;
town.add(rain);

// day/night timelapse: count the visual days passed
function dayPhase(t) {
  // 14–24: one visual day lasts 3.2 s, shrinking to 1.4 s
  let a = 0;
  const dt = 0.02;
  for (let s = 14; s < t; s += dt) a += Math.min(dt, t - s) / lerp(3.2, 1.4, (s - 14) / 10);
  return a + 0.3;
}
const NIGHT_T = C("#070b1d"),
  NIGHT_B = C("#1d2442"),
  DAY_T = C("#4f8fd6"),
  DAY_B = C("#d6e8f2"),
  DUSK_B = C("#f0985a");
function renderTown(t) {
  let windK = 0,
    lift = 0;
  if (t < 36) {
    const ph = dayPhase(t);
    const ang = (ph % 1) * Math.PI * 2; // 0 = sunrise
    const elev = Math.sin(ang);
    const dayK = smooth(-0.15, 0.25, elev);
    skyTop.copy(NIGHT_T).lerp(DAY_T, dayK);
    skyBot
      .copy(NIGHT_B)
      .lerp(DAY_B, dayK)
      .lerp(DUSK_B, (1 - Math.abs(elev)) * dayK * 0.8);
    sunDisc.position.set(Math.cos(ang) * 200, Math.sin(ang) * 140 + 10, -180);
    moonDisc.position.set(-Math.cos(ang) * 200, -Math.sin(ang) * 140 + 10, -180);
    sunDisc.visible = elev > -0.1;
    moonDisc.visible = elev < 0.1;
    tSun.position.copy(sunDisc.position);
    tSun.intensity = 2.6 * dayK + 0.1;
    tHemi.intensity = 0.25 + 0.7 * dayK;
    for (const l of lamps) l.visible = dayK < 0.5;
  } else if (t < 48) {
    // the storm
    windK = smooth(36.2, 39, t);
    skyTop.set(0x2e3440);
    skyBot.set(0x7a8590);
    sunDisc.visible = moonDisc.visible = false;
    tSun.position.set(-30, 60, 20);
    tSun.intensity = 0.8;
    tHemi.intensity = 0.7;
    for (const l of lamps) l.visible = true;
  } else {
    // weightless at the equator
    lift = smooth(49.5, 59, t);
    skyTop.set(0x2a2058).lerp(tmpC.set(0x120c30), lift);
    skyBot.set(0xc88ac8).lerp(tmpC.set(0x6a4a9a), lift);
    sunDisc.visible = true;
    moonDisc.visible = false;
    sunDisc.position.set(-60, 30, -180);
    tSun.position.set(-60, 30, -60);
    tSun.intensity = 1.6;
    tHemi.intensity = 0.8;
    for (const l of lamps) l.visible = true;
  }
  paintSky();
  tFog.color.copy(skyBot);
  sunDisc.lookAt(0, 0, 0);
  moonDisc.lookAt(0, 0, 0);

  for (const m of movers) {
    m.obj.position.copy(m.p0);
    m.obj.rotation.copy(m.r0);
    if (windK > 0) {
      if (m.kind === "tree")
        m.obj.rotation.z = -windK * (0.35 + 0.15 * Math.sin(t * 6 + m.seed * 9));
      if (m.kind === "roof") {
        const launch = 39.5 + m.d * 7;
        const dt = t - launch;
        if (dt > 0) {
          m.obj.position.x += 0.5 * 22 * dt * dt;
          m.obj.position.y += 6 * (1 - Math.exp(-dt * 1.4));
          m.obj.rotation.z += -dt * 3;
          m.obj.rotation.x += dt * (m.seed - 0.5) * 4;
        }
      }
      if (m.kind === "person") m.obj.rotation.z = -windK * 0.25;
    }
    if (lift > 0) {
      const k = clamp(lift * 1.4 - m.d * 0.4);
      const h = m.kind === "car" ? 7 : m.kind === "person" ? 10 : m.kind === "roof" ? 5 : 3.5;
      m.obj.position.y += k * k * h * (0.7 + m.seed * 0.6);
      m.obj.rotation.x += k * (m.seed - 0.5) * 2.2;
      m.obj.rotation.z += k * (m.d - 0.5) * 2.2;
    }
  }
  rain.visible = windK > 0;
  if (rain.visible) {
    for (let i = 0; i < rainN; i++) {
      const s = rainSeed[i];
      const x = ((s[0] * 120 + t * 70) % 120) - 60;
      const y = 0.3 + s[1] * 14;
      const z = -14 + s[2] * 34;
      rainPos.set([x, y, z, x - 2.2, y + 0.5, z], i * 6);
    }
    rainGeo.attributes.position.needsUpdate = true;
    rain.material.opacity = 0.55 * windK;
  }

  let pos, look;
  if (t < 36) {
    const k = smooth(14, 24, t);
    pos = V(lerp(-16, -10, k), 4.5, 30);
    look = V(4, 7, -20);
  } else if (t < 48) {
    const k = smooth(36, 48, t);
    pos = V(lerp(-14, -8, k), 3.5, 26);
    look = V(4, 3, 0);
    const sh = windK * 0.12;
    pos.x += Math.sin(t * 47) * sh;
    pos.y += Math.cos(t * 53) * sh;
  } else {
    const k = smooth(48, 60, t);
    pos = V(-6, lerp(3, 4.5, k), lerp(40, 36, k));
    look = V(2, lerp(4, 8, k), 0);
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  cam.fov = 50;
  cam.updateProjectionMatrix();
  renderer.render(town, cam);
  cam.fov = 38;
  cam.updateProjectionMatrix();
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const PC = 1.41; // rotation period at which the equator becomes weightless
function renderHud(t) {
  const d = dayLen(t);
  const val = d >= 10 ? fmt(d) : d.toFixed(1).replace(".", ",");
  hudValue.textContent = val + (val === "1" || val === "1,0" ? " Stunde" : " Stunden");
  hudSub.textContent = "ÄQUATOR: " + fmt(40075 / d) + " KM/H";
  if (t >= 48) {
    const g = Math.max(0, 1 - (PC / d) ** 2);
    hudSub2.textContent = "SCHWERKRAFT AM ÄQUATOR: " + Math.round(g * 100) + " %";
  } else hudSub2.textContent = " ";
  let op = 1;
  if (t < 4.8) op = 0;
  else if (t < 5.3) op = (t - 4.8) / 0.5;
  else if (t > 74.0) op = clamp((74.5 - t) / 0.5);
  hud.style.opacity = op;
}

// ---------- frame ----------
function renderAt(t) {
  const inTown = (t >= 14 && t < 24) || (t >= 36 && t < 60);
  if (inTown) renderTown(t);
  else renderSpace(t);
  renderHud(t);
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.world = Promise.resolve();
