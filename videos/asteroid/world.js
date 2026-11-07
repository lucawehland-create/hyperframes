// "Was wäre, wenn ein Asteroid auf Deutschland zusteuert?" — space and ground, cut together.
// Every frame is a pure function of timeline time t (seconds), drawn on hf-seek.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

window.THREE = THREE;

const W = 1080;
const H = 1920;
const HIT = 41.9; // the probe strikes
const PASS = 64.5; // closest approach

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
function starField(n, radius, seed) {
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
  return new THREE.Points(
    g,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, fog: false }),
  );
}

// ---------- renderer ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 3000);

// =====================================================================
// SPACE
// =====================================================================
const space = new THREE.Scene();
space.background = C("#03040a");
space.add(starField(2200, 1500, 5));
const sunS = new THREE.DirectionalLight(0xfff2e0, 3.2);
sunS.position.set(60, 25, 40);
space.add(sunS);
space.add(new THREE.AmbientLight(0x404a70, 0.35));

// Earth
const ER = 6;
const earth = new THREE.Group();
{
  const geo = new THREE.IcosahedronGeometry(ER, 4);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const OCEAN = C("#1d5d8f"),
    LAND = C("#4c8f3e"),
    DESERT = C("#c9a35e"),
    ICE = C("#eef3f7");
  for (let f = 0; f < p.count / 3; f++) {
    const c = V(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(V(p.getX(f * 3 + k), p.getY(f * 3 + k), p.getZ(f * 3 + k)));
    c.normalize();
    const n =
      0.6 * vnoise(c.x * 1.8 + 3, c.y * 1.8 + 1, c.z * 1.8 + 5) +
      0.4 * vnoise(c.x * 4 + 1, c.y * 4, c.z * 4);
    let k;
    if (Math.abs(c.y) > 0.88) k = ICE;
    else if (n > 0.5)
      k = Math.abs(c.y) < 0.35 && vnoise(c.x * 6, c.y * 6, c.z * 6) > 0.55 ? DESERT : LAND;
    else k = OCEAN;
    for (let j = 0; j < 3; j++) col.set([k.r, k.g, k.b], (f * 3 + j) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  earth.add(new THREE.Mesh(geo, std(0xffffff, { vertexColors: true })));
  earth.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(ER * 1.05, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0x6fb6ff,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
      }),
    ),
  );
  earth.rotation.z = 0.41;
  space.add(earth);
}
// Germany: a point on the surface facing the incoming rock
const TARGET = V(0.45, 0.62, 0.64).normalize().multiplyScalar(ER);
const targetMark = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 12, 8),
  new THREE.MeshBasicMaterial({ color: 0xff3a2a }),
);
targetMark.position.copy(TARGET);
space.add(targetMark);

// the asteroid: a lumpy rock, watertight because displacement depends on position only
const rock = new THREE.Group();
{
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const d =
      0.72 +
      0.45 * vnoise(v.x * 2 + 7, v.y * 2 + 3, v.z * 2 + 1) +
      0.12 * vnoise(v.x * 6, v.y * 6, v.z * 6);
    p.setXYZ(i, v.x * d, v.y * d * 0.85, v.z * d);
  }
  geo.computeVertexNormals();
  rock.add(new THREE.Mesh(geo, std(0x6e6258, { roughness: 1 })));
  space.add(rock);
}
// glowing tail for the fly-by
const tailN = 260;
const tailPos = new Float32Array(tailN * 3);
const tailGeo = new THREE.BufferGeometry();
tailGeo.setAttribute("position", new THREE.BufferAttribute(tailPos, 3));
const tail = new THREE.Points(
  tailGeo,
  new THREE.PointsMaterial({
    color: 0xffc27a,
    size: 4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.85,
  }),
);
tail.frustumCulled = false;
space.add(tail);

