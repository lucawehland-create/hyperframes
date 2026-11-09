// "Was wäre, wenn du in ein Schwarzes Loch fällst?" — the fall, from inside and from outside.
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
const C = (hex) => new THREE.Color(hex);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, ...extra });

// ---------- physics for the HUD (10 solar masses) ----------
const GM = 1.327e21; // m^3/s^2
const RS_KM = 29.5; // Schwarzschild radius
const DIST = [
  [0, 10000],
  [5, 10000],
  [14, 6000],
  [24, 3000],
  [35.8, 1000],
  [36, 300],
  [48, 45],
  [60, 30.2],
];
function distKm(t) {
  if (t <= DIST[0][0]) return 10000;
  for (let i = 1; i < DIST.length; i++)
    if (t <= DIST[i][0]) {
      const [t0, d0] = DIST[i - 1],
        [t1, d1] = DIST[i];
      return Math.exp(lerp(Math.log(d0), Math.log(d1), (t - t0) / (t1 - t0)));
    }
  return 30.2;
}
const tidalG = (km) => (2 * GM * 1.8) / Math.pow(km * 1000, 3) / 9.81;
const clockRate = (km) => Math.sqrt(Math.max(0, 1 - RS_KM / km));

// ---------- renderer & scene ----------
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = C("#010104");
const cam = new THREE.PerspectiveCamera(45, W / H, 0.01, 4000);
scene.add(new THREE.AmbientLight(0x6a6080, 0.6));
const diskLight = new THREE.PointLight(0xffb070, 60, 30, 1.2);
diskLight.position.set(0, 0.5, 0);
scene.add(diskLight);

// stars + a faint galaxy band
const stars = (() => {
  const rnd = mulberry32(5);
  const n = 3200;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x, y, z;
    if (i < 1200) {
      const a = rnd() * Math.PI * 2;
      x = Math.cos(a) * 900;
      z = Math.sin(a) * 900;
      y = (rnd() - 0.5) * 140 + Math.sin(a * 2) * 40;
    } else {
      const th = rnd() * Math.PI * 2,
        ph = Math.acos(2 * rnd() - 1);
      x = 900 * Math.sin(ph) * Math.cos(th);
      y = 900 * Math.cos(ph);
      z = 900 * Math.sin(ph) * Math.sin(th);
    }
    pos.set([x, y, z], i * 3);
    const c = new THREE.Color().setHSL(0.55 + rnd() * 0.15, 0.4, 0.7 + rnd() * 0.3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(
    g,
    new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true }),
  );
  scene.add(p);
  return p;
})();

// ---------- the black hole ----------
const R = 1; // shadow radius (scene units)
const hole = new THREE.Group();
scene.add(hole);
const shadow = new THREE.Mesh(
  new THREE.SphereGeometry(R, 48, 32),
  new THREE.MeshBasicMaterial({ color: 0x000000 }),
);
hole.add(shadow);
function diskTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d");
  const rnd = mulberry32(11);
  const cx = 512,
    cy = 512;
  for (let i = 0; i < 1400; i++) {
    const r = 200 + Math.pow(rnd(), 0.7) * 300;
    const a0 = rnd() * Math.PI * 2;
    const len = 0.2 + rnd() * 1.2;
    const k = (r - 200) / 300;
    const col = new THREE.Color().setHSL(lerp(0.13, 0.02, k), 1, lerp(0.85, 0.45, k));
    g.strokeStyle = `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${lerp(0.55, 0.2, k)})`;
    g.lineWidth = 2 + rnd() * 6;
    g.beginPath();
    g.arc(cx, cy, r, a0, a0 + len);
    g.stroke();
  }
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
const diskTex = diskTexture();
const diskMat = new THREE.MeshBasicMaterial({
  map: diskTex,
  transparent: true,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const disk = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), diskMat);
