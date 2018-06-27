const helper = require('./helper');
const types = require('./answerTypes');
const priorityQueue = require('./priorityQueue');

/**
 * Computes the social choice function (except essentialSet)
 */

/**
 * Compute the borda winner of a given data object
 */
exports.borda = function borda(data) {
    let voteSize = data.staircase.length+1;
    let score = new Array(voteSize).fill(0);

    for (var i = 0; i < voteSize; i++) {
        for(var j = i+1; j < voteSize; j++) {
            let si = i;
            let sj = j-(i+1);

            if(data.staircase[si][sj] > 0) {
                score[i]+= data.staircase[si][sj];
                score[j]-= data.staircase[si][sj];
            } else {
                score[j]+= (-data.staircase[si][sj]);
                score[i]-= (-data.staircase[si][sj]);
            }
        }
    }
    //Find highest Borda Score
    let winScore = Math.max(...score);
    //Get all candidates with highest score
    let winner = score.reduce((p,c,i,a) => c ===  winScore ? p.concat(i) : p,[]);
    lotteries = helper.getWinnerLotteries(winner,voteSize);

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
};

/**
 * Compute the plurality winner of a given data object
 */
exports.plurality = function plurality(data) {
    let alternatives = data.staircase.length+1;
    let score = new Array(alternatives).fill(0);

    let profile = data.profile;
    for (let i = 0; i < profile.length; i++) {
        score[profile[i].relation[0]] += profile[i].numberOfVoters;
    }
    //Find highest Plurality Score
    let winScore = Math.max(...score);
    let winner = score.reduce((p,c,i,a) => c ===  winScore ? p.concat(i) : p,[]);
    let lotteries = helper.getWinnerLotteries(winner,alternatives);

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
};

/**
 * Compute the anti-plurality winner of a given data object
 */
exports.antiPlurality = function antiPlurality(data) {
    let alternatives = data.staircase.length+1;
    let score = new Array(alternatives).fill(0);

    let profile = data.profile;
    for (let i = 0; i < profile.length; i++) {
        score[profile[i].relation[alternatives-1]] += profile[i].numberOfVoters;
    }
    //Find lowest anti-Plurality Score
    let winScore = Math.min(...score);
    let winner = score.reduce((p,c,i,a) => c ===  winScore ? p.concat(i) : p,[]);
    let lotteries = helper.getWinnerLotteries(winner,alternatives);

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
};

/**
 * Compute the plurality with runoff winner of a given data object
 */
exports.pluralityWithRunoff = function pluralityWithRunoff(data) {
    let alternatives = data.staircase.length+1;
    let score = new Array(alternatives).fill(0);

    let profile = data.profile;
    for (let i = 0; i < profile.length; i++) {
        score[profile[i].relation[0]] += profile[i].numberOfVoters;
    }
    //Find highest Plurality Score
    let winScore = Math.max(...score);
    let scoreCopyWithoutPluralityWinners = score.slice();
    let scoreCopy = score.slice();

    for (let i = 0; i < scoreCopyWithoutPluralityWinners.length; i++) {
        if (scoreCopyWithoutPluralityWinners[i] === winScore) {
            scoreCopyWithoutPluralityWinners[i] = -1;
        }
    }

    let secondScore = Math.max(...scoreCopyWithoutPluralityWinners);
    let pluralityWinners = score.reduce((p,c,i,a) => c ===  winScore ? p.concat(i) : p,[]);
    let secondWinners = scoreCopy.reduce((p,c,i,a) => c ===  secondScore ? p.concat(i) : p,[]);

    let pluralityWithRunoffWinners = [];
    // Case with several plurality winners
    if (pluralityWinners.length > 1) {
        for (let i = 0; i < pluralityWinners.length; i++) {
            for (let j = i+1; j < pluralityWinners.length; j++) {
                let si = pluralityWinners[i];
                let sj = pluralityWinners[j]-(pluralityWinners[i]+1);

                if (data.staircase[si][sj] >= 0) {
                    pluralityWithRunoffWinners.push(pluralityWinners[i]);
                }
                if (data.staircase[si][sj] <= 0) {
                    pluralityWithRunoffWinners.push(pluralityWinners[j]);
                }
            }
        }
    }
    else { // Case with unique plurality winner
        let margins = helper.getFullMargins(data.staircase);
        let si = pluralityWinners[0];
        for (let j = 0; j < secondWinners.length; j++) {
            let sj = secondWinners[j];
            if (margins[si][sj] <= 0) {
                pluralityWithRunoffWinners.push(sj);
            }
            if (margins[si][sj] >= 0) {
                pluralityWithRunoffWinners.push(si);
            }
        }
    }

    let lotteries = helper.getWinnerLotteries(Array.from(new Set(pluralityWithRunoffWinners)).sort(),alternatives);

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
};

