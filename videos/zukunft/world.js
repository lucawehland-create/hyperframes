// "Was wäre, wenn du 100 Jahre in die Zukunft springst?" — one street, 2026 to 2126.
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
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpC = new THREE.Color();
const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

// how far the city has turned into the future
const future = (t) => (t < 5 ? 0 : smooth(6, 13.4, t));

// ---------- renderer & scene ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const fog = new THREE.Fog(0xcfe3f2, 80, 420);
scene.fog = fog;
const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 1500);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a4030, 0.9);
scene.add(hemi);
const skyGeo = new THREE.SphereGeometry(900, 32, 20);
const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
scene.add(
  new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  ),
);
const skyTop = new THREE.Color(),
  skyBot = new THREE.Color();
let lastSky = "";
function paintSky() {
  const key = skyTop.getHexString() + skyBot.getHexString();
  if (key === lastSky) return;
  lastSky = key;
  const p = skyGeo.attributes.position;
  for (let j = 0; j < p.count; j++) {
    const k = Math.pow(clamp(p.getY(j) / 450 + 0.04), 0.6);
    tmpC.copy(skyBot).lerp(skyTop, k);
    skyCol.set([tmpC.r, tmpC.g, tmpC.b], j * 3);
  }
  skyGeo.attributes.color.needsUpdate = true;
}
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(28, 32),
  new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }),
);
scene.add(sunDisc);

// ---------- ground & street ----------
const groundMat = std(0x6a7a5e);
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), groundMat);
  g.rotation.x = -Math.PI / 2;
  scene.add(g);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(300, 8), std(0x3a3c42));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, 0);
  scene.add(road);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), std(0xb8b0a0));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.03, 8.5);
  scene.add(plaza);
}

// ---------- the city: old blocks that grow green, new towers that rise ----------
const windowTex = canvasTex(256, 512, (g) => {
  const rnd = mulberry32(3);
  g.fillStyle = "#d4d8de";
  g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 8; x++) {
      g.fillStyle = rnd() < 0.5 ? "#7f9cb8" : "#a8c4dc";
      g.fillRect(x * 32 + 5, y * 32 + 5, 22, 23);
    }
});
const oldMats = [];
const greenRoofs = [];
const solar = [];
const towers = [];
{
  const rnd = mulberry32(17);
  for (const side of [-1, 1])
    for (let x = -90; x <= 90; x += 11) {
      if (side > 0 && Math.abs(x) < 22) continue; // the plaza
      const w = 8 + rnd() * 2,
        h = 8 + rnd() * 18,
        d = 8;
      const tx = windowTex.clone();
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      tx.repeat.set(1, Math.max(1, Math.round(h / 10)));
      tx.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({ map: tx, color: 0xffffff, roughness: 0.9 });
      oldMats.push(mat);
      const z = side < 0 ? -10 - rnd() * 3 : 16 + rnd() * 3;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, h / 2, z);
      scene.add(b);
      // green roof with a few shrubs
      const roof = new THREE.Group();
      const lawn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.4, d * 0.95), std(0x5f9e45));
      roof.add(lawn);
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.8 + rnd() * 0.6, 0),
          std(0x3f7a3a),
        );
        s.position.set((rnd() - 0.5) * w * 0.7, 0.8, (rnd() - 0.5) * d * 0.7);
        roof.add(s);
      }
      roof.position.set(x, h + 0.2, z);
      scene.add(roof);
      greenRoofs.push({ g: roof, d: rnd() });
      // solar panels on the street-facing edge
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.8, 0.1, 2),
        std(0x1f3a6a, { metalness: 0.6, roughness: 0.3 }),
      );
      panel.position.set(x, h + 0.9, z + (side < 0 ? 2.8 : -2.8));
      panel.rotation.x = side < 0 ? 0.5 : -0.5;
      scene.add(panel);
      solar.push({ m: panel, d: rnd() });
    }
  // new towers rising behind the old blocks
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const h = 40 + rnd() * 50;
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(4 + rnd() * 2, 5 + rnd() * 2, h, 8),
      new THREE.MeshStandardMaterial({
        color: 0xa8d4e6,
        metalness: 0.5,
        roughness: 0.15,
        flatShading: true,
      }),
    );
    glass.position.y = h / 2;
    g.add(glass);
    for (let k = 1; k < h / 8; k++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.7, 6, 16), std(0x4f9a3e));
      band.rotation.x = Math.PI / 2;
      band.position.y = k * 8;
      g.add(band);
    }
    g.position.set(-80 + i * 20 + rnd() * 6, 0, -40 - rnd() * 40);
    scene.add(g);
    towers.push({ g, d: rnd() });
  }
}

