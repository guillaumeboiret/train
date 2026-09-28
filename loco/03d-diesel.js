
/* ============================================================ DIESEL PACK */
const ENGINE = { alpha:THREE.MathUtils.degToRad(27), r:0.25, L:0.85, throws:[-2.4, -1.2, 0, 1.2], phases:[0, Math.PI / 2, Math.PI * 1.5, Math.PI], crankY:2.25 };
const eng = { crank:null, pistons:[] };

definePart('engine', g => {
  const { alpha, r, L, throws, crankY } = ENGINE;
  const bm = mat(pal.engine, { roughness:0.5, metalness:0.35 });
  const dm = mat(pal.engineDark, { roughness:0.6 });
  const caseM = seeThrough(0x35576f, 0.34);
  const sm = mat(pal.steel, { metalness:0.7, roughness:0.3 });
  const pm = mat(pal.piston, { metalness:0.55, roughness:0.35 });
  const linerM = seeThrough(0xa9c4d8, 0.26);
  const exM = mat(0x6f6a62, { roughness:0.8 });
  // crankcase (see-through so the crank and rods stay visible)
  g.add(box(5.8, 1.1, 1.7, caseM, -0.7, 2.2, 0));
  g.add(box(5.9, 0.08, 1.8, dm, -0.7, 1.69, 0));                    // sump plate
  g.add(box(5.9, 0.08, 1.8, dm, -0.7, 2.75, 0));                    // deck plate
  [-3.3, -1.9, -0.5, 0.9, 2.0].forEach(x => g.add(box(0.1, 1.1, 1.7, dm, x, 2.2, 0)));   // main bearing walls
  [-1, 1].forEach(side => {
    const bank = new THREE.Group(); bank.position.set(-0.6, crankY, 0); bank.rotation.x = side * alpha;
    throws.forEach(tx => bank.add(cyl(0.27, 1.0, linerM, 'y', tx + 0.6, 1.0, 0, 24, { open:true })));
    bank.add(box(5.2, 0.32, 0.78, bm, 0, 1.66, 0));                  // cylinder heads
    bank.add(box(5.0, 0.18, 0.62, dm, 0, 1.91, 0));                  // rocker covers
    bank.add(box(5.2, 1.0, 0.06, bm, 0, 1.0, side * 0.36));          // outer bank wall
    bank.add(cyl(0.09, 5.0, exM, 'x', 0, 1.7, side * 0.58, 16));     // exhaust manifold
    for (let i = 0; i < 4; i++) bank.add(cyl(0.06, 0.3, exM, 'y', throws[i] + 0.6, 1.72, side * 0.5, 12));
    g.add(bank);
  });
  // crankshaft
  const crank = new THREE.Group(); crank.position.set(0, crankY, 0);
  crank.add(cyl(0.1, 5.95, sm, 'x', -0.7, 0, 0, 16));
  throws.forEach((tx, i) => {
    const w = new THREE.Group(); w.position.x = tx; w.rotation.x = ENGINE.phases[i];
    w.add(box(0.12, r + 0.1, 0.3, sm, -0.2, r / 2 - 0.02, 0)); w.add(box(0.12, r + 0.1, 0.3, sm, 0.2, r / 2 - 0.02, 0));
    w.add(cyl(0.085, 0.52, sm, 'x', 0, r, 0, 14));
    w.add(box(0.12, 0.22, 0.44, sm, -0.2, -0.16, 0)); w.add(box(0.12, 0.22, 0.44, sm, 0.2, -0.16, 0));
    crank.add(w);
  });
  crank.add(cyl(0.55, 0.12, sm, 'x', 2.3, 0, 0, 40));                // flywheel
  crank.add(cyl(0.32, 0.1, sm, 'x', -3.68, 0, 0, 32));               // damper
  g.add(crank); eng.crank = crank;
  // pistons and connecting rods (positioned every frame)
  const rodM = mat(pal.rod, { metalness:0.7, roughness:0.3 });
  throws.forEach((tx, i) => [-1, 1].forEach(side => {
    const p = cyl(0.245, 0.3, pm, 'y', 0, 0, 0, 24);
    const rod = cyl(0.045, L, rodM, 'y', 0, 0, 0, 10);
    g.add(p); g.add(rod);
    eng.pistons.push({ mesh:p, rod, tx, i, side });
  }));
  g.add(box(5.0, 0.26, 0.5, bm, -0.6, 3.5, 0));                      // intake manifold between banks
  [-3.0, -1.6, -0.2, 1.2].forEach(x => [-1, 1].forEach(side => g.add(cyl(0.05, 0.4, sm, 'z', x, 3.5, side * 0.4, 10))));
  g.add(cyl(0.16, 0.4, sm, 'x', -3.85, 2.6, 0.5, 20));               // water pump
  g.add(cyl(0.16, 0.4, sm, 'x', -3.85, 2.6, -0.5, 20));              // oil pump
  [-3.2, 1.9].forEach(x => [-0.7, 0.7].forEach(z => g.add(box(0.4, 0.1, 0.3, dm, x, 1.65, z))));   // mounts
  // fuel rail
  g.add(cyl(0.03, 5.0, mat(pal.yellow), 'x', -0.6, 3.75, 0, 8));
});
function updateEngine(theta){
  const { alpha, r, L, crankY } = ENGINE;
  eng.crank.rotation.x = theta;
  const d = new THREE.Vector3(), pin = new THREE.Vector3(), base = new THREE.Vector3(), top = new THREE.Vector3(), dir = new THREE.Vector3();
  for (const P of eng.pistons){
    const ph = theta + ENGINE.phases[P.i], a = P.side * alpha;
    d.set(0, Math.cos(a), Math.sin(a));
    pin.set(P.tx, crankY + r * Math.cos(ph), r * Math.sin(ph));
    const rel = ph - a;
    const s = r * Math.cos(rel) + Math.sqrt(L * L - r * r * Math.sin(rel) ** 2);
    base.set(P.tx, crankY, 0);
    top.copy(base).addScaledVector(d, s);
    P.mesh.position.copy(base).addScaledVector(d, s + 0.12);
    P.mesh.quaternion.setFromUnitVectors(Y_UP, d);
    dir.subVectors(top, pin).normalize();
    P.rod.position.copy(pin).add(top).multiplyScalar(0.5);
    P.rod.quaternion.setFromUnitVectors(Y_UP, dir);
  }
}

