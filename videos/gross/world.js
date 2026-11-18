// "Was wäre, wenn die Erde doppelt so groß wäre?"
// Same density, twice the radius -> twice the surface gravity.
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
  starField,
  textSprite,
  makePerson,
  setHud,
  register,
} from "./lib.js";

const renderer = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 20000);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-40, 60, 50);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a5a30, 1.1);
scene.add(hemi);

// ---------- space stage ----------
const space = new THREE.Group();
scene.add(space);
const stars = starField(space, 2200, 9000, 9);
function planet(r, detail, pick) {
  const geo = new THREE.IcosahedronGeometry(r, detail).toNonIndexed();
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3 / r,
      y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 / r,
      z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3 / r;
    c.set(pick(x, y, z));
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, std(0xffffff, { vertexColors: true }));
}
const landAt = (x, y, z) => Math.sin(x * 3.1 + 1) + Math.sin(y * 4.3 + 2) + Math.sin(z * 3.7) > 0.9;
const earthPick = (x, y, z) => {
  if (Math.abs(y) > 0.86) return 0xf2f6fa;
  if (!landAt(x, y, z)) return 0x2a5fb0;
  return Math.sin(x * 9 + z * 7) > 0.4 ? 0x8a7a4a : 0x4f8a3a;
};
const earth = planet(10, 4, earthPick);
space.add(earth);
// the Earth as it is today, for comparison
const ghost = new THREE.Mesh(
  new THREE.IcosahedronGeometry(10, 3),
  new THREE.MeshBasicMaterial({
    color: 0x9ac8ff,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  }),
);
space.add(ghost);
const ghostLabel = textSprite("HEUTE", "#9ac8ff", 12, 3);
const bigLabel = textSprite("2× ERDE", "#ffd27a", 14, 3.5);
space.add(ghostLabel, bigLabel);

// ---------- ground stage ----------
const ground = new THREE.Group();
scene.add(ground);
const sky = skyDome(ground, "#4f8fd6", "#e2eef4", { radius: 3000 });
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), std(0x6a9a4e));
  g.rotation.x = -Math.PI / 2;
  ground.add(g);
}
const glass = (p, opacity) =>
  p.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = opacity;
    }
  });
function liveText(w, h, color) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx }));
  let last = "";
  m.userData.set = (text) => {
    if (text === last) return;
    last = text;
    g.fillStyle = "#101820";
    g.fillRect(0, 0, 512, 256);
    g.font = "bold 150px monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color;
    g.fillText(text, 256, 132);
    tx.needsUpdate = true;
  };
  return m;
}

// scene A (x = 0): bathroom scale, then stairs
const A = new THREE.Group();
ground.add(A);
const scaleBase = box(1.2, 0.12, 1.0, 0xf0f0f0);
scaleBase.position.y = 0.06;
const display = liveText(0.7, 0.35, "#7aff8a");
display.rotation.x = -Math.PI / 2;
display.position.set(0, 0.125, 0.33);
A.add(scaleBase, display);
const you = makePerson(mulberry32(2), 1);
A.add(you);
const rider = makePerson(mulberry32(8), 0.85);
glass(rider, 0.45);
A.add(rider);
const STEP_H = 0.32,
  STEP_D = 0.55,
  STEPS = 14;
for (let i = 0; i < STEPS; i++) {
  const s = box(2.4, STEP_H * (i + 1), STEP_D, i % 2 ? 0xd8d0c0 : 0xcfc6b4);
  s.position.set(6, (STEP_H * (i + 1)) / 2, -i * STEP_D);
  A.add(s);
}
// house wall behind
{
  const wall = box(30, 10, 0.4, 0xe8dcc8);
  wall.position.set(3, 5, -9);
  A.add(wall);
}

