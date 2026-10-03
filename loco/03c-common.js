
/* ------------------------------------------------ shared animated handles */
const axles = [], motorRotors = [], roofFans = [], lampMats = [];
let turboWheel = null, altRotor = null, compPulley = null;
const cabLevers = [];   // every throttle lever (loco cab, TGV cabs and their copies), posed from the notch and the brake
const gridMats = {};
const panto = {};
const WHEEL_R = 0.5;
const Y_UP = new THREE.Vector3(0, 1, 0);
/* a lamp's glow in the dark ("lights on the train when it's dark or in the tunnels"): a soft disc just in front of each lens, as bright as the
   lens is lit and as it is dark around, seen from ahead only (updateLights, 03f4-route.js). host: the group whose +x the lamps face */
const halos = [];
const HALO_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.12, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const noRay = () => {};
function addHalos(host, lens, points, size, own = true, head = true){   // own: on our train (the beam rides its leading head lamps); head: white, not a tail
  const sm = new THREE.SpriteMaterial({ map:HALO_TEX, color:lens.emissive, blending:THREE.AdditiveBlending, depthWrite:false, fog:false, toneMapped:false, opacity:0 });
  sm.visible = false;
  for (const [x, y, z] of points){ const sp = new THREE.Sprite(sm); sp.position.set(x, y, z); sp.scale.setScalar(size); sp.renderOrder = 5; sp.raycast = noRay; host.add(sp); }   // not in the way of a click
  const at = new THREE.Vector3(); points.forEach(p => at.add(new THREE.Vector3(...p))); at.divideScalar(points.length);   // their middle: in front of it is ahead
  const tip = new THREE.Vector3(Math.max(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), 0);   // the nose's lowest lamps, where the beam starts
  halos.push({ host, lens, sm, at, tip, own, head, peak:lens.userData.lamp || 2.2 });
}

/* ------------------------------------------------------- environment: track and scenery are built per kilometre from the route data (03f4) */
const ballastMat = new THREE.MeshStandardMaterial({ color:0x3a3f44, roughness:1 });
themeMats.push({ mat:ballastMat, token:'--ballast' });
const railMat = new THREE.MeshStandardMaterial({ color:pal.rail, roughness:0.35, metalness:0.75 });
const sleeperMat = new THREE.MeshStandardMaterial({ color:pal.sleeper, roughness:0.95 });

/* ------------------------------------------------------------- frame */
definePart('frame', g => {
  const fm = mat(pal.frame, { roughness:0.7 }), dm = mat(pal.dark);
  g.add(box(19.2, 0.28, 3.0, fm, 0, 1.47, 0));
  g.add(box(19.2, 0.05, 2.96, dm, 0, 1.635, 0));
  [9.6, -9.6].forEach(x => {
    const s = Math.sign(x);
    g.add(box(0.28, 0.95, 2.8, fm, x - s * 0.14, 1.15, 0));                       // headstock
    [-0.95, 0.95].forEach(z => {
      g.add(cyl(0.11, 0.55, dm, 'x', x + s * 0.27, 1.15, z));                      // buffer shank
      g.add(cyl(0.23, 0.08, dm, 'x', x + s * 0.58, 1.15, z, 24));                  // buffer head
    });
    g.add(box(0.55, 0.22, 0.28, dm, x + s * 0.32, 1.02, 0));                        // coupler
    [-1.3, 1.3].forEach(z => { g.add(box(0.55, 0.05, 0.6, fm, x - s * 0.2, 0.55, z)); g.add(box(0.55, 0.05, 0.6, fm, x - s * 0.2, 0.95, z)); });
  });
  // fuel/transformer hangers
  [-2.4, 2.4].forEach(x => [-1.15, 1.15].forEach(z => g.add(box(0.16, 0.16, 0.5, fm, x, 1.27, z))));
});

