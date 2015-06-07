(function() {
    /**
     * Copyright 2013 Vishal Kumar
     *
     * @desc: Main Javascript file for the game. Deals with loading and rendering of
     * game to functioning

     * @author: Vishal Kumar
     * E-mail: vishal.rgiit@gmail.com
     * Github: vishalok12
     */

    'use strict';

    window.vApp = {
        levels: [
            'data/level1.json'
        ]
    };

    var paddingYForDotMap = 130;


    var socket;

    function initialize() {
        var userName = getUserName();

        if (!userName) {
            var inputWrapper = document.getElementById('input-wrapper');

            document.getElementById('submit-btn').onclick = function() {
                var inputValue = document.getElementById('user-name').value;

                if (inputValue) {
                    inputValue = inputValue.slice(0, 1).toUpperCase()
                        + inputValue.slice(1).toLowerCase();
                    setUserName(inputValue);
                    inputWrapper.style.display = 'none';
                    overlay.style.display = 'none';
                    vApp.userName = inputValue;

                    // join game
                    joinGame();
                }
            };

            // show user input to insert user name
            inputWrapper.style.display = 'block';
            overlay.style.display = 'block';

        } else {
            vApp.userName = userName;

            // join game
            joinGame();
        }

        addCustomFunctions();
        var canvas = document.getElementById('game-area');
        vApp.context = canvas.getContext('2d');
        vApp.dotDistance = 45;  // pixel distance between two neighbour dots
        vApp.vertexRadius = 5;  // the radius of the circle(vertex)
        vApp.level = 1;                 // game level
        vApp.score = 0;                 // score of the user
        vApp.opponentScore = 0;                 // score of opponent user
        vApp.WIDTH = canvas.width;
        vApp.HEIGHT = canvas.height;
        vApp.gameLevel = 'hard';
        vApp.gameStarted = false;
        vApp.moveEnabled = false;

        loadLevel(vApp.level);
        bindElements();
        bindCanvas();

        var client = new ZeroClipboard( document.getElementById("copy-button") );
    }

    function joinGame() {
        socket = io.connect('http://' + window.location.host, {query: "playerName=" + vApp.userName});

        bindSockets();

        var token = getParameterByName('gameid');

        if (!token) {
            // create a new game
            token = createRandomToken();

            document.getElementsByClassName('opponent-game-link')[0].value = location.href + '?gameid=' + token;
            document.getElementById('copy-button').setAttribute('data-clipboard-text', location.href + '?gameid=' + token);

            document.getElementById('overlay').style.display = 'block';
            document.getElementById('game-link').style.display = 'block';

            console.log('send opponent this link: ' + location.href + '?gameid=' + token);
        }

        vApp.token = token;

        socket.emit('join game', {token: token}, function(playerId) {
            vApp.currentGamePlayerId = playerId;
        });
    }

    // taken from stack overflow
    function getParameterByName(name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    function createRandomToken() {
      function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
      }
      return s4() + s4();
    }

    function getUserName() {
        return window.localStorage.getItem('name');
    }

    function setUserName(name) {
        name = name.slice(0, 1).toUpperCase() + name.slice(1).toLowerCase();
        window.localStorage.setItem('name', name);
    }

    function canMove() {
        return vApp.gameStarted && vApp.moveEnabled;
    }

    function bindSockets() {

        socket.on('move', paintUserMove);

        // socket.on('start', startGame);

        socket.on('start', startGame);
        socket.on('user disconnected', informUserDisconnected);
    }

    function startGame(data) {
        vApp.gameStarted = true;

        document.getElementById('overlay').style.display = 'none';
        document.getElementById('game-link').style.display = 'none';

        var opponent = data.players.filter(function(player) {
            return player.id !== vApp.currentGamePlayerId;
        })[0];

        vApp.opponentName = opponent.name;
        vApp.moveEnabled = opponent.move ? false : true;

        vApp.level = 1;                 // game level
        vApp.score = 0;                 // score of the user
        vApp.opponentScore = 0;                 // score of opponent user

        loadLevel(vApp.level);

        alert('Game started!!');
    }

    function informUserDisconnected() {
        alert('Opponent Left!');

        document.getElementById('overlay').style.display = 'block';
        document.getElementById('game-over').style.display = 'block';
    }

    function paintUserMove(data) {
        if(data && data.sourceIndex && data.destIndex) {
            console.log(data);

            var acquiredBlocks = vApp.blockGraph.addToBlockData(
                data.sourceIndex,
                data.destIndex
            );
            if (acquiredBlocks > 0) {
                if (vApp.moveEnabled) {
                    vApp.score += acquiredBlocks;
                    console.log('user has acquired a block');
                } else {
                    vApp.opponentScore += acquiredBlocks;
                    console.log('opponent has acquired a block');
                }
            } else {
                vApp.moveEnabled = !vApp.moveEnabled;
            }

            drawGraph(vApp.dotMap);

        } else {
            console.log("Some issue with socket message:", data);
        }
    }

    function sendMoveToServer(sourceIndex, destIndex) {
        socket.emit('move', {
            move: {sourceIndex: sourceIndex, destIndex: destIndex},
            token: vApp.token
        });
    }

    /**
     * loads all the files for the specified level and display the level
     * @param {Integer} level
     */
    function loadLevel(level) {
        var levelIndex = level - 1; // starts from 0
        if (!vApp.levels[levelIndex]) {
            // level not present
            return false;
        }

        loadJSON(vApp.levels[levelIndex], function(dotMap) {
            vApp.dotMap = dotMap;                           // the 2d array, 1 represents vertex
            vApp.blockGraph = new vBlockGraph(dotMap);  // info for each square (made by dots)
            drawGraph(dotMap);
        });

        return true;
    }

    /**
     * paints the canvas
     * @param {Array.<Array.<Boolean>>} dotMap
     */
    function drawGraph(dotMap) {
        var row, coln;
        var ctx = vApp.context;
        var index;

        ctx.clearRect(0, 0, vApp.WIDTH, vApp.HEIGHT);
        ctx.save();
        ctx.translate(5, 5);

        // draw the acquired blocks
        var blocks = _.flatten(vApp.blockGraph.blocks);
        for (index = 0; index < blocks.length; index++) {
            if (blocks[index].acquired()) {
                ctx.save();
                colorBlock(blocks[index]);
                ctx.restore();
            }
        }

        for (row = 0; row < dotMap.length; row++) {
            for (coln = 0; coln < dotMap[row].length; coln++) {
                ctx.save();
                var posX = vApp.dotDistance * coln;
                var posY = paddingYForDotMap + vApp.dotDistance * row;
                var lineColor;

                ctx.translate(posX, posY);

                if ( dotMap[row][coln + 1] ) {
                    // draw horizontal line in a row from point coln to coln + 1
                    lineColor = getLineColor(row, coln, row, coln + 1);
                    drawLine(vApp.dotDistance, 0, lineColor);
                }

                if ( dotMap[row + 1] ) {
                    // draw vertical line in a column from point row to row + 1
                    lineColor = getLineColor(row, coln, row + 1, coln);
                    drawLine(0, vApp.dotDistance, lineColor);
                }

                // draw a tiny circle to represent the vertex
                drawVertex(5);

                ctx.restore();
            }
        }
        writeScore();
        ctx.restore();
    }

    function colorBlock(block) {
        var dotDistance = vApp.dotDistance;
        var x = block._column * dotDistance;
        var y = block._row * dotDistance + paddingYForDotMap;
        var ctx = vApp.context;
        var fontSize = 24;
        var blockOwner;

        if (block.get('userAcquired')) {
            ctx.fillStyle = 'rgb(61, 113, 192)';
            blockOwner = vApp.userName;
        } else {
            ctx.fillStyle = 'rgb(218, 76, 76)';
            blockOwner = vApp.opponentName;
        }
        ctx.fillRect(x, y, dotDistance, dotDistance);

        ctx.font = "bold " + fontSize + "px ubuntu";
        ctx.fillStyle = '#3c3c3c';
        ctx.fillText(blockOwner[0], x + (dotDistance - fontSize + 5) / 2, y + (dotDistance + fontSize - 5)/ 2);
    }

    function getLineColor(row1, coln1, row2, coln2) {
        if (vApp.blockGraph.isEdgeSelected(row1, coln1, row2, coln2)) {
            var lastTurn = vApp.lastTurn;
            if (lastTurn && _.isEqual(lastTurn.sourceIndex, {row: row1, column: coln1}) &&
                    _.isEqual(lastTurn.destIndex, {row: row2, column: coln2})) {
                // return 'rgb(67,156,234)';
                return 'rgb(255,50,50)';
            } else {
                return 'rgb(115, 152, 185)';
            }
        } else {
            return 'rgba(115, 152, 185, 0.1)';
        }
    }

    function drawLine(x, y, strokeStyle) {
        var ctx = vApp.context;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(x, y);
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    function drawVertex(radius) {
        var ctx = vApp.context;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.arc(0, 0, radius, 0, 2 * Math.PI, true);
        ctx.fill();
    }

    /**
     * paint the score of the players in canvas
     */
    function writeScore() {
        var xPos = vApp.moveEnabled ? 5 : 90;
        var yPos = 10;
        var ctx = vApp.context;

        ctx.font = "bold 16px ubuntu";
        ctx.fillStyle = '#D02222';
        ctx.fillText("*", xPos, yPos);

        ctx.fillStyle = '#dddddd';
        ctx.fillText( "You: " + vApp.score, 15, yPos);
        ctx.fillText(vApp.opponentName + ": " + vApp.opponentScore, 100, yPos);
    }

    /**
     * used for loading the level information
     * @param {String} src URL of the JSON file
     * @param {Function|undefined} callback
     */
    function loadJSON(src, callback) {
        var req = new XMLHttpRequest();
        req.open('GET', src, true);
        req.responseType = 'text';
        req.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status == 200) {
                    callback(JSON.parse(this.responseText));
                } else {    //Error in finding the file
                    console.error("File not found");
                }
            }
        }
        req.send();
    }

    function bindElements() {
        document.getElementById('game-start-btn').addEventListener('click', function() {
            window.location = 'http://' + window.location.host;
        });
    }

    function bindCanvas() {
        var canvas = document.getElementById('game-area');

        canvas.addEventListener('touchstart', getSourcePoint, false);
        canvas.addEventListener('mousedown', getSourcePoint, false);

        canvas.addEventListener('touchmove', drawMoveAnimation, false);
        canvas.addEventListener('mousemove', drawMoveAnimation, false);

        canvas.addEventListener('touchend', getSelectedEdge, false);
        canvas.addEventListener('mouseup', getSelectedEdge, false);
    }

    function getSelectedEdge(e) {
        var canvas = document.getElementById('game-area');

        if (!vApp.dragEvent || !canMove()) { return; }

        vApp.dragEvent = false;
        var ctx = vApp.context;
        e.stopPropagation();
        e.preventDefault();

        cancelAnimationFrame(vApp.requestId);   // don't paint the mousemove frame request

        // check for an edge selection
        var rect = canvas.getBoundingClientRect();
        var clickX = (e.clientX || e.changedTouches[0].clientX) - rect.left;
        var clickY = (e.clientY || e.changedTouches[0].clientY) - rect.top;

        var adjustedX = clickX - vApp.vertexRadius;
        var adjustedY = clickY - vApp.vertexRadius;

        var dragDest = getVertexClicked(adjustedX, adjustedY);
        if (dragDest) {
            var sourceIndex = dotCoordInIndex(vApp.dragSource);
            var destIndex = dotCoordInIndex(dragDest);
            var edgeSelected = vApp.blockGraph.isEdgeSelected(sourceIndex, destIndex);
            if (isNeighbour(sourceIndex, destIndex) && !edgeSelected) {
                sendMoveToServer(sourceIndex, destIndex);
            }
        }

        drawGraph(vApp.dotMap);
    }

    function drawMoveAnimation(e) {
        var canvas = document.getElementById('game-area');

        var ctx = vApp.context;
        e.stopPropagation();
        e.preventDefault();

        if (!vApp.dragEvent || !canMove()) { return; }

        var rect = canvas.getBoundingClientRect();
        var xMove = (e.clientX || e.targetTouches[0].clientX) - rect.left;
        var yMove = (e.clientY || e.targetTouches[0].clientY) - rect.top;

        var dragSource = vApp.dragSource;

        // request for animation frame only if the previous one has been executed
        if (!vApp.requestedFrame) {
            vApp.requestedFrame = true;
            vApp.requestId = window.requestAnimationFrame(function() {
                drawGraph(vApp.dotMap);     // paints the dot graph
                ctx.save();
                ctx.translate(dragSource.x, dragSource.y);
                // paint the line which user is currently stretching
                drawLine(
                    xMove - vApp.dragSource.x,
                    yMove - vApp.dragSource.y,
                    'rgb(115, 152, 185)'
                );
                ctx.restore();
                vApp.requestedFrame = false;
            });
        }
    }

    function getSourcePoint(e) {
        var canvas = document.getElementById('game-area');

        e.stopPropagation();
        e.preventDefault();

        if (!canMove()) { return; }

        var rect = canvas.getBoundingClientRect();
        var clickX = (e.clientX || e.targetTouches[0].clientX) - rect.left; // x-position of clicked area relative to canvas
        var clickY = (e.clientY || e.targetTouches[0].clientY) - rect.top; // y-position of clicked area relative to canvas

        // shift by vertex radius as we shifted canvas paint by that
        var adjustedX = clickX - vApp.vertexRadius;
        var adjustedY = clickY - vApp.vertexRadius;

        vApp.dragSource = getVertexClicked(adjustedX, adjustedY);
        if ( vApp.dragSource ) {
            vApp.dragEvent = true;
            vApp.requestedFrame = false;
        }
    }

    function dotCoordInIndex(pixelPos) {
        return {
            row: (pixelPos.y - vApp.vertexRadius - paddingYForDotMap) / vApp.dotDistance,
            column: (pixelPos.x - vApp.vertexRadius) / vApp.dotDistance
        }
    }

    function dotCoordInPixel(indexPos) {
        return {
            x: indexPos.column * vApp.dotDistance + vApp.vertexRadius,
            y: indexPos.row * vApp.dotDistance + vApp.vertexRadius + paddingYForDotMap
        }
    }

    function isNeighbour(source, dest) {
        var rowDiff = Math.abs(source.row - dest.row);
        var columnDiff = Math.abs(source.column - dest.column);

        if ((rowDiff === 0 && columnDiff === 1) ||
                (columnDiff === 0 && rowDiff === 1)) {
            return true;
        }
    }

    function getVertexClicked(x, y) {
        y = y - paddingYForDotMap;

        console.log(y);

        var expectedColumn = Math.round(x / vApp.dotDistance);
        var expectedRow = Math.round(y / vApp.dotDistance);

        if (expectedRow + 1 > vApp.dotMap.length ||
                expectedColumn + 1 > vApp.dotMap[expectedRow].length) {
            return null;
        }

        // if the distance between the expected vertex and clicked point is less than 15
        // then assume the vertex as clicked
        var xDifference = Math.abs(expectedColumn * vApp.dotDistance - x);
        var yDifference = Math.abs(expectedRow * vApp.dotDistance - y);

        if (Math.pow(xDifference, 2) + Math.pow(yDifference, 2) < 400) {
            return dotCoordInPixel({
                row: expectedRow,
                column: expectedColumn
            });
        }

        return null;
    }

    function addCustomFunctions() {
        _.subtractObj = function(array, objToRemove) {
            // var rest = [].slice.call(arguments, 1);
            return array.filter(function(obj) {
                return !_.isEqual(objToRemove, obj);
            });
        }
    }

    window.initialize = initialize;

    // RequestAnimationFrame: a browser API for getting smooth animations
    window.requestAnimationFrame = (function() {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    window.cancelAnimationFrame = (function() {
        return window.cancelAnimationFrame ||
            window.webkitCancelAnimationFrame ||
            window.mozCancelAnimationFrame ||
            window.oCancelAnimationFrame ||
            window.msCancelAnimationFrame ||
            window.clearTimeout
    })();

})();
