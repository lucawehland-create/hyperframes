// "Was wäre, wenn Dinosaurier heute in Deutschland leben würden?"
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
const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(c));
function ellipsoid(rx, ry, rz, c, seg = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.max(6, seg - 2)), std(c));
  m.scale.set(rx, ry, rz);
  return m;
}
function cone(r, h, c, seg = 8) {
  return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), std(c));
}
function cyl(r0, r1, h, c, seg = 8) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), std(c));
}

// ---------- renderer & scene ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd8e8f2, 70, 320);
const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 3000);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-60, 90, 60);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a5a30, 1.1));
{
  const skyGeo = new THREE.SphereGeometry(1200, 32, 20);
  skyGeo.translate(1000, 0, 0);
  const p = skyGeo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const top = new THREE.Color("#4f8fd6"),
    bot = new THREE.Color("#dcecf6"),
    c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(bot).lerp(top, Math.pow(clamp(p.getY(i) / 600 + 0.05), 0.6));
    col.set([c.r, c.g, c.b], i * 3);
  }
  skyGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  scene.add(
    new THREE.Mesh(
      skyGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
    ),
  );
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 3000), std(0x6a9a4e));
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = 1000;
  scene.add(ground);
}

// ---------- creatures ----------
function makeTRex() {
  const g = new THREE.Group();
  const skin = 0x5a6e3a,
    belly = 0x8a8a5a;
  const body = ellipsoid(3.2, 1.8, 1.5, skin);
  body.position.y = 4.4;
  const bellyM = ellipsoid(2.6, 1.3, 1.3, belly);
  bellyM.position.set(0.4, 3.9, 0);
  const tail = cone(1.3, 6.5, skin);
  tail.rotation.z = Math.PI / 2 + 0.12;
  tail.position.set(-5.6, 4.6, 0);
  const neck = ellipsoid(1.0, 1.1, 0.9, skin);
  neck.position.set(2.9, 5.4, 0);
  const head = new THREE.Group();
  const skull = box(2.6, 1.3, 1.3, skin);
  skull.position.set(1.0, 0.25, 0);
  const jaw = box(2.3, 0.45, 1.1, belly);
  jaw.position.set(0.9, -0.55, 0);
  for (const s of [-1, 1]) {
    const eye = ellipsoid(0.12, 0.12, 0.05, 0xffd040);
    eye.position.set(0.6, 0.55, s * 0.66);
    head.add(eye);
  }
  head.add(skull, jaw);
  head.position.set(3.6, 6.1, 0);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    const thigh = cyl(0.75, 0.5, 2.6, skin);
    thigh.position.y = -1.3;
    const shin = cyl(0.45, 0.35, 2.2, skin);
    shin.position.set(0.3, -3.2, 0);
    const foot = box(1.4, 0.35, 0.8, skin);
    foot.position.set(0.7, -4.3, 0);
    leg.add(thigh, shin, foot);
    leg.position.set(0.2, 4.3, s * 0.95);
    g.add(leg);
    legs.push(leg);
    const arm = cyl(0.15, 0.12, 0.9, skin);
    arm.position.set(2.4, 4.0, s * 0.8);
    arm.rotation.z = 0.8;
    g.add(arm);
  }
  g.add(body, bellyM, tail, neck, head);
  return { g, head, jaw, legs };
}
function makeBrachio() {
  const g = new THREE.Group();
  const skin = 0x7a8a6a;
  const body = ellipsoid(5, 3.2, 2.6, skin);
  body.position.y = 7.5;
  const neck = cyl(0.8, 1.4, 9, skin);
  neck.position.set(4.2, 12.5, 0);
  neck.rotation.z = -0.35;
  const head = ellipsoid(1.1, 0.7, 0.6, skin);
  head.position.set(6.0, 17.0, 0);
  const tail = cone(1.2, 9, skin);
  tail.rotation.z = Math.PI / 2 + 0.15;
  tail.position.set(-8.5, 7.0, 0);
  g.add(body, neck, head, tail);
  const legs = [];
  for (const [x, z] of [
    [2.8, 1.6],
    [2.8, -1.6],
    [-2.6, 1.6],
    [-2.6, -1.6],
  ]) {
    const leg = new THREE.Group();
    const l = cyl(0.8, 0.7, 6, skin);
    l.position.y = -3;
    leg.add(l);
    leg.position.set(x, 6, z);
    g.add(leg);
    legs.push(leg);
  }
  return { g, legs, head };
}
function makePtero() {
  const g = new THREE.Group();
  const skin = 0x8a5a3a;
  const body = ellipsoid(0.9, 0.35, 0.35, skin);
  const head = cone(0.25, 1.6, 0xb8a080, 6);
  head.rotation.z = -Math.PI / 2;
  head.position.set(1.4, 0.1, 0);
  const crest = cone(0.15, 1.0, 0xc84a2a, 4);
  crest.rotation.z = Math.PI / 2 + 0.6;
  crest.position.set(0.5, 0.45, 0);
  g.add(body, head, crest);
  const wings = [];
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.6, 3.5);
    shape.lineTo(-0.9, 1.0);
    shape.lineTo(0, 0);
    const w = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({ color: 0xa86a4a, side: THREE.DoubleSide }),
    );
    w.rotation.x = (s * Math.PI) / 2;
    const pivot = new THREE.Group();
    pivot.add(w);
    pivot.position.set(0.2, 0.1, s * 0.25);
    g.add(pivot);
    wings.push({ pivot, s });
  }
  return { g, wings };
}
function makeTrike() {
  const g = new THREE.Group();
  const skin = 0x8a6a4a;
  const body = ellipsoid(3.2, 1.7, 1.7, skin);
  body.position.y = 2.5;
  const tail = cone(0.8, 3.5, skin);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-4.4, 2.3, 0);
  const head = new THREE.Group();
  const skull = ellipsoid(1.3, 0.9, 0.9, skin);
  const frill = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 12),
    std(0xb87a4a, { side: THREE.DoubleSide }),
  );
  frill.rotation.y = Math.PI / 2;
  frill.position.set(-0.6, 0.6, 0);
  const beak = cone(0.4, 0.9, 0x4a3a2a, 6);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(1.4, -0.2, 0);
  const nose = cone(0.15, 0.6, 0xf0e8d0, 6);
  nose.position.set(1.0, 0.6, 0);
  head.add(skull, frill, beak, nose);
  for (const s of [-1, 1]) {
    const horn = cone(0.16, 1.9, 0xf0e8d0, 6);
    horn.rotation.z = -1.0;
    horn.position.set(0.9, 1.0, s * 0.5);
    head.add(horn);
  }
  head.position.set(3.6, 2.4, 0);
  g.add(body, tail, head);
  for (const [x, z] of [
    [1.8, 1.1],
    [1.8, -1.1],
    [-1.8, 1.1],
    [-1.8, -1.1],
  ]) {
    const l = cyl(0.5, 0.45, 1.8, skin);
    l.position.set(x, 0.9, z);
    g.add(l);
  }
  return { g, head };
}
function makeRaptor() {
  const g = new THREE.Group();
  const fe = 0x9a5a2a,
    fe2 = 0xd8a060;
  const body = ellipsoid(0.32, 0.2, 0.17, fe);
  body.position.y = 0.48;
  const tail = cone(0.12, 0.75, fe);
  tail.rotation.z = Math.PI / 2 + 0.15;
  tail.position.set(-0.6, 0.52, 0);
  const fan = ellipsoid(0.32, 0.05, 0.14, fe2);
  fan.position.set(-0.85, 0.55, 0);
  const neck = cyl(0.06, 0.08, 0.3, fe2);
  neck.position.set(0.3, 0.65, 0);
  neck.rotation.z = -0.7;
  const head = ellipsoid(0.13, 0.08, 0.07, fe2);
  head.position.set(0.45, 0.78, 0);
  const snout = cone(0.05, 0.16, 0x3a2a1a, 6);
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(0.6, 0.76, 0);
  g.add(body, tail, fan, neck, head, snout);
  for (const s of [-1, 1]) {
    const wing = ellipsoid(0.2, 0.04, 0.08, fe2);
    wing.position.set(0.12, 0.45, s * 0.17);
    wing.rotation.z = 0.5;
    const leg = cyl(0.03, 0.025, 0.36, 0x6a4a2a, 5);
    leg.position.set(0, 0.18, s * 0.08);
    g.add(wing, leg);
  }
  return { g, head };
}
function makeBlackbird() {
  const g = new THREE.Group();
  const body = ellipsoid(0.13, 0.08, 0.07, 0x111114, 14);
  body.position.y = 0.1;
  const head = ellipsoid(0.055, 0.055, 0.05, 0x111114, 12);
  head.position.set(0.11, 0.17, 0);
  const beak = cone(0.017, 0.07, 0xf0a020, 8);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.18, 0.165, 0);
  const tail = ellipsoid(0.1, 0.012, 0.035, 0x111114);
  tail.position.set(-0.17, 0.12, 0);
  tail.rotation.z = 0.3;
  g.add(body, head, beak, tail);
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.005, 6, 12), std(0xf0a020));
    ring.position.set(0.14, 0.185, s * 0.045);
    const eye = ellipsoid(0.009, 0.009, 0.004, 0x000000);
    eye.position.set(0.14, 0.185, s * 0.048);
    const leg = cyl(0.006, 0.006, 0.08, 0x3a2a1a, 4);
    leg.position.set(0, 0.02, s * 0.025);
    g.add(ring, eye, leg);
  }
  return g;
}
const SKIN = [0xf1c7a5, 0xd9a07a, 0x8d5a3b, 0xe8b894];
const CLOTH = [0x3d6fd9, 0xd94a3a, 0x2fa38a, 0xe8c547, 0x6a4c93, 0xe07a2f];
function makePerson(rnd) {
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
  return g;
}
function makeCar(c) {
  const g = new THREE.Group();
  const b = box(4, 1, 1.9, c);
  b.position.y = 0.7;
  const top = box(2.2, 0.8, 1.7, c);
  top.position.set(-0.2, 1.55, 0);
  g.add(b, top);
  return g;
}
function makeCow(rnd) {
  const g = new THREE.Group();
  const b = box(2.2, 1.1, 1.0, 0xf2f2ee);
  b.position.y = 1.2;
  const spot = box(0.8, 0.6, 1.02, 0x1a1a1a);
  spot.position.set(-0.3 + rnd() * 0.6, 1.4, 0);
  const h = box(0.6, 0.6, 0.6, 0xf2f2ee);
  h.position.set(1.3, 1.5, 0);
  g.add(b, spot, h);
  for (const [x, z] of [
    [0.8, 0.35],
    [0.8, -0.35],
    [-0.8, 0.35],
    [-0.8, -0.35],
  ]) {
    const l = box(0.2, 0.7, 0.2, 0xf2f2ee);
    l.position.set(x, 0.35, z);
    g.add(l);
  }
  return g;
}

