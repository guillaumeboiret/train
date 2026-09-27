
/* ============================================================ ELECTRIC PACK */
/* pantograph geometry, reusable for the TGV power cars (x0 = base centre) */
function buildPanto(g, x0, pm, im, cm){
  [-0.6, 0.6].forEach(z => { g.add(cyl(0.09, 0.3, im, 'y', x0 + 0.4, 4.4, z, 16)); g.add(cyl(0.09, 0.3, im, 'y', x0 - 0.4, 4.4, z, 16)); });
  g.add(box(1.2, 0.08, 1.5, pm, x0, 4.56, 0));                                         // base frame
  const lower = new THREE.Group(); lower.position.set(x0, 4.6, 0);
  [-0.45, 0.45].forEach(z => lower.add(cyl(0.05, 1.1, pm, 'y', 0, 0.55, z, 12)));
  lower.add(box(0.06, 0.06, 0.9, pm, 0, 1.1, 0));
  const upper = new THREE.Group(); upper.position.set(0, 1.1, 0);
  upper.add(cyl(0.04, 1.35, pm, 'y', 0, 0.675, 0, 12));
  const head = new THREE.Group(); head.position.set(0, 1.35, 0);
  head.add(box(0.12, 0.05, 1.7, cm, 0, 0.05, 0));                                       // carbon strip
  head.add(box(0.36, 0.03, 1.2, pm, 0, 0.0, 0));
  [-0.85, 0.85].forEach(z => { const horn = cyl(0.02, 0.35, pm, 'z', 0, -0.06, z, 8); horn.rotation.x = -Math.sign(z) * 0.55; head.add(horn); });
  upper.add(head); lower.add(upper); g.add(lower);
  g.add(cyl(0.16, 0.5, pm, 'x', x0 - 0.45, 4.75, 0, 16));                              // air motor
  return { lower, upper, head, f:0, x0, headX:x0, headY:4.6 };
}
function posePanto(p, f){
  // lower arm leans toward -x at th1 above horizontal, upper arm comes back toward +x at th2 above horizontal
  const th1 = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(6), THREE.MathUtils.degToRad(34), f);
  const th2 = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(-5), THREE.MathUtils.degToRad(12), f);
  p.lower.rotation.z = Math.PI / 2 - th1;
  p.upper.rotation.z = -(Math.PI / 2 - th1) - (Math.PI / 2 - th2);
  p.head.rotation.z = -(p.lower.rotation.z + p.upper.rotation.z);
  p.f = f;
  p.headY = 4.6 + 1.1 * Math.sin(th1) + 1.35 * Math.sin(th2);
  p.headX = p.x0 - 1.1 * Math.cos(th1) + 1.35 * Math.cos(th2);
}
definePart('pantograph', g => {
  const pm = mat(pal.panto, { metalness:0.6, roughness:0.35 }), im = mat(pal.insulator, { roughness:0.5 });
  Object.assign(panto, buildPanto(g, 2.0, pm, im, mat(0x2a2a2a, { roughness:0.9 })));
  g.add(cable([[2.0, 4.58, 0.5], [3.4, 4.5, 0.6], [4.35, 4.55, 0.3]], 0.03, mat(pal.copper)));   // HV lead to VCB
});
let pantoHook = null;   // the TGV pack poses the rear power cars' pantographs instead (returns true when it did)
function setPanto(f){
  if (pantoHook && pantoHook(f)) return;   // the hook also decides what the lead car's own pantograph does
  posePanto(panto, f);
}

