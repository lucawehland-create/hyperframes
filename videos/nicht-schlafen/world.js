// "Was wäre, wenn du 1 Jahr lang nicht schläfst?" — one room, one road, one heartbeat.
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

// ---------- story clock ----------
const AWAKE = [
  [5, 16],
  [14, 24],
  [24, 48],
  [36, 100],
  [48, 180],
  [59.5, 264],
];
function hoursAwake(t) {
  if (t <= AWAKE[0][0]) return 16;
  for (let i = 1; i < AWAKE.length; i++)
    if (t <= AWAKE[i][0]) {
      const [t0, h0] = AWAKE[i - 1],
        [t1, h1] = AWAKE[i];
      return lerp(h0, h1, (t - t0) / (t1 - t0));
    }
  return 264;
}
const clockHour = (t) => (t >= 70 ? 6.5 + (t - 70) * 0.15 : (7 + hoursAwake(t)) % 24);

// ---------- renderer ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 1000);

// =====================================================================
// ROOM
// =====================================================================
const room = new THREE.Scene();
room.background = C("#0a0c12");
const ambient = new THREE.AmbientLight(0xb0b8d0, 0.5);
room.add(ambient);
const lamp = new THREE.PointLight(0xffc880, 30, 14, 1.6);
lamp.position.set(-3.6, 3.2, -2.6);
room.add(lamp);
const windowLight = new THREE.DirectionalLight(0xbcd4ff, 0.6);
windowLight.position.set(-1, 6, -12);
room.add(windowLight);
const phoneLight = new THREE.PointLight(0x9fd0ff, 0, 4, 1.5);
room.add(phoneLight);