definePart('turbo', g => {
  const sm = mat(pal.steel, { metalness:0.7, roughness:0.3 });
  g.add(cyl(0.34, 0.4, seeThrough(0xb08d70, 0.4), 'z', -3.25, 3.85, -0.32, 32));   // turbine (hot side)
  g.add(cyl(0.34, 0.4, seeThrough(0xb7c3cf, 0.36), 'z', -3.25, 3.85, 0.32, 32));   // compressor
  g.add(cyl(0.07, 0.9, sm, 'z', -3.25, 3.85, 0, 12));
  const wheel = new THREE.Group(); wheel.position.set(-3.25, 3.85, 0);
  [-0.32, 0.32].forEach(z => { const f = fan(0.27, 9, sm, sm); f.rotation.x = Math.PI / 2; f.position.z = z; wheel.add(f); });
  g.add(wheel); turboWheel = wheel;
  g.add(box(0.7, 0.55, 0.36, mat(pal.cabinet), -3.25, 3.7, 1.18));                  // air filter
  g.add(cable([[-3.25, 3.85, 0.52], [-3.25, 3.85, 1.0]], 0.12, sm));                 // filter to compressor
  g.add(cable([[-3.25, 3.6, 0.32], [-3.0, 3.55, 0.2], [-2.6, 3.58, 0.0]], 0.09, sm)); // compressor to intake manifold
  g.add(cable([[-3.25, 3.85, -0.52], [-3.25, 4.15, -0.5], [-3.25, 4.35, -0.1]], 0.11, mat(0x6f6a62)));   // turbine to stack
  g.add(cable([[-1.6, 3.65, -0.62], [-2.8, 3.7, -0.7], [-3.1, 3.75, -0.62]], 0.07, mat(0x6f6a62)));       // manifold to turbine
});

definePart('exhaust', g => {
  const em = mat(0x4b4f55, { roughness:0.75 });
  g.add(cyl(0.24, 0.85, em, 'y', -3.25, 4.55, 0, 24));
  g.add(cyl(0.3, 0.08, em, 'y', -3.25, 5.0, 0, 24));
  g.add(box(0.9, 0.35, 0.7, em, -3.25, 4.35, 0));                                    // silencer
});

