// This file handles all socket.io connections and manages the serverside game logic.

var socketio = require("socket.io");
var getWinner = require("./hand_comparison").getWinner;

var players = [];
var tables = [];
var games = [];

var values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
var suits = ["C", "D", "H", "S"];
var playerColors = ["BLUE", "GREEN", "GREY", "PURPLE", "RED", "YELLOW"];

var logFull = true;

//////////  Socket.io  \\\\\\\\\\
module.exports.listen = function(app) {
	io = socketio.listen(app);
	io.on("connection", function(socket) {
		players.push({
			socket: socket,
			hand: [],
			held: false,
			moved: false,
		});

		socket.on("disconnect", function() {
			playerDisconnected(socket);
		});

		socket.on("make table", function(name) {
			var code = createTable(socket, name);
			joinTable(socket, code, name);
		});

		socket.on("join table", function(code, name) {
			joinTable(socket, code, name);
		});

		socket.on("leave table", function() {
			leaveTable(socket);
		});

		socket.on("do move", function(held) {
			processMove(socket, held);
		});

		socket.on("clear move", function() {
			clearMove(socket);
		});

		socket.on("advance round", function() {
			advanceRound(socket);
		});

		////////////////////////////////////

		socket.on("play card", function(index) {
			playCard(socket, index);
		});

		socket.on("leave match", function() {
			leaveMatch(socket);
		});

		socket.on("request cards update", function() {
			updateCardsRequested(socket);
		});

		socket.on("request rematch", function() {
			rematchRequested(socket);
		});
	});
	return io;
};

//////////  Functions  \\\\\\\\\\
function createTable(socket, name) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var table = {
		code: createTableCode(),
		players: [],
		pot: 0,
		inGame: false,
		inRound: false,
		settings: {
			tokenGoal: 5,
			startPot: 1,
			roundInc: 2,
			roundMin: 3,
			roundMax: 7,
			wilds: [],
			qakaj: true,
			five_of_a_kind: true,
		},
		ledger: [],
	};
	tables.push(table);
	return table.code;
}

function joinTable(socket, code, name) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerById(socket.id);
	if (!player) {
		player.socket.emit("server error", "Invalid connection to server!");
		return false;
	}
	var table = getTableByCode(code);
	if (!table) {
		player.socket.emit("server error", "Table " + code + " not found!");
		return false;
	}
	if (table.players.length === playerColors.length) {
		player.socket.emit("server error", "Room " + code + " full!");
		return false;
	}
	// TODO: error checking, name collisions, etc.
	player.moved = false;
	table.players.push({
		id: socket.id,
		name: name,
		tokens: 0,
		money: 0,
		color: getAvailableColor(table),
		held: false,
		moved: false,
	});
	table.ledger.push({
		name: name,
		money: 0,
	})
	updateTable(table);
}

function getAvailableColor(table) {
	for (var color of playerColors) {
		var found = false;
		for (var player of table.players) {
			if (color === player.color) {
				found = true;
				break;
			}
		}
		if (!found) {
			return color;
		}
	}
}

function updateTable(table) {
	if (table.players.length > 0) {
		// Update players
		for (var i = 0; i < table.players.length; i++) {
			var player = getPlayerById(table.players[i].id);
			player.socket.emit("update table", table);
		}
	} else {
		// Delete table.
		var index = tables.indexOf(table);
		tables.splice(index, 1);
	}
}

function leaveTable(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var table = getTableBySocketId(socket.id);
	if (table) {
		if (table.inGame) {
			// Handle game exit
		} else {
			// Remove player.
			for (var i = 0; i < table.players.length; i++) {
				if (table.players[i].id === socket.id) {
					// Remove from ledger if zero balance.
					for (var j = 0; j < table.ledger.length; j++) {
						if (table.ledger[j].name === table.players[i].name && table.ledger[j].money === 0) {
							table.ledger.splice(j, 1);
						}
					}
					table.players.splice(i, 1);
					break;
				}
			}
		}
		// Update remaining players.
		updateTable(table);
	}
}