const wallMat = std(0x8d9bb0);
const floorMat = std(0x6a5446);
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), floorMat);
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), wallMat);
  back.position.set(0, 5, -6);
  room.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-8, 5, 1);
  room.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), wallMat);
  right.rotation.y = -Math.PI / 2;
  right.position.set(8, 5, 1);
  room.add(right);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), std(0x5a6274));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 10, 1);
  room.add(ceil);
}
// window with sky and a little skyline
const skyMat = new THREE.MeshBasicMaterial({ color: 0x0b1024 });
{
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.4, 0.2), std(0xe8e4dc));
  frame.position.set(0, 6, -5.95);
  room.add(frame);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.0), skyMat);
  sky.position.set(0, 6, -5.83);
  room.add(sky);
  const rnd = mulberry32(4);
  for (let i = 0; i < 9; i++) {
    const h = 0.4 + rnd() * 1.4;
    const b = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, h),
      new THREE.MeshBasicMaterial({ color: 0x141824 }),
    );
    b.position.set(-1.9 + i * 0.47, 4.5 + h / 2, -5.8);
    room.add(b);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.0, 0.1), std(0xe8e4dc));
  bar.position.set(0, 6, -5.78);
  room.add(bar);
}
const SKY_KEYS = [
  [0, "#0b1024"],
  [5.5, "#1a2244"],
  [7, "#f0a878"],
  [9, "#8fc0ea"],
  [17, "#8fc0ea"],
  [19, "#f08a5a"],
  [21, "#1a2244"],
  [24, "#0b1024"],
];
function skyColor(hour, out) {
  let i = 1;
  while (i < SKY_KEYS.length - 1 && hour > SKY_KEYS[i][0]) i++;
  const k = smooth(SKY_KEYS[i - 1][0], SKY_KEYS[i][0], hour);
  return out.set(SKY_KEYS[i - 1][1]).lerp(tmpC.set(SKY_KEYS[i][1]), k);
}
// wall clock
const hourHand = new THREE.Group(),
  minuteHand = new THREE.Group();
{
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 32), std(0xf6f2ea));
  face.rotation.x = Math.PI / 2;
  face.position.set(4.6, 6.6, -5.9);
  room.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.07, 6, 32), std(0x2a2a2a));
  rim.position.set(4.6, 6.6, -5.84);
  room.add(rim);
  const hh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.04), std(0x1a1a1a));
  hh.position.y = 0.25;
  hourHand.add(hh);
  const mh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.04), std(0x1a1a1a));
  mh.position.y = 0.37;
  minuteHand.add(mh);
  for (const g of [hourHand, minuteHand]) {
    g.position.set(4.6, 6.6, -5.8);
    room.add(g);
  }
}
// desk, laptop, lamp, cups
const cups = [];
const screenMat = new THREE.MeshBasicMaterial({ color: 0xbfe0ff });
{
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.18, 2.2), std(0x8a6a4a));
  top.position.set(-3.2, 2.4, -2.6);
  room.add(top);
  for (const [x, z] of [
    [-5.7, -3.5],
    [-0.7, -3.5],
    [-5.7, -1.7],
    [-0.7, -1.7],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), std(0x5a4632));
    leg.position.set(x, 1.2, z);
    room.add(leg);
  }
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.06, 1.1),
    std(0x9aa0a8, { metalness: 0.5 }),
  );
  base.position.set(-3.0, 2.52, -2.5);
  room.add(base);
  const lid = new THREE.Group();
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.05, 0.05),
    std(0x9aa0a8, { metalness: 0.5 }),
  );
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.9), screenMat);
  scr.position.z = -0.03;
  scr.rotation.y = Math.PI;
  lid.add(back, scr);
  lid.position.set(-3.0, 3.0, -1.98);
  lid.rotation.x = 0.25;
  room.add(lid);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.1, 12), std(0x2a2a2a));
  lampBase.position.set(-5.2, 2.54, -3.2);
  const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), std(0x2a2a2a));
  lampArm.position.set(-5.2, 3.05, -3.2);
  const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 12, 1, true), std(0xd8b04a));
  lampHead.position.set(-5.0, 3.55, -3.0);
  room.add(lampBase, lampArm, lampHead);
  const cupMat = std(0xf2eee6);
  const coffee = std(0x3a2416);
  for (let i = 0; i < 24; i++) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.36, 12), cupMat);
    const k = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), coffee);
    k.rotation.x = -Math.PI / 2;
    k.position.y = 0.16;
    g.add(c, k);
    const col = i % 3,
      rz = Math.floor(i / 3) % 4,
      layer = Math.floor(i / 12);
    g.position.set(-1.45 + col * 0.36, 2.67 + layer * 0.38, -3.4 + rz * 0.42);
    room.add(g);
    cups.push(g);
  }
}
// the person at the desk (faces the camera)
const person = new THREE.Group();
const torso = new THREE.Group();
const headG = new THREE.Group();
const lids = [];
const bags = [];
{
  const shirt = std(0x3d6fd9);
  const chair = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 1.3), std(0x2a2a30));
  chair.position.set(-3.0, 1.5, -4.2);
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 0.18), std(0x2a2a30));
  chairBack.position.set(-3.0, 2.5, -4.9);
  room.add(chair, chairBack);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 4, 10), shirt);
  body.position.y = 0.8;
  torso.add(body);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.9, 3, 8), shirt);
    arm.position.set(s * 0.62, 0.95, 0.35);
    arm.rotation.x = -1.1;
    torso.add(arm);
  }
  const skin = std(0xe8b894);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), skin);
  headG.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2),
    std(0x3a2a1e),
  );
  hair.position.y = 0.04;
  headG.add(hair);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), std(0xffffff));
    eye.position.set(s * 0.17, 0.05, 0.42);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), std(0x1a1a1a));
    pupil.position.set(s * 0.17, 0.05, 0.5);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.05), skin);
    lid.position.set(s * 0.17, 0.16, 0.5);
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 6), std(0x7a4a6a));
    bag.scale.set(1.2, 0.35, 0.4);
    bag.position.set(s * 0.17, -0.07, 0.45);
    headG.add(eye, pupil, lid, bag);
    lids.push(lid);
    bags.push(bag);
  }
  headG.position.y = 1.95;
  torso.add(headG);
  person.add(torso);
  person.position.set(-3.0, 1.6, -4.1);
  room.add(person);
}
// the bed, and the person lying in it (hook and ending)
const sleeper = new THREE.Group();
const phone = new THREE.Mesh(
  new THREE.BoxGeometry(0.3, 0.55, 0.05),
  new THREE.MeshBasicMaterial({ color: 0xbfe0ff }),
);
const sleeperLids = [];
{
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 5.4), std(0x6a4a34));
  frame.position.set(4.4, 0.4, -2.8);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 5.2), std(0xf0ece6));
  mattress.position.set(4.4, 1.05, -2.8);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.0), std(0xffffff));
  pillow.position.set(4.4, 1.5, -4.8);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.35, 3.4), std(0x4a6aa8));
  blanket.position.set(4.4, 1.45, -1.9);
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.2), std(0x6a4a34));
  headboard.position.set(4.4, 1.6, -5.5);
  room.add(frame, mattress, pillow, blanket, headboard);
  const skin = std(0xe8b894);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), skin);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2),
    std(0x3a2a1e),
  );
  hair.rotation.x = -Math.PI / 2;
  hair.position.z = -0.05;
  sleeper.add(head, hair);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), std(0xffffff));
    eye.position.set(s * 0.16, 0.43, 0.1);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), skin);
    lid.position.set(s * 0.16, 0.47, 0.1);
    sleeper.add(eye, lid);
    sleeperLids.push(lid);
  }
  sleeper.position.set(4.4, 1.75, -4.4);
  room.add(sleeper);
  phone.position.set(4.4, 2.6, -3.8);
  phone.rotation.x = -1.2;
  room.add(phone);
}
// Zzz sprites
const zs = [];
{
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.font = "bold 110px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("Z", 64, 70);
  const tx = new THREE.CanvasTexture(c);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true }));
    room.add(s);
    zs.push({ s, d: i * 0.9 });
  }
}
// hallucinations
const visions = [];
const shadows = [];
{
  const rnd = mulberry32(21);
  const cols = [0xff5ad8, 0x5ad8ff, 0xffd25a, 0x9aff6a, 0xff7a4a];
  for (let i = 0; i < 26; i++) {
    const geo =
      i % 3 === 0
        ? new THREE.TorusGeometry(0.35, 0.12, 8, 20)
        : new THREE.IcosahedronGeometry(0.3 + rnd() * 0.3, 0);
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: cols[i % cols.length],
        emissive: cols[i % cols.length],
        emissiveIntensity: 0.6,
        transparent: true,
      }),
    );
    room.add(m);
    visions.push({
      m,
      r: 2 + rnd() * 4,
      a: rnd() * 6.28,
      y: 2 + rnd() * 6,
      sp: 0.3 + rnd() * 0.6,
      ph: rnd() * 6.28,
    });
  }
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 2.6, 4, 10),
      new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true }),
    );
    m.position.set([-7, 7.2, 1.5][i], 2.0, [-1, -3.5, -5.2][i]);
    room.add(m);
    shadows.push({ m, on: [27.0, 30.5, 33.5][i] });
  }
}