// the probe
const probe = new THREE.Group();
{
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    std(0xd8b04a, { metalness: 0.6, roughness: 0.4 }),
  );
  const panelMat = std(0x2a4a9a, { metalness: 0.3, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 1.6), panelMat);
    panel.position.set(0, 0, s * 1.05);
    probe.add(panel);
  }
  probe.add(body);
  space.add(probe);
}
const flash = new THREE.Mesh(
  new THREE.SphereGeometry(1, 20, 16),
  new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true }),
);
space.add(flash);
const debrisN = 400;
const debrisDir = [];
{
  const rnd = mulberry32(9);
  for (let i = 0; i < debrisN; i++) {
    const v = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    v.x -= 0.9; // thrown back toward where the probe came from
    debrisDir.push(v.normalize().multiplyScalar(0.5 + rnd() * 1.5));
  }
}
const debrisPos = new Float32Array(debrisN * 3);
const debrisGeo = new THREE.BufferGeometry();
debrisGeo.setAttribute("position", new THREE.BufferAttribute(debrisPos, 3));
const debris = new THREE.Points(
  debrisGeo,
  new THREE.PointsMaterial({ color: 0xc8b8a0, size: 0.12, transparent: true }),
);
debris.frustumCulled = false;
space.add(debris);

// trajectories
function pathLine(points, color) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const l = new THREE.Line(
    g,
    new THREE.LineDashedMaterial({ color, dashSize: 1.2, gapSize: 0.8, transparent: true }),
  );
  l.computeLineDistances();
  space.add(l);
  return l;
}
const ROCK_FAR = V(52, 10, -14);
const curveHit = new THREE.QuadraticBezierCurve3(
  ROCK_FAR.clone(),
  V(30, 16, 18),
  TARGET.clone().multiplyScalar(1.02),
);
const redPath = pathLine(curveHit.getPoints(80), 0xff4a3a);
const curveMiss = new THREE.QuadraticBezierCurve3(ROCK_FAR.clone(), V(30, 20, 18), V(-30, 16, 12));
const greenPath = pathLine(curveMiss.getPoints(80), 0x4ae08a);

function renderSpace(t) {
  cam.fov = 50;
  cam.updateProjectionMatrix();
  earth.rotation.y = t * 0.03;
  // marker follows Earth's turn? Keep it fixed in space for clarity
  targetMark.visible = t >= 14 && t < 48;
  targetMark.material.color.setRGB(1, 0.25 + 0.2 * Math.sin(t * 6), 0.15);
  rock.rotation.set(t * 0.21, t * 0.33, t * 0.12);
  redPath.visible = greenPath.visible = false;
  probe.visible = flash.visible = debris.visible = tail.visible = false;
  let camPos, camLook, rockPos, rockScale;

  if (t < 5) {
    // hook: the rock tumbles toward us, Earth small beyond it
    rockPos = V(37, 3.5, 62);
    rockScale = 2.2;
    const k = t / 5;
    camPos = V(lerp(41, 40, k), 6, lerp(72, 69, k));
    camLook = V(22, 1.5, 36);
  } else if (t < 24) {
    // the plan view: red path ends on Germany
    const k = smooth(14, 24, t);
    rockPos = curveHit.getPoint(0.06 * k);
    rockScale = 1.6;
    redPath.visible = true;
    redPath.material.opacity = smooth(14.3, 15.5, t);
    camPos = V(lerp(32, 28, k), lerp(26, 22, k), lerp(108, 96, k));
    camLook = V(24, 4, 2);
  } else {
    // 36–48: close approach, impact, then the pull-back to both paths
    const Q = V(30, 0, 30);
    rockScale = 2.2;
    const nudge = smooth(HIT, HIT + 0.6, t) * 0.25;
    rockPos = Q.clone().add(V(nudge, nudge * 0.6, 0));
    const hitPoint = Q.clone().add(V(-2.0, 0.2, 0.4));
    if (t < HIT) {
      probe.visible = true;
      const k = clamp((t - 36) / (HIT - 36));
      const start = V(8, 3.5, 36);
      probe.position.copy(start.lerp(hitPoint, Math.pow(k, 1.6)));
      probe.lookAt(hitPoint);
      probe.rotateY(Math.PI / 2);
    }
    if (t >= HIT) {
      const d = t - HIT;
      flash.visible = d < 1.2;
      const fs = 0.5 + d * 6;
      flash.scale.set(fs, fs, fs);
      flash.position.copy(hitPoint);
      flash.material.opacity = clamp(1 - d / 1.2);
      debris.visible = true;
      for (let i = 0; i < debrisN; i++) {
        const p = hitPoint.clone().addScaledVector(debrisDir[i], d * 2.2);
        debrisPos.set([p.x, p.y, p.z], i * 3);
      }
      debrisGeo.attributes.position.needsUpdate = true;
      debris.material.opacity = clamp(1 - d / 6);
    }
    const pull = smooth(43.2, 47.8, t);
    if (pull > 0) {
      redPath.visible = greenPath.visible = true;
      redPath.material.opacity = 0.35 * pull;
      greenPath.material.opacity = pull;
    }
    camPos = V(24, 3, 44).lerp(V(46, 34, 104), pull);
    camLook = V(28, 0.5, 31).lerp(V(14, 4, 6), pull);
    if (t >= HIT && t < HIT + 0.6) {
      const s = (1 - (t - HIT) / 0.6) * 0.25;
      camPos.x += Math.sin(t * 90) * s;
      camPos.y += Math.cos(t * 77) * s;
    }
  }

  if (t >= 60 && t < 70) {
    // the fly-by over Earth's limb
    const k = (t - 60.4) / 8;
    rockPos = V(lerp(20, -20, k), 9.6 - 1.0 * Math.abs(k - 0.5), lerp(-6, 6, k));
    rockScale = 1.4;
    redPath.visible = greenPath.visible = debris.visible = flash.visible = false;
    tail.visible = true;
    const dir = V(-40, 0, 12).normalize();
    const rnd = mulberry32(31);
    for (let i = 0; i < tailN; i++) {
      const back = rnd() * 9;
      const p = rockPos.clone().addScaledVector(dir, -back);
      p.x += (rnd() - 0.5) * 0.6 * (back / 9);
      p.y += (rnd() - 0.5) * 0.6 * (back / 9);
      tailPos.set([p.x, p.y, p.z], i * 3);
    }
    tailGeo.attributes.position.needsUpdate = true;
    const kk = smooth(60, 70, t);
    camPos = V(lerp(-3, 2, kk), lerp(0, 1.5, kk), lerp(24, 27, kk));
    camLook = V(0, 5, 0);
  }

  rock.position.copy(rockPos);
  rock.scale.setScalar(rockScale);
  cam.position.copy(camPos);
  cam.lookAt(camLook);
  renderer.render(space, cam);
}

