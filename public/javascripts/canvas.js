// This file manages the game's logic for most visual things and contains various functions
// for drawing on and manipulating the canvas, used by the game client.


//////////  Canvas  \\\\\\\\\\
function init() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	canvas = document.getElementById("game-canvas");
	ctx = canvas.getContext("2d");
	handleResize();

	initLabels();
	changeState(MAIN_MENU);
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
			return;
		} else {
			labels[l].down = false;
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
			labels[l].down = false;
			labels[l].callback();
		}
	}
	handleMouseMove(event);
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
		var labelWidth = label.text.length * label.size * r * 0.4;
		var labelHeight = label.size * r;
		if (label.align === "left") {
			var leftBoundary = label.position.x * canvas.width;
			var rightBoundary = label.position.x * canvas.width + labelWidth;
		} else if (label.align === "center") {
			var leftBoundary = label.position.x * canvas.width - labelWidth / 2;
			var rightBoundary = label.position.x * canvas.width + labelWidth / 2;
		}
		var upperBoundary = label.position.y * canvas.height - labelHeight / 2;
		var lowerBoundary = label.position.y * canvas.height + labelHeight / 2;

		if (x > leftBoundary && x < rightBoundary &&
			y > upperBoundary && y < lowerBoundary) {
			return true;
		}
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
	cardWidth = 120 * r;
	gapWidth = 20 * r;
	cardHeight = cardWidth * 1.5;
	playerCardPosition = {x: canvas.width * 0.17, y: canvas.height * 0.15};
	opponentCardPosition = {x: canvas.width * 0.83 - cardWidth * 1.5, y: canvas.height * 0.15};
}

//////////  Drawing  \\\\\\\\\\

function draw() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	switch (gameState) {
		case MAIN_MENU:
			// TODO add "draw" function to label
			drawLabel(labels["title"]);
			drawLabel(labels["make table"]);
			drawLabel(labels["join table"]);
			break;
		case AT_TABLE:
		case IN_GAME:
			drawLabel(labels["table"]);
			drawLabel(labels["leave table"]);
			drawGame();
			drawLabel(labels["player name"]);
			drawLabel(labels["drop"]);
			drawLabel(labels["hold"]);
			drawLabel(labels["pot"]);
			drawLabel(labels["token goal"]);
			drawLabel(labels["message"]);
			drawLabel(labels["deal"]);
			break;
	}
}

function drawGame() {
	// Check table still exists, in case we have left the table.
	if (!theTable) {
		return;
	}

	// Draw player's hand, check for existence in case we are transitioning.
	drawPlayer(0, 0.65, 1.0, 0.3, thePlayer.held)
	if (theTable.inGame) {
		var hand = hands[socket.id]
		if (hand) {
			drawHand(hand, 0, 0.65, 1.0, 0.3);
		}
	}

	// Draw other players.
	var numOther = theTable.players.length - 1;
	var cols = numOther > 2 ? 2 : 1;
	var rows = Math.ceil(numOther / cols);
	var colWidth = 1 / cols;
	var rowHeight = 0.3 / rows;

	pos = 0;
	for (var player of theTable.players) {
		if (player.id === socket.id) {
			labels["money"].text = "$" + player.money;
			drawLabel(labels["money"]);
			labels["tokens"].text = "Tokens: " + player.tokens;
			drawLabel(labels["tokens"]);
			continue;
		}
		var rowIdx = Math.floor(pos / cols);
		var colIdx = pos % cols;
		drawPlayer(colWidth * colIdx, 0.05 + rowHeight * rowIdx, colWidth, rowHeight, !theTable.inRound && player.held);
		drawLabel(new Label({x: colWidth * (colIdx + 0.06), y: 0.1 + rowHeight * rowIdx}, player.name, 30, "left"));
		drawLabel(new Label({x: colWidth * (colIdx + 0.06), y: 0.1 + rowHeight * (0.4 + rowIdx)}, "$" + player.money, 20, "left"));
		drawLabel(new Label({x: colWidth * (colIdx + 0.2), y: 0.1 + rowHeight * (0.4 + rowIdx)}, "Tokens: " + player.tokens, 20, "left"));
		if (theTable.inGame) {
			hand = hands[player.id];
			if (!hand) {
				hand = makeDownHand(hands[socket.id].length, player.color);
			}
			drawHand(hand, colWidth * colIdx, 0.05 + rowHeight * rowIdx, colWidth, rowHeight);
		}
		pos += 1;
	}
}

