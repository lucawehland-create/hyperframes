// "Was wäre, wenn du mit Lichtgeschwindigkeit reisen könntest?"
// One stage per destination; each stage is a group shown only during its time range.
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
  fmt,
  makeRenderer,
  starField,
  textSprite,
  setHud,
  register,
} from "./lib.js";

const renderer = makeRenderer();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);
const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 30000);
const sunLight = new THREE.DirectionalLight(0xfff4e0, 3);
sunLight.position.set(-1, 0.3, 1);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x404a66, 0.6));
const stars = starField(scene, 2600, 12000, 5);

// ---------- helpers ----------
function glowTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.25, outer);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
function glow(inner, outer, size) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(inner, outer),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  s.scale.set(size, size, 1);
  return s;
}
function planet(r, pick, detail = 3) {
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
function star(r, color, glowIn, glowOut, glowSize) {
  const g = new THREE.Group();
  g.add(
    new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshBasicMaterial({ color })),
  );
  g.add(glow(glowIn, glowOut, glowSize));
  return g;
}
function galaxy(n, R, seed, tilt) {
  const rnd = mulberry32(seed);
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const pos = new Float32Array(n * 3),
    col = new Float32Array(n * 3);
  const core = new THREE.Color(0xffe2a8),
    arm = new THREE.Color(0x9ab8ff),
    c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = R * Math.pow(rnd(), 0.75);
    const a = (i % 2) * Math.PI + (r / R) * 5.2 + gauss() * 0.45 * (1 - (r / R) * 0.4);
    const th = (1 - r / R) * R * 0.08 + R * 0.01;
    pos.set([Math.cos(a) * r, gauss() * th, Math.sin(a) * r], i * 3);
    c.copy(core).lerp(arm, clamp(r / (R * 0.6)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(
    g,
    new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  pts.frustumCulled = false;
  const grp = new THREE.Group();
  grp.add(pts, glow("rgba(255,236,190,0.9)", "rgba(255,200,120,0.25)", R * 0.7));
  grp.rotation.set(tilt[0], tilt[1], tilt[2]);
  return grp;
}

// ---------- stages ----------
const stages = [];
const stage = (from, to) => {
  const g = new THREE.Group();
  g.userData = { from, to };
  scene.add(g);
  stages.push(g);
  return g;
};
const earthPick = (x, y, z) => {
  if (Math.abs(y) > 0.86) return 0xf2f6fa;
  const f = Math.sin(x * 3.1 + 1) + Math.sin(y * 4.3 + 2) + Math.sin(z * 3.7);
  return f > 0.9 ? (f > 1.6 ? 0x8a7a4a : 0x4f8a3a) : 0x2a5fb0;
};
// S1: around the Earth
const S1 = stage(0, 14.3);
const earth1 = planet(10, earthPick, 4);
S1.add(earth1, glow("rgba(120,180,255,0.35)", "rgba(80,140,255,0.12)", 30));
// S2: to the Moon
const S2 = stage(14.3, 19);
const MOON = V(28, 6, -150);
const earth2 = planet(10, earthPick, 4);
const moon = planet(
  3,
  (x, y, z) => (Math.sin(x * 9) + Math.sin(z * 7 + y * 5) > 1.2 ? 0x8a8a8a : 0xbdbdbd),
  3,
);
moon.position.copy(MOON);
S2.add(earth2, moon);
// S3: towards the Sun
const S3 = stage(19, 24.3);
const sun3 = star(120, 0xfff2c0, "rgba(255,240,200,1)", "rgba(255,180,60,0.35)", 900);
sun3.position.set(0, 0, -900);
S3.add(sun3);
// S4: Mars
const S4 = stage(24.3, 29.8);
S4.add(
  planet(
    6,
    (x, y, z) =>
      Math.abs(y) > 0.9 ? 0xf0e6e0 : Math.sin(x * 5 + z * 3) > 0.5 ? 0x8a3a20 : 0xc0582e,
    4,
  ),
);
const sun4 = star(6, 0xfff2c0, "rgba(255,240,200,1)", "rgba(255,180,60,0.3)", 80);
sun4.position.set(-300, 60, -700);
S4.add(sun4);
// S5: Neptune
const S5 = stage(29.8, 36.3);
S5.add(
  planet(
    14,
    (x, y) => (Math.sin(y * 9) > 0.6 ? 0x6a9ae8 : Math.sin(y * 4 + 1) > 0.7 ? 0x2a4ab0 : 0x3a6ad8),
    4,
  ),
);
{
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(20, 23, 64),
    new THREE.MeshBasicMaterial({
      color: 0x8a9ab8,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = Math.PI / 2 - 0.35;
  S5.add(ring);
  const s = star(1.5, 0xfff2c0, "rgba(255,240,200,1)", "rgba(255,180,60,0.3)", 22);
  s.position.set(-200, 30, -500);
  S5.add(s);
}
// S6: leaving the solar system, the Sun shrinks behind you
const S6 = stage(36.3, 41.8);
const sun6 = star(4, 0xfff2c0, "rgba(255,240,200,1)", "rgba(255,180,60,0.3)", 60);
sun6.position.set(0, 0, -400);
S6.add(sun6);
// S7: Proxima Centauri
const S7 = stage(41.8, 48.3);
S7.add(star(8, 0xff7a4a, "rgba(255,140,90,1)", "rgba(255,70,30,0.35)", 70));
const proxB = planet(1.6, (x, y, z) => (Math.sin(x * 6 + z * 4) > 0.3 ? 0x8a6a5a : 0x6a5a6a), 3);
proxB.position.set(18, 2, 10);
S7.add(proxB);
// S8: Polaris
const S8 = stage(48.3, 53.8);
const polaris = star(20, 0xfffbe8, "rgba(255,255,240,1)", "rgba(255,230,160,0.35)", 260);
polaris.position.set(0, 0, -80);
S8.add(polaris);
// S9 + S10: galaxies
const S9 = stage(53.8, 80);
const milky = galaxy(26000, 400, 7, [0, 0, 0]);
S9.add(milky);
const andro = galaxy(22000, 520, 11, [0.9, 0.4, 0.3]);
andro.position.set(1500, 300, -2000);
S9.add(andro);
const lbl = (text, color, w) => {
  const s = textSprite(text, color, w, w / 4);
  s.material.depthTest = false;
  return s;
};
const mwLabel = lbl("MILCHSTRASSE", "#ffffff", 300);
mwLabel.position.set(0, 160, 420);
const anLabel = lbl("ANDROMEDA", "#ffd27a", 340);
anLabel.position.set(1500, 760, -2000);
S9.add(mwLabel, anLabel);

// the traveller (you, as light)
const you = new THREE.Group();
you.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  ),
);
const youGlow = glow("rgba(255,255,255,1)", "rgba(140,200,255,0.4)", 5);
you.add(youGlow);
scene.add(you);
const TRAIL = 90;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
const trailCol = new Float32Array(TRAIL * 3);
for (let i = 0; i < TRAIL; i++) {
  const k = 1 - i / TRAIL;
  trailCol.set([0.6 * k, 0.85 * k, 1 * k], i * 3);
}
trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
const trail = new THREE.Line(
  trailGeo,
  new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
  }),
);
trail.frustumCulled = false;
scene.add(trail);

// ---------- story ----------
function youAt(t) {
  if (t < 9.6) return V(14, 5 + Math.sin(t * 2) * 0.3, 10);
  if (t < 14.3) {
    const a = (t - 9.6) * Math.PI * 2 * 1.1 + 0.95;
    return V(Math.sin(a) * 14, Math.cos(a) * 14 * 0.35 + 3, Math.cos(a) * 14);
  }
  if (t < 19) {
    const k = clamp((t - 14.3) / 1.3);
    return V(12, 2, 4).lerp(V(MOON.x - 4, MOON.y + 1, MOON.z + 4), k);
  }
  if (t < 24.3) return V(0, 0, -smooth(19.2, 24.3, t) * 520);
  if (t < 29.8) return V(-40, 6, 80).lerp(V(9, 2, 10), smooth(24.3, 28, t));
  if (t < 36.3) return V(-60, 10, 60).lerp(V(26, 4, 22), smooth(29.8, 35, t));
  if (t < 41.8) return V(0, 0, 0);
  if (t < 48.3) return V(-30, 5, 60).lerp(V(-13, 3, 22), smooth(41.8, 47, t));
  if (t < 53.8) return V(-6, -4, 60).lerp(V(-14, -6, 0), smooth(48.3, 53.5, t));
  if (t < 60.3) return V(-400, 6, 0).lerp(V(400, 6, 0), smooth(54.3, 60, t));
  if (t < 65) return V(0, 0, 0);
  return V(0, 0, 0).lerp(andro.position, smooth(65, 70.3, t));
}

function renderAt(t) {
  for (const s of stages) s.visible = t >= s.userData.from && t < s.userData.to;
  earth1.rotation.y = earth2.rotation.y = t * 0.08;
  milky.rotation.y = andro.children[0].rotation.y = t * 0.01;
  sun6.scale.setScalar(lerp(1.4, 0.06, smooth(36.3, 41.5, t)));
  mwLabel.visible = t >= 60.3 && t < 74;
  anLabel.visible = false;

  const p = youAt(t);
  you.position.copy(p);
  const big = t >= 53.8 ? (t < 60.3 ? 40 : 90) : 5;
  youGlow.scale.set(big, big, 1);
  you.children[0].visible = t < 53.8;
  // trail: the path behind you (sampled backwards in time)
  const tp = trailGeo.attributes.position;
  const span = t < 14.3 ? 0.35 : t >= 53.8 ? 5.5 : 1.2;
  for (let i = 0; i < TRAIL; i++) {
    const tt = Math.max(t - (i / TRAIL) * span, t >= 60.3 ? 65 : t >= 53.8 ? 53.8 : 0);
    const q = (tt < 9.6 && t >= 9.6) || (tt < 53.8 && t >= 53.8) ? p : youAt(tt);
    tp.setXYZ(i, q.x, q.y, q.z);
  }
  tp.needsUpdate = true;
  trail.visible = t >= 9.6 && !(t >= 36.3 && t < 41.8);

  let pos, look;
  if (t < 14.3) {
    const k = smooth(0, 14.3, t);
    pos = V(lerp(6, 2, k), lerp(14, 10, k), lerp(46, 38, k));
    look = V(2, lerp(4, 1, k), 0);
  } else if (t < 19) {
    const k = smooth(14.3, 16.5, t);
    pos = V(lerp(-10, MOON.x - 18, k), lerp(14, MOON.y + 8, k), lerp(42, MOON.z + 38, k));
    look = V(lerp(10, MOON.x, k), lerp(0, MOON.y, k), lerp(-60, MOON.z, k));
  } else if (t < 24.3) {
    pos = V(p.x + 4, p.y + 3, p.z + 22);
    look = V(0, -45, p.z - 200);
  } else if (t < 29.8) {
    const k = smooth(24.3, 29.8, t);
    pos = V(lerp(-18, -12, k), lerp(8, 5, k), lerp(36, 28, k));
    look = V(0, 1, 0);
  } else if (t < 36.3) {
    const k = smooth(29.8, 36.3, t);
    pos = V(lerp(22, 30, k), lerp(14, 10, k), lerp(70, 60, k));
    look = V(0, 0, 0);
  } else if (t < 41.8) {
    pos = V(3, 2, 14);
    look = V(0, 0, -100);
  } else if (t < 48.3) {
    const k = smooth(41.8, 48.3, t);
    pos = V(lerp(-28, -24, k), lerp(9, 7, k), lerp(52, 44, k));
    look = V(0, -9, 0);
  } else if (t < 53.8) {
    const k = smooth(48.3, 53.8, t);
    pos = V(lerp(-10, -16, k), lerp(-2, -4, k), lerp(90, 40, k));
    look = V(0, -32, -80);
  } else if (t < 60.3) {
    const k = smooth(53.8, 60.3, t);
    pos = V(lerp(-60, 0, k), lerp(620, 520, k), lerp(760, 820, k));
    look = V(0, -40, 0);
  } else if (t < 70.3) {
    const k = smooth(60.3, 70.3, t);
    pos = V(lerp(-500, -700, k), lerp(900, 1200, k), lerp(1500, 1700, k));
    look = V(lerp(500, 700, k), 0, lerp(-700, -900, k));
  } else {
    const k = smooth(70.3, 80, t);
    pos = V(lerp(-700, -2000, k), lerp(1200, 3200, k), lerp(1700, 4200, k));
    look = V(700, 0, -900);
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  stars.position.copy(cam.position);
  renderer.render(scene, cam);

  // HUD
  const cnt = (a, b, from) => lerp(a, b, smooth(from + 0.2, from + 4, t));
  const dec = (x, d = 1) => x.toFixed(d).replace(".", ",");
  if (t < 9.6) setHud(t, "REISEZEIT", "0 s", "300.000 KM PRO SEKUNDE");
  else if (t < 14.3) {
    const s = clamp((t - 9.6) / 4);
    setHud(t, "REISEZEIT", dec(s) + " s", "RUNDEN UM DIE ERDE: " + dec(s * 7.5));
  } else if (t < 19)
    setHud(t, "REISEZEIT", dec(1.3 * clamp((t - 14.3) / 1.3)) + " s", "MOND: 384.400 KM");
  else if (t < 24.3) {
    const s = Math.round(cnt(0, 500, 19));
    setHud(t, "REISEZEIT", Math.floor(s / 60) + " min " + (s % 60) + " s", "SONNE: 150 MIO. KM");
  } else if (t < 29.8) setHud(t, "REISEZEIT", "3–22 min", "MARS: 55–400 MIO. KM");
  else if (t < 36.3)
    setHud(t, "REISEZEIT", "≈ " + Math.round(cnt(0, 4, 29.8)) + " h", "NEPTUN: 4,5 MRD. KM");
  else if (t < 41.8) setHud(t, "REISEZEIT", Math.round(cnt(1, 365, 36.3)) + " Tage", "NUR LEERE");
  else if (t < 48.3) setHud(t, "REISEZEIT", dec(cnt(0, 4.2, 41.8)) + " Jahre", "PROXIMA CENTAURI");
  else if (t < 53.8) setHud(t, "REISEZEIT", Math.round(cnt(0, 433, 48.3)) + " Jahre", "POLARSTERN");
  else if (t < 60.3)
    setHud(
      t,
      "REISEZEIT",
      fmt(Math.round(cnt(0, 100, 53.8)) * 1000) + " Jahre",
      "QUER DURCH DIE MILCHSTRASSE",
    );
  else if (t < 65) setHud(t, "REISEZEIT", "? Jahre", "ANDROMEDA");
  else {
    const y = cnt(0, 2.5, 65);
    setHud(t, "REISEZEIT", (y < 1 ? fmt(y * 1e6) : dec(y) + " Mio.") + " Jahre", "ANDROMEDA");
  }
}
register(renderAt);
