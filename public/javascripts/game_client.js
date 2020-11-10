// This file manages the games client's logic. It's here that Socket.io connections are handled
// and functions from canvas.js are used to manage the game's visual appearance.

////////// Game states \\\\\\\\\\\\
MAIN_MENU = "main menu";
AT_TABLE = "at table";

var socket = io();
var gameState = undefined;
var theTable = undefined;
var tableReady = false;
var logFull = true;
var hands = [];
var labels = [];
var thePlayer;

//////////  Socket Events  \\\\\\\\\\

///// Game events \\\\\

socket.on("update table", function(table) {
	updateTable(table);
});

socket.on("update hand", function(playerId, hand) {
	updateHand(playerId, hand);
});

socket.on("round over", function(message) {
	handleRoundOver(message);
});

socket.on("game over", function(message) {
	handleGameOver(message);
});


socket.on("new round", function(hand) {
	handleNewRound(hand);
});

socket.on("server error", function(msg) {
	raiseError(msg);
});

///// Client-server events \\\\\

socket.on("disconnect", function() {
	handleServerDisconnect();
});

//////////  Constructors  \\\\\\\\\\
class Label {
	constructor(position, text, size, align, font) {
		// if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
		//x and y are integers betweem 0 and 1. Use as percentages.
		this.position = position;
		this.text = text;
		this.data = "";
		this.size = size;
		this.font = font ? font : LABEL_FONT;
		this.align = align ? align : "center";
		this.enabled = true;
		this.visible = true;
		this.opacity = 1;
	}

	msg() {
		return this.text + this.data;
	}
}

class Button {
	constructor(position, text, size, callback, uncallback, visible, align, font) {
		this.position = position;
		this.text = text;
		this.size = size;
		this.font = font ? font : LABEL_FONT;
		this.align = align ? align : "center";
		this.callback = callback;
		this.uncallback = uncallback;
		this.down = false;
		this.enabled = false;
		this.visible = visible === undefined ? true : visible;
		this.focus = false;
		this.clicked = false;
		this.opacity = 1;
	}

	enable() {
		this.visible = true;
		this.enabled = true;
		this.clicked = false;
	}

	hide() {
		this.visible = false;
		this.enabled = false;
	}

	msg() {
		return this.text;
	}
}

//////////  Functions  \\\\\\\\\\

///// Game state \\\\\

function initLabels() {
	labels["error msg"] = new Label({x: 0.5, y: 0.97}, "", 20);
	// Main menu
	labels["title"] = new Label({x: 0.5, y: 0.4}, "3-5-7", 200);
	labels["make table"] = new Button({x: 0.5, y: 0.6},  "Make Table", 80, makeTable);
	labels["join table"] = new Button({x: 0.5, y: 0.85}, " Join Table ", 80, joinTable);
	// Table
	labels["table"] = new Label({x: 0.01, y: 0.99}, "", 15, "left");
	labels["version"] = new Label({x: 0.99, y: 0.99}, VERSION, 15, "right", "monospace");
	labels["leave table"] = new Button({x: 0.5, y: 0.6}, "Leave", 30, leaveTable);
	labels["ledger"] = new Label({x: 0.85, y: 0.4}, "Ledger", 30);
	// Game
	labels["hold"] = new Button({x: 0.13, y: 0.8}, "Hold", 30, doHold, doClearMove, false);
	labels["drop"] = new Button({x: 0.27, y: 0.8}, "Drop", 30, doDrop, doClearMove, false);
	labels["pot"] = new Label({x: 0.15, y: 0.4}, "Pot: $", 30);
	labels["token goal"] = new Label({x: 0.06, y: 0.45}, "Token Goal: ", 20, "left");
	labels["message"] = new Label({x: 0.5, y: 0.4}, "", 30);
	labels["deal"] = new Button({x: 0.2, y: 0.8}, "Deal", 30, startRound, undefined, false);
}

