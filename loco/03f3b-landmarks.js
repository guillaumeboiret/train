
/* ---- landmarks: the two termini get their own architecture instead of the generic station building.
   Bordeaux Saint-Jean: the 1898 iron and glass train shed (56 m span, 280 m long, crown at 27 m) with the stone passenger building along its west side.
   Paris Montparnasse: 360 m of platforms under the Jardin Atlantique deck, the head hall across the buffer stops and the 210 m tower beyond it.
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

  /* Bordeaux Saint-Jean */
  {
    const G = new THREE.Group(); G.visible = false; station.add(G); landmarks.bdx = G;
    const stoneM = pmat(0xd9cfba, { roughness:0.9, metalness:0 }), slateM = pmat(0x3d4650, { roughness:0.7, metalness:0.1 }), ironM = pmat(0x4c5359, { roughness:0.55, metalness:0.5 });
    const glassM = new THREE.MeshStandardMaterial({ color:0xbfe0f5, transparent:true, opacity:0.26, roughness:0.15, metalness:0.1, side:THREE.DoubleSide, depthWrite:false });
    const paneM = pmat(0x223040, { roughness:0.3, metalness:0.3 });
    const X0 = -340, X1 = -60, LEN = X1 - X0, XC = (X0 + X1) / 2, ZC = 4, A = 28, B = 16, Y0 = 11;   // hall: x −340..−60, z −24..32, springing 11 m, crown 27 m
    // glass vault: a half ellipse swept along the hall
    { const NP = 26, pos = [], idx = [];
      for (let i = 0; i < 2; i++) for (let k = 0; k <= NP; k++){ const th = Math.PI * k / NP; pos.push(X0 + LEN * i, Y0 + B * Math.sin(th), ZC + A * Math.cos(th)); }
      for (let k = 0; k < NP; k++){ const a = k, b = k + 1, c = NP + 1 + k + 1, d = NP + 1 + k; idx.push(a, b, c, a, c, d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      G.add(new THREE.Mesh(g, glassM));
      // ridge lantern (raised skylight) along the crown
      G.add(box(LEN - 10, 2.0, 7, ironM, XC, Y0 + B + 0.9, ZC)); G.add(box(LEN - 12, 1.4, 6.2, glassM, XC, Y0 + B + 1.0, ZC));
    }
    // iron ribs every 20 m (one instanced mesh) and purlins along the hall
    { const mats = [], NS = 24, q = new THREE.Quaternion(), X_AX = new THREE.Vector3(1, 0, 0);
      for (let x = X0; x <= X1 + 0.1; x += 20) for (let k = 0; k < NS; k++){
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
    // west side: stone base, glass band, pilasters; east side: low parapet and iron columns (open to the other platforms)
    { const ZL = ZC - A, ZR = ZC + A;
      G.add(box(LEN, 3.5, 0.6, stoneM, XC, 1.75, ZL), box(LEN, 7.0, 0.25, glassM, XC, 7.0, ZL), box(LEN, 0.8, 0.9, stoneM, XC, Y0 - 0.4, ZL));
      G.add(box(LEN, 1.2, 0.5, stoneM, XC, 0.6, ZR), box(LEN, 0.8, 0.9, ironM, XC, Y0 - 0.4, ZR));
      const pl = [], cl = [];
      for (let x = X0; x <= X1 + 0.1; x += 20){ pl.push(M4(x, Y0 / 2, ZL)); cl.push(M4(x, Y0 / 2, ZR)); }
      inst(new THREE.BoxGeometry(1.2, Y0, 1.2), stoneM, pl, G, true); inst(new THREE.BoxGeometry(0.8, Y0, 0.8), ironM, cl, G, true);
    }
    // passenger building against the west wall: two storeys, slate mansards, three pavilions, the clock on the middle one
    { const bx0 = -300, bx1 = -100, bl = bx1 - bx0, bxc = (bx0 + bx1) / 2, bz = -36, bd = 18, zf = bz + bd / 2;   // track-side face at z −27
      // the long wing runs between the end pavilions and stops 0.5 m inside them, so none of its ends shares a plane with a
      // pavilion face (at 200 m the slate and the stone fought over the same pixels: the Saint-Jean flicker)
      const wl = bl - 59;
      G.add(box(wl, 13, bd, stoneM, bxc, 6.5, bz), box(wl, 0.6, bd + 1, stoneM, bxc, 13.2, bz), box(wl, 4.5, bd - 3, slateM, bxc, 15.5, bz), box(wl, 0.5, bd - 8, slateM, bxc, 17.9, bz));
      const pav = (cx, w, h) => { G.add(box(w, h, bd + 2, stoneM, cx, h / 2, bz), box(w + 1, 0.6, bd + 3, stoneM, cx, h + 0.2, bz), box(w - 2, 5, bd - 2, slateM, cx, h + 2.9, bz), box(w - 6, 0.6, bd - 8, slateM, cx, h + 5.6, bz)); };
      pav(-200, 40, 19); pav(bx0 + 15, 30, 16); pav(bx1 - 15, 30, 16);
      const clockTex = canvasTex(256, 256, (c) => {
        c.fillStyle = '#f4efe2'; c.beginPath(); c.arc(128, 128, 118, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#2a2a2a'; c.lineWidth = 10; c.stroke();
        for (let i = 0; i < 12; i++){ const a = i / 12 * Math.PI * 2; c.lineWidth = i % 3 ? 5 : 9; c.beginPath(); c.moveTo(128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98); c.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); c.stroke(); }
        c.lineWidth = 10; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(-2.618) * 60, 128 + Math.sin(-2.618) * 60); c.stroke();
        c.lineWidth = 7; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(-0.524) * 92, 128 + Math.sin(-0.524) * 92); c.stroke();
      });
      const clockM = new THREE.MeshBasicMaterial({ map:clockTex, transparent:true });
      for (const [z, ry] of [[zf + 1.06, 0], [bz - bd / 2 - 1.06, Math.PI]]){ const c = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), clockM); c.position.set(-200, 16, z); c.rotation.y = ry; G.add(c); }
      const wm = [];
      for (let x = bx0 + 4; x < bx1 - 3; x += 5){ const inPav = Math.abs(x + 200) < 21 || x < bx0 + 31 || x > bx1 - 31; for (const y of [3.4, 9.2]) wm.push(M4(x, y, zf + (inPav ? 1.05 : 0.05))); }
      inst(new THREE.BoxGeometry(2.2, 3.6, 0.2), paneM, wm, G);
      G.add(sign('BORDEAUX SAINT-JEAN', 26, 2.2, -200, 21.6, zf + 1.1, 0, '#1b2a44', '#f3efe6'));
    }
    noCast(G); G.children.forEach(o => { if (o.isInstancedMesh && o.geometry.parameters && o.geometry.parameters.height === Y0) o.castShadow = true; });
  }

  /* Paris Montparnasse */
  {
    const G = new THREE.Group(); G.visible = false; station.add(G); landmarks.par = G;
    const concM = pmat(0x8d8a84, { roughness:0.95, metalness:0 }), darkM = pmat(0x4b4e52, { roughness:0.9, metalness:0 }), grassM = pmat(0x4f7a3a, { roughness:1, metalness:0 });
    const glassM = pmat(0x9ec5e0, { roughness:0.2, metalness:0.3, transparent:true, opacity:0.55 }), lightM = new THREE.MeshBasicMaterial({ color:0xfff4d6 });
    const DX0 = -366, DX1 = -8, DL = DX1 - DX0, DXC = (DX0 + DX1) / 2, DZ0 = -62, DZ1 = 62, DW = DZ1 - DZ0, DY = 8.6;   // deck: 358 m × 124 m, underside 8.6 m above the rails (OSM: "tunnel" Voie 21 from PK 537.42 to the end)
    const deck = box(DL, 2.4, DW, concM, DXC, DY + 1.2, 0); G.add(deck);
    G.add(box(DL, 0.3, DW - 8, grassM, DXC, DY + 2.55, 0));                                                              // Jardin Atlantique
    G.add(box(DL, 1.2, 0.5, concM, DXC, DY + 3.0, DZ0 + 0.25), box(DL, 1.2, 0.5, concM, DXC, DY + 3.0, DZ1 - 0.25));   // parapets
    G.add(box(DL - 40, 0.35, 6, concM, DXC, DY + 2.75, 0), box(DL - 40, 0.35, 6, concM, DXC, DY + 2.75, -28), box(DL - 40, 0.35, 6, concM, DXC, DY + 2.75, 28));   // garden paths
    { const cm = []; for (let x = DX0 + 15; x < DX1; x += 30) for (const z of [-30, -18, -6.75, 4.9, 16.4, 25.9, 38, 50]) cm.push(M4(x, DY / 2, z));
      inst(new THREE.CylinderGeometry(0.5, 0.5, DY, 12), concM, cm, G, true); }                                          // columns between the tracks and on the island
    { const lm = []; for (const z of [-11, 4.9, 20.9, 34]) lm.push(M4(DXC, DY - 0.15, z)); inst(new THREE.BoxGeometry(DL - 4, 0.12, 0.35), lightM, lm, G); }   // strip lights under the deck
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
    noCast(G); G.children.forEach(o => { if (o.isInstancedMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.height === DY) o.castShadow = true; });
  }
}
