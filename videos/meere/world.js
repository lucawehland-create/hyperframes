// "Was wäre, wenn alle Meere plötzlich verschwinden?"
// One ocean cross-section along x: coast and shelf (North Sea) -> abyssal plain (Titanic)
// -> Mid-Atlantic Ridge -> Mariana Trench. 1 unit up = 100 m depth.
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
scene.fog = new THREE.Fog(0xcfe2ee, 200, 900);
const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 5000);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-60, 120, 80);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x6a5a40, 1.1));
const sky = skyDome(scene, "#4f8fd6", "#e6eef2", { radius: 2500 });

// ---------- sea floor ----------
const rndN = mulberry32(3);
const noiseT = Array.from({ length: 512 }, () => rndN());
const nz = (x, z) => {
  const i = Math.floor(x * 0.37 + 1000) * 31 + Math.floor(z * 0.41 + 1000) * 17;
  return noiseT[Math.abs(i) % 512] - 0.5;
};
function depthAt(x, z) {
  // metres (negative = below sea level)
  let d;
  if (x < -170) d = lerp(30, 250, smooth(-170, -210, x));
  else if (x < -112) d = -95 + Math.sin(x * 0.3 + z * 0.1) * 12;
  else if (x < -82) d = lerp(-95, -4000, smooth(-112, -82, x));
  else if (x < -30) d = -4000 + Math.sin(z * 0.08 + x * 0.2) * 150;
  else if (x < 30) {
    const k = 1 - Math.abs(x) / 30;
    d = -4000 + 1700 * Math.pow(k, 0.8) - (Math.abs(x) < 3 ? 600 : 0);
  } else if (x < 88) d = -4500 + Math.sin(z * 0.07) * 200;
  else if (x < 105) d = lerp(-4500, -10900, smooth(88, 105, x));
  else if (x < 118) d = lerp(-10900, -6000, smooth(105, 118, x));
  else d = lerp(-6000, 300, smooth(118, 150, x));
  return d + nz(x, z) * (d < -200 ? 220 : 20);
}
{
  const geo = new THREE.PlaneGeometry(380, 300, 190, 120);
  geo.rotateX(-Math.PI / 2);
  geo.translate(-30, 0, 0);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    const d = depthAt(x, z);
    p.setY(i, d / 100);
    if (d > 0) c.set(0x6a8a4a).lerp(new THREE.Color(0x8a7a5a), clamp(d / 250));
    else if (d > -200) c.set(0xd8c8a0);
    else c.set(0x8a7f70).lerp(new THREE.Color(0x4a4650), clamp(-d / 11000));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, std(0xffffff, { vertexColors: true })));
}
// water
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  std(0x2a6aa0, { transparent: true, opacity: 0.82, roughness: 0.3 }),
);
water.rotation.x = -Math.PI / 2;
scene.add(water);