// =====================================================================
// GROUND: observatory (night), launch pad (dawn), city (night)
// =====================================================================
const ground = new THREE.Scene();
const fog = new THREE.Fog(0x101830, 80, 600);
ground.fog = fog;
const sunG = new THREE.DirectionalLight(0xfff1dc, 1);
ground.add(sunG);
const hemiG = new THREE.HemisphereLight(0xc8d8ff, 0x403a34, 0.5);
ground.add(hemiG);
const groundStars = starField(1400, 900, 11);
ground.add(groundStars);
const skyGeo = new THREE.SphereGeometry(1000, 32, 20);
const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
ground.add(
  new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  ),
);
let lastSky = "";
function paintSky(top, bot) {
  const key = top + bot;
  if (key === lastSky) return;
  lastSky = key;
  const a = C(top),
    b = C(bot);
  const p = skyGeo.attributes.position;
  for (let j = 0; j < p.count; j++) {
    const k = Math.pow(clamp(p.getY(j) / 500 + 0.04), 0.6);
    tmpC.copy(b).lerp(a, k);
    skyCol.set([tmpC.r, tmpC.g, tmpC.b], j * 3);
  }
  skyGeo.attributes.color.needsUpdate = true;
  fog.color.copy(b);
}
{
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), std(0x3a4636));
  plane.rotation.x = -Math.PI / 2;
  ground.add(plane);
}

// --- observatory at the origin ---
const telescope = new THREE.Group();
const skyMarker = new THREE.Group();
{
  const hill = new THREE.Mesh(new THREE.ConeGeometry(40, 8, 12), std(0x2f3a2c));
  hill.position.y = 4;
  ground.add(hill);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 5, 20), std(0xdadfe6));
  base.position.y = 10.5;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    std(0xe8ecf2, { metalness: 0.3, roughness: 0.4 }),
  );
  dome.position.y = 13;
  const slit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.4, 8.4), std(0x0a0c12));
  slit.position.set(0, 14.6, 0);
  slit.rotation.x = -0.5;
  ground.add(base, dome);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 9, 14), std(0xf0f0f0));
  tube.position.y = 4.5;
  telescope.add(tube);
  telescope.position.set(0, 14, 0.8);
  telescope.rotation.x = -0.6;
  ground.add(telescope);
  // the newly found dot, ringed
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(3, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd8a0, fog: false }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(18, 1.1, 6, 48),
    new THREE.MeshBasicMaterial({ color: 0xff4a3a, fog: false, transparent: true }),
  );
  skyMarker.add(dot, ring);
  skyMarker.position.set(-137, 236, -344);
  skyMarker.lookAt(13, 7, 26);
  ground.add(skyMarker);
}

