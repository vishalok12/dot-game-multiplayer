(function () {
    'use strict';

    /**
     * desc: functions for square blocks created by neighbouring dots
     * @author: Vishal Kumar
     * E-mail: vishal.rgiit@gmail.com
     * Github: vishalok12
     */

    /**
     * contains information about the blocks
     */
    function BlockGraph(dotMap) {
        var i, j;
        var blocks = [];
        var upLayerLength, downLayerLength;

        for (i = 0; i < dotMap.length - 1; i++) {
            upLayerLength = dotMap[i].length;
            downLayerLength = dotMap[i+1].length;
            blocks[i] = [];

            for (j = 0; j < Math.min(upLayerLength, downLayerLength) - 1; j++) {
                blocks[i][j] = new Block(i, j);
            }
        }
        this.blocks = blocks;
    }

    /**
     * a square area covered by 4 individual edges
     */
    function Block(i, j) {
        var attr = {};
        attr.top = null;
        attr.bottom = null;
        attr.left = null;
        attr.right = null;
        attr.selected = 0;
        attr.owner = null;
        this._attr = attr;
        this._row = i;
        this._column = j;
    }

    /**
     * get the attribute value
     * @param {String} attr
     * @return {*} value of attr
     */
    Block.prototype.get = function(attr) {
        if (this._attr.hasOwnProperty(attr)) {
            return this._attr[attr];
        }
    };

    /**
     * set the value of the block attribute
     * @param {String} attr
     * @param {*} value
     */
    Block.prototype.set = function(attr, value) {
        if (this._attr.hasOwnProperty(attr)) {
            if (this._row === 0 && this._column === 1) console.log(attr);
            this._attr[attr] = value;
            if (['top', 'bottom', 'left', 'right'].indexOf(attr) > -1) {
                this._attr.selected += 1;
            }
        } else {
            throw new Error(attr + ' is not defined in object');
        }
    };

    /**
     * get whether the block has all the edges selected
     * @return {Boolean} acquired
     */
    Block.prototype.acquired = function() {
        if (this.get('selected') === 4) {
            return true;
        }

        return false;
    }

    /**
     * get whether the edge is selected
     * @param {Object|Number} row1 {row: row1, column: coln1} in case of object
     * @param {Object|Number} coln1 {row: row2, column: coln2} in case of object
     * @param {Number|undefined} row2
     * @param {Number|undefined} coln2
     * @return {Boolean} selected
     */
    BlockGraph.prototype.isEdgeSelected = function(row1, coln1, row2, coln2) {
        if (typeof row1 === 'object') {
            var sourceIndex = row1;
            var destIndex = coln1;
            row1 = sourceIndex.row;
            coln1 = sourceIndex.column;
            row2 = destIndex.row;
            coln2 = destIndex.column;
        }
        var minRow = Math.min(row1, row2);
        var minColn = Math.min(coln1, coln2);
        var blocks = this.blocks;

        // find the block the edge belongs to
        if (minRow < blocks.length) {
            var blocksRow = blocks[minRow];
            if (minColn < blocksRow.length) {
                if (row1 - row2) {
                    return blocks[minRow][minColn].get('left');
                } else {
                    return blocks[minRow][minColn].get('top');
                }
            } else {
                return blocks[minRow][minColn - 1].get('right');
            }
        } else {
            return blocks[minRow - 1][minColn].get('bottom');
        }
    };

    /**
     * mark the edge as selected
     * @param {Object} sourceIndex {row: rowIndex, column: columnIndex}
     * @param {Object} destIndex
     * @return {Boolean} acquired true if a block is captured by player
     */
    BlockGraph.prototype.addToBlockData = function(sourceIndex, destIndex) {
        var row, column;
        var blocks = this.blocks;
        var numOfBlocksAquired = 0;

        // get the blocks the edge belongs to
        if (sourceIndex.row === destIndex.row) {
            row = sourceIndex.row;
            column = Math.min(sourceIndex.column, destIndex.column);
            if (row < blocks.length) {
                blocks[row][column].set('top', 1);
                if (blocks[row][column].acquired()) {
                    numOfBlocksAquired++;
                    blocks[row][column].set('owner', vApp.currentUser);
                }
            }
            if (row > 0) {
                blocks[row - 1][column].set('bottom', 1);
                if (blocks[row - 1][column].acquired()) {
                    numOfBlocksAquired++;
                    blocks[row - 1][column].set('owner', vApp.currentUser);
                }
            }
        } else if (sourceIndex.column === destIndex.column) {
            row = Math.min(sourceIndex.row, destIndex.row);
            column = sourceIndex.column;
            if (column < blocks[row].length) {
                blocks[row][column].set('left', 1);
                if (blocks[row][column].acquired()) {
                    numOfBlocksAquired++;
                    blocks[row][column].set('owner', vApp.currentUser);
                }
            }
            if (column > 0) {
                blocks[row][column - 1].set('right', 1);
                if (blocks[row][column - 1].acquired()) {
                    numOfBlocksAquired++;
                    blocks[row][column - 1].set('owner', vApp.currentUser);
                }
            }
        }

        // log the last turn
        vApp.lastTurn = {
            sourceIndex: sourceIndex,
            destIndex: destIndex
        }

        return numOfBlocksAquired;
    };

    /**
     * returns the blocks which contains the edge passed in parameter
     * @param {Object} dotIndex1
     * @param {Object} dotIndex2
     * @param {Boolean} options.acquired
     * @return {Array.<Block>} blocks
     */
    BlockGraph.prototype.getNeighbourBlocks = function(dotIndex1, dotIndex2, options) {
        var nBlocks = [];
        var blocks = this.blocks;
        var minRow = Math.min(dotIndex1.row, dotIndex2.row);
        var minColn = Math.min(dotIndex1.column, dotIndex2.column);

        if (minRow < blocks.length && minColn < blocks[minRow].length) {
            nBlocks.push(blocks[minRow][minColn]);
        }
        if (dotIndex1.row === dotIndex2.row &&                  // rows of the two dots are same
                minRow > 0) {
            nBlocks.push(blocks[minRow - 1][minColn]);
        } else if (dotIndex1.column === dotIndex2.column && // columns of the two dots are same
                minColn > 0) {
            nBlocks.push(blocks[minRow][minColn - 1]);
        }

        if (options) {
            if(!options.acquired) {
                nBlocks = nBlocks.filter(function(block) {
                    return !block.acquired();
                });
            }
            if (options.otherThan) {
                nBlocks = nBlocks.filter(function(block) {
                    return !(_.isEqual(block, options.otherThan));
                });
            }
        }

        return nBlocks;
    };

    /**
     * get all the unselected edges of a block
     * @param {Block} block
     * @param {Array.<Object>} edges
     */
    BlockGraph.prototype.unselectedEdges = function(block) {
        var edges = [];
        // get all the edges with the value null
        if (block.get('top') === null) {
            edges.push({
                sourceIndex: {row: block._row, column: block._column},
                destIndex: {row: block._row, column: block._column + 1}
            });
        }
        if (block.get('bottom') === null) {
            edges.push({
                sourceIndex: {row: block._row + 1, column: block._column},
                destIndex: {row: block._row + 1, column: block._column + 1}
            });
        }
        if (block.get('left') === null) {
            edges.push({
                sourceIndex: {row: block._row, column: block._column},
                destIndex: {row: block._row + 1, column: block._column}
            });
        }
        if (block.get('right') === null) {
            edges.push({
                sourceIndex: {row: block._row, column: block._column + 1},
                destIndex: {row: block._row + 1, column: block._column + 1}
            });
        }
        return edges;
    }

    /**
     * get the sides in the graph which follows the condition passed
     * @param {Integer} minDrawnEdges minimum selected edge in block
     * @param {Integer} maxDrawnEdges maximum selected edge in block
     */
    BlockGraph.prototype.sidesInBlock = function(minDrawnEdges, maxDrawnEdges) {
        var blocks = this.blocks;
        var row, column;
        var blocksRow, block;
        var drawnSidesCount;
        var acceptedEdges = [], unselectedEdges;
        var that = this;

        for (row = 0; row < blocks.length; row++) {
            blocksRow = blocks[row];

            for (column = 0; column < blocksRow.length; column++) {
                block = blocksRow[column];
                drawnSidesCount = block.get('selected');

                if (drawnSidesCount <= maxDrawnEdges && drawnSidesCount >= minDrawnEdges) {
                    unselectedEdges = this.unselectedEdges(block);
                    acceptedEdges = acceptedEdges.concat(unselectedEdges.filter(function(edge) {
                        var nBlocks = that.getNeighbourBlocks(edge.sourceIndex, edge.destIndex);
                        return nBlocks.every(function(block) {
                            var selectedEdges = block.get('selected');
                            return selectedEdges <= maxDrawnEdges &&
                                selectedEdges >= minDrawnEdges;
                        });
                    }));
                }
            }
        }
        return acceptedEdges;
    };

    window.vBlockGraph = BlockGraph;

})();