function makeDownHand(length, color) {
	var hand = []
	for (var i = 0; i < length; i++) {
		hand.push({value: "B", suit: color});
	}
	return hand;
}

function drawPlayer(x, y, width, height, highlight = false) {
	var absX = canvas.width * x;
	var absY = canvas.height * y;
	var margin = canvas.width * 0.05 * width; 
	var nameW = canvas.width * 0.3 * width;
	var cardW = canvas.width * 0.6 * width;
	var absH = canvas.height * 0.9 * height;
	ctx.fillStyle = highlight ? "#f5e076" : "#dddddd";
	ctx.fillRect(absX + margin, absY, nameW, absH);
	ctx.fillStyle = "#598d5a";
	ctx.fillRect(absX + margin + nameW, absY, cardW, absH);
}

function drawHand(hand, x, y, width, height) {
	var absX = canvas.width * x;
	var absY = canvas.height * y;
	var margin = canvas.width * 0.05 * width; 
	var nameW = canvas.width * 0.3 * width;
	var cardW = canvas.width * 0.6 * width;
	var absH = canvas.height * 0.9 * height;
	var cardHeight = absH * 0.9;
	var cardWidth = cardHeight / 1.5;
	// Gap between cards is either MIN_GAP * cardWidth, or negative to stack cards if there are too many.
	var minGap = cardWidth * 0.1
	var gapWidth = Math.min(minGap, (cardW - 2 * minGap - hand.length * cardWidth) / (hand.length - 1));
	for (var i = 0; i < hand.length; i++) {
		drawCard(
			hand[i],
			absX + margin + nameW + cardW / 2 - ((hand.length - 1) / 2 * gapWidth) - (hand.length / 2 * cardWidth) + (cardWidth + gapWidth) * i,
			absY + absH * 0.05,
			cardWidth,
			cardHeight,
		);
	}
}

function drawCard(card, x, y, w, h) {
	var img = new Image;
	img.src = "/images/cards/" + card.value + card.suit + ".png";
	ctx.drawImage(img, x, y, w, h);
}

function drawLabel(label) {
	ctx.textBaseline = "center";
	ctx.textAlign = label.align;
	ctx.font = (label.size * r) + "px " + label.font;
	var shadowDistance = label.size / 30;
	if (label.enabled || !label.callback) {
		ctx.fillStyle = "#9a9a9a";
		ctx.fillText(label.text, canvas.width * label.position.x + (shadowDistance * r), canvas.height * label.position.y + (shadowDistance * r));
		ctx.fillStyle = "#000000";
	} else {
		ctx.fillStyle = "#9a9a9a";
	}
	if (label.down) {
		ctx.fillText(label.text, canvas.width * label.position.x + (shadowDistance * 0.5 * r), canvas.height * label.position.y + (shadowDistance * 0.5 * r));
	} else {
		ctx.fillText(label.text, canvas.width * label.position.x, canvas.height * label.position.y);
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

var hand, canvas, ctx, horizontalCenter, verticalCenter, clickPos, clickedCard, cardWidth, cardHeight, playerCardPosition, opponentCardPosition;
var clickCursor = false,
	displayCardSlots = false,
	aspect = 16 / 10,
	inputs = [],
	labelFont = "Times New Roman";

init();
animate();

window.addEventListener("resize", handleResize, false);
canvas.addEventListener("mousemove", handleMouseMove, false);
canvas.addEventListener("mousedown", handleMouseDown, false);
canvas.addEventListener("mouseup", handleMouseUp, false);