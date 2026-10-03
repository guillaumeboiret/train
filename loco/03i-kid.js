
/* ============================================================ KID MODE (separate build: same module scope, appended after the UI) */
/* One screen, no panels: pick a train, push the lever, honk, stop at stations, change the weather; in the top right corner, always, the
   three places to be: the driver's seat, the passenger's (on foot through the TGV) and outside, whose angles open beside it. */
const KID_T = {
  fr:{ title:"Jouer au train", diesel:"Diesel", electric:"Électrique", tgv:"TGV", stop:"Stop", horn:"Klaxon", lever:"Manette", station:"Prochaine gare", service:"Toute la ligne",
       back:"Retour à Bordeaux", auto:"Pilote auto…", doors:"Portes", wx:"Météo", wx_plan:"Météo programmée", tod:"Heure", xray:"Rayons X", hint:"Pousse la manette pour partir !", lever_drag:"Glisse la manette vers le haut pour avancer, vers le bas pour freiner !",
       hint_doors:"Ferme les portes… et c'est parti !", hint_pax:"Attends, tout le monde descend !", hint_end:"Terminus ! Appuie sur 🔄 pour faire demi-tour.", hint_stopped:"Le train doit être arrêté.", service_on:"🔁 Toute la ligne, en boucle", service_off:"Boucle arrêtée", service_last:"Boucle arrêtée : la prochaine gare est la dernière",
       terminus:"Terminus", next:"Prochaine gare", full:"Version complète ↗", game:"Jeu des aiguillages ↗", lang:"Langue",
       panto:"Pantographe", dir_par:"Vers Paris", dir_tls:"Vers Toulouse", turn:"Demi-tour", hint_panto:"Lève le pantographe !", hint_wait:"Le pantographe monte…", sound:"Son",
       v_driver:"Conducteur", v_pax:"Passager", v_out:"Dehors", pax_tgv:"Le passager voyage en TGV : choisis le TGV 🚄",
       o_overview:"Ensemble", o_side:"Profil", o_train:"Tout le train", o_far:"Paysage", o_door:"Portes" },
  en:{ title:"Train playground", diesel:"Diesel", electric:"Electric", tgv:"TGV", stop:"Stop", horn:"Horn", lever:"Lever", station:"Next station", service:"Whole line",
       back:"Back to Bordeaux", auto:"Autopilot…", doors:"Doors", wx:"Weather", wx_plan:"Weather schedule", tod:"Time of day", xray:"X-ray", hint:"Push the lever to go!", lever_drag:"Slide the lever up to go, down to brake!",
       hint_doors:"Closing the doors… off we go!", hint_pax:"Wait, everyone is getting off!", hint_end:"End of the line! Press 🔄 to turn around.", hint_stopped:"The train must be stopped first.", service_on:"🔁 The whole line, again and again", service_off:"Loop stopped", service_last:"Loop stopped: the next station is the last",
       terminus:"Terminus", next:"Next station", full:"Full version ↗", game:"Switch game ↗", lang:"Language",
       panto:"Pantograph", dir_par:"To Paris", dir_tls:"To Toulouse", turn:"Turn around", hint_panto:"Raise the pantograph!", hint_wait:"Pantograph rising…", sound:"Sound",
       v_driver:"Driver", v_pax:"Passenger", v_out:"Outside", pax_tgv:"Passengers ride the TGV: pick the TGV 🚄",
       o_overview:"Overview", o_side:"Side", o_train:"Whole train", o_far:"Landscape", o_door:"Doors" },
};
const kt = k => KID_T[S.lang][k] ?? k;
Object.assign(CAMS, {
  door: () => {   // on the platform just ahead of coach 1's door, over the heads of the queue: the leaf slides toward the camera
    const x = TGV.TRAILERS[0][0] + TR.doorX, V = THREE.Vector3, k = nearestStation().side;
    return [curveLocal(x + 5.5, 2.9, 6.0 * k, new V()).toArray(), curveLocal(x, 1.7, 1.5 * k, new V()).toArray()];
  },
  train: () => S.mode === 'tgv' ? [[-60, 40, 150], [-85, 2, 0]] : [[-28, 9, 14], [6, 2.5, 0]],       // the whole train: a 200 m TGV from the side, a loco chased from behind
});
// toy physics per train: top speed in about a minute, STOP in well under one; the explainer keeps the real numbers (all 1)
const KID_MUL = { tgv:{ p:3, a:3, b:2 }, electric:{ p:3, a:1.2, b:3 }, diesel:{ p:3, a:1.2, b:3 } };

