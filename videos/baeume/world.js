// "Was wäre, wenn jeder Mensch auf der Welt einen Baum pflanzt?"
// 8.2 bn trees at ~1,000 per hectare ≈ 82,000 km² (Austria: 83,900 km²).
// ~10 kg CO2 per tree and year -> ~82 Mt/yr. Germany ~650 Mt GHG/yr (≈ 8×, so a cube with 2× the side),
// world ~37 Gt CO2/yr (≈ 450×, cube side ≈ 7.7×).
import {
  THREE,
  W,
  H,
  mulberry32,
  fmt,
  lerp,
  smooth,
  V,
  C,
  std,
  box,
  cyl,
  makeRenderer,
  skyDome,
  textSprite,
  makePerson,
  setHud,
  register,
} from "./lib.js";

const renderer = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 20000);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-60, 80, 50);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a5a30, 1.1);
scene.add(hemi);
const sky = skyDome(scene, "#4f8fd6", "#e2eef4", { radius: 6000 });
const dusk = skyDome(scene, "#3a3a6a", "#ffa060", { radius: 5990 });

// ================= field / forest at the origin =================
const world = new THREE.Group();
scene.add(world);
const groundMat = std(0x7a9a4e);
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
  g.rotation.x = -Math.PI / 2;
  world.add(g);
  // rows of soil in the field
  for (let i = -8; i <= 8; i++) {
    const r = box(140, 0.05, 1.2, 0x6a5a3a);
    r.position.set(0, 0.03, i * 8);
    world.add(r);
  }
}
const TN = 2600;
const trunks = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.12, 0.18, 1, 6),
  std(0x6a4a2a),
  TN,
);
const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), std(0xffffff), TN);
trunks.frustumCulled = crowns.frustumCulled = false;
world.add(trunks, crowns);
const tdata = [];
{
  const rnd = mulberry32(3);
  const cols = [0x2f6a34, 0x3a7a3a, 0x285a2e, 0x4a8a3e];
  for (let i = 0; i < TN; i++) {
    const x = -68 + (i % 52) * 2.65 + (rnd() - 0.5) * 1.2;
    const z = 66 - Math.floor(i / 52) * 2.65 + (rnd() - 0.5) * 1.2;
    tdata.push({ x, z, h: 9 + rnd() * 6, pop: Math.hypot(x, z) / 100 + rnd() * 0.25, r: rnd() });
    crowns.setColorAt(i, C(cols[i % cols.length]));
  }
}
// one hero tree breathing in CO2
const molN = 60;
const mols = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.9, 10, 8),
  std(0xd8d8e0, { emissive: 0x6a6a72 }),
  molN,
);
mols.frustumCulled = false;
world.add(mols);
const co2Label = textSprite("CO₂", "#ffffff", 6, 1.5);
world.add(co2Label);
// you, planting a tree at the end
const planter = makePerson(mulberry32(14), 1);
planter.position.set(-2, 0, 74);
planter.rotation.y = 0.6;
world.add(planter);
const sapling = new THREE.Group();
{
  const s = cyl(0.04, 0.05, 0.8, 0x6a4a2a, 5);
  s.position.y = 0.4;
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 7), std(0x4a9a3e));
  c.position.y = 1.0;
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 6), std(0x5a4a32));
  mound.scale.y = 0.25;
  sapling.add(s, c, mound);
  sapling.position.set(-1, 0, 75);
  world.add(sapling);
}
const shovel = new THREE.Group();
{
  const h = cyl(0.03, 0.03, 1.3, 0x8a6a4a, 5);
  h.position.y = 0.65;
  const b = box(0.28, 0.32, 0.03, 0x8a8a90);
  b.position.y = 0.05;
  shovel.add(h, b);
  shovel.position.set(-2.5, 0, 74.6);
  shovel.rotation.z = 0.25;
  world.add(shovel);
}