// ---------- things on the sea floor ----------
function hull(len, color) {
  const g = new THREE.Group();
  const h = box(len, 0.9, 1.4, color);
  h.position.y = 0.45;
  const bow = cone(0.7, 1.6, color, 4);
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.x = Math.PI / 4;
  bow.position.set(len / 2 + 0.75, 0.45, 0);
  g.add(h, bow);
  return g;
}
// a sailing ship that floats, then lies on the shelf
const ship = hull(6, 0x6a4a2a);
{
  const mast = cyl(0.08, 0.08, 5, 0x4a3a2a);
  mast.position.set(0, 3, 0);
  const sail = box(0.06, 3, 2.4, 0xf2ece0);
  sail.position.set(0.1, 3.2, 0);
  ship.add(mast, sail);
  ship.scale.setScalar(0.8);
  scene.add(ship);
}
// wrecks
const wrecks = [];
{
  const rnd = mulberry32(13);
  for (let i = 0; i < 9; i++) {
    const x = -165 + rnd() * 140,
      z = -60 + rnd() * 120;
    const w = hull(3 + rnd() * 4, [0x5a4030, 0x6a5a50, 0x4a4a4a][i % 3]);
    w.position.set(x, depthAt(x, z) / 100 - 0.2, z);
    w.rotation.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.6);
    scene.add(w);
    wrecks.push(w);
  }
}
// Titanic: two broken halves
const TI = V(-56, -38, 8);
{
  const mk = (len, dx, rot) => {
    const g = new THREE.Group();
    const h = box(len, 1.6, 2.2, 0x222222);
    h.position.y = 0.8;
    const top = box(len * 0.9, 0.5, 2, 0xf0ece0);
    top.position.y = 1.85;
    const red = box(len, 0.35, 2.25, 0x8a2a20);
    red.position.y = 0.17;
    g.add(h, top, red);
    g.position.set(TI.x + dx, depthAt(TI.x + dx, TI.z) / 100 - 0.3, TI.z);
    g.rotation.set(0, rot, 0.06);
    scene.add(g);
    return g;
  };
  const a = mk(10, -6, 0.2);
  mk(7, 6, -0.5);
  for (let i = 0; i < 3; i++) {
    const f = cyl(0.45, 0.45, 1.8, 0xc8a050, 10);
    f.position.set(-3 + i * 2.5, 2.9, 0);
    f.rotation.z = 0.25;
    a.add(f);
  }
}
const tiLabel = textSprite("TITANIC", "#ffd27a", 10, 2.5);
tiLabel.position.set(TI.x, TI.y + 9, TI.z);
scene.add(tiLabel);
// North Sea walk: London <-> Hamburg on the shelf
const lon = textSprite("LONDON", "#ffffff", 12, 3);
lon.position.set(-140, 6, -70);
const ham = textSprite("HAMBURG", "#ffffff", 9, 2.25);
ham.position.set(-150, 3, 72);
scene.add(lon, ham);
const pathDots = [];
for (let i = 0; i < 40; i++) {
  const d = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd27a }),
  );
  const z = lerp(68, -68, i / 39);
  d.position.set(-140, depthAt(-140, z) / 100 + 0.4, z);
  scene.add(d);
  pathDots.push(d);
}
const walker = makePerson(mulberry32(3), 2.2);
scene.add(walker);
// ridge labels / everest
const ridgeLabel = textSprite("RÜCKEN", "#ffd27a", 20, 5);
ridgeLabel.position.set(0, -12, 20);
scene.add(ridgeLabel);
const everest = new THREE.Group();
{
  const rock = cone(14, 88.5, 0x7a7068, 7);
  rock.position.y = 44.25;
  const snow = cone(4.4, 14, 0xf4f4f4, 7);
  snow.position.y = 88.5 - 7 + 0.05;
  everest.add(rock, snow);
  everest.position.set(103, -109, 18);
  scene.add(everest);
}
const evLabel = textSprite("EVEREST", "#ffffff", 20, 5);
scene.add(evLabel);
const gapLabel = textSprite("+ 2 KM", "#ffd27a", 12, 3);
scene.add(gapLabel);
const surfLine = box(60, 0.25, 0.25, 0xffd27a);
surfLine.position.set(103, 0, 18);
scene.add(surfLine);

// ---------- story ----------
function levelAt(t) {
  // metres
  if (t < 5.4) return 0;
  if (t < 24) return lerp(0, -140, smooth(5.4, 22, t));
  if (t < 36) return lerp(-140, -4300, smooth(24.3, 32, t));
  if (t < 48) return lerp(-4300, -5600, smooth(36.3, 46, t));
  if (t < 60) return lerp(-5600, -10300, smooth(48.3, 58, t));
  return lerp(-10300, -11100, smooth(60, 64, t));
}
const TABLE = [
  [0, 100],
  [100, 97.4],
  [200, 95],
  [1000, 73],
  [2000, 48],
  [3000, 26],
  [4000, 12],
  [5000, 3],
  [6000, 0.4],
  [11000, 0],
];
function remaining(m) {
  const d = -m;
  for (let i = 1; i < TABLE.length; i++)
    if (d <= TABLE[i][0]) {
      const [d0, p0] = TABLE[i - 1],
        [d1, p1] = TABLE[i];
      return lerp(p0, p1, (d - d0) / (d1 - d0));
    }
  return 0;
}

