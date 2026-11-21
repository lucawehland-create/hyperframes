// "Was wäre, wenn in ganz Deutschland 2 Wochen der Strom ausfällt?"
import {
  THREE,
  W,
  H,
  mulberry32,
  lerp,
  smooth,
  V,
  C,
  std,
  box,
  ellipsoid,
  cyl,
  makeRenderer,
  starField,
  textSprite,
  makePerson,
  setHud,
  register,
} from "./lib.js";

const renderer = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 20000);
const moon = new THREE.DirectionalLight(0x9ab0e0, 0.9);
moon.position.set(-30, 60, 40);
scene.add(moon);
const hemi = new THREE.HemisphereLight(0x5a6a9a, 0x1a1a22, 0.5);
scene.add(hemi);
const warm = new THREE.PointLight(0xffa850, 0, 12, 1.6);
scene.add(warm);

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
function liveText(w, h, bg, fg, font = "bold 110px sans-serif") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const g = c.getContext("2d");
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx }));
  let last = "";
  m.userData.set = (text, color = fg) => {
    if (text + color === last) return;
    last = text + color;
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color;
    const lines = text.split("\n");
    lines.forEach((l, i) => g.fillText(l, 256, c.height / 2 + (i - (lines.length - 1) / 2) * 120));
    tx.needsUpdate = true;
  };
  return m;
}
const stage = (x) => {
  const g = new THREE.Group();
  g.position.x = x;
  scene.add(g);
  return g;
};
const ground = (g, color, size = 600) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), std(color));
  m.rotation.x = -Math.PI / 2;
  g.add(m);
};

