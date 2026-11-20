// "Was wäre, wenn alle Vulkane gleichzeitig ausbrechen?"
import {
  THREE,
  W,
  H,
  mulberry32,
  clamp,
  lerp,
  smooth,
  V,
  C,
  std,
  box,
  cone,
  cyl,
  fmt,
  makeRenderer,
  skyDome,
  starField,
  textSprite,
  setHud,
  register,
} from "./lib.js";

const renderer = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 20000);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-50, 60, 40);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a5a30, 1.0);
scene.add(hemi);
const lavaLight = new THREE.PointLight(0xff6a20, 0, 200, 1.5);
scene.add(lavaLight);

function glowTex(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.3, outer);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glow = (inner, outer, size) => {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex(inner, outer),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  s.scale.set(size, size, 1);
  return s;
};

// =============== globe stage ===============
const globe = new THREE.Group();
scene.add(globe);
const stars = starField(globe, 2200, 9000, 6);
const earth = new THREE.Group();
globe.add(earth);
const LL = (lat, lon, r) => {
  const la = THREE.MathUtils.degToRad(lat),
    lo = THREE.MathUtils.degToRad(lon);
  return V(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
};
{
  const geo = new THREE.IcosahedronGeometry(10, 4).toNonIndexed();
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 30,
      y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 30,
      z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 30;
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
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  earth.add(new THREE.Mesh(geo, std(0xffffff, { vertexColors: true })));
}
// 1,350 volcanoes, mostly along the Ring of Fire and a few other belts
const VN = 1350;
const volcPts = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({
    size: 5,
    sizeAttenuation: false,
    map: glowTex("rgba(255,240,180,1)", "rgba(255,90,20,0.9)"),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
{
  const belts = [
    [-55, -72, 10, -78], // Andes
    [10, -90, 20, -105], // Central America / Mexico
    [35, -122, 60, -150], // US west coast, Alaska
    [52, -180, 58, -155], // Aleutians
    [30, 130, 60, 160], // Japan, Kamchatka
    [-10, 95, 15, 125], // Indonesia, Philippines
    [-45, 172, -15, 168], // New Zealand, Pacific islands
    [63, -22, 65, -15], // Iceland
    [37, 12, 41, 16], // Italy
    [-5, 36, 15, 40], // East Africa
  ];
  const rnd = mulberry32(19);
  const pos = new Float32Array(VN * 3);
  for (let i = 0; i < VN; i++) {
    const b = belts[i % belts.length];
    const k = rnd();
    const p = LL(
      lerp(b[0], b[2], k) + (rnd() - 0.5) * 6,
      lerp(b[1], b[3], k) + (rnd() - 0.5) * 6,
      10.05,
    );
    pos.set([p.x, p.y, p.z], i * 3);
  }
  volcPts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  volcPts.frustumCulled = false;
  earth.add(volcPts);
}
const haze = new THREE.Mesh(
  new THREE.SphereGeometry(10.5, 48, 32),
  new THREE.MeshBasicMaterial({
    color: 0x8a7a68,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }),
);
globe.add(haze);

// =============== landscape (Eifel) at origin ===============
const land = new THREE.Group();
scene.add(land);
const sky = skyDome(land, "#4f8fd6", "#e2eef4", { radius: 4000 });
const redSky = skyDome(land, "#3a1830", "#ff5a2a", { radius: 3990 });
const groundMat = std(0x6a9a4e);
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), groundMat);
  g.rotation.x = -Math.PI / 2;
  land.add(g);
}
const greenMats = [groundMat];
{
  const rnd = mulberry32(5);
  for (let i = 0; i < 14; i++) {
    const m = std(0x5f8f44);
    greenMats.push(m);
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), m);
    h.scale.set(14 + rnd() * 14, 4 + rnd() * 5, 12 + rnd() * 10);
    h.position.set(-120 + i * 18 + rnd() * 8, 0, -60 - rnd() * 60);
    land.add(h);
  }
  // maar lake
  const lake = new THREE.Mesh(new THREE.CircleGeometry(9, 32), std(0x2a5f9a, { roughness: 0.25 }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-18, 0.05, -20);
  land.add(lake);
}
// village
const roofMats = [];
{
  const rnd = mulberry32(8);
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const w = 2 + rnd() * 1.5;
    const body = box(w, 2.2, 2.6, [0xf0e6d6, 0xe8dcc8, 0xd8cbb4][i % 3]);
    body.position.y = 1.1;
    const rm = std(0xa04a3a);
    roofMats.push(rm);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2, 1.6, 4), rm);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w * 0.75, 1, 0.95);
    roof.position.y = 3;
    g.add(body, roof);
    g.position.set(4 + (i % 4) * 5 + rnd(), 0, 4 - Math.floor(i / 4) * 5 - rnd());
    g.rotation.y = rnd() * 0.4;
    land.add(g);
  }
  const church = box(2.4, 8, 2.4, 0xe8dcc8);
  church.position.set(12, 4, -14);
  const spire = cone(1.7, 4, 0x4a4a52, 4);
  spire.position.set(12, 10, -14);
  spire.rotation.y = Math.PI / 4;
  land.add(church, spire);
}
// wheat field
const wheatN = 900;
const wheatMat = std(0xe0b84a);
const wheat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 1, 0.06), wheatMat, wheatN);
wheat.frustumCulled = false;
land.add(wheat);
const wheatPos = [];
{
  const rnd = mulberry32(31);
  for (let i = 0; i < wheatN; i++) wheatPos.push([-14 + rnd() * 16, 12 - rnd() * 14, rnd()]);
}
// the volcano behind the village
const VX = -10,
  VZ = -150;
{
  const v = cone(60, 34, 0x5a4a44, 12);
  v.position.set(VX, 17, VZ);
  land.add(v);
  const crater = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 1, 16),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a }),
  );
  crater.position.set(VX, 30, VZ);
  land.add(crater);
}
const craterGlow = glow("rgba(255,220,140,1)", "rgba(255,90,20,0.7)", 70);
craterGlow.position.set(VX, 36, VZ);
land.add(craterGlow);
const lavaN = 240;
const lava = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(1, 0),
  new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
  lavaN,
);
lava.frustumCulled = false;
land.add(lava);
const lavaData = [];
{
  const rnd = mulberry32(44);
  for (let i = 0; i < lavaN; i++)
    lavaData.push({
      a: rnd() * 6.28,
      v: 8 + rnd() * 14,
      up: 22 + rnd() * 18,
      ph: rnd() * 3,
      s: 0.6 + rnd() * 1.4,
    });
}
const eifel = textSprite("EIFEL", "#ffd27a", 24, 6);
eifel.position.set(VX, 62, VZ);
land.add(eifel);
const sunDisc = glow("rgba(255,200,120,1)", "rgba(255,80,30,0.6)", 120);
sunDisc.position.set(220, 30, -900);
land.add(sunDisc);
// falling ash / snow
const flakeN = 700;
const flakes = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(0.08, 0),
  std(0xffffff),
  flakeN,
);
flakes.frustumCulled = false;
scene.add(flakes);
const flakeData = [];
{
  const rnd = mulberry32(51);
  for (let i = 0; i < flakeN; i++)
    flakeData.push([rnd() * 40 - 20, rnd(), rnd() * 30 - 15, 0.6 + rnd() * 0.8]);
}

