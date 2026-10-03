# Backlog

Every request made for this project since 2026-09-26, with its date and where it stands.
Nothing leaves this file: a request is added the moment it is made, and a done item moves to the bottom with its commit.

## Open, in working order

### 0. Now (asked 2026-10-03)
- [ ] Code every open item of this file, each one challenged first since some are old ("code all the features in your todo, challenge them before coding some are a bit old", 2026-10-03). Covers the move to EU West below, which was waiting for a yes.
- [ ] The remote's delay: 157 to 159 ms from the iPad to the TV on the live site (measured 2026-10-03), because the app runs in us-west2 (California) behind Railway's Paris edge (cdg1, about 200 ms to the first byte). Moving its one replica to EU West (Amsterdam) should bring it near 20 ms. Yes given with "code all the features in your todo" (2026-10-03). Tried in cb85925 with multiRegionConfig in railway.json: Railway ignores that file's deploy settings for this service, so it stayed in California (reverted). The move is a service setting, `railway service scale eu-west=1 us-west=0`, which the permission check stopped as a production change: waiting for you to run it or allow it.
- [ ] The glass turns into very bright panels seen from a distance, too strong and from too close: take that out. Seen at night: past 60 m from the camera a coach's windows become solid panels lit at full strength ("the glass transform into very bright panel at distance its too much and too close if you can remove it it's better", 2026-10-03).
- [ ] The windows are too dark: half as tinted in the dark ("the glass is too dark make it twice less tinted in dark", 2026-10-03).
- [ ] A 3D button in the cockpit to switch the lights on and off ("Add a button to open and close the lights even in the cockpit, a 3D button", 2026-10-03).
- [ ] Many automatic horns with no train passing the other way ("Il y a beaucoup de clackson automatiques alors qu'aucun trains ne passent en face", 2026-10-03).

### 1. World (asked 2026-10-02)
Nothing open: the clock, the sun, the lights and the weather schedule are under Done.

### 2. The passenger's iPhone (asked 2026-10-02)
- [ ] Take out an iPhone and look at it ("I want to be able to look at my iPhone").
- [ ] Games on it: Tetris, Snake and 2048.

### 3. Cinematic camera, for long trips (asked 2026-10-02)
Nothing open: the film, outside only, is under Done.

### 4. Step off the train at a station (asked 2026-10-02)
- [ ] The passenger can get off onto the platform and walk there, and the train never leaves without them: no departure until they are back aboard ("I want the user to be able to go outside of the train but the train can't go back without the user inside").

### 5. Other open requests
- [ ] A "super hero futuriste" button that runs the whole line in 5 minutes (2026-10-02).
- [ ] Gangway doors (sas) between coaches that open as you walk past (2026-10-02).
- [ ] Random landscape so the country is not empty (2026-10-02).
- [ ] Better looking human 3D models, free ones from the internet (2026-10-02). CC0 or similar, self hosted.
- [ ] Stations that look like the real ones (2026-09-28). Done: Paris Montparnasse, Massy TGV, Bordeaux Saint-Jean, Toulouse Matabiau. Still a generic building: Vendôme, Saint-Pierre-des-Corps, Châtellerault, Futuroscope, Poitiers, Angoulême, Libourne, Agen, Montauban.
- [ ] A train for the other direction standing across the platform at a station (2026-09-26). Today oncoming TGVs run through the stations and stop only at the termini.

## Known bugs, found while testing
- In the 🎬 film the shot riding along the train's side can sink behind a dark wall beside the line, which then fills half the view (found 2026-10-03, 2.2 km before Poitiers).
- Railway reads none of railway.json's deploy settings for this service: the /version.txt healthcheck of 964d84b never ran, so a deploy switches without waiting for it. Config as code (railway.json) is deprecated and stops being read on 2026-12-01; Railway now wants .railway/railway.ts, applied with its CLI.
- The Garonne is dry land: water is drawn only under bridges of 550 m or more.
- Under Massy's slab (510 to 68 m before the station) and Montparnasse's garden (the last 366 m), the far, overview and train angles show the slab, not the train; only the side angle sees it (found 2026-10-03). In a tunnel the camera goes into the tube; under a slab it stays above.
- The outside camera cuts in one frame into the tunnel's shape 40 m before a mouth, and out of it 40 m after, so at speed it jumps 12 to 24 degrees (found 2026-10-03 leaving the tunnel 1252 m before Poitiers, side angle).
- The cab's line screen shows the wall clock, not the time of day picked for the world (loco/03h-ui.js:767; found 2026-10-03).
- After the TV's page reloads, its sound waits for one click on the TV: browsers play no sound before a gesture on the page. The iPad shows a hint when that happens.

## Done