// ---------- BERLIN (x = 0) ----------
const rex = makeTRex();
scene.add(rex.g);
{
  const sandstone = 0xd8c8a0;
  const pave = box(80, 0.1, 60, 0xb8b0a0);
  pave.position.set(0, 0.05, 0);
  scene.add(pave);
  for (let i = 0; i < 6; i++) {
    const col = cyl(0.7, 0.8, 14, sandstone, 12);
    col.position.set(-12.5 + i * 5, 7, -12);
    scene.add(col);
  }
  const beam = box(30, 2.2, 4, sandstone);
  beam.position.set(0, 15.1, -12);
  const attic = box(16, 3, 3.6, sandstone);
  attic.position.set(0, 17.7, -12);
  const quad = box(4.5, 2.2, 2.2, 0x4a7a6a);
  quad.position.set(0, 20.3, -12);
  const plinth = box(32, 1, 4.4, sandstone);
  plinth.position.set(0, 0.5, -12);
  scene.add(beam, attic, quad, plinth);
  for (const s of [-1, 1]) {
    const wing = box(6, 10, 6, sandstone);
    wing.position.set(s * 19, 5, -12);
    scene.add(wing);
  }
  const rnd = mulberry32(3);
  for (let i = 0; i < 10; i++) {
    const p = makePerson(rnd);
    p.position.set(-14 + rnd() * 30, 0, 8 + rnd() * 6);
    p.rotation.y = rnd() * 6;
    scene.add(p);
  }
}

