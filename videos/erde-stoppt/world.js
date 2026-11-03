// "Was wäre, wenn die Erde aufhört, sich zu drehen?" — the 3D world.
// Every frame is a pure function of timeline time t (seconds), drawn on hf-seek.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

window.THREE = THREE;

const W = 1080;
const H = 1920;
const STOP = 15.0; // the moment the Earth stops

// ---------- helpers ----------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);

function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
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
      for (let dz = 0; dz < 2; dz++) {
        const wt = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
        r += wt * hash3(xi + dx, yi + dy, zi + dz);
      }
  return r;
}
function fbm(x, y, z) {
  return (
    0.55 * vnoise(x, y, z) +
    0.3 * vnoise(x * 2.1, y * 2.1, z * 2.1) +
    0.15 * vnoise(x * 4.3, y * 4.3, z * 4.3)
  );
}
const C = (hex) => new THREE.Color(hex);

// ---------- renderer ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

// =====================================================================
// SPACE: the Earth
// =====================================================================
const space = new THREE.Scene();
space.background = C("#04050b");
const spaceCam = new THREE.PerspectiveCamera(38, W / H, 0.1, 500);

// stars
{
  const rnd = mulberry32(7);
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rnd() * Math.PI * 2;
    const ph = Math.acos(2 * rnd() - 1);
    const r = 120 + rnd() * 60;
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  space.add(
    new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.55,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
      }),
    ),
  );
}

const earthGeo = new THREE.IcosahedronGeometry(1, 4);
const faceCount = earthGeo.attributes.position.count / 3;
const earthColors = new Float32Array(faceCount * 9);
earthGeo.setAttribute("color", new THREE.BufferAttribute(earthColors, 3));
const earthMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.85,
  metalness: 0,
});
const earth = new THREE.Mesh(earthGeo, earthMat);
const earthPivot = new THREE.Group();
earthPivot.rotation.z = 0.41; // axial tilt
earthPivot.add(earth);
space.add(earthPivot);

// per-face data
const faceCentroid = [];
const faceIsLand = [];
const faceBase = [];
{
  const p = earthGeo.attributes.position;
  const OCEAN = C("#1d5d8f"),
    OCEAN_D = C("#163f6e"),
    GRASS = C("#4c8f3e"),
    FOREST = C("#2f6b33"),
    DESERT = C("#c9a35e"),
    ICE = C("#eef3f7");
  for (let f = 0; f < faceCount; f++) {
    const c = new THREE.Vector3();
    for (let k = 0; k < 3; k++)
      c.add(new THREE.Vector3(p.getX(f * 3 + k), p.getY(f * 3 + k), p.getZ(f * 3 + k)));
    c.divideScalar(3).normalize();
    faceCentroid.push(c);
    const n = fbm(c.x * 1.8 + 3, c.y * 1.8 + 1, c.z * 1.8 + 5);
    const lat = Math.abs(c.y);
    const land = n > 0.5;
    faceIsLand.push(land);
    let col;
    if (lat > 0.9) col = ICE.clone();
    else if (land) {
      const d = vnoise(c.x * 6, c.y * 6, c.z * 6);
      col = lat < 0.38 && d > 0.55 ? DESERT.clone() : d > 0.45 ? FOREST.clone() : GRASS.clone();
    } else col = OCEAN.clone().lerp(OCEAN_D, clamp((0.5 - n) * 4));
    faceBase.push(col);
  }
}

// atmosphere glow
const atmo = new THREE.Mesh(
  new THREE.SphereGeometry(1.045, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0x6fb6ff,
    transparent: true,
    opacity: 0.1,
    side: THREE.BackSide,
  }),
);
earthPivot.add(atmo);

// clouds: keep moving after the planet stops
const clouds = new THREE.Group();
earthPivot.add(clouds);
{
  const rnd = mulberry32(21);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
    roughness: 1,
    transparent: true,
    opacity: 0.92,
  });
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + rnd() * 0.06, 0), mat);
    const th = rnd() * Math.PI * 2;
    const y = (rnd() * 2 - 1) * 0.8;
    const r = Math.sqrt(1 - y * y) * 1.045;
    m.position.set(Math.cos(th) * r, y * 1.045, Math.sin(th) * r);
    m.scale.set(1.7, 1.2, 0.3);
    m.lookAt(0, 0, 0);
    clouds.add(m);
  }
}