document.body.classList.add('kid');
document.head.insertAdjacentHTML('beforeend', `<style>
body.kid .topbar,body.kid .dock,body.kid .infocard,body.kid .gauges,body.kid #hud{display:none!important}
body.in-cab:not(.cab-ui) :is(.kid-top,.kid-menu,.kid-bottom){display:none}
body.kid.walking :is(.kid-top,.kid-menu,.kid-bottom){display:none}
body.kid .walk-bar button{border:0;background:rgba(255,255,255,.93);color:#1b2430;box-shadow:0 4px 12px rgba(0,0,0,.25);-webkit-backdrop-filter:none;backdrop-filter:none}
body.kid .walk-stick{--d:150px;left:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));background:rgba(255,255,255,.3);border:3px solid rgba(255,255,255,.9);box-shadow:0 4px 12px rgba(0,0,0,.25);-webkit-backdrop-filter:none;backdrop-filter:none}
body.kid .walk-stick.r{left:auto;right:10px}
body.kid .walk-stick b{background:#fff;border:0;box-shadow:0 4px 10px rgba(0,0,0,.35)}body.kid .walk-stick.on b{background:#f28c28}
body.kid .walk-sit{right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));height:64px;border-radius:32px;padding:0 26px;font:700 18px/1 var(--font-display);letter-spacing:.06em;text-transform:uppercase}
body.kid.touch .walk-sit{bottom:calc(174px + env(safe-area-inset-bottom,0px))}   /* over the right stick */
body.kid .walk-leave,body.kid .cab-bar{display:none}   /* the way out is the corner's views */
body.kid .walk-say{top:12px;max-width:calc(100% - 2 * (var(--kid-side,110px) + 30px));background:rgba(255,255,255,.93);color:#1b2430;border:0;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,.25);-webkit-backdrop-filter:none;backdrop-filter:none;font:600 17px/1.3 var(--font-body)}
body.kid .bar-menu{right:calc(var(--kid-side,110px) + 20px);width:min(480px,calc(100% - var(--kid-side,110px) - 36px));background:rgba(255,255,255,.97);color:#1b2430;border:0;border-radius:20px;box-shadow:0 8px 24px rgba(0,0,0,.3);padding:16px}
body.kid .walk-bar .bar-menu button{border:0;background:#eef2f6;color:#1b2430;box-shadow:none}
body.kid .bar-items{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}body.kid .walk-bar .bar-menu .bar-item{min-height:64px;border-radius:14px}body.kid .bar-e{font-size:30px}body.kid .bar-n{font-size:15px}body.kid .bar-p{color:#5b6672;font-size:13px}
body.kid .bar-title{font-size:26px}body.kid .bar-wallet{background:#fff4e6;border-color:#f28c28;color:#1b2430;font-size:15px}body.kid .walk-bar .bar-menu .bar-x{width:44px;height:44px;font-size:20px}
body.kid .walk-bar .bar-menu .bar-chip{width:52px;height:52px;font-size:28px}body.kid .bar-tray{font-size:15px}body.kid .bar-tray-hint{color:#5b6672}
body.kid .walk-bar .bar-menu .bar-pocket{background:#f28c28;color:#1b1206;font:700 16px/1 var(--font-display);letter-spacing:.04em;text-transform:uppercase;padding:12px 18px}
body.kid .lbl{font:600 15px/1 var(--font-body);padding:8px 12px;border-radius:10px;background:#fff;color:#1b2430;border-color:#fff}
body.kid .lbl::after{background:#fff;height:18px}
#kid{position:absolute;inset:0;pointer-events:none;color:#1b2430;font-family:var(--font-body);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#kid button,#kid input,#kid a{touch-action:manipulation}
#kid button{font:inherit;cursor:pointer}
#kid button:focus-visible,#kid a:focus-visible{outline:3px solid #f28c28;outline-offset:2px}
.kid-top{position:absolute;top:10px;left:10px;right:calc(var(--kid-side,110px) + 20px);display:flex;align-items:flex-start;gap:10px;pointer-events:none}
.kid-top>*{pointer-events:auto}
.kid-panel{background:rgba(255,255,255,.93);border-radius:22px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.kid-trains{display:flex;gap:4px;padding:6px}
.kt{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:78px;padding:6px 8px;border-radius:16px;border:0;background:transparent;color:#1b2430}
.kt .ico{font-size:30px;line-height:1.1}
.kt .lab,.kb .lab,.kid-lever-lab b{font:700 12px/1 var(--font-display);letter-spacing:.06em;text-transform:uppercase}
.kt[aria-pressed="true"]{background:#f28c28;color:#1b1206}
.kid-speed{flex:1;display:flex;flex-direction:column;align-items:center;align-self:flex-start;margin:0 auto;padding:8px 18px 9px;min-width:170px;max-width:360px}
.kid-speed .n{font:700 46px/1 var(--font-display);font-variant-numeric:tabular-nums;letter-spacing:.01em}
.kid-speed .n small{font-size:16px;margin-left:5px;letter-spacing:.06em}
.kid-next{font:600 13.5px/1.2 var(--font-body);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
body.kid .compass{background:rgba(255,255,255,.93);border:0;box-shadow:0 6px 18px rgba(0,0,0,.25);-webkit-backdrop-filter:none;backdrop-filter:none;--ink:#1b2430;--muted:#5d6b78;--panel-solid:#fff;--accent:#f28c28}
.kid-gear{width:46px;height:46px;border-radius:50%;border:0;background:rgba(255,255,255,.85);font-size:22px;line-height:1;box-shadow:0 4px 12px rgba(0,0,0,.25);flex:0 0 auto}
/* the corner column: the views, then in the cab its 🎛️, then the compass; what comes and goes sits under the views, which never move */
.kid-side{position:absolute;top:10px;right:10px;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none}
.kid-side>*{pointer-events:auto}
.kid-views{display:flex;flex-direction:column;gap:4px;padding:6px}
.kid-views .kt.off{opacity:.45}
.kid-angles{position:absolute;top:0;right:calc(100% + 10px);display:flex;flex-direction:column;gap:4px;padding:6px}
.kid-angles[hidden]{display:none}
.kid-angles .kt{flex-direction:row;justify-content:flex-start;gap:10px;min-width:0;padding:8px 16px 8px 10px;white-space:nowrap}
.kid-angles .kt .ico{font-size:26px}.kid-angles .kt .lab{display:block}
body.kid .kid-side .compass{position:relative;top:auto;right:auto}
body.kid #cabUi{width:56px;height:56px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.93);color:#1b2430;font-size:28px;line-height:1;box-shadow:0 4px 12px rgba(0,0,0,.25)}
body.kid #cabUi[aria-pressed="true"]{background:#f28c28}
body.kid:not(.in-cab) #cabUi{display:none}
body.kid #kidNoGui{width:56px;height:56px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.93);color:#1b2430;box-shadow:0 4px 12px rgba(0,0,0,.25)}
body.kid #kidNoGui .ng-ico{width:26px;height:26px;stroke-width:2.4}
body.kid #guiBack{width:56px;height:56px;top:max(10px,env(safe-area-inset-top,0px));right:max(10px,env(safe-area-inset-right,0px))}body.kid #guiBack .ng-ico{width:28px;height:28px}
body.kid .cab-deck{inset:10px calc(var(--kid-side,110px) + 20px) 10px 10px;gap:10px}body.kid .cab-line{align-self:stretch;width:auto;background:rgba(255,255,255,.93);border:0;border-radius:22px;box-shadow:0 6px 18px rgba(0,0,0,.25);padding:12px 22px 2px;-webkit-backdrop-filter:none;backdrop-filter:none}
body.kid .cab-row .seg{border:0;border-radius:14px;background:#e8edf3}body.kid .cab-row button{padding:8px 16px;font:700 17px/1 var(--font-body);color:#1b2430}body.kid .cab-row button[aria-pressed="true"]{background:#2f9e44;color:#fff}
body.kid .cab-say{background:rgba(255,255,255,.93);color:#1b2430;border:0;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,.25);-webkit-backdrop-filter:none;backdrop-filter:none;font:700 19px/1.3 var(--font-body)}body.kid .cab-say.l{left:116px}
body.kid .cab-lever{margin:auto 0;gap:4px;padding:10px 12px;background:rgba(255,255,255,.93);border:0;border-radius:22px;box-shadow:0 6px 18px rgba(0,0,0,.25);-webkit-backdrop-filter:none;backdrop-filter:none}
body.kid .cl-end{font-size:26px;line-height:1}
body.kid .cl-track{width:58px;height:min(250px,38vh);margin:26px 0}
body.kid .cl-track::before{width:24px;top:-10px;bottom:-10px;border-radius:12px;background:linear-gradient(#e5484d,#ffcf33 45%,#3ccf6f);box-shadow:inset 0 2px 4px rgba(0,0,0,.25)}
body.kid .cl-track i{display:none}
body.kid #clKnob{left:50%;right:auto;width:52px;height:52px;border-radius:50%;transform:translate(-50%,-50%);background:#fff;border:5px solid #1b2430;box-shadow:0 4px 10px rgba(0,0,0,.35)}
body.kid #clVal{left:calc(100% + 22px);font:700 16px/1 var(--font-display);letter-spacing:.04em;padding:7px 10px;border-radius:10px;background:#f28c28;color:#1b1206}
.kid-menu{position:absolute;top:64px;right:calc(var(--kid-side,110px) + 20px);padding:12px;display:flex;flex-direction:column;gap:8px;min-width:220px;pointer-events:auto}
.kid-menu[hidden]{display:none}
.kid-menu .seg{display:flex;border:2px solid #1b2430;border-radius:10px;overflow:hidden}
.kid-menu .seg button{flex:1;border:0;background:#fff;padding:8px;font-weight:700;color:#1b2430}
.kid-menu .seg button[aria-pressed="true"]{background:#1b2430;color:#fff}
.kid-menu a{display:block;padding:9px 12px;border-radius:10px;background:#f1f4f7;color:#1b2430;text-decoration:none;font-weight:600}
.kid-menu .wx-plan{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}   /* the day's weather plan, 3 hours a box */
.kid-menu .wx-plan button{padding:6px 0 5px;border:2px solid #d5dce3;border-radius:10px;background:#fff;color:#1b2430;font:700 12px/1 var(--font-body)}
.kid-menu .wx-plan button span{font-size:22px}.kid-menu .wx-plan button[aria-current="time"]{border-color:#1b2430}
.kid-menu .lab{font:700 11px/1 var(--font-display);letter-spacing:.08em;text-transform:uppercase;color:#5d6b78}
.kid-toast{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);background:#f28c28;color:#1b1206;font:700 22px/1.2 var(--font-display);padding:14px 22px;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:min(90%,520px);text-align:center;opacity:0;transition:opacity .3s;pointer-events:none}
.kid-toast.show{opacity:1}
.kid-bottom{position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:10px;pointer-events:none}
.kid-bottom>*{pointer-events:auto}
.kid-route{padding:12px 22px 2px}
body.kid #routeBar{height:46px;margin:0;cursor:pointer}
body.kid #routeBar::before{left:12px;right:12px;top:10px;height:5px;border-radius:3px;background:#c9d0d8}
body.kid .rb-in{inset:0 12px}
body.kid .rb-st{width:26px;height:25px}
body.kid .rb-st i{width:18px;height:18px;border:3px solid #1b2430;background:#fff}
body.kid .rb-lb{top:27px;font:700 13px/1 var(--font-display);letter-spacing:.04em;color:#1b2430}
body.kid .rb-lb.r{transform:translateX(-9px)}body.kid .rb-lb.l{transform:translateX(calc(9px - 100%))}
body.kid #rbTrain{width:24px;height:18px;top:3.5px;border-radius:5px;background:#f28c28;box-shadow:0 0 0 3px #fff,0 2px 6px rgba(0,0,0,.3)}
body.kid #rbTip{font-size:13px;padding:5px 9px;top:-30px;border-radius:8px}
.kid-controls{display:flex;gap:10px;align-items:stretch;justify-content:center;flex-wrap:wrap;padding:10px}
.kb{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:86px;height:86px;padding:6px 10px;border-radius:20px;border:0;background:#f1f4f7;color:#1b2430;box-shadow:0 4px 0 rgba(0,0,0,.2);transition:transform .05s,box-shadow .05s}
.kb .ico{font-size:34px;line-height:1}
.kb:active,.kb.on{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.2)}
.kb[aria-pressed="true"]{box-shadow:0 0 0 4px #f28c28 inset,0 4px 0 rgba(0,0,0,.2)}
.kb:disabled{opacity:.4;cursor:default}
.elec-only{display:contents}body[data-mode="diesel"] .elec-only{display:none}
.kb.red{background:#e5484d;color:#fff}.kb.yellow{background:#ffcf33}.kb.green{background:#3ccf6f;color:#0b2e17}.kb.blue{background:#4c8dff;color:#fff}
.kb.auto .ico{animation:kidPulse 1s infinite}
@keyframes kidPulse{50%{transform:scale(1.25)}}
.kid-lever{flex:1 1 300px;min-width:220px;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:0 6px}
.kid-lever-lab{display:flex;justify-content:space-between;align-items:center;font-size:22px;line-height:1}
.kid-lever input{-webkit-appearance:none;appearance:none;width:100%;height:60px;margin:0;background:transparent;cursor:pointer}
.kid-lever input::-webkit-slider-runnable-track{height:26px;border-radius:13px;background:linear-gradient(90deg,#3ccf6f 0%,#ffcf33 55%,#e5484d 100%);box-shadow:inset 0 2px 4px rgba(0,0,0,.25)}
.kid-lever input::-moz-range-track{height:26px;border-radius:13px;background:linear-gradient(90deg,#3ccf6f 0%,#ffcf33 55%,#e5484d 100%)}
.kid-lever input::-webkit-slider-thumb{-webkit-appearance:none;width:58px;height:58px;margin-top:-16px;border-radius:50%;background:#fff;border:5px solid #1b2430;box-shadow:0 4px 10px rgba(0,0,0,.35)}
.kid-lever input::-moz-range-thumb{width:48px;height:48px;border-radius:50%;background:#fff;border:5px solid #1b2430;box-shadow:0 4px 10px rgba(0,0,0,.35)}
.kid-lever.auto input::-webkit-slider-thumb{border-color:#f28c28}
@media (max-width:960px){
  .kt{min-width:60px;padding:5px 6px}.kt .ico{font-size:26px}
  .kid-speed{min-width:0;padding:6px 12px}.kid-speed .n{font-size:34px}.kid-next{font-size:12px}
  .kb{min-width:66px;height:70px;border-radius:16px;gap:3px}.kb .ico{font-size:28px}.kb .lab{font-size:10.5px}
  .kid-lever{flex-basis:100%;order:-1}
  .kid-controls{gap:8px;padding:8px}
  .kid-route{padding:10px 16px 0}
}
@media (max-width:520px){
  .kid-top{gap:6px}.kt{min-width:52px}.kt .lab{display:none}.kt .ico{font-size:28px}
  .kid-speed{padding:4px 10px}.kid-speed .n{font-size:30px}.kid-next{display:none}
  .kb .lab{display:none}.kb{min-width:60px;height:60px}
  body.kid .rb-st{width:18px}body.kid .rb-st i{width:12px;height:12px}   /* 13 stops 26 px apart: room to tap between two dots */
  body.kid .bar-menu{padding:10px}body.kid .bar-items{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}   /* two columns on a phone held upright */
}
@media (max-height:520px){   /* phone held sideways: one thin row of controls, the view stays visible */
  .kid-top{top:6px;left:6px;right:calc(var(--kid-side,80px) + 12px);gap:6px}
  .kid-side{top:6px;right:6px;gap:6px}.kid-views,.kid-angles{padding:4px;gap:2px}.kid-angles{right:calc(100% + 6px)}.kid-angles .kt{padding:5px 12px 5px 8px}.kid-angles .kt .ico{font-size:22px}
  body.kid #cabUi{width:46px;height:46px;font-size:23px}body.kid #kidNoGui,body.kid #guiBack{width:46px;height:46px}
  .kt{min-width:46px;padding:3px 6px}.kt .ico{font-size:22px}.kt .lab{display:none}
  .kid-speed{padding:2px 12px 3px;min-width:0}.kid-speed .n{font-size:26px}.kid-speed .n small{font-size:12px}.kid-next{display:block;font-size:11px;margin-top:0}
  .kid-gear{width:36px;height:36px;font-size:17px}.kid-menu{top:48px;right:calc(var(--kid-side,80px) + 12px)}
  body.kid .compass{width:44px;height:44px}
  body.kid .cab-deck{inset:6px calc(var(--kid-side,80px) + 12px) 6px 6px;gap:6px}body.kid .cab-line{padding:6px 14px 0}body.kid .cab-lever{padding:6px 8px}body.kid .cl-end{font-size:20px}
  body.kid .cl-track{width:48px;margin:20px 0}body.kid #clKnob{width:42px;height:42px;border-width:4px}
  .kid-toast{font-size:17px;padding:10px 16px;top:32%}
  body.kid .walk-stick{--d:110px;left:6px;bottom:calc(6px + env(safe-area-inset-bottom,0px))}body.kid .walk-stick.r{left:auto;right:6px}
  body.kid .walk-sit{right:6px;bottom:calc(6px + env(safe-area-inset-bottom,0px));height:50px;padding:0 18px;font-size:15px}body.kid.touch .walk-sit{bottom:calc(124px + env(safe-area-inset-bottom,0px))}
  body.kid .walk-say{top:8px;font-size:15px;max-width:calc(100% - 2 * (var(--kid-side,80px) + 18px))}
  body.kid .bar-menu{right:calc(var(--kid-side,80px) + 12px);bottom:calc(6px + env(safe-area-inset-bottom,0px));max-height:calc(100% - 64px);padding:10px}body.kid .walk-bar .bar-menu .bar-item{min-height:50px}body.kid .bar-e{font-size:24px}body.kid .walk-bar .bar-menu .bar-chip{width:44px;height:44px;font-size:24px}
  .kid-bottom{left:6px;right:6px;bottom:calc(6px + env(safe-area-inset-bottom,0px));gap:6px}
  .kid-route{padding:4px 12px 0}
  body.kid #routeBar{height:34px}body.kid #routeBar::before{top:7px;height:4px}
  body.kid #routeBar::before{left:10px;right:10px}body.kid .rb-in{inset:0 10px}
  body.kid .rb-st{width:20px;height:18px}body.kid .rb-st i{width:14px;height:14px;border-width:2px}
  body.kid .rb-lb{top:19px;font-size:11px}body.kid .rb-lb.r{transform:translateX(-7px)}body.kid .rb-lb.l{transform:translateX(calc(7px - 100%))}
  body.kid #rbTrain{width:18px;height:14px;top:2px}
  .kid-controls{gap:6px;padding:6px;flex-wrap:nowrap}
  .kb{min-width:50px;height:52px;border-radius:14px;gap:0;padding:4px}.kb .ico{font-size:24px}.kb .lab{display:none}
  .kid-lever{flex:1 1 100px;min-width:100px;order:0;gap:0}.kid-lever-lab{display:none}
  .kid-lever input{height:44px}
  .kid-lever input::-webkit-slider-runnable-track{height:20px;border-radius:10px}
  .kid-lever input::-webkit-slider-thumb{width:44px;height:44px;margin-top:-12px;border-width:4px}
  .kid-lever input::-moz-range-thumb{width:38px;height:38px;border-width:4px}
}
</style>`);
$('c3d').parentElement.insertAdjacentHTML('beforeend', `<div id="kid">
  <div class="kid-top">
    <div class="kid-panel kid-trains" id="kidTrains" role="group">
      <button type="button" class="kt" data-mode="diesel" aria-pressed="false"><span class="ico">🚂</span><span class="lab" data-kid="diesel"></span></button>
      <button type="button" class="kt" data-mode="electric" aria-pressed="false"><span class="ico">🚆</span><span class="lab" data-kid="electric"></span></button>
      <button type="button" class="kt" data-mode="tgv" aria-pressed="true"><span class="ico">🚄</span><span class="lab" data-kid="tgv"></span></button>
    </div>
    <div class="kid-panel kid-speed"><div class="n"><span id="kidSpeed">0</span><small>km/h</small></div><div class="kid-next" id="kidNext"></div></div>
    <button type="button" class="kid-gear" id="kidGear" aria-expanded="false" aria-label="Menu">⚙️</button>
  </div>
  <div class="kid-panel kid-menu" id="kidMenu" hidden>
    <span class="lab" data-kid="lang"></span>
    <div class="seg" id="kidLang"><button type="button" data-lang="fr" aria-pressed="true">Français</button><button type="button" data-lang="en" aria-pressed="false">English</button></div>
    <span class="lab" data-kid="sound"></span>
    <div class="seg" id="kidSound"><button type="button" data-m="0" aria-pressed="true">🔊</button><button type="button" data-m="1" aria-pressed="false">🔇</button></div>
    <span class="lab" data-kid="wx_plan"></span>
    <div class="wx-plan" id="kidPlan" role="group"></div>
    <a href="https://claude.ai/artifact/EMVu67YYfT7DzW8UozZAj6" target="_blank" rel="noopener" data-kid="full"></a>
    <a href="https://claude.ai/artifact/YTRJvuYiFZpzyjxXD6vqQR" target="_blank" rel="noopener" data-kid="game"></a>
  </div>
  <div class="kid-toast" id="kidToast"></div>
  <div class="kid-bottom">
    <div class="kid-panel kid-route" id="kidRoute"></div>
    <div class="kid-panel kid-controls">
      <button type="button" class="kb red" id="kidStop"><span class="ico">🛑</span><span class="lab" data-kid="stop"></span></button>
      <div class="kid-lever" id="kidLeverBox"><input type="range" id="kidLever" min="0" max="8" step="1" value="0" aria-label="Manette"><div class="kid-lever-lab"><span>🐢</span><b data-kid="lever"></b><span>🚀</span></div></div>
      <button type="button" class="kb yellow" id="kidHorn"><span class="ico">📣</span><span class="lab" data-kid="horn"></span></button>
      <span class="elec-only"><button type="button" class="kb" id="kidPanto" aria-pressed="true"><span class="ico">⚡</span><span class="lab" data-kid="panto"></span></button></span>
      <button type="button" class="kb green" id="kidStation"><span class="ico" id="kidStationIco">🚉</span><span class="lab" id="kidStationLab"></span></button>
      <button type="button" class="kb" id="kidDir"><span class="ico">🔄</span><span class="lab" id="kidDirLab"></span></button>
      <span class="tgv-only"><button type="button" class="kb blue" id="kidDoors" aria-pressed="false"><span class="ico">🚪</span><span class="lab" data-kid="doors"></span></button></span>
      <button type="button" class="kb" id="kidWx"><span class="ico" id="kidWxIco">☀️</span><span class="lab" data-kid="wx"></span></button>
      <button type="button" class="kb" id="kidTod"><span class="ico" id="kidTodIco">☀️</span><span class="lab" id="kidTodLab">12:00</span></button>
      <button type="button" class="kb" id="kidXray" aria-pressed="false"><span class="ico">👀</span><span class="lab" data-kid="xray"></span></button>
    </div>
  </div>
  <div class="kid-side" id="kidSide">
    <div class="kid-panel kid-views" id="kidViews" role="group">
      <button type="button" class="kt" data-view="driver" aria-pressed="false"><span class="ico">🧑‍✈️</span><span class="lab" data-kid="v_driver"></span></button>
      <button type="button" class="kt" data-view="pax" aria-pressed="false"><span class="ico">💺</span><span class="lab" data-kid="v_pax"></span></button>
      <button type="button" class="kt" data-view="out" aria-pressed="true" aria-expanded="false" aria-controls="kidAngles"><span class="ico">📷</span><span class="lab" data-kid="v_out"></span></button>
    </div>
    <div class="kid-panel kid-angles" id="kidAngles" role="group" hidden>
      <button type="button" class="kt" data-cam="overview" aria-pressed="true"><span class="ico">🚄</span><span class="lab" data-kid="o_overview"></span></button>
      <button type="button" class="kt" data-cam="side" aria-pressed="false"><span class="ico">↔️</span><span class="lab" data-kid="o_side"></span></button>
      <button type="button" class="kt" data-cam="train" aria-pressed="false"><span class="ico">🛤️</span><span class="lab" data-kid="o_train"></span></button>
      <button type="button" class="kt" data-cam="far" aria-pressed="false"><span class="ico">🏞️</span><span class="lab" data-kid="o_far"></span></button>
      <span class="tgv-only"><button type="button" class="kt" data-cam="door" aria-pressed="false"><span class="ico">🚪</span><span class="lab" data-kid="o_door"></span></button></span>
    </div>
    <button type="button" id="kidNoGui" aria-pressed="false" aria-label="Masquer les commandes" data-i18n-aria="nogui" data-i18n-title="nogui_t"><svg class="ng-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg></button>
  </div>
</div>`);
$('kidRoute').appendChild($('routeBar'));   // the line with its station dots keeps its own click, drag and teleport handlers
$('kidSide').append($('cabUi'), $('compass'), $('kidNoGui'));   // under the views: the cab's 🎛️ (shown there only), the compass, the no GUI button
$('kidNoGui').addEventListener('click', () => setNoGui(true));
new ResizeObserver(() => document.body.style.setProperty('--kid-side', $('kidSide').offsetWidth + 'px')).observe($('kidSide'));   // the other panels keep clear of the column