// --- launch pad at x = 400 ---
const PAD = V(400, 0, 0);
const rocket = new THREE.Group();
const flame = new THREE.Mesh(
  new THREE.ConeGeometry(1.4, 9, 12),
  new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.95 }),
);
const smoke = [];
{
  const pad = new THREE.Mesh(new THREE.BoxGeometry(24, 2, 24), std(0x8a8a86));
  pad.position.set(PAD.x, 1, PAD.z);
  ground.add(pad);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), std(0xb84a2a));
  tower.position.set(PAD.x + 6, 19, PAD.z);
  ground.add(tower);
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 0.8), std(0xb84a2a));
    arm.position.set(PAD.x + 4, 6 + i * 5, PAD.z);
    ground.add(arm);
  }
  const white = std(0xf2f2f0, { roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 22, 20), white);
  body.position.y = 11;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 1.2, 20), std(0x1a1a1a));
  band.position.y = 17;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 5, 20), white);
  nose.position.y = 24.5;
  rocket.add(body, band, nose);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 2.2), std(0x2a2a2a));
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 1.6, 1.8, Math.sin(a) * 1.6);
    fin.rotation.y = -a;
    rocket.add(fin);
  }
  flame.rotation.x = Math.PI;
  flame.position.y = -4.4;
  rocket.add(flame);
  rocket.position.set(PAD.x, 2, PAD.z);
  ground.add(rocket);
  const rnd = mulberry32(13);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe8e4de,
    flatShading: true,
    transparent: true,
  });
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat.clone());
    ground.add(m);
    smoke.push({ m, s: rnd(), a: rnd() * Math.PI * 2, born: 29.4 + rnd() * 6, trail: i >= 45 });
  }
}
function rocketY(t) {
  const d = t - 30.6;
  return d > 0 ? 2 + 4.5 * d * d : 2;
}

// --- city at x = -400 ---
const CITY = V(-400, 0, 0);
const windowMats = [];
const people = [];
const glow = new THREE.Group();
const fireworks = [];
{
  const rnd = mulberry32(17);
  const tex = (() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 8; x++) {
        g.fillStyle = rnd() < 0.55 ? "#ffd58a" : "#000";
        g.fillRect(x * 32 + 5, y * 32 + 5, 22, 23);
      }
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  })();
  for (let gx = -120; gx <= 120; gx += 14) {
    for (let gz = -40; gz >= -160; gz -= 14) {
      if (rnd() < 0.15) continue;
      const w = 9 + rnd() * 3,
        h = (10 + rnd() * rnd() * 60) * (gz > -80 ? 0.4 : 1);
      const em = tex.clone();
      em.wrapS = em.wrapT = THREE.RepeatWrapping;
      em.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 12)));
      em.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2a2e38,
        emissive: 0xffffff,
        emissiveMap: em,
        emissiveIntensity: 1,
        roughness: 0.9,
      });
      windowMats.push(mat);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      b.position.set(CITY.x + gx, h / 2, CITY.z + gz);
      ground.add(b);
    }
  }
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(40, 32), std(0x6a6a66));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(CITY.x, 0.05, CITY.z);
  ground.add(plaza);
  const SKIN = [0xf1c7a5, 0xd9a07a, 0x8d5a3b, 0xe8b894, 0x6b4430];
  const CLOTH = [0x3d6fd9, 0xd94a3a, 0x2fa38a, 0xe8c547, 0x6a4c93, 0x3a3a44, 0xe07a2f, 0xf0f0f0];
  for (let i = 0; i < 160; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.8, 3, 8),
      std(CLOTH[i % CLOTH.length]),
    );
    body.position.y = 0.95;
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 3, 8), std(0x2a2e3a));
    legs.position.y = 0.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), std(SKIN[i % SKIN.length]));
    head.position.y = 1.75;
    g.add(legs, body, head);
    const r = 3 + rnd() * 26,
      a = rnd() * Math.PI * 2;
    g.position.set(CITY.x + Math.cos(a) * r, 0, CITY.z + Math.sin(a) * r * 0.7 - 6);
    g.rotation.y = Math.PI + (rnd() - 0.5) * 0.6;
    ground.add(g);
    people.push({ g, head, seed: rnd() * 10 });
  }
  // the asteroid as a growing light in the sky
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.25, fog: false }),
  );
  glow.add(core, halo);
  glow.position.set(CITY.x + 36, 300, CITY.z - 400);
  ground.add(glow);
  // fireworks
  const fRnd = mulberry32(71);
  const cols = [0xff5a5a, 0xffd25a, 0x5ad8ff, 0x9aff6a, 0xff7ad8];
  for (let b = 0; b < 7; b++) {
    const n = 160;
    const dirs = [];
    for (let i = 0; i < n; i++)
      dirs.push(
        V(fRnd() - 0.5, fRnd() - 0.5, fRnd() - 0.5)
          .normalize()
          .multiplyScalar(0.7 + fRnd() * 0.3),
      );
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: cols[b % cols.length],
        size: 6,
        sizeAttenuation: false,
        transparent: true,
        fog: false,
      }),
    );
    pts.frustumCulled = false;
    ground.add(pts);
    fireworks.push({
      pts,
      geo,
      dirs,
      at: 70.2 + b * 0.55,
      c: V(CITY.x - 50 + fRnd() * 100, 120 + fRnd() * 50, CITY.z - 140 - fRnd() * 60),
    });
  }
}