const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
space.add(sun);
space.add(new THREE.AmbientLight(0x6070a0, 0.35));
const moon = new THREE.DirectionalLight(0x9db4ff, 0);
moon.position.set(-10, 1, 0);
space.add(moon);

const OMEGA = 0.55; // visual spin speed, rad/s
function spinAngle(t) {
  if (t < STOP) return OMEGA * t;
  // a hard brake: 0.25 s to zero
  const d = Math.min(t - STOP, 0.25);
  return OMEGA * STOP + OMEGA * (d - (d * d) / (2 * 0.25));
}

const HOT = C("#b8662e"),
  HOT2 = C("#d9944a"),
  COLD = C("#dfeaf5"),
  COLD2 = C("#9fbfe0");
const POLE_SEA = C("#1d5d8f"),
  BELT_LAND = C("#b8935a"),
  BELT_GREEN = C("#5d8a40");
const tmpC = new THREE.Color();

function paintEarth(t, sunDirLocal) {
  const kMigrate0 = smooth(64.2, 70.5, t);
  const kClimate = smooth(52, 60, t) * (1 - 0.75 * kMigrate0); // day side bakes, night side freezes
  const kMigrate = smooth(64.2, 70.5, t); // oceans flow to the poles
  for (let f = 0; f < faceCount; f++) {
    const c = faceCentroid[f];
    tmpC.copy(faceBase[f]);
    if (kMigrate > 0) {
      const lat = Math.abs(c.y);
      const n = vnoise(c.x * 5 + 2, c.y * 5, c.z * 5);
      const edge = 0.62 + (n - 0.5) * 0.18; // ragged coastline
      let target;
      if (lat > edge) target = lat > 0.93 ? COLD : POLE_SEA;
      else target = n > 0.5 ? BELT_GREEN : BELT_LAND;
      tmpC.lerp(target, kMigrate);
    }
    if (kClimate > 0) {
      const d = c.dot(sunDirLocal);
      if (d > 0.15) {
        const k = kClimate * smooth(0.15, 0.6, d);
        tmpC.lerp(faceIsLand[f] || kMigrate > 0.5 ? HOT : HOT2, k * 0.85);
      } else if (d < -0.15) {
        const k = kClimate * smooth(-0.15, -0.6, d);
        tmpC.lerp(faceIsLand[f] ? COLD : COLD2, k * 0.9);
      }
    }
    for (let k = 0; k < 3; k++) {
      earthColors[f * 9 + k * 3] = tmpC.r;
      earthColors[f * 9 + k * 3 + 1] = tmpC.g;
      earthColors[f * 9 + k * 3 + 2] = tmpC.b;
    }
  }
  earthGeo.attributes.color.needsUpdate = true;
}

function renderSpace(t) {
  const ang = spinAngle(t);
  earth.rotation.y = ang;
  // clouds: same spin before the stop, keep drifting after (air keeps going)
  const cAng =
    t < STOP ? ang : spinAngle(STOP) + OMEGA * 1.4 * (1 - Math.exp(-(t - STOP) / 2.2)) * 2.2;
  clouds.rotation.y = cAng;
  clouds.visible = t < 40; // after the storm, sky is clear for the long view

  // sun
  let sunDir;
  if (t < 40) sunDir = new THREE.Vector3(0.9, 0.35, 0.8).normalize();
  else sunDir = new THREE.Vector3(1, 0.05, 0.05).normalize();
  sun.position.copy(sunDir).multiplyScalar(10);

  // sun direction in the earth's local frame (for the climate paint)
  earth.updateWorldMatrix(true, false);
  const inv = new THREE.Matrix4().copy(earth.matrixWorld).invert();
  const sunLocal = sunDir.clone().transformDirection(inv);
  paintEarth(t, sunLocal);

  // camera
  let dist,
    elev = 0,
    az = 0,
    yOff = -0.15;
  if (t < 18) {
    dist = lerp(8.4, 6.6, easeOut(t / 15));
    if (t > STOP) dist = 6.6 - 0.35 * easeOut((t - STOP) / 2.5);
  } else if (t < 52) {
    // 40–52: a day lasts a year — wide view, slow push
    const k = (t - 40) / 12;
    dist = lerp(7.6, 6.8, k);
    az = lerp(0.5, 0.15, k);
  } else if (t < 64) {
    const k = (t - 52) / 12;
    dist = lerp(6.8, 6.0, k);
    az = lerp(0.15, 0.0, k); // terminator line across the face
  } else if (t < 72) {
    const k = smooth(64, 70, t);
    dist = lerp(6.0, 6.8, k);
    az = lerp(0.0, 0.5, k);
    elev = lerp(0, 0.65, k);
  } else {
    const k = (t - 72) / 8;
    dist = lerp(9.5, 10.5, k);
    az = 0.5;
    elev = 0.45;
    yOff = -1.9; // earth sits in the upper half, text below
  }
  spaceCam.position.set(
    Math.sin(az) * Math.cos(elev) * dist,
    Math.sin(elev) * dist,
    Math.cos(az) * Math.cos(elev) * dist,
  );
  spaceCam.lookAt(0, 0, 0);
  // vertical framing offset: shift the view so the Earth sits where we want it
  spaceCam.setViewOffset(W, H, 0, Math.round(yOff * -260), W, H);
  moon.intensity = t >= 40 ? 0.9 : 0;

  // the jolt at the stop
  if (t >= STOP && t < STOP + 0.9) {
    const k = 1 - (t - STOP) / 0.9;
    spaceCam.position.x += Math.sin(t * 91) * 0.06 * k;
    spaceCam.position.y += Math.cos(t * 77) * 0.05 * k;
  }
  renderer.render(space, spaceCam);
}

