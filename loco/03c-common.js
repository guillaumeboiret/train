
/* ------------------------------------------------ shared animated handles */
const axles = [], motorRotors = [], roofFans = [], lampMats = [];
let turboWheel = null, altRotor = null, compPulley = null, cabLever = null;
const gridMats = {};
const panto = {};
const WHEEL_R = 0.5;
const Y_UP = new THREE.Vector3(0, 1, 0);

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
  // number plate band on the cab
  g.add(box(2.8, 0.26, 0.02, band, 8.2, 3.05, 1.49)); g.add(box(2.8, 0.26, 0.02, band, 8.2, 3.05, -1.49));
});

/* ------------------------------------------------------------- cab interior */
definePart('cab', g => {
  const dm = mat(pal.dark, { roughness:0.8 }), sm = mat(pal.steel);
  g.add(box(2.7, 0.05, 2.85, mat(0x2b3138, { roughness:0.9 }), 8.2, 1.68, 0));        // floor
  g.add(box(0.55, 0.5, 2.5, dm, 9.15, 2.7, 0));                                        // desk
  g.add(box(0.5, 0.05, 2.4, sm, 9.15, 2.96, 0));
  const scr = mat(0x9fd8ff, { emissive:0x7fc8ff, emissiveIntensity:0, roughness:0.2 });
  scr.userData.lamp = 1.2; lampMats.push(scr);
  [-0.55, 0.15].forEach(z => { const s = box(0.03, 0.34, 0.5, scr, 9.0, 3.2, z); s.rotation.z = 0.25; g.add(s); });
  // throttle lever (rotates with the notch)
  const lever = new THREE.Group(); lever.position.set(9.05, 2.99, 0.7);
  lever.add(box(0.04, 0.32, 0.04, sm, 0, 0.16, 0)); lever.add(box(0.1, 0.08, 0.08, mat(pal.red), 0, 0.32, 0));
  g.add(lever); cabLever = lever;
  // seat
  g.add(box(0.5, 0.08, 0.5, dm, 8.2, 2.35, 0.55)); g.add(box(0.08, 0.6, 0.5, dm, 7.95, 2.65, 0.55)); g.add(cyl(0.05, 0.6, sm, 'y', 8.2, 2.0, 0.55));
  // rear cabinet
  g.add(box(0.3, 1.9, 1.2, mat(pal.cabinet), 7.0, 2.65, -0.7));
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