function changeState(state) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (state === gameState) {
		return;
	}
	for (var l in labels) { 
		labels[l].enabled = false;
		labels[l].clicked = false;
	}
	switch(state) {
		case MAIN_MENU:
			theTable = undefined;
			hands = [];
			thePlayer = {
				held: false,
			};
			tableReady = false;
			labels["make table"].enabled = true;
			labels["join table"].enabled = true;
			labels["message"].text = "Waiting for players to join...";
			toggleInputs(true);
			break;
		case AT_TABLE:
			labels["table"].text = "Table " + theTable.code;
			labels["leave table"].enabled = true;
			toggleInputs(false);
			break;
	}
	gameState = state;
}

function toggleInputs(on) {
	var d = on ? "block" : "none";
	for (var e of ELEM_CONFIGS) {
		document.getElementById(e.name).style.display = d;
	}
}

///// Game logic \\\\\

function handleRoundOver(message) {
	labels["hold"].hide();
	labels["drop"].hide();
	if (!thePlayer.moved) {
		labels["deal"].enable();
	}
	labels["message"].text = message;
}

function handleNewRound(hand) {
	labels["message"].text = "1, 2, 3, Drop!";
	labels["hold"].enable();
	labels["drop"].enable();
	hands = [];
	hands[socket.id] = hand;
}

function handleGameOver(message) {
	labels["message"].text = message;
	labels["hold"].hide();
	labels["drop"].hide();
	labels["deal"].enable();
	labels["leave table"].enable();
}

function startRound() {
	labels["deal"].hide();
	labels["message"].text = "Waiting for other players...";
	socket.emit("advance round");
}

function isTableOwner() {
	return theTable && theTable.players.length > 0 && theTable.players[0].id === socket.id;
}

function doHold() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// TODO: implement exclusive button set?
	labels["drop"].clicked = false;
	doMove(true)
}

function doDrop() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	labels["hold"].clicked = false;
	doMove(false);
}

function doClearMove() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	socket.emit("clear move");
}

function doMove(held) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	socket.emit("do move", held);
}

function updateHand(playerId, hand) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	hands[playerId] = hand;
}

///// Client-server functions \\\\\

function makeTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var name = document.getElementById("player-name").value;
	// TODO: make settings and send them here.
	if (name) {
		socket.emit("make table", name);
	} else {
		raiseError("Must provide name to make table!");
	}
}

function joinTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var name = document.getElementById("player-name").value;
	var code = document.getElementById("game-code").value.toUpperCase();
	if (name && code) {
		socket.emit("join table", code, name);
	} else {
		raiseError("Must provide name and table code to join table!");
	}
}

function updateTable(table) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (table) {
		theTable = table;
		changeState(AT_TABLE);
		console.log(theTable);
		console.log(theTable.ledger);
		console.log(theTable.theLedger);
		labels["pot"].data = table.pot;
		// Figure out how to add functions, make this a "data field"
		labels["token goal"].data = table.settings.tokenGoal;
		if (table.inGame) {
			labels["leave table"].hide();
		} else {
			labels["leave table"].enable();
		}
		for (var player of theTable.players) {
			if (player.id === socket.id) {
				thePlayer = player;
				break;
			}
		}
		// Some things that can change with number of players.
		if (!table.inGame) {
			toggleTableReady(table.players.length > 1);
		}
	} else {
		raiseError("Room does not exist");
	}
}

function toggleTableReady(ready) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (ready === tableReady) { return; }
	tableReady = ready;
	if (tableReady) {
		labels["message"].text = "Press Deal to Start!";
		labels["deal"].enable();
	} else {
		labels["message"].text = "Waiting for players to join...";
		labels["deal"].hide();
		socket.emit("clear move");
	}
}

function leaveTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	socket.emit("leave table");
	theTable = undefined;
	changeState(MAIN_MENU);
}

function handleServerDisconnect() {
	raiseError("Server disconnected");
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