
/* ---- landmarks: the termini and Bordeaux get their own architecture instead of the generic station building.
   Toulouse Matabiau: the 1905 stone building along track A, the forecourt, the boulevard and the Canal du Midi under its plane trees.
   Bordeaux Saint-Jean: the 1898 iron and glass train shed over voies 1 to 7 (61 m span, 300 m long, crown at 27 m), the stone passenger building along
   its west side and the six other platforms of its sixteen tracks.
   Paris Montparnasse: 360 m of platforms under the Jardin Atlantique deck, the head hall across the buffer stops and the 210 m tower beyond it.
   Massy TGV: the trench, the slab over its west half, the membrane hall with its dot clock, the four vaults and the car park on the slab.
   Everything is a child of `station`, so it follows the station pose; only the group of the nearest station is visible (poseStation). */
const landmarks = {};
{
  const _qI = new THREE.Quaternion();
  const M4 = (x, y, z, q = null, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q || _qI, new THREE.Vector3(s, s, s));
  const inst = (geo, m, mats, parent, shadow = false) => {
    const im = new THREE.InstancedMesh(geo, m, mats.length);
    mats.forEach((M, i) => im.setMatrixAt(i, M));
    im.castShadow = shadow; im.receiveShadow = true; parent.add(im); return im;
  };
  const textTex = (txt, w, h, bg, fg) => canvasTex(w, h, (c, W, H) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.fillStyle = fg; c.font = `bold ${Math.round(H * 0.58)}px Inter, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, W / 2, H / 2 + H * 0.03);
  });
  const sign = (txt, w, h, x, y, z, rotY, bg, fg) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map:textTex(txt, 1024, Math.round(1024 * h / w), bg, fg), side:THREE.DoubleSide }));
    s.position.set(x, y, z); s.rotation.y = rotY; return s;
  };
  const noCast = o => { o.traverse(m => { if (m.isMesh) m.castShadow = false; }); return o; };   // the big shapes sit outside the shadow frustum: casting would only clip
  const repeatTex = (t, rx, ry) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
  const clockTex = canvasTex(256, 256, (c) => {
    c.fillStyle = '#f4efe2'; c.beginPath(); c.arc(128, 128, 118, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2a2a2a'; c.lineWidth = 10; c.stroke();
    for (let i = 0; i < 12; i++){ const a = i / 12 * Math.PI * 2; c.lineWidth = i % 3 ? 5 : 9; c.beginPath(); c.moveTo(128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98); c.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); c.stroke(); }
    c.lineWidth = 10; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(-2.618) * 60, 128 + Math.sin(-2.618) * 60); c.stroke();
    c.lineWidth = 7; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(-0.524) * 92, 128 + Math.sin(-0.524) * 92); c.stroke();
  });
  const PO = { polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-4 };   // panes, arms, signs and window bands just off a face win the depth test
  const YQ = a => new THREE.Quaternion().setFromAxisAngle(Y_UP, a), qB = YQ(Math.PI), qW = YQ(-Math.PI / 2), qE = YQ(Math.PI / 2);   // facing −z, −x, +x
  /* a big station's other platforms, like ours (the generic island) from x = PX0: [z from, z to, north end, safety line on the z0 face too, stair heads' z].
     Name boards every 48 m, bOff off the middle, and stair heads between them */
  const platPM = pmat(0x9a968e, { roughness:0.95 }), platEM = pmat(0xe8e2d0, { roughness:0.9 }), platSM = pmat(0x545b63, { roughness:0.6 }), platGM = pmat(0x9fd0ff, { roughness:0.2, metalness:0.2 });
  const platforms = (G, PX0, list, bOff = 0) => {
    const boards = [], stairs = [];
    for (const [z0, z1, x1, west, zs] of list){
      const L = x1 - PX0, xc = (PX0 + x1) / 2, zc = (z0 + z1) / 2;
      G.add(box(L, 0.97, z1 - z0, platPM, xc, 0.065, zc), box(L, 0.02, 0.3, platEM, xc, 0.56, z1 - 0.2));   // slab top at 0.55 m, safety lines 0.2 m in
      if (west) G.add(box(L, 0.02, 0.3, platEM, xc, 0.56, z0 + 0.2));
      for (let x = -12; x > PX0 + 10; x -= 48) if (x < x1 - 10) boards.push([x, zc + bOff]);   // name boards as on ours, stair heads between them
      for (let x = -36; x > PX0 + 10; x -= 48) if (x < x1 - 10) stairs.push([x, zs || zc]);
    }
    inst(new THREE.BoxGeometry(4, 1.1, 2.2), platSM, stairs.map(([x, z]) => M4(x, 1.1, z)), G); inst(new THREE.BoxGeometry(3.6, 0.1, 1.9), platGM, stairs.map(([x, z]) => M4(x, 1.7, z)), G);
    const nb = boards.length, faces = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.7), new THREE.MeshBasicMaterial({ map:nameTexs[0] }), 2 * nb);
    const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.78, 0.05), platSM, nb), bposts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 2.05, 0.08), platSM, 2 * nb);
    const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
    const fit = w => {   // the boards take their width from the painted name, like ours (nameSigns)
      boards.forEach(([x, z], i) => {
        _s.set(w, 1, 1); faces.setMatrixAt(2 * i, _m.compose(_v.set(x, 2.95, z + 0.03), _qI, _s)); faces.setMatrixAt(2 * i + 1, _m.compose(_v.set(x, 2.95, z - 0.03), qB, _s));
        frames.setMatrixAt(i, _m.compose(_v.set(x, 2.95, z), _qI, _s.set(w + 0.08, 1, 1)));
        _s.set(1, 1, 1); bposts.setMatrixAt(2 * i, _m.compose(_v.set(x + 0.3 - w / 2, 1.575, z), _qI, _s)); bposts.setMatrixAt(2 * i + 1, _m.compose(_v.set(x + w / 2 - 0.3, 1.575, z), _qI, _s));
      });
      for (const im of [faces, frames, bposts]){ im.instanceMatrix.needsUpdate = true; im.boundingSphere = null; }
    };
    fit(5.3); nameSigns.push({ fit(){ fit(0.7 * nameTexs[0].userData.aspect); } });
    G.add(faces, frames, bposts);
  };
  const prism = (pts, len, m, axis) => {   // a (u, y) profile extruded over len: u = z along x (axis 'x'), u = x along z
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(axis === 'x' ? -u : u, y))), { depth:len, bevelEnabled:false }).translate(0, 0, -len / 2);
    if (axis === 'x') g.rotateY(Math.PI / 2);
    return new THREE.Mesh(g, m);
  };
  const frustum = (w0, d0, w1, d1, h, m) => {   // a hipped roof stage: w0 × d0 at its foot, w1 × d1 h higher, closed on top
    const b = [[-w0 / 2, 0, -d0 / 2], [w0 / 2, 0, -d0 / 2], [w0 / 2, 0, d0 / 2], [-w0 / 2, 0, d0 / 2]], t = [[-w1 / 2, h, -d1 / 2], [w1 / 2, h, -d1 / 2], [w1 / 2, h, d1 / 2], [-w1 / 2, h, d1 / 2]], pos = [];
    const quad = (p, q, r, s) => pos.push(...p, ...q, ...r, ...p, ...r, ...s);
    for (let i = 0; i < 4; i++){ const j = (i + 1) % 4; quad(b[i], t[i], t[j], b[j]); }
    quad(t[0], t[3], t[2], t[1]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return new THREE.Mesh(g, m);
  };
  const archShape = (w, h) => { const s = new THREE.Shape(), r = w / 2; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); return s; };
  const rectShape = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); return s; };
  const winGeo = (sh, w, tw, th = 1.5) => {   // a pane from its outline (bottom centre at the origin), one glazing tile every tw × th metres
    const g = new THREE.ShapeGeometry(sh, 12), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / tw, p.getY(i) / th);
    return g;
  };

  /* Bordeaux Saint-Jean. Station x = OSM distance along the tracks − 278 m (the north end of platform 4;5 at x 0), z = OSM offset + 20.35 m (voie 4 at 0) */
  {
    const G = new THREE.Group(); G.visible = false; station.add(G); landmarks.bdx = G;
    G.userData.platRoof = false;   // the shed roofs our platform (voies 4 and 5): no canopy (setPlatformRoof)
    const stoneM = pmat(0xd9cfba, { roughness:0.9, metalness:0 }), slateM = pmat(0x3d4650, { roughness:0.7, metalness:0.1 }), ironM = pmat(0x4c5359, { roughness:0.55, metalness:0.5 });
    const glassM = new THREE.MeshStandardMaterial({ color:0xbfe0f5, transparent:true, opacity:0.26, roughness:0.15, metalness:0.1, side:THREE.DoubleSide, depthWrite:false });
    const paneM = pmat(0x223040, { roughness:0.3, metalness:0.3 });
    const X0 = -403, X1 = -104, LEN = X1 - X0, XC = (X0 + X1) / 2, ZC = 1.25, A = 30.55, B = 16, Y0 = 11;   // hall: x −403..−104, z −29.3..31.8 over voies 1 to 7, springing 11 m, crown 27 m
    const ribX = Array.from({ length:16 }, (_, q) => X0 + LEN * q / 15);   // a rib every 19.9 m
    // glass vault: a half ellipse swept along the hall
    { const NP = 26, pos = [], idx = [];
      for (let i = 0; i < 2; i++) for (let k = 0; k <= NP; k++){ const th = Math.PI * k / NP; pos.push(X0 + LEN * i, Y0 + B * Math.sin(th), ZC + A * Math.cos(th)); }
      for (let k = 0; k < NP; k++){ const a = k, b = k + 1, c = NP + 1 + k + 1, d = NP + 1 + k; idx.push(a, b, c, a, c, d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      G.add(new THREE.Mesh(g, glassM));
      // ridge lantern (raised skylight) along the crown
      G.add(box(LEN - 10, 2.0, 7, ironM, XC, Y0 + B + 0.9, ZC)); G.add(box(LEN - 12, 1.4, 6.2, glassM, XC, Y0 + B + 1.0, ZC));
    }
    // iron ribs (one instanced mesh) and purlins along the hall
    { const mats = [], NS = 24, q = new THREE.Quaternion(), X_AX = new THREE.Vector3(1, 0, 0);
      for (const x of ribX) for (let k = 0; k < NS; k++){
        const t0 = Math.PI * k / NS, t1 = Math.PI * (k + 1) / NS;
        const y0 = Y0 + B * Math.sin(t0), z0 = ZC + A * Math.cos(t0), y1 = Y0 + B * Math.sin(t1), z1 = ZC + A * Math.cos(t1);
        const dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dy, dz);
        q.setFromAxisAngle(X_AX, -Math.atan2(dy, dz));
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, (y0 + y1) / 2 - 0.45, (z0 + z1) / 2), q, new THREE.Vector3(1, 1, len + 0.3)));
      }
      inst(new THREE.BoxGeometry(0.5, 0.8, 1), ironM, mats, G);
      const pm = []; for (let k = 1; k < 12; k++){ const th = Math.PI * k / 12; pm.push(M4(XC, Y0 + B * Math.sin(th) - 0.55, ZC + A * Math.cos(th))); }
      inst(new THREE.BoxGeometry(LEN, 0.3, 0.3), ironM, pm, G);
    }
    // gables: glazed tympanum above the springing at both ends, trains pass underneath
    { const sh = new THREE.Shape(); sh.absellipse(0, 0, A, B, 0, Math.PI, false); sh.lineTo(A, 0);
      const gg = new THREE.ShapeGeometry(sh, 24);
      for (const x of [X0, X1]){ const m = new THREE.Mesh(gg, glassM); m.rotation.y = Math.PI / 2; m.position.set(x, Y0, ZC); G.add(m); }
    }
    // west side: stone base, glass band, pilasters; east side: the eave on iron columns standing on platform 8, open to the tracks beyond
    { const ZL = ZC - A, ZR = ZC + A;
      G.add(box(LEN, 3.5, 0.6, stoneM, XC, 1.75, ZL), box(LEN, 7.0, 0.25, glassM, XC, 7.0, ZL), box(LEN, 0.8, 0.9, stoneM, XC, Y0 - 0.4, ZL));
      G.add(box(LEN, 0.8, 1.8, ironM, XC, Y0 - 0.4, ZR - 0.7));
      const pl = [], cl = [];
      for (const x of ribX){ pl.push(M4(x, Y0 / 2, ZL)); cl.push(M4(x, Y0 / 2, ZR - 1.2)); }   // columns 0.4 m inside the platform's safety line
      inst(new THREE.BoxGeometry(1.2, Y0, 1.2), stoneM, pl, G, true); inst(new THREE.BoxGeometry(0.8, Y0, 0.8), ironM, cl, G, true);
    }
    // passenger building behind the west wall: two storeys, slate mansards, three pavilions, the clock on the middle one, on the hall's axis
    { const bx0 = -384, bx1 = -124, bl = bx1 - bx0, bxc = (bx0 + bx1) / 2, bd = 18, zf = ZC - A - 3, bz = zf - bd / 2;   // track-side face 3 m behind the hall wall
      // the long wing runs between the end pavilions and stops 0.5 m inside them, so none of its ends shares a plane with a
      // pavilion face (at 200 m the slate and the stone fought over the same pixels: the Saint-Jean flicker)
      const wl = bl - 59;
      G.add(box(wl, 13, bd, stoneM, bxc, 6.5, bz), box(wl, 0.6, bd + 1, stoneM, bxc, 13.2, bz), box(wl, 4.5, bd - 3, slateM, bxc, 15.5, bz), box(wl, 0.5, bd - 8, slateM, bxc, 17.9, bz));
      const pav = (cx, w, h) => { G.add(box(w, h, bd + 2, stoneM, cx, h / 2, bz), box(w + 1, 0.6, bd + 3, stoneM, cx, h + 0.2, bz), box(w - 2, 5, bd - 2, slateM, cx, h + 2.9, bz), box(w - 6, 0.6, bd - 8, slateM, cx, h + 5.6, bz)); };
      pav(bxc, 40, 19); pav(bx0 + 15, 30, 16); pav(bx1 - 15, 30, 16);
      const clockM = new THREE.MeshBasicMaterial({ map:clockTex, transparent:true });
      for (const [z, ry] of [[zf + 1.06, 0], [bz - bd / 2 - 1.06, Math.PI]]){ const c = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), clockM); c.position.set(bxc, 16, z); c.rotation.y = ry; G.add(c); }
      const wm = [];
      for (let x = bx0 + 4; x < bx1 - 3; x += 5){ const inPav = Math.abs(x - bxc) < 21 || x < bx0 + 31 || x > bx1 - 31; for (const y of [3.4, 9.2]) wm.push(M4(x, y, zf + (inPav ? 1.05 : 0.05))); }
      inst(new THREE.BoxGeometry(2.2, 3.6, 0.2), paneM, wm, G);
      G.add(sign('BORDEAUX SAINT-JEAN', 26, 2.2, bxc, 21.6, zf + 1.1, 0, '#1b2a44', '#f3efe6'));
    }
    // the other six platforms (OSM), like ours (the generic island of voies 4 and 5) from x −420: [z from, z to, north end, safety line on the west face too,
    // stair heads' z]. Platform 1 runs along the hall wall; 8 carries the shed's columns and, outside it, the masts of the portals over voies 8 to 17
    // (its stair heads keep west of them); voies 16, 17 and the two service tracks between 14 and 16 have none. Canopies over 9;11 and 12;14 outside the shed
    { const cm = pmat(0xb7bdc4, { roughness:0.85 }), posts = [];
      platforms(G, -420, [[-29.2, -20.7, 20, false], [-13.8, -6.2, 9, true], [15.85, 22.95, -1, true], [26.35, 31.45, -107, true, 28.05], [38.25, 43.75, -159, true], [50.65, 55.45, -188, true]]);
      for (const [xa, xb, z0, z1] of [[-405, -168, 38.85, 43.45], [-357, -192, 51.05, 55.15]]){
        G.add(box(xb - xa, 0.12, z1 - z0, cm, (xa + xb) / 2, 4.25, (z0 + z1) / 2));
        for (let x = -6; x > xa + 2; x -= 12) if (x < xb - 2) posts.push(M4(x, 2.4, (z0 + z1) / 2));
      }
      inst(new THREE.BoxGeometry(0.25, 3.7, 0.25), platSM, posts, G);
    }
    noCast(G); G.children.forEach(o => { if (o.isInstancedMesh && o.geometry.parameters && o.geometry.parameters.height === Y0) o.castShadow = true; });
  }

  /* Paris Montparnasse */
  {
    const G = new THREE.Group(); G.visible = false; station.add(G); landmarks.par = G;
    G.userData.platRoof = false;   // the slab roofs the platforms: no canopies (setPlatformRoof)
    const concM = pmat(0x8d8a84, { roughness:0.95, metalness:0 }), darkM = pmat(0x4b4e52, { roughness:0.9, metalness:0 }), grassM = pmat(0x4f7a3a, { roughness:1, metalness:0 });
    const glassM = pmat(0x9ec5e0, { roughness:0.2, metalness:0.3, transparent:true, opacity:0.55 }), lightM = new THREE.MeshBasicMaterial({ color:0xfff4d6 });
    const DX0 = -366, DX1 = -8, DL = DX1 - DX0, DXC = (DX0 + DX1) / 2, DZ0 = -62, DZ1 = 62, DW = DZ1 - DZ0, DY = 8.6;   // deck: 358 m × 124 m, underside 8.6 m above the rails (OSM: "tunnel" Voie 21 over the last 370 m)
    const ceilM = pmat(0x77746e, { roughness:0.95, metalness:0, emissive:0x4d4a45 });   // the soffit glows a little: its own lamps light it, not the sky
    const deck = new THREE.Mesh(new THREE.BoxGeometry(DL, 2.4, DW), [concM, concM, concM, ceilM, concM, concM]); deck.position.set(DXC, DY + 1.2, 0); deck.receiveShadow = true; G.add(deck);
    G.add(box(DL, 0.3, DW - 8, grassM, DXC, DY + 2.55, 0));                                                              // Jardin Atlantique
    G.add(box(DL, 1.2, 0.5, concM, DXC, DY + 3.0, DZ0 + 0.25), box(DL, 1.2, 0.5, concM, DXC, DY + 3.0, DZ1 - 0.25));   // parapets
    G.add(box(DL - 40, 0.35, 6, concM, DXC, DY + 2.75, 0), box(DL - 40, 0.35, 6, concM, DXC, DY + 2.75, -28), box(DL - 40, 0.35, 6, concM, DXC, DY + 2.75, 28));   // garden paths
    { const cm = []; G.userData.posts = []; for (let x = DX0 + 15; x < DX1; x += 30) for (const z of [-52, -38, -23.6, -9.35, 4.9, 19, 33.2, 50]){ cm.push(M4(x, DY / 2, z)); G.userData.posts.push([x, z, 0.5]); }   // posts: in the walker's way (platRoom)
      inst(new THREE.CylinderGeometry(0.5, 0.5, DY, 12), concM, cm, G, true); }                                          // columns on the platforms and beyond the outer tracks
    { const lm = []; for (const z of [-23.6, -9.35, 4.9, 19, 33.2]) lm.push(M4(DXC, DY - 0.15, z)); inst(new THREE.BoxGeometry(DL - 4, 0.12, 0.35), lightM, lm, G); }   // strip lights over the platforms
    // a platform for every track: islands between lanes 4 and 2, 1 and 3, 5 and 7 (the route spreads those pairs apart) and a side platform along lane 6,
    // ours being the island between lanes 0 and 'B'. Their boards stand 1.6 m off the middle, clear of the columns, as ours do
    platforms(G, -400, [[-26.7, -20.45, 0, false], [-12.45, -6.25, 0, true], [15.9, 22.1, 0, true], [30.1, 36.3, 0, true]], 1.6);
    { const tm = [], crownG = new THREE.ConeGeometry(2.2, 5.5, 7).translate(0, 4.5, 0), trunkG = new THREE.CylinderGeometry(0.2, 0.3, 2, 6).translate(0, 1, 0);
      let i = 0; for (let x = DX0 + 20; x < DX1 - 10; x += 22) for (const z of [-50, -38, 40, 52]) tm.push(M4(x + ((i * 7) % 5) - 2, DY + 2.7, z, null, 1.3 + 0.4 * ((i++ * 5) % 3) / 2));
      inst(crownG, pmat(0x3f7a3d, { roughness:1, metalness:0 }), tm, G); inst(trunkG, pmat(0x5a4636, { roughness:1, metalness:0 }), tm, G); }
    // the 1970s slabs framing the garden on both sides
    { const winTex = repeatTex(canvasTex(64, 64, (c) => { c.fillStyle = '#b9b0a3'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#39404a'; c.fillRect(8, 16, 48, 28); }), 80, 13);
      const slabM = pmat(0xffffff, { roughness:0.9, metalness:0, map:winTex });
      for (const z of [-94, 94]) G.add(box(DL - 40, 42, 22, slabM, DXC - 10, 21, z), box(DL - 38, 1.0, 24, concM, DXC - 10, 42.5, z)); }
    // head hall across the buffer stops: glazed wall towards the platforms, flat roof, the plaza beyond the end of the data
    { const HX0 = 14, HX1 = 58, HZ0 = -130, HZ1 = 130, HH = 18, HXC = (HX0 + HX1) / 2, HW = HZ1 - HZ0;
      G.add(box(400, 0.8, 520, pmat(0x6e6b66, { roughness:1, metalness:0 }), 206, -0.6, 0));                        // plaza, hides the void past the last data point
      G.add(box(HX1 - HX0, 1.6, HW, darkM, HXC, 0.8, 0), box(HX1 - HX0, 2.2, HW, concM, HXC, HH + 1.1, 0));          // floor and roof slabs
      G.add(box(0.4, HH - 1.6, HW, glassM, HX0 + 0.2, (HH + 1.6) / 2, 0));                                           // glazed wall facing the trains
      { const mm = []; for (let z = HZ0 + 3; z < HZ1; z += 6) mm.push(M4(HX0 + 0.45, (HH + 1.6) / 2, z)); inst(new THREE.BoxGeometry(0.35, HH - 1.6, 0.35), darkM, mm, G); }
      G.add(box(HX1 - HX0, HH - 1.6, 0.6, concM, HXC, (HH + 1.6) / 2, HZ0), box(HX1 - HX0, HH - 1.6, 0.6, concM, HXC, (HH + 1.6) / 2, HZ1), box(0.6, HH - 1.6, HW, concM, HX1, (HH + 1.6) / 2, 0));
      G.add(sign('PARIS MONTPARNASSE', 30, 2.6, HX0 - 0.1, HH - 2.4, 4, -Math.PI / 2, '#1b2a44', '#f3efe6'));
    }
    // Tour Montparnasse: 210 m, rounded ends, floor banding, on its low podium, ahead and to the right of the buffer stops
    { const TH = 210, tg = new THREE.Group(); tg.position.set(125, 0, 78); G.add(tg);
      const floorTex = repeatTex(canvasTex(8, 64, (c) => { c.fillStyle = '#1c262f'; c.fillRect(0, 0, 8, 64); c.fillStyle = '#4a5f70'; c.fillRect(0, 10, 8, 30); }), 1, 59);
      const towerM = pmat(0xffffff, { roughness:0.3, metalness:0.5, map:floorTex }), crownM = pmat(0x9aa0a6, { roughness:0.6, metalness:0.2 });
      tg.add(box(32, TH, 18, towerM, 0, TH / 2, 0)); for (const z of [-9, 9]) tg.add(cyl(16, TH, towerM, 'y', 0, TH / 2, z, 28));
      tg.add(box(33, 4, 19, crownM, 0, TH + 2, 0)); for (const z of [-9, 9]) tg.add(cyl(16.5, 4, crownM, 'y', 0, TH + 2, z, 28));
      tg.add(cyl(0.5, 26, crownM, 'y', 0, TH + 17, 0, 8));
      tg.add(box(70, 9, 60, concM, 0, 4.5, 0));
    }
    noCast(G); deck.castShadow = true; G.children.forEach(o => { if (o.isInstancedMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.height === DY) o.castShadow = true; });
  }

  /* Toulouse Matabiau: the 1905 stone building along track A (x −320..−90): two wings under slate mansards, end pavilions, the central pavilion
     with three tall arches, the clock and the name, and the coats of arms of the Midi company's cities in the frieze of the canal front.
     West of it the forecourt, the boulevard and the Canal du Midi between plane trees, with two bridges and moored barges.
     The ground is slabs over x −540..190 whose bottoms sit in the relief, sunk 1.6 m there (LM_BOX in the route code) so the water stays clear of it. */
  {
    const G = new THREE.Group(); G.visible = false; station.add(G); landmarks.tls = G;
    const stoneM = pmat(0xe6dac2, { roughness:0.9, metalness:0 }), trimM = pmat(0xd5c6a6, { roughness:0.9, metalness:0 }), slateM = pmat(0x3d4650, { roughness:0.7, metalness:0.1 });
    const glazM = pmat(0xffffff, Object.assign({ roughness:0.3, metalness:0.2, map:repeatTex(canvasTex(64, 64, (c) => {   // one pane per tile, light glazing bars
      c.fillStyle = '#cfc6b3'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#2a3642'; c.fillRect(3, 3, 58, 58); c.fillStyle = '#cfc6b3'; c.fillRect(0, 31, 64, 2);
    }), 1, 1) }, PO));
    // wings: stone body (track face z −20, canal face z −40), plinth, string course, cornice, mansard; nine bays each at 6.5 m.
    // Like at Saint-Jean every wing end stops 0.5 m inside a pavilion, so no two faces share a plane.
    const WINGS = [[-292.5, -228.5], [-181.5, -117.5]], bays = [];
    for (const [a, b] of WINGS){
      const L = b - a, cx = (a + b) / 2;
      G.add(box(L, 13.42, 20, stoneM, cx, 6.29, -30), box(L, 1.92, 20.6, trimM, cx, 0.54, -30), box(L, 0.4, 20.6, trimM, cx, 7.2, -30), box(L, 0.7, 21.2, trimM, cx, 13.35, -30));
      const r = prism([[-19.7, 13.7], [-21.3, 16.9], [-25.5, 18], [-34.5, 18], [-38.7, 16.9], [-40.3, 13.7]], L, slateM, 'x'); r.position.x = cx; G.add(r);
      for (let k = 0; k < 9; k++) bays.push(a + 6 + 6.5 * k);
    }
    const pavilion = (cx, w, z0, z1, top, roof) => {   // body, plinth, string course, cornice, then the roof stages [w0, d0, w1, d1, h]
      const d = z0 - z1, cz = (z0 + z1) / 2;
      G.add(box(w, top + 0.42, d, stoneM, cx, (top - 0.42) / 2, cz), box(w + 0.6, 1.92, d + 0.6, trimM, cx, 0.54, cz), box(w + 0.6, 0.4, d + 0.6, trimM, cx, 7.2, cz), box(w + 1.2, 0.7, d + 1.2, trimM, cx, top + 0.35, cz));
      let y = top + 0.7;
      for (const [w0, d0, w1, d1, h] of roof){ const f = frustum(w0, d0, w1, d1, h, slateM); f.position.set(cx, y, cz); G.add(f); y += h; }
    };
    for (const cx of [-306, -104]) pavilion(cx, 28, -19.6, -42, 15.5, [[29, 23.4, 23, 17.4, 4], [23, 17.4, 13, 7.4, 1.2]]);
    pavilion(-205, 48, -19.6, -43, 18, [[49, 24.4, 41, 16.4, 4.5], [41, 16.4, 29, 4.4, 1.5]]);
    // central pavilion, both fronts: half-round pediment with the clock, the name under the cornice
    { const ped = new THREE.CylinderGeometry(7.5, 7.5, 1.2, 24, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), clockM = new THREE.MeshBasicMaterial(Object.assign({ map:clockTex, transparent:true }, PO));
      for (const [z, zc, ry] of [[-19.6, -18.95, 0], [-43, -43.65, Math.PI]]){
        const p = new THREE.Mesh(ped, trimM); p.position.set(-205, 18.7, z); G.add(p);
        const c = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), clockM); c.position.set(-205, 22.2, zc); c.rotation.y = ry; G.add(c);
        const s = sign('TOULOUSE MATABIAU', 26, 2.2, -205, 15.4, ry ? z - 0.06 : z + 0.06, ry, '#1b2a44', '#f3efe6'); Object.assign(s.material, PO); G.add(s);
      }
    }
    // windows: arched on the ground floor, the three tall arches of the central pavilion, square-headed above, attic windows in the end pavilions
    { const big = [], arch = [], rect = [], attic = [];
      for (const x of [-219, -205, -191]) big.push(M4(x, 1.2, -19.55), M4(x, 1.2, -43.05, qB));
      for (const x of bays){ arch.push(M4(x, 1.6, -19.95), M4(x, 1.6, -40.05, qB)); rect.push(M4(x, 8, -19.95), M4(x, 8, -40.05, qB)); }
      for (const cx of [-306, -104]){
        for (const dx of [-7, 0, 7]) for (const [y, list] of [[1.6, arch], [8, rect], [12.2, attic]]) list.push(M4(cx + dx, y, -19.55), M4(cx + dx, y, -42.05, qB));
        const xe = cx < -200 ? -320.05 : -89.95, qe = cx < -200 ? qW : qE;   // outer end faces
        for (const dz of [-7, 0, 7]) for (const [y, list] of [[1.6, arch], [8, rect], [12.2, attic]]) list.push(M4(xe, y, -30.8 + dz, qe));
      }
      inst(winGeo(archShape(8.5, 12.2), 8.5, 8.5 / 6), glazM, big, G); inst(winGeo(archShape(2.6, 5), 2.6, 1.3), glazM, arch, G);
      inst(winGeo(rectShape(2, 3), 2, 1), glazM, rect, G); inst(winGeo(rectShape(2, 2), 2, 1), glazM, attic, G);
    }
    // dormers on both slopes of the mansards, one per bay
    { const body = [], cap = [], pane = [];
      for (const x of bays){ body.push(M4(x, 15.3, -20.4), M4(x, 15.3, -39.6)); cap.push(M4(x, 16.55, -20.4), M4(x, 16.55, -39.6)); pane.push(M4(x, 14.5, -19.55), M4(x, 14.5, -40.45, qB)); }
      inst(new THREE.BoxGeometry(2, 2.2, 1.6), trimM, body, G); inst(new THREE.BoxGeometry(2.3, 0.3, 1.9), slateM, cap, G); inst(winGeo(rectShape(1.2, 1.5), 1.2, 0.6, 0.75), glazM, pane, G);
    }
    // the arms of 26 cities in the frieze of the canal front, 13 per wing: plain charges on a shield, one merged mesh from an 8 × 4 atlas
    { const T = ['#d4a92a', '#ece8dc', '#b3261e', '#1f4e9c', '#2e7d32', '#1e1e1e'];
      const shield = c => { c.beginPath(); c.moveTo(8, 6); c.lineTo(56, 6); c.lineTo(56, 30); c.quadraticCurveTo(56, 52, 32, 60); c.quadraticCurveTo(8, 52, 8, 30); c.closePath(); };
      const tex = canvasTex(512, 256, (c) => {
        for (let i = 0; i < 26; i++){
          c.save(); c.translate((i % 8) * 64, Math.floor(i / 8) * 64);
          shield(c); c.fillStyle = T[(i * 5) % 6]; c.fill();
          c.save(); c.clip(); c.fillStyle = c.strokeStyle = T[(i * 5 + 2 + i % 3) % 6]; c.lineWidth = 10; c.beginPath();
          switch (i % 8){
            case 0: c.fillRect(27, 6, 10, 54); c.fillRect(8, 22, 48, 10); break;                       // cross
            case 1: c.fillRect(8, 24, 48, 14); break;                                                  // fess
            case 2: c.fillRect(25, 6, 14, 54); break;                                                  // pale
            case 3: c.moveTo(4, 2); c.lineTo(60, 62); c.stroke(); break;                               // bend
            case 4: c.moveTo(4, 52); c.lineTo(32, 20); c.lineTo(60, 52); c.stroke(); break;            // chevron
            case 5: c.fillRect(8, 6, 48, 18); break;                                                   // chief
            case 6: c.fillRect(32, 6, 24, 24); c.fillRect(8, 30, 24, 30); break;                       // quarterly
            default: c.moveTo(4, 2); c.lineTo(60, 62); c.moveTo(60, 2); c.lineTo(4, 62); c.stroke();   // saltire
          }
          c.restore(); shield(c); c.strokeStyle = '#8a6d2a'; c.lineWidth = 3; c.stroke(); c.restore();
        }
      });
      const pos = [], uv = [], idx = [];
      let i = 0;
      for (const [a, b] of WINGS) for (let k = 0; k < 13; k++, i++){
        const x = a + 0.5 + (b - a - 1) * (k + 0.5) / 13, u0 = (i % 8) / 8, u1 = u0 + 1 / 8, v1 = 1 - Math.floor(i / 8) / 4, v0 = v1 - 1 / 4, n = i * 4;
        pos.push(x + 0.5, 11.5, -40.06, x - 0.5, 11.5, -40.06, x - 0.5, 12.7, -40.06, x + 0.5, 12.7, -40.06);   // facing the canal: +x is on the viewer's left
        uv.push(u0, v0, u1, v0, u1, v1, u0, v1); idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      G.add(new THREE.Mesh(g, pmat(0xffffff, Object.assign({ map:tex, alphaTest:0.5, roughness:0.6, metalness:0.1 }, PO))));
    }
    // platform A along the building (edge 1.7 m from track A), the marquise on iron consoles in front of the wings
    const platM = pmat(0x9a968e, { roughness:0.95 }), lineM = pmat(0xe8e2d0, Object.assign({ roughness:0.9 }, PO)), metM = pmat(0x6f7a80, { roughness:0.5, metalness:0.5 });
    G.add(box(400, 0.97, 4.8, platM, -200, 0.065, -17.6), box(400, 0.02, 0.3, lineM, -200, 0.56, -15.55));
    const cons = [], qc = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.atan2(1.6, 3.5));
    for (const [a, b] of [[-291, -230], [-180, -119]]){
      G.add(box(b - a, 0.2, 4.1, metM, (a + b) / 2, 5.45, -17.95), box(b - a, 0.6, 0.12, metM, (a + b) / 2, 5.25, -15.9));
      for (let k = 0; k < 7; k++) cons.push(M4(a + 3 + (b - a - 6) * k / 6, 4.6, -18.25, qc));
    }
    const consoles = inst(new THREE.BoxGeometry(0.22, 0.22, 3.85), metM, cons, G);
    // the ground, from the building out: forecourt, boulevard, plane tree verge, quay, canal, quay, verge, boulevard, the far bank
    const paveM = pmat(0xc2b9a8, { roughness:0.95, metalness:0 }), asphM = pmat(0x3b3d41, { roughness:0.95, metalness:0 }), grassM = pmat(0x5d7d44, { roughness:1, metalness:0 });
    const quayM = pmat(0xb9ab8e, { roughness:0.9, metalness:0 }), waterM = pmat(0x4b6a58, { roughness:0.15, metalness:0.2 });
    const SX0 = -540, SX1 = 190, YB = -2.8, BR = [-522, 172];   // slab ends, slab bottom (under the sunk relief), bridge axes (the water runs between them)
    const slab = (m, z0, z1, top, x0 = SX0, x1 = SX1) => G.add(box(x1 - x0, top - YB, z0 - z1, m, (x0 + x1) / 2, (top + YB) / 2, (z0 + z1) / 2));
    slab(paveM, -20, -58, 0.6); slab(asphM, -58, -72, 0.5); slab(grassM, -72, -78.4, 0.6); slab(quayM, -78.4, -79, 0.7);
    slab(waterM, -79, -95, -0.6, BR[0], BR[1]); slab(quayM, -95, -95.6, 0.7); slab(grassM, -95.6, -103, 0.6); slab(asphM, -103, -115, 0.5); slab(paveM, -115, -205, 0.6);
    slab(paveM, -79, -95, 0.6, SX0, BR[0]); slab(paveM, -79, -95, 0.6, BR[1], SX1);   // the canal band past the bridges
    for (const x of BR){
      G.add(box(0.6, 0.7 - YB, 16, quayM, x, (0.7 + YB) / 2, -87), box(16, 0.55, 22, quayM, x, 0.475, -87));   // the water's end under the bridge, the deck
      for (const dx of [-7.75, 7.75]) G.add(box(0.5, 1, 22, quayM, x + dx, 1.25, -87));                        // parapets
    }
    { const a = prism([[SX0, 0.6], [SX0 - 12, YB], [SX0, YB]], 185, grassM, 'z'), b = prism([[SX1, 0.6], [SX1, YB], [SX1 + 12, YB]], 185, grassM, 'z');   // banks down to the relief
      const c = prism([[-205, 0.6], [-205, YB], [-217, YB]], SX1 - SX0 + 24, grassM, 'x');
      a.position.z = b.position.z = -112.5; c.position.x = (SX0 + SX1) / 2; G.add(a, b, c); }
    // plane trees along both banks, 9 m apart
    { const tr = [], cr = [], q = new THREE.Quaternion();
      let i = 0;
      for (const z of [-75.2, -99.3]) for (let x = SX0 + 10; x < SX1 - 6; x += 9, i++){
        const h1 = hash2(i, 0, 71), h2 = hash2(i, 0, 73), tx = x + (h1 - 0.5) * 3, r = 4 + 1.5 * h2;
        if (BR.some(b => Math.abs(tx - b) < 10)) continue;
        tr.push(M4(tx, 0.6, z)); cr.push(new THREE.Matrix4().compose(new THREE.Vector3(tx, 9 + h1, z + (h2 - 0.5) * 1.5), q.setFromAxisAngle(Y_UP, h1 * 6.283), new THREE.Vector3(r, 0.85 * r, r)));
      }
      inst(new THREE.CylinderGeometry(0.28, 0.42, 6, 7).translate(0, 3, 0), pmat(0x9c9a82, { roughness:0.9, metalness:0 }), tr, G);
      inst(new THREE.IcosahedronGeometry(1, 1), pmat(0x4e7a3a, { roughness:1, metalness:0, flatShading:true }), cr, G);
    }
    // street lamps along both boulevards, heads over the road
    { const post = [], head = [];
      for (let x = SX0 + 14; x < SX1 - 8; x += 26) for (const [z, dz] of [[-57.4, -0.35], [-115.6, 0.35]]){ post.push(M4(x, 0.6, z)); head.push(M4(x, 6.55, z + dz)); }
      const lampM = pmat(0x2e3438, { roughness:0.5, metalness:0.5 });
      inst(new THREE.CylinderGeometry(0.08, 0.12, 6, 6).translate(0, 3, 0), lampM, post, G); inst(new THREE.BoxGeometry(0.35, 0.22, 0.9), lampM, head, G);
    }
    // four barges moored along the station bank: hull, cabin with its window band, wheelhouse at the stern, one colour per barge
    { const X = [-480, -430, -130, 40], Z = -81.8, hullC = [0x2f4a6b, 0x7a2a2a, 0x2e5a3c, 0x303030].map(c => new THREE.Color(c)), cabC = [0xe9e2d0, 0xb58a5a, 0xe9e2d0, 0xb58a5a].map(c => new THREE.Color(c));
      const paintM = pmat(0xffffff, { roughness:0.6, metalness:0.2 }), woodM = pmat(0xffffff, { roughness:0.8, metalness:0 }), bandM = pmat(0x1f2830, Object.assign({ roughness:0.3, metalness:0.3 }, PO));
      const part = (w, h, d, m, dx, y, cols) => { const im = inst(new THREE.BoxGeometry(w, h, d), m, X.map(x => M4(x + dx, y, Z)), G); if (cols) cols.forEach((c, k) => im.setColorAt(k, c)); };
      part(26, 1.5, 5, paintM, 0, -0.15, hullC); part(26.2, 0.15, 5.2, paintM, 0, 0.62, hullC);                                       // hull, gunwale
      part(16, 1.5, 4, woodM, 1, 1.35, cabC); part(15.4, 0.55, 4.16, bandM, 1, 1.45); part(16.3, 0.12, 4.3, paintM, 1, 2.16, hullC);    // cabin
      part(2.6, 2.2, 3.4, woodM, -10.4, 1.7, cabC); part(2.7, 0.7, 3.5, bandM, -10.4, 2.2); part(2.9, 0.12, 3.7, paintM, -10.4, 2.86, hullC);   // wheelhouse
    }
    noCast(G); consoles.castShadow = true;
  }

  /* Massy TGV (1991): four tracks in an 8.5 m trench (dug by the route code) under a slab over its west half (x −510..−68). On the slab the hall
     across the trench, its white roof hung from six masts, the name and the dot clock on both glazed gables; four small vaults east of it, then
     the car park with its white fins and the office block. Under the slab: the concourse wall with its window band, blue name boards, round
     ceiling lights, walls between the platform tracks and the through tracks. Our platform is the mirrored one (z −1.75..−8), so the forecourt
     (+z) lies across the tracks. The towers around the forecourt are city blocks (route code). */
  {
    const G = new THREE.Group(); G.visible = false; station.add(G); landmarks.msy = G;
    G.userData.platRoof = false;   // the slab roofs the platforms: no canopies (setPlatformRoof)
    const concM = pmat(0xa7a39b, { roughness:0.95, metalness:0 }), ceilM = pmat(0x77746e, { roughness:0.95, metalness:0, emissive:0x4d4a45 }), whiteM = pmat(0xf0eee8, { roughness:0.7, metalness:0 });   // the soffit glows a little: its own lamps light it, not the sky
    const paveM = pmat(0xb4aea4, { roughness:0.95, metalness:0 }), membM = pmat(0xf7f5f0, { roughness:0.8, metalness:0, side:THREE.DoubleSide }), railM = pmat(0x59626a, { roughness:0.5, metalness:0.5 });
    const lightM = new THREE.MeshBasicMaterial({ color:0xfff4d6 }), stayM = new THREE.LineBasicMaterial({ color:0x5f666b });
    const glazM = pmat(0xffffff, Object.assign({ roughness:0.3, metalness:0.2, map:repeatTex(canvasTex(64, 64, (c) => {   // one pane per tile, white frames
      c.fillStyle = '#eceae4'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#34495a'; c.fillRect(2, 2, 60, 60);
    }), 1, 1) }, PO));
    const tiled = (w, h, d, tw, th) => {   // a box whose map repeats every tw × th metres on its sides
      const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dim = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let i = 0; i < 24; i++){ const f = dim[i >> 2]; uv.setXY(i, uv.getX(i) * f[0] / tw, uv.getY(i) * f[1] / th); }
      return g;
    };
    const YD = 8.4, YC = 6.88, DX0 = -510, DX1 = -68, DZ0 = -14, DZ1 = 31, ZW0 = -8.4, ZW1 = 25.4, YS = 8.08;   // slab top and underside, slab extent, trench walls, street level
    // the slab: paved on top, bare concrete under; parapets over the trench at both ends, railings along the open east half
    const deck = new THREE.Mesh(new THREE.BoxGeometry(DX1 - DX0, YD - YC, DZ1 - DZ0), [concM, concM, paveM, ceilM, concM, concM]);
    deck.position.set((DX0 + DX1) / 2, (YD + YC) / 2, (DZ0 + DZ1) / 2); deck.receiveShadow = true; G.add(deck);
    for (const x of [DX0 + 0.25, DX1 - 0.25]) G.add(box(0.5, 1.1, ZW1 - ZW0, concM, x, YD + 0.55, (ZW0 + ZW1) / 2));
    { const pm = [];
      for (let x = DX1 + 2; x <= 25; x += 2) for (const z of [ZW0 - 0.25, ZW1 + 0.25]) pm.push(M4(x, (YS + 9.1) / 2, z));
      inst(new THREE.BoxGeometry(0.06, 9.1 - YS, 0.06), railM, pm, G);
      for (const z of [ZW0 - 0.25, ZW1 + 0.25]) G.add(box(25 - DX1, 0.06, 0.08, railM, (25 + DX1) / 2, 9.1, z));
    }
    // under the slab: the concourse wall behind each platform with its window band and the blue name boards, ceiling lights,
    // the walls between the platform tracks and the through tracks (hidden while the outside camera looks at the train across one, camWalls)
    { const wallTex = canvasTex(64, 128, (c) => {
        c.fillStyle = '#d9d6cf'; c.fillRect(0, 0, 64, 128); c.fillStyle = '#3b4a58'; c.fillRect(0, 12, 64, 28);
        c.fillStyle = '#d9d6cf'; c.fillRect(0, 12, 3, 28); c.fillRect(31, 12, 3, 28); c.fillStyle = '#b3afa6'; c.fillRect(0, 84, 64, 2);
      });
      wallTex.wrapS = THREE.RepeatWrapping;
      const wallM = pmat(0xffffff, { roughness:0.9, metalness:0, map:wallTex, emissive:0xffffff, emissiveMap:wallTex, emissiveIntensity:0.3 });   // lit from the soffit
      for (const [x0, z, ry] of [[-455, ZW0 + 0.3, 0], [-440, ZW1 - 0.3, Math.PI]]){   // the walls stop where the trench widens west of the platforms
        const L = DX1 - x0, g = new THREE.PlaneGeometry(L, YC + 0.42), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / 3);
        const m = new THREE.Mesh(g, wallM); m.position.set((x0 + DX1) / 2, (YC - 0.42) / 2, z); m.rotation.y = ry; m.receiveShadow = true; G.add(m);
      }
      const nameM = new THREE.MeshBasicMaterial(Object.assign({ map:textTex('MASSY TGV', 1024, 128, '#1f4fa0', '#ffffff') }, PO)), nm = [];
      for (let x = -84; x > -440; x -= 48) nm.push(M4(x, 3.2, ZW0 + 0.32), M4(x, 3.2, ZW1 - 0.32, qB));
      inst(new THREE.PlaneGeometry(6.4, 0.8), nameM, nm, G);
      const lm = [];
      for (let x = DX0 + 5, k = 0; x < DX1 - 2; x += 12, k++){ lm.push(M4(x, YC - 0.02, -4.9), M4(x, YC - 0.02, 21.9)); if (k % 2 === 0) lm.push(M4(x, YC - 0.02, 8.5)); }
      inst(new THREE.CircleGeometry(0.6, 16).rotateX(Math.PI / 2), lightM, lm, G);
      const cut = [3.1, 13.9].map(z => box(DX1 + 460, YC + 0.42, 0.5, concM, (DX1 - 460) / 2, (YC - 0.42) / 2, z));
      G.add(...cut); G.userData.cutaway = { x0:-460, x1:DX1, y1:YC, walls:cut };
    }
    // the hall across the trench: glazed on all four sides, the white roof curving down to both long sides, hung from three masts on each
    const HX0 = -447, HX1 = -415, HXC = (HX0 + HX1) / 2, HZ0 = -12, HZ1 = 30, HZC = (HZ0 + HZ1) / 2, HE = 12.5, HR = 7;   // walls 12.5 m high, crown 7 m above them
    const roofY = u => YD + HE + HR * (1 - Math.abs(u / 16) ** 3);
    { const N = 24, pos = [], idx = [], z0 = HZ0 - 1.5, z1 = HZ1 + 1.5, us = Array.from({ length:N + 1 }, (_, k) => -16.6 + 33.2 * k / N);
      us.forEach(u => pos.push(HXC + u, roofY(u), z0, HXC + u, roofY(u), z1));
      for (let k = 0; k < N; k++){ const a = 2 * k; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      G.add(new THREE.Mesh(g, membM));
      const edge = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(us.map(u => new THREE.Vector3(u, roofY(u) - YD, 0))), 48, 0.3, 8);
      inst(edge, whiteM, [M4(HXC, YD, z0), M4(HXC, YD, z1)], G);
      for (const x of [HX0, HX1]) G.add(cyl(0.35, HZ1 - HZ0 + 3, whiteM, 'z', x, YD + HE, HZC, 12));
      const gs = new THREE.Shape(); gs.moveTo(-16, 0); gs.lineTo(16, 0);
      for (let k = 0; k <= 16; k++){ const u = 16 - 2 * k; gs.lineTo(u, roofY(u) - YD - 0.1); }
      inst(winGeo(gs, 32, 2.0, 2.4), glazM, [M4(HXC, YD, HZ0, qB), M4(HXC, YD, HZ1)], G);
      inst(winGeo(rectShape(42, HE), 42, 2, 2.4), glazM, [M4(HX0, YD, HZC, qW), M4(HX1, YD, HZC, qE)], G);
      // on each gable: two white beams, the name with the SNCF logo on the glass between them, the dot clock high up
      const signTex = canvasTex(2048, 150, (c, W, H) => {
        c.font = 'bold 104px Inter, Arial, sans-serif'; c.textBaseline = 'middle';
        const t = 'GARE DE MASSY TGV', tw = c.measureText(t).width, lw = 290, x0 = (W - tw - 70 - lw) / 2, lx = x0 + tw + 70;
        c.fillStyle = '#f2f2ee'; c.fillText(t, x0, H / 2 + 4);
        rrect(c, lx, 16, lw, H - 32, 26, 26); c.fillStyle = '#c4003a'; c.fill();
        c.fillStyle = '#ffffff'; c.font = 'italic bold 92px Inter, Arial, sans-serif'; c.textAlign = 'center'; c.fillText('SNCF', lx + lw / 2, H / 2 + 4);
      });
      const dotTex = canvasTex(256, 256, (c) => {
        c.fillStyle = c.strokeStyle = '#f4f4f0'; c.lineCap = 'round';
        for (let i = 0; i < 12; i++){ const a = i / 12 * Math.PI * 2; c.beginPath(); c.arc(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110, i % 3 ? 7 : 11, 0, Math.PI * 2); c.fill(); }
        c.lineWidth = 11; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(-2.618) * 62, 128 + Math.sin(-2.618) * 62); c.stroke();
        c.lineWidth = 7; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(-0.524) * 96, 128 + Math.sin(-0.524) * 96); c.stroke();
      });
      const signM = new THREE.MeshBasicMaterial(Object.assign({ map:signTex, transparent:true, alphaTest:0.2 }, PO)), dotM = new THREE.MeshBasicMaterial(Object.assign({ map:dotTex, transparent:true, alphaTest:0.2 }, PO));
      for (const [z, o, q] of [[HZ0, -1, qB], [HZ1, 1, _qI]]){
        G.add(box(33.6, 0.7, 1.2, whiteM, HXC, YD + 5.95, z + o * 0.6), box(33.6, 0.4, 1.5, whiteM, HXC, YD + 9.8, z + o * 0.75));
        const s = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.1), signM); s.position.set(HXC, YD + 7.4, z + o * 0.04); s.quaternion.copy(q); G.add(s);
        const d = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), dotM); d.position.set(HXC, YD + 15.2, z + o * 0.04); d.quaternion.copy(q); G.add(d);
      }
      inst(new THREE.CylinderGeometry(0.75, 0.75, HE, 16), whiteM, [HX0, HX1].flatMap(x => [HZ0, HZ1].map(z => M4(x, YD + HE / 2, z))), G);
      // masts 26 m tall beside both long sides, stays down to the roof and back to the slab (west) or the vaults (east)
      const mm = [], st = [];
      for (const z of [-8, HZC, 26]) for (const [x, ru, bx, by] of [[HX0 - 2.5, [-12, -5], HX0 - 15, YD], [HX1 + 1, [12, 5], -398, YD + 12]]){
        mm.push(M4(x, YD + 13, z));
        for (const u of ru) st.push(x, YD + 26, z, HXC + u, roofY(u), z);
        st.push(x, YD + 26, z, bx, by, z);
      }
      inst(new THREE.CylinderGeometry(0.22, 0.3, 26, 10), whiteM, mm, G);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(st, 3)); G.add(new THREE.LineSegments(sg, stayM));
    }
    // four small vaults east of the hall on their glazed base, lunettes at both ends, little masts in the valleys
    { const VX = [-408, -398, -388, -378], VR = 5.32, VS = YD + 8.5, VY = VS + 3.5 - VR;   // 10 m wide, 3.5 m rise, springing 8.5 m above the slab
      inst(new THREE.CylinderGeometry(VR, VR, 42, 16, 1, true, Math.PI - 1.222, 2.444).rotateX(Math.PI / 2), membM, VX.map(x => M4(x, VY, HZC)), G);
      G.add(box(40, VS - YD, 42, whiteM, -393, (YD + VS) / 2, HZC));
      inst(winGeo(rectShape(39, 6.6), 39, 2.0, 2.2), glazM, [M4(-393, YD + 0.9, HZ0 - 0.02, qB), M4(-393, YD + 0.9, HZ1 + 0.02)], G);
      const lun = new THREE.Shape(); lun.moveTo(-5, 0); lun.lineTo(5, 0); lun.absarc(0, VY - VS, VR, 0.349, 2.793, false);
      inst(winGeo(lun, 10, 1.25, 1.2), glazM, VX.flatMap(x => [M4(x, VS, HZ0, qB), M4(x, VS, HZ1)]), G);
      const mm = [], st = [];
      for (const x of [-403, -393, -383]) for (const z of [-4, 22]){ mm.push(M4(x, VS + 3.75, z)); st.push(x, VS + 7.5, z, x - 5, VS + 3.5, z, x, VS + 7.5, z, x + 5, VS + 3.5, z); }
      inst(new THREE.CylinderGeometry(0.16, 0.2, 7.5, 8), whiteM, mm, G);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(st, 3)); G.add(new THREE.LineSegments(sg, stayM));
    }
    // the car park on the slab: three decks behind cream spandrels, white hooked fins along both long faces; the office block at its forecourt end
    { const PX0 = -357, PX1 = -94, PZ0 = -7.9, PZ1 = 30.3, PH = 11;
      const cpM = pmat(0xffffff, { roughness:0.9, metalness:0, map:repeatTex(canvasTex(64, 64, (c) => { c.fillStyle = '#e6e0d2'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#3a4450'; c.fillRect(4, 5, 60, 37); }), 1, 1) });
      const topM = pmat(0x6b6d70, { roughness:0.95, metalness:0 });
      const body = new THREE.Mesh(tiled(PX1 - PX0, PH, PZ1 - PZ0, 8, PH / 3), [cpM, cpM, topM, topM, cpM, cpM]);
      body.position.set((PX0 + PX1) / 2, YD + PH / 2, (PZ0 + PZ1) / 2); G.add(body);
      const fm = [];
      for (let x = PX0 + 6; x < PX1 - 3; x += 11){ fm.push(M4(x, YD, PZ0)); if (x < -302 || x > -253) fm.push(M4(x, YD, PZ1, qB)); }
      inst(prism([[0, 0], [-2.6, 0], [-0.6, 10.4], [-1.4, 11.7], [0, 11.7]], 0.5, whiteM, 'x').geometry, whiteM, fm, G);
      const oM = pmat(0xffffff, { roughness:0.85, metalness:0, map:repeatTex(canvasTex(64, 64, (c) => { c.fillStyle = '#d8d2c4'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#34404c'; c.fillRect(6, 10, 52, 40); }), 1, 1) });
      const office = new THREE.Mesh(tiled(49, 18, 10.4, 3, 3.6), [oM, oM, topM, topM, oM, oM]); office.position.set(-277.5, YS + 9, 35.5); G.add(office);
    }
    // the forecourt and the paving on the far side, saucer lamps on both and on the slab
    G.add(box(140, 0.4, 35, paveM, -430, YS + 0.12, 48.5), box(135, 0.4, 36, paveM, -427.5, YS + 0.12, -32));
    { const lampM = pmat(0x6a5d52, { roughness:0.6, metalness:0.3 }), base = [];
      for (let x = -490; x <= -370; x += 24) for (const z of [40, 58]) base.push(M4(x, YS + 0.3, z));
      for (const x of [-500, -470]) for (const z of [-8, 4, 16, 27]) base.push(M4(x, YD, z));
      inst(new THREE.CylinderGeometry(0.09, 0.14, 8, 6).translate(0, 4, 0), lampM, base, G);
      inst(new THREE.CylinderGeometry(1.1, 0.5, 0.3, 16).translate(0, 8, 0), lampM, base, G);
    }
    noCast(G); deck.castShadow = true;
    // the usual views land in the trench walls or on the car park here (loco coordinates, or the station's with at): the hall's gable from the
    // forecourt, the train's side from our platform, the whole train from the open east end, the rear roof from under the slab
    const at = (x, y, z) => { station.updateWorldMatrix(true, false); return station.localToWorld(new THREE.Vector3(x, y, z)).toArray(); };
    G.userData.cams = {
      station: () => [at(-434, 16, 68.5), at(-434, 18.5, 30)],
      overview: [[22, 12.5, 30], [-2, 2.2, 0]],
      side: [[-18, 3.4, -7.3], [2, 2, 0]],
      far: [[46, 24, 54], [-12, 2, 0]],
      train: () => S.mode === 'tgv' ? [[60, 25, 30], [-40, 2, 0]] : null,
      rearroof: [[-158, 5.9, -7.6], [-176, 4.2, 0]],
    };
  }
}
