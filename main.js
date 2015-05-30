/*************************************
//
// dot-game app
//
**************************************/

// express magic
var express = require('express');
var app = express();
var server = require('http').createServer(app)
var io = require('socket.io').listen(server);
var device  = require('express-device');

/**
 * Store all running game and player details
 * @type {Array}
 */
var games = {};

app.configure(function(){
    // I need to access everything in '/public' directly
    app.use(express.static(__dirname + '/public'));

    //set the view engine
    app.set('view engine', 'ejs');
    app.set('views', __dirname +'/views');

    app.use(device.capture());
});


// logs every request
app.use(function(req, res, next){
    // output every request in the array
    console.log({method:req.method, url: req.url, device: req.device});

    // goes onto the next function in line
    next();
});

app.get("/", function(req, res){
    res.render('index', {});
});

io.sockets.on('connection', function (socket) {
    var playerName = socket.handshake.query.playerName;

    /**
     * A player joins the game
     */
    socket.on('join game', function(data) {
        var room = data.token;
        socket.join(room);

        console.log('join game request with token', data.token);

        if (!games[room]) {
            // create a new game
            var player = {
                socket: socket,
                name: playerName
            };

            var game = {
                players: [player],
                status: 'waiting',
                createTime: Date.now(),
                room: room
            };

            games[room] = game;
        } else if (games[room].players.length === 1) {
            // join the existing game

            var player = {
                socket: socket,
                name: playerName
            };

            games[room].players.push(player);

            games[room].status = 'ready';

            var players = games[room].players;
            // emit message to start game
            io.sockets.in(room).emit('start',
                {players: [{name: players[0].name, move: true},
                           {name: players[1].name, move: false}]});

        } else {
            // already 2 players playing !!
            // socket.emit('full');
        }
    });

    socket.on('move', function(data, fn){
        io.sockets.in(data.token).emit('move', data.move);
        // io.sockets.emit('move', data);

        // fn();//call the client back to clear out the field
    });

    socket.on('disconnect', function () {
        var room, game, player;
        var playerRoom;
        var i;

        for (room in games) {
            game = games[room];

            for (i = 0; i < game.players.length; i++) {
                player = game.players[i]
                if (player.socket === socket) {
                    playerRoom = room;
                    break;
                }
            }
        }

        if (playerRoom) {
            var playerGame = games[playerRoom];

            io.sockets.in(playerRoom).emit('user disconnected');

            for (i = 0; i < playerGame.players.length; i++) {
                playerGame.players[i].socket.leave(playerRoom);
            }
        }

        delete games[playerRoom];

    });

});

module.exports = server;