/**
 * Compute the instant runoff winner of a given data object
 */
exports.instantRunoff = function instantRunoff(data) {
    let alternativeSize = data.staircase.length+1;

    let profile = data.profile;
    let winners = instantRunoffRecursion(profile,alternativeSize,[]);
    let lottery = helper.getWinnerLotteries(winners.sort(),alternativeSize);

    return {
        success: true,
        type: types.Lotteries,
        result: lottery
    }
};

function instantRunoffRecursion(profile, alternativeSize, excluded) {
    // If only one non-excluded alternative remains, it shall be returned and thus be among the winners
    if (excluded.length + 1 === alternativeSize) {
        for (let i = 0; i < alternativeSize; i++) {
            if (!excluded.includes(i)) {
                return [i];
            }
        }
    }

    // Initialize the array with zeros
    let score = new Array(alternativeSize).fill(0);

    // Fill the array with the largest possible number for all excluded alternatives, so the (already) excluded alternatives do not lose again
    for (let i = 0; i < score.length; i++) {
        if (excluded.includes(i)) {
            score[i] = Number.MAX_SAFE_INTEGER;
        }
    }

    for (let i = 0; i < profile.length; i++) {
        let counter = 0;
        while (excluded.includes(profile[i].relation[counter])) {
            counter++;
        }
        score[profile[i].relation[counter]] += profile[i].numberOfVoters;
    }
    // Find the lowest Plurality Score (among the non-excluded alternatives)
    let lowestScore = Math.min(...score);
    let losers = score.reduce((p,c,i,a) => c ===  lowestScore ? p.concat(i) : p,[]);



    // Thorough tie-breaking (corresponding to computational hard problem)
    // Recursively call Instant Runoff with all possible losers and concatenate the results
    // let returnWinners = [];
    // for (let i = 0; i < losers.length; i++) {
    //     returnWinners = Array.from(new Set(returnWinners.concat(instantRunoffRecursion(profile, alternativeSize, excluded.concat(losers[i])))));
    // }
    // return returnWinners;

    // Fixed Tie-Breaking: Removing all plurality losers at once
    if (losers.length === alternativeSize - excluded.length) {
        return losers;
    }
    else {
        return instantRunoffRecursion(profile, alternativeSize, excluded.concat(losers));
    }
}

/**
 * Compute the a Tideman result via score definition
 */
exports.tideman = function tideman(data) {
    let voteSize = data.staircase.length+1;
    let score = new Array(voteSize).fill(0);

    for (let i = 0; i < voteSize; i++) {
        for(let j = i+1; j < voteSize; j++) {

            let weight = data.staircase[i][j-(i+1)];

            if(weight > 0) {
                score[j] += weight;
            } else {
                score[i] -= weight;
            }
        }
    }

    // Find lowest Score
    let winScore = Math.min(...score);
    // Get all candidates with lowest score
    let winner = score.reduce((p,c,i,a) => c ===  winScore ? p.concat(i) : p,[]);
    let lotteries = helper.getWinnerLotteries(winner, voteSize);

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
};

/**
 * Compute the minimax winner of a given data object
 */
exports.minimax = function minimax(data) {
    marg = helper.getFullMargins(data.staircase);
    //Compute min of each row
    mini = marg.map(arr => Math.min(...arr))
    //Get the max of the mins
    let winScore = Math.max(...mini);
    //find all rows with maximal mincolumn
    let winner = mini.reduce((p,c,i,a) => c ==  winScore ? p.concat(i) : p,[]);
    let lotteries = helper.getWinnerLotteries(winner,marg.length);

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
}

/**
 * Compute the copeland winner of a given data object
 */
exports.copeland = function copeland(data) {
    let margin = helper.getFullMargins(data.staircase);
    let lottery = helper.getWinnerLotteries(copelandAsSet(margin),margin.length);

    return {
        success: true,
        type: types.Lotteries,
        result: lottery
    }
};

function copelandAsSet(margin) {
    let alternativesSize = margin.length;
    let copelandScore = new Array(alternativesSize).fill(0);

    for (let i = 0; i < alternativesSize; i++) {
        for (let j = 0; j < alternativesSize; j++) {
            copelandScore[i] += (margin[i][j] > 0 ? 1 : -1);
        }
    }

    //Get the maximal Copeland score
    let winScore = Math.max(...copelandScore);
    //find all alternatives with maximal Copeland score
    return copelandScore.reduce((p,c,i,a) => c ===  winScore ? p.concat(i) : p,[]);
}

/**
 * Compute the McKelvey uncovered set of a given data object
 */