// ---------- traffic: 2026 cars, 2126 pods ----------
const oldCars = [];
const pods = [];
{
  const rnd = mulberry32(41);
  const CAR = [0xd94a3a, 0x3d6fd9, 0xe8c547, 0xeeeeee, 0x333a44];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const col = CAR[i % CAR.length];
    const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1.9), std(col, { roughness: 0.5 }));
    b.position.y = 0.7;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.7), std(col, { roughness: 0.5 }));
    top.position.set(-0.2, 1.55, 0);
    g.add(b, top);
    scene.add(g);
    oldCars.push({ g, x0: -80 + i * 14 + rnd() * 4, lane: i % 2 ? 1.8 : -1.8, v: 6 + rnd() * 3 });
  }
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.9, 2.2, 4, 12),
      std(0xf2f2f2, { roughness: 0.3 }),
    );
    shell.rotation.z = Math.PI / 2;
    shell.position.y = 1.0;
    const glass = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.7, 1.2, 4, 10),
      std(0x2a4a6a, { roughness: 0.1, metalness: 0.4 }),
    );
    glass.rotation.z = Math.PI / 2;
    glass.position.set(0, 1.35, 0);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.08, 1.85),
      new THREE.MeshBasicMaterial({ color: 0x5ad8ff }),
    );
    strip.position.y = 0.7;
    g.add(shell, glass, strip);
    scene.add(g);
    pods.push({ g, x0: -80 + i * 17 + rnd() * 4, lane: i % 2 ? 1.8 : -1.8, v: 7 + rnd() * 2 });
  }
}
function updateTraffic(t) {
  const f = future(t);
  for (const c of oldCars) {
    c.g.visible = f < 0.5 && t < 14;
    const dir = c.lane > 0 ? -1 : 1;
    c.g.position.set(((c.x0 + dir * c.v * t + 100) % 200) - 100, 0, c.lane);
    c.g.rotation.y = dir > 0 ? 0 : Math.PI;
  }
  for (const p of pods) {
    p.g.visible = f >= 0.5 && t < 60;
    const dir = p.lane > 0 ? -1 : 1;
    p.g.position.set(((p.x0 + dir * p.v * t + 100) % 200) - 100, 0, p.lane);
    p.g.rotation.y = dir > 0 ? 0 : Math.PI;
  }
}

// ---------- delivery drones ----------
const drones = [];
{
  const rnd = mulberry32(61);
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.8), std(0x2a2a30));
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), std(0xc8a070));
    box.position.y = -0.4;
    g.add(body, box);
    for (const [dx, dz] of [
      [0.55, 0.55],
      [-0.55, 0.55],
      [0.55, -0.55],
      [-0.55, -0.55],
    ]) {
      const rotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.03, 12),
        new THREE.MeshBasicMaterial({ color: 0x8a8a90, transparent: true, opacity: 0.6 }),
      );
      rotor.position.set(dx, 0.12, dz);
      g.add(rotor);
    }
    scene.add(g);
    drones.push({
      g,
      a: rnd() * 6.28,
      r: 8 + rnd() * 18,
      y: 8 + rnd() * 12,
      sp: 0.15 + rnd() * 0.2,
      z0: -4 + rnd() * 14,
    });
  }
}
function updateDrones(t) {
  for (const d of drones) {
    d.g.visible = future(t) > 0.7 && t < 36;
    const a = d.a + t * d.sp;
    d.g.position.set(
      Math.cos(a) * d.r,
      d.y + Math.sin(t * 1.3 + d.a) * 0.6,
      d.z0 + Math.sin(a) * 6,
    );
    d.g.rotation.y = -a;
  }
}