const WALL = C("#8d9bb0"),
  WALL_GLOOM = C("#4a4e58");
function renderRoom(t) {
  const hour = clockHour(t);
  const awake = hoursAwake(t);
  skyColor(hour, skyMat.color);
  const night =
    hour < 6 || hour > 20.5
      ? 1
      : hour < 8
        ? 1 - (hour - 6) / 2
        : hour > 18.5
          ? (hour - 18.5) / 2
          : 0;
  windowLight.color.copy(skyMat.color);
  windowLight.intensity = lerp(1.6, 0.15, night);
  ambient.intensity = lerp(0.65, 0.22, night);
  hourHand.rotation.z = -((hour % 12) / 12) * Math.PI * 2;
  minuteHand.rotation.z = -((hour % 1) * Math.PI * 2);

  const inBed = t < 5 || t >= 70;
  person.visible = !inBed;
  sleeper.visible = inBed;
  phone.visible = t < 5;
  phoneLight.intensity = t < 5 ? 2.5 : 0;
  phoneLight.position.set(4.4, 2.6, -3.6);
  lamp.intensity = inBed ? 0 : 30;
  screenMat.color.set(inBed ? 0x202830 : 0xbfe0ff);

  // cups pile up
  const n = inBed ? 0 : Math.min(24, Math.floor((awake - 16) / 9) + 1);
  cups.forEach((c, i) => (c.visible = i < n));

  // tiredness: drooping lids, darker bags, sagging posture
  const tired = clamp((awake - 16) / 200);
  const blinkPhase = (t * 0.7) % 1;
  const blink = blinkPhase > 0.94 ? 1 : 0;
  let lidDrop = lerp(0, 0.75, tired);
  // nodding off in the late chapter
  let nod = 0;
  if (t >= 48 && t < 60) {
    const s = Math.sin(t * 1.3);
    nod = s > 0.6 ? (s - 0.6) * 2.2 : 0;
    lidDrop = Math.max(lidDrop, 0.6 + nod * 0.4);
  }
  lidDrop = Math.max(lidDrop, blink);
  for (const l of lids) {
    l.scale.y = lerp(0.3, 1.6, lidDrop);
    l.position.y = 0.16 - lidDrop * 0.09;
  }
  for (const b of bags) {
    b.scale.set(1.2 + tired * 0.6, 0.35 + tired * 0.5, 0.4);
    b.material.color.set(0x8a6a6a).lerp(tmpC.set(0x4a2a4a), tired);
  }
  torso.rotation.x = tired * 0.25 + nod * 0.35;
  headG.rotation.x = tired * 0.25 + nod * 0.5;
  headG.rotation.z = t >= 48 && t < 60 ? Math.sin(t * 0.9) * 0.12 : 0;

  // sleeper
  for (const l of sleeperLids) l.visible = t >= 70;
  for (const z of zs) {
    const d = (t - 70.5 - z.d) % 3.6;
    z.s.visible = t >= 70.5 && t - 70.5 >= z.d && d >= 0;
    const k = d / 3.6;
    z.s.position.set(4.8 + k * 1.2, 2.6 + k * 2.4, -4.2 + k * 0.6);
    const sc = 0.35 + k * 0.5;
    z.s.scale.set(sc, sc, sc);
    z.s.material.opacity = Math.sin(k * Math.PI);
  }
  if (t >= 70) {
    // sunrise through the window
    const k = smooth(70, 76, t);
    windowLight.intensity = lerp(0.6, 1.8, k);
    windowLight.color.set(0xffc890);
    ambient.intensity = lerp(0.35, 0.7, k);
  }

  // hallucinations (day 3)
  const hal = smooth(24, 25.5, t) * (1 - smooth(35, 35.8, t));
  for (const v of visions) {
    v.m.visible = hal > 0.01;
    if (!v.m.visible) continue;
    const a = v.a + t * v.sp;
    v.m.position.set(
      Math.cos(a) * v.r - 0.5,
      v.y + Math.sin(t * 1.3 + v.ph) * 0.6,
      Math.sin(a) * v.r * 0.6 - 2,
    );
    v.m.rotation.set(t * v.sp * 2, t * v.sp * 3, 0);
    v.m.material.opacity = hal * (0.55 + 0.45 * Math.sin(t * 2 + v.ph));
  }
  for (const s of shadows) {
    const d = t - s.on;
    s.m.visible = hal > 0 && d > 0 && d < 1.6;
    s.m.material.opacity = Math.sin(clamp(d / 1.6) * Math.PI) * 0.9;
  }
  // walls: hue drift while hallucinating, grey gloom later
  wallMat.color.copy(WALL);
  if (hal > 0) wallMat.color.offsetHSL(Math.sin(t * 0.8) * 0.15 * hal, 0.25 * hal, 0);
  const gloom = smooth(48, 52, t) * (t < 70 ? 1 : 0);
  wallMat.color.lerp(WALL_GLOOM, gloom);
  lamp.intensity *= 1 - 0.5 * gloom * (Math.sin(t * 17) > 0.7 ? 1 : 0.3);

  // camera
  let pos, look;
  if (t < 5) {
    const k = t / 5;
    pos = V(lerp(1.5, 2.2, k), lerp(5.8, 5.4, k), lerp(5.5, 4.2, k));
    look = V(4.3, 1.8, -4.0);
  } else if (t >= 70) {
    const k = smooth(70, 80, t);
    pos = V(lerp(1.8, 2.4, k), lerp(5.2, 4.6, k), lerp(4.0, 3.0, k));
    look = V(4.4, 1.9, -4.2);
  } else {
    const k = ((t - 5) % 12) / 12;
    const close = t >= 48 ? smooth(48, 60, t) : 0;
    pos = V(
      lerp(1.4, 0.4, k) - close,
      lerp(4.6, 4.4, k) - close * 0.6,
      lerp(7.5, 6.8, k) - close * 2.8,
    );
    look = V(-2.4, 3.6 - close * 0.4, -3.6);
  }
  cam.position.copy(pos);
  cam.up.set(0, 1, 0);
  if (hal > 0) cam.up.set(Math.sin(t * 1.1) * 0.08 * hal, 1, 0).normalize();
  cam.lookAt(look);
  renderer.render(room, cam);
}