definePart('alternator', g => {
  const y = 2.25;
  const hm = seeThrough(0xd39a5c, 0.3), sm = mat(pal.steel, { metalness:0.7, roughness:0.3 }), cm = mat(pal.copper, { roughness:0.4 });
  g.add(cyl(0.64, 1.9, hm, 'x', 3.4, y, 0, 40));
  g.add(cyl(0.66, 0.08, sm, 'x', 2.49, y, 0, 40)); g.add(cyl(0.66, 0.08, sm, 'x', 4.31, y, 0, 40));
  g.add(torus(0.5, 0.06, cm, 'x', 2.72, y, 0)); g.add(torus(0.5, 0.06, cm, 'x', 4.08, y, 0));
  g.add(cyl(0.58, 1.2, seeThrough(0x8a7f74, 0.22), 'x', 3.4, y, 0, 40, { open:true }));
  const rotor = new THREE.Group(); rotor.position.set(3.4, y, 0);
  rotor.add(cyl(0.32, 1.3, sm, 'x', 0, 0, 0, 24));
  for (let i = 0; i < 8; i++){
    const a = (i / 8) * Math.PI * 2;
    const pole = box(1.2, 0.08, 0.16, cm); pole.position.set(0, Math.cos(a) * 0.37, Math.sin(a) * 0.37); pole.rotation.x = a; rotor.add(pole);
  }
  rotor.add(cyl(0.11, 2.1, sm, 'x', 0, 0, 0, 12));
  g.add(rotor); altRotor = rotor;
  g.add(cyl(0.3, 0.16, sm, 'x', 2.4, y, 0, 24));                                      // coupling
  g.add(box(1.6, 0.1, 1.5, mat(pal.dark), 3.4, 1.7, 0));
  g.add(box(0.4, 0.3, 0.6, mat(pal.dark), 3.4, 3.05, 0));                             // terminal box
  const cm2 = mat(pal.cable);
  [-0.14, 0, 0.14].forEach(z => g.add(cable([[3.5, 3.2, z], [4.0, 3.45, z], [4.6, 3.45, z]], 0.035, cm2)));
});

/* electrical cabinets: rectifier (diesel) / 4Q converter (electric) at x 4.6-5.4, inverters at 5.5-6.5 */
function cabinet(g, cx, len, cz, w, accentColor, accentEmissive){
  const cm = mat(pal.cabinet, { roughness:0.6, metalness:0.2 });
  g.add(box(len, 2.3, w, cm, cx, 2.8, cz));
  const am = mat(accentColor, { roughness:0.5, emissive:accentEmissive ?? 0x000000, emissiveIntensity:0 });
  g.add(box(len - 0.2, 1.4, 0.04, am, cx, 2.9, cz + w / 2 + 0.005));
  g.add(box(len - 0.2, 1.4, 0.04, am, cx, 2.9, cz - w / 2 - 0.005));
  const vm = mat(pal.dark);
  for (let i = 0; i < 6; i++){ g.add(box(len - 0.3, 0.04, 0.02, vm, cx, 1.9 + i * 0.09, cz + w / 2 + 0.03)); g.add(box(len - 0.3, 0.04, 0.02, vm, cx, 1.9 + i * 0.09, cz - w / 2 - 0.03)); }
  return am;
}
definePart('rectifier', g => {
  cabinet(g, 5.0, 0.8, 0, 2.4, 0x2f6fa8);
  // heat sinks on top
  for (let i = 0; i < 5; i++) g.add(box(0.6, 0.18, 0.04, mat(pal.steel), 5.0, 4.03, -0.8 + i * 0.4));
  g.add(cable([[5.0, 3.95, 0.6], [5.3, 3.9, 0.7], [5.5, 3.6, 0.85]], 0.04, mat(pal.cable)));
  g.add(cable([[5.0, 3.95, -0.6], [5.3, 3.9, -0.7], [5.5, 3.6, -0.85]], 0.04, mat(pal.cable)));
});
definePart('inverters', g => {
  [-0.85, 0.85].forEach(z => {
    cabinet(g, 6.0, 1.0, z, 0.66, 0x6f4bb8);   // 0.66 wide: the outer top edge stays inside the TGV's rounded roof side
    const fanM = mat(pal.fan);
    const f = fan(0.22, 6, fanM, mat(pal.dark)); f.position.set(6.0, 4.0, z); g.add(f); roofFans.push({ obj:f, axis:'y', kind:'inv' });
    g.add(torus(0.24, 0.02, mat(pal.dark), 'y', 6.0, 4.0, z));
    // 3-phase cables down into the frame toward the bogies
    const cm = mat(pal.cable);
    [-0.08, 0, 0.08].forEach(dz => g.add(cable([[6.0, 1.65, z + dz], [6.0, 1.3, z + dz * 2], [6.0 + Math.sign(z) * 0.1, 1.2, z * 1.3]], 0.03, cm)));
  });
});
definePart('control', g => {
  g.add(box(1.0, 2.3, 0.5, mat(pal.cabinet, { roughness:0.6 }), 6.0, 2.8, 0));
  const led = mat(0x54ff8a, { emissive:0x54ff8a, emissiveIntensity:0, roughness:0.3 });
  led.userData.lamp = 1.5; lampMats.push(led);
  for (let i = 0; i < 4; i++) g.add(box(0.12, 0.03, 0.12, led, 5.7 + i * 0.2, 3.97, 0));
  g.add(box(0.9, 0.12, 0.4, mat(pal.dark), 6.0, 3.9, 0));
});

