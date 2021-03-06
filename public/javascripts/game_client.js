// This file manages the games client's logic. It's here that Socket.io connections are handled
// and functions from canvas.js are used to manage the game's visual appearance.

////////// Game states \\\\\\\\\\\\
INIT = "init";
MAIN_MENU = "main menu";
TABLE_LOBBY = "table lobby";
TABLE_GAME = "table game";
TABLE_ROUND = "table round";
TABLE_COUNT = "table count";

// Debug settings
DEBUG = false;
var logFull = true;

// Config settings received from server.
var newTableSettings = {
	tokenGoal: 5,
	startPot: 1,
	crazy: false,
	straights: false,
	qakaj: true,
	five_of_a_kind: true,
	advanceSec: 3,
}
var importLedger = [];

// Game settings
var soundEnabled = false;

// Game state
var socket = io();
var labels = [];
var buttons = [];
var drawGroups = [];
var buttonGroups = [];
var sounds = [];

var gameState, theTable, thePlayer;
var hands = [];
var holders = [];

//////////  Socket Events  \\\\\\\\\\

// Main update function, table contains most of the important information.
socket.on("update table", function(table) {
	updateTable(table);
});

// Update the hand for a specific player.
// Hands are updated separately from table to make showing only certain players hands easy.
socket.on("update hand", function(name, hand, clear) {
	if (clear) { hands = []; }
	hands[name] = hand;
});

// Triggers countdown sound, to keep it sync with the server.
socket.on("play countdown", function() {
	sounds["count"].play();
});

// Emit an error to the player from the server.
socket.on("server error", function(msg) {
	raiseError(msg);
});

// Server calls on connection to provide settings from server.
socket.on("init settings", function(settings) {
	labels["version"].text = `v${settings.code_version}`;
	DEBUG = settings.DEBUG;
	if (DEBUG) {
		newTableSettings.tokenGoal = 2;
		newTableSettings.advanceSec = 1;
	}
	handleResize();
});

socket.on("disconnect", function() {
	handleServerDisconnect();
});

//////////  Functions  \\\\\\\\\\

///// Game state \\\\\