// scene B (x = 100): jump + fall comparison
const B = new THREE.Group();
B.position.x = 100;
ground.add(B);
const jumpL = makePerson(mulberry32(3), 1);
const jumpR = makePerson(mulberry32(3), 1);
jumpL.position.x = -1.6;
jumpR.position.x = 1.6;
B.add(jumpL, jumpR);
const platL = box(1.2, 1, 1.2, 0xb8a888);
const platR = box(1.2, 1, 1.2, 0xb8a888);
platL.position.set(-1.6, 0.5, -4);
platR.position.set(1.6, 0.5, -4);
B.add(platL, platR);
const ballL = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), std(0xe8503a));
const ballR = ballL.clone();
B.add(ballL, ballR);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0xffd27a,
  transparent: true,
  side: THREE.DoubleSide,
});
const ringL = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 32), ringMat.clone());
const ringR = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 32), ringMat.clone());
ringL.rotation.x = ringR.rotation.x = -Math.PI / 2;
B.add(ringL, ringR);
const labL = textSprite("HEUTE", "#ffffff", 2.4, 0.6);
const labR = textSprite("2× ERDE", "#ffd27a", 2.4, 0.6);
B.add(labL, labR);
// height marks
for (const x of [-1.6, 1.6])
  for (let i = 1; i <= 6; i++) {
    const m = box(0.5, 0.03, 0.03, 0xffffff);
    m.position.set(x + 0.9, i * 0.5, -0.4);
    B.add(m);
  }

// scene C (x = 300): trees and mountains, today vs 2x
const C = new THREE.Group();
C.position.x = 300;
ground.add(C);
function tree(h) {
  const g = new THREE.Group();
  const trunk = cyl(h * 0.03, h * 0.04, h * 0.45, 0x6a4a2a, 6);
  trunk.position.y = h * 0.225;
  const crown = cone(h * 0.16, h * 0.7, 0x2f6a34, 7);
  crown.position.y = h * 0.62;
  g.add(trunk, crown);
  return g;
}
const treeL = tree(11.6);
treeL.position.set(-6, 0, 0);
const treeR = tree(11.6);
treeR.position.set(6, 0, 0);
C.add(treeL, treeR);
const mtnMat = (c) => std(c);
function mountain() {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.ConeGeometry(30, 1, 7), mtnMat(0x7a7068));
  rock.position.y = 0.5;
  const snow = new THREE.Mesh(new THREE.ConeGeometry(7.6, 0.25, 7), mtnMat(0xf4f4f4));
  snow.position.y = 0.875;
  g.add(rock, snow);
  return g;
}
const mtnL = mountain();
mtnL.position.set(-30, 0, -70);
const mtnR = mountain();
mtnR.position.set(30, 0, -70);
C.add(mtnL, mtnR);
const cLabL = textSprite("HEUTE", "#ffffff", 7, 1.75);
const cLabR = textSprite("2× ERDE", "#ffd27a", 7, 1.75);
C.add(cLabL, cLabR);
const people = [];
for (const x of [-4, 8]) {
  const p = makePerson(mulberry32(x + 20), 1);
  p.position.set(x, 0, 2);
  C.add(p);
  people.push(p);
}

// scene D (x = 600): rocket launch
const D = new THREE.Group();
D.position.x = 600;
ground.add(D);
{
  const pad = box(14, 1, 14, 0x9a9690);
  pad.position.y = 0.5;
  const tower = box(1.6, 30, 1.6, 0xc85a3a);
  tower.position.set(-5, 15, 0);
  D.add(pad, tower);
}
const rocket = new THREE.Group();
{
  const body = cyl(1.6, 1.6, 22, 0xf2f2f2, 16);
  body.position.y = 11;
  const band = cyl(1.62, 1.62, 1.5, 0x1a1a1a, 16);
  band.position.y = 16;
  const nose = cone(1.6, 5, 0xf2f2f2, 16);
  nose.position.y = 24.5;
  rocket.add(body, band, nose);
  for (let i = 0; i < 4; i++) {
    const fin = box(0.25, 4, 2.4, 0x2a2a2a);
    const a = (i * Math.PI) / 2;
    fin.position.set(Math.cos(a) * 1.9, 2, Math.sin(a) * 1.9);
    fin.rotation.y = -a;
    rocket.add(fin);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 7, 12),
    new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.9 }),
  );
  flame.rotation.x = Math.PI;
  flame.position.y = -3.5;
  flame.name = "flame";
  rocket.add(flame);
}
D.add(rocket);
const smokeN = 70;
const smoke = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(1, 1),
  std(0xe8e4e0, { transparent: true, opacity: 0.8, emissive: 0x6a6660 }),
  smokeN,
);
smoke.frustumCulled = false;
D.add(smoke);
const boom = new THREE.Mesh(
  new THREE.SphereGeometry(1, 20, 14),
  new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true }),
);
D.add(boom);