// ---------- people (and robots) ----------
const SKIN = [0xf1c7a5, 0xd9a07a, 0x8d5a3b, 0xe8b894, 0x6b4430];
const CLOTH = [0x3d6fd9, 0xd94a3a, 0x2fa38a, 0xe8c547, 0x6a4c93, 0xe07a2f, 0xf0f0f0];
function makePerson(rnd, { gray = false, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.75, 3, 8),
    std(CLOTH[Math.floor(rnd() * CLOTH.length)]),
  );
  body.position.y = 0.9;
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 3, 8), std(0x2a2e3a));
  legs.position.y = 0.42;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    std(SKIN[Math.floor(rnd() * SKIN.length)]),
  );
  head.position.y = 1.65;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.4),
    std(gray ? 0xd8d8d8 : [0x2a1e14, 0x5a3a20, 0xc8a050][Math.floor(rnd() * 3)]),
  );
  hair.position.y = 1.68;
  g.add(legs, body, head, hair);
  g.scale.setScalar(scale);
  scene.add(g);
  return g;
}
function makeRobot() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.9, 0.5),
    std(0xeef0f4, { roughness: 0.3 }),
  );
  body.position.y = 1.0;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.42, 0.42),
    std(0xeef0f4, { roughness: 0.3 }),
  );
  head.position.y = 1.7;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.45, 0.28),
    new THREE.MeshBasicMaterial({ color: 0x0a1a2a }),
  );
  face.position.set(0, 1.7, 0.215);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 10),
      new THREE.MeshBasicMaterial({ color: 0x5ad8ff }),
    );
    eye.position.set(s * 0.1, 1.72, 0.22);
    g.add(eye);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.55, 12), std(0x9aa0aa));
  base.position.y = 0.28;
  g.add(body, head, face, base);
  scene.add(g);
  return g;
}
const crowd = [];
{
  const rnd = mulberry32(7);
  for (let i = 0; i < 26; i++) {
    const g = makePerson(rnd, { gray: rnd() < 0.35 });
    g.position.set(-14 + rnd() * 28, 0, 4.5 + rnd() * 7);
    g.rotation.y = rnd() * 6.28;
    crowd.push({ g, seed: rnd() * 10, x0: g.position.x, z0: g.position.z });
  }
  for (let i = 0; i < 4; i++) {
    const g = makeRobot();
    g.position.set(-10 + i * 7, 0, 6 + (i % 2) * 2);
    crowd.push({ g, seed: rnd() * 10, robot: true, x0: g.position.x, z0: g.position.z });
  }
}
// shade sails for the heat
const sails = [];
for (let i = 0; i < 3; i++) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    V(-6, 0, -3),
    V(6, 0.8, -2),
    V(0, -0.6, 4),
  ]);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: [0xf2ece0, 0xe8c547, 0xe07a2f][i],
      side: THREE.DoubleSide,
    }),
  );
  m.position.set(-12 + i * 12, 5.5, 8);
  scene.add(m);
  sails.push(m);
}
// the family at the end
const family = [];
{
  const rnd = mulberry32(88);
  const sizes = [1, 1, 0.95, 0.72, 0.6, 0.5];
  sizes.forEach((s, i) => {
    const g = makePerson(rnd, { scale: s });
    g.position.set(-2.5 + i * 1.0, 0, 6 + (i % 2) * 0.4);
    g.rotation.y = 0;
    family.push(g);
  });
}

