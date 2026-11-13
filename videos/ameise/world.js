// "Was wäre, wenn du plötzlich so klein wie eine Ameise wärst?"
// The garden is built in metres inside `world`; the world is scaled up as you shrink,
// so the camera always works in "your" units (you stay ~1.8 units tall).
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
  ellipsoid,
  cone,
  cyl,
  makeRenderer,
  skyDome,
  makePerson,
  setHud,
  register,
} from "./lib.js";

const renderer = makeRenderer();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdcecd8, 20, 90);
const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 20000);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-40, 80, 30);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x4a6a30, 1.2));
const sky = skyDome(scene, "#5a9ad8", "#e2f0dc", { radius: 15000 });

const world = new THREE.Group();
scene.add(world);
const add = (...o) => world.add(...o);

// ---------- garden (metres) ----------
{
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(0x5f8f3e));
  lawn.rotation.x = -Math.PI / 2;
  add(lawn);
  for (const [x, z] of [
    [0, 0],
    [0.145, 0],
  ]) {
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), std(0x6a5038));
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(x, 0.0002, z);
    add(soil);
  }
  // fence and house far behind
  for (let i = 0; i < 24; i++) {
    const p = box(0.12, 1.2, 0.04, 0xd8c8a8);
    p.position.set(-7 + i * 0.6, 0.6, -6);
    add(p);
  }
  const rail = box(14.5, 0.08, 0.05, 0xc8b898);
  rail.position.set(0, 0.9, -6.02);
  add(rail);
  const house = box(10, 6, 6, 0xe8dcc8);
  house.position.set(-4, 3, -12);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 5, 3, 4), std(0xa04a3a));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.4, 1, 0.85);
  roof.position.set(-4, 7.5, -12);
  add(house, roof);
  const rnd = mulberry32(4);
  for (let i = 0; i < 9; i++) {
    const b = ellipsoid(
      0.5 + rnd() * 0.5,
      0.45 + rnd() * 0.4,
      0.5,
      [0x3f7a34, 0x4f8a3a, 0x356a2c][i % 3],
      7,
    );
    b.position.set(-8 + i * 2 + rnd(), 0.35, -5 + rnd() * 0.5);
    add(b);
  }
  for (let i = 0; i < 14; i++) {
    const f = ellipsoid(0.03, 0.02, 0.03, [0xffd23a, 0xff6a8a, 0xffffff][i % 3], 6);
    const stem = cyl(0.002, 0.002, 0.25, 0x3a7a2a, 4);
    const x = -2 + rnd() * 4,
      z = -1.6 - rnd() * 3;
    stem.position.set(x, 0.125, z);
    f.position.set(x, 0.25, z);
    add(stem, f);
  }
}
const catZone = [];
let grass;
// grass blades: dense around you and around the landing spot
{
  const n = 7000;
  const geo = new THREE.ConeGeometry(0.0016, 1, 4, 1);
  geo.translate(0, 0.5, 0);
  grass = new THREE.InstancedMesh(geo, std(0xffffff), n);
  grass.frustumCulled = false;
  const rnd = mulberry32(11);
  const d = new THREE.Object3D();
  const cols = [0x5f9a3a, 0x6aaa44, 0x4f8a32, 0x7aba4a, 0x88b84a];
  for (let i = 0; i < n; i++) {
    const cx = i % 3 === 0 ? 0.145 : 0;
    let x, z, r;
    do {
      const a = rnd() * Math.PI * 2;
      r = 0.016 + 0.9 * rnd() * rnd();
      x = cx + Math.cos(a) * r;
      z = Math.sin(a) * r;
    } while (Math.hypot(x, z) < 0.016 || Math.hypot(x - 0.145, z) < 0.016);
    d.position.set(x, 0, z);
    d.rotation.set((rnd() - 0.5) * 0.35, rnd() * 6.28, (rnd() - 0.5) * 0.35);
    const h = 0.06 + rnd() * 0.22;
    d.scale.set(1 + rnd(), h, 1 + rnd());
    d.updateMatrix();
    grass.setMatrixAt(i, d.matrix);
    if (Math.hypot(x + 0.1, z + 0.15) < 0.75) catZone.push([i, d.matrix.clone()]);
    grass.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  }
  add(grass);
}
// table
{
  const top = box(1.2, 0.03, 0.8, 0xb8865a);
  top.position.set(0.75, 0.745, 0);
  add(top);
  for (const [x, z] of [
    [0.2, -0.34],
    [0.2, 0.34],
    [1.3, -0.34],
    [1.3, 0.34],
  ]) {
    const leg = box(0.04, 0.73, 0.04, 0x9a6a42);
    leg.position.set(x, 0.365, z);
    add(leg);
  }
  const cup = cyl(0.04, 0.035, 0.09, 0xffffff, 16);
  cup.position.set(0.6, 0.805, -0.15);
  add(cup);
}
// ant (about 3 mm long)
const ant = new THREE.Group();
{
  const c = 0x2a1a12;
  const s = 0.001;
  const head = ellipsoid(0.32 * s, 0.28 * s, 0.3 * s, c);
  head.position.set(1.25 * s, 0.5 * s, 0);
  const thorax = ellipsoid(0.42 * s, 0.22 * s, 0.2 * s, c);
  thorax.position.set(0.55 * s, 0.5 * s, 0);
  const abd = ellipsoid(0.6 * s, 0.42 * s, 0.4 * s, 0x3a2216);
  abd.position.set(-0.5 * s, 0.6 * s, 0);
  ant.add(head, thorax, abd);
  for (let i = 0; i < 3; i++)
    for (const side of [-1, 1]) {
      const leg = cyl(0.03 * s, 0.03 * s, 1.1 * s, c, 4);
      leg.position.set((0.25 + i * 0.3) * s, 0.3 * s, side * 0.45 * s);
      leg.rotation.set(side * 1.0, 0, (i - 1) * 0.5);
      ant.add(leg);
    }
  for (const side of [-1, 1]) {
    const an = cyl(0.02 * s, 0.02 * s, 0.9 * s, c, 4);
    an.position.set(1.6 * s, 0.9 * s, side * 0.18 * s);
    an.rotation.set(side * 0.5, 0, -0.9);
    ant.add(an);
  }
  add(ant);
}
// rain
const dropN = 90;
const waterMat = std(0x7ac0f0, {
  transparent: true,
  opacity: 0.72,
  roughness: 0.1,
  metalness: 0.1,
});
const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0015, 10, 8), waterMat, dropN);
drops.frustumCulled = false;
add(drops);
const dropData = [];
{
  const rnd = mulberry32(21);
  for (let i = 0; i < dropN; i++)
    dropData.push({
      x: (rnd() - 0.5) * 0.05,
      z: -rnd() * 0.05 + 0.004,
      ph: rnd(),
      sp: 0.8 + rnd() * 0.4,
    });
}
const bigDrop = ellipsoid(0.0016, 0.0011, 0.0016, 0x9ad0f0, 16);
bigDrop.material = waterMat;
bigDrop.position.set(0.0019, 0.001, -0.0018);
add(bigDrop);
const stuck = ellipsoid(0.0011, 0.0009, 0.0011, 0x9ad0f0, 16);
stuck.material = waterMat;
stuck.position.set(0.0002, 0.0007, 0);
add(stuck);
// cat
const cat = new THREE.Group();
{
  const c = 0xe08a3a;
  const body = ellipsoid(0.12, 0.16, 0.13, c, 12);
  body.position.y = 0.15;
  const chest = ellipsoid(0.08, 0.1, 0.06, 0xf2e2d0, 10);
  chest.position.set(0, 0.2, 0.09);
  const head = ellipsoid(0.08, 0.07, 0.075, c, 12);
  head.position.set(0, 0.36, 0.04);
  cat.add(body, chest, head);
  for (const side of [-1, 1]) {
    const ear = cone(0.03, 0.06, c, 4);
    ear.position.set(side * 0.045, 0.43, 0.03);
    ear.rotation.z = -side * 0.25;
    const eye = ellipsoid(0.014, 0.017, 0.006, 0x8ac83a, 8);
    eye.position.set(side * 0.03, 0.375, 0.108);
    const pupil = ellipsoid(0.004, 0.014, 0.004, 0x101010, 6);
    pupil.position.set(side * 0.03, 0.375, 0.113);
    const paw = ellipsoid(0.03, 0.025, 0.05, 0xf2e2d0, 8);
    paw.position.set(side * 0.05, 0.02, 0.1);
    cat.add(ear, eye, pupil, paw);
  }
  const nose = ellipsoid(0.01, 0.007, 0.006, 0xd06a6a, 6);
  nose.position.set(0, 0.35, 0.115);
  const tail = cyl(0.018, 0.012, 0.3, c, 6);
  tail.position.set(0.12, 0.04, 0.06);
  tail.rotation.set(Math.PI / 2, 0, 0.9);
  cat.add(nose, tail);
  cat.position.set(-0.1, 0, -0.15);
  cat.rotation.y = 0.6;
  add(cat);
}
// you
const you = makePerson(mulberry32(8), 1);
add(you);