disk.rotation.x = -Math.PI / 2 + 0.18;
hole.add(disk);
// the lensed "halo" of the far side of the disk, always facing the camera
const haloMat = new THREE.MeshBasicMaterial({
  map: diskTex,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  opacity: 0.7,
});
const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), haloMat);
hole.add(halo);
const photon = new THREE.Mesh(
  new THREE.TorusGeometry(R * 1.04, 0.02, 8, 128),
  new THREE.MeshBasicMaterial({
    color: 0xffe2b0,
    transparent: true,
    blending: THREE.AdditiveBlending,
  }),
);
hole.add(photon);

// ---------- the astronaut ----------
const astro = new THREE.Group();
const stretchG = new THREE.Group();
astro.add(stretchG);
const suitMats = [];
{
  const suit = std(0xf2f2ee, { transparent: true });
  const dark = std(0x8a8f99, { transparent: true });
  const visor = std(0xd8a84a, { metalness: 0.8, roughness: 0.2, transparent: true });
  suitMats.push(suit, dark, visor);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.32, 4, 10), suit);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.12), dark);
  pack.position.set(0, 0.02, -0.16);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), suit);
  head.position.y = 0.36;
  const vis = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12, -1, 2, 0.9, 1.2), visor);
  vis.position.set(0, 0.36, 0.06);
  stretchG.add(body, pack, head, vis);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.26, 3, 8), suit);
    arm.position.set(s * 0.22, 0.08, 0);
    arm.rotation.z = s * 0.6;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 3, 8), suit);
    leg.position.set(s * 0.08, -0.36, 0);
    leg.rotation.z = s * 0.15;
    stretchG.add(arm, leg);
  }
  scene.add(astro);
}

// ---------- the friends' ship ----------
const ship = new THREE.Group();
{
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 1.6, 12),
    std(0xc8ccd4, { metalness: 0.5 }),
  );
  hull.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.5, 12),
    std(0xc8ccd4, { metalness: 0.5 }),
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.05;
  const win = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ff }),
  );
  win.position.set(0, 0.2, -0.6);
  const eng = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 16),
    new THREE.MeshBasicMaterial({ color: 0x6ab8ff }),
  );
  eng.position.z = 0.81;
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.5), std(0x9aa0aa));
    wing.position.set(s * 0.5, 0, 0.3);
    ship.add(wing);
  }
  ship.add(hull, nose, win, eng);
  scene.add(ship);
}

// ---------- time and motion ----------
// the astronaut's height above the hole in scene units (falls along -y)
function heightAt(t) {
  if (t < 36) return lerp(11, 4.2, Math.pow(smooth(5, 36, t), 0.9));
  // outside view: creeps toward the shadow edge and never quite reaches it
  return R * 1.06 + 2.2 * Math.exp(-(t - 36) / 5.5);
}
// tumble slows as the outside clock slows
function tumble(t) {
  if (t < 36) return t * 0.5;
  let a = 36 * 0.5;
  const dt = 0.05;
  for (let s = 36; s < t; s += dt) a += 0.5 * clockRate(distKm(s)) * Math.min(dt, t - s);
  return a;
}
const WHITE = C("#f2f2ee"),
  RED = C("#5a0606");