// ================= A: Germany at night (x = 0) =================
const mapSt = stage(0);
const stars = starField(scene, 1600, 9000, 3);
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
{
  const shape = new THREE.Shape(DE.map((p) => new THREE.Vector2(p.x, -p.y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, std(0x2e4238));
  m.position.y = -0.6;
  mapSt.add(m);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), std(0x0a1424));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.7;
  mapSt.add(sea);
}
function inside(pts, x, z) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    if (a.y > z !== b.y > z && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
const CITIES = [
  [13.4, 52.5, 3],
  [10.0, 53.55, 2.4],
  [11.58, 48.14, 2.4],
  [6.96, 50.94, 2.2],
  [8.68, 50.11, 2],
  [9.18, 48.78, 1.8],
  [6.78, 51.23, 1.8],
  [7.46, 51.51, 2],
  [12.37, 51.34, 1.5],
  [13.74, 51.05, 1.5],
  [9.73, 52.37, 1.5],
  [11.08, 49.45, 1.5],
  [8.8, 53.08, 1.4],
  [8.47, 49.49, 1.3],
];
const dotN = 520;
const dotPos = new Float32Array(dotN * 3),
  dotOff = [];
{
  const rnd = mulberry32(4);
  for (let i = 0; i < dotN; i++) {
    let x, z;
    if (i < 300) {
      const c = CITIES[i % CITIES.length];
      const p = P(c[0], c[1]);
      x = p.x + (rnd() - 0.5) * c[2] * 2.2;
      z = p.y + (rnd() - 0.5) * c[2] * 2.2;
    } else
      do {
        x = -40 + rnd() * 70;
        z = -45 + rnd() * 90;
      } while (!inside(DE, x, z));
    dotPos.set([x, 0.3, z], i * 3);
    dotOff.push(5.5 + ((x + 30) / 60) * 2.6 + rnd() * 0.4);
  }
}
const dotGeo = new THREE.BufferGeometry();
dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPos, 3));
const dotCol = new Float32Array(dotN * 3);
dotGeo.setAttribute("color", new THREE.BufferAttribute(dotCol, 3));
const dots = new THREE.Points(
  dotGeo,
  new THREE.PointsMaterial({
    size: 13,
    sizeAttenuation: false,
    vertexColors: true,
    map: glowTex("rgba(255,240,200,1)", "rgba(255,190,90,0.8)"),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
dots.frustumCulled = false;
mapSt.add(dots);

// ================= B: street (x = 1000) =================
const street = stage(1000);
ground(street, 0x2a2a30);
const winMat = (on) => new THREE.MeshBasicMaterial({ color: on ? 0xffd890 : 0x1a1c26 });
const windows = [];
{
  const rnd = mulberry32(9);
  const road = box(10, 0.05, 200, 0x1a1a1e);
  road.position.y = 0.03;
  street.add(road);
  for (const side of [-1, 1])
    for (let i = 0; i < 10; i++) {
      const h = 9 + rnd() * 8;
      const b = box(7, h, 8, [0x5a5048, 0x4a4a54, 0x6a5a4a][i % 3]);
      const x = side * 10,
        z = 20 - i * 9;
      b.position.set(x, h / 2, z);
      street.add(b);
      for (let fl = 0; fl < Math.floor(h / 3); fl++)
        for (let k = 0; k < 3; k++) {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), winMat(true));
          w.position.set(x - side * 3.52, 2 + fl * 3, z - 2.6 + k * 2.6);
          w.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          w.userData.off = 9.8 + rnd() * 1.4;
          w.userData.on = rnd() > 0.3;
          street.add(w);
          windows.push(w);
        }
    }
}
const lamps = [];
for (let i = 0; i < 6; i++) {
  const p = cyl(0.12, 0.12, 6, 0x3a3a3a, 6);
  p.position.set(5.5, 3, 18 - i * 14);
  const g = glow("rgba(255,230,180,1)", "rgba(255,180,80,0.5)", 5);
  g.position.set(5.5, 6.2, 18 - i * 14);
  street.add(p, g);
  lamps.push(g);
}
// cars and a dead traffic light at the crossing
const cars = [];
{
  const rnd = mulberry32(2);
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Group();
    const body = box(1.9, 0.8, 4.2, [0xb83a3a, 0x3a6ab8, 0xd8d8d8, 0x2a2a2a][i % 4]);
    body.position.y = 0.6;
    const top = box(1.7, 0.6, 2.2, 0x2a2e3a);
    top.position.set(0, 1.25, -0.2);
    const hl = glow("rgba(255,255,230,1)", "rgba(255,240,200,0.4)", 1.6);
    hl.position.set(0, 0.7, 2.2);
    c.add(body, top, hl);
    c.position.set(i % 2 ? 2.4 : -2.4, 0, 8 - Math.floor(i / 2) * 6 - rnd());
    c.rotation.y = (i % 2 ? 0 : Math.PI) + (rnd() - 0.5) * 0.4;
    street.add(c);
    cars.push(c);
  }
  const pole = cyl(0.12, 0.12, 4.5, 0x2a2a2a, 6);
  pole.position.set(4.6, 2.25, 13);
  const head = box(0.6, 1.6, 0.5, 0x1a1a1a);
  head.position.set(4.6, 5, 13);
  street.add(pole, head);
  for (let k = 0; k < 3; k++) {
    const l = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 12),
      new THREE.MeshBasicMaterial({ color: 0x2a2a2a }),
    );
    l.position.set(4.6, 5.5 - k * 0.5, 13.26);
    street.add(l);
  }
}
// you with your phone
const you = makePerson(mulberry32(11), 1);
you.position.set(-3, 0, 14);
street.add(you);
const phone = new THREE.Group();
{
  const body = box(0.42, 0.8, 0.05, 0x111111);
  phone.add(body);
  const screen = liveText(0.38, 0.72, "#0e1a2a", "#ffffff", "bold 120px sans-serif");
  screen.position.z = 0.03;
  screen.name = "screen";
  phone.add(screen);
  const sg = glow("rgba(160,200,255,0.9)", "rgba(80,120,200,0.25)", 1.6);
  sg.position.z = 0.1;
  phone.add(sg);
  phone.position.set(-2.75, 1.32, 14.45);
  phone.rotation.set(-0.35, 0.5, 0);
  street.add(phone);
}