// ---------- the coast at x = 600 ----------
const COAST = 600;
const seaGeo = new THREE.PlaneGeometry(400, 240, 60, 40);
seaGeo.rotateX(-Math.PI / 2);
const seaBase = Float32Array.from(seaGeo.attributes.position.array);
const sea = new THREE.Mesh(
  seaGeo,
  new THREE.MeshStandardMaterial({ color: 0x2f6f8a, roughness: 0.3, flatShading: true }),
);
sea.position.set(COAST, 0, -140);
scene.add(sea);
{
  // the dyke: a long sloped wall
  const shapePts = [
    new THREE.Vector2(-6, 0),
    new THREE.Vector2(6, 0),
    new THREE.Vector2(2, 6.5),
    new THREE.Vector2(-2, 6.5),
  ];
  const dyke = new THREE.Mesh(
    new THREE.ExtrudeGeometry(new THREE.Shape(shapePts), { depth: 300, bevelEnabled: false }),
    std(0x6f8a5a),
  );
  dyke.rotation.y = Math.PI / 2;
  dyke.position.set(COAST - 150, 0, -20);
  scene.add(dyke);
  const rnd = mulberry32(5);
  for (let i = 0; i < 12; i++) {
    const h = 3 + rnd() * 3;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(4, h, 4),
      std([0xe9e1d0, 0xc9a98a, 0xa8b6c4][i % 3]),
    );
    b.position.set(COAST - 30 + i * 5.5, h / 2, -6 + rnd() * 4);
    scene.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.6, 4), std(0x8b3a32));
    r.position.set(b.position.x, h + 0.8, b.position.z);
    r.rotation.y = Math.PI / 4;
    scene.add(r);
  }
  // an old lighthouse left outside the dyke, standing in water
  const lh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 12, 12), std(0xf2f2f2));
  lh.position.set(COAST + 18, 6, -45);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 1.6, 12), std(0xd62828));
  band.position.set(COAST + 18, 6, -45);
  scene.add(lh, band);
}
function updateSea(t) {
  const level = lerp(0.8, 3.6, smooth(24.5, 33, t));
  const a = seaGeo.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) {
    const x = seaBase[i],
      z = seaBase[i + 2];
    a[i + 1] = level + Math.sin(x * 0.12 + t * 1.6) * 0.35 + Math.cos(z * 0.15 - t * 1.2) * 0.3;
  }
  seaGeo.attributes.position.needsUpdate = true;
  seaGeo.computeVertexNormals();
}

// ---------- the museum at x = -600 ----------
const MUS = -600;
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std(0xd8d0c4));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(MUS, 0.05, 0);
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), std(0xf0ece4));
  wall.position.set(MUS, 5, -8);
  scene.add(wall);
  const ped = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), std(0xffffff));
  ped.position.set(MUS, 0.55, 0);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.9, 1.3),
    new THREE.MeshStandardMaterial({
      color: 0xcfe8ff,
      transparent: true,
      opacity: 0.25,
      roughness: 0.05,
    }),
  );
  glass.position.set(MUS, 1.55, 0);
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.66, 0.05),
    std(0x1a1a1e, { roughness: 0.2 }),
  );
  phone.position.set(MUS, 1.45, 0);
  phone.rotation.set(-0.25, 0.3, 0);
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.58),
    new THREE.MeshBasicMaterial({ color: 0x2a3a4a }),
  );
  scr.position.set(0, 0, 0.03);
  phone.add(scr);
  scene.add(ped, glass, phone);
  const label = (text, sub) =>
    canvasTex(1024, 300, (g, w, h) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#1a1a1a";
      g.font = "bold 92px sans-serif";
      g.fillText(text, 50, 130);
      g.font = "64px sans-serif";
      g.fillStyle = "#555";
      g.fillText(sub, 50, 230);
    });
  const l1 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.35),
    new THREE.MeshBasicMaterial({ map: label("SMARTPHONE", "um 2026") }),
  );
  l1.position.set(MUS, 0.9, 0.71);
  scene.add(l1);
  // the old car behind a rope
  const car = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1.9), std(0xb82a2a, { roughness: 0.3 }));
  b.position.y = 0.7;
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.8, 1.7),
    std(0xb82a2a, { roughness: 0.3 }),
  );
  top.position.set(-0.2, 1.55, 0);
  for (const [dx, dz] of [
    [1.3, 1],
    [-1.3, 1],
    [1.3, -1],
    [-1.3, -1],
  ]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 14), std(0x1a1a1a));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(dx, 0.38, dz);
    car.add(wheel);
  }
  car.add(b, top);
  car.position.set(MUS + 6, 0, -3);
  car.rotation.y = 0.5;
  scene.add(car);
  const l2 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.47),
    new THREE.MeshBasicMaterial({ map: label("VERBRENNER", "um 2026") }),
  );
  l2.position.set(MUS + 6, 0.9, -0.6);
  scene.add(l2);
  for (const x of [MUS + 3.6, MUS + 8.4]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 1, 8),
      std(0xc8a04a, { metalness: 0.6 }),
    );
    post.position.set(x, 0.5, -0.5);
    scene.add(post);
  }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.8, 6), std(0x8a1a1a));
  rope.rotation.z = Math.PI / 2;
  rope.position.set(MUS + 6, 0.85, -0.5);
  scene.add(rope);
  const rnd = mulberry32(19);
  for (let i = 0; i < 3; i++) {
    const g = makePerson(rnd, { gray: i === 1 });
    g.position.set(MUS + 3.5 + i * 2.4, 0, -6.5);
    g.rotation.y = -0.2;
  }
}