function advanceRound(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	updateMoved(socket, true);
}

function doAdvanceRound(table) {
	// If all players have requested to move, advance the round.
	for (var tablePlayer of table.players) {
		var player = getPlayerById(tablePlayer.id);
		if (!player) {
			continue;
		}
		// If any players haven't requested to deal yet, wait.
		if (!player.moved) {
			updateTable(table);
			return;
		}
	}
	if (table.inRound) {
		return processRound(table);
	}
	for (var tablePlayer of table.players) {
		var player = getPlayerById(tablePlayer.id);
		if (!player) {
			continue;
		}
		// Await player moves.
		player.moved = false;
		tablePlayer.moved = false;
	}
	if (table.inGame) {
		var game = getGameByCode(table.code);
		game.round += table.settings.roundInc;
		if (game.round > table.settings.roundMax) {
			game.round = table.settings.roundMin;
		}
		table.inRound = true;
		table.settings.wilds = [game.round.toString()];
	} else {
		if (table.players.length < 2) {
			// TODO send error message to player.
			return;
		}
		for (var player of table.players) {
			player.tokens = 0;
		}
		// Game holds things we do not want to send to players, e.g. the deck.
		var game = {
			tableCode: table.code,
			round: table.settings.roundMin,
		};
		games.push(game);
		table.inGame = true;
		table.inRound = true;
		table.pot = table.settings.startPot;
	}
	table.settings.wilds = [game.round.toString()];
	dealRound(table, game);
	updateTable(table);
}


function processMove(socket, held) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerById(socket.id);
	if (!player) { return; }
	player.held = held;
	updateMoved(socket, true, player);
}

function clearMove(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	updateMoved(socket, false);
}

function updateMoved(socket, moved, player) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = player ? player : getPlayerById(socket.id);
	if (!player) { return; }
	player.moved = moved;
	var table = getTableBySocketId(socket.id);
	var tablePlayer = getTablePlayerById(socket.id, table);
	tablePlayer.moved = moved;
	doAdvanceRound(table);
}

function processRound(table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// Get list of players who held.
	holdingPlayers = []
	for (var tablePlayer of table.players) {
		var player = getPlayerById(tablePlayer.id);
		if (!player) {
			continue;
		}
		if (player.held) {
			holdingPlayers.push(player);
		}
		// Mark table player as holding or not, to signal to clients.
		tablePlayer.held = player.held;
	}
	// Show players who held each others' hands
	for (var holder1 of holdingPlayers) {
		for (var holder2 of holdingPlayers) {
			holder1.socket.emit("update hand", holder2.socket.id, holder2.hand);
		}
	}
	// Check for wins and update table state.
	var message;
	if (holdingPlayers.length === 0) {
		message = "No Hold!";
	} else if (holdingPlayers.length === 1) {
		// Award single holding player a token.
		tablePlayer = getTablePlayerById(holdingPlayers[0].socket.id, table);
		message = tablePlayer.name + " wins a token!";
		tablePlayer.tokens += 1;
		if (tablePlayer.tokens === table.settings.tokenGoal) {
			return handleGameEnd(table, tablePlayer);
		}
	} else {
		// Compare hands to find winner, and adjust money.
		var results = getWinner(holdingPlayers, table.settings);
		var holderNames = [];
		var winnerNames = [];
		for (var tablePlayer of table.players) {
			var player = getPlayerById(tablePlayer.id);
			if (player.held) {
				holderNames.push(tablePlayer.name);
				if (results.winners.includes(tablePlayer.id)) {
					winnerNames.push(tablePlayer.name);
					tablePlayer.money += table.pot * (holdingPlayers.length - results.winners.length) / results.winners.length;
				} else {
					tablePlayer.money -= table.pot * 2;
				}
			}
		}
		// Special message for draw.
		if (results.winners.length === holdingPlayers.length) {
			var message = "It's a draw!";
		} else {
			var message = winnerNames.join(", ") + " won the hand.";
		}
		table.pot += table.pot * (holdingPlayers.length - results.winners.length);
	}
	// Update players for next round.
	table.inRound = false;
	for (var tablePlayer of table.players) {
		var player = getPlayerById(tablePlayer.id);
		if (!player) {
			continue;
		}
		// If more than one player held, wait to advance game, otherwise don't.
		player.moved = holdingPlayers.length > 1 ? !player.held : true;
		tablePlayer.moved = player.moved;
	}
	for (var tablePlayer of table.players) {
		var player = getPlayerById(tablePlayer.id);
		if (!player) {
			continue;
		}
		// Update player client.
		player.socket.emit("update table", table);
		player.socket.emit("round over", message);
	}
	// If no players held, auto-advance the round after a few seconds.
	if (holdingPlayers.length < 2) {
		setTimeout(doAdvanceRound.bind(null, table), 3000);
	}
}