// =====================================================================
// TOWN: the storm (18–30 s)
// =====================================================================
const town = new THREE.Scene();
const townCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 400);
const townFog = new THREE.Fog(0x8a6f78, 20, 90);
town.fog = townFog;
const townSkyTop = C("#2c2a52"),
  townSkyBot = C("#e59b8a");
const skyGeo = new THREE.SphereGeometry(200, 24, 16);
const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
const skyMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  side: THREE.BackSide,
  fog: false,
});
town.add(new THREE.Mesh(skyGeo, skyMat));
function paintSky(top, bot) {
  const p = skyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = clamp(p.getY(i) / 120 + 0.15);
    tmpC.copy(bot).lerp(top, k);
    skyCol[i * 3] = tmpC.r;
    skyCol[i * 3 + 1] = tmpC.g;
    skyCol[i * 3 + 2] = tmpC.b;
  }
  skyGeo.attributes.color.needsUpdate = true;
}

const townSun = new THREE.DirectionalLight(0xffd2b0, 2.4);
townSun.position.set(-20, 30, 10);
town.add(townSun);
const townAmb = new THREE.HemisphereLight(0xb0a0ff, 0x304020, 0.9);
town.add(townAmb);

{
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 1, flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  town.add(ground);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 5),
    new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, 2);
  town.add(road);
  for (let i = -40; i <= 40; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xe8e2c8 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(i * 3.5, 0.03, 2);
    town.add(m);
  }
}

