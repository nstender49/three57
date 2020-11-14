// This file manages the game's logic for most visual things and contains various functions
// for drawing on and manipulating the canvas, used by the game client.

//////////  Canvas  \\\\\\\\\\
function init() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	canvas = document.getElementById("game-canvas");
	ctx = canvas.getContext("2d");

	document.body.style.backgroundColor = BACKGROUND_COLOR;

	initInputs();
	initCards();
	initLabels();

	changeState(INIT);
	handleResize();
}

var cursorX, cursorY;

function animate() {
	requestAnimFrame(animate);
	draw();
}

//////////  Events  \\\\\\\\\\
function handleMouseMove(event) {
	cursorX = event.pageX - canvas.offsetLeft;
	cursorY = event.pageY - canvas.offsetTop;
	for (var button of Object.values(buttons)) {
		if (isOnButton(button)) {
			if (!clickCursor) {
				$("#game-canvas").css("cursor", "pointer");
				clickCursor = true;
			}
			button.focus = true;
			return;
		} else {
			button.down = false;
			button.focus = false;
		}
	}

	$("#game-canvas").css("cursor","auto");
	clickCursor = false;
}

function handleMouseDown(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var button of Object.values(buttons)) {
		if (isOnButton(button)) {
			button.down = true;
			return;
		}
	}
}

function handleMouseUp(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var button of Object.values(buttons)) {
		if (button.down) {
			button.toggle();
		}
		button.down = false;
	}
	handleMouseMove(event);
}

var SHIFTED = false;
function handleKeyDown(event) {
	switch (event.keyCode) {
		case 13:	// enter
			if (SHIFTED) {
				buttons["make table"].click();
			} else {
				buttons["join table"].click();
			}
		case 38:    // up arrow
			buttons["deal"].click();
			break;
		case 40:    // down arrow
			buttons["drop"].unclick();
			buttons["hold"].unclick();
			break;
		case 39:    // ->
			buttons["drop"].click();
			break;
		case 37:	// <-
			buttons["hold"].click();
			break;
		case 16:    // shift
			SHIFTED = true;
			break;
		case 27: 	// esc
			buttons["leave table"].click();
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

function isOnButton(button) {
	if (button.enabled) {
		buttonDims = button.buttonDims();
		return cursorX >= buttonDims.left && cursorX <= buttonDims.right && cursorY <= buttonDims.bot && cursorY >= buttonDims.top;
	}
	return false;
}

/*
	dpi = window.devicePixelRatio;
	let style_height = +getComputedStyle(canvas).getPropertyValue("height").slice(0, -2);
	let style_width = +getComputedStyle(canvas).getPropertyValue("width").slice(0, -2);
	console.log(`${style_width} ${style_height} ${window.innerWidth} ${window.innerHeight} ${canvas.offsetWidth} ${canvas.offsetHeight}`);
	style_height = window.innerHeight;
	style_width = window.innerWidth;
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (style_height === 0 || style_width < style_height * aspect) {
		canvas.width = style_width;
		canvas.height = style_width / aspect;
		r = canvas.width / 1000;
	} else {
		canvas.width = style_height * aspect;
		canvas.height = style_height;
 		r = canvas.height * aspect / 1000;
	}
*/

function handleResize() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (window.innerWidth < window.innerHeight * aspect) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerWidth/ aspect;
		r = canvas.width / 1000;
	} else {
		canvas.width = window.innerHeight * aspect;
		canvas.height = window.innerHeight;
 		r = canvas.height * aspect / 1000;
	}
	// Resize input boxes
	for (var config of ELEM_CONFIGS) {
		var elem = document.getElementById(config.name);
		elem.style.position = "absolute";
		elem.style.left = (canvas.getBoundingClientRect().left + canvas.width * config.x) + "px";
		elem.style.top = (canvas.getBoundingClientRect().top + canvas.height * config.y) + "px";
		if (config.w) {
			elem.style.width = (canvas.width * config.w) + "px";
			elem.style.height = (canvas.height * config.h) + "px";
			elem.style.fontSize = (40 * r) + "px";
		}
		if (config.size) {
			elem.style.fontSize = (config.size * r) + "px";
		}

	}
	if (DEBUG) {
		document.getElementById("player-name").value = "P" + Math.floor(Math.random() * 100);
		document.getElementById("game-code").value = "AAAA";
	}
}