definePart('vcb', g => {
  const im = mat(pal.insulator, { roughness:0.5 }), sm = mat(pal.steel, { metalness:0.7, roughness:0.3 }), cm = mat(pal.copper);
  g.add(cyl(0.12, 0.5, im, 'y', 4.6, 4.5, 0.3, 16)); for (let i = 0; i < 5; i++) g.add(cyl(0.17, 0.05, im, 'y', 4.6, 4.3 + i * 0.1, 0.3, 16));
  g.add(cyl(0.15, 0.55, seeThrough(0xb7c3cf, 0.4), 'y', 4.6, 5.02, 0.3, 20));          // vacuum bottle
  g.add(cyl(0.05, 0.5, cm, 'y', 4.6, 5.05, 0.3, 10));
  g.add(box(0.5, 0.3, 0.5, mat(pal.dark), 4.6, 4.38, -0.3));                           // drive
  g.add(cyl(0.1, 0.5, im, 'y', 5.4, 4.5, -0.2, 16));                                   // roof insulator for the HV feed
  g.add(cable([[4.6, 5.3, 0.3], [5.0, 5.35, 0.1], [5.4, 4.9, -0.2]], 0.03, cm));
  g.add(cable([[5.4, 4.3, -0.2], [5.45, 3.9, -0.6], [5.5, 3.3, -1.25], [3.0, 1.75, -1.25], [2.35, 1.3, -1.0]], 0.035, cm));  // HV cable down to transformer
});

definePart('transformer', g => {
  const tm = seeThrough(0x8ea3b5, 0.3), fm = mat(pal.steel, { roughness:0.5, metalness:0.5 }), cm = mat(pal.copper, { roughness:0.4 }), core = mat(0x3d4650, { roughness:0.8 });
  g.add(box(4.6, 0.9, 2.4, tm, 0, 0.875, 0));
  g.add(box(4.7, 0.06, 2.5, fm, 0, 1.34, 0)); g.add(box(4.7, 0.06, 2.5, fm, 0, 0.42, 0));
  g.add(box(3.6, 0.14, 0.5, core, 0, 1.2, 0)); g.add(box(3.6, 0.14, 0.5, core, 0, 0.55, 0));   // yokes
  [-1.5, 0, 1.5].forEach(x => {
    g.add(box(0.36, 0.65, 0.5, core, x, 0.875, 0));                                     // limb
    g.add(cyl(0.44, 0.5, cm, 'y', x, 0.875, 0, 24, { open:true }));                    // HV coil
    g.add(cyl(0.36, 0.55, mat(0xd18a4a, { roughness:0.5 }), 'y', x, 0.875, 0, 24, { open:true }));   // LV coil
  });
  for (let i = 0; i < 9; i++) [-1.3, 1.3].forEach(z => g.add(box(0.05, 0.8, 0.22, fm, -2.0 + i * 0.5, 0.875, z)));   // cooling fins
  g.add(cyl(0.1, 0.5, mat(pal.insulator), 'y', 2.0, 1.55, -1.0, 16));                 // HV bushing
  const lv = mat(pal.cable);
  [-0.6, 0.6].forEach(z => g.add(cable([[2.2, 1.35, z], [2.6, 1.7, z], [4.6, 2.2, z * 1.2]], 0.045, lv)));   // LV leads to 4Q converter
  g.add(cable([[-2.2, 1.35, 0.8], [-3.0, 1.7, 0.8], [-3.3, 2.0, 0.7]], 0.03, mat(0xb6412f)));   // oil to cooler
  g.add(cable([[-3.3, 1.9, -0.7], [-3.0, 1.6, -0.8], [-2.2, 1.35, -0.8]], 0.03, mat(0x2f6fa8)));
});

definePart('converter4q', g => {
  cabinet(g, 5.0, 0.8, 0, 2.4, 0x1f8a70);
  for (let i = 0; i < 5; i++) g.add(box(0.6, 0.18, 0.04, mat(pal.steel), 5.0, 4.03, -0.8 + i * 0.4));
  g.add(box(0.7, 0.5, 0.6, mat(pal.dark), 5.0, 1.9, 0));                              // DC link capacitors
  g.add(cable([[5.0, 3.95, 0.6], [5.3, 3.9, 0.7], [5.5, 3.6, 0.85]], 0.04, mat(pal.cable)));
  g.add(cable([[5.0, 3.95, -0.6], [5.3, 3.9, -0.7], [5.5, 3.6, -0.85]], 0.04, mat(pal.cable)));
});

