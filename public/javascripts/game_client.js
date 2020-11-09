// This file manages the games client's logic. It's here that Socket.io connections are handled
// and functions from canvas.js are used to manage the game's visual appearance.

////////// Game states \\\\\\\\\\\\
MAIN_MENU = "main menu";
AT_TABLE = "at table";

var socket = io();
var gameState = undefined;
var theTable = undefined;
var logFull = true;
var hands = [];
var labels = [];
var thePlayer = {
	held: false,
};

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

///// Client-server events \\\\\

socket.on("disconnect", function() {
	handleServerDisconnect();
});

//////////  Constructors  \\\\\\\\\\
function Label(position, text, size, align, font) {
	// if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	//x and y are integers betweem 0 and 1. Use as percentages.
	this.position = position;
	this.text = text;
	this.size = size;
	this.font = font ? font : labelFont;
	this.align = align ? align : "center";
	this.enabled = true;
}

function Button(position, text, size, callback, align, font) {
	this.position = position;
	this.text = text;
	this.size = size;
	this.font = font ? font : labelFont;
	this.align = align ? align : "center";
	this.callback = callback;
	this.down = false;
	this.enabled = false;
}

//////////  Functions  \\\\\\\\\\

///// Game state \\\\\

function initLabels() {
	// Main menu
	labels["title"] = new Label({x: 0.5, y: 0.4}, "3-5-7", 200);
	labels["make table"] = new Button({x: 0.5, y: 0.7}, "Make Table", 80, makeTable);
	labels["join table"] = new Button({x: 0.5, y: 0.85}, "Join Table", 80, joinTable);
	// Table
	labels["table"] = new Label({x: 0.06, y: 0.98}, "", 20);
	labels["leave table"] = new Button({x: 0.95, y: 0.97}, "Leave", 30, leaveTable);
	// Game
	labels["player name"] = new Label({x: 0.06, y: 0.7}, "Player", 30, "left");
	labels["hold"] = new Button({x: 0.1, y: 0.8}, "Hold", 40, doHold, "left");
	labels["drop"] = new Button({x: 0.2, y: 0.8}, "Drop", 40, doDrop, "left");
	labels["money"] = new Label({x: 0.06, y: 0.9}, "$0", 30, "left");
	labels["tokens"] = new Label({x: 0.2, y: 0.9}, "Tokens: ", 30, "left");
	labels["pot"] = new Label({x: 0.05, y: 0.45}, "Pot: $0", 40, "left");
	labels["token goal"] = new Label({x: 0.05, y: 0.55}, "Token goal: X", 40, "left");
	labels["message"] = new Label({x: 0.65, y: 0.45}, "Press Deal to Start!", 40);
	labels["deal"] = new Button({x: 0.65, y: 0.55}, "Deal", 40, startRound);
}

function changeState(state) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (state === gameState) {
		return;
	}
	for (var l in labels) { 
		labels[l].enabled = false;
	}
	switch(state) {
		case MAIN_MENU:
			theTable = undefined;
			hands = [];
			thePlayer = {
				held: false,
			};
			labels["make table"].enabled = true;
			labels["join table"].enabled = true;
			labels["message"].text = "Press Deal to Start!";
			break;
		case AT_TABLE:
			labels["table"].text = "Table " + theTable.code;
			labels["leave table"].enabled = true;
			labels["deal"].enabled = true;
			break;
	}
	gameState = state;
}

///// Game logic \\\\\

function handleRoundOver(message) {
	labels["deal"].enabled = true;
	labels["message"].text = message;
}

function handleNewRound(hand) {
	labels["message"].text = "1, 2, 3, Drop!";
	labels["hold"].enabled = true;
	labels["drop"].enabled = true;
	thePlayer.held = false;
	hands = [];
	hands[socket.id] = hand;
}

function handleGameOver(message) {
	labels["message"].text = message;
	labels["hold"].enabled = false;
	labels["drop"].enabled = false;
	labels["deal"].enabled = true;
	labels["leave table"].enabled = true;
}

function startRound() {
	labels["deal"].enabled = false;
	socket.emit("advance round");
}

function isTableOwner() {
	return theTable && theTable.players.length > 0 && theTable.players[0].id === socket.id;
}

function doHold() {
	doMove(true)
}

function doDrop() {
	doMove(false);
}

function doMove(held) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	labels["hold"].enabled = false;
	labels["drop"].enabled = false;
	thePlayer.held = held;
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
	var code = document.getElementById("game-code").value;
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
		labels["pot"].text = "Pot: $" + table.pot;
		labels["token goal"].text = "Token goal: " + table.settings.tokenGoal;
		labels["leave table"].enabled = !table.inGame;
	} else {
		raiseError("Room does not exist");
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
	// TODO: make this a pop up message
	console.log(msg);
}