definePart('fuelTank', g => {
  const tm = mat(pal.tank, { roughness:0.45, metalness:0.5 });
  g.add(box(5.2, 0.85, 2.6, tm, 0, 0.875, 0));
  g.add(box(5.0, 0.12, 2.4, mat(pal.dark), 0, 0.43, 0));
  [-1.32, 1.32].forEach(z => { g.add(cyl(0.12, 0.08, mat(pal.steel), 'z', 1.8, 1.05, z, 16)); g.add(box(0.3, 0.5, 0.02, mat(pal.band), -1.5, 0.9, z)); });
  // fuel line up to the engine's fuel rail
  g.add(cable([[0.6, 1.3, 1.0], [0.6, 1.75, 1.3], [-0.2, 2.9, 1.15], [-0.6, 3.6, 0.55], [-0.6, 3.75, 0.1]], 0.03, mat(pal.yellow)));
});

definePart('radiator', g => {
  const rm = mat(pal.radiator, { roughness:0.7 }), fm = mat(pal.dark), sm = mat(pal.steel);
  [-1.25, 1.25].forEach(z => {
    g.add(box(3.0, 1.75, 0.14, rm, -5.8, 3.05, z));
    for (let i = 0; i < 12; i++) g.add(box(3.0, 0.02, 0.18, fm, -5.8, 2.25 + i * 0.145, z));
    g.add(box(3.1, 0.08, 0.25, sm, -5.8, 3.96, z)); g.add(box(3.1, 0.08, 0.25, sm, -5.8, 2.15, z));
  });
  g.add(box(3.2, 0.06, 2.6, fm, -5.8, 4.3, 0));                                       // roof hatch
  [-5.0, -6.6].forEach(x => {
    const f = fan(0.7, 7, mat(pal.fan), fm); f.position.set(x, 4.36, 0); g.add(f); roofFans.push({ obj:f, axis:'y', kind:'rad' });
    g.add(torus(0.76, 0.03, sm, 'y', x, 4.36, 0));
  });
  g.add(box(0.8, 0.4, 1.2, sm, -4.6, 3.9, 0));                                        // expansion tank
  const hotM = mat(0xb6412f, { roughness:0.5 }), coldM = mat(0x2f6fa8, { roughness:0.5 });
  [-1, 1].forEach(s => {
    g.add(cable([[-3.85, 2.75, s * 0.5], [-4.2, 3.4, s * 0.9], [-4.4, 3.85, s * 1.15]], 0.06, hotM));
    g.add(cable([[-4.4, 2.25, s * 1.15], [-4.1, 2.2, s * 0.8], [-3.85, 2.45, s * 0.5]], 0.06, coldM));
  });
});

/* resistor grids (roof) shared by both modes */
function buildGrids(g, cx, key){
  const dm = mat(pal.dark), sm = mat(pal.steel);
  g.add(box(1.7, 0.1, 2.2, dm, cx, 4.3, 0));
  const gm = mat(pal.grid, { emissive:0xff3b00, emissiveIntensity:0, roughness:0.6 });
  gridMats[key] = gm;
  [-0.62, 0.62].forEach(z => { for (let i = 0; i < 9; i++) g.add(box(0.035, 0.36, 0.7, gm, cx - 0.56 + i * 0.14, 4.6, z)); });
  g.add(box(1.5, 0.55, 2.0, seeThrough(0x9aa5b1, 0.16), cx, 4.62, 0));
  const f = fan(0.42, 6, mat(pal.fan), dm); f.position.set(cx, 4.4, 0); g.add(f); roofFans.push({ obj:f, axis:'y', kind:key });
  g.add(torus(0.46, 0.025, sm, 'y', cx, 4.4, 0));
}
definePart('brakeGrids', g => {
  buildGrids(g, 3.4, 'brakeGrids');
  const cm = mat(pal.cable);
  g.add(cable([[5.5, 3.95, 0.9], [4.6, 4.2, 0.9], [4.2, 4.5, 0.62]], 0.035, cm));
  g.add(cable([[5.5, 3.95, -0.9], [4.6, 4.2, -0.9], [4.2, 4.5, -0.62]], 0.035, cm));
});