// ---------- looks per chapter ----------
function look(t) {
  // returns [skyTop, skyBottom, sunI, hemiI, sunPos, fogNear, fogFar]
  if (t < 5) return ["#5a96d8", "#d6e8f2", 2.4, 0.9, [-80, 120, -200], 90, 420];
  if (t < 14) {
    // the years race by: day and night flicker
    const ph = Math.sin((t - 5) * (2 + (t - 5) * 1.4)) * 0.5 + 0.5;
    const top = new THREE.Color("#070b1d").lerp(new THREE.Color("#5a96d8"), ph).getStyle();
    const bot = new THREE.Color("#1d2442").lerp(new THREE.Color("#d6e8f2"), ph).getStyle();
    return [top, bot, 0.4 + 2 * ph, 0.4 + 0.5 * ph, [-80, 120, -200], 90, 420];
  }
  if (t < 24) return ["#4f9ae0", "#e2f2f8", 2.6, 1.0, [60, 140, -200], 120, 520];
  if (t < 36) return ["#6a8aa8", "#c8d6de", 1.8, 1.0, [COAST - 60, 100, -200], 90, 480];
  if (t < 48) return ["#e0a060", "#fff0d0", 3.4, 1.0, [20, 160, -160], 50, 260];
  if (t < 60) return ["#4f9ae0", "#e2f2f8", 2.4, 1.0, [60, 140, -200], 120, 520];
  if (t < 70) return ["#f0ece4", "#f0ece4", 1.6, 1.2, [MUS - 20, 40, 40], 60, 300];
  return ["#3b3f7a", "#f0905a", 1.6, 0.8, [-60, 20, -200], 80, 420];
}