//////////  Drawing  \\\\\\\\\\

function draw() {
	drawRect(BACKGROUND_COLOR, 0, 0, 1, 1);

	// Check for holding buttons.
	for (var button of Object.values(buttons)) {
		button.checkHold();
	}
	switch (gameState) {
		case INIT:
			break;
		case MAIN_MENU:
			drawGroups["main menu"].draw();
			if (importLedger && importLedger.length > 0) {
				buttons["clear ledger"].enable();
				buttons["download ledger main"].enable();
				labels["import ledger"].visible = false;
				document.getElementById("ledger-file").style.display = "none";
				document.getElementById("ledger-file").value = null;
			} else {
				buttons["clear ledger"].disable();
				buttons["download ledger main"].disable();
				labels["import ledger"].visible = true;
				document.getElementById("ledger-file").style.display = "block";
			}
			break;
		case TABLE_LOBBY:
			drawTable();
			if (theTable.players.length > 1 && !thePlayer.moved) {
				buttons["deal"].enable();
				if (buttons["auto box"].clicked) {
					buttons["deal"].toggle();
				}
			} else {
				buttons["deal"].disable();
			}
			if (isTableOwner()) {
				buttonGroups["settings"].enable();
			}
			break;
		case TABLE_GAME:
			drawTable();
			thePlayer.moved ? buttons["deal"].disable() : buttons["deal"].enable();
			break;
		case TABLE_ROUND:
			drawTable();
			break;
		case TABLE_COUNT:
			drawTable();
			break;
	}
	drawGroups["bottom bar"].draw();
}

function drawTable() {
	// Check table still exists, in case we have left the table.
	if (!theTable) {
		return;
	}

	// Draw settings
	drawRect("#bbbbbb", 0.05, 0.35, 0.2, 0.3);
	drawGroups["settings"].draw();

	// Draw Message area
	drawRect("#999999", 0.25, 0.35, 0.5, 0.3);
	labels["hand message"].visible = gameState !== TABLE_LOBBY;
	drawGroups["messages"].draw();
	if (gameState === TABLE_GAME && thePlayer && thePlayer.held) {
		var numRow = Math.max(4, Object.keys(hands).length - 1);
		var i = 0;
		for (var name in hands) {
			if (name === thePlayer.name) {
				continue;
			}
			handMessage = new Label({x: 0.27, y: 0.45 + 0.2 * i / numRow}, `${name}: ${hands[name].text}`, 80 / numRow, "left");
			handMessage.draw();
			i++;
		}
	}

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
			if (hands[player.name]) {
				labels["hand message"].text = hands[player.name].text;
			}
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
	drawGroups["player pad"].draw();
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
	var name = new Label({x: absX + labelMargin, y: absY}, player.active ? player.name : `< ${player.name} >`, 30, "left");
	scaleLabelsToWidth([name], nameW, labelMargin);
	var readyMargin = 10 * r;
	var radius = name.dims().height / 2;	
	drawCircle(player.moved ? "green" : "red", absX + radius + labelMargin, absY + radius + labelMargin, radius);
	scaleLabelsToWidth([name], nameW, labelMargin + readyMargin + radius);
	name.position.x += labelMargin + readyMargin + radius; 
	name.position.y += name.dims().height + labelMargin;
	name.draw(true);

	// Similarly, make sure tokens and money fit.
	var money = new Label({x: absX + labelMargin, y: absY + absH - labelMargin}, formatMoney(player.money), 20, "left");
	var tokens = new Label({x: absX - labelMargin + nameW, y: absY + absH - labelMargin}, `Tokens: ${player.tokens}`, 20, "right");
	scaleLabelsToWidth([money, tokens], nameW, labelMargin);
	money.draw(true);
	tokens.draw(true);

	// Draw the hand.
	if (gameState !== TABLE_LOBBY) {
		drawHand(absX + nameW, absY, cardW, absH, hands[player.name]);
	}
}

