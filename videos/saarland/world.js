// "Was wäre, wenn alle Menschen der Welt nach Deutschland ziehen?"
import {
  THREE,
  W,
  H,
  mulberry32,
  clamp,
  lerp,
  smooth,
  V,
  std,
  box,
  fmt,
  makeRenderer,
  skyDome,
  textSprite,
  makePerson,
  setHud,
  register,
} from "./lib.js";

const renderer = makeRenderer();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd6e8f2, 120, 600);
const cam = new THREE.PerspectiveCamera(45, W / H, 0.05, 3000);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(-40, 100, 60);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a5a30, 1.1));
skyDome(scene, "#4f8fd6", "#dcecf6", { radius: 1400, center: [100, 0, 0] });
{
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), std(0x5a8ab0));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.6;
  scene.add(sea);
}

// ---------- the map ----------
const P = (lon, lat) => new THREE.Vector2((lon - 10.4) * 6.3, -(lat - 51.1) * 10);
const DE = [
  [6.1, 50.8],
  [5.9, 51.8],
  [7.0, 52.2],
  [7.0, 53.3],
  [8.6, 53.9],
  [9.0, 54.8],
  [10.0, 54.9],
  [11.1, 54.0],
  [12.5, 54.5],
  [14.2, 53.9],
  [14.4, 53.3],
  [14.6, 52.5],
  [14.8, 51.0],
  [14.0, 50.9],
  [12.3, 50.2],
  [12.6, 49.6],
  [13.8, 48.8],
  [13.0, 47.6],
  [10.5, 47.5],
  [9.6, 47.6],
  [7.6, 47.6],
  [7.5, 48.1],
  [8.2, 49.0],
  [6.4, 49.4],
  [6.3, 50.1],
].map(([a, b]) => P(a, b));
const SL = [
  [6.36, 49.47],
  [6.6, 49.64],
  [7.0, 49.64],
  [7.4, 49.55],
  [7.3, 49.15],
  [6.8, 49.15],
  [6.36, 49.3],
].map(([a, b]) => P(a, b));
function slab(pts, depth, color, y) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, std(color));
  m.position.y = y;
  scene.add(m);
  return m;
}
slab(DE, 0.6, 0x6a9a4e, -0.6);
const saar = slab(SL, 0.8, 0xffd27a, -0.6);
saar.material.emissive = new THREE.Color(0x8a5a10);
const saarLabel = textSprite("SAARLAND", "#ffd27a", 9, 2.25);
const slCenter = P(6.88, 49.4);
saarLabel.position.set(slCenter.x, 6, slCenter.y - 6);
scene.add(saarLabel);
function inside(pts, x, z) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    if (a.y > z !== b.y > z && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function sampleIn(pts, rnd) {
  let minX = 1e9,
    maxX = -1e9,
    minZ = 1e9,
    maxZ = -1e9;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.y);
    maxZ = Math.max(maxZ, p.y);
  }
  for (;;) {
    const x = lerp(minX, maxX, rnd()),
      z = lerp(minZ, maxZ, rnd());
    if (inside(pts, x, z)) return [x, z];
  }
}

// people as dots on the map
const dotN = 7000;
const dots = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.22, 6, 4),
  new THREE.MeshBasicMaterial({ color: 0xffffff }),
  dotN,
);
scene.add(dots);
const dotFrom = [],
  dotTo = [];
{
  const rnd = mulberry32(7);
  const cols = [0xff5a5a, 0xffd25a, 0x5ad8ff, 0x9aff6a, 0xff7ad8, 0xffffff];
  for (let i = 0; i < dotN; i++) {
    dotFrom.push(sampleIn(DE, rnd));
    dotTo.push(sampleIn(SL, rnd));
    dots.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  }
}
// a city that covers the whole country
const bN = 1400;
const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std(0xd8d4cc), bN);
scene.add(blocks);
const bData = [];
{
  const rnd = mulberry32(17);
  for (let i = 0; i < bN; i++) {
    const [x, z] = sampleIn(DE, rnd);
    bData.push({ x, z, h: 1 + rnd() * rnd() * 7, w: 0.8 + rnd() * 0.8, d: rnd() });
  }
}

// ---------- a street that fills up (x = 300) ----------
const ST = 300;
const crowd = [];
{
  const rnd = mulberry32(31);
  const road = box(60, 0.1, 14, 0x9a968e);
  road.position.set(ST, 0.05, 0);
  scene.add(road);
  for (const side of [-1, 1])
    for (let i = 0; i < 8; i++) {
      const h = 8 + rnd() * 10;
      const b = box(6.5, h, 6, [0xe9e1d0, 0xc9a98a, 0xd7c6a5, 0xa8b6c4][i % 4]);
      b.position.set(ST - 24 + i * 7, h / 2, side * 10.5);
      scene.add(b);
    }
  for (let i = 0; i < 420; i++) {
    const p = makePerson(rnd);
    p.position.set(ST - 26 + rnd() * 52, 0, -6.5 + rnd() * 13);
    p.rotation.y = rnd() * 6.28;
    scene.add(p);
    crowd.push({ p, order: rnd() });
  }
}