// ================= C: petrol station (x = 2000) =================
const gas = stage(2000);
ground(gas, 0x2e2e32);
{
  const roof = box(16, 0.8, 9, 0xd8d8d8);
  roof.position.y = 5.4;
  gas.add(roof);
  for (const [x, z] of [
    [-6, -3],
    [6, -3],
    [-6, 3],
    [6, 3],
  ]) {
    const p = box(0.5, 5, 0.5, 0xc8c8c8);
    p.position.set(x, 2.5, z);
    gas.add(p);
  }
  for (const x of [-3, 3]) {
    const pump = box(1.2, 2, 0.8, 0x2a6a3a);
    pump.position.set(x, 1, 0);
    const scr = box(0.9, 0.5, 0.05, 0x101418);
    scr.position.set(x, 1.5, 0.43);
    gas.add(pump, scr);
  }
  const sign = textSprite("KEIN BENZIN", "#ff5a4a", 9, 2.25);
  sign.position.set(0, 7.6, 0);
  gas.add(sign);
  const rnd = mulberry32(6);
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    const body = box(1.9, 0.8, 4.2, [0xb83a3a, 0x3a6ab8, 0xd8d8d8, 0x4a4a4a][i % 4]);
    body.position.y = 0.6;
    const top = box(1.7, 0.6, 2.2, 0x2a2e3a);
    top.position.set(0, 1.25, -0.2);
    const hl = glow("rgba(255,255,230,1)", "rgba(255,240,200,0.4)", 1.8);
    hl.position.set(0, 0.7, -2.2);
    c.add(body, top, hl);
    c.position.set(-3 + (rnd() - 0.5) * 0.6, 0, 6 + i * 5.4);
    c.rotation.y = Math.PI + (rnd() - 0.5) * 0.15;
    gas.add(c);
  }
}

// ================= D: kitchen (x = 3000) =================
const kitchen = stage(3000);
{
  const floor = box(8, 0.1, 6, 0x8a7a6a);
  kitchen.add(floor);
  const wall = box(8, 4, 0.2, 0xd8d0c0);
  wall.position.set(0, 2, -2);
  const counter = box(5, 0.95, 1.2, 0x6a5a4a);
  counter.position.set(0, 0.475, -1.3);
  const top = box(5.1, 0.06, 1.3, 0xc8c8cc);
  top.position.set(0, 0.98, -1.3);
  const sink = box(0.9, 0.08, 0.6, 0x8a8a90);
  sink.position.set(0, 1.0, -1.25);
  kitchen.add(wall, counter, top, sink);
  const tapV = cyl(0.04, 0.04, 0.45, 0xd0d0d8, 8);
  tapV.position.set(0, 1.22, -1.62);
  const tapH = cyl(0.035, 0.035, 0.32, 0xd0d0d8, 8);
  tapH.rotation.x = Math.PI / 2;
  tapH.position.set(0, 1.43, -1.48);
  kitchen.add(tapV, tapH);
  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.1),
    new THREE.MeshBasicMaterial({ color: 0x8aa0c0 }),
  );
  win.position.set(1.6, 2.2, -1.89);
  kitchen.add(win);
  const fridge = box(0.8, 1.9, 0.7, 0xe8e8ec);
  fridge.position.set(-2.9, 0.95, -1.4);
  kitchen.add(fridge);
}
const stream = new THREE.Mesh(
  new THREE.CylinderGeometry(0.04, 0.045, 1, 8),
  std(0x8ac8ff, { transparent: true, opacity: 0.75, roughness: 0.1 }),
);
kitchen.add(stream);
const drop = ellipsoid(0.03, 0.045, 0.03, 0x8ac8ff, 8);
kitchen.add(drop);