// ================= CO2 cubes (x = 160) =================
const CX = 160;
const cubeMat = (c, o) => std(c, { transparent: true, opacity: o, depthWrite: false });
const cubeForest = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cubeMat(0x4aca5a, 0.85));
const cubeDE = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cubeMat(0x8a8a92, 0.45));
const cubeWorld = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cubeMat(0x5a5a64, 0.4));
const edges = (m, c) => {
  const e = new THREE.LineSegments(
    new THREE.EdgesGeometry(m.geometry),
    new THREE.LineBasicMaterial({ color: c }),
  );
  m.add(e);
};
edges(cubeForest, 0x2a7a3a);
edges(cubeDE, 0xffffff);
edges(cubeWorld, 0xffffff);
world.add(cubeForest, cubeDE, cubeWorld);
const S1 = 12; // side of the forest's yearly CO2 cube
const lab = (t, c, w) => {
  const s = textSprite(t, c, w, w / 4);
  s.material.depthTest = false;
  world.add(s);
  return s;
};
const labForest = lab("WALD", "#7aff8a", 10);
const labDE = lab("DEUTSCHLAND", "#ffffff", 14);
const labWorld = lab("WELT", "#ffffff", 60);

// ================= map: Germany and Austria (x = -6000) =================
const map = new THREE.Group();
map.position.x = -6000;
scene.add(map);
const P = (lon, lat) => new THREE.Vector2((lon - 12) * 6.3, -(lat - 49.6) * 10);
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
const AT = [
  [9.55, 47.5],
  [9.6, 47.05],
  [10.45, 46.85],
  [12.2, 47.05],
  [12.4, 46.7],
  [13.7, 46.52],
  [14.9, 46.6],
  [16.1, 46.85],
  [16.5, 47.5],
  [16.95, 48.05],
  [16.95, 48.6],
  [15.0, 49.0],
  [13.8, 48.75],
  [13.0, 48.3],
  [12.9, 47.7],
  [12.2, 47.7],
  [10.4, 47.55],
].map(([a, b]) => P(a, b));
function slab(pts, color, y) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, std(color));
  m.position.y = y;
  map.add(m);
  return m;
}
{
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), std(0x9ab0c0));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.8;
  map.add(sea);
}
slab(DE, 0xd8d0b8, -0.6);
const atSlab = slab(AT, 0xc8c0a8, -0.6);
function inside(pts, x, z) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    if (a.y > z !== b.y > z && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
const mapTN = 1400;
const mapTrees = new THREE.InstancedMesh(
  new THREE.ConeGeometry(0.45, 1.3, 6),
  std(0x2f7a3a),
  mapTN,
);
mapTrees.frustumCulled = false;
map.add(mapTrees);
const mapT = [];
{
  const rnd = mulberry32(8);
  while (mapT.length < mapTN) {
    const x = -16 + rnd() * 48,
      z = 5 + rnd() * 27;
    if (inside(AT, x, z)) mapT.push([x, z, rnd()]);
  }
}
const dLab = textSprite("DEUTSCHLAND", "#3a3a3a", 16, 4);
dLab.position.set(-10, 3, -20);
const aLab = textSprite("NEUER WALD", "#1a6a2a", 15, 3.75);
aLab.position.set(8, 4, 24);
map.add(dLab, aLab);

// ================= story =================
const dummy = new THREE.Object3D();
const popAt = (t) => smooth(5.4, 9.4, t); // saplings appear
const growAt = (t) => (t < 14.3 ? 0.08 : lerp(0.08, 1, smooth(14.6, 23.5, t)));

function renderAt(t) {
  const onMap = t >= 9.6 && t < 14.3;
  map.visible = onMap;
  world.visible = !onMap;
  const isDusk = t >= 65;
  sky.visible = !isDusk;
  dusk.visible = isDusk;
  sun.color.set(isDusk ? 0xffa060 : 0xfff1dc);
  sun.intensity = isDusk ? 2.4 : 2.6;
  hemi.intensity = isDusk ? 2.0 : 1.1;
  sun.position.set(isDusk ? 80 : -60, isDusk ? 40 : 80, isDusk ? 200 : 50);

  // ----- forest -----
  const p = popAt(t),
    g = growAt(t);
  tdata.forEach((d, i) => {
    const on = t >= 14.3 || d.pop < p * 1.3;
    const s = on ? g : 0.0001;
    const h = d.h * s;
    dummy.position.set(d.x, h * 0.2, d.z);
    dummy.rotation.set(0, d.r * 6, 0);
    dummy.scale.set(Math.max(s, 0.3) * 1.2, h * 0.4, Math.max(s, 0.3) * 1.2);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(d.x, h * 0.4 + h * 0.35, d.z);
    dummy.scale.set(h * 0.28, h * 0.7, h * 0.28);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true;
  // the field turns from soil to forest floor
  groundMat.color.set(0x7a9a4e).lerp(C(0x4a6a34), smooth(16, 24, t));

  // CO2 molecules drifting into the hero tree (index 1326 sits near the middle)
  const hero = tdata[1326];
  const showMol = t >= 24.3 && t < 36.3;
  mols.visible = co2Label.visible = showMol;
  for (let i = 0; i < molN; i++) {
    const r = mulberry32(i + 3);
    const u = (t * 0.25 + r()) % 1;
    const a = r() * 6.28,
      rad = lerp(14, 1, u);
    dummy.position.set(
      hero.x + Math.cos(a) * rad,
      lerp(4 + r() * 10, hero.h * 0.7, u),
      hero.z + Math.sin(a) * rad,
    );
    dummy.scale.setScalar(1 - u * 0.8);
    dummy.updateMatrix();
    mols.setMatrixAt(i, dummy.matrix);
  }
  mols.instanceMatrix.needsUpdate = true;
  co2Label.position.set(hero.x + 6, 12, hero.z + 4);

  // ----- cubes -----
  const kF = smooth(36.4, 38, t),
    kD = smooth(41.9, 43.5, t),
    kW = smooth(53.9, 56, t);
  cubeForest.visible = labForest.visible = t >= 36.3 && t < 65;
  cubeDE.visible = labDE.visible = t >= 41.8 && t < 65;
  cubeWorld.visible = labWorld.visible = t >= 53.8 && t < 65;
  const sF = S1 * Math.max(kF, 0.001),
    sD = 2 * S1 * Math.max(kD, 0.001),
    sW = 7.7 * S1 * Math.max(kW, 0.001);
  // Germany's cube sits around the forest's cube so the 1/8 is visible
  cubeForest.scale.setScalar(sF);
  cubeForest.position.set(CX, sF / 2, 0);
  cubeDE.scale.setScalar(sD);
  cubeDE.position.set(CX + S1 / 2, sD / 2, -S1 / 2);
  cubeWorld.scale.setScalar(sW);
  cubeWorld.position.set(CX + sW / 2 - S1 / 2 + 0.01, sW / 2, -sW / 2 + S1 / 2);
  labForest.position.set(CX, sF + 3, S1 / 2 + 1);
  labDE.position.set(CX + S1 / 2, sD + 5, S1 / 2);
  labWorld.position.set(CX + sW / 2, sW + 14, 0);

  // ----- map -----
  const mk = smooth(10, 13, t);
  mapT.forEach(([x, z, r], i) => {
    dummy.position.set(x, 0.6, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(r < mk ? 1 : 0.0001);
    dummy.updateMatrix();
    mapTrees.setMatrixAt(i, dummy.matrix);
  });
  mapTrees.instanceMatrix.needsUpdate = true;
  atSlab.material.color.set(0xc8c0a8).lerp(C(0x5a8a4a), mk);

  // ----- planting -----
  planter.visible = sapling.visible = shovel.visible = t >= 65;
  shovel.rotation.z = 0.25 + Math.sin(t * 3) * 0.12;

  // ----- camera -----
  let pos, look;
  if (t < 9.6) {
    const k = smooth(0, 9.6, t);
    pos = V(lerp(6, 10, k), lerp(6, 60, k), lerp(90, 130, k));
    look = V(0, 0, lerp(60, 10, k));
  } else if (onMap) {
    const k = smooth(9.6, 14.3, t);
    pos = V(-6000 + lerp(4, 8, k), lerp(120, 105, k), lerp(95, 85, k));
    look = V(-6000 + 6, 0, 6);
  } else if (t < 24.3) {
    const k = smooth(14.3, 24.3, t);
    pos = V(lerp(-10, -4, k), lerp(1.5, 4, k), lerp(76, 70, k));
    look = V(lerp(0, 4, k), lerp(1, 7, k), 40);
  } else if (t < 29.8) {
    const k = smooth(24.3, 29.8, t);
    pos = V(hero.x + lerp(10, 14, k), lerp(20, 24, k), hero.z + lerp(20, 26, k));
    look = V(hero.x, 10, hero.z);
  } else if (t < 36.3) {
    const k = smooth(29.8, 36.3, t);
    pos = V(lerp(20, 30, k), lerp(25, 70, k), lerp(110, 150, k));
    look = V(0, 0, 10);
  } else if (t < 41.8) {
    const k = smooth(36.3, 41.8, t);
    pos = V(CX + lerp(-14, -18, k), lerp(14, 18, k), lerp(52, 58, k));
    look = V(CX - 4, 7, 0);
  } else if (t < 53.8) {
    const k = smooth(41.8, 53.8, t);
    pos = V(CX + lerp(-18, -22, k), lerp(20, 28, k), lerp(70, 84, k));
    look = V(CX + 2, 12, -4);
  } else if (t < 65) {
    const k = smooth(53.8, 60, t);
    pos = V(CX + lerp(-40, -170, k), lerp(30, 120, k), lerp(82, 260, k));
    look = V(CX + lerp(-8, 30, k), lerp(12, 45, k), lerp(-4, -40, k));
  } else {
    const k = smooth(65, 80, t);
    pos = V(lerp(2, 4, k), lerp(2.2, 3.4, k), lerp(80, 84, k));
    look = V(-1.5, 1.2, 72);
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  sky.position.copy(cam.position);
  dusk.position.copy(cam.position);
  renderer.render(scene, cam);

  // ----- HUD -----
  const dec = (x, d = 1) => x.toFixed(d).replace(".", ",");
  if (t < 9.6) {
    const n = 8.2e9 * Math.pow(p, 3);
    const v = n < 1e6 ? fmt(n) : n < 1e9 ? dec(n / 1e6, 0) + " Mio." : dec(n / 1e9) + " Mrd.";
    setHud(t, "GEPFLANZTE BÄUME", t < 5.4 ? "0" : v, "1 BAUM PRO MENSCH");
  } else if (onMap) setHud(t, "NEUER WALD", "≈ 82.000 km²", "ÖSTERREICH: 83.900 KM²");
  else if (t < 24.3)
    setHud(
      t,
      "WALDALTER",
      Math.round(lerp(0, 20, smooth(14.6, 23.5, t))) + " Jahre",
      "AUS SETZLINGEN WIRD WALD",
    );
  else if (t < 29.8) setHud(t, "CO₂ PRO BAUM", "≈ 10 kg", "PRO JAHR");
  else if (t < 41.8) setHud(t, "UNSER WALD", "82 Mio. t", "CO₂ PRO JAHR");
  else if (t < 48.3) setHud(t, "DEUTSCHLAND", "650 Mio. t", "TREIBHAUSGASE PRO JAHR");
  else if (t < 53.8) setHud(t, "WALD SCHAFFT", "≈ 1/8", "VON DEUTSCHLANDS AUSSTOSS");
  else if (t < 60.3) setHud(t, "GANZE WELT", "37 Mrd. t", "CO₂ PRO JAHR");
  else if (t < 65) setHud(t, "WALD SCHAFFT", "0,2 %", "VOM CO₂ DER WELT");
  else setHud(t, "WAS HILFT", "beides", "PFLANZEN + WENIGER AUSSTOSS");
}
register(renderAt);
