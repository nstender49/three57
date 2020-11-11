// This file handles all socket.io connections and manages the serverside game logic.
var DEBUG = false;
// var DEBUG = true;

var socketio = require("socket.io");
var cookie = require("cookie");

var getWinner = require("./hand_comparison").getWinner;

var players = [];
var inactive = [];
var tables = [];
var games = [];

var values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
var suits = ["C", "D", "H", "S"];
var playerColors = ["BLUE", "GREEN", "GREY", "PURPLE", "RED", "YELLOW", "BLU", "GREE", "GRE"];

var logFull = true;

//////////  Socket.io  \\\\\\\\\\
module.exports.listen = function(app) {
	io = socketio.listen(app);

	io.on("connection", function(socket) {
		if (!socket.request.headers.cookie) {
			socket.emit("server error", "No cookie!");
			return false;
		}
		
		handleNewConnection(socket);

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

///// Lobby \\\\\

function createTable() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var table = {
		code: createTableCode(),
		players: [],
		pot: 0,
		inGame: false,
		inRound: false,
		inCount: false,
		settings: {
			tokenGoal: 5,
			startPot: 1,
			roundInc: 2,
			roundMin: 3,
			roundMax: 7,
			wilds: [],
			qakaj: true,
			five_of_a_kind: true,
			advanceSec: 1,
		},
		ledger: [],
	};
	tables.push(table);
	return table.code;
}

function joinTable(socket, code, name) {
	console.log(`JOIN TABLE ${socket.id} ${code} ${name}`);
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	// Check for errors
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
		player.socket.emit("server error", "Table " + code + " full!");
		return false;
	}
	for (var tablePlayer of table.players) {
		if (name === tablePlayer.name) {
			player.socket.emit("server error", "Player with name '" + name + "' already exists at table " + code);
			return false;
		}
	}
	player.moved = false;
	player.tableCode = code;
	console.log(`ADDING PLAYER WITH SESSIONID ${player.sessionId} AND SOCKETID ${player.socket.id}`)
	table.players.push({
		sessionId: player.sessionId,
		socketId: player.socket.id,
		name: name,
		tokens: 0,
		money: 0,
		color: getAvailableColor(table),
		held: false,
		moved: false,
		inactive: false,
	});
	// NOTE: sockets don't like associative arrays :(
	var onLedger = false;
	for (var l of table.ledger) {
		if (l.name === name) {
			onLedger = true;
			break;
		}
	}
	if (!onLedger) {
		table.ledger.push({
			name: name,
			money: 0,
		})
	}
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

function leaveTable(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var table = getTableBySocketId(socket.id);
	if (table) {
		// Remove player.
		for (var i = 0; i < table.players.length; i++) {
			if (table.players[i].socketId === socket.id) {
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
		// Update remaining players.
		updateTable(table);
	}
}

///// client/server \\\\\

function processMove(socket, held) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	if (!player) { return; }
	player.held = held;
	updateMoved(socket, true, player);
}

function clearMove(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	updateMoved(socket, false);
}

function advanceRound(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	updateMoved(socket, true);
}

function updateMoved(socket, moved, player) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = player ? player : getPlayerBySocketId(socket.id);
	if (!player) { return; }
	var table = getTableBySocketId(socket.id);
	var tablePlayer = getTablePlayerBySessionId(socket.id, table);
	if (!table.inCount) {
		player.moved = moved;
		tablePlayer.moved = moved;
		doAdvanceRound(table);
	}
}

function updateTable(table) {
	console.log("UPDATING TABLE: " + table.code);
	for (var tablePlayer of table.players) {
		console.log("UPDATING TABLE PLAYER: " + tablePlayer.name + " FOR TABLE: " + table.code);
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (player) {
			console.log("FOUND AN ACTIVE PLAYER TO UPDATE FOR " + tablePlayer.name + " (" + tablePlayer.sessionId + ") AT TABLE " + table.code);
			player.socket.emit("update table", table);
		} else {
			console.log("DID NOT FIND AN ACTIVE PLAYER FOR PLAYER " + tablePlayer.name + " (" + tablePlayer.sessionId + ") AT TABLE " + table.code);
		}
	}
	if (table.players.length === 0) {
		// Delete table.
		var index = tables.indexOf(table);
		tables.splice(index, 1);
	}
}

///// Game logic \\\\\

function startCount(table){
	table.inCount = true;
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		player.socket.emit("start count");
	}
	updateTable(table);
	setTimeout(processRound.bind(null, table), 3500);
}

function doAdvanceRound(table) {
	// If all players have requested to move, advance the round.
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
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
		return startCount(table);
	}
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
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
		var game = getGameByCode(table.code);
		if (!game) {
			game = {};
			games.push(game);
		}
		game.tableCode = table.code,
		game.round = table.settings.roundMin,

		table.inGame = true;
		table.inRound = true;
		table.pot = table.settings.startPot;
	}
	table.settings.wilds = [game.round.toString()];
	dealRound(table, game);
	updateTable(table);
}