// ================= E: supermarket (x = 4000) =================
const market = stage(4000);
ground(market, 0xb8b4ac, 80);
const itemN = 1200;
const items = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.28, 0.34, 0.22),
  std(0xffffff),
  itemN,
);
items.frustumCulled = false;
market.add(items);
const itemData = [];
{
  const rnd = mulberry32(13);
  const cols = [0xd84a3a, 0x3a8ad8, 0xe8c83a, 0x3ab86a, 0xf0f0f0, 0xe07a2a];
  for (const x of [-2.2, 2.2]) {
    const shelf = box(0.8, 2.2, 14, 0x9a9aa2);
    shelf.position.set(x, 1.1, -4);
    market.add(shelf);
  }
  let i = 0;
  for (const x of [-1.75, 1.75])
    for (let lvl = 0; lvl < 5; lvl++)
      for (let j = 0; j < 60 && i < itemN; j++, i++) {
        itemData.push([x, 0.3 + lvl * 0.42, 2.8 - j * 0.23, rnd()]);
        items.setColorAt(i, C(cols[Math.floor(rnd() * cols.length)]));
      }
}
const torch = new THREE.SpotLight(0xfff0d0, 0, 30, 0.45, 0.6, 1.2);
scene.add(torch, torch.target);

// ================= F: hospital (x = 5000) =================
const hosp = stage(5000);
ground(hosp, 0x22252a);
const hwin = [];
{
  const b = box(30, 18, 10, 0xb8bcc4);
  b.position.set(0, 9, -10);
  hosp.add(b);
  const rnd = mulberry32(21);
  for (let fl = 0; fl < 5; fl++)
    for (let k = 0; k < 9; k++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.6), winMat(false));
      w.position.set(-12 + k * 3, 2.5 + fl * 3.3, -4.98);
      w.userData.lit = rnd() < 0.22;
      hosp.add(w);
      hwin.push(w);
    }
  const cross = new THREE.Group();
  const a = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 3),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a }),
  );
  const c2 = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 1),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a }),
  );
  cross.add(a, c2);
  cross.position.set(0, 16, -4.9);
  hosp.add(cross);
  const gen = box(6, 2.6, 2.6, 0x3a6a4a);
  gen.position.set(9, 1.3, 2);
  const stack = cyl(0.25, 0.25, 2, 0x2a2a2a, 8);
  stack.position.set(10.8, 3.6, 2);
  hosp.add(gen, stack);
}
const gauge = liveText(3.2, 1.1, "#101418", "#7aff8a", "bold 76px monospace");
gauge.position.set(9, 1.6, 3.32);
hosp.add(gauge);
const smokeN = 30;
const smoke = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(0.5, 1),
  std(0x6a6a70, { transparent: true, opacity: 0.6 }),
  smokeN,
);
smoke.frustumCulled = false;
hosp.add(smoke);

// ================= G: cold flat (x = 6000) =================
const flat = stage(6000);
{
  const floor = box(7, 0.1, 6, 0x6a5040);
  flat.add(floor);
  const wall = box(7, 3.4, 0.2, 0xc8c0b4);
  wall.position.set(0, 1.7, -2.5);
  const side = box(0.2, 3.4, 6, 0xbcb4a8);
  side.position.set(-3.5, 1.7, 0);
  flat.add(wall, side);
  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x3a4a6a }),
  );
  win.position.set(1.6, 1.9, -2.38);
  const frost = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.4),
    new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.35 }),
  );
  frost.position.set(1.6, 1.9, -2.36);
  flat.add(win, frost);
  const sofa = box(2.6, 0.5, 1, 0x4a5a7a);
  sofa.position.set(-1.2, 0.3, -1.6);
  const back = box(2.6, 0.7, 0.25, 0x4a5a7a);
  back.position.set(-1.2, 0.8, -2.05);
  flat.add(sofa, back);
  const table = box(1, 0.45, 0.6, 0x6a4a3a);
  table.position.set(-1.2, 0.23, -0.4);
  const candle = cyl(0.04, 0.04, 0.16, 0xf2ece0, 8);
  candle.position.set(-1.2, 0.54, -0.4);
  flat.add(table, candle);
}
const sitter = makePerson(mulberry32(17), 0.8);
sitter.position.set(-1.3, 0.18, -1.55);
flat.add(sitter);
const blanket = ellipsoid(0.42, 0.55, 0.32, 0x8a3a3a, 10);
blanket.position.set(-1.3, 0.85, -1.5);
flat.add(blanket);
const flame = glow("rgba(255,230,160,1)", "rgba(255,150,40,0.6)", 0.6);
flame.position.set(-1.2, 0.66, -0.4);
flat.add(flame);
const thermo = liveText(0.9, 0.5, "#e8e8e8", "#1a1a1a", "bold 140px sans-serif");
thermo.position.set(-0.6, 2.1, -2.38);
flat.add(thermo);