// flyers: things the wind takes. Each has a rest pose and a launch time.
const flyers = [];
{
  const rnd = mulberry32(99);
  const wallCols = [0xe9e1d0, 0xc9a98a, 0xd7c6a5, 0xa8b6c4, 0xe3c7b8, 0xb98f7a];
  const roofCols = [0x8b3a32, 0x5b4a5f, 0x704030, 0x3e5068];
  const carCols = [0xd94a3a, 0x3d6fd9, 0xe8c547, 0xeeeeee, 0x2fa38a];
  const add = (obj, kind, x, launchBase) => {
    town.add(obj);
    flyers.push({
      obj,
      kind,
      p0: obj.position.clone(),
      r0: obj.rotation.clone(),
      launch: launchBase + (x + 40) * 0.055 + rnd() * 0.5,
      acc:
        kind === "roof"
          ? 26 + rnd() * 10
          : kind === "car"
            ? 18 + rnd() * 8
            : kind === "tree"
              ? 22 + rnd() * 8
              : 9 + rnd() * 5,
      lift: kind === "roof" ? 6 + rnd() * 4 : kind === "house" ? 1.5 + rnd() * 2 : 3 + rnd() * 4,
      spin: new THREE.Vector3(rnd() * 4 - 2, rnd() * 3 - 1.5, -(2 + rnd() * 4)),
    });
  };
  // houses on both sides of the road
  for (const side of [-1, 1]) {
    for (let x = -40; x <= 40; x += 7 + Math.floor(rnd() * 3)) {
      const z = side < 0 ? -5 - rnd() * 2 : 9 + rnd() * 3;
      const w = 3.2 + rnd() * 1.6,
        h = 2.4 + rnd() * 1.6,
        d = 3 + rnd();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: wallCols[Math.floor(rnd() * wallCols.length)],
          flatShading: true,
          roughness: 0.9,
        }),
      );
      body.position.set(x, h / 2, z);
      // windows
      for (let k = -1; k <= 1; k += 2) {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.7, 0.05),
          new THREE.MeshBasicMaterial({ color: 0xffd98a }),
        );
        win.position.set(k * w * 0.22, 0.1, (d / 2 + 0.03) * (side < 0 ? 1 : -1));
        body.add(win);
      }
      add(body, "house", x, 23.2);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.6 + rnd(), 4),
        new THREE.MeshStandardMaterial({
          color: roofCols[Math.floor(rnd() * roofCols.length)],
          flatShading: true,
          roughness: 0.8,
        }),
      );
      roof.position.set(x, h + 0.75, z);
      roof.rotation.y = Math.PI / 4;
      add(roof, "roof", x, 18.9);
    }
  }
  // trees
  for (let i = 0; i < 44; i++) {
    const x = -44 + rnd() * 88;
    const z = rnd() < 0.5 ? -1.6 - rnd() * 14 : 6 + rnd() * 14;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 1.2, 5),
      new THREE.MeshStandardMaterial({ color: 0x5a3d2b, flatShading: true }),
    );
    trunk.position.y = 0.6;
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 2.2, 6),
      new THREE.MeshStandardMaterial({
        color: rnd() < 0.5 ? 0x2f6b33 : 0x47803a,
        flatShading: true,
      }),
    );
    crown.position.y = 2.1;
    g.add(trunk, crown);
    g.position.set(x, 0, z);
    add(g, "tree", x, 19.2);
  }
  // cars
  for (let i = 0; i < 9; i++) {
    const x = -30 + i * 7.5 + rnd() * 2;
    const g = new THREE.Group();
    const col = carCols[Math.floor(rnd() * carCols.length)];
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.6, 1.1),
      new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 0.5 }),
    );
    b.position.y = 0.45;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.5, 1.0),
      new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 0.5 }),
    );
    top.position.set(-0.1, 0.95, 0);
    g.add(b, top);
    g.position.set(x, 0, rnd() < 0.5 ? 1 : 3);
    add(g, "car", x, 19.6);
  }
}

// dust / debris streaks
const dustN = 900;
const dustSeed = [];
const dustPos = new Float32Array(dustN * 3);
{
  const rnd = mulberry32(5);
  for (let i = 0; i < dustN; i++) dustSeed.push([rnd(), rnd(), rnd(), rnd()]);
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0xd8c0a8,
  size: 0.16,
  transparent: true,
  opacity: 0,
});
town.add(new THREE.Points(dustGeo, dustMat));

const STORM_SKY_TOP = C("#3a2a2a"),
  STORM_SKY_BOT = C("#9a7a62");
function renderTown(t) {
  const storm = smooth(18.4, 23, t);
  paintSky(
    townSkyTop.clone().lerp(STORM_SKY_TOP, storm),
    townSkyBot.clone().lerp(STORM_SKY_BOT, storm),
  );
  townFog.color.copy(C("#8a6f78").lerp(C("#7a6250"), storm));
  townFog.near = lerp(25, 6, storm);
  townFog.far = lerp(110, 60, storm);

  for (const f of flyers) {
    const dt = t - f.launch;
    if (dt <= 0) {
      // trembling before it goes
      const pre = clamp(1 + dt / 1.2);
      f.obj.position.copy(f.p0);
      f.obj.rotation.copy(f.r0);
      if (pre > 0 && f.kind !== "house")
        f.obj.rotation.z = f.r0.z - Math.sin(t * 40 + f.p0.x) * 0.05 * pre - 0.12 * pre;
      continue;
    }
    const dx = 0.5 * f.acc * dt * dt;
    const up = f.lift * (1 - Math.exp(-dt * 1.5)) + (f.kind === "house" ? 0 : 0);
    f.obj.position.set(f.p0.x + dx, f.p0.y + up, f.p0.z + Math.sin(dt * 2 + f.p0.x) * dt * 0.6);
    f.obj.rotation.set(f.r0.x + f.spin.x * dt, f.r0.y + f.spin.y * dt, f.r0.z + f.spin.z * dt);
  }

  // dust: streams left to right
  dustMat.opacity = 0.85 * storm;
  for (let i = 0; i < dustN; i++) {
    const s = dustSeed[i];
    const speed = 30 + s[3] * 40;
    const span = 120;
    const x = ((s[0] * span + (t - 18) * speed) % span) - 60;
    dustPos[i * 3] = x;
    dustPos[i * 3 + 1] = 0.2 + s[1] * 9;
    dustPos[i * 3 + 2] = -14 + s[2] * 34;
  }
  dustGeo.attributes.position.needsUpdate = true;

  // camera: low on the road, looking across the street
  const k = (t - 18) / 12;
  townCam.position.set(lerp(-10, -2, k), lerp(5.5, 7, k), 44);
  townCam.lookAt(lerp(-6, 2, k), 3, 0);
  const shake = storm * 0.08;
  townCam.position.x += Math.sin(t * 53) * shake;
  townCam.position.y += Math.cos(t * 61) * shake;
  renderer.render(town, townCam);
}