/* --------------------------------------------------------- body shell */
definePart('shell', g => {
  const bm = mat(pal.body, { roughness:0.42, metalness:0.35 });
  const rm = mat(pal.roof, { roughness:0.65 });
  const band = mat(pal.band, { roughness:0.5 });
  const gm = glassMat();
  const L = 16.4, cx = -1.4;
  g.add(box(L, 2.62, 0.06, bm, cx, 2.91, 1.42));
  g.add(box(L, 2.62, 0.06, bm, cx, 2.91, -1.42));
  g.add(box(0.06, 2.62, 2.9, bm, -9.57, 2.91, 0));
  g.add(box(L + 0.1, 0.08, 2.96, rm, cx, 4.24, 0));
  g.add(box(L, 0.26, 0.02, band, cx, 3.05, 1.46));
  g.add(box(L, 0.26, 0.02, band, cx, 3.05, -1.46));
  // louvres on both sides (cooling section + engine section)
  const lm = mat(pal.dark, { roughness:0.8 });
  [[-7.2, -4.4], [-3.4, -0.2], [0.4, 2.2]].forEach(([a, b]) => {
    for (let y = 2.1; y <= 2.85; y += 0.15){ g.add(box(b - a, 0.05, 0.03, lm, (a + b) / 2, y, 1.46)); g.add(box(b - a, 0.05, 0.03, lm, (a + b) / 2, y, -1.46)); }
  });
  // cab walls, x 6.8 .. 9.6
  g.add(box(0.06, 2.62, 2.9, bm, 6.8, 2.91, 0));                                     // cab rear wall
  g.add(box(2.8, 2.78, 0.06, bm, 8.2, 2.99, 1.45));
  g.add(box(2.8, 2.78, 0.06, bm, 8.2, 2.99, -1.45));
  g.add(box(1.15, 0.85, 0.03, gm, 8.55, 3.5, 1.49));
  g.add(box(1.15, 0.85, 0.03, gm, 8.55, 3.5, -1.49));
  g.add(box(0.06, 1.3, 2.96, bm, 9.6, 2.25, 0));                                      // nose panel
  const ws = box(0.05, 1.28, 2.85, gm, 9.5, 3.53, 0); ws.rotation.z = 0.16; g.add(ws);  // windshield
  const pillar = box(0.08, 1.28, 0.12, bm, 9.5, 3.53, 0); pillar.rotation.z = 0.16; g.add(pillar);
  g.add(box(2.9, 0.08, 3.0, rm, 8.2, 4.4, 0));                                        // cab roof
  g.add(box(0.5, 0.1, 2.96, bm, 9.45, 4.34, 0));                                      // roof front lip
  g.add(box(0.06, 0.24, 2.96, bm, 9.38, 4.21, 0));
  // headlights (switch with the battery)
  const hl = mat(0xfff1c0, { emissive:0xfff1c0, emissiveIntensity:0, roughness:0.3 });
  hl.userData.lamp = 2.2; lampMats.push(hl);
  [-0.9, 0.9].forEach(z => g.add(cyl(0.15, 0.06, hl, 'x', 9.64, 2.35, z, 20)));
  g.add(cyl(0.14, 0.06, hl, 'x', 9.64, 4.05, 0, 20));
  addHalos(g, hl, [[10, 2.35, -0.9], [10, 2.35, 0.9], [10, 4.05, 0]], 1.3);
  // number plate band on the cab
  g.add(box(2.8, 0.26, 0.02, band, 8.2, 3.05, 1.49)); g.add(box(2.8, 0.26, 0.02, band, 8.2, 3.05, -1.49));
});

/* ------------------------------------------------------------- cab interior */
/* Two fit-outs in the same part: the loco cab (diesel, electric) and the TGV cab (raised floor, wide desk under the
   windshield, driver in the middle). setTgvVisible shows one or the other; the TGV power cars' copies show the TGV one.
   Each desk carries a dashboard turned to the driver's eyes: a line screen, a speed screen and a panel of push buttons
   (horn, pantograph, doors, next stop). Screens, panel print and button icons are one canvas, redrawn by updateCab (03h). */