// ================= H: supplies (x = 7000) =================
const sup = stage(7000);
{
  const floor = box(6, 0.1, 5, 0x7a6a5a);
  sup.add(floor);
  const wall = box(6, 3, 0.2, 0xd0c8bc);
  wall.position.set(0, 1.5, -1.6);
  sup.add(wall);
}
const bottles = [];
for (let i = 0; i < 20; i++) {
  const b = new THREE.Group();
  const body = cyl(0.11, 0.11, 0.34, 0x9ad0f0, 10);
  body.material.transparent = true;
  body.material.opacity = 0.8;
  body.position.y = 0.17;
  const capp = cyl(0.04, 0.04, 0.05, 0x2a5ab0, 8);
  capp.position.y = 0.37;
  b.add(body, capp);
  b.position.set(
    -1.1 + (i % 5) * 0.25,
    0.05 + Math.floor(i / 10) * 0.0,
    -0.9 + Math.floor((i % 10) / 5) * 0.25 + Math.floor(i / 10) * 0.5,
  );
  sup.add(b);
  bottles.push(b);
}
const extras = [];
{
  const cans = [];
  for (let i = 0; i < 9; i++) {
    const c = cyl(0.08, 0.08, 0.12, [0xd8d8d8, 0xc84a3a, 0xe8c83a][i % 3], 10);
    c.position.set(0.5 + (i % 3) * 0.18, 0.11 + Math.floor(i / 3) * 0.125, -0.9);
    cans.push(c);
  }
  const radio = box(0.4, 0.25, 0.15, 0x2a2a2a);
  radio.position.set(1.3, 0.18, -0.4);
  const torchB = cyl(0.04, 0.05, 0.28, 0xe8c83a, 8);
  torchB.rotation.z = Math.PI / 2;
  torchB.position.set(1.1, 0.1, 0.1);
  const candles = cyl(0.05, 0.05, 0.2, 0xf2ece0, 8);
  candles.position.set(0.6, 0.15, 0.1);
  for (const o of [...cans, radio, torchB, candles]) {
    sup.add(o);
    extras.push(o);
  }
}
const supLabel = textSprite("20 LITER", "#7ac8ff", 1.1, 0.28);
supLabel.position.set(-0.6, 0.75, -0.6);
sup.add(supLabel);

// ================= story =================
const STAGES = [
  [0, 9.6, mapSt],
  [9.6, 24.3, street],
  [24.3, 29.8, gas],
  [29.8, 41.8, kitchen],
  [41.8, 48.3, market],
  [48.3, 60.3, hosp],
  [60.3, 65, flat],
  [65, 80, sup],
];
const HOURS = [
  [5.4, 0],
  [14.3, 3],
  [24.3, 8],
  [29.8, 24],
  [41.8, 72],
  [48.3, 96],
  [60.3, 168],
  [65, 336],
];
function hoursAt(t) {
  if (t <= HOURS[0][0]) return 0;
  for (let i = 1; i < HOURS.length; i++)
    if (t < HOURS[i][0]) {
      const [t0, h0] = HOURS[i - 1],
        [t1, h1] = HOURS[i];
      return lerp(h0, h1, smooth(t0, t1, t));
    }
  return 336;
}
const dummy = new THREE.Object3D();