// =============== ash column (x = 2000, units = km) ===============
const ashSt = new THREE.Group();
ashSt.position.x = 2000;
scene.add(ashSt);
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), std(0x7a7a5a));
  g.rotation.x = -Math.PI / 2;
  ashSt.add(g);
  const v = cone(8, 3, 0x4a3e3a, 12);
  v.position.y = 1.5;
  ashSt.add(v);
  for (const h of [10, 20, 30, 40]) {
    const tick = textSprite(h + " km", "#ffffff", 12, 3);
    tick.position.set(-14, h, 0);
    const line = box(4, 0.08, 0.08, 0xffffff);
    line.position.set(-10, h, 0);
    ashSt.add(tick, line);
  }
}
const puffN = 260;
const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), std(0x6a6460), puffN);
puffs.frustumCulled = false;
ashSt.add(puffs);
const ashGlow = glow("rgba(255,200,120,1)", "rgba(255,80,20,0.6)", 14);
ashGlow.position.y = 3.5;
ashSt.add(ashGlow);

// =============== airport (x = 4000) ===============
const port = new THREE.Group();
port.position.x = 4000;
scene.add(port);
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), std(0x8a8a7a));
  g.rotation.x = -Math.PI / 2;
  port.add(g);
  const apron = box(120, 0.1, 40, 0x6a6a6a);
  apron.position.set(0, 0.05, 0);
  port.add(apron);
  const term = box(110, 10, 14, 0xb8c0c8);
  term.position.set(0, 5, -30);
  port.add(term);
  for (let i = 0; i < 6; i++) {
    const pl = new THREE.Group();
    const body = cyl(1.4, 1.4, 22, 0xf2f2f2, 12);
    body.rotation.x = Math.PI / 2;
    body.position.y = 3;
    const nose = cone(1.4, 3, 0xf2f2f2, 12);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 3, 12.5);
    const wing = box(22, 0.3, 4, 0xe0e0e0);
    wing.position.set(0, 2.6, 1);
    const tail = box(0.3, 5, 3, 0x2a5ab0);
    tail.position.set(0, 5.5, -10);
    const stab = box(8, 0.25, 2.2, 0xe0e0e0);
    stab.position.set(0, 3.4, -10.2);
    pl.add(body, nose, wing, tail, stab);
    pl.position.set(-50 + i * 20, 0, 4);
    port.add(pl);
  }
  const sign = textSprite("GESTRICHEN", "#ff6a5a", 30, 7.5);
  sign.position.set(0, 22, -30);
  port.add(sign);
}

