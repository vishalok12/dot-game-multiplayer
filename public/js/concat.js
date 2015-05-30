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

window.vApp = {
	levels: [
		'data/level1.json'
	]
};

function initialize() {
	addCustomFunctions();
	var canvas = document.getElementById('game-area');
	vApp.context = canvas.getContext('2d');
	vApp.dotDistance = 45;	// pixel distance between two neighbour dots
	vApp.vertexRadius = 5;	// the radius of the circle(vertex)
	vApp.level = 1;					// game level
	vApp.score = 0;					// score of the user
	vApp.WIDTH = canvas.width;
	vApp.HEIGHT = canvas.height;
	vApp.currentUser = 'user';	// the player who has turn to play
	vApp.gameLevel = 'hard';

	loadLevel(vApp.level);
	bindCanvas();
}

/**
 * loads all the files for the specified level and display the level
 * @param {Integer} level
 */
function loadLevel(level) {
	var levelIndex = level - 1;	// starts form 0
	if (!vApp.levels[levelIndex]) {
		// level not present
		return false;
	}

	loadJSON(vApp.levels[levelIndex], function(dotMap) {
		vApp.dotMap = dotMap;							// the 2d array, 1 represents vertex
		vApp.blockGraph = new vBlockGraph(dotMap);	// info for each square (made by dots)
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
			var posY = vApp.dotDistance * row;
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
	var y = block._row * dotDistance;
	var ctx = vApp.context;
	if (block.get('owner') === 'user') {
		ctx.fillStyle = 'rgb(218, 76, 76)';
	} else {
		ctx.fillStyle = 'rgb(61, 113, 192)';		
	}
	ctx.fillRect(x, y, dotDistance, dotDistance);
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
	var ctx = vApp.context;
	ctx.font = "bold 22px ubuntu";
	ctx.fillStyle = '#dddddd';
	ctx.fillText("You: " + vApp.score, 320, 50);
	ctx.fillText("Computer: " + vBot.getScore(), 320, 80);
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
			} else {	//Error in finding the file
				console.error("File not found");
			}
		}
	}
	req.send();
}

function bindCanvas() {
	var canvas = document.getElementById('game-area');
	canvas.addEventListener('mousedown', function(e) {
		e.stopPropagation();
		e.preventDefault();

		var rect = canvas.getBoundingClientRect();
		var clickX = e.clientX - rect.left;					// x-position of clicked area relative to canvas
		var clickY = e.clientY - rect.top;					// y-position of clicked area relative to canvas

		// shift by vertex radius as we shifted canvas paint by that
		var adjustedX = clickX - vApp.vertexRadius;
		var adjustedY = clickY - vApp.vertexRadius;

		vApp.dragSource = getVertexClicked(adjustedX, adjustedY);
		if ( vApp.dragSource ) {
			vApp.dragEvent = true;
			vApp.requestedFrame = false;
		}

	}, false);

	canvas.addEventListener('mousemove', function(e) {
		var ctx = vApp.context;
		e.stopPropagation();
		e.preventDefault();

		if (!vApp.dragEvent) { return; }

		var rect = canvas.getBoundingClientRect();
		var xMove = e.clientX - rect.left;
		var yMove = e.clientY - rect.top;
		
		var dragSource = vApp.dragSource;

		// request for animation frame only if the previous one has been executed
		if (!vApp.requestedFrame) {
			vApp.requestedFrame = true;
			vApp.requestId = window.requestAnimationFrame(function() {
				drawGraph(vApp.dotMap);		// paints the dot graph
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

	});

	canvas.addEventListener('mouseup', function(e) {
		if (!vApp.dragEvent) { return; }
		vApp.dragEvent = false;
		var ctx = vApp.context;
		e.stopPropagation();
		e.preventDefault();

		cancelAnimationFrame(vApp.requestId);	// don't paint the mousemove frame request
		
		// check for an edge selection
		var rect = canvas.getBoundingClientRect();
		var clickX = e.clientX - rect.left;
		var clickY = e.clientY - rect.top;
		var adjustedX = clickX - vApp.vertexRadius;
		var adjustedY = clickY - vApp.vertexRadius;

		var dragDest = getVertexClicked(adjustedX, adjustedY);
		if (dragDest) {
			var sourceIndex = dotCoordInIndex(vApp.dragSource);
			var destIndex = dotCoordInIndex(dragDest);
			var edgeSelected = vApp.blockGraph.isEdgeSelected(sourceIndex, destIndex);
			if (isNeighbour(sourceIndex, destIndex) && !edgeSelected) {
				var acquiredBlocks = vApp.blockGraph.addToBlockData(sourceIndex, destIndex);
				if (acquiredBlocks > 0) {
					vApp.score += acquiredBlocks;
					console.log('user has acquired a block');
				} else {
					vApp.currentUser = 'bot';	// computer's turn
					vBot.takeTurn();
				}
			}
		}
		drawGraph(vApp.dotMap);

		// reset values
		// vApp.dragSource = null;
	});
}

function dotCoordInIndex(pixelPos) {
	return {
		row: (pixelPos.y - vApp.vertexRadius) / vApp.dotDistance,
		column: (pixelPos.x - vApp.vertexRadius) / vApp.dotDistance
	}
}

function dotCoordInPixel(indexPos) {
	return {
		x: indexPos.column * vApp.dotDistance + vApp.vertexRadius,
		y: indexPos.row * vApp.dotDistance + vApp.vertexRadius
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