// ---------- story ----------
const growK = (t) => smooth(5.4, 12.5, t);
const gAt = (t) => (t < 14.3 ? 1 + growK(t) : 1 + smooth(14.6, 17.6, t));
// rocket height (relative units), rises then stalls and falls back
function rocketY(t) {
  if (t < 61) return 1;
  if (t < 69.5) {
    const k = smooth(61, 69.5, t);
    return 1 + 95 * Math.sin((k * Math.PI) / 2);
  }
  const k = clamp((t - 69.5) / 3.1);
  return 1 + 96 * (1 - k * k);
}
const dummy = new THREE.Object3D();

function renderAt(t) {
  const inSpace = t < 14.3 || (t >= 53.8 && t < 60.3);
  space.visible = inSpace;
  ground.visible = !inSpace;
  scene.background = inSpace ? new THREE.Color(0x02030a) : null;
  hemi.intensity = inSpace ? 0.35 : 1.1;

  // ----- space -----
  const s = t < 14.3 ? 1 + growK(t) : 2;
  earth.scale.setScalar(s);
  earth.rotation.y = t * 0.06;
  const cmp = t < 14.3 ? smooth(9.4, 11, t) : 0;
  ghost.visible = ghostLabel.visible = bigLabel.visible = cmp > 0.01;
  ghost.position.set(0, 36, 0);
  ghostLabel.position.set(23, 36, 0);
  ghostLabel.scale.set(18, 4.5, 1);
  bigLabel.scale.set(20, 5, 1);
  bigLabel.position.set(0, -25, 12);
  ghost.material.opacity = 0.35 * cmp;

  // ----- scene A -----
  const g = gAt(t);
  const onStairs = t >= 19;
  if (!onStairs) {
    you.position.set(0, 0.12, 0);
    you.scale.set(1, lerp(1, 0.93, smooth(14.6, 17.6, t)), 1);
    you.rotation.y = 0.2;
    display.userData.set(fmt(70 * g));
  } else {
    // slow climb: one step every ~1.4 s
    const steps = clamp((t - 19.3) / 1.45, 0, STEPS - 1);
    const i = Math.floor(steps),
      f = steps - i;
    const lift = smooth(0.15, 0.75, f);
    you.position.set(
      6,
      STEP_H * (i + 1 + lift) - (i === 0 && lift === 0 ? STEP_H : 0),
      -(i + lift) * STEP_D + STEP_D * 0.2,
    );
    you.scale.set(1, 0.95 + Math.sin(f * Math.PI) * 0.03, 1);
    you.rotation.set(0.12, Math.PI, 0);
  }
  rider.visible = onStairs && t < 24.3;
  rider.position.copy(you.position).add(V(0, 1.45, 0.45));
  rider.rotation.set(-0.3, Math.PI, 0);
  scaleBase.visible = display.visible = !onStairs;

  // ----- scene B -----
  // jumps: same take-off speed; with 2 g half the height and half the airtime
  const jump = (tt, gr) => {
    const v = 3.1,
      T = (2 * v) / (9.81 * gr);
    const u = tt % (T + 0.55);
    return u < T ? v * u - 0.5 * 9.81 * gr * u * u : 0;
  };
  const jt = Math.max(0, t - 30.3);
  jumpL.position.y = jump(jt, 1);
  jumpR.position.y = jump(jt, 2);
  jumpL.visible = jumpR.visible = t < 36.3;
  // falls from a 1 m platform (balls)
  const fall = (tt, gr) => {
    const u = tt % 2.2;
    const tHit = Math.sqrt((2 * 1.3) / (9.81 * gr));
    const y = u < tHit ? 1.3 - 0.5 * 9.81 * gr * u * u : 0;
    return { y: Math.max(0, y) + 0.3, hit: u >= tHit ? u - tHit : -1 };
  };
  const ft = Math.max(0, t - 37);
  const fl = fall(ft, 1),
    fr = fall(ft, 2);
  const fallOn = t >= 36.3;
  ballL.visible = ballR.visible = ringL.visible = ringR.visible = fallOn;
  ballL.position.set(-1.6, t < 37 ? 1.3 : fl.y, -4 + 0.0);
  ballR.position.set(1.6, t < 37 ? 1.3 : fr.y, -4);
  ballL.position.z = ballR.position.z = -3.2;
  for (const [ring, f, big] of [
    [ringL, fl, 1],
    [ringR, fr, 1.6],
  ]) {
    const a = f.hit >= 0 && t >= 37 ? clamp(1 - f.hit / 0.6) : 0;
    ring.position.set(ring === ringL ? -1.6 : 1.6, 0.03, -3.2);
    ring.scale.setScalar(1 + (1 - a) * 2 * big);
    ring.material.opacity = a;
  }
  platL.visible = platR.visible = fallOn;
  platL.position.z = platR.position.z = -4.2;
  labL.position.set(-1.6, 3.3, -0.6);
  labR.position.set(1.6, 3.3, -0.6);

  // ----- scene C -----
  treeR.scale.setScalar(lerp(1, 0.5, smooth(43, 46.5, t)));
  const mt = lerp(88.5, 44, smooth(49.3, 52.5, t));
  mtnL.scale.set(1, 88.5, 1);
  mtnR.scale.set(1, mt, 1);
  cLabL.position.set(-5, t < 48.3 ? 0.9 : 8, t < 48.3 ? 4 : -40);
  cLabR.position.set(5, t < 48.3 ? 0.9 : 8, t < 48.3 ? 4 : -40);
  cLabL.scale.set(t < 48.3 ? 4 : 18, t < 48.3 ? 1 : 4.5, 1);
  cLabR.scale.set(t < 48.3 ? 4 : 18, t < 48.3 ? 1 : 4.5, 1);
  if (t >= 48.3) {
    cLabL.position.x = -30;
    cLabR.position.x = 30;
  }

  // ----- scene D -----
  const ry = rocketY(t);
  const falling = t >= 69.5;
  rocket.position.set(falling ? clamp(t - 69.5, 0, 3.1) * 4 : 0, ry, 0);
  rocket.rotation.z = falling ? -smooth(69.5, 72, t) * 2.4 : 0;
  rocket.visible = t < 72.6;
  rocket.getObjectByName("flame").visible = t >= 61 && t < 69.8;
  rocket.getObjectByName("flame").scale.set(1, 0.8 + 0.25 * Math.sin(t * 40), 1);
  for (let i = 0; i < smokeN; i++) {
    const age = i * 0.12;
    const tt = t - age;
    if (tt < 61 || tt > 69.8 || t < 61) {
      dummy.scale.setScalar(0.0001);
    } else {
      const r = mulberry32(i + 1);
      dummy.position.set(
        (r() - 0.5) * 2 + (r() - 0.5) * age * 3,
        rocketY(tt) - 4 + age * 0.5,
        (r() - 0.5) * age * 3,
      );
      dummy.scale.setScalar(0.9 + age * 0.7);
    }
    dummy.updateMatrix();
    smoke.setMatrixAt(i, dummy.matrix);
  }
  smoke.instanceMatrix.needsUpdate = true;
  const bk = clamp((t - 72.6) / 1.6);
  boom.visible = t >= 72.6 && bk < 1;
  boom.position.set(12.4, 2, 0);
  boom.scale.setScalar(2 + bk * 22);
  boom.material.opacity = 1 - bk;

  // ----- camera -----
  let pos, look;
  if (t < 14.3) {
    const k = smooth(0, 14.3, t);
    pos = V(0, lerp(6, 14, k), lerp(42, 115, k));
    look = V(0, lerp(0, 12, k), 0);
  } else if (t < 19) {
    const k = smooth(14.3, 19, t);
    pos = V(lerp(1.8, 1.4, k), lerp(2.4, 2.8, k), lerp(4.2, 3.6, k));
    look = V(0, lerp(1.1, 0.5, k), 0);
  } else if (t < 29.8) {
    const k = smooth(19, 29.8, t);
    pos = V(lerp(1.5, 0.5, k), lerp(3.2, 5.5, k), lerp(4.5, 0.5, k));
    look = V(you.position.x, you.position.y + 1.2, you.position.z);
  } else if (t < 41.8) {
    const k = smooth(29.8, 41.8, t);
    pos = V(100 + lerp(0.5, 0, k), lerp(2.2, 2.4, k), lerp(9.5, 8.5, k));
    look = V(100, 1.2, -1.5);
  } else if (t < 48.3) {
    const k = smooth(41.8, 48.3, t);
    pos = V(300, lerp(5, 6, k), lerp(31, 29, k));
    look = V(300, 6, 0);
  } else if (t < 53.8) {
    const k = smooth(48.3, 53.8, t);
    pos = V(300, lerp(20, 30, k), lerp(110, 120, k));
    look = V(300, 40, -70);
  } else if (t < 60.3) {
    const k = smooth(53.8, 60.3, t);
    pos = V(lerp(30, 10, k), lerp(20, 30, k), lerp(70, 60, k));
    look = V(0, 0, 0);
  } else if (t < 74) {
    const k = smooth(60.3, 74, t);
    pos = V(600 + lerp(-30, -45, k), lerp(14, 30, k), lerp(70, 120, k));
    look = V(600 + rocket.position.x * 0.6, Math.min(lerp(15, 50, k), ry + 6), 0);
  } else {
    const k = smooth(74, 80, t);
    pos = V(600 - 45, lerp(30, 45, k), lerp(120, 140, k));
    look = V(600, 30, 0);
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  if (!inSpace) sky.position.copy(cam.position);
  stars.position.copy(cam.position);
  renderer.render(scene, cam);

  // ----- HUD -----
  const dec = (x, d = 1) => x.toFixed(d).replace(".", ",");
  if (t < 14.3)
    setHud(t, "ERDDURCHMESSER", fmt(12742 * s) + " km", "SCHWERKRAFT: " + dec(s) + " G");
  else if (t < 19) setHud(t, "DEIN GEWICHT", fmt(70 * g) + " kg", "SCHWERKRAFT: " + dec(g) + " G");
  else if (t < 24.3) setHud(t, "DEIN GEWICHT", "140 kg", "+ 70 KG BEI JEDEM SCHRITT");
  else if (t < 29.8) setHud(t, "DEIN HERZ", "2× Arbeit", "BLUT WIEGT DOPPELT SO VIEL");
  else if (t < 36.3) setHud(t, "SPRUNGHÖHE", "25 cm", "HEUTE: 50 CM");
  else if (t < 41.8) setHud(t, "STURZ AUS 1 M", "wie aus 2 m", "AUFPRALL: 41 % SCHNELLER");
  else if (t < 48.3) setHud(t, "HÖCHSTER BAUM", "≈ 58 m", "HEUTE: 116 M");
  else if (t < 53.8) setHud(t, "MAX. BERGHÖHE", "≈ 4.400 m", "EVEREST HEUTE: 8.849 M");
  else if (t < 60.3) setHud(t, "OBERFLÄCHE", "4×", "2 MRD. KM² STATT 510 MIO.");
  else setHud(t, "ORBIT-TEMPO", "15,8 km/s", "HEUTE: 7,9 KM/S");
}
register(renderAt);