const CAB = (() => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 768;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // blank gutters between cells that meet a different colour, or the mipmaps bleed one into the other along the edges
  const cell = { speed:[0, 0, 512, 320], line:[512, 0, 512, 320], panel:[0, 384, 512, 320], horn:[576, 448, 128, 128], panto:[736, 448, 128, 128], doors:[896, 448, 128, 128], next:[576, 608, 128, 128] };
  return { ctx:c.getContext('2d'), tex, cell, W:0.352, H:0.22, GAP:0.39, btns:[], scrs:[], mats:{},
           cols:{ tgv:['horn', 'panto', 'doors', 'next'], loco:['horn', 'panto', 'next'] }, px:{ tgv:[64, 192, 320, 448], loco:[85, 256, 427] } };   // button columns, in panel pixels
})();
function atlasUV(geo, [x, y, w, h]){   // squeeze a geometry's 0..1 UVs into one cell of the cab canvas
  const uv = geo.attributes.uv, { width:cw, height:ch } = CAB.ctx.canvas;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * w) / cw, 1 - (y + (1 - uv.getY(i)) * h) / ch);
  return geo;
}
function lit(o){ const m = new THREE.MeshBasicMaterial(Object.assign({ toneMapped:false }, o)); clipMats.push(m); return m; }   // lights its own colour: screens and backlit buttons in a dark cab
for (const [id, col] of [['horn', 0xffcf33], ['panto', 0xe8eef4], ['doors', 0x4c8dff], ['next', 0x3ccf6f]]) CAB.mats[id] = { body:lit({ color:col }), cap:lit({ map:CAB.tex }), base:new THREE.Color(col) };
// The slab stands d metres from the eyes, el radians under them, tilted back by tilt; the button panel prints its labels around the real buttons
function dashboard(parent, eye, d, el, tilt, kind){
  const g = new THREE.Group(), { W, H, GAP } = CAB;
  g.position.set(eye[0] + d * Math.cos(el), eye[1] - d * Math.sin(el), eye[2]); g.rotation.z = -tilt; parent.add(g);
  g.add(box(0.04, H + 0.05, 2 * GAP + W + 0.08, mat(0x1c2229, { roughness:0.8 }), 0.022, 0, 0));
  const scrM = lit({ map:CAB.tex });
  [['line', -GAP], ['speed', 0], ['panel', GAP]].forEach(([id, z]) => { const q = new THREE.Mesh(atlasUV(new THREE.PlaneGeometry(W, H), CAB.cell[id]), scrM); q.rotation.y = -Math.PI / 2; q.position.z = z; q.userData.cabScr = id; g.add(q); CAB.scrs.push(q); });   // tagged: a tap on the line screen's stops (03h)
  CAB.cols[kind].forEach((id, i) => {
    const b = new THREE.Group(), M = CAB.mats[id]; b.userData.cabBtn = id;
    b.position.set(0, (0.5 - 130 / 320) * H, GAP + (CAB.px[kind][i] / 512 - 0.5) * W);
    b.add(cyl(0.03, 0.02, M.body, 'x', -0.01, 0, 0, 24));
    const cap = new THREE.Mesh(atlasUV(new THREE.CircleGeometry(0.027, 24), CAB.cell[id]), M.cap); cap.rotation.y = -Math.PI / 2; cap.position.x = -0.0205; b.add(cap);
    g.add(b); CAB.btns.push(b);
  });
  return g;
}
definePart('cab', g => {
  const dm = mat(pal.dark, { roughness:0.8 }), sm = mat(pal.steel);
  const lever = (x, y, z) => {   // throttle lever (rotates with the notch)
    const l = new THREE.Group(); l.position.set(x, y, z); l.userData.lever = 1;
    l.add(box(0.04, 0.32, 0.04, sm, 0, 0.16, 0)); l.add(box(0.1, 0.08, 0.08, mat(pal.red), 0, 0.32, 0));
    cabLevers.push(l); return l;
  };
  const a = new THREE.Group(); a.name = 'cabLoco'; g.add(a);
  a.add(box(2.7, 0.05, 2.85, mat(0x2b3138, { roughness:0.9 }), 8.2, 1.68, 0));        // floor
  a.add(box(0.6, 1.1, 2.5, dm, 9.15, 2.26, 0));                                        // desk, its top under the dashboard
  dashboard(a, [8.25, 3.2, 0.55], 0.72, 0.35, 0.45, 'loco');                            // in front of the driver's seat, under the windshield line
  a.add(box(0.36, 0.95, 0.26, dm, 8.62, 2.18, 1.1)); a.add(lever(8.62, 2.655, 1.1));    // side console at the driver's right hand
  // seat
  a.add(box(0.5, 0.08, 0.5, dm, 8.2, 2.35, 0.55)); a.add(box(0.08, 0.6, 0.5, dm, 7.95, 2.65, 0.55)); a.add(cyl(0.05, 0.6, sm, 'y', 8.2, 2.0, 0.55));
  // rear cabinet
  a.add(box(0.3, 1.9, 1.2, mat(pal.cabinet), 7.0, 2.65, -0.7));
  // TGV cab: the nose narrows fast, so everything sits between x 6.9 and 9.5, the driver's eyes level with the windshield
  const b = new THREE.Group(); b.name = 'cabTgv'; b.visible = false; g.add(b);
  const panel = mat(0x3b434c, { roughness:0.7 });
  b.add(box(2.6, 0.34, 2.5, mat(0x2b3138, { roughness:0.9 }), 8.2, 1.83, 0));        // raised floor, top at 2.0
  b.add(box(0.6, 0.85, 2.2, dm, 9.15, 2.425, 0));                                      // desk
  { const t = box(0.5, 0.05, 2.2, panel, 9.1, 2.9, 0); t.rotation.z = 0.35; b.add(t); }   // sloped top panel
  dashboard(b, [8.3, 3.45, 0], 0.8, 0.43, 0.5, 'tgv');                                  // just under the windshield
  b.add(box(0.305, 0.15, 1.18, dm, 9.1275, 2.935, 0));                                 // under the dashboard, down to the desk
  b.add(box(0.4, 0.7, 0.3, dm, 8.7, 2.35, -0.42));                                     // side console with the combined traction/brake lever,
  b.add(lever(8.7, 2.7, -0.42));                                                       // low enough for its knob to pass under the screens
  b.add(box(0.5, 0.08, 0.5, dm, 8.15, 2.48, 0)); b.add(box(0.08, 0.65, 0.5, dm, 7.87, 2.85, 0)); b.add(cyl(0.05, 0.44, sm, 'y', 8.15, 2.22, 0));   // seat
  b.add(box(0.08, 1.8, 2.5, panel, 6.95, 2.9, 0));                                     // back wall of the cab
  // the driver, facing the line (only the one in the leading cab is shown)
  const d = new THREE.Group(); d.name = 'driver'; b.add(d);
  const suit = mat(0x1f2d4a, { roughness:0.8 }), skin = mat(0xd9b48f, { roughness:0.7 }), shoe = mat(0x15181c, { roughness:0.6 });
  const limb = (p, q, r, m) => {
    const A = new THREE.Vector3(...p), B = new THREE.Vector3(...q), len = A.distanceTo(B);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m); c.castShadow = true;
    c.position.copy(A).add(B).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
    return c;
  };
  { const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.32, 4, 10), suit); t.position.set(8.17, 2.89, 0); t.castShadow = true; d.add(t); }
  { const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), skin); h.position.set(8.2, 3.4, 0); h.castShadow = true; d.add(h); }
  d.add(cyl(0.125, 0.07, suit, 'y', 8.19, 3.5, 0, 16)); d.add(box(0.13, 0.015, 0.2, suit, 8.33, 3.475, 0));   // cap and visor
  [-0.1, 0.1].forEach(z => {
    d.add(box(0.44, 0.14, 0.14, suit, 8.4, 2.62, z));                                  // thigh
    d.add(box(0.13, 0.6, 0.13, suit, 8.64, 2.31, z));                                  // shin
    d.add(box(0.24, 0.08, 0.11, shoe, 8.7, 2.04, z));                                  // shoe
  });
  const arm = (sh, el, ha) => { d.add(limb(sh, el, 0.055, suit)); d.add(limb(el, ha, 0.05, suit)); const h = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skin); h.position.set(...ha); d.add(h); };
  arm([8.17, 3.16, -0.22], [8.36, 2.85, -0.34], [8.7, 2.97, -0.42]);                    // left hand on the lever
  arm([8.17, 3.16, 0.22], [8.42, 2.85, 0.3], [8.85, 2.97, 0.3]);                        // right hand on the desk
});