exports.uncoveredSet = function uncoveredSet(data) {
    let margin = helper.getFullMargins(data.staircase);
    let alternativesSize = margin.length;
    let kings = [];

    // Check if x is a king
    xLoop:
    for (let x = 0; x < alternativesSize; x++) {


        // Check if x reaches (every) y in at most two steps (of which at most one may be a tie)
        yLoop:
        for (let y = 0; y < alternativesSize; y++) {
            if (x===y || margin[x][y] >= 0) {
                continue;
            }
            else {
                // Check if there is an alternative z as intermediate step
                for (let z = 0; z < alternativesSize; z++) {
                    if (x === z || y === z) {
                        continue;
                    }
                    if ((margin[x][z] > 0 && margin[z][y] >= 0) || (margin[x][z] >= 0 && margin[z][y] > 0)) {
                        continue yLoop;
                    }
                }
            }
            continue xLoop;
        }
        kings.push(x);
    }


    let lottery = helper.getWinnerLotteries(kings,margin.length);

    return {
        success: true,
        type: types.Lotteries,
        result: lottery
    }
};

/**
 * Compute the top cycle of a given data object
 */
// exports.topCycle = function topCycle(data) {
//     let margin = helper.getFullMargins(data.staircase);
//     let alternativesSize = margin.length;
//
//     let copelandWinners = copelandAsSet(margin);
//
//     let dominators = [];
//
//     for (let i = 0; i < alternativesSize; i++) {
//         if (margin[][]) {
//
//         }
//     }
//
//
//     do {
//
//     } while () ;
//     let lottery = helper.getWinnerLotteries(winner,alternativesSize);
//
//     return {
//         success: true,
//         type: types.Lotteries,
//         result: lottery
//     }
// };

/**
 * Compute the nanson winner of a given data object
 */
exports.nanson = function nanson(data) {
    let marg = helper.getFullMargins(data.staircase);
    let size = marg.length;
    let index = Array.from(new Array(size), (x,i) => i);

    do {
        //Get the borda score (= sum of each row)
        score = marg.map(array => array.reduce((acc,val,i) => acc+val));
        //Find and remove all negative score candidates
        negativeScoreIndices = index.filter( (e,i) => score[i]<0);
        marg = marg.filter((arr,i) => score[i]>=0);
        marg = marg.map(arr => arr.filter((e,i) => score[i]>=0));
        index = index.filter((e,i) => score[i]>= 0);
    } while(negativeScoreIndices.length > 0)

    let lotteries = helper.getWinnerLotteries(index,size);

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
}

/**
 * Compute the Baldwin winner of a given data object
 */
exports.baldwin = function baldwin(data) {
    let marg = helper.getFullMargins(data.staircase);
    let size = marg.length;
    let index = Array.from(new Array(size), (x,i) => i);
    let lowestScoreIndices;

    do {
        //Get the borda score (= sum of each row)
        let score = marg.map(array => array.reduce((acc,val,i) => acc+val));
        //Find and remove all candidates with lowest score
        let lowestScore = Math.min(...score);
        if (lowestScore !== 0)  {
            lowestScoreIndices = index.filter( (e,i) => score[i] === lowestScore);
            marg = marg.filter((arr,i) => score[i] > lowestScore);
            marg = marg.map(arr => arr.filter((e,i) => score[i] > lowestScore));
            index = index.filter((e,i) => score[i] > lowestScore);
        }
        else {
            break;
        }
    } while(lowestScoreIndices.length > 0);

    let lotteries = helper.getWinnerLotteries(index,size);

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
}

/**
 * Compute the black winner of a given data object
 */
exports.black = function black(data) {
    let margin = helper.getFullMargins(data.staircase);
    //Check if there is a candidate strictly preferred by everyone
    //Remove the diagonal of the matrix and look for positive rows
    margin.forEach( (arr,i) => {arr.splice(i,1);return arr});
    let condorcet = margin.findIndex(arr => arr.every(e => e>0));
    //if there is one return it
    if(condorcet>=0) {
        return {
            success: true,
            type: types.Lotteries,
            result: helper.getWinnerLotteries([condorcet],margin.length)
        }
    }

    return exports.borda(data);
}

/**
 * Compute the Condorcet winner of a given data object (or all alternatives if there is none)
 */
exports.condorcet = function condorcet(data) {
    let margin = helper.getFullMargins(data.staircase);
    //Check if there is a candidate strictly preferred by everyone
    //Remove the diagonal of the matrix and look for positive rows
    margin.forEach( (arr,i) => {arr.splice(i,1);return arr});
    let condorcet = margin.findIndex(arr => arr.every(e => e>0));
    let weakCondorcet = margin.findIndex(arr => arr.every(e => e>=0));
    let winners = [];
    //if there is one return it
    if(condorcet>=0) {
        winners.push(condorcet);
    }
    else if (weakCondorcet >= 0) {
        xLoop:
        for (let x = 0; x < margin.length; x++) {
            for (let y = 0; y < margin.length; y++) {
                if (margin[x][y] < 0) {
                    continue xLoop;
                }
            }
            winners.push(x);
        }
    }
    else {
        for (let x = 0; x < margin.length; x++) {
            winners.push(x);
        }
    }

    return {
        success: true,
        type: types.Lotteries,
        result: helper.getWinnerLotteries(winners,margin.length)
    }
};