### 2026-10-03
- [x] On the curves the coaches come apart at their joints ("Il y a un bug dans les tournants, les wagons se discocient sur les jonctions", 2026-10-03). Each car now lies between its joints, placed at their real distance along its own track: the worst gap went from 4.8 m (Montauban) and 1.1 m (lane 1 at Poitiers) to 0.04 m (0.06 m for the diesel's wagons, 0.03 m in the double set): 2d9a3fc
- [x] With the remote, the TV in the cinematic camera while the iPad shows the driver's view, and drives the train when wanted ("When remote I would like to have the driver view if I want to have the train en cinema mode and a control of the driver if I want", 2026-10-03). The 3D cab stays on the iPad whatever the TV shows, so with the TV on 🎬 the iPad drives the filmed train; on a tablet only, a phone keeps the flat buttons: eb156d4
- [x] The iPad remote as the cab itself: in the cab it shows the 3D driver's desk and drives the train on the TV from there; as a passenger it is a game pad and the passenger walks on the train; one switch goes from one to the other ("The iPad version should be way more dynamic since you're controlling the train. I would like to have the 3D version of the cockpit. On your iPad you have the cockpit and when you are in the cockpit you have the controller of the person. When you are a person you can switch to another. You have all the controls but here it's more like a pad.", 2026-10-03). The aim: in the cab the player feels they drive the train from the iPad; as a passenger, that they walk on the train. On a tablet, in the cab, the remote shows the playground's own 3D desk in a frame, following the TV's train; its lever, buttons and line screen drive the TV; as a passenger the pad (916e690); menu switch "3D cab on the tablet", on by default: eb156d4
- [x] Railway failed the deploy of 47c1d8d before its build started (deployment 4762d73c, no build log, found 2026-10-03), so the site kept 589f855. The next push deployed in 20 s and the live playground is byte for byte the local build: 4d78511
- [x] At the bar, the menu hides the tray while ordering ("When ordering, the menu hides the "plateau"", 2026-10-03). The look turns just enough for the menu to leave the tray in view, the barista still in sight; a phone in landscape keeps about 22 px of overlap: e54878e
- [x] The bar coach as the real one: the upper deck only, no stairs down, no doors ("The food coach does not allow going downstairs. There are no stairs. It's just the top floor And there are no doors. Check on the internet", 2026-10-03). Checked first, true: the Duplex bar trailer has one passenger level, the upper one, and equipment below (trains-europe.fr, Wikipedia FR, cheminots.net). Car 4 of each set now has a floor from gangway to gangway, no stair, no doors and only the upper windows. Not confirmed from a photo: whether its lower side has windows; it is drawn blank: 71771d4
- [x] Passengers board through the bar car (follow-up approved 2026-10-02). Dropped 2026-10-03 by the bar coach item: the real bar car has no passenger doors, so nobody boards there: 71771d4
- [x] The remote off by default, turned on from the menu ("bu default the remote shoult not be active we shoult activate in the menu", 2026-10-03). The TV starts with it off at every load, a reload or a restored tab included; ⚙️ then 📱 turns it on under the same 4 letters, and a phone left on /remote/ joins by itself: 916e690
- [x] Control the passenger from the remote ("in the remote i want to be able to controle the human", then "move using the iphone as a controller", 2026-10-03). In the TGV the phone turns into a game controller: the left stick walks, the right one looks, the big button sits, stands or orders at the counter; at the bar it shows the menu, purse, pocket money and tray. A phone quiet for 0.7 s lets go of the passenger: 916e690
- [x] The remote on an iPhone in portrait ("make the view displaying properly on iphone", 2026-10-03, with a screenshot). Upright from 375 to 393 px wide and sideways: every control 44 px or more, none on another, labels clear of their icons, no page scroll: 916e690
- [x] No inside views in the 🎬 film, only shots from outside ("in the cinematic mode forget the inside views", 2026-10-03). Changes the 2026-10-03 ask to "switch from the outside to the inside": the driver's seat, window seat and aisle shots are gone; in a tunnel or under a slab, a shot low ahead of the nose takes their place: effc035
- [x] Known bug fixed: 🎬 tapped from an outside view stopped the film on the very next frame whenever its first shot glided in from there, 22 of 40 taps (found 2026-10-03 on the live site). 40 of 40 start now: effc035
- [x] A camera that films the trip by itself, for long trips ("movie-like movements that can switch from the outside to the inside and make elegant movements", 2026-10-03; first asked 2026-10-02 for streaming, then "I don't need you to stream it's just the camera movement for long term travels"). 🎬 in the playground's views and on the remote: a director cuts every 9 to 16 s between shots riding with the train, from the ground and inside (outside only since effc035), gliding into each other or cutting through black, and films the platform and the doors at each stop. A drag, a pinch, the wheel, a key or Esc hands the camera over where it is; 🎬 again cuts to the next shot: d283102
- [x] The wallpaper for the whole line ("we could have a wallpaper for the whole line in a very nice way", 2026-10-02): the endless Next stop (607ef93) with 🎬 on, the camera turns, goes inside the train, comes back out and follows it (outside only since effc035): d283102
- [x] Known bug fixed: in the kid game ← → ran the explainer guide's steps, and a step could move the train (km 60 to 257.9, which ended the whole line) (found 2026-10-03). They do nothing there now; the explainer keeps them: d283102
- [x] Known bugs fixed: in a city the outside camera could stand inside a building, lose the train behind buildings in the middle distance, or stand inside a tree crown (found 2026-10-03). A building or house on the line of sight now lifts the camera over its roof, rising a second before it gets there; a tree in the way is hidden. The train out of sight in 51 of 1612 kid views around the 13 stations, was 204; all 51 are under the Massy and Montparnasse slabs, still open below: 87d7495
- [x] Known bug fixed: the HUD's track count was off where tracks fade in or out (Agen showed 5 for 3 laid). Logged as the island's far face counted once too many; that face is laid, so it stays counted. It now counts the tracks laid, as the chunks lay them, checked at all 13 stations: 5c7a14d
- [x] Known bug fixed: the Angoulême tunnel ended about 100 m early. Its mouth is now 665 m before the station, the data's is 656 m; it was cut at 755 m by the station's zone: 27d2a63
- [x] Known bug fixed: in a tunnel the outside camera stayed above the hill, so the train was out of sight (found 2026-10-03). While the train is in a tunnel or 40 m from one, the camera keeps to the tube's shape, in the tube and in front of its mouths: ce23fba
- [x] Known bug fixed: on a phone held sideways the remote's buttons were 38 px tall and its camera buttons smaller still, under the 44 px a finger needs (found 2026-10-03). Now 54 px, the cameras 44 px in one row: d38480d
- [x] A weather system, set by hand or on a schedule ("I would like to have a weather system too and I want to be able to schedule that or to change that if I want to", 2026-10-02). Sun, Clouds, Rain or Auto. Auto follows a plan for the day, one weather every 3 hours, blending into each; a tap on a box changes it. On the explainer, the playground's menu and the remote's menu, which now scrolls on a phone held sideways: 852e08a
- [x] Lights on the train when it's dark or in tunnels ("I will need you to add lights on the train when it's dark or in the tunnels", 2026-10-02). At night and deep in a tunnel the lamps glow, the leading ones throw a beam 40 m down the line, the coaches' windows glow warm and a saloon light keeps seats and people lit inside. In a tunnel the daylight fades out over the first 40 m and the far end goes black. The lamps follow the battery: 409297e
- [x] A real clock to set the time of day ("create a clock, a real clock, to send to people to change the time of the day", 2026-10-02). The sky follows the real time in France by default. The explainer's Time of day slider and Now, the playground's time button (now, morning, noon, evening, night) and the same button on the iPad set it, and show the clock. Dusk left the weathers: it is now the time button's evening: 67236ac, 12fa1ca
- [x] See the sun ("I would like to see the sun", 2026-10-02). The sun stands where it really is over the train, from its place on the line and the date; the sky's colours follow its height; at night the moon and 1600 stars: 67236ac
- [x] Heat as a transparent shimmer instead of the orange smoke ("Can you change the orange smoke to something that makes the feeling of heat but it's transparent? It just makes waves"). The air over a hot radiator, brake grid or TGV cooling block now bends and blurs what is behind it, in ripples that climb, with no colour of its own; the legend shows heat as a wavy line. Changes the warm haze of 73a8dd0: 9c57b7c
- [x] In no GUI, everything in 3D stays clickable: the cockpit's buttons, the passenger's 3D things, and the power lever ("In no-GUI I should be able to click on the buttons still in the cockpit as well as in the traveler. The 3D buttons, the 3D elements, and Power should be actionable even in No-GUI", 2026-10-03). cc6848b did the desk. Now in both pages the walker's seats, counter and stools answer a tap too, with their words, and the speed screen's BRAKE/POWER bar drags the lever, GUI or not, a knob showing where it stands: 092b652
- [x] Known bug fixed: the driver's 3D lever sits below the default view ("look down to grab it"). Its job is now in view: the speed screen's BRAKE/POWER bar drags it, so the lever stays put and the line screen stays clear: 092b652
- [x] The TV and the iPad ("connect my iPad to this current session so I have the driver's controls on a new web page that I will display on the iPad"). On the TV, the playground's ⚙️ then 📱 shows a 4 letter code and a QR code; the iPad scans it, or opens train.boiret.com/remote/ and types the code. The TV hides its GUI and the iPad drives: lever, stop, horn, next station, direction, pantograph, doors, weather, X-ray, the views and camera angles, the train, the line. Live both ways, up to 8 iPads per TV. Tested headless on the live site, not yet on the real iPad and TV: 964d84b
- [x] The driver's 3D lever works: drag it up for power, down to brake ("Make the lever work because right now, I don't have a GUI, and it doesn't work"). A tap on it says how: cc6848b
- [x] The station timeline on the driver's desk screen can be tapped, like the line bar ("When I click on the next station in the timeline to work, I should also be able to click on it"): cc6848b
- [x] In no GUI the driver's desk keeps working: its buttons, the lever and the screen's timeline. Changes the no GUI of 319e082, where a tap pressed nothing: cc6848b
- [x] The camera never goes under the ground or under the rails ("Make sure the camera can go under the soil, under the rails, and it's useless": "can" heard, "can't" meant). In a tunnel it stays inside the tube. The Underside preset now looks from the rails' height: 7c11f0f
- [x] A no GUI button: hides every control so only the trip is on screen ("add a no-GUI mode Button that hides the GUI to only see the the travel"). In the explainer's topbar and under the playground's compass, or G. The corner button, Esc or G bring the controls back: 319e082

### 2026-10-02
- [x] Next stop, long press: the button stays pressed and the train serves the line by itself, again and again: to the next station, stop, doors open, people get off and on, doors close, on to the next; at either end it turns back ("if I long-press on it, it stays clicked and the train goes to the next station, stops, opens the doors, waits for the people to leave and go in, closes the doors, and goes to the next one"). A tap ends it: 607ef93
- [x] Next stop drives to the next station at the train's own pace, no jump closer first: from Massy, on to Vendôme or Paris depending on the direction. Jumping stays the line bar's job ("Next stop should just plan to go to the next stop, not move closer to the next stop"). Changes the Next stop of 8182e9b: 607ef93
- [x] Bar menu: names fit their buttons, "Chocolatine" and "Madeleines" included ("The labels are "dépassent""): 47bdb03
- [x] Bar menu: a madeleine icon that looks like one, not a seashell ("le logo de la madelaine ne va pas du tout"): 47bdb03
- [x] Bar: "Chocolatine" from Toulouse to where the line leaves Charente (km 445.2, Londigny), "Pain au chocolat" north of it, the open menu following: b01c789
- [x] Bar: madeleines on the menu, 2.50€. 15 items still fit on the Mac and the iPad, nothing removed: b01c789
- [x] Back to Passenger after the driver's seat or outside: where the passenger was, looking the same way, seated or not ("I should stay where I was before"). The coach 1 seat stays the very first start: ad8466a
- [x] Passenger mode on the Mac: the mouse stays free for the buttons. Drag or swipe two fingers to look, Esc leaves ("I can't get my mouse back to click on buttons"): ad8466a
- [x] Kid page renamed /playground/ (Jouer au train, Train playground), /conducteur/ redirects: 1c84e3f
- [x] Kid page: driver ⇄ passenger in one tap, from a views column that never moves (top right): 1c84e3f
- [x] Kid page: pick a view directly, no more "next, next, next"; a second tap on Outside opens its angles: 1c84e3f
- [x] The two seated views dropped, on both pages; Passenger is the walk mode, starting seated: 1c84e3f
- [x] The passenger always starts seated on the upper deck of the first coach, facing the way the train runs: 1c84e3f
- [x] Game controls when walking. iPad: left stick walks, right stick looks. Mac: WASD or arrows walk, a click hands the mouse or trackpad to the look (Esc frees it), E sits: 1c84e3f
- [x] Upper deck stairwell: a rail along the open void beside the stairs: 1c84e3f
- [x] Found while testing: the landing page said 538 km, the line is 829.5 km: 298a163
- [x] Explainer page GUI, option A "clear the stage" ("Rethink the global GUI it's a mess"): 7d6ac65
- [x] Walk car to car as a passenger, sit in a free seat, buy at the bar: 2afa664, 4d162de, a878ce5, 4292e1e
- [x] Cab: Next stop replaces Stop, choose Toulouse or Paris from the driver's seat: 8182e9b (its jump closer first dropped on 2026-10-02: 607ef93)
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
- [x] Window seats on both decks, look around from the seat: acf5bf6 (replaced on 2026-10-02 by the passenger's walk, which starts seated: 1c84e3f)
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
- [x] Weather that changes (a full weather system is open, item 1)
- [x] Bordeaux and Paris in detail on arrival (more in 4ba2688, 9393408)
- [x] Full speed in manual, no speed limits
- [x] Zoom all the way into the train
