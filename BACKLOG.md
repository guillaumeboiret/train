# Backlog

Every request made for this project since 2026-09-26, with its date and where it stands.
Nothing leaves this file: a request is added the moment it is made, and a done item moves to the bottom with its commit.

## Open, in working order

### 1. Kid page, played on an iPad (asked 2026-10-02)
- [ ] Rename the page. /conducteur/ is French and names the driver, while this page is the game (travellers, the bar). New address /playground/, old links redirect.
- [ ] Switch driver ⇄ passenger in one tap, with a button that is always in the same place.
- [ ] Pick a view directly, no "next, next, next" cycling. The view button never moves.
- [ ] Drop the two seated views. The passenger view is the walk mode, starting seated.
- [ ] The passenger always starts seated on the upper deck of the first coach.
- [ ] Game controls when walking. iPad: left joystick moves, right joystick looks. Mac: WASD or arrows move, mouse or trackpad looks, like an FPS.
- [ ] Upper deck stairwell: a visible barrier along the open void beside the stairs.

### 2. World (asked 2026-10-02)
- [ ] A real clock to set the time of day.
- [ ] See the sun.
- [ ] Lights on the train at night and in tunnels.
- [ ] A weather system, set by hand or on a schedule.

### 3. Other open requests
- [ ] A "super hero futuriste" button that runs the whole line in 5 minutes (2026-10-02).
- [ ] Gangway doors (sas) between coaches that open as you walk past (2026-10-02).
- [ ] Random landscape so the country is not empty (2026-10-02).
- [ ] Better looking human 3D models, free ones from the internet (2026-10-02). CC0 or similar, self hosted.
- [ ] Passengers board through the bar car (follow-up approved 2026-10-02).
- [ ] Stations that look like the real ones (2026-09-28). Done: Paris Montparnasse, Massy TGV, Bordeaux Saint-Jean, Toulouse Matabiau. Still a generic building: Vendôme, Saint-Pierre-des-Corps, Châtellerault, Futuroscope, Poitiers, Angoulême, Libourne, Agen, Montauban.
- [ ] A train for the other direction standing across the platform at a station (2026-09-26). Today oncoming TGVs run through the stations and stop only at the termini.

## Known bugs, found while testing
- The Garonne is dry land: water is drawn only under bridges of 550 m or more.
- The Angoulême tunnel ends about 100 m early.
- The HUD's track count includes the far face of island platforms, one too many.

## Done

### 2026-10-02
- [x] Explainer page GUI, option A "clear the stage" ("Rethink the global GUI it's a mess"): 7d6ac65
- [x] Walk car to car as a passenger, sit in a free seat, buy at the bar: 2afa664, 4d162de, a878ce5, 4292e1e
- [x] Cab: Next stop replaces Stop, choose Toulouse or Paris from the driver's seat: 8182e9b
- [x] Cab: Next stop button on the deck too: 8182e9b
- [x] Cab: doors icon instead of the one that looked like pause: 8182e9b
- [x] Cab: double tap on the left or right edge moves the train 1 km back or on: 8182e9b
- [x] See through the door windows from inside, no black square: 091ef0e
- [x] Repo protected, licence that requires credit: f48be31

### 2026-09-29
- [x] Show or hide the controls in the cab, fading while the train runs untouched: 39fbe8e
- [x] The sound of a real TGV, and the SNCF chime: d87e13d
- [x] The station's name on every sign: 7448b1e
- [x] Angoulême: the hole behind the tunnel mouth: db02679
- [x] Window glass corners: 781dd97
- [x] Control speed and position on the line from the cab: 1489f11
- [x] Glitch when stopping from 1 to 0 km/h: 25cade9
- [x] Bar coach, walk like a human from car to car, people that look like people: 2abb413, 2afa664, 4d162de (nicer models still open, above)
- [x] Odd mark between two cars: 374f7f1
- [x] Fewer birds: 25cade9
- [x] Sound when the doors open: e48e503
- [x] A train vanished in front of the cab: 77cfb23
- [x] Paris: one platform per track: 9393408

