// This file handles all socket.io connections and manages the serverside game logic.
var DEBUG = false;
//var DEBUG = true;

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

TABLE_LOBBY = "table lobby";
TABLE_GAME = "table game";
TABLE_ROUND = "table round";
TABLE_COUNT = "table count";

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

		socket.on("do move", function(moved, held) {
			processMove(socket, moved, held);
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
		state: TABLE_LOBBY,
		message: "Waiting for players to join...",
		settings: {
			tokenGoal: 5,
			startPot: 1,
			roundInc: 2,
			roundMin: 3,
			roundMax: 7,
			wilds: [],
			qakaj: true,
			five_of_a_kind: true,
			advanceSec: 3,
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
	if (table.state !== TABLE_LOBBY) {
		player.socket.emit("server error", "Table " + code + " game in progress!");
		return false;
	}
	for (var tablePlayer of table.players) {
		if (name === tablePlayer.name) {
			player.socket.emit("server error", "Player with name '" + name + "' already exists at table " + code);
			return false;
		}
	}
	// Add player to the table.
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
	if (table.state === TABLE_LOBBY && table.players.length > 1) {
		table.message = "Press Deal to Start!";
	}
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
	if (!table) { return false; }

	if (table.state !== TABLE_LOBBY) {
		player.socket.emit("server error", "Cannot leave table while a game is in progress!");
		return false;
	}
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
	if (table.players.length === 0) {
		// Delete game and table.
		var game = getGameByCode(table.code);
		if (game) {
			var index = games.indexOf(game);
			games.splice(index, 1);
		}
		var index = tables.indexOf(table);
		tables.splice(index, 1);
		table = false;

	} else {
		table.message = table.players.length === 1 ? "Waiting for other players to join..." : "Press Deal to Start!";
	}
	bouncePlayer(socket);
	// Update remaining players.
	updateTable(table);
}

///// client/server \\\\\

function processMove(socket, moved, held) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	if (!player) { return; }
	player.held = held;
	var table = getTableBySocketId(socket.id);
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);
	if (table.state !== TABLE_COUNT) {
		tablePlayer.moved = moved;
		advanceRound(table);
	}
}

function bouncePlayer(socket) {
	socket.emit("update table", false);
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
}

///// Game logic \\\\\


function advanceRound(table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// If all players have requested to move, advance the round.
	for (var tablePlayer of table.players) {
		// If any players haven't requested to deal yet, wait.
		if (!tablePlayer.moved) {
			updateTable(table);
			return;
		}
	}
	switch (table.state) {
		// Start game.
		case TABLE_LOBBY:
			clearMoves(table);
			handleNewGame(table);
			handleNewRound(table);
			table.state = TABLE_ROUND;
			break;
		// Move to next round.
		case TABLE_GAME:
			clearMoves(table);
			handleNewRound(table);
			table.state = TABLE_ROUND;
			break;
		// Start countdown.
		case TABLE_ROUND:
			table.state = TABLE_COUNT;
			for (var tablePlayer of table.players) {
				var player = getPlayerBySessionId(tablePlayer.sessionId);
				if (player) {
					player.socket.emit("play countdown");
				}
			}
			table.message = "1...";
			setTimeout(doCountdown.bind(null, table, 2), 1000);
			break;
		case TABLE_COUNT:
			var gameOver = processRound(table);
			table.state = gameOver ? TABLE_LOBBY : TABLE_GAME;
			break;
	}	
	updateTable(table);
}

function handleNewGame(table) {
	if (table.players.length < 2) {
		// TODO send error message to player?
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
	// NOTE: we deal a round immediately after making a game, so this rolls over to next round.
	game.round = table.settings.roundMax;
	table.pot = table.settings.startPot;
	table.message = "Press Deal to Start!";
}

function handleNewRound(table) {
	var game = getGameByCode(table.code);
	game.round += table.settings.roundInc;
	if (game.round > table.settings.roundMax) {
		game.round = table.settings.roundMin;
	}
	table.settings.wilds = [game.round.toString()];
	dealRound(table, game);
	table.message = "Choose to Hold or Drop";
}

function doCountdown(table, count) {
	if (count <= 3) {
		table.message += count + "...";
		setTimeout(doCountdown.bind(null, table, count + 1), 1000);
	} else {
		table.message += "Drop!";
		setTimeout(advanceRound.bind(null, table), 100);
	}
	updateTable(table);
}

function clearMoves(table) {
	for (var tablePlayer of table.players) {
		tablePlayer.moved = false;
	}
}

function processRound(table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// Get list of players who held.
	var holdingPlayers = getHoldingPlayers(table);
	var gameOver = false;
	if (holdingPlayers.length === 0) {
		table.message = "No Hold!";
	} else if (holdingPlayers.length === 1) {
		gameOver = handleToken(table, holdingPlayers[0].sessionId);
	} else {
		handleContest(table, holdingPlayers);
	}
	// Update players for next round.
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (!player) {
			continue;
		}
		// If more than one player held, wait to advance game, otherwise don't.
		tablePlayer.moved = gameOver ? false : (holdingPlayers.length > 1 ? !player.held : true);
	}
	// If no players held, auto-advance the round after a few seconds.
	if (!gameOver && holdingPlayers.length < 2) {
		setTimeout(advanceRound.bind(null, table), 1000 * table.settings.advanceSec);
	}
	return gameOver;
}

