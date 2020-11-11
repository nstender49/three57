// This file manages the game's logic for most visual things and contains various functions
// for drawing on and manipulating the canvas, used by the game client.


//////////  Canvas  \\\\\\\\\\
function init() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	canvas = document.getElementById("game-canvas");
	ctx = canvas.getContext("2d");
	handleResize();

	initLabels();
	initCards();
	changeState(INIT);
}

function animate() {
	requestAnimFrame(animate);
	draw();
}

//////////  Events  \\\\\\\\\\
function handleMouseMove(event) {
	for (var l in labels) {
		if (isOnButton(event, labels[l])) {
			if (!clickCursor) {
				$("#game-canvas").css("cursor", "pointer");
				clickCursor = true;
			}
			labels[l].focus = true;
			return;
		} else {
			labels[l].down = false;
			labels[l].focus = false;
		}
	}

	$("#game-canvas").css("cursor","auto");
	clickCursor = false;
}

function handleMouseDown(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var l in labels) {
		if (isOnButton(event, labels[l])) {
			labels[l].down = true;
			return;
		}
	}
}

function handleMouseUp(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var l in labels) {
		if (labels[l].down) {
			labels[l].toggle();
		}
		labels[l].down = false;
	}
	handleMouseMove(event);
}

var SHIFTED = false;
function handleKeyDown(event) {
	switch (event.keyCode) {
		case 13:	// enter
			if (SHIFTED) {
				labels["make table"].click();
			} else {
				labels["join table"].click();
			}
		case 38:    // up arrow
			labels["deal"].click();
			break;
		case 40:    // down arrow
			labels["drop"].unclick();
			labels["hold"].unclick();
			break;
		case 39:    // ->
			labels["drop"].click();
			break;
		case 37:	// <-
			labels["hold"].click();
			break;
		case 16:    // shift
			SHIFTED = true;
			break;
		case 27: 	// esc
			labels["leave table"].click();
			break;
	}
	// console.log("Key press: " + event.keyCode);
}

function handleKeyUp(event) {
	switch (event.keyCode) {
		case 16:
			SHIFTED = false;
			break;
	}
}

function getPlayerNameInput() {
	var name = document.getElementById("player-name").value;
	return name ? name : false;
}

function getGameCodeInput() {
	var code = document.getElementById("game-code").value;
	return code ? code : false;
}

function isOnSlot(event, slot) {
	var x = (event.pageX - canvas.offsetLeft),
		y = (event.pageY - canvas.offsetTop);
	if (slot.card && canPlayCard) {
		if (x > slot.position.x && x < slot.position.x + cardWidth &&
			y > slot.position.y && y < slot.position.y + cardHeight) {
			return true;
		}
	}
	return false;
}

function isOnButton(event, label) {
	var x = (event.pageX - canvas.offsetLeft),
		y = (event.pageY - canvas.offsetTop);
	if (label.callback && label.enabled) {
		buttonDims = label.buttonDims();
		return x >= buttonDims.left && x <= buttonDims.right && y <= buttonDims.bot && y >= buttonDims.top;
	}
	return false;
}

function handleResize() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (window.innerWidth < window.innerHeight * aspect) {
		canvas.width = window.innerWidth * 0.9;
		canvas.height = window.innerWidth * 0.9 / aspect;
		r = canvas.width / 1000;
	} else {
		canvas.width = window.innerHeight * 0.9 * aspect;
		canvas.height = window.innerHeight * 0.9;
 		r = canvas.height * aspect / 1000;
	}
	// Resize input boxes
	for (var config of ELEM_CONFIGS) {
		var elem = document.getElementById(config.name);
		elem.style.position = "absolute";
		elem.style.left = (canvas.getBoundingClientRect().left + canvas.width * config.x) + "px";
		elem.style.top = (canvas.getBoundingClientRect().top + canvas.height * config.y) + "px";
		elem.style.width = (canvas.width * config.w) + "px";
		elem.style.height = (canvas.height * config.h) + "px";
		elem.style.fontSize = (40 * r) + "px";
	}
	if (DEBUG) {
		document.getElementById("player-name").value = "P" + Math.floor(Math.random() * 100);
		document.getElementById("game-code").value = "AAAA";
	}
}

//////////  Drawing  \\\\\\\\\\

