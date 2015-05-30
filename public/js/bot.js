(function () {
/**
 * @desc: functions for bot/computer player
 * 
 * @author: Vishal Kumar
 * E-mail: vishal.rgiit@gmail.com
 * Github: vishalok12
 */

var Bot = {};

/* @type {Boolean} */
// indicates there are un-selected edges left which will not give chance to 
// opponent to make a block
var safeEdgesLeft = true;

/* @type {Number} */
var score = 0;

Bot.takeTurn = function() {
	// first check for the squares which has 3 sides drawn and if present, draw it
	// if the graph has more than one such squares, you don't have to bother which
	// to draw first as you can fill both and it doesn't depend on order of filling
	var blockGraph = vApp.blockGraph;
	var edges, edge;

	acquireBlocks();

	if (safeEdgesLeft) {
		// search for an unselected edge which belongs a block with 0/1 selected edges
		edges = blockGraph.sidesInBlock(0, 1);
		if (!edges.length) {
			safeEdgesLeft = false;
			edges = blockGraph.sidesInBlock(2, 2);
		}
	} else {
		// search for an unselected edge which belongs a block with 2 selected edges
		edges = blockGraph.sidesInBlock(2, 2);
	}

	if (edges.length) {
		// select an edge to make a turn
		edge = intelligentMove(edges);
		blockGraph.addToBlockData(edge.sourceIndex, edge.destIndex);
		vApp.currentUser = 'user';
	} else {
		console.log('Game Over!');

	}

	// sides.map(function(side) {
	// 	blockGraph.addToBlockData(side.sourceIndex, side.destIndex);
	// });
 
}

Bot.getScore = function() {
	return score;
}

// Private Functions

function intelligentMove(edges) {
	if (safeEdgesLeft || vApp.gameLevel === 'medium') {
		var randomIndex = ~~(Math.random() * edges.length);
		return edges[randomIndex];
	} else if (vApp.gameLevel === 'hard' || vApp.gameLevel === 'expert') {
		var edge;
		var acquiredBlockCount;
		var moves = [];
		var selectedEdges;

		while (edges.length) {
			edge = edges.shift();
			selectedEdges = [];
			acquiredBlockCount = acquiredCount(edge, selectedEdges);
			edges = difference(edges, selectedEdges);
			moves.push({edge: edge, count: acquiredBlockCount});
		}

		var bestMove = _.min(moves, function(move) { return move.count; });
		return bestMove.edge;
	}
}

function acquiredCount(edge, selectedEdges) {
	var selectedEdges = selectedEdges == undefined ? [] : selectedEdges;
	selectedEdges.push(edge);
	var acquiredBlockCount = 0;
	var blockGraph = vApp.blockGraph;
	var possibleBlocks = blockGraph.getNeighbourBlocks(edge.sourceIndex, edge.destIndex);
	var block, unselectedBlockEdges, notSelected, virtualSelectedLength;
	var possibleBlock;

	while (possibleBlocks.length) {
		block = possibleBlocks.pop();
		unselectedBlockEdges = blockGraph.unselectedEdges(block);
		notSelected = difference(unselectedBlockEdges, selectedEdges);
		virtualSelectedLength = unselectedBlockEdges.length - notSelected.length;
		if (block.get('selected') + virtualSelectedLength >= 3) {
			acquiredBlockCount ++;
			if (notSelected.length) {
				edge = notSelected[0];
				selectedEdges.push(edge);
				possibleBlock = blockGraph.getNeighbourBlocks(
					edge.sourceIndex,
					edge.destIndex, 
					{ otherThan: block }
				)[0];
				if (possibleBlock && _.indexOf(possibleBlocks, possibleBlock) === -1) {
					possibleBlocks.push(possibleBlock);
				}
			}
		}

	}

	return acquiredBlockCount;
}

function difference(arr1, arr2) {
	return arr1.filter(function(value1) {
		return !arr2.some(function(value2) {
			return _.isEqual(value1, value2);
		});
	});
}

function acquireBlocks() {
	var leaveSomeBlocks = false;
	var blockGraph = vApp.blockGraph;
	var i;
	var block, edge, count;
	var likelyBlocks = _.flatten(blockGraph.blocks).filter(function(block) {
		return block.get('selected') === 3;
	});

	if (vApp.gameLevel === 'expert' && !safeEdgesLeft) {
		for (i = 0; i < likelyBlocks.length; i++) {
			block = likelyBlocks[i];
			edge = blockGraph.unselectedEdges(block)[0];
			count = acquiredCount(edge);
			if (count > 2) {
				leaveSomeBlocks = true;
				break;
			}
		}

		if (leaveSomeBlocks) {
			likelyBlocks.splice(i, 1);
			acquire([block], count - 2);
		}
	}

	acquire(likelyBlocks);
}

function acquire(likelyBlocks, maxCount) {
	var block, edges;
	var edge, nBlocks;
	var blockGraph = vApp.blockGraph;

	while(likelyBlocks.length && (maxCount === undefined || maxCount > 0)) {
		block = likelyBlocks.pop();
		// check if the block is not acquired
		edges = blockGraph.unselectedEdges(block);
		if (edges.length) {
			if (maxCount !== undefined) {
				maxCount --;
			}
			edge = edges[0]; // as there must be only one unselected edge
			score += blockGraph.addToBlockData(edge.sourceIndex, edge.destIndex);
			// get the blocks which contains edge and are not acquired
			nBlocks = blockGraph.getNeighbourBlocks(
				edge.sourceIndex, 
				edge.destIndex, 
				{acquired: false}
			);
			nBlocks = nBlocks.filter(function(block) {
				return block.get('selected') === 3;
			});
			if (nBlocks.length > 0) {
				likelyBlocks = likelyBlocks.concat(nBlocks);
			}
		}
	}
}

window.vBot = Bot;

})();
