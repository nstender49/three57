// This file starts the both the Express server, used to serve the actual webpage,
// and the Socket.io server, used to handle the the realtime connection to the client.

var express = require("express");
var session = require("express-session");
var app = express();
app.use(session({secret: "cookie secret"}));

var server = require("http").Server(app);
var io = require("./libs/game_manager").listen(server);  // Start Socket.io server and let game_manager handle those connections

app.set("port", (process.env.PORT || 3001));  // Use either given port or 3001 as default
app.use(express.static("public"));  // Staticly serve pages, using directory 'public' as root 

// User connects to server
app.get("/", function(req, res) {
	// Will serve static pages, no need to handle requests
});

// If any page not handled already handled (ie. doesn't exists)
app.get("*", function(req, res) {
	res.status(404).send("Error 404 - Page not found");
});

// Start http server
server.listen(app.get("port"), function() {
	console.log("Node app started on port %s", app.get("port"));
});