function draw() {
	drawRect("#eeeeee", 0, 0, 1, 1);
	labels["version"].draw();
	labels["sound"].draw();
	switch (gameState) {
		case INIT:
			break;
		case MAIN_MENU:
			labels["title"].draw();
			labels["make table"].draw();
			labels["join table"].draw();
			break;
		case TABLE_LOBBY:
			drawTable();
			labels["leave table"].draw();
			if (theTable.players.length > 1 && !thePlayer.moved) {
				labels["deal"].draw();
			}
			break;
		case TABLE_GAME:
			drawTable();
			if (!thePlayer.moved) {
				labels["deal"].draw();
			}
			break;
		case TABLE_ROUND:
			drawTable();
			labels["drop"].draw();
			labels["hold"].draw();
			break;
		case TABLE_COUNT:
			drawTable();
			labels["drop"].draw();
			labels["hold"].draw();
			break;
	}
	labels["error msg"].draw();
}

function drawTable() {
	// Check table still exists, in case we have left the table.
	if (!theTable) {
		return;
	}

	// Draw center area
	drawRect("#bbbbbb", 0.05, 0.35, 0.2, 0.3);
	drawRect("#999999", 0.25, 0.35, 0.5, 0.3);
	labels["table"].draw();
	labels["message"].draw();
	labels["pot"].draw();
	labels["token goal"].draw();

	// Draw ledger
	drawLedger();

	// Draw other players.
	var numOther = theTable.players.length - 1;
	var cols = numOther > 2 ? 2 : 1;
	var rows = Math.ceil(numOther / cols);
	var colWidth = 0.9 / cols;
	var rowHeight = 0.3 / rows;

	pos = 0;
	for (var player of theTable.players) {
		if (player.socketId === socket.id) {
			var x = 0.05;
			var y = 0.65;
			var w = 0.9;
			var h = 0.3;
		} else {
			var rowIdx = Math.floor(pos / cols);
			var colIdx = pos % cols;
			var x = 0.05 + colWidth * colIdx;
			var y = 0.05 + rowHeight * rowIdx;
			var w = colWidth;
			var h = rowHeight;
			pos += 1;
		}
		drawPlayerPad(player,x, y, w, h);
	}
}

function drawRect(color, x, y, w, h) {
	var x = canvas.width * x;
	var y = canvas.height * y;
	var w = canvas.width * w;
	var h = canvas.height * h;
	ctx.fillStyle = color;
	ctx.fillRect(x, y, w, h);
}

function makeDownHand(length, color) {
	var hand = []
	for (var i = 0; i < length; i++) {
		hand.push({value: "B", suit: color});
	}
	return hand;
}

function drawCircle(color, x, y, r) {
	ctx.fillStyle = color;
	ctx.lineWidth = 0.1;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, 2 * Math.PI, false);
	ctx.fill();
	ctx.stroke();
}

function drawPlayerPad(player, x, y, width, height) {
	// Calculate absolute position
	var margin = 1; 
	var absX = canvas.width * x + margin;
	var absY = canvas.height * y + margin;
	var nameW = canvas.width * 0.35 * width;
	var cardW = canvas.width * 0.65 * width - margin * 2;
	var absH = canvas.height * height - margin * 2;

	// Draw pads
	ctx.fillStyle = theTable.state === TABLE_GAME && player.held ? "#f5e076" : "#dddddd";
	ctx.fillRect(absX, absY, nameW, absH);
	ctx.fillStyle = FELT_COLOR;
	ctx.fillRect(absX + nameW, absY, cardW, absH);
	var labelMargin = 5;

	// Draw name with "ready" light. Adjust size to fit in name box, and then scoot down.
	var name = new Label({x: absX + labelMargin, y: absY}, player.inactive ? `<<< ${player.name} >>>` : player.name, 30, "left");
	scaleLabelsToWidth([name], nameW, labelMargin);
	var readyMargin = 10 * r;
	var radius = name.dims().height / 2;	
	drawCircle(player.moved ? "green" : "red", absX + radius + labelMargin, absY + radius + labelMargin, radius);
	scaleLabelsToWidth([name], nameW, labelMargin + readyMargin + radius);
	name.position.x += labelMargin + readyMargin + radius; 
	name.position.y += name.dims().height + labelMargin;
	name.draw(true);

	// Similarly, make sure tokens and money fit.
	var money = new Label({x: absX + labelMargin, y: absY + absH - labelMargin}, `$ ${player.money}`, 20, "left");
	var tokens = new Label({x: absX - labelMargin + nameW, y: absY + absH - labelMargin}, `Tokens: ${player.tokens}`, 20, "right");
	scaleLabelsToWidth([money, tokens], nameW, labelMargin);
	money.draw(true);
	tokens.draw(true);

	// Draw the hand.
	if (gameState !== TABLE_LOBBY) {
		hand = hands[player.sessionId];
		if (!hand) {
			hand = makeDownHand(hands[socket.id].length, player.color);
		}
		drawHand(hand, absX + nameW, absY, cardW, absH);
	}
}

function drawHands() {

}