definePart('auxConverter', g => {
  g.add(box(1.6, 1.9, 1.0, mat(pal.cabinetBlue, { roughness:0.6 }), -0.3, 2.6, 0.7));
  g.add(box(1.4, 0.9, 0.04, mat(0x9ad3ff, { roughness:0.5 }), -0.3, 2.8, 1.205));
  const f = fan(0.2, 6, mat(pal.fan), mat(pal.dark)); f.rotation.x = Math.PI / 2; f.position.set(-0.3, 3.2, 1.22); g.add(f); roofFans.push({ obj:f, axis:'z', kind:'aux' });
  g.add(cable([[0.5, 2.4, 0.7], [1.2, 2.3, 0.5], [2.2, 1.4, 0.4]], 0.03, mat(pal.cable)));   // feed from transformer aux winding
  g.add(cable([[-1.1, 2.4, 0.7], [-2.0, 2.4, 0.8], [-3.3, 2.6, 0.9]], 0.03, mat(pal.cable))); // to cooling fans
  g.add(box(2.2, 1.9, 1.0, mat(pal.cabinet, { roughness:0.6 }), 0.1, 2.6, -0.7));      // brake / control electronics rack
});

definePart('roofResistors', g => {
  buildGrids(g, -2.5, 'roofResistors');
  const cm = mat(pal.cable);
  g.add(cable([[4.6, 3.95, -0.9], [2.6, 4.28, -1.1], [-1.4, 4.35, -0.9], [-1.9, 4.5, -0.62]], 0.035, cm));
});

definePart('cooling', g => {
  const rm = mat(pal.radiator, { roughness:0.7 }), fm = mat(pal.dark), sm = mat(pal.steel);
  [-1.25, 1.25].forEach(z => {
    g.add(box(2.6, 1.6, 0.14, rm, -6.1, 3.0, z));
    for (let i = 0; i < 11; i++) g.add(box(2.6, 0.02, 0.18, fm, -6.1, 2.27 + i * 0.145, z));
    g.add(box(2.7, 0.08, 0.25, sm, -6.1, 3.85, z)); g.add(box(2.7, 0.08, 0.25, sm, -6.1, 2.15, z));
  });
  g.add(box(2.8, 0.06, 2.6, fm, -6.1, 4.3, 0));
  [-5.4, -6.8].forEach(x => {
    const f = fan(0.62, 7, mat(pal.fan), fm); f.position.set(x, 4.36, 0); g.add(f); roofFans.push({ obj:f, axis:'y', kind:'cool' });
    g.add(torus(0.68, 0.03, sm, 'y', x, 4.36, 0));
  });
  g.add(box(1.2, 1.0, 1.2, mat(pal.cabinet, { roughness:0.6 }), -4.4, 2.3, 0));       // oil pump / heat exchanger
  g.add(cable([[-3.3, 2.0, 0.7], [-4.0, 2.4, 0.9], [-4.9, 3.0, 1.15]], 0.045, mat(0xb6412f)));
  g.add(cable([[-4.9, 2.3, -1.15], [-4.2, 2.2, -0.9], [-3.3, 1.9, -0.7]], 0.045, mat(0x2f6fa8)));
  // converter coolant loop
  g.add(cable([[-4.4, 2.8, 0], [-3.0, 3.9, 0.3], [4.6, 4.0, 0.3]], 0.03, mat(0x2f6fa8)));
});

/* catenary: wires, masts and droppers are built per kilometre in 03f4; this part carries the materials, the label anchor and the highlight */
const catenary = new THREE.Group();
const catWireM = new THREE.MeshStandardMaterial({ color:pal.cat, roughness:0.4, metalness:0.7, side:THREE.DoubleSide });
const catMastM = new THREE.MeshStandardMaterial({ color:0x6a7178, roughness:0.7 });
definePart('catenary', g => {});
parts.catenary.mats.push(catWireM, catMastM);
// the definePart helper adds groups to `loco`; move the catenary out into the world
loco.remove(parts.catenary.group); catenary.add(parts.catenary.group); scene.add(catenary);
