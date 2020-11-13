// This file manages the games client's logic. It's here that Socket.io connections are handled
// and functions from canvas.js are used to manage the game's visual appearance.

////////// Game states \\\\\\\\\\\\
INIT = "init";
MAIN_MENU = "main menu";
TABLE_LOBBY = "table lobby";
TABLE_GAME = "table game";
TABLE_ROUND = "table round";
TABLE_COUNT = "table count";
DEBUG = false;

var socket = io();
var gameState = undefined;
var theTable = undefined;
var tableReady = false;
var soundEnabled = false;
var logFull = true;
var labels = [];
var sounds = [];

var thePlayer;
var hands = [];

//////////  Socket Events  \\\\\\\\\\

///// Game events \\\\\

socket.on("update table", function(table) {
	updateTable(table);
});

socket.on("update hand", function(id, hand, clear) {
	if (clear) {
		hands = [];
	}
	hands[id] = hand;
});

socket.on("play countdown", function() {
	sounds["count"].play();
});

socket.on("server error", function(msg) {
	raiseError(msg);
});

socket.on("set debug", function(debug) {
	DEBUG = debug;
	handleResize();
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
		this.visible = true;
		this.opacity = 1;
	}

	msg() {
		return this.text + this.data;
	}

	disable() {}

	dims() {
		ctx.font = (this.size * r) + "px " + this.font;
		var metrics = ctx.measureText(this.msg())
		return {
			width: metrics.width,
			height: metrics.actualBoundingBoxAscent,
		}
	}

	draw(absolute = false) {
		if (!this.visible) { return; }
		if (this.opacity < 1) {
			ctx.save();
			ctx.globalAlpha = this.opacity;
		}

		ctx.strokeStyle = "black";
		ctx.fillStyle = "black";
		ctx.font = (this.size * r) + "px " + this.font;
	
		ctx.textBaseline = "center";
		ctx.textAlign = this.align;
		if (absolute) {
			ctx.fillText(this.msg(), this.position.x, this.position.y);
		} else {
			ctx.fillText(this.msg(), canvas.width * this.position.x, canvas.height * this.position.y);
		}
		if (this.opacity < 1) {
			ctx.restore();
		}
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
		this.undoEnabled = true;
	}

	toggle() {
		if (!this.enabled) {
			return;
		}
		console.log("TOGGLE!!!");
		if (this.clicked) {
			console.log("TRYING TO UNCLICK");
			this.unclick();
		} else {
			this.click();
		}
	}

	click() {
		if (!this.enabled) {
			return;
		}
		if (!this.clicked) {
			if (this.uncallback) {
				this.clicked = true;
			}
			this.callback();
		}
	}

	unclick() {
		console.log("IN UNCLICK");
		if (!this.enabled) {
			return;
		}
		console.log(`${this.clicked} ${this.undoEnabled}`);
		if (this.clicked && this.uncallback && this.undoEnabled) {
			this.clicked = false;
			this.uncallback();
		}
	}

	enable() {
		this.visible = true;
		this.enabled = true;
		this.clicked = false;
		this.undoEnabled = true;
	}

	disable() {
		this.visible = false;
		this.enabled = false;
	}

	disableUndo() {
		this.undoEnabled = false;
	}

	dims() {
		ctx.font = (this.size * r) + "px " + this.font;
		var metrics = ctx.measureText(this.text)
		return {
			width: metrics.width,
			height: metrics.actualBoundingBoxAscent,
		}
	}

	buttonDims() {
		var dims = this.dims();
		var margin = 20 * r;
	
		// Top left corner.
		var minX = canvas.width * this.position.x - margin * 0.5;
		if (this.align === "center") {
			minX -= dims.width / 2;
		} else if (this.align === "right") {
			minX -= dims.width;
		}
		var minY = canvas.height * this.position.y - dims.height - margin * 0.5;
		var maxX = minX + dims.width + margin;
		var maxY = minY + dims.height + margin;
		
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width + margin,
			height: dims.height + margin,
		}
	}

	draw(absolute = false) {
		if (!this.visible) { return; }

		if (this.focus || this.clicked) {
			ctx.strokeStyle = POKER_RED;
			ctx.fillStyle = POKER_RED;
		} else if (this.enabled) {
			ctx.strokeStyle = "black";
			ctx.fillStyle = "black";
		} else {
			ctx.strokeStyle = "grey";
			ctx.fillStyle = "grey";
		}
		ctx.font = (this.size * r) + "px " + this.font;
	
		var buttonDims = this.buttonDims();
		ctx.lineWidth = 3 * r;
		ctx.lineJoin = "round";
		ctx.strokeRect(buttonDims.left, buttonDims.top, buttonDims.width, buttonDims.height);

		ctx.textBaseline = "center";
		ctx.textAlign = this.align;
		if (absolute) {
			ctx.fillText(this.msg(), this.position.x, this.position.y);
		} else {
			ctx.fillText(this.text, canvas.width * this.position.x, canvas.height * this.position.y);
		}
	}
}

class ImageLabel {
	constructor(position, width, height, src) {
		this.position = position;
		this.width = width;
		this.height = height;
		this.img = new Image;
		this.img.src = src;
		this.ratio = this.img.width / this.img.height;
	}

	disable() {}