function renderAt(t) {
  const lv = levelAt(t);
  const wy = lv / 100;
  water.position.y = wy;
  water.visible = lv > -11000;
  // the ship floats until it touches the shelf
  const sx = -150,
    sz = 12;
  const floor = depthAt(sx, sz) / 100;
  ship.position.set(sx, Math.max(wy, floor) - 0.2, sz);
  ship.rotation.set(0, 0.7, wy <= floor ? 0.35 : Math.sin(t * 1.4) * 0.05);
  // walker crosses the dry North Sea
  const wk = smooth(19.2, 24, t);
  const wz = lerp(66, -66, wk);
  walker.position.set(-140, depthAt(-140, wz) / 100, wz);
  walker.rotation.y = Math.PI;
  walker.visible = t >= 19 && t < 24.3;
  pathDots.forEach((d, i) => (d.visible = t >= 19 && t < 24.3 && i / 39 <= wk + 0.02));
  lon.visible = ham.visible = t >= 18 && t < 24.3;
  tiLabel.visible = t >= 30.5 && t < 36.3;
  ridgeLabel.visible = t >= 41.8 && t < 48.3;
  const ev = smooth(65, 67, t);
  everest.visible = evLabel.visible = t >= 64.8;
  everest.scale.set(1, Math.max(ev, 0.001), 1);
  evLabel.position.set(103, -109 + 22 * ev, 30);
  surfLine.visible = gapLabel.visible = false;
  gapLabel.position.set(103, -10, 18);

  let pos, look;
  if (t < 14) {
    const k = smooth(0, 14, t);
    pos = V(lerp(-200, -196, k), lerp(14, 16, k), lerp(55, 45, k));
    look = V(-150, lerp(0, -0.5, k), 10);
  } else if (t < 24.3) {
    const k = smooth(14, 24.3, t);
    pos = V(lerp(-160, -158, k), lerp(16, 22, k), lerp(105, 100, k));
    look = V(-140, -2, lerp(20, 0, k));
  } else if (t < 36.3) {
    const k = smooth(24.3, 36.3, t);
    pos = V(lerp(-100, -80, k), Math.max(lerp(4, -26, k), wy + 6), lerp(50, 34, k));
    look = V(lerp(-80, TI.x, k), lerp(-10, TI.y + 2, k), TI.z);
  } else if (t < 48.3) {
    const k = smooth(36.3, 48.3, t);
    pos = V(lerp(-55, -45, k), lerp(-5, 8, k), lerp(75, 90, k));
    look = V(0, -26, 10);
  } else if (t < 60.3) {
    const k = smooth(48.3, 60.3, t);
    pos = V(103, Math.max(lerp(-25, -55, k), wy + 8), lerp(150, 125, k));
    look = V(103, lerp(-70, -100, k), 20);
  } else if (t < 70.3) {
    const k = smooth(60.3, 70.3, t);
    pos = V(103, lerp(-60, -50, k), lerp(125, 135, k));
    look = V(103, lerp(-75, -50, k), 18);
  } else {
    const k = smooth(70.3, 80, t);
    pos = V(lerp(103, 60, k), lerp(-50, 150, k), lerp(135, 330, k));
    look = V(lerp(103, 0, k), lerp(-50, -40, k), lerp(18, 0, k));
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  sky.position.copy(cam.position);
  renderer.render(scene, cam);

  // HUD
  const pct = remaining(lv);
  const pctS =
    pct >= 10
      ? Math.round(pct) + " %"
      : pct > 0.05
        ? pct.toFixed(1).replace(".", ",") + " %"
        : "0 %";
  const depthS = "MEERESSPIEGEL: " + (lv === 0 ? "0" : "−" + fmt(-lv)) + " M";
  let sub2 = " ";
  if (t >= 14.3 && t < 24.3) sub2 = "NORDSEE: Ø 95 M TIEF";
  else if (t >= 29.8 && t < 36.3) sub2 = "TITANIC: 3.800 M TIEF";
  else if (t >= 41.8 && t < 48.3) sub2 = "RÜCKEN: 16.000 KM LANG";
  else if (t >= 53.8 && t < 65) sub2 = "MARIANENGRABEN: ≈ 11.000 M";
  else if (t >= 65) sub2 = "EVEREST: 8.849 M";
  setHud(t, "WASSER IN DEN MEEREN", pctS, depthS, sub2);
}
register(renderAt);