// ---------- AUTOBAHN (x = 400) ----------
const AB = 400;
const brachio = makeBrachio();
scene.add(brachio.g);
{
  const road = box(500, 0.1, 18, 0x3a3c42);
  road.position.set(AB, 0.06, 0);
  scene.add(road);
  for (let i = -30; i <= 30; i++) {
    const d = box(3, 0.02, 0.25, 0xe8e4d8);
    d.position.set(AB + i * 8, 0.12, 0);
    scene.add(d);
  }
  for (const z of [-9.5, 9.5]) {
    const rail = box(500, 0.4, 0.15, 0xb8bcc4);
    rail.position.set(AB, 0.8, z);
    scene.add(rail);
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3),
    new THREE.MeshBasicMaterial({
      map: (() => {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 256;
        const g = c.getContext("2d");
        g.fillStyle = "#1f5aa8";
        g.fillRect(0, 0, 512, 256);
        g.fillStyle = "#fff";
        g.font = "bold 140px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("A7", 256, 132);
        const tx = new THREE.CanvasTexture(c);
        tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })(),
    }),
  );
  sign.position.set(AB - 14, 6.5, -11);
  const post = cyl(0.12, 0.12, 5, 0x9aa0aa);
  post.position.set(AB - 14, 2.5, -11.1);
  scene.add(sign, post);
  const cols = [0xd94a3a, 0x3d6fd9, 0xe8c547, 0xeeeeee, 0x333a44, 0x2fa38a];
  for (let i = 0; i < 18; i++) {
    const c = makeCar(cols[i % cols.length]);
    const lane = i % 4;
    c.position.set(
      AB - 60 + Math.floor(i / 4) * 6 + (lane % 2) * 2 + (lane < 2 ? -20 : 25),
      0,
      [-6.5, -2.5, 2.5, 6.5][lane],
    );
    c.rotation.y = lane < 2 ? 0 : Math.PI;
    if (Math.abs(c.position.x - AB) < 8) c.position.x += 16;
    scene.add(c);
  }
}