// ---------- story ----------
function heightAt(t) {
  return Math.exp(lerp(Math.log(1.8), Math.log(0.002), smooth(5.2, 9.4, t)));
}
function posAt(t) {
  if (t < 48) return V(0, 0, 0);
  if (t < 54.5) return V(0.153, 0.76, 0);
  const k = smooth(54.5, 55.6, t);
  const x = lerp(0.153, 0.145, k);
  if (t < 55.2) return V(x, 0.76 + Math.sin(k * Math.PI) * 0.004, 0);
  const f = clamp((t - 55.2) / (64 - 55.2));
  return V(x, 0.76 * (1 - f * (0.6 + 0.4 * f)) - 0.0, 0);
}
const dummy = new THREE.Object3D();
const cmLabel = (m) =>
  m >= 1
    ? m.toFixed(2).replace(".", ",") + " m"
    : m >= 0.01
      ? Math.round(m * 100) + " cm"
      : Math.max(2, Math.round(m * 1000)) + " mm";

function renderAt(t) {
  const h = heightAt(t);
  const S = 1.8 / h;
  const p = posAt(t);
  world.scale.setScalar(S);
  world.position.set(-p.x * S, -p.y * S, -p.z * S);
  you.scale.setScalar(h / 1.8);
  you.position.copy(p);
  you.rotation.y = t < 54.5 ? 0.3 : 0.3 + (t - 54.5) * 0.25;
  you.rotation.z = t > 55.2 && t < 64 ? Math.sin(t * 1.3) * 0.25 : 0;
  scene.fog.near = Math.min(20 * S, 1200);
  scene.fog.far = Math.min(90 * S, 7000) + smooth(70, 80, t) * 12000;

  // the ant wanders past
  const ak = clamp((t - 17) / 9);
  ant.position.set(lerp(-0.0075, -0.0005, ak), 0, lerp(-0.0045, -0.0028, ak));
  ant.rotation.y = 0.3;
  ant.visible = t < 48;
  const catScene = t >= 41.8 && t < 48.3;
  cat.visible = t < 5 || catScene;
  for (const [i, m] of catZone) {
    if (catScene) {
      dummy.position.set(0, -1, 0);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    } else grass.setMatrixAt(i, m);
  }
  grass.instanceMatrix.needsUpdate = true;

  // rain
  const rainOn = t >= 24.3 && t < 36;
  drops.visible = rainOn;
  if (rainOn)
    dropData.forEach((d, i) => {
      const y = 0.012 * (1 - ((d.ph + (t - 24.3) * 0.12 * d.sp) % 1));
      dummy.position.set(d.x, y, d.z);
      dummy.scale.set(1, 1.25, 1);
      dummy.updateMatrix();
      drops.setMatrixAt(i, dummy.matrix);
    });
  drops.instanceMatrix.needsUpdate = true;
  const bk = smooth(28.6, 29.6, t);
  bigDrop.visible = t >= 28.6 && t < 36;
  bigDrop.position.y = lerp(0.012, 0.001, bk);
  bigDrop.scale.set(
    0.0016 * lerp(0.8, 1, bk),
    0.0011 * lerp(1.3, 1, bk),
    0.0016 * lerp(0.8, 1, bk),
  );
  stuck.visible = t >= 36.3 && t < 48;
  const sk = smooth(36.3, 37.4, t) + 0.0001;
  stuck.scale.set(0.0011 * sk, 0.0009 * sk, 0.0011 * sk);

  let pos, look;
  if (t < 14) {
    const k = smooth(0, 14, t);
    pos = V(lerp(-2.6, -3.4, k), lerp(1.9, 1.2, k), lerp(5.5, 5.2, k));
    look = V(0, lerp(1.0, 1.6, k), 0);
  } else if (t < 19) {
    const k = smooth(14, 19, t);
    pos = V(lerp(-3, -2.4, k), 0.7, lerp(4.5, 4, k));
    look = V(0.5, lerp(8, 14, k), -6);
  } else if (t < 24.3) {
    const k = smooth(19, 24.3, t);
    pos = V(lerp(1.8, 1.2, k), lerp(2.2, 1.8, k), lerp(5.5, 6, k));
    look = V(-1.8, 0.9, -1.7);
  } else if (t < 36.3) {
    const k = smooth(24.3, 36.3, t);
    pos = V(lerp(-4, -3, k), lerp(2.4, 2, k), lerp(6.5, 6, k));
    look = V(1.2, 1.6, -1);
  } else if (t < 41.8) {
    const k = smooth(36.3, 41.8, t);
    pos = V(lerp(-2.6, -2.2, k), 1.6, lerp(3.4, 3, k));
    look = V(0, 1.1, 0);
  } else if (t < 48.3) {
    const k = smooth(41.8, 48.3, t);
    pos = V(lerp(110, 130, k), lerp(15, 30, k), lerp(250, 280, k));
    look = V(-90, lerp(170, 200, k), -135);
  } else if (t < 54.5) {
    const k = smooth(48.3, 54.5, t);
    pos = V(lerp(2, 1.5, k), lerp(3.6, 3.2, k), lerp(6.5, 6, k));
    look = V(-0.9, -0.4, 0);
  } else if (t < 70) {
    pos = V(-3.4, 1.8 + (t < 64 ? 0 : smooth(64, 70, t) * 0.6), 5);
    look = V(0, t < 64 ? 0.6 : 1, 0);
  } else {
    const k = smooth(70, 80, t);
    pos = V(lerp(-3.4, -700, k), lerp(2.4, 1500, k), lerp(5, 2000, k));
    look = V(lerp(0, 300, k), 0, lerp(0, -200, k));
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  sky.position.copy(cam.position);
  renderer.render(scene, cam);

  // HUD
  if (t < 14.3) setHud(t, "DEINE GRÖSSE", cmLabel(h), t >= 9.6 ? "900-MAL KLEINER" : " ");
  else if (t < 19) setHud(t, "GRASHALM FÜR DICH", "≈ 200 m", "ECHT: 20 CM");
  else if (t < 24.3) setHud(t, "AMEISE FÜR DICH", "≈ 2,7 m", "ECHT: 3 MM");
  else if (t < 36.3)
    setHud(t, "REGENTROPFEN FÜR DICH", "≈ 2,7 m", "DEIN GEWICHT: 0,1 MG", "EIN TROPFEN: 14 MG");
  else if (t < 41.8) setHud(t, "REGENTROPFEN FÜR DICH", "≈ 2,7 m", "WASSER HAFTET AN DIR");
  else if (t < 48.3) setHud(t, "KATZE FÜR DICH", "≈ 380 m", "KÖLNER DOM: 157 M");
  else if (t < 64) {
    const left = Math.max(0, p.y);
    setHud(
      t,
      "NOCH BIS ZUM BODEN",
      cmLabel(left < 0.005 ? 0.002 : left).replace("2 mm", "0 cm"),
      "FÜR DICH: " + Math.round(left * 900) + " M",
    );
  } else if (t < 70.3) setHud(t, "VERLETZUNGEN", "keine", "LUFTWIDERSTAND BREMST DICH");
  else setHud(t, "DEINE GRÖSSE", "2 mm", "EIFFELTURM? KEIN PROBLEM.");
}
register(renderAt);