function renderAt(t) {
  const L = look(t);
  skyTop.set(L[0]);
  skyBot.set(L[1]);
  paintSky();
  fog.color.copy(skyBot);
  sun.intensity = L[2];
  hemi.intensity = L[3] * 1.35;
  sun.position.set(L[4][0], L[4][1], L[4][2]);
  sunDisc.position.set(L[4][0] * 2, L[4][1] * 1.5, L[4][2] * 2);
  sunDisc.lookAt(0, 0, 0);
  sunDisc.visible = t >= 36 && t < 48 ? true : t >= 70;
  sunDisc.scale.setScalar(t >= 36 && t < 48 ? 1.6 : 1);
  sunDisc.material.color.set(t >= 70 ? 0xffa060 : 0xfff6d8);
  fog.near = L[5];
  fog.far = L[6];

  const f = future(t);
  for (const m of oldMats) m.color.set(0xb8b8b8).lerp(tmpC.set(0xffffff), f);
  for (const r of greenRoofs) {
    const k = clamp(f * 1.6 - r.d * 0.6);
    r.g.scale.set(1, Math.max(k, 0.001), 1);
    r.g.visible = k > 0.01;
  }
  for (const s of solar) s.m.visible = f > s.d * 0.9 + 0.05;
  for (const tw of towers) {
    const k = clamp(f * 1.5 - tw.d * 0.5);
    tw.g.scale.set(1, Math.max(k, 0.001), 1);
    tw.g.visible = k > 0.01;
  }
  groundMat.color.set(0x6a7a5e).lerp(tmpC.set(0x5a9a48), f);
  updateTraffic(t);
  updateDrones(t);
  updateSea(t);
  const heat = t >= 36 && t < 48;
  for (const s of sails) s.visible = heat;
  for (const c of crowd) {
    c.g.visible = t >= 36 && t < 60 ? !c.robot || t >= 48 : false;
    const walk = Math.sin(t * 0.5 + c.seed) * 1.5;
    c.g.position.x = c.x0 + walk;
    c.g.position.z = heat ? lerp(c.z0, 8 + Math.sin(c.seed) * 2, 0.6) : c.z0;
  }
  for (const g of family) g.visible = t >= 70;

  let pos, lk;
  if (t < 5) {
    const k = t / 5;
    pos = V(lerp(-26, -22, k), 2.2, 6);
    lk = V(10, 6, -6);
  } else if (t < 14) {
    const k = smooth(5, 14, t);
    pos = V(lerp(-22, -6, k), lerp(3, 26, k), lerp(8, 46, k));
    lk = V(0, lerp(6, 14, k), -20);
  } else if (t < 24) {
    const k = smooth(14, 24, t);
    pos = V(lerp(-18, -8, k), lerp(6, 9, k), lerp(24, 18, k));
    lk = V(5, 13, -12);
  } else if (t < 36) {
    const k = smooth(24, 36, t);
    pos = V(COAST + lerp(-6, 2, k), 16, 34);
    lk = V(COAST + 4, 2, -40);
  } else if (t < 48) {
    const k = smooth(36, 48, t);
    pos = V(lerp(-12, -6, k), 3, 20);
    lk = V(0, 7, -2);
    pos.y += Math.sin(t * 9) * 0.03; // heat shimmer
  } else if (t < 60) {
    const k = smooth(48, 60, t);
    pos = V(lerp(-4, 4, k), 4.5, 24);
    lk = V(0, 2, 6);
  } else if (t < 70) {
    const k = smooth(64.5, 66.5, t);
    pos = V(MUS + lerp(0.6, 6, k), lerp(2.0, 2.8, k), lerp(3.2, 8.5, k));
    lk = V(MUS + lerp(0, 6, k), lerp(1.4, -0.4, k), lerp(0, -3, k));
  } else {
    const k = smooth(70, 80, t);
    pos = V(0, lerp(2.4, 2.8, k), lerp(14, 16, k));
    lk = V(0, lerp(1.5, 3, k), 5);
  }
  cam.position.copy(pos);
  cam.lookAt(lk);
  renderer.render(scene, cam);
  renderHud(t);
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
function renderHud(t) {
  const year =
    t < 5 ? 2026 : t < 14 ? Math.round(lerp(2026, 2126, Math.pow(smooth(5, 13.6, t), 1.3))) : 2126;
  hudValue.textContent = String(year);
  let sub = " ",
    sub2 = " ";
  if (t >= 5 && t < 14) sub = "+ " + (year - 2026) + " JAHRE";
  else if (t < 24 && t >= 14) sub = "WILLKOMMEN IN DER ZUKUNFT";
  else if (t >= 24 && t < 36) {
    sub = "MEERESSPIEGEL: BIS ZU + 1 M";
    sub2 = "PROGNOSE WELTKLIMARAT";
  } else if (t >= 36 && t < 48) {
    sub = "DEUTSCHLAND: + 2 BIS 4 °C";
    sub2 = "JE NACH KLIMASCHUTZ";
  } else if (t >= 48 && t < 60) {
    sub = "WELTBEVÖLKERUNG: ≈ 10 MRD.";
    sub2 = "PROGNOSE VEREINTE NATIONEN";
  } else if (t >= 60 && t < 70) sub = "TECHNIK VON 2026: IM MUSEUM";
  else if (t >= 70) sub = "4 GENERATIONEN SPÄTER";
  hudSub.textContent = sub;
  hudSub2.textContent = sub2;
  let op = 1;
  if (t < 4.8) op = 0;
  else if (t < 5.3) op = (t - 4.8) / 0.5;
  else if (t > 74.0) op = clamp((74.5 - t) / 0.5);
  hud.style.opacity = op;
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.world = Promise.resolve();
