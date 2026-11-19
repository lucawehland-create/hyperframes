// "Was wäre, wenn die Erde ein Würfel wäre?"
// Same volume: a cube with side 10,270 km. Gravity still points to the centre, so water
// and air pool in the middle of each face (a sphere around the centre cuts each face in a
// circle), and the flat ground feels steeper towards the edges (45° at the edge midpoint).
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
  ellipsoid,
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
const sun = new THREE.DirectionalLight(0xfff1dc, 2.8);
sun.position.set(60, 20, 40);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a5a30, 0.4);
scene.add(hemi);

// ---------- space stage ----------
const space = new THREE.Group();
scene.add(space);
const stars = starField(space, 2400, 9000, 4);
const R = 10;
const HS = R * Math.cbrt(Math.PI / 6); // half side of the cube with equal volume
const planet = new THREE.Group();
space.add(planet);
const geo = new THREE.IcosahedronGeometry(1, 5).toNonIndexed();
const pos = geo.attributes.position;
const unit = Float32Array.from(pos.array);
const N = pos.count;
const colA = new Float32Array(N * 3),
  colB = new Float32Array(N * 3);
{
  const c = new THREE.Color();
  for (let i = 0; i < N; i += 3) {
    let x = 0,
      y = 0,
      z = 0;
    for (let k = 0; k < 3; k++) {
      x += unit[(i + k) * 3] / 3;
      y += unit[(i + k) * 3 + 1] / 3;
      z += unit[(i + k) * 3 + 2] / 3;
    }
    // A: the Earth as we know it
    const land = Math.sin(x * 3.1 + 1) + Math.sin(y * 4.3 + 2) + Math.sin(z * 3.7) > 0.9;
    c.set(
      Math.abs(y) > 0.86
        ? 0xf2f6fa
        : land
          ? Math.sin(x * 9 + z * 7) > 0.4
            ? 0x8a7a4a
            : 0x4f8a3a
          : 0x2a5fb0,
    );
    for (let k = 0; k < 3; k++) colA.set([c.r, c.g, c.b], (i + k) * 3);
    // B: the cube's ground - green in the face middle, desert, then bare rock at the edges
    const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
    const ax = Math.abs(x) === m ? [y, z] : Math.abs(y) === m ? [x, z] : [x, y];
    const d = Math.hypot(ax[0] / m, ax[1] / m); // 0 at face centre, ~1 at edge midpoint
    const rr = mulberry32(i)();
    if (d < 0.62) c.set(rr > 0.5 ? 0x4f8a3a : 0x5f9a44);
    else if (d < 0.85) c.set(rr > 0.5 ? 0xc8a868 : 0xb89858);
    else if (d < 1.05) c.set(rr > 0.5 ? 0x8a8078 : 0x7a7068);
    else c.set(rr > 0.5 ? 0xd8d8dc : 0xb8b8c0);
    for (let k = 0; k < 3; k++) colB.set([c.r, c.g, c.b], (i + k) * 3);
  }
}
const colors = new THREE.BufferAttribute(new Float32Array(colA), 3);
geo.setAttribute("color", colors);
const ground = new THREE.Mesh(geo, std(0xffffff, { vertexColors: true }));
planet.add(ground);
const water = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1, 5),
  std(0x2a6ab8, { transparent: true, opacity: 0.92, roughness: 0.25 }),
);
planet.add(water);
const air = new THREE.Mesh(
  new THREE.SphereGeometry(1, 48, 32),
  new THREE.MeshBasicMaterial({
    color: 0x8ac8ff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  }),
);
planet.add(air);
// gravity arrows on the front face, pointing at the centre
const arrows = new THREE.Group();
planet.add(arrows);
{
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let i = -2; i <= 2; i++)
    for (let j = -2; j <= 2; j++) {
      const p = V(i * HS * 0.42, j * HS * 0.42, HS + 0.9);
      const dir = p.clone().negate().normalize();
      const a = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), mat);
      shaft.position.y = 0.7;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 8), mat);
      head.position.y = -0.2;
      head.rotation.x = Math.PI;
      a.add(shaft, head);
      a.position.copy(p);
      a.quaternion.setFromUnitVectors(V(0, -1, 0), dir);
      arrows.add(a);
    }
}
const edgeLabel = textSprite("KANTE", "#ffd27a", 6, 1.5);
edgeLabel.position.set(HS * 1.05, HS * 0.55, HS * 1.05);
const cornerLabel = textSprite("ECKE", "#ffd27a", 5, 1.25);
cornerLabel.position.set(HS * 1.12, HS * 1.25, HS * 1.12);
planet.add(edgeLabel, cornerLabel);