// =============== CO2 bars (x = 6000) ===============
const co2 = new THREE.Group();
co2.position.x = 6000;
scene.add(co2);
const barV = box(4, 1, 4, 0xff7a2a);
const barH = box(4, 1, 4, 0x6a6a72);
barV.position.x = -5;
barH.position.x = 5;
co2.add(barV, barH);
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std(0x3a3a40));
  g.rotation.x = -Math.PI / 2;
  co2.add(g);
  const lv = textSprite("VULKANE", "#ffb07a", 8, 2);
  lv.position.set(-5, -0.0, 4);
  lv.center.set(0.5, 1.2);
  const lh = textSprite("MENSCHEN", "#ffffff", 8, 2);
  lh.position.set(5, -0.0, 4);
  lh.center.set(0.5, 1.2);
  co2.add(lv, lh);
}

// =============== story ===============
const dummy = new THREE.Object3D();
const STAGES = [
  [0, 14.3, "globe"],
  [14.3, 24.3, "land"],
  [24.3, 29.8, "ash"],
  [29.8, 36.3, "port"],
  [36.3, 41.8, "globe"],
  [41.8, 53.8, "land"],
  [53.8, 60.3, "globe"],
  [60.3, 65, "land"],
  [65, 70.3, "co2"],
  [70.3, 80, "land"],
];
const stageAt = (t) => STAGES.find((s) => t >= s[0] && t < s[1])[2];
const green = C(0x5f8f44),
  white = C(0xf2f4f6);