// =====================================================================
// ROAD (microsleep at the wheel)
// =====================================================================
const road = new THREE.Scene();
road.background = C("#05070e");
road.fog = new THREE.Fog(0x05070e, 20, 140);
road.add(new THREE.AmbientLight(0x6070a0, 0.35));
const dashes = [];
const poles = [];
const car = new THREE.Group();
const truck = new THREE.Group();
{
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(10, 400), std(0x2a2c32));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.z = -150;
  road.add(asphalt);
  const verge = new THREE.Mesh(new THREE.PlaneGeometry(200, 400), std(0x1a2418));
  verge.rotation.x = -Math.PI / 2;
  verge.position.set(0, -0.02, -150);
  road.add(verge);
  for (const x of [-4.8, 4.8]) {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 400),
      new THREE.MeshBasicMaterial({ color: 0xd8d4c4 }),
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.02, -150);
    road.add(edge);
  }
  for (let i = 0; i < 40; i++) {
    const d = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 2.4),
      new THREE.MeshBasicMaterial({ color: 0xd8d4c4 }),
    );
    d.rotation.x = -Math.PI / 2;
    road.add(d);
    dashes.push(d);
  }
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7, 6), std(0x5a5e66));
    p.position.y = 3.5;
    const l = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffc070 }),
    );
    l.position.set(-1, 7, 0);
    const pl = new THREE.PointLight(0xffb060, 12, 16, 1.4);
    pl.position.set(-1, 6.8, 0);
    g.add(p, l, pl);
    road.add(g);
    poles.push(g);
  }
  const red = std(0xa82a2a, { roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 4.2), red);
  body.position.y = 0.7;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.7, 2.2),
    std(0x1a2230, { roughness: 0.2 }),
  );
  cabin.position.set(0, 1.45, 0.2);
  car.add(body, cabin);
  for (const s of [-1, 1]) {
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    tl.position.set(s * 0.65, 0.9, 2.12);
    car.add(tl);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2c0,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      }),
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.set(s * 0.6, 0.7, -9);
    car.add(beam);
  }
  const head = new THREE.SpotLight(0xfff2d0, 40, 60, 0.45, 0.5, 1.2);
  head.position.set(0, 1, -2);
  head.target.position.set(0, 0, -30);
  car.add(head, head.target);
  road.add(car);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 9), std(0xe8e8e4));
  tb.position.y = 2.1;
  const tc = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2), std(0x2a5a9a));
  tc.position.set(0, 1.7, 5.4);
  truck.add(tb, tc);
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    hl.position.set(s * 0.8, 1.0, 6.45);
    truck.add(hl);
  }
  road.add(truck);
}
function carX(t) {
  let x = 2.4;
  x += 0.35 * Math.sin(Math.PI * clamp((t - 38.4) / 0.9));
  x += 0.6 * Math.sin(Math.PI * clamp((t - 40.6) / 1.2));
  // the long one: drifting toward the oncoming lane... then a jerk back
  x -= 2.6 * smooth(43.3, 44.8, t) * (1 - smooth(44.85, 45.25, t));
  return x;
}
function renderRoad(t) {
  const speed = 26;
  const s = t * speed;
  dashes.forEach((d, i) => {
    const z = -((i * 8 - (s % 8) + 320) % 320) + 10;
    d.position.set(0, 0.02, z);
  });
  poles.forEach((p, i) => {
    const z = -((i * 28 - (s % 28) + 392) % 392) + 12;
    p.position.set(-5.8, 0, z);
  });
  const x = carX(t);
  car.position.set(x, 0, 0);
  car.rotation.y = (carX(t + 0.1) - x) * -0.8;
  // oncoming truck passes during the long drift
  const tz = lerp(-160, 20, clamp((t - 43.2) / 2.2));
  truck.visible = t > 43.2 && t < 45.5;
  truck.position.set(-2.4, 0, tz);
  const shake = smooth(44.8, 45, t) * (1 - smooth(45.2, 46, t)) * 0.15;
  cam.position.set(x * 0.6 + 0.4 + Math.sin(t * 60) * shake, 3.6, 9.5);
  cam.up.set(0, 1, 0);
  cam.lookAt(x * 0.5, 1.4, -14);
  renderer.render(road, cam);
}