// ---------- surface stage: walking towards the edge ----------
const surf = new THREE.Group();
scene.add(surf);
const sky = skyDome(surf, "#4f8fd6", "#e2eef4", { radius: 4000 });
const tilt = new THREE.Group(); // the flat ground, tilted against gravity
surf.add(tilt);
const track = new THREE.Group();
tilt.add(track);
{
  const rnd = mulberry32(12);
  for (let i = -150; i < 400; i++) {
    const s = box(10, 0.2, 200, i % 2 ? 0xb89858 : 0xa88848);
    s.position.set(i * 10, -0.1, 0);
    track.add(s);
    if (rnd() > 0.7) {
      const rock = ellipsoid(0.6 + rnd(), 0.4 + rnd() * 0.5, 0.6 + rnd(), 0x7a7068, 6);
      rock.position.set(i * 10 + rnd() * 8, 0.2, -6 - rnd() * 40);
      track.add(rock);
    }
  }
}
const lake = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), std(0x2a6ab8, { roughness: 0.3 }));
lake.rotation.x = -Math.PI / 2;
surf.add(lake);
const walker = makePerson(mulberry32(6), 1);
surf.add(walker);

// ---------- story ----------
const morphK = (t) => smooth(5.4, 11.8, t);
function setShape(k) {
  for (let i = 0; i < N; i++) {
    const x = unit[i * 3],
      y = unit[i * 3 + 1],
      z = unit[i * 3 + 2];
    const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
    const f = lerp(R, HS / m, k);
    pos.setXYZ(i, x * f, y * f, z * f);
  }
  pos.needsUpdate = true;
}
let lastK = -1,
  lastC = -1;
// walking: the felt slope grows from 0° to 45°
const thetaAt = (t) => lerp(0, 45, smooth(36.6, 53.5, t));