	dims() {
		return {
			width: canvas.width * this.width,
			height: canvas.height * this.height,
		}
	}

	buttonDims() {
		var dims = this.dims();

		var minX = canvas.width * this.position.x;
		var minY = canvas.height * this.position.y;
		var maxX = minX + dims.width;
		var maxY = minY + dims.height;
		
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width,
			height: dims.height,
		}
	}

	draw() {
		var h = canvas.height * this.height;
		var w = this.width ? canvas.width * this.width : h * (this.img.width / this.img.height);
		var x = canvas.width * this.position.x - w / 2;
		var y = canvas.height * this.position.y;
		ctx.drawImage(this.img, x, y, w, h);
	}
}

class ImageButton {
	constructor(position, width, height, on_src, callback, off_src, uncallback) {
		this.position = position;
		this.width = width;
		this.height = height;
		this.on_src = on_src;
		this.off_src = off_src;
		this.callback = callback;
		this.uncallback = uncallback;
		this.enabled = true;
		this.visible = true;
		this.on = true;
	}

	src() {
		return this.on ? this.on_src : this.off_src;
	}

	toggle() {
		if (!this.enabled) {
			return;
		}
		if (this.on) {
			this.uncallback();
		} else {
			this.callback();
		}
		this.on = !this.on;
	}

	enable() {
		this.visible = true;
		this.enabled = true;
	}

	disable() {
		this.visible = false;
		this.enabled = false;
	}

	dims() {
		return {
			width: canvas.width * this.width,
			height: canvas.height * this.height,
		}
	}

	buttonDims() {
		var dims = this.dims();

		var minX = canvas.width * this.position.x;
		var minY = canvas.height * this.position.y;
		var maxX = minX + dims.width;
		var maxY = minY + dims.height;
		
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width,
			height: dims.height,
		}
	}

	draw() {
		if (!this.visible) { return; }
		var img = new Image;
		img.src = this.src();
		var x = canvas.width * this.position.x;
		var y = canvas.height * this.position.y;
		var w = canvas.width * this.width;
		var h = canvas.height * this.height;
		ctx.drawImage(img, x, y, w, h);
	}
}

//////////  Functions  \\\\\\\\\\

///// Game state \\\\\

function initLabels() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	labels["error msg"] = new Label({x: 0.5, y: 0.97}, "", 20);
	// Main menu
	labels["title_3"] = new ImageLabel({x: 0.35, y: 0.15}, false, 0.3, `/images/cards/3S.png`);
	labels["title_5"] = new ImageLabel({x: 0.5, y: 0.15}, false, 0.3, `/images/cards/5S.png`);
	labels["title_7"] = new ImageLabel({x: 0.65, y: 0.15}, false, 0.3, `/images/cards/7S.png`);
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
	labels["hand message"] = new Label({x: 0.5, y: 0.6}, "Hand Message", 20);
	labels["deal"] = new Button({x: 0.2, y: 0.8}, "Deal", 30, doDeal, undefined, false);

	labels["sound"] = new ImageButton({x: 0.91, y: 0.97}, 0.02, 0.025, "/images/sound_off.png", disableSound, "/images/sound_on.png", enableSound);

	sounds["count"] = new sound("/sounds/racestart.wav");
}

function changeState(state) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (state === gameState) {
		return;
	}
	for (var l in labels) { 
		labels[l].disable();
	}
	toggleInputs(false);
	labels["sound"].enable();
	switch(state) {
		case MAIN_MENU:
			labels["make table"].enable();
			labels["join table"].enable();
			toggleInputs(true);
			break;
		case TABLE_LOBBY:
			labels["deal"].enable();
			labels["leave table"].enable();
		case TABLE_GAME:
			if (!thePlayer.moved) {
				labels["deal"].enable();
			}
		case TABLE_ROUND:
			labels["hold"].enable();
			labels["drop"].enable();
			break;
		case TABLE_COUNT:
			var clicked = labels["hold"].clicked;
			labels["hold"].enable();
			labels["hold"].clicked = clicked;
			clicked = labels["drop"].clicked;
			labels["drop"].enable();
			labels["drop"].clicked = clicked;
			labels["hold"].disableUndo();
			labels["drop"].disableUndo();
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
	return theTable && theTable.players.length > 0 && theTable.players[0].id === socket.id;
}

function doDeal() {
	doMove(true);
}

function doHold() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// TODO: implement exclusive button set?
	labels["drop"].clicked = false;
	doMove(true, true);
}

function doDrop() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	labels["hold"].clicked = false;
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

function updateHand(playerId, hand) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	hands[playerId] = hand;
}
}

///// Client-server functions \\\\\

{
function makeTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var name = getPlayerNameInput()
	// TODO: make settings and send them here.
	if (name) {
		socket.emit("make table", name);
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
		if (!theTable || theTable.state != table.state) {
			changeState(table.state);
		}
		labels["message"].text = table.message;
		labels["table"].text = `Table ${table.code}`;
		labels["pot"].data = table.pot;
		labels["token goal"].data = table.settings.tokenGoal;
		theTable = table;

	} else {
		theTable = undefined;
		changeState(MAIN_MENU);
	}
}

function leaveTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	socket.emit("leave table");
}

function handleServerDisconnect() {
	raiseError("Server disconnected");
	// TODO : offer to print ledger and money
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