/* ---------------------------------------------------------- bogies */
definePart('bogies', g => {
  const fm = mat(pal.dark, { roughness:0.7 }), wm = mat(pal.wheel, { roughness:0.45, metalness:0.6 }), sm = mat(pal.steel, { metalness:0.6 });
  [-6, 6].forEach(cx => {
    g.add(box(3.9, 0.36, 0.2, fm, cx, 0.95, 1.15));
    g.add(box(3.9, 0.36, 0.2, fm, cx, 0.95, -1.15));
    g.add(box(0.5, 0.34, 2.5, fm, cx, 0.98, 0));
    g.add(cyl(0.3, 0.3, fm, 'y', cx, 1.25, 0));
    [-1.05, 1.05].forEach(z => [cx - 1.3, cx + 1.3].forEach(x => g.add(cyl(0.15, 0.36, sm, 'y', x, 1.16, z, 16))));
    [cx - 1.3, cx + 1.3].forEach(x => {
      const ax = new THREE.Group(); ax.position.set(x, WHEEL_R, 0);
      ax.add(cyl(0.09, 2.0, sm, 'z', 0, 0, 0, 16));
      [-0.75, 0.75].forEach(z => {
        ax.add(cyl(WHEEL_R, 0.14, wm, 'z', 0, 0, z, 36));
        ax.add(cyl(WHEEL_R * 0.32, 0.17, sm, 'z', 0, 0, z, 20));
        ax.add(cyl(WHEEL_R + 0.035, 0.03, wm, 'z', 0, 0, z - Math.sign(z) * 0.085, 36));
      });
      const bg = gear(0.44, 40, 0.1, sm, 'z'); bg.position.set(0, 0, 0.55); ax.add(bg);
      g.add(ax); axles.push(ax);
      g.add(box(0.36, 0.36, 0.2, fm, x, WHEEL_R, 1.15)); g.add(box(0.36, 0.36, 0.2, fm, x, WHEEL_R, -1.15));
      // brake discs / shoes
      g.add(box(0.12, 0.25, 0.08, fm, x + 0.52, WHEEL_R + 0.1, 0.75)); g.add(box(0.12, 0.25, 0.08, fm, x + 0.52, WHEEL_R + 0.1, -0.75));
    });
  });
});