function processRound(table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// Get list of players who held.
	holdingPlayers = []
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
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
		tablePlayer = getTablePlayerBySessionId(holdingPlayers[0].sessionId, table);
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
			var player = getPlayerBySessionId(tablePlayer.sessionId);
			if (player.held) {
				holderNames.push(tablePlayer.name);
				if (results.winners.includes(tablePlayer.sessionId)) {
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
	table.inCount = false;
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (!player) {
			continue;
		}
		// If more than one player held, wait to advance game, otherwise don't.
		player.moved = holdingPlayers.length > 1 ? !player.held : true;
		tablePlayer.moved = player.moved;
	}
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (!player) {
			continue;
		}
		// Update player client.
		player.socket.emit("update table", table);
		player.socket.emit("round over", message);
	}
	// If no players held, auto-advance the round after a few seconds.
	if (holdingPlayers.length < 2) {
		setTimeout(doAdvanceRound.bind(null, table), 3000 * table.settings.advanceSec);
	}
}

function handleGameEnd(table, tablePlayer) {
	// TODO handle first game "ghost dollar"
	tablePlayer.money += table.pot - table.settings.startPot;
	table.inGame = false;
	table.inRound = false; 
	table.inCount = false;
	var message = tablePlayer.name + " wins!";
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
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
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (!player) {
			continue;
		}
		player.socket.emit("update table", table);
		player.socket.emit("game over", message);
	}
}

function generateDeck() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	return Array.from(new Array(52), (x, i) => i);
}

function dealRound(table, game) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (game.round === table.settings.roundMin) {
		game.deck = generateDeck();
	}
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (game.round === table.settings.roundMin) {
			player.hand = [];
		}
		player.moved = false;
		deal(player.hand, game.deck, game.round);
		player.socket.emit("new round", player.hand);
	}
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

///// Utility functions \\\\\

function getTablePlayerBySessionId(sessionId, table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (table && table.players) {
		for (var player of table.players) {
			if (player.sessionId === sessionId) {
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

function handleNewConnection(socket, sessionId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	console.log("NEW CONNECTION");
	console.log(socket.request.headers.cookie);
	console.log(cookie.parse(socket.request.headers.cookie));
	console.log(cookie.parse(socket.request.headers.cookie)["sid"]);
	var sessionId = DEBUG ? socket.id : cookie.parse(socket.request.headers.cookie)["sid"];
	console.log("SESSION ID: " + sessionId);
	var player = getInactiveBySessionId(sessionId);
	if (player) {
		console.log("FOUND INACTIVE PLAYER! " + sessionId); 
		var index = inactive.indexOf(player);
		if (index > -1) {
			inactive.splice(index, 1);
		}
		player.moved = false;
		player.socket = socket;
		players.push(player);
		if (player.tableCode) {
			console.log("PLAYER HAS A TABLE CODE! " + sessionId);
			var table = getTableByCode(player.tableCode);
			if (table) {
				console.log("PLAYER'S TABLE (" + player.tableCode + ") EXISTS! " + sessionId);
				var tablePlayer = getTablePlayerBySessionId(sessionId, table);
				tablePlayer.socketId = socket.id;
				updateTable(table);
			} else {
				console.log("PLAYER'S TABLE DOES NOT EXIST, REMOVING");
				player.tableCode = undefined;
			}
		}
	} else {
		console.log("ADDING NEW PLAYER FOR " + sessionId);
		players.push({
			socket: socket,
			sessionId: sessionId,
			hand: [],
			held: false,
			moved: false,
			tableCode: undefined,
		});
	}
	return true;
}

function playerDisconnected(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	var index = players.indexOf(player);
	if (index > -1) {
		players.splice(index, 1);
	}
	var table = getTableBySocketId(socket.id);
	if (table) {
		var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);
		tablePlayer.inactive = true;
		updateTable(table);
	}
	player.socket = undefined;
	inactive.push(player);
}

function getPlayerBySocketId(socketId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < players.length; i++) {
		if (players[i].socket.id === socketId) {
			return players[i];
		}
	}
	return false;
}

function getPlayerBySessionId(sessionId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < players.length; i++) {
		if (players[i].sessionId === sessionId) {
			return players[i];
		}
	}
	return false;
}

function getInactiveBySessionId(sessionId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < inactive.length; i++) {
		if (inactive[i].sessionId === sessionId) {
			return inactive[i];
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
			if (tables[i].players[j].socketId === socketId) {
				return tables[i];
			}
		}
	}
	return false;
}

function createTableCode() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var code = "";
	var charset = "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
	if (DEBUG) {
		var charset = "A";
	}
	do {
		code = ""
		for (var i = 0; i < 4; i++) {
			code += charset.charAt(Math.floor(Math.random() * charset.length));
		}
	} while (getTableByCode(code));
	return code;
}