function initLabels() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// Main menu
	labels["title_3"] = new ImageLabel({x: 0.35, y: 0.15}, false, 0.3, `/images/cards/3S.png`);
	labels["title_5"] = new ImageLabel({x: 0.5, y: 0.15}, false, 0.3, `/images/cards/5S.png`);
	labels["title_7"] = new ImageLabel({x: 0.65, y: 0.15}, false, 0.3, `/images/cards/7S.png`);
	buttons["make table"] = new Button({x: 0.5, y: 0.6}, "Make Table", 80, makeTable);
	buttons["join table"] = new Button({x: 0.5, y: 0.85}, " Join Table ", 80, joinTable);
	labels["import ledger"] = new Label({x: 0.44, y: 0.925}, "Import Ledger", 15, "right");
	buttons["clear ledger"] = new Button({x: 0.42, y: 0.925}, "Clear Ledger", 15, clearLedger);
	buttons["download ledger main"] = new Button({x: 0.56, y: 0.925}, "Download Ledger", 15, downloadLedgerFile);
	drawGroups["main menu"] = new DrawGroup([
		labels["title_3"],
		labels["title_5"], 
		labels["title_7"],
		buttons["make table"],
		buttons["join table"],
		labels["import ledger"],
		buttons["clear ledger"],
		buttons["download ledger main"],
	]);

	// Table

	// Game settings (left box)
	labels["pot"] = new Label({x: 0.06, y: 0.41}, "Pot: ", 30, "left");
	buttons["pot <"] = new Button({x: 0.16, y: 0.4}, "-", 20, changePot.bind(null, false), false, true, "center", false);
	labels["pot value"] = new Label({x: 0.23, y: 0.41}, "", 30, "right");
	buttons["pot >"] = new Button({x: 0.24, y: 0.4}, "+", 20, changePot.bind(null, true), false, true, "center", false);
	labels["token goal"] = new Label({x: 0.06, y: 0.46}, "Token Goal: ", 15, "left");
	buttons["token goal <"] = new Button({x: 0.20, y: 0.46}, "-", 15, changeTokens.bind(null, false), false, true, "center", false);
	labels["token goal num"] = new Label({x: 0.22, y: 0.46}, "", 15);
	buttons["token goal >"] = new Button({x: 0.24, y: 0.46}, "+", 15, changeTokens.bind(null, true), false, true, "center", false);
	labels["crazy"] = new Label({x: 0.06, y: 0.50}, "Crazy: ", 15, "left");
	buttons["crazy box"] = new Checkbox({x: 0.22, y: 0.49}, 0.015, updateSettings);
	labels["straights"] = new Label({x: 0.06, y: 0.54}, "Straights: ", 15, "left");
	buttons["straights box"] = new Checkbox({x: 0.22, y: 0.53}, 0.015, updateSettings);
	labels["5ofk"]  = new Label({x: 0.06, y: 0.58}, "5-of-a-Kind: ", 15, "left");
	buttons["5ofk box"] = new Checkbox({x: 0.22, y: 0.57}, 0.015, updateSettings);
	labels["QAKAJ"] = new Label({x: 0.06, y: 0.62}, "QAKAJ: ", 15, "left");
	buttons["QAKAJ box"] = new Checkbox({x: 0.22, y: 0.61}, 0.015, updateSettings);
	drawGroups["settings"] = new DrawGroup([
		labels["pot"],
		buttons["pot <"],
		labels["pot value"],
		buttons["pot >"],
		labels["token goal"],
		buttons["token goal <"],
		labels["token goal num"],
		buttons["token goal >"],
		labels["crazy"], 
		buttons["crazy box"],
		labels["straights"],
		buttons["straights box"],
		labels["5ofk"], 
		buttons["5ofk box"],
		labels["QAKAJ"],
		buttons["QAKAJ box"]
	]);
	buttonGroups["settings"] = new ButtonGroup([
		buttons["pot <"],
		buttons["pot >"],
		buttons["token goal <"],
		buttons["token goal >"],
		buttons["crazy box"],
		buttons["straights box"],
		buttons["5ofk box"],
		buttons["QAKAJ box"]
	]);

	// Message box (center)
	labels["message"] = new Label({x: 0.5, y: 0.4}, "", 30);
	buttons["leave table"] = new Button({x: 0.5, y: 0.6}, "Leave", 30, leaveTable);
	labels["hand message"] = new Label({x: 0.74, y: 0.64}, "", 20, "right");
	drawGroups["messages"] = new DrawGroup([
		labels["message"],
		buttons["leave table"],
		labels["hand message"]
	]);

	// Ledger
	labels["ledger"] = new Label({x: 0.85, y: 0.4}, "Ledger", 30);
	buttons["download ledger"] = new Button({x: 0.92, y: 0.395}, "⇩", 20, downloadLedgerFile, false, false, false, true, 15);
	drawGroups["ledger"] = new DrawGroup([
		labels["ledger"],
		buttons["download ledger"],
	]);
		
	// Player pad
	buttons["hold"] = new Button({x: 0.13, y: 0.8}, "Hold", 30, doHold, doClearMove);
	buttons["drop"] = new Button({x: 0.27, y: 0.8}, "Drop", 30, doDrop, doClearMove);
	buttons["deal"] = new Button({x: 0.2, y: 0.8}, "Deal", 30, doDeal);
	labels["auto"] = new Label({x: 0.06, y: 0.87}, "Auto Drop/Deal:", 15, "left");
	buttons["auto box"] = new Checkbox({x: 0.18, y: 0.86}, 0.015);
	drawGroups["player pad"] = new DrawGroup([
		buttons["hold"],
		buttons["drop"],
		buttons["deal"], 
		labels["auto"],
		buttons["auto box"]
	]);

	// Game settings (bottom bar)
	labels["table"] = new Label({x: 0.01, y: 0.99}, "", 15, "left");
	labels["error msg"] = new Label({x: 0.5, y: 0.98}, "", 20);
	buttons["sound"] = new ImageButton({x: 0.91, y: 0.97}, 0.02, 0.025, "/images/sound_off.png", disableSound, "/images/sound_on.png", enableSound);
	labels["version"] = new Label({x: 0.99, y: 0.99}, "", 15, "right", "monospace");
	drawGroups["bottom bar"] = new DrawGroup([
		labels["table"],
		labels["error msg"],
		buttons["sound"],
		labels["version"],
	]);

	// Sounds
	sounds["count"] = new sound("/sounds/racestart.wav");
}

function clearLedger() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	importLedger = [];
}

START_POTS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5];
function changePot(up) {
	theTable.settings.startPot = START_POTS[Math.max(0, Math.min(START_POTS.length - 1, START_POTS.indexOf(theTable.settings.startPot) + (up ? 1 : -1)))];
	updateSettings();
}

function changeTokens(up) {
	theTable.settings.tokenGoal = Math.max(1, theTable.settings.tokenGoal + (up ? 1 : -1));
	updateSettings();
}

function updateSettings() {
	theTable.settings.crazy = buttons["crazy box"].clicked;
	theTable.settings.straights = buttons["straights box"].clicked;
	theTable.settings.five_of_a_kind = buttons["5ofk box"].clicked;
	theTable.settings.qakaj = buttons["QAKAJ box"].clicked;
	socket.emit("update settings", theTable.settings);
}