function drawLedger() {
	// Background and title
	drawRect(LEDGER_COLOR, 0.75, 0.35, 0.2, 0.3);
	labels["ledger"].draw();

	// Player names.
	var absX = canvas.width * 0.75;
	var absY = canvas.height * 0.45;
	var absRowH = canvas.height * 0.03;
	var absW = canvas.width * 0.2;
	var margin = canvas.width * 0.01;
	for (var i = 0; i < theTable.ledger.length; ++i) {
		var l = theTable.ledger[i];
		var nameLabel = new Label({x: absX + margin, y: absY + absRowH * i}, l.name, 15, "left");
		var valLabel = new Label({x: absX + absW - margin, y: absY + absRowH * i}, "$"+ l.money, 15, "right");
		scaleLabelsToWidth([nameLabel, valLabel], absW, margin)
		nameLabel.draw(true);
		valLabel.draw(true);
	}
}

function scaleLabelsToWidth(labels, width, margin) {
	var totalMargin = margin * (2 + labels.length - 1);
	var totalWidth = totalMargin;
	for (var label of labels) {
		totalWidth += label.dims().width;
	}
	if (totalWidth > width) {
		var scale = (width - totalMargin) / totalWidth;
		for (var label of labels) {
			label.size *= scale;
		}
	}
}

function drawHand(hand, absX, absY, absW, absH) {
	var cardHeight = absH * 0.9;
	var cardWidth = cardHeight / 1.5;
	// Gap between cards is either MIN_GAP * cardWidth, or negative to stack cards if there are too many.
	var minGap = cardWidth * 0.1
	var gapWidth = Math.min(minGap, (absW - 2 * minGap - hand.length * cardWidth) / (hand.length - 1));
	for (var i = 0; i < hand.length; i++) {
		drawCard(
			hand[i],
			absX + absW / 2 - ((hand.length - 1) / 2 * gapWidth) - (hand.length / 2 * cardWidth) + (cardWidth + gapWidth) * i,
			absY + absH * 0.05,
			cardWidth,
			cardHeight,
		);
	}
}

var VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
var SUITS = ["C", "D", "H", "S"];
var playerColors = ["BLUE", "GREEN", "GREY", "PURPLE", "RED", "YELLOW", "BLU", "GREE", "GRE"];
var CARDS = [];
function initCards() {
	for (var suit of SUITS) {
		CARDS[suit] = [];
		for (var value of VALUES) {
			var img = new Image;
			img.src = `/images/cards/${value}${suit}.png`;
			CARDS[suit][value] = img;
		}
	}
	for (var color of playerColors) {
		CARDS[color] = [];
		var img = new Image;
		img.src = `/images/cards/B${color}.png`;
		CARDS[color]["B"] = img;
	}
}

function drawCard(card, x, y, w, h) {
	ctx.drawImage(CARDS[card.suit][card.value], x, y, w, h);
}

function sound(src) {
	this.sound = document.createElement("audio");
	this.sound.src = src;
	this.sound.setAttribute("preload", "auto");
	this.sound.setAttribute("controls", "none");
	this.sound.style.display = "none";
	document.body.appendChild(this.sound);
	this.play = function(){
		if (soundEnabled) {
			this.sound.play();
		}
	}
	this.stop = function(){
		this.sound.pause();
	}
}

//////////  Initialize  \\\\\\\\\\
window.requestAnimFrame = (function () {
	return window.requestAnimationFrame ||
		   window.webkitRequestAnimationFrame ||
		   window.mozRequestAnimationFrame ||
		   window.oRequestAnimationFrame ||
		   window.msRequestAnimationFrame ||
		   function (callback, element) {
			   window.setTimeout(callback, 1000 / 60);
		   };
})();

var hand, canvas, ctx;
var clickCursor = false,
	aspect = 16 / 10,
	ERROR_DURATION_SEC = 2.5,
	LABEL_FONT = "Tahoma",
	FELT_COLOR = "#35654d",
	LEDGER_COLOR = "#FDFD96",
	POKER_RED = "#A62121";

var VERSION = "v0.0.2";
var ELEM_CONFIGS = [
	{
		name: "player-name",
		x: 0.288,
		y: 0.63,
		w: 0.3,
		h: 0.09,
	},
	{
		name: "game-code",
		x: 0.594,
		y: 0.63,
		w: 0.12,
		h: 0.09,
	},
];

// var DEBUG = true;
var DEBUG = false;

init();
animate();

window.addEventListener("resize", handleResize, false);
canvas.addEventListener("mousemove", handleMouseMove, false);
canvas.addEventListener("mousedown", handleMouseDown, false);
canvas.addEventListener("mouseup", handleMouseUp, false);
window.addEventListener("keydown", handleKeyDown, false);
window.addEventListener("keyup", handleKeyUp, false);