/**
 * Compute the Pareto-undominated alternatives
 */
exports.pareto = function pareto(data) {
    let margin = helper.getFullMargins(data.staircase);

    // Compute total number of voters
    let numberOfVoters = 0;
    for (let i = 0; i < data.profile.length; i++) {
        numberOfVoters += data.profile[i].numberOfVoters;
    }

    let winners = [];

    // Check for Pareto domination
    xLoop:
    for (let x = 0; x < margin.length; x++) {
        for (let y = 0; y < margin.length; y++) {
            if (margin[y][x] === numberOfVoters) {
                continue xLoop;
            }
        }
        winners.push(x);
    }

    return {
        success: true,
        type: types.Lotteries,
        result: helper.getWinnerLotteries(winners,margin.length)
    }
};

/**
 * Compute the ranked Pairs winner of a given data object
 */
exports.rankedPairsWinner = function rankedPairsWinner(data) {
    //Setup a priority queue
    let queue = new priorityQueue( (a,b) => a.weight > b.weight);
    let stair = data.staircase;
    let size = stair[0].length + 1;

    //Buildup weighted Graph
    for (var i = 0; i < stair.length; i++) {
        for (var j = 0; j < stair[i].length; j++) {
            let weight,from,to;

            if(stair[i][j]>0) {
                weight = stair[i][j];
                from = i;
                to = j+i+1;
            } else {
                weight = -stair[i][j]
                to = i;
                from = j+i+1;
            }
            //Buildup sorted pairlist: margin -> pair
            queue.push(new exports._Edge(from,to,weight));
        }
    }

    let graph = [];
    for (var i = 0; i < size; i++) {
        graph.push(new exports._Node(size,graph));
    }

    let domID,subID = 0

    //Graph Search
    while(!queue.isEmpty()) {
        let edge = queue.pop();
        //Find maximum -> (dom,sub)
        domID = edge.from;
        let dom = graph[domID];
        subID = edge.to;
        let sub = graph[subID];
        //if sub is not strongerThan dom:
        if(! sub.isStrongerThan(domID)) {
            // dom + dom.weakerThan ->  sub.weakerThan + transitive
            let strongSet = dom.weakerThan.union(new Set([domID]));
            sub.submitTo(strongSet);

            // sub + sub.strongerThan ->dom.strongerThan + transitive
            let weakSet   = sub.strongerThan.union(new Set([subID]));
            dom.dominate(weakSet);
        }

        for (var i = 0; i < size; i++) {
            if(graph[i].isWinner()) {
                return {
                    success: true,
                    type: types.Lotteries,
                    result: helper.getWinnerLotteries([i],size)
                }
            }
        }
    }

    for (var i = 0; i < size; i++) {
        if(graph[i].isWinner()) {
            return {
                success: true,
                type: types.Lotteries,
                result: helper.getWinnerLotteries([i],size)
            }
        }
    }

    return {
        success: false,
        msg: "Search failed"
    }
}

/**
 * Graph helper functions
 */

//Weighted Edge objects
exports._Edge = function Edge(from,to,weight) {
    this.from = from;
    this.to = to;
    this.weight = weight;
}

//Node objects storeing stronger and weaker nodes
exports._Node = function Node(graphSize,graph) {
    this.size = graphSize;
    this.graph = graph;
    this.weakerThan = new Set();
    this.strongerThan = new Set();
}

exports._Node.prototype.isWinner = function () {
    return this.strongerThan.size == (this.size-1);
};

exports._Node.prototype.isStrongerThan = function (x) {
    return this.strongerThan.has(x);
};

/**
 * Add a set of nodes recursively to everyone this nodes dominates
 */
exports._Node.prototype.dominate = function (set) {
    this.strongerThan = this.strongerThan.union(set);
    this.weakerThan.forEach(x => this.graph[x].dominate(set));
};

/**
 * Add a set of nodes recursively to everyone this nodes is dominated by
 */
exports._Node.prototype.submitTo = function (set) {
    this.weakerThan = this.weakerThan.union(set);
    this.strongerThan.forEach(x => this.graph[x].submitTo(set));
};

/**
 * Extend the javascript Set object by a union function
 */
Set.prototype.union = function(setB) {
    var union = new Set(this);
    for (var elem of setB) {
        union.add(elem);
    }
    return union;
}