// ---------- RHEIN (x = 800) ----------
const RH = 800;
const pteros = [];
{
  const river = box(600, 0.1, 40, 0x3d7fa8);
  river.position.set(RH, 0.1, -10);
  scene.add(river);
  for (const [x, z, r, h] of [
    [-40, -60, 40, 30],
    [20, -70, 50, 36],
    [70, -55, 35, 26],
    [-30, 40, 40, 24],
    [40, 45, 45, 28],
  ]) {
    const hill = cone(r, h, 0x4a7a3a, 10);
    hill.position.set(RH + x, h / 2 - 2, z);
    scene.add(hill);
  }
  // a castle on the hill
  const cx = RH + 18,
    cz = -48,
    cy = 26;
  const keep = box(8, 10, 8, 0xc8b898);
  keep.position.set(cx, cy, cz);
  scene.add(keep);
  for (const [dx, dz] of [
    [-5, -5],
    [5, -5],
    [-5, 5],
    [5, 5],
  ]) {
    const tw = cyl(1.6, 1.6, 13, 0xc8b898, 10);
    tw.position.set(cx + dx, cy + 1.5, cz + dz);
    const roof = cone(2.1, 3.2, 0x5a3a3a, 10);
    roof.position.set(cx + dx, cy + 9.6, cz + dz);
    scene.add(tw, roof);
  }
  const ship = box(14, 1.6, 3.2, 0xf2f2ee);
  ship.position.set(RH - 10, 0.9, -6);
  scene.add(ship);
  const rnd = mulberry32(51);
  for (let i = 0; i < 6; i++) {
    const p = makePtero();
    p.g.scale.setScalar(1.6);
    scene.add(p.g);
    pteros.push({
      ...p,
      r: 14 + rnd() * 18,
      y: 14 + rnd() * 16,
      a: rnd() * 6.28,
      sp: 0.18 + rnd() * 0.15,
      z0: -20 + rnd() * 20,
    });
  }
}

// ---------- FARM (x = 1200) ----------
const FA = 1200;
const trike = makeTrike();
scene.add(trike.g);
const cows = [];
{
  const barn = box(10, 6, 8, 0xa83a2a);
  barn.position.set(FA - 16, 3, -26);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 6, 4, 4), std(0x5a3a32));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.2, 1, 0.95);
  roof.position.set(FA - 16, 8, -26);
  scene.add(barn, roof);
  for (let i = -6; i <= 6; i++) {
    const post = box(0.2, 1.2, 0.2, 0x8a6a4a);
    post.position.set(FA + i * 3, 0.6, 6);
    scene.add(post);
  }
  const rail = box(38, 0.12, 0.12, 0x8a6a4a);
  rail.position.set(FA, 1.0, 6);
  scene.add(rail);
  const rnd = mulberry32(61);
  for (let i = 0; i < 5; i++) {
    const c = makeCow(rnd);
    c.position.set(FA - 12 + i * 4 + rnd() * 2, 0, -10 - rnd() * 8);
    c.rotation.y = rnd() * 6;
    scene.add(c);
    cows.push(c);
  }
}