/* ------------------------------------------------------ traction motors */
definePart('motors', g => {
  const hm = seeThrough(0x8a7fb5, 0.36), rm = mat(pal.steel, { metalness:0.65, roughness:0.35 }), cm = mat(pal.copper, { roughness:0.4 }), dm = mat(pal.dark);
  [-6, 6].forEach(cx => [cx - 1.3, cx + 1.3].forEach(xa => {
    const s = Math.sign(cx - xa), xm = xa + s * 0.58;
    const m = new THREE.Group(); m.position.set(xm, 0.6, -0.1);
    m.add(cyl(0.36, 1.3, hm, 'z', 0, 0, 0, 32));
    m.add(cyl(0.37, 0.06, rm, 'z', 0, 0, 0.65, 32)); m.add(cyl(0.37, 0.06, rm, 'z', 0, 0, -0.65, 32));
    m.add(torus(0.3, 0.045, cm, 'z', 0, 0, 0.45)); m.add(torus(0.3, 0.045, cm, 'z', 0, 0, -0.45));
    const rotor = new THREE.Group();
    rotor.add(cyl(0.235, 1.0, rm, 'z', 0, 0, 0, 24));
    for (let i = 0; i < 8; i++){
      const a = (i / 8) * Math.PI * 2;
      const sl = box(0.04, 0.03, 0.96, cm); sl.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0); sl.rotation.z = a; rotor.add(sl);
    }
    rotor.add(cyl(0.06, 1.7, rm, 'z', 0, 0, 0.1, 12));
    const pin = gear(0.12, 11, 0.1, rm, 'z'); pin.position.set(0, 0, 0.65); rotor.add(pin);
    m.add(rotor); motorRotors.push(rotor);
    m.add(box(0.5, 0.14, 0.4, dm, s * 0.45, 0.22, 0.1));
    // gear case (see-through) around pinion + bull gear
    m.add(box(0.7, 0.6, 0.12, seeThrough(0x9aa3ad, 0.18), -s * 0.3, -0.05, 0.65));
    g.add(m);
  }));
});