function renderAt(t) {
  disk.rotation.z = t * 0.12;
  halo.rotation.z = -t * 0.12;
  const h = heightAt(t);
  astro.visible = t < 60;
  astro.position.set(t < 36 ? 0.15 : 0.25, h, t < 36 ? 0 : 0.6);
  astro.rotation.set(0, tumble(t), Math.sin(tumble(t) * 0.7) * 0.3);
  // spaghettification: stretched toward the hole (local y)
  const st = smooth(25, 35, t);
  const sy = 1 + 4 * st,
    sxz = 1 - 0.65 * st;
  stretchG.scale.set(sxz, sy, sxz);
  astro.scale.setScalar(t < 24 ? 2.0 : t < 36 ? 1.4 : 1.6);
  if (st > 0) astro.rotation.set(0, tumble(t) * (1 - st), 0);
  // seen from outside: redder, dimmer, fading
  const red = smooth(38, 56, t);
  const fade = 1 - smooth(50, 59.5, t);
  for (const m of suitMats) {
    m.opacity = fade;
    m.emissive.setRGB(0, 0, 0);
  }
  suitMats[0].color.copy(WHITE).lerp(RED, red);
  ship.visible = t >= 36 && t < 60;

  let pos,
    look,
    fov = 45;
  if (t < 5) {
    pos = V(lerp(0.4, 0.2, t / 5), lerp(13.6, 13.2, t / 5), lerp(4.2, 3.9, t / 5));
    look = V(0, 2, 0);
    astro.position.set(0.9, 12.2, 1.5);
  } else if (t < 24) {
    pos = V(-1.6, h + 1.5, 6.5);
    look = V(0, h - 2.9, 0);
    fov = 70;
  } else if (t < 36) {
    pos = V(0.3, h, 7.5);
    look = V(0, h - 1.0, 0);
    fov = 60;
  } else if (t < 60) {
    // from the friends' ship, far away
    const k = smooth(36, 60, t);
    pos = V(lerp(-2.4, -2.0, k), lerp(4.6, 3.8, k), lerp(17, 14.5, k));
    look = V(0, lerp(1.6, 1.2, k), 0);
    ship.position.set(pos.x + 1.15, pos.y - 1.7, pos.z - 4.2);
    ship.scale.setScalar(0.6);
    ship.rotation.set(0.15, 0.1, 0);
  } else if (t < 70) {
    // the dive into the dark
    const k = smooth(60, 69.5, t);
    pos = V(0, lerp(3.2, 0.4, k), lerp(12, 0.6, Math.pow(k, 1.4)));
    look = V(0, lerp(1, 0, k), 0);
  } else {
    const k = smooth(70, 80, t);
    pos = V(0, lerp(26, 30, k), lerp(70, 90, k));
    look = V(0, 0, 0);
  }
  cam.fov = fov;
  cam.updateProjectionMatrix();
  cam.position.copy(pos);
  cam.lookAt(look);
  halo.position.set(0, 0, 0);
  halo.lookAt(cam.position);
  photon.lookAt(cam.position);
  // inside the hole: nothing
  const inside = t >= 60 && t < 70 ? smooth(67.8, 69.4, t) : 0;
  stars.visible = inside < 0.95;
  disk.visible = halo.visible = inside < 0.95;
  renderer.render(scene, cam);
  renderHud(t);
}

// ---------- HUD ----------
const hud = document.getElementById("hud");
const hudLabel = document.getElementById("hud-label");
const hudValue = document.getElementById("hud-value");
const hudSub = document.getElementById("hud-sub");
const hudSub2 = document.getElementById("hud-sub2");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function renderHud(t) {
  let label = "ABSTAND ZUM SCHWARZEN LOCH",
    value,
    sub = " ",
    sub2 = " ";
  if (t < 60) {
    const d = distKm(t);
    value = fmt(d) + " km";
    if (t >= 14) sub = "ZUG FÜSSE GEGEN KOPF: " + fmt(tidalG(d)) + " g";
    if (t >= 36) {
      sub = "SICHT DEINER FREUNDE";
      sub2 = "DEINE UHR LÄUFT MIT " + Math.round(100 * clockRate(d)) + " % TEMPO";
    }
  } else if (t < 70) {
    value = "0 km";
    sub = "EREIGNISHORIZONT ÜBERSCHRITTEN";
  } else {
    label = "NÄCHSTES BEKANNTES SCHWARZES LOCH";
    value = "1.560 Lichtjahre";
    sub = "GAIA BH1";
  }
  hudLabel.textContent = label;
  hudValue.textContent = value;
  hudSub.textContent = sub;
  hudSub2.textContent = sub2;
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