// =====================================================================
// OCEAN: the wave (30–40 s)
// =====================================================================
const ocean = new THREE.Scene();
const oceanCam = new THREE.PerspectiveCamera(55, W / H, 0.1, 600);
ocean.fog = new THREE.Fog(0x4a5a6a, 30, 220);
const oSkyGeo = new THREE.SphereGeometry(300, 24, 16);
{
  const p = oSkyGeo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const top = C("#1d2433"),
    bot = C("#7d8a96");
  for (let i = 0; i < p.count; i++) {
    tmpC.copy(bot).lerp(top, clamp(p.getY(i) / 160 + 0.1));
    col[i * 3] = tmpC.r;
    col[i * 3 + 1] = tmpC.g;
    col[i * 3 + 2] = tmpC.b;
  }
  oSkyGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}
ocean.add(
  new THREE.Mesh(
    oSkyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  ),
);
ocean.add(new THREE.HemisphereLight(0xb8c8e0, 0x203038, 1.1));
const oSun = new THREE.DirectionalLight(0xfff0d8, 1.8);
oSun.position.set(30, 40, -60);
ocean.add(oSun);

const waterGeo = new THREE.PlaneGeometry(240, 320, 90, 140).toNonIndexed();
waterGeo.rotateX(-Math.PI / 2);
const wPos = waterGeo.attributes.position;
const wBase = Float32Array.from(wPos.array);
const wCol = new Float32Array(wPos.count * 3);
waterGeo.setAttribute("color", new THREE.BufferAttribute(wCol, 3));
const water = new THREE.Mesh(
  waterGeo,
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.35,
    metalness: 0.05,
  }),
);
water.position.z = -140;
ocean.add(water);

// the shore the camera stands on
{
  const land = new THREE.Mesh(
    new THREE.BoxGeometry(240, 2, 40),
    new THREE.MeshStandardMaterial({ color: 0xc9b48a, flatShading: true }),
  );
  land.position.set(0, 0, 32);
  ocean.add(land);
  const rnd = mulberry32(3);
  for (let i = 0; i < 18; i++) {
    const w = 2 + rnd() * 2,
      h = 2 + rnd() * 3;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 2.5),
      new THREE.MeshStandardMaterial({
        color: [0xe8e0d0, 0xd0b090, 0xa0b0c0][i % 3],
        flatShading: true,
      }),
    );
    b.position.set(-36 + i * 4.2 + rnd(), 1 + h / 2, 14 + rnd() * 3);
    ocean.add(b);
  }
}

const SEA = C("#2a8a92"),
  SEA_D = C("#14505c"),
  FOAM = C("#f2fbf9");