function getHoldingPlayers(table) {
	var holdingPlayers = []
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
			holder1.socket.emit("update hand", holder2.sessionId, holder2.hand);
		}
	}
	return holdingPlayers;
}

function handleToken(table, holderSessionId) {
	// Award single holding player a token.
	tablePlayer = getTablePlayerBySessionId(holderSessionId, table);
	table.message = tablePlayer.name + " wins a token!";
	tablePlayer.tokens += 1;
	if (tablePlayer.tokens < table.settings.tokenGoal) {
		return false;
	}
	// Handle game end.
	tablePlayer.money += table.pot - table.settings.startPot;
	table.message = tablePlayer.name + " wins!";
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (!player) {
			continue;
		}
		// Transfer money to debt sheet
		for (var l of table.ledger) {
			if (l.name === tablePlayer.name) {
				l.money += tablePlayer.money;
				break;
			}
		}
		tablePlayer.money = 0;
	}
	return true;
}

function handleContest(table, holdingPlayers) {
	// Compare hands to find winner, and adjust money.
	var results = getWinner(holdingPlayers, table.settings);
	var winnerNames = [];
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (player.held) {
			if (results.winners.includes(tablePlayer.sessionId)) {
				winnerNames.push(tablePlayer.name);
				tablePlayer.money += table.pot * (holdingPlayers.length - results.winners.length) / results.winners.length;
			} else {
				tablePlayer.money -= table.pot * 2;
			}
		}
	}
	if (results.winners.length === holdingPlayers.length) {
		table.message = "It's a draw!";
	} else {
		table.message = winnerNames.join(", ") + " won the hand.";
	}
	table.pot += table.pot * (holdingPlayers.length - results.winners.length);
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
		deal(player.hand, game.deck, game.round);
		player.socket.emit("update hand", player.sessionId, player.hand, true);
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
	console.log(cookie.parse(socket.request.headers.cookie)["connect.sid"]);
	var sessionId = DEBUG ? socket.id : cookie.parse(socket.request.headers.cookie)["connect.sid"];
	console.log("SESSION ID: " + sessionId); 
	var player = getPlayerBySessionId(sessionId);
	if (player) {
		socket.emit("server error", "Session for player already exists, you cheater!");
		player.socket.emit("server error", "Session detected in another tab, please don't do that.");
		return;
	}
	player = getInactiveBySessionId(sessionId);
	if (player) {
		players.push(player);
		console.log("FOUND INACTIVE PLAYER! " + sessionId); 
		var index = inactive.indexOf(player);
		if (index > -1) {
			inactive.splice(index, 1);
		}
		player.socket = socket;
		if (player.tableCode) {
			console.log("PLAYER HAS A TABLE CODE! " + sessionId);
			var table = getTableByCode(player.tableCode);
			if (table) {
				console.log("PLAYER'S TABLE (" + player.tableCode + ") EXISTS! " + sessionId);
				var tablePlayer = getTablePlayerBySessionId(sessionId, table);
				tablePlayer.socketId = socket.id;
				tablePlayer.inactive = false;
				console.log("SENDING PLAYER HANDS! with session: " + player.sessionId + " HAND: " + player.hand);
				// Send player their hand, and hands of other players if in the middle of a game.
				player.socket.emit("update hand", player.sessionId, player.hand);
				if (table.state === table.IN_GAME) {
					getHoldingPlayers(table);
				}
				updateTable(table);
			} else {
				console.log("PLAYER'S TABLE DOES NOT EXIST, REMOVING");
				player.tableCode = undefined;
				bouncePlayer(socket);
			}
		} else {
			bouncePlayer(socket);
		}
	} else {
		console.log("ADDING NEW PLAYER FOR " + sessionId);
		players.push({
			socket: socket,
			sessionId: sessionId,
			hand: [],
			held: false,
			tableCode: undefined,
		});
		bouncePlayer(socket);
	}
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
		// TODO: set timer to remove room if all players are inactive.
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