### 2026-09-28
- [x] Project moved to ~/Projects/boiret.com and renamed train, here and on GitHub: 2bbd05d
- [x] Railway deploys every push to main: 9c06f5e, 772b82a
- [x] Every page in French and English: 96c685e, f93ff26
- [x] All the stops between Bordeaux and Paris: 991ecbd
- [x] Clicking the line near Paris lands where you click: 0bef48f
- [x] Massy like the real one: 175dcbe
- [x] Wind turbines where the real wind farms are, landmarks seen from the line: bb26625, ca26eaf
- [x] Real coach windows; round TGV noses unless coupled: 62ae503, 6442360
- [x] Seated passengers seen properly from inside: 62ae503
- [x] Saint-Jean's real track count: 4ba2688
- [x] Flicker in Bordeaux: a146a95
- [x] Heat shown as warm haze: 73a8dd0
- [x] Half the passengers: d4a2573
- [x] Line extended to Toulouse: 2c31ced
- [x] Doors aligned with their openings: 62ae503 (cut-out openings)
- [x] Compass in the screen corner: 9d5896b
- [x] A view beside the first door when the doors open: 57951a2
- [x] Driver's seat: no driver in view, live screens and 3D desk buttons: 5016946
- [x] TGV inOui livery, no windows on the power cars: 98712f2
- [x] Window seats on both decks, look around from the seat: acf5bf6 (being replaced by the walk mode, open item 1)
- [x] Seated, the eye is fixed to the car and the landscape does the moving: acf5bf6
- [x] Windows sealed into the wall, cab windshield edges no longer cut oddly: 00d7bfd
- [x] Softer sound that comes from where the engine is: 9b473dd
- [x] Seats facing both ways in every saloon: c2705da
- [x] Hide the page's controls in the driver's seat: f3c382e
- [x] Oncoming trains honk hello: 9b473dd

### 2026-09-27
- [x] Kid page with simple controls: 482d499
- [x] Run both ways, Paris to Bordeaux and back: 482d499
- [x] Tunnels and disappearing rails near Paris in the cab: 482d499, db02679
- [x] Pantograph that rises and touches the wire: 8c62b10
- [x] The camera stays above the ground: 482d499
- [x] Odd artifact at the back of the view, earth inside a tunnel: 482d499 (terrain and tunnel rewrite)
- [x] Real underground station at Massy: 175dcbe
- [x] TGV motor sound with ambience, birds, oncoming TGVs honking: d87e13d, 9b473dd
- [x] Public GitHub repo on the personal account: 482d499
- [x] X-ray on the coaches, many passengers, nobody outside the train: 8c62b10, 305531c
- [x] Driver's cab: 305531c
- [x] Passengers walking in and out, everyone leaving at the terminus and the train filling again: 305531c
- [x] train.boiret.com on Railway: 658b40e

### 2026-09-26, before the repo (all in 482d499)
- [x] 3D explainer of how a train's motors work: cut planes, parts, engine start and stop, energy flows
- [x] Switch game: several trains, click the switches to get from A to B, move and stop, 10 levels from easy to hard, a tutorial
- [x] Landscape and wagons around the cutaway
- [x] Longer field of view
- [x] Hide the info card (× folds it to a small pill)
- [x] TGV mode: a real SNCF double TGV, 2 or 4 power cars, coupling, stations long enough
- [x] Doors that open and close, passengers in and out, TGV only (more in 305531c)
- [x] W, A, S, D move the camera along the train
- [x] Real traction: notch 8 is full power
- [x] Gentle curves and gradients
- [x] The real Bordeaux to Paris line from real data, its tracks, oncoming trains, choose your track
- [x] Doors, catenary, pantograph and horn
- [x] Teleport anywhere on the line, the train keeps running
- [x] Time ×16
- [x] Power cars built like the first, with the electricity visible
- [x] Weather that changes (a full weather system is open, item 2)
- [x] Bordeaux and Paris in detail on arrival (more in 4ba2688, 9393408)
- [x] Full speed in manual, no speed limits
- [x] Zoom all the way into the train