// =====================================================================
// HEART MONITOR
// =====================================================================
const monitor = new THREE.Scene();
monitor.background = C("#020806");
const ecgN = 2400;
const ecgPos = new Float32Array(ecgN * 3);
const ecgGeo = new THREE.BufferGeometry();
ecgGeo.setAttribute("position", new THREE.BufferAttribute(ecgPos, 3));
const ecg = new THREE.Points(
  ecgGeo,
  new THREE.PointsMaterial({ color: 0x4aff8a, size: 6, sizeAttenuation: false }),
);
ecg.frustumCulled = false;
monitor.add(ecg);
{
  const grid = new THREE.GridHelper(20, 40, 0x0f3a22, 0x0a2416);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -0.1;
  monitor.add(grid);
}
function beat(p) {
  // one heartbeat shape on [0,1)
  if (p < 0.1) return 0.15 * Math.sin((p / 0.1) * Math.PI);
  if (p < 0.16) return 0;
  if (p < 0.19) return -0.3 * ((p - 0.16) / 0.03);
  if (p < 0.23) return lerp(-0.3, 2.2, (p - 0.19) / 0.04);
  if (p < 0.27) return lerp(2.2, -0.6, (p - 0.23) / 0.04);
  if (p < 0.3) return lerp(-0.6, 0, (p - 0.27) / 0.03);
  if (p < 0.5) return 0.35 * Math.sin(((p - 0.3) / 0.2) * Math.PI);
  return 0;
}
function renderMonitor(t) {
  const bpm = lerp(120, 150, smooth(60, 70, t));
  const span = 4; // seconds shown across the screen
  for (let i = 0; i < ecgN; i++) {
    const u = i / (ecgN - 1);
    const tt = t - span * (1 - u);
    const ph = (tt * bpm) / 60;
    const irregular = tt > 65 ? 0.08 * Math.sin(tt * 7.3) : 0;
    const y = beat((ph + irregular) % 1);
    ecgPos[i * 3] = lerp(-4.2, 4.2, u);
    ecgPos[i * 3 + 1] = 2.2 + y * 0.9;
    ecgPos[i * 3 + 2] = 0;
  }
  ecgGeo.attributes.position.needsUpdate = true;
  cam.position.set(0, 1.2, 13);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 1.2, 0);
  renderer.render(monitor, cam);
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudLabel = document.getElementById("hud-label");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function renderHud(t) {
  hudLabel.textContent = "STUNDEN WACH";
  let sub2 = " ";
  if (t < 60) {
    const h = hoursAwake(t);
    hudValue.textContent = fmt(Math.floor(h));
    hudSub.textContent = "TAG " + (Math.floor(h / 24) + 1);
    if (t >= 8 && t < 24) sub2 = "REAKTION WIE MIT 1 ‰";
    else if (t >= 24 && t < 36) sub2 = "HALLUZINATIONEN";
    else if (t >= 36 && t < 48) sub2 = "SEKUNDENSCHLAF";
    else if (t >= 48) sub2 = "IMMUNSYSTEM GESCHWÄCHT";
  } else if (t < 70) {
    hudValue.textContent = "264";
    hudSub.textContent = "WELTREKORD: 11 TAGE";
    sub2 = "1 JAHR = 8.760 STUNDEN";
  } else {
    hudValue.textContent = "0";
    hudSub.textContent = "ENDLICH SCHLAF";
  }
  hudSub2.textContent = sub2;
  let op = 1;
  if (t < 4.8) op = 0;
  else if (t < 5.3) op = (t - 4.8) / 0.5;
  else if (t > 74.0) op = clamp((74.5 - t) / 0.5);
  hud.style.opacity = op;
}

// ---------- frame ----------
function renderAt(t) {
  if (t >= 36 && t < 48) renderRoad(t);
  else if (t >= 60 && t < 70) renderMonitor(t);
  else renderRoom(t);
  renderHud(t);
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.world = Promise.resolve();