// ---------- one square metre (x = 600) ----------
const SQ = 600;
{
  const floor = box(12, 0.1, 12, 0xc8c0b0);
  floor.position.set(SQ, 0.05, 0);
  scene.add(floor);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (const [x, z, w, d] of [
    [0, -0.5, 1.04, 0.04],
    [0, 0.5, 1.04, 0.04],
    [-0.5, 0, 0.04, 1.04],
    [0.5, 0, 0.04, 1.04],
  ]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat);
    l.position.set(SQ + x, 0.12, z);
    scene.add(l);
  }
  const rnd = mulberry32(41);
  for (const [x, z] of [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25],
  ]) {
    const p = makePerson(rnd, 0.95);
    p.position.set(SQ + x, 0.1, z);
    p.rotation.y = rnd() * 0.6 - 0.3;
    scene.add(p);
  }
  const lab = textSprite("1 m²", "#ffd27a", 1.6, 0.4);
  lab.position.set(SQ + 0.9, 0.35, 0.75);
  scene.add(lab);
}

const dummy = new THREE.Object3D();
const POP0 = 84e6,
  POP1 = 8.2e9;
function popAt(t) {
  if (t < 9.6) return POP0;
  return Math.exp(lerp(Math.log(POP0), Math.log(POP1), smooth(9.6, 14, t)));
}
function renderAt(t) {
  // dots on the map
  const frac = Math.sqrt(popAt(t) / POP1);
  const shown = t >= 60 ? dotN : Math.floor(dotN * clamp(frac));
  const toSaar = smooth(62, 69, t);
  for (let i = 0; i < dotN; i++) {
    const [fx, fz] = dotFrom[i],
      [tx, tz] = dotTo[i];
    const k = clamp(toSaar * 1.25 - (i / dotN) * 0.25);
    dummy.position.set(lerp(fx, tx, k), 0.25 + Math.sin(k * Math.PI) * 6, lerp(fz, tz, k));
    const s = i < shown ? (t >= 60 ? lerp(1, 0.45, k) : 1) : 0.0001;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    dots.setMatrixAt(i, dummy.matrix);
  }
  dots.instanceMatrix.needsUpdate = true;
  dots.visible = t < 36 || t >= 60;
  // the country-wide city
  const grow = smooth(36.2, 44, t);
  blocks.visible = t >= 36 && t < 48;
  bData.forEach((b, i) => {
    const k = clamp(grow * 1.4 - b.d * 0.4);
    dummy.position.set(b.x, (b.h * k) / 2, b.z);
    dummy.scale.set(b.w, Math.max(b.h * k, 0.001), b.w);
    dummy.updateMatrix();
    blocks.setMatrixAt(i, dummy.matrix);
  });
  blocks.instanceMatrix.needsUpdate = true;
  saar.material.emissiveIntensity = t >= 60 ? 0.6 + 0.4 * Math.sin(t * 4) : 0;
  saarLabel.visible = t >= 64;
  // the street fills up
  const dens = t < 24 ? lerp(0.03, 0.35, smooth(14, 24, t)) : lerp(0.35, 1, smooth(24, 34, t));
  for (const c of crowd) {
    c.p.visible = c.order < dens;
    c.p.rotation.z = Math.sin(t * 2 + c.order * 30) * 0.03;
  }

  let pos, look;
  if (t < 14) {
    const k = smooth(0, 14, t);
    pos = V(lerp(4, 0, k), lerp(110, 95, k), lerp(55, 45, k));
    look = V(-2, 0, 0);
  } else if (t < 36) {
    const k = smooth(14, 36, t);
    pos = V(ST + lerp(-24, -18, k), lerp(4, 7, k), lerp(8, 4, k));
    look = V(ST + 6, 1.5, 0);
  } else if (t < 48) {
    const k = smooth(36, 48, t);
    pos = V(lerp(10, 0, k), lerp(60, 75, k), lerp(70, 60, k));
    look = V(0, 0, -2);
  } else if (t < 60) {
    const k = smooth(48, 60, t);
    pos = V(SQ + lerp(2.2, 1.8, k), lerp(3.2, 2.6, k), lerp(4.2, 3.4, k));
    look = V(SQ, 0.8, 0);
  } else {
    const k = smooth(64, 72, t);
    pos = V(lerp(0, slCenter.x, k), lerp(95, 34, k), lerp(45, slCenter.y + 26, k));
    look = V(lerp(-2, slCenter.x, k), 0, lerp(0, slCenter.y, k));
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  renderer.render(scene, cam);

  // HUD
  if (t < 36) {
    const p = popAt(t);
    setHud(
      t,
      "MENSCHEN IN DEUTSCHLAND",
      fmt(p),
      "PRO KM²: " + fmt(p / 357600),
      t >= 14 ? "FLÄCHE: 357.600 KM²" : " ",
    );
  } else if (t < 48) setHud(t, "PLATZ PRO PERSON", "44 m²", "8,2 MRD. MENSCHEN AUF 357.600 KM²");
  else if (t < 60) setHud(t, "PLATZ PRO PERSON (STEHEND)", "0,25 m²", "4 MENSCHEN PRO M²");
  else setHud(t, "FLÄCHE FÜR ALLE MENSCHEN", "≈ 2.050 km²", "SAARLAND: 2.570 KM²");
}
register(renderAt);