/* ---- helpers */
function kidPower(full){ ensureBattery(); if (S.mode === 'diesel') ensureRunning(); else if (full) ensureLive(); }   // full: pantograph up and line closed at once (start, train change)
const kidAtEnd = () => S.dir > 0 ? S.dist >= ROUTE.L - 15.6 : S.dist <= 8 + tailLen() + 0.2;
let toastTimer = 0, kidToastHook = null;   // the hook: the TV remote's (03j), which shows each message on the iPad too
function kidToast(key, ms = 3500){
  const el = $('kidToast'); el.textContent = kt(key); el.classList.add('show');
  clearTimeout(toastTimer); if (ms) toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  kidToastHook?.(el.textContent, ms);
}
function kidLever(v){
  manual(); kidPower();
  S.notch = v; S.brake = v === 0 ? 4 : 0;
  if (v > 0){
    if (paxHolding()){ kidToast('hint_pax', 3000); PX.closeWhenDone = true; }   // terminus: the doors close by themselves once everyone is through
    else {
      if (S.doorsF > 0.02) kidToast('hint_doors', 3000);
      else if (S.mode !== 'diesel' && !S.panto) kidToast('hint_panto', 3000);
      else if (S.mode !== 'diesel' && !S.lineOn) kidToast('hint_wait', 3000);
      S.doors = false;
    }
    if (kidAtEnd()) kidToast('hint_end', 5000);
  }
  syncControls();
}
function kidStop(){ manual(); S.notch = 0; S.brake = 8; $('kidLever').value = 0; syncControls(); }
function kidPanto(){                                 // electric trains: pantograph up or down; down = no power, the line breaker closes again by itself once it is up
  if (S.mode === 'diesel') return;
  manual(); ensureBattery();
  S.panto = !S.panto;
  if (!S.panto){ S.notch = 0; $('kidLever').value = 0; }
  syncControls();
}
function kidTurn(){                                  // stopped train: face the other way (Paris <-> Toulouse)
  if (S.speed > 0.3){ kidToast('hint_stopped', 2500); return; }
  manual(); S.dir = -S.dir; S.notch = 0; S.brake = 4; $('kidLever').value = 0; syncControls();   // in the driver's place the frame loop moves the view to the other cab
  kidToast(S.dir > 0 ? 'dir_par' : 'dir_tls', 2500);
}
function kidStation(){   // a tap: on to the next station at the train's own pace, no jump (that is the line bar's job); on the whole line, it ends it
  if (S.service){ kidToast(S.autoStop ? 'service_last' : 'service_off', 3000); serviceOff(); return; }
  if (S.autoStop){ const to = cabTarget(); if (to) kidToast(`🚉 ${to.name}`, 2500); return; }   // already on its way: where to
  const st = nextStation() || nextStation(0);         // the last platform too close to stop at this speed: braked for all the same
  if (!st){ kidTurn(); return; }                     // terminus: turn around
  kidPower(true);
  if (paxHolding()) kidToast('hint_pax', 3000);      // terminus: the doors close by themselves once everyone is through
  goNextStation(st);
}
function kidService(){ kidPower(true); serviceOn(); kidToast('service_on', 3000); }   // held down: the whole line, again and again
function kidDoors(stay){   // stay: pressed from the cab desk, the view stays in the cab
  if (S.mode !== 'tgv') return;
  if (S.speed > 0.1){ kidToast('hint_stopped', 2500); return; }
  if (S.doors && paxHolding()){ kidToast('hint_pax', 3000); PX.closeWhenDone = true; return; }
  S.doors = !S.doors; syncControls();
  if (S.doors && !stay) kidGo('door');   // opening: land beside the first door to watch it
}
let kidOut = 'overview';   // the angle outside, kept for the way back out
const kidWhere = () => orbit.fp?.name === 'driver' ? 'driver' : orbit.fp?.name === 'walk' ? 'pax' : 'out';
function kidAngles(open){ $('kidAngles').hidden = !open; document.querySelector('#kidViews [data-view="out"]').setAttribute('aria-expanded', String(open)); }
function kidGo(cam){   // outside, from that angle (the door's on the TGV only)
  if (cam === 'door' && S.mode !== 'tgv') cam = 'overview';
  kidOut = cam; kidAngles(false); flyPreset(cam);
}
function kidView(v){   // one tap from anywhere: the driver's seat, the passenger's (seated upstairs in car 1, then on foot), or back outside; outside already, its angles
  const open = !$('kidAngles').hidden; kidAngles(false);
  if (v === 'out'){ if (kidWhere() === 'out') kidAngles(!open); else kidGo(kidOut); return; }
  if (v === 'pax' && S.mode !== 'tgv'){ kidToast('pax_tgv', 3000); return; }
  if (shellLevel < 1){ setShell(1); $('kidXray').setAttribute('aria-pressed', 'false'); }   // inside, the train whole: the X-ray button is out of sight there
  flyPreset(v === 'pax' ? 'walk' : 'driver');
}
function kidWx(){ const k = Object.keys(WX_ICO); setWeather(k[(k.indexOf(wxPick()) + 1) % k.length]); }   // sun, clouds, rain, the day's plan, sun again
wxHook = pick => { $('kidWxIco').textContent = WX_ICO[pick]; };
function kidTod(){ setTod(TOD[(TOD.indexOf(todPick()) + 1) % TOD.length]); updateWeather(0); kidTick(); }   // now, morning, noon, evening, night, now again
function kidXray(){ setShell(shellLevel >= 1 ? 0.18 : 1); $('kidXray').setAttribute('aria-pressed', String(shellLevel < 1)); }
function kidTrain(mode){
  const d = S.dist, dir = S.dir, where = kidWhere();
  setMode(mode);                 // resets the sim at Bordeaux and rebuilds the flows
  Object.assign(SIM_MUL, KID_MUL[mode]);
  S.dir = dir; jumpTo(d, true);  // back to where the child was, stopped, same way round
  kidPower(true); S.brake = 4; S.notch = 0; $('kidLever').value = 0; syncControls();
  $('kidTrains').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  if (where === 'driver') flyPreset('driver'); else kidGo(kidOut);   // the driver stays the driver, in the new train's seat
  kidLang();
}
function kidLang(){
  document.title = kt('title');
  document.querySelectorAll('[data-kid]').forEach(el => { el.textContent = kt(el.dataset.kid); });
  $('kidLang').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
  $('kidLever').setAttribute('aria-label', kt('lever')); $('clTrack').setAttribute('aria-label', kt('lever')); $('kidTod').setAttribute('aria-label', kt('tod'));
}
let kidTodT = '';   // the clock and the sky last shown on the time button
function kidTick(){
  $('kidSpeed').textContent = Math.round(S.speed * 3.6);
  const tod = todIcon() + hhmm(CLOCK.min); if (tod !== kidTodT){ kidTodT = tod; $('kidTodIco').textContent = todIcon(); $('kidTodLab').textContent = hhmm(CLOCK.min); }
  const st = nextStation(0), d = st ? (st.s - TGV.PLAT_FRONT - S.dist) * S.dir : 0;
  $('kidNext').textContent = st ? `🚉 ${st.name} · ${d < 950 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`}` : `🏁 ${kt('terminus')}`;
  const sb = $('kidStation'); sb.classList.toggle('auto', S.autoStop); sb.setAttribute('aria-pressed', String(S.service));
  $('kidStationIco').textContent = S.service ? '🔁' : '🚉'; $('kidStationLab').textContent = kt(S.service ? 'service' : S.autoStop ? 'auto' : st ? 'station' : 'turn');
  $('kidDirLab').textContent = kt(S.dir > 0 ? 'dir_par' : 'dir_tls');
  $('kidPanto').setAttribute('aria-pressed', String(S.panto));
  const lv = $('kidLever'); if (document.activeElement !== lv) lv.value = S.notch; $('kidLeverBox').classList.toggle('auto', S.autoStop);
  $('kidDoors').setAttribute('aria-pressed', String(S.doorsF > 0.5)); $('kidDoors').disabled = S.speed > 0.1 && S.doorsF < 0.02;
  $('kidHorn').classList.toggle('on', horn.active);
  const where = kidWhere(), tgv = S.mode === 'tgv';
  $('kidViews').querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === where)));
  const pax = $('kidViews').querySelector('[data-view="pax"]'); pax.classList.toggle('off', !tgv); pax.setAttribute('aria-disabled', String(!tgv));
  $('kidAngles').querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', String(where === 'out' && b.dataset.cam === kidOut)));
}

/* ---- wiring */
$('kidTrains').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.mode !== S.mode) kidTrain(b.dataset.mode); });
$('kidLever').addEventListener('input', e => kidLever(+e.target.value));
$('kidStop').addEventListener('click', kidStop);
holdable($('kidStation'), kidStation, kidService);   // held down: the whole line
$('kidPanto').addEventListener('click', kidPanto);
$('kidDir').addEventListener('click', kidTurn);
$('kidDoors').addEventListener('click', () => kidDoors());
$('kidViews').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) kidView(b.dataset.view); });
$('kidAngles').addEventListener('click', e => { const b = e.target.closest('[data-cam]'); if (b) kidGo(b.dataset.cam); });
$('kidWx').addEventListener('click', kidWx);
$('kidPlan').innerHTML = wxPlanHtml(); wxShow();
$('kidPlan').addEventListener('click', e => { const b = e.target.closest('button'); if (b) wxPlanCycle(+b.dataset.slot); });
$('kidTod').addEventListener('click', kidTod);
$('kidXray').addEventListener('click', kidXray);
{
  const hb = $('kidHorn');
  hb.addEventListener('pointerdown', e => { e.preventDefault(); horn.press(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) hb.addEventListener(ev, () => horn.release());
  hb.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); if (!e.repeat) horn.press(); } });
  hb.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') horn.release(); });
}
$('kidGear').addEventListener('click', () => { const m = $('kidMenu'); m.hidden = !m.hidden; $('kidGear').setAttribute('aria-expanded', String(!m.hidden)); });
$('kidLang').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.lang !== S.lang){ setLang(b.dataset.lang); kidLang(); } });
function kidMute(m){
  SND.setMuted(m);
  $('kidSound').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.m === +m)));
  try { localStorage.setItem('kid.mute', m ? '1' : '0'); } catch (e) {}
}
$('kidSound').addEventListener('click', e => { const b = e.target.closest('button'); if (b) kidMute(+b.dataset.m === 1); });
try { if (localStorage.getItem('kid.mute') === '1') kidMute(true); } catch (e) {}
document.addEventListener('pointerdown', e => {   // a tap elsewhere folds the menu and the angles
  if (!$('kidMenu').hidden && !e.target.closest('#kidMenu,#kidGear')){ $('kidMenu').hidden = true; $('kidGear').setAttribute('aria-expanded', 'false'); }
  if (!$('kidAngles').hidden && !e.target.closest('#kidAngles,[data-view="out"]')) kidAngles(false);
});

/* ---- hooks into the engine: both pantographs of the first TGV set follow the switch; the desk buttons in the cab work as the kid buttons; Esc from the cab or the walk goes back outside */
pantoHook = f => { if (S.mode !== 'tgv') return false; for (const p of tgvSets[0].pantos) posePanto(p, f); posePanto(panto, f); return true; };   // kid mode: the front pantograph rises too, so the ⚡ button shows on the car the child looks at
frameHook = () => { if (S.mode !== 'diesel' && S.battery && S.lineOn && S.panto && !S.vcb) S.vcb = true; };   // the child only handles the pantograph: the line breaker follows it
Object.assign(cabActions, { panto:kidPanto, doors:() => kidDoors(true), next:kidStation, service:kidService, dir:d => { if (d !== S.dir) kidTurn(); }, leave:() => kidGo(kidOut), lever:kidLever, leverTip:() => kidToast('lever_drag') });
cabLever.min = 0; cabLever.build();   // the cab's lever is the kid lever stood up: 🐢 at the bottom holds the brake, 🚀 at the top, no brake notches (🐢 stops the train, as the kid lever does)
document.querySelectorAll('.cl-end').forEach((el, i) => { el.textContent = i ? '🐢' : '🚀'; delete el.dataset.i18n; });
{ const b = document.querySelector('.cab-lever'); b.removeAttribute('title'); delete b.dataset.i18nTitle; delete $('clTrack').dataset.i18nAria; }

/* ---- start: a TGV at Bordeaux, powered up, body opaque, ready to go */
setMode('tgv'); Object.assign(SIM_MUL, KID_MUL.tgv); setShell(1); kidPower(true); S.brake = 4; syncControls();
kidGo('overview'); orbit.autoRotate = false;
kidLang(); kidTick(); setInterval(kidTick, 100);
kidToast('hint', 6000);
Object.assign(window.locoDebug, { kidLever, kidStop, kidStation, kidService, kidDoors, kidView, kidGo, kidWhere, kidWx, kidTod, kidXray, kidTrain, kidTick, kidPanto, kidTurn, kidMute });