const GROUND_LOOKS = [
  // [start, top, bottom, sunI, hemiI, stars]
  [5, "#060a1c", "#16203c", 0.2, 0.35, 1],
  [24, "#38568f", "#f2b07a", 2.2, 0.9, 0],
  [48, "#070b1d", "#1d2442", 0.2, 0.4, 1],
];
function renderGround(t) {
  cam.fov = 50;
  cam.updateProjectionMatrix();
  let L = GROUND_LOOKS[0];
  for (const l of GROUND_LOOKS) if (t >= l[0]) L = l;
  paintSky(L[1], L[2]);
  sunG.intensity = L[3];
  hemiG.intensity = L[4];
  groundStars.visible = L[5] > 0;
  let camPos, camLook;

  if (t < 14) {
    // observatory
    sunG.position.set(-50, 80, 40);
    const k = (t - 5) / 9;
    telescope.rotation.x = -0.6 - 0.12 * k;
    skyMarker.visible = t > 7.5;
    skyMarker.children[1].material.opacity = 0.5 + 0.5 * Math.sin(t * 5);
    camPos = V(lerp(18, 13, k), lerp(5, 7, k), lerp(30, 26, k));
    camLook = V(-2, lerp(14, 24, k), -10);
  } else if (t < 36) {
    // launch pad at dawn
    sunG.position.set(PAD.x - 200, 40, PAD.z - 100);
    const ry = rocketY(t);
    rocket.position.y = ry;
    const lit = t >= 29.6;
    flame.visible = lit;
    if (lit) {
      const f = smooth(29.6, 30.4, t) * (0.9 + 0.15 * Math.sin(t * 40));
      flame.scale.set(f, f * (1 + 0.25 * Math.sin(t * 23)), f);
    }
    for (const s of smoke) {
      const age = t - s.born;
      s.m.visible = age > 0 && t > 29.4;
      if (!s.m.visible) continue;
      const sc = 1.5 + age * 2.2;
      if (s.trail) {
        // left along the climb
        const y = Math.max(2, rocketY(s.born + 0.2) - 6);
        s.m.position.set(
          PAD.x + Math.cos(s.a) * age * 0.8,
          y + age * 0.6,
          PAD.z + Math.sin(s.a) * age * 0.8,
        );
      } else {
        // billowing out at the pad
        s.m.position.set(
          PAD.x + Math.cos(s.a) * age * 4,
          2 + age * 0.9,
          PAD.z + Math.sin(s.a) * age * 4,
        );
      }
      s.m.scale.set(sc, sc * 0.8, sc);
      s.m.material.opacity = clamp(0.9 - age * 0.12);
    }
    const lookY = Math.max(14, ry + 10);
    camPos = V(PAD.x + 34, lerp(8, 10, smooth(24, 36, t)), PAD.z + 52);
    camLook = V(PAD.x, lookY, PAD.z);
    if (lit && t < 33) {
      const s = 0.25 * smooth(29.6, 30.5, t);
      camPos.x += Math.sin(t * 61) * s;
      camPos.y += Math.cos(t * 53) * s;
    }
  } else {
    // city at night, everyone looking up
    sunG.position.set(CITY.x + 100, 80, 100);
    const after = t >= 70;
    glow.visible = !after;
    const g = 1 + smooth(48, 60, t) * 3.2;
    glow.scale.set(g, g, g);
    glow.children[1].material.opacity = 0.2 + 0.15 * smooth(48, 60, t);
    for (const m of windowMats) m.emissiveIntensity = 0.9;
    for (const p of people) {
      p.head.position.z = after ? 0 : 0.06; // heads tilted up
      p.g.position.y = after ? Math.max(0, Math.sin(t * 9 + p.seed) * 0.35) : 0; // jumping for joy
    }
    for (const f of fireworks) {
      const d = t - f.at;
      f.pts.visible = after && d > 0 && d < 2.6;
      if (!f.pts.visible) continue;
      const arr = f.geo.attributes.position.array;
      const r = 22 * (1 - Math.exp(-d * 2.2));
      for (let i = 0; i < f.dirs.length; i++) {
        arr[i * 3] = f.c.x + f.dirs[i].x * r;
        arr[i * 3 + 1] = f.c.y + f.dirs[i].y * r - d * d * 2;
        arr[i * 3 + 2] = f.c.z + f.dirs[i].z * r;
      }
      f.geo.attributes.position.needsUpdate = true;
      f.pts.material.opacity = clamp(1 - d / 2.6);
    }
    const k = smooth(48, 60, t);
    camPos = after
      ? V(CITY.x + 4, 3, CITY.z + 34)
      : V(CITY.x + lerp(-6, 0, k), lerp(2.2, 1.8, k), CITY.z + lerp(40, 32, k));
    camLook = after ? V(CITY.x, 60, CITY.z - 160) : V(CITY.x + 10, lerp(52, 64, k), CITY.z - 160);
    cam.fov = 70;
    cam.updateProjectionMatrix();
  }
  cam.position.copy(camPos);
  cam.lookAt(camLook);
  renderer.render(ground, cam);
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudLabel = document.getElementById("hud-label");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const DAYS = [
  [5, 180],
  [14, 178],
  [24, 150],
  [36, 60],
  [48, 20],
  [59.9, 0.06],
];
function daysAt(t) {
  if (t <= DAYS[0][0]) return 180;
  for (let i = 1; i < DAYS.length; i++)
    if (t <= DAYS[i][0]) {
      const [t0, d0] = DAYS[i - 1],
        [t1, d1] = DAYS[i];
      return Math.exp(lerp(Math.log(d0), Math.log(d1), (t - t0) / (t1 - t0)));
    }
  return 0.06;
}
function flybyKm(t) {
  if (t < PASS) return lerp(400000, 12000, smooth(60, PASS, t));
  return lerp(12000, 600000, smooth(PASS, 74, t) ** 1.5);
}
function renderHud(t) {
  if (t < 60) {
    hudLabel.textContent = "TAGE BIS ZUM EINSCHLAG";
    const d = daysAt(t);
    hudValue.textContent =
      d >= 1
        ? fmt(Math.floor(d))
        : fmt(Math.max(1, d * 24)) + (d * 24 < 1.5 ? " Stunde" : " Stunden");
    hudSub.textContent = "ENTFERNUNG: " + fmt(d * 1.7e6) + " KM";
    hudSub2.textContent = t < HIT ? "KURS: ERDE" : t < 60 ? "KURS: UNKLAR" : " ";
  } else {
    hudLabel.textContent = "ABSTAND ZUR ERDE";
    hudValue.textContent = fmt(flybyKm(t)) + " km";
    hudSub.textContent = t >= PASS ? "VERFEHLT!" : "VORBEIFLUG";
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
  const inSpace = t < 5 || (t >= 14 && t < 24) || (t >= 36 && t < 48) || (t >= 60 && t < 70);
  if (inSpace) renderSpace(t);
  else renderGround(t);
  renderHud(t);
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.world = Promise.resolve();
