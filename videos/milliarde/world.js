// "Was wäre, wenn du 1 Milliarde Euro ausgeben müsstest – mit 1.000 € am Tag?"
import {
  THREE,
  W,
  H,
  mulberry32,
  lerp,
  smooth,
  V,
  std,
  box,
  cone,
  cyl,
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
scene.fog = new THREE.Fog(0xe8d8c0, 60, 260);
const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 3000);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(-40, 80, 30);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x5a4a30, 1.1));
skyDome(scene, "#5a8fd0", "#f2e2c8", { radius: 1400, center: [0, 0, -150] });
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(400, 800), std(0x7a9a5a));
  g.rotation.x = -Math.PI / 2;
  g.position.z = -200;
  scene.add(g);
  // the timeline road into the past
  const road = box(6, 0.1, 340, 0xc8b898);
  road.position.set(0, 0.05, -150);
  scene.add(road);
}
// year signposts along the road
const YEARS = [2026, 1900, 1800, 1700, 1600, 1492, 1300, 1000, 800, 500, 200, 0, -300, -712];
const zOfYear = (y) => -((2026 - y) / 2738) * 300;
for (const y of YEARS) {
  const z = zOfYear(y);
  const post = cyl(0.08, 0.08, 2.2, 0x6a5a4a);
  post.position.set(-3.6, 1.1, z);
  scene.add(post);
  const s = textSprite(y < 0 ? -y + " v. Chr." : String(y), "#ffffff", 3.2, 0.8);
  s.position.set(-3.6, 2.7, z);
  scene.add(s);
}

// ---------- stations ----------
// 2026: modern city
{
  const rnd = mulberry32(3);
  for (let i = 0; i < 14; i++) {
    const h = 10 + rnd() * 30;
    const b = box(5, h, 5, [0x9aa8b8, 0xb8c4d0, 0x7f8c9c][i % 3]);
    const side = i % 2 ? 1 : -1;
    b.position.set(side * (13 + rnd() * 10), h / 2, 4 - Math.floor(i / 2) * 7);
    scene.add(b);
  }
}
// 1492: a caravel on the water
{
  const z = zOfYear(1492);
  const water = box(40, 0.1, 30, 0x3d7fa8);
  water.position.set(30, 0.08, z);
  scene.add(water);
  const ship = new THREE.Group();
  const hull = box(7, 1.6, 2.4, 0x6a4a2a);
  hull.position.y = 1;
  const deck = box(2.5, 1, 2.2, 0x7a5a3a);
  deck.position.set(-2.4, 2.2, 0);
  ship.add(hull, deck);
  for (const [x, h] of [
    [-1, 6],
    [1.5, 7],
  ]) {
    const mast = cyl(0.12, 0.12, h, 0x4a3a2a);
    mast.position.set(x, 1.6 + h / 2, 0);
    const sail = box(0.08, h * 0.55, 3.2, 0xf2ece0);
    sail.position.set(x + 0.1, 2.2 + h * 0.5, 0);
    ship.add(mast, sail);
  }
  ship.position.set(17, 0, z);
  ship.rotation.y = 0.6;
  scene.add(ship);
}
// 1000: a medieval castle
{
  const z = zOfYear(1000);
  const keep = box(8, 9, 8, 0xa8a090);
  keep.position.set(14, 4.5, z - 4);
  scene.add(keep);
  for (const [dx, dz] of [
    [-5, -5],
    [5, -5],
    [-5, 5],
    [5, 5],
  ]) {
    const tw = cyl(1.4, 1.4, 12, 0xa8a090, 10);
    tw.position.set(14 + dx, 6, z - 4 + dz);
    const roof = cone(1.9, 3, 0x6a3a2a, 10);
    roof.position.set(14 + dx, 13.5, z - 4 + dz);
    scene.add(tw, roof);
  }
}
// year 0: a Roman temple
{
  const z = zOfYear(0);
  const base = box(14, 1.2, 9, 0xe8e0d0);
  base.position.set(20, 0.6, z - 4);
  scene.add(base);
  for (let i = 0; i < 6; i++) {
    const col = cyl(0.45, 0.5, 7, 0xf2ece0, 12);
    col.position.set(15 + i * 2, 4.7, z - 0.5);
    scene.add(col);
  }
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 5, 2.4, 3), std(0xe8e0d0));
  roof.rotation.set(0, 0, Math.PI / 2);
  roof.rotation.y = Math.PI / 2;
  roof.scale.set(1.5, 1, 1);
  roof.position.set(20, 9.4, z - 4);
  const beam = box(13.5, 1, 8.5, 0xe8e0d0);
  beam.position.set(20, 8.6, z - 4);
  scene.add(beam, roof);
}
// 712 BC: huts on the hills of Rome
{
  const z = zOfYear(-712);
  const hill = cone(26, 8, 0x8a9a5a, 10);
  hill.position.set(16, 2, z - 10);
  scene.add(hill);
  const rnd = mulberry32(9);
  for (let i = 0; i < 7; i++) {
    const hut = new THREE.Group();
    const wall = cyl(1.4, 1.5, 1.8, 0x9a7a5a, 10);
    wall.position.y = 0.9;
    const roof = cone(1.9, 2, 0xc8a860, 10);
    roof.position.y = 2.8;
    hut.add(wall, roof);
    hut.position.set(8 + rnd() * 14, 0, z + 2 - rnd() * 8);
    scene.add(hut);
  }
}