function renderAt(t) {
  let cur = null;
  for (const [a, b, g] of STAGES) {
    g.visible = t >= a && t < b;
    if (g.visible) cur = g;
  }
  scene.background = C(
    cur === kitchen
      ? 0x2a2a30
      : cur === market || cur === flat || cur === sup
        ? 0x0e0e12
        : 0x05070e,
  );
  stars.visible = cur === mapSt || cur === street || cur === gas || cur === hosp;
  hemi.intensity =
    cur === kitchen ? 2.2 : cur === market ? 0.12 : cur === flat ? 0.15 : cur === sup ? 0.35 : 0.5;
  moon.intensity = cur === market ? 0.1 : 0.9;

  // A: city lights go out from west to east
  for (let i = 0; i < dotN; i++) {
    const on = t < dotOff[i] ? 1 : 0;
    const flick = t >= dotOff[i] - 0.25 && t < dotOff[i] ? 0.5 + 0.5 * Math.sin(t * 60 + i) : on;
    dotCol.set([flick, flick * 0.92, flick * 0.75], i * 3);
  }
  dotGeo.attributes.color.needsUpdate = true;

  // B: windows and street lamps die
  for (const w of windows)
    w.material.color.set(w.userData.on && t < w.userData.off ? 0xffd890 : 0x151722);
  lamps.forEach((l, i) => (l.visible = t < 10 + i * 0.15));
  const scr = phone.getObjectByName("screen");
  scr.userData.set(t < 16 ? "Suche\nNetz …" : "Kein\nNetz", t < 16 ? "#ffffff" : "#ff6a5a");
  phone.visible = t >= 14.3 && t < 19;

  // D: the tap runs dry
  const flow = 1 - smooth(31, 33.5, t);
  stream.visible = flow > 0.02;
  stream.scale.set(flow, 0.45, flow);
  stream.position.set(3000 - 3000, 1.2, -1.34);
  const dropT = (t - 33.5) % 1.6;
  drop.visible = t >= 33.5 && t < 38 && dropT < 0.5;
  drop.position.set(0, 1.38 - dropT * dropT * 3, -1.34);

  // E: shelves empty
  const left = 1 - smooth(42, 45.2, t) * 0.98;
  itemData.forEach(([x, y, z, r], i) => {
    dummy.position.set(x, y, z);
    dummy.scale.setScalar(r < left ? 1 : 0.0001);
    dummy.updateMatrix();
    items.setMatrixAt(i, dummy.matrix);
  });
  items.instanceMatrix.needsUpdate = true;
  torch.intensity = cur === market ? 60 : 0;

  // F: hospital on emergency power, diesel running low
  for (const w of hwin) w.material.color.set(w.userData.lit ? 0xd8f0ff : 0x151722);
  const diesel = Math.round(lerp(72, 6, smooth(49, 59.5, t)));
  gauge.userData.set("DIESEL " + diesel + "%", diesel < 20 ? "#ff6a5a" : "#7aff8a");
  for (let i = 0; i < smokeN; i++) {
    const u = ((t * 0.5 + i / smokeN) % 1) * 6;
    dummy.position.set(10.8 + u * 0.4, 4.6 + u, 2 + Math.sin(i) * u * 0.2);
    dummy.scale.setScalar(0.4 + u * 0.4);
    dummy.updateMatrix();
    smoke.setMatrixAt(i, dummy.matrix);
  }
  smoke.instanceMatrix.needsUpdate = true;

  // G: cold flat lit by one candle
  thermo.userData.set(Math.round(lerp(18, 9, smooth(60.5, 64.5, t))) + " °C");
  flame.scale.setScalar(0.6 + Math.sin(t * 13) * 0.05);

  // H: supplies appear one by one
  bottles.forEach((b, i) => (b.visible = t >= 65.4 + i * 0.22));
  extras.forEach((o, i) => (o.visible = t >= 70 + i * 0.12));
  supLabel.visible = t >= 70 && t < 74.2;

  // warm light (candle / supplies)
  warm.intensity = cur === flat ? 6 : cur === sup ? 3 : 0;
  warm.position.set(
    cur === flat ? 6000 - 1.2 : 7000,
    cur === flat ? 0.9 : 1.6,
    cur === flat ? -0.4 : 0.6,
  );

  // ----- camera -----
  let pos, look;
  if (cur === mapSt) {
    const k = smooth(0, 9.6, t);
    pos = V(lerp(-6, 0, k), lerp(115, 100, k), lerp(70, 62, k));
    look = V(-2, 0, 0);
  } else if (cur === street) {
    if (t < 14.3) {
      const k = smooth(9.6, 14.3, t);
      pos = V(1000 + lerp(0, -1, k), lerp(8, 6, k), lerp(42, 38, k));
      look = V(1000, 6, -10);
    } else if (t < 19) {
      const k = smooth(14.3, 19, t);
      pos = V(1000 - 2.34 + lerp(0.1, 0, k), 1.72, lerp(15.35, 15.15, k));
      look = V(1000 - 2.75, 1.3, 14.45);
    } else {
      const k = smooth(19, 24.3, t);
      pos = V(1000 + lerp(-1, 1, k), lerp(5, 7, k), lerp(26, 30, k));
      look = V(1000, 1.5, 0);
    }
  } else if (cur === gas) {
    const k = smooth(24.3, 29.8, t);
    pos = V(2000 + lerp(3, 5, k), lerp(4, 5, k), lerp(24, 30, k));
    look = V(2000, 4, 0);
  } else if (cur === kitchen) {
    const k = smooth(29.8, 41.8, t);
    pos = V(3000 + lerp(0.6, 0.25, k), lerp(1.75, 1.6, k), lerp(0.9, 0.2, k));
    look = V(3000, 1.15, -1.4);
  } else if (cur === market) {
    const k = smooth(41.8, 48.3, t);
    pos = V(4000, 1.6, lerp(6, 4, k));
    look = V(4000, 1.1, -6);
    torch.position.copy(pos).add(V(0.3, -0.2, 0));
    torch.target.position.set(4000 + Math.sin(t * 0.8) * 1.2, 1, -3);
  } else if (cur === hosp) {
    const k = smooth(48.3, 60.3, t);
    pos = V(5000 + lerp(2, 9, k), lerp(8, 3, k), lerp(34, 16, k));
    look = V(5000 + lerp(0, 9, k), lerp(9, 4.6, k), lerp(-6, 2, k));
  } else if (cur === flat) {
    const k = smooth(60.3, 65, t);
    pos = V(6000 + lerp(1.4, 1.1, k), lerp(1.5, 1.4, k), lerp(2.6, 2.2, k));
    look = V(6000 - 0.9, 1.0, -1.2);
  } else {
    const k = smooth(65, 80, t);
    pos = V(7000 + lerp(0.1, 0.3, k), lerp(1.5, 1.9, k), lerp(2.2, 2.9, k));
    look = V(7000 - 0.2, 0.3, -0.6);
  }
  cam.position.copy(pos);
  cam.lookAt(look);
  stars.position.copy(cam.position);
  renderer.render(scene, cam);

  // ----- HUD -----
  const h = hoursAt(t);
  const val =
    h < 24
      ? Math.round(h) + " Std."
      : Math.floor(h / 24) === 1
        ? "1 Tag"
        : Math.floor(h / 24) + " Tage";
  let sub = "84 MIO. MENSCHEN BETROFFEN";
  if (t >= 14.3) sub = t < 19 ? "HANDYNETZ: AUS" : "AMPELN & KASSEN: AUS";
  if (t >= 24.3) sub = "TANKSTELLEN: AUS";
  if (t >= 29.8) sub = "WASSER: WIRD KNAPP";
  if (t >= 41.8) sub = "SUPERMÄRKTE: LEER";
  if (t >= 48.3) sub = "KRANKENHÄUSER: NOTSTROM";
  if (t >= 60.3) sub = "HEIZUNG: AUS";
  if (t < 65) setHud(t, "OHNE STROM", val, sub);
  else setHud(t, "EMPFOHLENER VORRAT", "10 Tage", "20 L WASSER PRO PERSON");
}
register(renderAt);