function waveZ(t) {
  // world z of the crest: from the horizon to the camera
  const k = clamp((t - 30) / 9.4);
  return lerp(-260, 26, Math.pow(k, 1.6));
}
function renderOcean(t) {
  const zc = waveZ(t);
  const k = clamp((t - 30) / 9.4);
  const height = lerp(4, 46, Math.pow(k, 1.25));
  const width = lerp(10, 18, k);
  const arr = wPos.array;
  for (let i = 0; i < wPos.count; i++) {
    const x = wBase[i * 3];
    const z = wBase[i * 3 + 2];
    const wz = z + water.position.z;
    let y = Math.sin(x * 0.35 + t * 1.7) * 0.25 + Math.cos(z * 0.28 - t * 2.1) * 0.3;
    const dz = wz - zc;
    // asymmetric crest: steep face toward the camera
    const prof =
      dz > 0
        ? Math.exp(-(dz * dz) / (width * 0.35) ** 2)
        : Math.exp(-(dz * dz) / (width * 1.6) ** 2);
    y += height * prof * (0.85 + 0.15 * Math.sin(x * 0.12));
    // draw down in front of the wave
    if (dz > 0 && dz < 60) y -= 1.6 * k * Math.exp(-dz / 20);
    arr[i * 3 + 1] = y;
    tmpC.copy(SEA_D).lerp(SEA, clamp(y / 6 + 0.5));
    tmpC.lerp(FOAM, clamp((prof - 0.45) * 2.2) * clamp(height / 8) * (dz < 4 ? 1 : 0.5));
    wCol[i * 3] = tmpC.r;
    wCol[i * 3 + 1] = tmpC.g;
    wCol[i * 3 + 2] = tmpC.b;
  }
  wPos.needsUpdate = true;
  waterGeo.attributes.color.needsUpdate = true;
  waterGeo.computeVertexNormals();

  const ck = clamp((t - 30) / 9.4);
  oceanCam.position.set(lerp(-4, 0, ck), 10, 46);
  oceanCam.lookAt(0, lerp(4, 22, Math.pow(ck, 2)), -40);
  const shake = smooth(35, 39, t) * 0.12;
  oceanCam.position.x += Math.sin(t * 47) * shake;
  oceanCam.position.y += Math.cos(t * 59) * shake;
  renderer.render(ocean, oceanCam);
}

// =====================================================================
// HUD
// =====================================================================
const hud = document.getElementById("hud");
const hudLabel = document.getElementById("hud-label");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const pad = (n) => String(Math.floor(n)).padStart(2, "0");

function renderHud(t) {
  let label = "",
    value = "",
    sub = " ",
    show = true;
  if (t < 18) {
    label = "GESCHWINDIGKEIT AM ÄQUATOR";
    const v = t < STOP ? 1670 : 1670 * (1 - easeOut((t - STOP) / 0.6));
    value = fmt(v) + " km/h";
    if (t >= STOP) sub = "SEKUNDE 0";
  } else if (t < 30) {
    label = "WINDGESCHWINDIGKEIT";
    value = fmt(lerp(1670, 1585, (t - 18) / 12)) + " km/h";
    sub = "SEKUNDE " + Math.floor(t - 18 + 1);
  } else if (t < 40) {
    label = "ZEIT SEIT DEM STOPP";
    const s = lerp(8 * 60, 3 * 3600, Math.pow((t - 30) / 10, 1.4));
    value = pad(s / 3600) + ":" + pad((s % 3600) / 60) + ":" + pad(s % 60);
    sub = "STUNDEN : MINUTEN : SEKUNDEN";
  } else if (t < 52) {
    label = "LÄNGE EINES TAGES";
    value = fmt(lerp(24, 8766, easeOut((t - 40.4) / 9))) + " Stunden";
    sub = t > 49.5 ? "= 1 JAHR" : " ";
  } else if (t < 64) {
    label = "ZEIT SEIT DEM STOPP";
    value = fmt(lerp(1, 182, clamp((t - 52) / 11.5))) + " Tage";
    sub = "TAG ↔ NACHT";
  } else if (t < 72) {
    label = "MEERESANTEIL AM ÄQUATOR";
    value = fmt(lerp(78, 0, smooth(64.2, 70.5, t))) + " %";
    sub = " ";
  } else show = false;
  // fade out before the cuts to black and the end
  let op = 1;
  if (!show) op = 0;
  else if (t < 5.4) op = 0;
  else if (t < 5.9) op = (t - 5.4) / 0.5;
  else if (t > 71.3) op = clamp((71.8 - t) / 0.5);
  hud.style.opacity = op;
  if (hudLabel.textContent !== label) hudLabel.textContent = label;
  hudValue.textContent = value;
  hudSub.textContent = sub;
}

// =====================================================================
function renderAt(t) {
  if (t >= 18 && t < 30) renderTown(t);
  else if (t >= 30 && t < 40) renderOcean(t);
  else renderSpace(t);
  renderHud(t);
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.world = Promise.resolve();
