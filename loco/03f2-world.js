
/* ============================================================ wagons + landscape (outside `loco`: never clipped, never exploded) */
function pmat(color, o = {}){ return new THREE.MeshStandardMaterial(Object.assign({ color, roughness:0.55, metalness:0.25 }, o)); }
const wagons = new THREE.Group();
scene.add(wagons);
{
  const fm = pmat(pal.dark, { roughness:0.7 }), wm = pmat(pal.wheel, { roughness:0.45, metalness:0.6 }), sm = pmat(pal.steel, { metalness:0.6 });
  function bogie(parent, cx){
    parent.add(box(3.2, 0.3, 0.2, fm, cx, 0.95, 1.1)); parent.add(box(3.2, 0.3, 0.2, fm, cx, 0.95, -1.1));
    parent.add(box(0.5, 0.3, 2.3, fm, cx, 0.98, 0));
    [cx - 1.0, cx + 1.0].forEach(x => {
      const ax = new THREE.Group(); ax.position.set(x, WHEEL_R, 0);
      ax.add(cyl(0.08, 2.0, sm, 'z', 0, 0, 0, 12));
      [-0.75, 0.75].forEach(z => ax.add(cyl(WHEEL_R, 0.13, wm, 'z', 0, 0, z, 28)));
      parent.add(ax); axles.push(ax);
      parent.add(box(0.34, 0.34, 0.18, fm, x, WHEEL_R, 1.1)); parent.add(box(0.34, 0.34, 0.18, fm, x, WHEEL_R, -1.1));
    });
  }
  function ends(g, L){
    [-L / 2, L / 2].forEach(x => {
      const s = Math.sign(x);
      [-0.95, 0.95].forEach(z => { g.add(cyl(0.1, 0.5, fm, 'x', x + s * 0.25, 1.15, z, 12)); g.add(cyl(0.22, 0.08, fm, 'x', x + s * 0.54, 1.15, z, 16)); });
      g.add(box(0.5, 0.2, 0.26, fm, x + s * 0.3, 1.02, 0));
    });
  }
  function coach(color){
    const g = new THREE.Group(), L = 24;
    const bm = pmat(color, { roughness:0.4, metalness:0.3 }), rm = pmat(pal.roof, { roughness:0.65 }), gm = pmat(0x86b7dc, { roughness:0.2, metalness:0.2 }), band = pmat(pal.band, { roughness:0.5 });
    g.add(box(L, 0.25, 2.9, fm, 0, 1.45, 0));
    g.add(box(L - 0.4, 2.55, 2.85, bm, 0, 2.9, 0));
    g.add(box(L - 0.4, 0.16, 2.92, band, 0, 3.75, 0));
    g.add(box(L - 0.8, 0.5, 2.6, rm, 0, 4.35, 0));
    for (let i = 0; i < 8; i++){ const x = -L / 2 + 3.3 + i * 2.5; [1.45, -1.45].forEach(z => g.add(box(1.6, 0.9, 0.06, gm, x, 3.1, z))); }
    [-L / 2 + 1.2, L / 2 - 1.2].forEach(x => [1.45, -1.45].forEach(z => g.add(box(0.9, 2.1, 0.06, fm, x, 2.7, z))));
    g.add(box(3.0, 0.7, 2.0, fm, 0, 0.95, 0)); g.add(box(1.6, 0.6, 1.8, fm, -5.5, 0.95, 0));
    ends(g, L); bogie(g, -8.3); bogie(g, 8.3);
    return g;
  }
  function tankCar(){
    const g = new THREE.Group(), L = 17;
    const tm = pmat(0x9aa1a8, { roughness:0.35, metalness:0.6 }), band = pmat(0xc0392b, { roughness:0.5 });
    g.add(box(L, 0.3, 2.6, fm, 0, 1.45, 0));
    const tank = cyl(1.35, L - 2.2, tm, 'x', 0, 2.95, 0, 40); g.add(tank);
    [-(L - 2.2) / 2, (L - 2.2) / 2].forEach(x => { const cap = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), tm); cap.position.set(x, 2.95, 0); g.add(cap); });
    g.add(cyl(0.45, 0.5, tm, 'y', 0, 4.45, 0, 20));
    g.add(box(L - 3, 0.12, 0.6, band, 0, 2.2, 1.55));
    [-4, 4].forEach(x => g.add(box(0.5, 1.2, 2.5, fm, x, 2.1, 0)));
    g.add(box(0.5, 2.5, 0.5, fm, L / 2 - 0.6, 2.7, 1.0));
    ends(g, L); bogie(g, -5.5); bogie(g, 5.5);
    return g;
  }
  let x = -9.6 - 1.25;
  for (const w of [coach(0x33659f), coach(0x33659f), tankCar()]){
    const len = (w.children[0].geometry.parameters.width);
    w.position.x = x - len / 2; x -= len + 1.25;
    wagons.add(w);
  }
  wagons.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
}

const world = new THREE.Group();
scene.add(world);