function round(num, digits = 0) {
	return Math.round((num + Number.EPSILON) * Math.pow(10, digits)) / Math.pow(10, digits);
}

function formatMoney(value) {
	return Math.abs(value) > 0 && Math.abs(value) < 1 ? `₵ ${round(value * 100)}` : `$ ${round(value, 2)}`;
}

function drawLedger() {
	// Background and title
	drawRect(LEDGER_COLOR, 0.75, 0.35, 0.2, 0.3);
	drawGroups["ledger"].draw();

	// Player names.
	var absX = canvas.width * 0.75;
	var absY = canvas.height * 0.45;
	var absRowH = canvas.height * 0.03;
	var absW = canvas.width * 0.2;
	var margin = canvas.width * 0.01;
	for (var i = 0; i < theTable.ledger.length; ++i) {
		var l = theTable.ledger[i];
		var nameLabel = new Label({x: absX + margin, y: absY + absRowH * i}, l.name, 15, "left");
		var valLabel = new Label({x: absX + absW - margin, y: absY + absRowH * i}, formatMoney(l.money), 15, "right");
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

function drawHand(absX, absY, absW, absH, hand) {
	var cardHeight = absH * 0.9;
	var cardWidth = cardHeight / CARD_RATIO;
	// Gap between cards is either MIN_GAP * cardWidth, or negative to stack cards if there are too many.
	var minGap = cardWidth * 0.1
	var gapWidth = Math.min(minGap, (absW - 2 * minGap - theTable.round * cardWidth) / (theTable.round - 1));
	for (var i = 0; i < theTable.round; i++) {
		drawCard(
			hand ? hand.cards[i] : undefined,
			absX + absW / 2 - ((theTable.round - 1) / 2 * gapWidth) - (theTable.round  / 2 * cardWidth) + (cardWidth + gapWidth) * i,
			absY + absH * 0.05,
			cardWidth,
			cardHeight,
		);
	}
}

var VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
var SUITS = ["C", "D", "H", "S"];
var CARD_BACK = undefined;
var CARDS = [];
var CARD_RATIO = 1.4;

function initCards() {
	for (var suit of SUITS) {
		CARDS[suit] = [];
		for (var value of VALUES) {
			var img = new Image;
			img.src = `/images/cards/${value}${suit}.png`;
			CARDS[suit][value] = img;
		}
	}
	CARDS["S"]["A"].onload = function () {
		CARD_RATIO = CARDS["S"]["A"].height / CARDS["S"]["A"].width;
	}
	var img = new Image;
	img.src = `/images/cards/BACK.png`;
	CARD_BACK = img;
}

function drawCard(card, x, y, w, h) {
	ctx.drawImage(card ? CARDS[card.suit][card.value] : CARD_BACK, x, y, w, h);
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

function initInputs() {
	var container = document.getElementById("content");
	var input = document.createElement("input");
	input.id = "player-name";
	input.type = "text";
	input.maxLength = 16;
	input.placeholder = "Player Name";
	input.style.display = "none";
	container.appendChild(input);
	input = document.createElement("input");
	input.id = "game-code";
	input.type = "text";
	input.maxLength = 4;
	input.placeholder = "CODE";
	input.style.textTransform = "uppercase";
	input.style.display = "none";
	container.appendChild(input);
	input = document.createElement("input");
	input.id = "ledger-file";
	input.type = "file";
	input.accept = ".txt";
	input.addEventListener("change", loadLedgerFile);
	container.appendChild(input);
}

function loadLedgerFile() {
	var input = document.getElementById("ledger-file");
	if (input.files[0]) {
		var fr = new FileReader();
		fr.onload = function() {
			if (this.error) {
				raiseError("Failed to import ledger file!");
				return;
			}
			readLedgerString(this.result);
		}
		fr.readAsText(input.files[0]);
	}
}

function readLedgerString(str) {
	var lines = str.split('\n');
	importLedger = [];
	for (var line of lines) {
		var sp = line.split(":");
		money = Number(sp[1]);
		if (!money && money !== 0) {
			raiseError(`Failed to process ledger entry for ${sp[0]}: ${sp[1]}`);
			importLedger = [];
			return;
		}
		importLedger.push({name: sp[0], money: Number(sp[1])});
	}
}

function clearZeros(ledger) {
	var newLedger = [];
	for (var l of ledger) {
		if (l.money === 0) {
			continue;
		}
		newLedger.push(l);
	}
	return newLedger;
}

function downloadLedgerFile() {
	if (!importLedger && !theTable) {
		raiseError("No ledger stored!");
		return;
	}
	var ledger = theTable ? theTable.ledger : importLedger;
	// Create the text content
	var lines = [];
	for (var l of clearZeros(ledger)) {
		if (l.money === 0) {
			continue;
		}
		lines.push(`${l.name}:${l.money}`);
	}
	var content = lines.join('\n');
	downloadFile(content, "ledger.txt");
}

function downloadFile(strData, strFileName, strMimeType) {
    var a = document.createElement("a");

    //build download link:
    a.href = "data:" + strMimeType + "charset=utf-8," + escape(strData);

    if (window.MSBlobBuilder) { // IE10
        var bb = new MSBlobBuilder();
        bb.append(strData);
        return navigator.msSaveBlob(bb, strFileName);
    }

    if ('download' in a) { //FF20, CH19
        a.setAttribute("download", strFileName);
        a.innerHTML = "downloading...";
        document.body.appendChild(a);
        setTimeout(function() {
            var e = document.createEvent("MouseEvents");
            e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            a.dispatchEvent(e);
            document.body.removeChild(a);
        }, 66);
        return true;
    }

    //do iframe dataURL download: (older W3)
    var f = document.createElement("iframe");
    document.body.appendChild(f);
    f.src = "data:" + (A[2] ? A[2] : "application/octet-stream") + (window.btoa ? ";base64" : "") + "," + (window.btoa ? window.btoa : escape)(strData);
    setTimeout(function() {
        document.body.removeChild(f);
    }, 333);
    return true;
}

window.requestAnimFrame = (function () {
	return window.requestAnimationFrame ||
		   window.webkitRequestAnimationFrame ||
		   window.mozRequestAnimationFrame ||
		   window.oRequestAnimationFrame ||
		   window.msRequestAnimationFrame ||
		   function (callback, element) {
			   window.setTimeout(callback, 1000 / 30);
		   };
})();

var hand, canvas, ctx;
var clickCursor = false,
	aspect = 16 / 10,
	ERROR_DURATION_SEC = 2.5,
	BACKGROUND_COLOR = "#eeeeee",
	LABEL_FONT = "Tahoma",
	FELT_COLOR = "#35654d",
	LEDGER_COLOR = "#FDFD96",
	POKER_RED = "#A62121";

var VERSION = "v0.1.2";
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
	{
		name: "ledger-file",
		x: 0.45,
		y: 0.9,
		size: 15,
	},
];

init();
animate();

window.addEventListener("resize", handleResize, false);
canvas.addEventListener("mousemove", handleMouseMove, false);
canvas.addEventListener("mousedown", handleMouseDown, false);
canvas.addEventListener("mouseup", handleMouseUp, false);
window.addEventListener("keydown", handleKeyDown, false);
window.addEventListener("keyup", handleKeyUp, false);