function changeState(state) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (state === gameState) {
		return;
	}
	for (var button of Object.values(buttons)) {
		button.disable();
	}
	toggleInputs(false);

	buttons["sound"].enable();
	if (state !== MAIN_MENU) {
		buttons["auto box"].enable();
		buttons["download ledger"].enable();
	}

	switch(state) {
		case MAIN_MENU:
			buttons["make table"].enable();
			buttons["join table"].enable();
			toggleInputs(true);
			break;
		case TABLE_LOBBY:
			buttons["leave table"].enable();
			break;
		case TABLE_GAME:
			if (!thePlayer.moved) {
				buttons["deal"].enable();
				if (buttons["auto box"].clicked) {
					buttons["deal"].toggle();
				}
			}
			break;
		case TABLE_ROUND:
			buttons["hold"].enable();
			buttons["drop"].enable();
			if (buttons["auto box"].clicked) {
				buttons["drop"].click();
			}
			break;
		case TABLE_COUNT:
			buttons["hold"].enable(true);
			buttons["drop"].enable(true);
			buttons["hold"].disableUndo();
			buttons["drop"].disableUndo();
			break;
	}
	gameState = state;
}

function toggleInputs(on) {
	var d = on ? "block" : "none";
	for (var e of ELEM_CONFIGS) {
		document.getElementById(e.name).style.display = d;
	}
	document.getElementById("ledger-file").value = null;
}

function enableSound() {
	soundEnabled = true;
}

function disableSound() {
	for (var sound of sounds) {
		sound.stop();
	}
	soundEnabled = false;
}

///// Game logic \\\\\

{
function isTableOwner() {
	return theTable && theTable.players.length > 0 && theTable.players[0].socketId === socket.id;
}

function doDeal() {
	doMove(true);
}

function doHold() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// TODO: implement exclusive button set?
	buttons["drop"].clicked = false;
	buttons["auto box"].clicked = false;
	doMove(true, true);
}

function doDrop() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	buttons["hold"].clicked = false;
	doMove(true, false);
}

function doClearMove() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	doMove(false);
}

function doMove(moved, held) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	socket.emit("do move", moved, held);
}

}

///// Client-server functions \\\\\

{
function makeTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var name = getPlayerNameInput()
	// TODO: make settings and send them here.
	if (name) {
		socket.emit("make table", name, newTableSettings, importLedger);
	} else {
		raiseError("Must provide name to make table!");
	}
}

function joinTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var name = getPlayerNameInput();
	var code = getGameCodeInput();
	if (name && code) {
		socket.emit("join table", code, name);
	} else {
		raiseError("Must provide name and table code to join table!");
	}
}

function updateTable(table) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (table) {
		var found = false;
		for (var player of table.players) {
			if (player.socketId === socket.id) {
				thePlayer = player;
				found = true;
				break;
			}
		}
		var change = !theTable || theTable.state != table.state;
		theTable = table;
		console.log(theTable);
		if (change) {
			changeState(table.state);
		}
		labels["message"].text = table.message;
		labels["table"].text = `Table ${table.code}`;
		labels["pot value"].text = formatMoney(table.state === TABLE_LOBBY ? table.settings.startPot : table.pot);
		labels["token goal num"].text = table.settings.tokenGoal;
		buttons["crazy box"].clicked = table.settings.crazy;
		buttons["straights box"].clicked = table.settings.straights;
		buttons["5ofk box"].clicked = table.settings.five_of_a_kind;
		buttons["QAKAJ box"].clicked = table.settings.qakaj;
	} else {
		if (theTable) {
			importLedger = clearZeros(theTable.ledger);
		}
		theTable = false;
		changeState(MAIN_MENU);
	}
}

function leaveTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	socket.emit("leave table");
}

function handleServerDisconnect() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var msg = "Server disconnected!";
	if (theTable && theTable.ledger.length > 0) {
		importLedger = clearZeros(theTable.ledger);
		msg += " Ledger saved locally.";
	}
	raiseError(msg);
	theTable = false;
	changeState(MAIN_MENU);
}

function raiseError(msg) {
	labels["error msg"].text = msg;
	labels["error msg"].opacity = 100;
	labels["error msg"].visible = true;
	setTimeout(fadeLabel.bind(null, "error msg", true), ERROR_DURATION_SEC * 10);
}

function fadeLabel(label, start) {
	if (start) {
		labels[label].opacity = 1;
		labels[label].visible = true;
	} else {
		labels[label].opacity -= 0.01;
	}
	if (labels[label].opacity > 0) {
		setTimeout(fadeLabel.bind(null, "error msg", false), ERROR_DURATION_SEC * 10);
	} else {
		labels[label].visible = false;
	}
}
}