// ---------- PARK (x = 1600) ----------
const PK = 1600;
const raptor = makeRaptor();
scene.add(raptor.g);
const pigeons = [];
{
  const rnd = mulberry32(71);
  const p = makePerson(rnd);
  p.position.set(PK - 1.2, 0, -0.4);
  p.rotation.y = 0.6;
  scene.add(p);
  const path = box(30, 0.04, 2.5, 0xc8b898);
  path.position.set(PK, 0.03, 0.8);
  scene.add(path);
  const bench = box(2.2, 0.12, 0.6, 0x8a6a4a);
  bench.position.set(PK + 2.8, 0.5, -1.6);
  scene.add(bench);
  for (let i = 0; i < 8; i++) {
    const tr = new THREE.Group();
    const trunk = cyl(0.25, 0.35, 3, 0x5a3d2b);
    trunk.position.y = 1.5;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), std(0x3f7a3a));
    crown.position.y = 4.5;
    tr.add(trunk, crown);
    tr.position.set(PK - 14 + i * 4, 0, -7 - rnd() * 5);
    scene.add(tr);
  }
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const body = ellipsoid(0.14, 0.09, 0.08, 0x8a8f99);
    body.position.y = 0.1;
    const head = ellipsoid(0.06, 0.06, 0.05, 0x5a6070);
    head.position.set(0.12, 0.18, 0);
    b.add(body, head);
    b.position.set(PK + 1.5 + rnd() * 2.5, 0, 0.6 + rnd() * 1.4);
    b.rotation.y = rnd() * 6;
    scene.add(b);
    pigeons.push({ b, seed: rnd() * 10, x0: b.position.x, z0: b.position.z });
  }
}

// ---------- GARDEN (x = 2000) ----------
const GA = 2000;
const amsel = makeBlackbird();
amsel.position.set(GA, 1.2, 0);
amsel.rotation.y = 0.4;
scene.add(amsel);
{
  const post = box(0.14, 1.2, 0.14, 0x8a6a4a);
  post.position.set(GA, 0.6, 0);
  scene.add(post);
  const rail = box(8, 0.08, 0.08, 0x8a6a4a);
  rail.position.set(GA, 1.0, 0);
  scene.add(rail);
  const hedge = box(20, 2, 1.4, 0x3a6a2e);
  hedge.position.set(GA, 1, -3);
  scene.add(hedge);
  const rnd = mulberry32(81);
  for (let i = 0; i < 14; i++) {
    const f = ellipsoid(0.06, 0.06, 0.06, [0xe85a8a, 0xf0d040, 0xffffff][i % 3], 6);
    f.position.set(GA - 2 + rnd() * 4, 0.25 + rnd() * 0.2, 0.6 + rnd() * 1.5);
    scene.add(f);
  }
  const house = box(10, 7, 8, 0xe8dcc8);
  house.position.set(GA + 6, 3.5, -12);
  scene.add(house);
}