// ---------- you, and a growing tower of money ----------
const you = makePerson(mulberry32(5), 1);
scene.add(you);
const billN = 900;
const bills = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.75, 0.12, 0.38),
  std(0x6aa86a),
  billN,
);
bills.frustumCulled = false;
scene.add(bills);
const dummy = new THREE.Object3D();

// ---------- story ----------
function startYear(t) {
  if (t < 14) return 2026;
  if (t < 24) return Math.round(lerp(2026, 1492, smooth(14, 23.5, t)));
  if (t < 36) return 1492;
  if (t < 48) return 1000;
  if (t < 60) return 0;
  return -712;
}
function spentAt(t) {
  if (t < 5) return 0;
  if (t < 9.6) return 1000 * Math.floor(1 + (t - 5) * 3);
  if (t < 14) return 365000 * lerp(1, 10, smooth(9.6, 13.5, t));
  if (t < 24) return 3650000;
  const years = 2026 - startYear(t) + (t >= 60 ? 0 : 0);
  const k = smooth(Math.floor((t - 24) / 12) * 12 + 24.3, Math.floor((t - 24) / 12) * 12 + 30, t);
  const amount = Math.min(1e9, years * 365250);
  return t >= 60 ? lerp(739.5e6, 1e9, k) : amount * k;
}

function renderAt(t) {
  const y = startYear(t);
  const z = t < 14 ? 4 : zOfYear(y);
  you.position.set(1.4, 0.1, z);
  you.rotation.y = 0.4;
  // money tower beside you: 1 bill per ~1.1 million, stacked in a column of 3x3
  const amount = spentAt(t);
  const n = Math.min(billN, Math.round((amount / 1e9) * billN));
  for (let i = 0; i < billN; i++) {
    const layer = Math.floor(i / 9),
      cell = i % 9;
    dummy.position.set(
      3.2 + ((cell % 3) - 1) * 0.8,
      0.1 + layer * 0.13,
      z + (Math.floor(cell / 3) - 1) * 0.42,
    );
    dummy.scale.setScalar(i < n ? 1 : 0.0001);
    dummy.updateMatrix();
    bills.setMatrixAt(i, dummy.matrix);
  }
  bills.instanceMatrix.needsUpdate = true;

  let pos, look;
  const towerTop = 0.1 + Math.ceil(n / 9) * 0.13;
  if (t < 14) {
    const k = smooth(0, 14, t);
    pos = V(lerp(-3, -2, k), lerp(3, 2.6, k), z + lerp(10, 7, k));
    look = V(2, 2, z - 4);
  } else if (t < 24) {
    // racing back along the road
    const k = smooth(14, 23.5, t);
    const zz = lerp(zOfYear(2026), zOfYear(1492), k);
    pos = V(-1, 4, zz + 10);
    look = V(0, 2, zz - 20);
  } else if (t < 70) {
    const k = ((t - 24) % 12) / 12;
    pos = V(lerp(-6, -4, k), lerp(4, Math.max(5, towerTop * 0.5 + 3), k), z + lerp(14, 11, k));
    look = V(6, lerp(3, Math.max(3, towerTop * 0.45), k), z - 3);
  } else {
    // pull back over the whole timeline
    const k = smooth(70, 80, t);
    pos = V(lerp(-10, -30, k), lerp(20, 70, k), lerp(zOfYear(-712) + 30, 80, k));
    look = V(0, 0, lerp(zOfYear(-712), -150, k));
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  renderer.render(scene, cam);

  // HUD
  const yr = y < 0 ? -y + " V. CHR." : String(y);
  if (t < 24) {
    const days = Math.round(amount / 1000);
    const sub =
      t < 9.6
        ? days + (days === 1 ? " TAG" : " TAGE")
        : t < 14
          ? Math.round(amount / 365000) + " JAHRE"
          : "START: JAHR " + yr;
    const pct = t >= 9.6 ? (amount / 1e7).toFixed(2).replace(".", ",") + " % VON 1 MRD." : "\u00a0";
    setHud(t, "AUSGEGEBEN", fmt(amount) + " €", sub, pct);
  } else if (t < 70) {
    setHud(
      t,
      "AUSGEGEBEN BIS HEUTE",
      fmt(amount) + " €",
      "START: JAHR " + yr,
      "NOCH OFFEN: " + fmt(Math.max(0, 1e9 - amount)) + " €",
    );
  } else {
    setHud(t, "DAUER FÜR 1 MILLIARDE", "2.738 Jahre", "MIT 1.000 € PRO TAG", " ");
  }
}
register(renderAt);