function renderAt(t) {
  const onSurface = t >= 36.3 && t < 53.8;
  space.visible = !onSurface;
  surf.visible = onSurface;
  scene.background = onSurface ? null : new THREE.Color(0x02030a);

  // ----- planet -----
  const k = morphK(t);
  if (k !== lastK) {
    setShape(k);
    lastK = k;
  }
  const ck = smooth(12, 19.5, t);
  if (ck !== lastC) {
    for (let i = 0; i < colA.length; i++) colors.array[i] = lerp(colA[i], colB[i], ck);
    colors.needsUpdate = true;
    lastC = ck;
  }
  const wr = lerp(0.97, 1.1, smooth(19.5, 28, t));
  water.visible = t >= 19.5;
  water.scale.setScalar(HS * wr);
  const ak = smooth(29.8, 31.5, t);
  air.visible = ak > 0.01;
  air.scale.setScalar(HS * 1.24);
  air.material.opacity = 0.16 * ak;
  arrows.visible = t >= 14.3 && t < 24.3;
  arrows.children.forEach((a, i) => a.scale.setScalar(1 + 0.15 * Math.sin(t * 5 + i)));
  edgeLabel.visible = t >= 54.5 && t < 60.3;
  cornerLabel.visible = t >= 70.3 && t < 74.2;
  // spin: slow, but turns a face into the sun for the sunrise
  let ry = t * 0.05;
  if (t >= 60.3 && t < 70.3) ry = lerp(-1.25, 0.55, smooth(60.6, 69.5, t));
  else if (t >= 70.3) ry = 0.55;
  planet.rotation.set(t < 60.3 ? 0.25 : 0, ry, 0);
  hemi.intensity = t >= 60.3 && t < 70.3 ? 0.08 : onSurface ? 1.1 : 0.4;
  sun.position.set(60, onSurface ? 80 : 4, 10);

  // ----- surface -----
  const th = THREE.MathUtils.degToRad(thetaAt(t));
  tilt.rotation.z = th;
  const walk = Math.max(0, t - 36.3) * 1.3;
  track.position.x = -walk;
  lake.position.y = -lerp(0.4, 3, smooth(36.3, 53.8, t));
  walker.position.set(0, 0, 0);
  walker.rotation.set(0, Math.PI / 2, -0.08 - th * 0.15);
  walker.position.y = Math.abs(Math.sin(t * 5)) * 0.06;
  // thinner air towards the edge: the sky darkens
  sky.material.color.setScalar(lerp(1, 0.12, smooth(40, 53.5, t)));

  // ----- camera -----
  let p, look;
  const orbit = (ang, dist, h) => V(Math.sin(ang) * dist, h, Math.cos(ang) * dist);
  if (t < 14.3) {
    const kk = smooth(0, 14.3, t);
    p = orbit(lerp(0.2, 0.75, kk), lerp(40, 46, kk), lerp(6, 14, kk));
    look = V(0, 0, 0);
  } else if (t < 24.3) {
    const kk = smooth(14.3, 24.3, t);
    p = V(lerp(16, 10, kk), lerp(10, 12, kk), lerp(30, 32, kk));
    look = V(0, 0, 2);
    planet.rotation.set(0, 0, 0);
  } else if (t < 36.3) {
    const kk = smooth(24.3, 36.3, t);
    p = orbit(lerp(0.9, 1.6, kk), lerp(34, 40, kk), lerp(20, 12, kk));
    look = V(0, 0, 0);
  } else if (onSurface) {
    p = V(0.5, 3, 22);
    look = V(0.5, 1.6, 0);
  } else if (t < 60.3) {
    const kk = smooth(53.8, 60.3, t);
    p = V(lerp(26, 22, kk), lerp(8, 4, kk), lerp(18, 22, kk));
    look = V(HS * 0.6, 0, HS * 0.6);
    planet.rotation.set(0, 0, 0);
  } else if (t < 70.3) {
    p = V(Math.sin(ry) * 34, 8, Math.cos(ry) * 34);
    look = V(0, 0, 0);
  } else {
    const kk = smooth(70.3, 80, t);
    const c = V(HS, HS, HS).applyAxisAngle(V(0, 1, 0), ry);
    p = c
      .clone()
      .multiplyScalar(lerp(1.9, 2.6, kk))
      .add(V(0, lerp(1, 4, kk), 0));
    look = c.clone().multiplyScalar(0.6);
  }
  cam.position.copy(p);
  cam.up.set(0, 1, 0);
  cam.lookAt(look);
  stars.position.copy(cam.position);
  sky.position.copy(cam.position);
  renderer.render(scene, cam);

  // ----- HUD -----
  const deg = thetaAt(t);
  if (t < 5.4) setHud(t, "ERDE", "Kugel", "DURCHMESSER: 12.742 KM");
  else if (t < 14.3) setHud(t, "ERDE", k < 0.5 ? "Kugel" : "Würfel", "SEITENLÄNGE: 10.270 KM");
  else if (t < 24.3) setHud(t, "SCHWERKRAFT", "zur Mitte", "NICHT SENKRECHT ZUM BODEN");
  else if (t < 36.3) setHud(t, "OZEANE", "6", "RUND, IN JEDER FLÄCHENMITTE");
  else if (t < 53.8)
    setHud(
      t,
      "GEFÜHLTE STEIGUNG",
      Math.round(deg) + "°",
      "ABSTAND ZUR MITTE: " + fmt(5135 * Math.tan(THREE.MathUtils.degToRad(deg))) + " KM",
      "DER BODEN IST FLACH",
    );
  else if (t < 60.3) setHud(t, "KANTEN", "> 1.000 km", "GEFÜHLTE HÖHE · KEINE LUFT");
  else if (t < 70.3) setHud(t, "SONNENAUFGANG", "gleichzeitig", "AUF DER GANZEN SEITE");
  else setHud(t, "ECKEN", "Vakuum", "NOCH HÖHER ALS DIE KANTEN");
}
register(renderAt);