// ---------- animation per frame ----------
function renderAt(t) {
  // T-Rex strides past the gate, stops, roars
  const walk = clamp(t / 10);
  rex.g.position.set(lerp(-16, 2, walk), 0, -2);
  rex.g.rotation.y = 0.15;
  const stride = t < 10 ? Math.sin(t * 4) : 0;
  rex.legs[0].rotation.z = stride * 0.35;
  rex.legs[1].rotation.z = -stride * 0.35;
  rex.g.position.y = Math.abs(stride) * 0.15;
  const roar =
    t < 2.2
      ? Math.sin(clamp(t / 2.2) * Math.PI)
      : t > 10.5 && t < 13
        ? Math.sin(clamp((t - 10.5) / 2.5) * Math.PI)
        : 0;
  rex.jaw.rotation.z = -roar * 0.55;
  rex.head.rotation.z = roar * 0.25;

  // Brachiosaurus crossing the Autobahn
  const bk = clamp((t - 14) / 10);
  brachio.g.position.set(AB, 0, lerp(-22, 8, bk));
  brachio.g.rotation.y = -Math.PI / 2;
  brachio.legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 2 + (i % 2) * Math.PI) * 0.15));

  // Pterosaurs over the Rhine
  for (const p of pteros) {
    const a = p.a + t * p.sp;
    p.g.position.set(
      RH + Math.cos(a) * p.r,
      p.y + Math.sin(t * 0.7 + p.a) * 2,
      p.z0 + Math.sin(a) * p.r * 0.5,
    );
    p.g.rotation.set(0, -a - Math.PI / 2, Math.sin(a) * 0.2);
    for (const w of p.wings) w.pivot.rotation.x = w.s * Math.sin(t * 5 + p.a) * 0.45;
  }

  // Triceratops grazing
  trike.g.position.set(FA + 2, 0, -5);
  trike.g.rotation.y = 0.6;
  trike.head.rotation.z = -0.35 + Math.sin(t * 1.3) * 0.25;

  // Raptor in the park, bobbing next to a person, pigeons scatter
  const rk = clamp((t - 48) / 12);
  raptor.g.position.set(PK + lerp(-0.4, 1.4, rk), 0, 0.4);
  raptor.g.rotation.y = -0.4;
  raptor.head.position.y = 0.78 + Math.abs(Math.sin(t * 6)) * 0.03;
  for (const pg of pigeons) {
    const f = smooth(53, 55, t);
    pg.b.position.set(pg.x0 + f * 2, f * (2 + pg.seed * 0.3), pg.z0 - f * 1.5);
  }

  // Blackbird hops
  amsel.position.y = 1.2 + Math.max(0, Math.sin(t * 3)) * 0.05;
  amsel.rotation.y = 0.4 + Math.sin(t * 0.8) * 0.3;

  // camera
  let pos, look;
  if (t < 14) {
    const k = smooth(0, 14, t);
    pos = V(lerp(10, 6, k), lerp(3, 4, k), lerp(34, 28, k));
    look = V(lerp(-4, 2, k), 8, -6);
  } else if (t < 24) {
    const k = smooth(14, 24, t);
    pos = V(AB + lerp(26, 20, k), 5, lerp(34, 30, k));
    look = V(AB, 9, 0);
  } else if (t < 36) {
    const k = smooth(24, 36, t);
    pos = V(RH + lerp(-12, -4, k), 9, lerp(44, 38, k));
    look = V(RH + 4, 18, -18);
  } else if (t < 48) {
    const k = smooth(36, 48, t);
    pos = V(FA + lerp(14, 10, k), 3.5, lerp(20, 15, k));
    look = V(FA + 1, 2.5, -6);
  } else if (t < 60) {
    const k = smooth(48, 60, t);
    pos = V(PK + lerp(0.2, 0.8, k), 1.4, lerp(5.6, 4.6, k));
    look = V(PK + 0.2, 0.9, 0);
  } else {
    const k = smooth(62, 80, t);
    pos = V(GA + lerp(0.25, 0.9, k), lerp(1.32, 1.6, k), lerp(0.75, 2.6, k));
    look = V(GA + 0.02, lerp(1.28, 1.3, k), 0);
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  renderer.render(scene, cam);
  renderHud(t);
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
const INFO = [
  [0, "T-Rex", "12 M LANG · 8 TONNEN", "BERLIN"],
  [14, "Brachiosaurus", "13 M HOCH · ÜBER 30 TONNEN", "AUTOBAHN A7"],
  [24, "Pteranodon", "SPANNWEITE BIS 7 M", "RHEINTAL · EIN FLUGSAURIER"],
  [36, "Triceratops", "9 M LANG · 3 HÖRNER", "BAUERNHOF"],
  [48, "Velociraptor", "SO GROSS WIE EIN TRUTHAHN", "STADTPARK"],
  [60, "Amsel", "?", "DEIN GARTEN"],
  [64.8, "Amsel", "AUCH EIN DINOSAURIER", "DEIN GARTEN"],
];
function renderHud(t) {
  let I = INFO[0];
  for (const i of INFO) if (t >= i[0]) I = i;
  hudValue.textContent = I[1];
  hudSub.textContent = I[2];
  hudSub2.textContent = I[3];
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