/* ------------------------------------------------------------ battery */
definePart('battery', g => {
  const bm = mat(pal.battery, { roughness:0.7 }), sm = mat(pal.steel), cm = mat(pal.cable);
  [-1.05, 1.05].forEach(z => {
    g.add(box(1.4, 0.5, 0.7, bm, 3.7, 1.05, z));
    g.add(box(1.42, 0.04, 0.72, sm, 3.7, 1.31, z));
    for (let i = 0; i < 4; i++) g.add(box(0.28, 0.06, 0.6, mat(pal.yellow), 3.2 + i * 0.34, 1.33, z));
  });
  g.add(cable([[4.3, 1.3, 0.9], [4.6, 1.7, 0.6], [5.4, 1.7, 0.2], [6.0, 1.75, 0]], 0.03, cm));
  g.add(cable([[4.3, 1.3, -0.9], [4.6, 1.7, -0.6], [5.4, 1.7, -0.2], [6.0, 1.75, 0]], 0.03, cm));
});

/* -------------------------------------------------------- air compressor */
definePart('compressor', g => {
  const dm = mat(pal.dark), sm = mat(pal.steel, { metalness:0.6 }), tm = mat(pal.tank, { roughness:0.45, metalness:0.5 });
  g.add(box(1.2, 0.55, 0.8, dm, -8.5, 1.95, 0.2));
  [-8.75, -8.25].forEach(x => { g.add(cyl(0.17, 0.42, sm, 'y', x, 2.42, 0.2, 20)); g.add(cyl(0.2, 0.06, dm, 'y', x, 2.65, 0.2, 20)); });
  g.add(box(0.7, 0.5, 0.5, mat(pal.cabinetBlue), -8.5, 1.92, -0.6));                  // drive motor
  const pulley = cyl(0.3, 0.06, sm, 'x', -7.85, 1.95, 0.2, 28); g.add(pulley); compPulley = pulley;
  g.add(torus(0.3, 0.02, mat(pal.black), 'x', -7.85, 1.95, 0.2));
  // main reservoirs under the frame
  [-0.95, 0.95].forEach(z => {
    g.add(cyl(0.28, 3.4, tm, 'x', -6.9, 1.02, z, 28));
    g.add(cyl(0.2, 0.1, tm, 'x', -5.15, 1.02, z, 20)); g.add(cyl(0.2, 0.1, tm, 'x', -8.65, 1.02, z, 20));
  });
  g.add(cable([[-8.5, 2.7, 0.2], [-8.9, 2.4, 0.9], [-8.9, 1.5, 0.95], [-8.6, 1.3, 0.95]], 0.03, sm));
});