function renderAt(t) {
  const st = stageAt(t);
  globe.visible = st === "globe";
  land.visible = st === "land";
  ashSt.visible = st === "ash";
  port.visible = st === "port";
  co2.visible = st === "co2";
  scene.background =
    st === "globe"
      ? C(0x02030a)
      : st === "co2"
        ? C(0x14141a)
        : st === "ash"
          ? C(0x8a8478)
          : st === "port"
            ? C(0x9a8a74)
            : null;
  scene.fog =
    st === "port"
      ? new THREE.Fog(0x9a8a74, 30, 260)
      : st === "ash"
        ? new THREE.Fog(0x8a8478, 60, 400)
        : null;

  // ----- globe -----
  const vk = smooth(5.4, 9.2, t);
  volcPts.geometry.setDrawRange(0, Math.floor(VN * vk));
  volcPts.material.size = 9 + Math.sin(t * 6) * 1.5;
  earth.rotation.y = 3.0 + t * 0.03;
  haze.material.opacity = t < 36.3 ? 0 : t < 53.8 ? 0.55 * smooth(36.5, 40, t) : 0.78;
  hemi.intensity = st === "globe" ? 0.35 : 1.0;

  // ----- landscape -----
  const red = t >= 41.8 && t < 48.3;
  const snowK = t < 48.3 ? 0 : smooth(48.6, 53, t);
  const dim = t < 36 ? 1 : red ? 1 : lerp(0.75, 0.42, smooth(48.3, 60, t));
  sky.visible = !red;
  redSky.visible = red;
  sky.material.color.setRGB(dim, dim, dim * 1.02);
  sunDisc.visible = red;
  sun.color.set(red ? 0xff8a5a : 0xfff1dc);
  sun.intensity = st === "land" ? 2.6 * (red ? 0.7 : dim) : 2.6;
  for (const m of greenMats) m.color.copy(green).lerp(white, snowK);
  for (const m of roofMats) m.color.set(0xa04a3a).lerp(white, snowK);
  // eruption
  const erupt = t >= 14.3;
  lava.visible = craterGlow.visible = erupt && t < 48.3;
  lavaLight.intensity = st === "land" && t < 48.3 ? 900 : 0;
  lavaLight.position.set(VX, 50, VZ + 20);
  lavaData.forEach((d, i) => {
    const u = (t * 0.9 + d.ph) % 3;
    dummy.position.set(
      VX + Math.cos(d.a) * d.v * u,
      31 + d.up * u - 0.5 * 26 * u * u,
      VZ + Math.sin(d.a) * d.v * u,
    );
    dummy.scale.setScalar(dummy.position.y < 18 ? 0.0001 : d.s);
    dummy.updateMatrix();
    lava.setMatrixAt(i, dummy.matrix);
  });
  lava.instanceMatrix.needsUpdate = true;
  eifel.visible = t >= 14.6 && t < 24.3;
  // wheat: green-gold, then dying in the cold
  const die = smooth(60.5, 64, t);
  wheatMat.color.set(0xe0b84a).lerp(C(0x6a5a48), die);
  wheat.visible = t >= 41.8;
  wheatPos.forEach(([x, z, r], i) => {
    dummy.position.set(x, 0.45 * (1 - die * 0.5), z);
    dummy.rotation.set(0, 0, (r - 0.5) * 0.2 + die * (0.6 + r * 0.6));
    dummy.scale.set(1, 0.9 * (1 - die * 0.4), 1);
    dummy.updateMatrix();
    wheat.setMatrixAt(i, dummy.matrix);
  });
  wheat.instanceMatrix.needsUpdate = true;

  // ----- ash column -----
  const ak = smooth(24.5, 29.5, t);
  const top = 40 * ak;
  for (let i = 0; i < puffN; i++) {
    const r = mulberry32(i + 7);
    const f = i / puffN;
    const h = f * 44;
    if (h > top + 0.5) dummy.scale.setScalar(0.0001);
    else {
      const umbrella = h > 30 ? (h - 30) / 14 : 0;
      const spread = 2 + h * 0.08 + umbrella * 14;
      dummy.position.set(
        (r() - 0.5) * spread * 2,
        Math.min(h, 40) + (r() - 0.5) * 2,
        (r() - 0.5) * spread * 1.4,
      );
      dummy.scale.setScalar(1.6 + h * 0.07 + umbrella * 2.5);
    }
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    puffs.setMatrixAt(i, dummy.matrix);
  }
  puffs.instanceMatrix.needsUpdate = true;

  // ----- CO2 -----
  const ck = smooth(65.3, 68.5, t);
  barV.scale.y = 0.4;
  barV.position.y = 0.2;
  barH.scale.y = Math.max(0.4, 40 * ck);
  barH.position.y = barH.scale.y / 2;

  // ----- camera -----
  let pos, look;
  const orbit = (a, d, h) => V(Math.sin(a) * d, h, Math.cos(a) * d);
  if (st === "globe") {
    pos =
      t < 14.3
        ? orbit(0.2, lerp(42, 34, smooth(0, 14.3, t)), lerp(18, 10, smooth(0, 14.3, t)))
        : orbit(0.1, 36, 8);
    look = V(0, 0, 0);
  } else if (st === "land") {
    if (t < 24.3) {
      const k = smooth(14.3, 24.3, t);
      pos = V(lerp(30, 24, k), lerp(8, 14, k), lerp(40, 46, k));
      look = V(0, lerp(16, 26, k), -60);
    } else if (t < 48.3) {
      const k = smooth(41.8, 48.3, t);
      pos = V(lerp(-6, -2, k), 4, 26);
      look = V(lerp(40, 60, k), 10, -100);
    } else if (t < 60.3) {
      const k = smooth(48.3, 60.3, t);
      pos = V(lerp(26, 20, k), lerp(7, 10, k), lerp(32, 36, k));
      look = V(0, 8, -40);
    } else if (t < 65) {
      const k = smooth(60.3, 65, t);
      pos = V(lerp(-2, -4, k), lerp(3.5, 2.6, k), lerp(20, 17, k));
      look = V(-6, 0.6, 2);
    } else {
      const k = smooth(70.3, 80, t);
      pos = V(lerp(20, 14, k), lerp(10, 18, k), lerp(40, 56, k));
      look = V(0, 12, -60);
    }
  } else if (st === "ash") {
    const k = smooth(24.3, 29.8, t);
    pos = V(2000 + lerp(20, 30, k), lerp(4, 10, k), lerp(70, 90, k));
    look = V(2000, lerp(10, 24, k), 0);
  } else if (st === "port") {
    const k = smooth(29.8, 36.3, t);
    pos = V(4000 + lerp(-30, -18, k), lerp(9, 12, k), lerp(56, 62, k));
    look = V(4000, 6, -6);
  } else {
    pos = V(6000 + 14, 18, 62);
    look = V(6000, 17, 0);
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  stars.position.copy(cam.position);
  sky.position.copy(cam.position);
  redSky.position.copy(cam.position);

  // falling ash (grey) / snow (white) around the camera
  const fall = st === "port" || (st === "land" && t >= 48.3) ? 1 : 0;
  flakes.visible = fall > 0;
  flakes.material.color.set(st === "port" ? 0x5a5650 : 0xffffff);
  if (fall)
    flakeData.forEach(([x, ph, z, sp], i) => {
      const y = 14 * (1 - ((ph + t * 0.08 * sp) % 1));
      const fwd = V(0, 0, -1).applyQuaternion(cam.quaternion);
      dummy.position.set(
        cam.position.x + fwd.x * 14 + x * 0.6,
        cam.position.y - 6 + y,
        cam.position.z + fwd.z * 14 + z * 0.6,
      );
      dummy.scale.setScalar(st === "port" ? 0.9 : 0.8);
      dummy.updateMatrix();
      flakes.setMatrixAt(i, dummy.matrix);
    });
  flakes.instanceMatrix.needsUpdate = true;
  renderer.render(scene, cam);

  // ----- HUD -----
  if (t < 9.6) setHud(t, "AKTIVE VULKANE", fmt(VN * vk), "BRECHEN GLEICHZEITIG AUS");
  else if (t < 14.3)
    setHud(t, "IN DER NÄHE EINES VULKANS", "800 Mio.", "MENSCHEN · WENIGER ALS 100 KM");
  else if (t < 19)
    setHud(t, "VULKANEIFEL", "≈ 350 Vulkane", "LETZTER GROSSER AUSBRUCH: VOR 13.000 J.");
  else if (t < 24.3) setHud(t, "LAVA", "langsam", "MAN KANN IHR MEIST AUSWEICHEN");
  else if (t < 29.8)
    setHud(t, "ASCHESÄULE", Math.round(top) + " km", "FLUGZEUGE FLIEGEN IN 10–12 KM");
  else if (t < 36.3)
    setHud(
      t,
      "GESTRICHENE FLÜGE",
      fmt(clamp((t - 29.9) / 3) * 100000),
      "2010: EIN VULKAN AUF ISLAND",
    );
  else if (t < 41.8) setHud(t, "HIMMEL", "Schwefeldunst", "SONNENLICHT WIRD SCHWÄCHER");
  else if (t < 48.3) setHud(t, "SONNENUNTERGANG", "blutrot", "SCHWEFEL STREUT DAS LICHT");
  else if (t < 53.8) setHud(t, "JAHR OHNE SOMMER", "1816", "EIN VULKAN: TAMBORA");
  else if (t < 60.3) setHud(t, "JETZT", "alle 1.350", "GLEICHZEITIG");
  else if (t < 65) setHud(t, "ERNTE", "Missernten", "JAHRELANG ZU KALT");
  else if (t < 70.3) setHud(t, "CO₂ PRO JAHR", "über 100×", "MENSCHEN STATT ALLE VULKANE");
  else setHud(t, "GRÖSSTE GEFAHR", "Kälte", "NICHT DIE LAVA");
}
register(renderAt);