function handleGameEnd(table, tablePlayer) {
	// TODO handle first game "ghost dollar"
	tablePlayer.money += table.pot - table.settings.startPot;
	table.inGame = false;
	table.inRound = false; 
	var message = tablePlayer.name + " wins!";
	for (var tablePlayer of table.players) {
		var player = getPlayerById(tablePlayer.id);
		if (!player) {
			continue;
		}
		// Reset for next game.
		player.moved = false;
		// Transfer money to debt sheet
		for (var l of table.ledger) {
			if (l.name === tablePlayer.name) {
				l.money += tablePlayer.money;
				break;
			}
		}
		tablePlayer.money = 0;
	}
	for (var tablePlayer of table.players) {
		// Update player client.
		player.socket.emit("update table", table);
		player.socket.emit("game over", message);
	}
}

function getTablePlayerById(playerId, table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (table && table.players) {
		for (var player of table.players) {
			if (player.id === playerId) {
				return player
			}
		}
	}
	return false;
}

function isTableOwner(playerId, table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	return table && table.players && table.players.length > 0 && table.players[0].id === playerId;
}

function dealRound(table, game) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (game.round === table.settings.roundMin) {
		game.deck = generateDeck();
	}
	for (var playerObject of table.players) {
		var player = getPlayerById(playerObject.id);
		if (game.round === table.settings.roundMin) {
			player.hand = [];
		}
		player.moved = false;
		deal(player.hand, game.deck, game.round);
		player.socket.emit("new round", player.hand);
	}
}

function playerDisconnected(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerById(socket.id);
	var index = players.indexOf(player);
	if (index > -1) {
		leaveTable(socket);
		players.splice(index, 1);
	}
}

function getPlayerById(socketId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < players.length; i++) {
		if (players[i].socket.id === socketId) {
			return players[i];
		}
	}
	return false;
}

function getTableByCode(code) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	code = code.toUpperCase();
	for (var i = 0; i < tables.length; i++) {
		if (tables[i].code === code) {
			return tables[i];
		}
	}
	return false;
}

function getGameByCode(code) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < games.length; i++) {
		if (games[i].tableCode === code) {
			return games[i];
		}
	}
	return false;
}

function getTableBySocketId(socketId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < tables.length; i++) {
		for (var j = 0; j < tables[i].players.length; j++) {
			if (tables[i].players[j].id === socketId) {
				return tables[i];
			}
		}
	}
	return false;
}

function createTableCode() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var code = "";
	// var charset = "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
	var charset = "A";
	do {
		code = ""
		for (var i = 0; i < 4; i++) {
			code += charset.charAt(Math.floor(Math.random() * charset.length));
		}
	} while (getTableByCode(code));
	return code;
}

function generateDeck() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	return Array.from(new Array(52), (x, i) => i);
}

function deal(hand, deck, round) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	while(hand.length < round) {
		hand.push(drawCard(deck));
	}
}

function drawCard(deck) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (!deck || deck.length === 0) {
		deck = generateDeck()
	}
	var cardIdx = deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
	return {
		value: values[cardIdx % 13],
		suit: suits[Math.floor(cardIdx / 13)],
	}
}
