const helper = require('./helper');
const types = require('./answerTypes');
const priorityQueue = require('./priorityQueue');
const util = require('util');
const fs = require('fs');
const execSync = require('child_process').execSync;

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
    let lotteries = helper.getWinnerLotteries(winner, voteSize);

    // Test for ultimate scoring winner
    if (winner.length === 1) {
        let ultimateCandidate = winner[0];
        // Pretest: Plurality:
        let pluralityScore = new Array(voteSize).fill(0);

        let profile = data.profile;
        for (let i = 0; i < profile.length; i++) {
            pluralityScore[profile[i].relation[0]] += profile[i].numberOfVoters;
        }
        //Find highest Plurality Score
        let pluralityWinScore = Math.max(...pluralityScore);
        let pluralityWinner = pluralityScore.reduce((p,c,i,a) => c ===  pluralityWinScore ? p.concat(i) : p,[]);

        if (pluralityWinner.length === 1 && ultimateCandidate === pluralityWinner[0]) {
            //Check via LPs if the candidate is (really) the ultimate scoring rule winner
            for (let competitor = 0; competitor < voteSize; competitor++) if (competitor !== ultimateCandidate) {
                let model = "Maximize\n" + "0\n" + "Subject To\n";

                // weights are non-negative
                for (let b = 0; b < voteSize; b++) model += " w_" + b + " >= 0\n";

                // weights are monotone
                for (let b = 1; b < voteSize; b++) model += " w_" + (b-1) + " - w_" + b +" >= 0\n";

                // weights are non-trivial
                model += " w_0 - w_" + (voteSize-1) +" >= 1\n";

                // Comparision of scores of competitor and ultimateCandidate
                let difference = "";
                for (let voterType = 0; voterType < profile.length; voterType++) {
                    for (let rank = 0; rank < voteSize; rank++) {
                        let recentAlternative = profile[voterType].relation[rank];
                        if (recentAlternative === competitor) {
                            difference += (difference === "" ? "" : " + ") + profile[voterType].numberOfVoters + " w_" + rank;
                        }
                        if (recentAlternative === ultimateCandidate) {
                            difference += " - " + profile[voterType].numberOfVoters + " w_" + rank;
                        }
                    }
                }
                model += difference + " >= 0\n";

                model += "END";

                // console.log(model);

                let fileName = "SCIP/Ultimate.Scoring.Winner.for.model.ID."+model.hashCode()+".lp";
                fs.writeFileSync(fileName, model); // Write the file SYNCHRONOUSLY (!)
                let output = execSync('./SCIP/bin/soplex --loadset=SCIP/bin/exact.set ' + fileName + ' -X', {stdio:[]}).toString();
                execSync('rm '+fileName); // Delete the temporary file

                for (let line of output.split('\n')) {
                    // console.log(line);
                    if (line.includes("[infeasible]") || line.includes("[unspecified]") || line.includes("[time limit reached]")) {
                        break;
                    }
                    if (line.includes("[optimal]")) {
                        // The candidate is not an ultimate scoring winner because "competitor" may be better
                        return {
                            success: true,
                            type: types.Lotteries,
                            tooltip: "Borda scores: "+score,
                            result: lotteries
                        }
                    }
                }
            }

            return {
                success: true,
                type: types.Lotteries,
                tooltip: "Ultimate scoring rule winner with Borda scores: "+score,
                result: lotteries
            }
        }
    }

    return {
        success: true,
        type: types.Lotteries,
        tooltip: "Borda scores: "+score,
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
        tooltip: "Scores: "+score,
        result: lotteries
    }
};

/**
 * Compute the Bucklin winners of a given data object
 */
exports.bucklin = function bucklin(data) {
    let alternatives = data.staircase.length+1;

    // Compute total number of voters
    let numberOfVoters = 0;
    for (let i = 0; i < data.profile.length; i++) {
        numberOfVoters += data.profile[i].numberOfVoters;
    }
    let majority = numberOfVoters / 2.0;

    let score = new Array(alternatives).fill(0);
    let profile = data.profile;
    let winScore;
    let tooltip = "";

    for (let a = 0; a < alternatives; a++) {
        for (let i = 0; i < profile.length; i++) {
            score[profile[i].relation[a]] += profile[i].numberOfVoters;
        }
        tooltip += "Round " + (a+1) + ": " + score + '\n';
        //Find highest (a+1)-Bucklin Score
        winScore = Math.max(...score);
        if(winScore > majority) {
            break;
        }
    }

    let winner = score.reduce((p,c,i,a) => c ===  winScore ? p.concat(i) : p,[]);
    let lotteries = helper.getWinnerLotteries(winner,alternatives);

    return {
        success: true,
        type: types.Lotteries,
        tooltip: tooltip,
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
        tooltip: "Veto Scores: "+score,
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
        tooltip: "Scores: "+score,
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
 * Compute the coombs winner of a given data object
 */
exports.coombs = function coombs(data) {
    let alternativeSize = data.staircase.length+1;

    let profile = data.profile;
    let winners = coombsRecursion(profile,alternativeSize,[]);
    let lottery = helper.getWinnerLotteries(winners.sort(),alternativeSize);

    return {
        success: true,
        type: types.Lotteries,
        result: lottery
    }
};

function coombsRecursion(profile, alternativeSize, excluded) {
    // If only one non-excluded alternative remains, it shall be returned and thus be among the winners
    if (excluded.length + 1 === alternativeSize) {
        for (let i = 0; i < alternativeSize; i++) {
            if (!excluded.includes(i)) {
                return [i];
            }
        }
    }

    // Initialize the plurality score array with zeros
    let pluralityScore = new Array(alternativeSize).fill(0);

    // Initialize the veto (= last ranked alternatives) score array with zeros
    let vetoScore = new Array(alternativeSize).fill(0);

    // Fill the plurality score array with the smallest possible number for all excluded alternatives
    for (let i = 0; i < pluralityScore.length; i++) {
        if (excluded.includes(i)) {
            pluralityScore[i] = Number.MIN_SAFE_INTEGER;
        }
    }

    // Fill the veto score array with the smallest possible number for all excluded alternatives
    for (let i = 0; i < vetoScore.length; i++) {
        if (excluded.includes(i)) {
            vetoScore[i] = Number.MIN_SAFE_INTEGER;
        }
    }

    let sumOfVoters = 0;
    // Compute plurality scores (ignoring excluded alternatives)
    for (let i = 0; i < profile.length; i++) {
        let counter = 0;
        while (excluded.includes(profile[i].relation[counter])) {
            counter++;
        }
        pluralityScore[profile[i].relation[counter]] += profile[i].numberOfVoters;
        sumOfVoters += profile[i].numberOfVoters;
    }

    // Compute veto scores (ignoring excluded alternatives)
    for (let i = 0; i < profile.length; i++) {
        let counter = alternativeSize - 1;
        while (excluded.includes(profile[i].relation[counter])) {
            counter--;
        }
        vetoScore[profile[i].relation[counter]] += profile[i].numberOfVoters;
    }


    // Find the highest Plurality Score (among the non-excluded alternatives)
    let highestPluralityScore = Math.max(...pluralityScore);
    // If there is a majority, return the majority winner
    if (highestPluralityScore > sumOfVoters / 2.0) {
        return pluralityScore.reduce((p, c, i, a) => c === highestPluralityScore ? p.concat(i) : p, []);
    }
    else {
        // If there is no majority, compute the veto loser(s)
        let highestVetoScore = Math.max(...vetoScore);
        let losers = vetoScore.reduce((p, c, i, a) => c === highestVetoScore ? p.concat(i) : p, []);

        // Thorough tie-breaking (corresponding to computational hard problem)
        // Recursively call Coombs with all possible losers and concatenate the results
        // let returnWinners = [];
        // for (let i = 0; i < losers.length; i++) {
        //     returnWinners = Array.from(new Set(returnWinners.concat(coombsRecursion(profile, alternativeSize, excluded.concat(losers[i])))));
        // }
        // return returnWinners;

        // Fixed Tie-Breaking: Removing all veto losers at once
        if (losers.length === alternativeSize - excluded.length) {
            return losers;
        }
        else {
            return coombsRecursion(profile, alternativeSize, excluded.concat(losers));
        }
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
        tooltip: "Scores: " + score,
        result: lotteries
    }
};

/**
 * Compute the maximin winner of a given data object
 */
exports.maximin = function maximin(data) {
    marg = helper.getFullMargins(data.staircase);
    //Compute min of each row
    mini = marg.map(arr => Math.min(...arr));
    //Get the max of the mins
    let winScore = Math.max(...mini);
    //find all rows with maximal mincolumn
    let winner = mini.reduce((p,c,i,a) => c ===  winScore ? p.concat(i) : p,[]);
    let lotteries = helper.getWinnerLotteries(winner,marg.length);

    return {
        success: true,
        type: types.Lotteries,
        tooltip: "Row Minima: " + mini,
        result: lotteries
    }
}

/**
 * Compute the copeland winner of a given data object
 */
exports.copeland = function copeland(data) {
    let margin = helper.getFullMargins(data.staircase);

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
    let copelandSet = copelandScore.reduce((p,c,i,a) => c ===  winScore ? p.concat(i) : p,[]);

    let lottery = helper.getWinnerLotteries(copelandSet,margin.length);

    return {
        success: true,
        type: types.Lotteries,
        tooltip: "Scores: " + copelandScore,
        result: lottery
    }
};

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
    let backup = index;

    do {
        //Get the borda score (= sum of each row)
        score = marg.map(array => array.reduce((acc,val,i) => acc+val));
        //Find and remove all negative score candidates
        negativeScoreIndices = index.filter( (e,i) => score[i]<0);
        marg = marg.filter((arr,i) => score[i]>0);
        marg = marg.map(arr => arr.filter((e,i) => score[i]>0));
        index = index.filter((e,i) => score[i]> 0);
        if (index.length > 0) backup = index;
        else index = backup;
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
    let bordaResult = exports.borda(data);
    bordaResult.tooltip = "Black: " + bordaResult.tooltip;
    return bordaResult;
};

/**
 * Compute the Young winner of a given data object
 */
exports.young = function young(data) {
    let alternativeSize = data.staircase.length+1;
    let margin = helper.getFullMargins(data.staircase);

    let profile = data.profile;
    let numberOfTypes = profile.length;

    let tooltip = "";
    let winners = [];

    // If there is a Condorcet winner, we do not need to set up any ILP
    //Check if there is a candidate strictly preferred by everyone
    //Remove the diagonal of the matrix and look for positive rows
    let copyOfMargin = JSON.parse(JSON.stringify(margin));
    copyOfMargin.forEach( (arr,i) => {arr.splice(i,1);return arr});
    let condorcet = copyOfMargin.findIndex(arr => arr.every(e => e>0));
    //if there is one return it
    if(condorcet>=0) {
        return {
            success: true,
            type: types.Lotteries,
            result: helper.getWinnerLotteries([condorcet],margin.length)
        }
    }

    let currentLowest = Number.MAX_SAFE_INTEGER;

    // Iteratively compute how many voters need to be removed to make each alternative a Condorcet winner
    for (let c = 0; c < alternativeSize; c++) {
        let model = "Minimize\n" + "sum\n" + "Subject To\n";

        // Number of voters to remove is non-negative for each type
        for (let t = 0; t < numberOfTypes; t++) model += " t_" + t + " >= 0\n";

        // Number of voters to remove for each type is smaller or equal to number of present voters of this type
        for (let t = 0; t < numberOfTypes; t++) model += " t_" + t + " <= "+profile[t].numberOfVoters+"\n";

        // Total number of voters to remove is encoded in "sum"
        model += " t_0";
        for (let t = 1; t < numberOfTypes; t++) model += " + t_" + t;
        model += " - sum = 0\n";

        // Alternative c is Condorcet winner
        for (let a = 0; a < alternativeSize; a++) if (a !== c) {
            // model += " " + margin[c][a] + " ";
            // For each voter type check whether a is ranked above or below c
            for (let t = 0; t < numberOfTypes; t++) {
                model += (profile[t].relation.indexOf(a) > profile[t].relation.indexOf(c) ? " - " : " + " ) + "t_"+t;
            }
            if (margin[c][a] !== 0) model += " >= " + (-1 * margin[c][a] + 1) + "\n";
            else model += " >= 1\n";
        }
        model += "END";

        let fileName = "SCIP/Young."+c+".for.model.ID."+model.hashCode()+".lp";
        fs.writeFileSync(fileName, model); // Write the file SYNCHRONOUSLY (!)
        let output = execSync('./SCIP/bin/soplex --loadset=SCIP/bin/exact.set ' + fileName + ' -X', {stdio:[]}).toString();
        execSync('rm '+fileName); // Delete the temporary file

        let solutionMap = {sum: Number.MAX_SAFE_INTEGER};
        let solutionArea = false;
        let feasible = false;
        for (let line of output.split('\n')) {
            if (line.includes("[infeasible]") || line.includes("[unspecified]") || line.includes("[time limit reached]")) {
                break;
            }
            if (line.includes("[optimal]")) {
                feasible = true;
            }
            if (feasible && solutionArea && !line.includes("All other variables are zero") && line.includes("\t")) {
                let splitLine = line.split("\t");
                for (let s = 0; s < splitLine.length; s = s+2) {
                    solutionMap[splitLine[s]] = splitLine[s+1];
                }
            }
            else if (line.includes("Primal solution (name, value):")) solutionArea = true;
        }
        let numberOfVotersToRemove = Number.MAX_SAFE_INTEGER;
        if (feasible && solutionMap["sum"] < Number.MAX_SAFE_INTEGER) numberOfVotersToRemove = solutionMap["sum"];

        if (parseInt(numberOfVotersToRemove) < parseInt(currentLowest)) {
            winners = [];
            winners.push(c);
            tooltip = numberOfVotersToRemove + " voters need to be removed.";
            currentLowest = numberOfVotersToRemove;
        }
        else if (numberOfVotersToRemove === currentLowest) winners.push(c);
    }

    return {
        success: true,
        type: types.Lotteries,
        tooltip: tooltip,
        result: helper.getWinnerLotteries(winners.sort(),alternativeSize)
    }
};

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
    let tooltip;
    //if there is one return it
    if(condorcet>=0) {
        winners.push(condorcet);
        tooltip = "Strict Condorcet Winner!";

        // Test for majority winner
        let alternatives = data.staircase.length+1;
        let pluralityScore = new Array(alternatives).fill(0);

        let profile = data.profile;
        let sum = 0;
        for (let i = 0; i < profile.length; i++) {
            pluralityScore[profile[i].relation[0]] += profile[i].numberOfVoters;
            sum += profile[i].numberOfVoters;
        }

        if(pluralityScore[condorcet] > sum / 2.0)
            tooltip = "Majority Winner!";
    }
    else if (weakCondorcet >= 0) {
        tooltip = "Weak Condorcet Winners!";
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
        // for (let x = 0; x < margin.length; x++) {
        //     winners.push(x);
        // }
        winners.push(-1);
        tooltip = "No (weak) Condorcet Winner!";
    }

    return {
        success: true,
        type: types.Lotteries,
        tooltip: tooltip,
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
    let tooltip = "Dominations:/n";

    // Check for Pareto domination
    xLoop:
    for (let x = 0; x < margin.length; x++) {
        for (let y = 0; y < margin.length; y++) {
            if (margin[y][x] === numberOfVoters) {
                tooltip += "Alternative_"+x+" dominated by Alternative_"+y + "/n";
                continue xLoop;
            }
        }
        winners.push(x);
    }

    return {
        success: true,
        type: types.Lotteries,
        tooltip: winners.length === data.staircase.length+1 ? "" : tooltip,
        result: helper.getWinnerLotteries(winners,margin.length)
    }
};

/**
 * Compute the mixed Dominance - undominated alternatives
 */
exports.mixedDominance = function mixedDominance(data) {
    let margin = helper.getFullMargins(data.staircase);
    let alternatives = data.staircase.length+1;

    let winners = [];
    let tooltip = "Dominations:"+'/n';

    for (let a = 0; a < alternatives; a++) {
        let model = "Maximize\n" + "epsilon\n" + "Subject To\n";

        // weights are non-negative
        for (let b = 0; b < alternatives; b++) model += " w_" + b + " >= 0\n";

        // weights are a lottery
        let constraint = "";
        for (let b = 0; b < alternatives; b++) constraint += (constraint === "" ? "" : " + ") + " w_" + b;
        model += constraint+" = 1\n";

        for (let b = 0; b < alternatives; b++) {
            let constraint = "";
            for (let e = 0; e < alternatives; e++) {
                constraint += (constraint === "" ? "" : " + ") + margin[e][b] + " w_" + e;
            }
            model += constraint + " - epsilon >= " + margin[a][b] + "\n";
        }
        model += "END";

        let fileName = "SCIP/Mixed.Dominance.for.model.ID."+model.hashCode()+".lp";
        fs.writeFileSync(fileName, model); // Write the file SYNCHRONOUSLY (!)
        let output = execSync('./SCIP/bin/soplex --loadset=SCIP/bin/exact.set ' + fileName + ' -X', {stdio:[]}).toString();
        execSync('rm '+fileName); // Delete the temporary file

        let solutionMap = { epsilon: "0"};
        let solutionArea = false;
        let feasible = false;
        for (let line of output.split('\n')) {
            // console.log(line);
            if (line.includes("[infeasible]") || line.includes("[unspecified]") || line.includes("[time limit reached]")) {
                break;
            }
            if (line.includes("[optimal]")) {
                feasible = true;
            }
            if (feasible && solutionArea && !line.includes("All other variables are zero") && line.includes("\t")) {
                // console.log(line);
                let splitLine = line.split("\t");
                for (let s = 0; s < splitLine.length; s = s+2) {
                    solutionMap[splitLine[s]] = splitLine[s+1];
                }
            }
            else if (line.includes("Primal solution (name, value):")) solutionArea = true;
        }
        if (feasible && solutionMap["epsilon"] === "0") winners.push(a);
        else {
            tooltip += "Alternative_"+a+" dominated by: ";
            let fresh = true;
            for (let i = 0; i < alternatives; i++) if (solutionMap.hasOwnProperty("w_" + i)) {
                let coefficient = solutionMap["w_" + i];
                tooltip += (fresh ? "" : " + ") + ((coefficient !== "1" ? coefficient : "") + " Alternative_" + i);
                fresh = false;
            }
            tooltip += '/n';
        }
    }

    return {
        success: true,
        type: types.Lotteries,
        tooltip: winners.length === alternatives ? "" : tooltip,
        result: helper.getWinnerLotteries(winners,margin.length)
    }
};

/**
 * Compute the ranked Pairs winner of a given data object (and trivially try to break ties in favor of testCandidate if there is one)
 */
exports.allRankedPairsWinnersWithTrivialTieBreaking = function allRankedPairsWinnersWithTrivialTieBreaking(data) {
    let winners = [];
    for (let i = 0; i < data.staircase.length+1; i++) if (this.rankedPairsWinnerWithTestCandidate(data, i).success) winners.push(i);
    return {
        success: true,
        type: types.Lotteries,
        result: helper.getWinnerLotteries(winners,data.staircase.length+1)
    }
};

/**
 * Compute the ranked Pairs winner of a given data object (and trivially try to break ties in favor of testCandidate if there is one)
 */
exports.rankedPairsWinner = function rankedPairsWinner(data) {
    return this.rankedPairsWinnerWithTestCandidate(data, -1);
};

/**
 * Compute the ranked Pairs winner of a given data object (and trivially try to break ties in favor of testCandidate if there is one)
 */
exports.rankedPairsWinnerWithTestCandidate = function rankedPairsWinnerWithTestCandidate(data, testCandidate) {
    //Setup a priority queue
    let queue = new priorityQueue( (a,b) => a.weight > b.weight);
    let stair = data.staircase;
    let size = stair[0].length + 1;

    //Buildup weighted Graph
    for (let i = 0; i < stair.length; i++) {
        for (let j = 0; j < stair[i].length; j++) {
            let weight,from,to;

            if(stair[i][j]>0) {
                weight = stair[i][j];
                from = i;
                to = j+i+1;
            } else {
                weight = -stair[i][j];
                to = i;
                from = j+i+1;
            }
            //Buildup sorted pairlist: margin -> pair
            queue.push(new exports._Edge(from,to,weight));
        }
    }

    let graph = [];
    for (let i = 0; i < size; i++) {
        graph.push(new exports._Node(size,graph));
    }

    let domID,subID = 0;
    let weight = Number.MAX_SAFE_INTEGER;
    let tieBreakingTestActive = false;
    let forbiddenEdges = [];

    //Graph Search
    while(!queue.isEmpty()) {
        let edge = queue.pop();
        //Find maximum -> (dom,sub)

        // In the case of indifference: Break the tie in favor of the test candidate
        if (edge.to === testCandidate && edge.weight === 0) {
            edge.to = edge.from;
            edge.from = testCandidate;
        }

        domID = edge.from;
        let dom = graph[domID];
        subID = edge.to;
        let sub = graph[subID];
        //if sub is not strongerThan dom:
        if(!sub.isStrongerThan(domID)) {


            // If we are trying another edge to help the test candidate to survive and this other edge has a smaller weight,
            // then we cannot help the test candidate any more with trivial tie-breaking and we have to abort.
            if (tieBreakingTestActive && edge.weight < weight) {
                return {
                    success: false,
                    msg: "No trivial tie-breaking with testCandidate" + testCandidate + " possible!"
                }
            } else if (tieBreakingTestActive && edge.weight === weight && edge.to !== testCandidate) {
                for (let f = 0; f < forbiddenEdges.length; f++) queue.push(forbiddenEdges[f]);
                forbiddenEdges = [];
                tieBreakingTestActive = false;
            } else weight = edge.weight;

            // If this edge would make the test candidate lose, then discard the edge temporarily and try with another edge with the same weight
            if (edge.to === testCandidate) {
                forbiddenEdges.push(edge);
                tieBreakingTestActive = true;
                continue;
            }

            // dom + dom.weakerThan  ->  sub.weakerThan + transitive
            let strongSet = dom.weakerThan.union(new Set([domID]));
            sub.submitTo(strongSet);

            // sub + sub.strongerThan  ->  dom.strongerThan + transitive
            let weakSet   = sub.strongerThan.union(new Set([subID]));
            dom.dominate(weakSet);
        }

        for (let i = 0; i < size; i++) {
            if(graph[i].isWinner()) {
                return {
                    success: true,
                    type: types.Lotteries,
                    result: helper.getWinnerLotteries([i],size)
                }
            }
        }
    }

    for (let i = 0; i < size; i++) {
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
};

/**
 * Compute the split cycle according to https://arxiv.org/pdf/2004.02350.pdf and https://nbviewer.jupyter.org/github/epacuit/splitcycle/blob/master/SplitCycleExamples.ipynb
 */
exports.splitCycle = function splitCycle(data) {
    let margin = helper.getFullMargins(data.staircase);

    let winners = [];
    let rows = margin.length;
    let columns = margin.length;
    let cycleNumber = Array(rows).fill().map(() => Array(columns).fill(0));

    let johnsonGraph = new Graph();

    // Add a node for every alternative to the graph with no label
    for (let x = 0; x < margin.length; x++) {
        johnsonGraph.nodes.push(x);
    }


    // Add an edge for every majority comparison
    for (let x = 0; x < margin.length; x++) {
        let targets = [];
        for (let y = 0; y < margin.length; y++) {
            if (margin[x][y] > 0) {
                targets.push(y);
            }
        }
        johnsonGraph.arrows.set(x,targets);
    }

    // console.log(johnsonGraph);
    // console.log("Circuits:");
    // console.log(johnsonGraph.findCircuits());

    let cycles = johnsonGraph.findCircuits();
    for (let i = 0; i < cycles.length; i++) {
        // console.log("New Cycle "+i+": ");
        // console.log(cycles[i]);

        let cycle = cycles[i];

        // Get the splitNumber, i.e., the smallest margin of the edges in the cycle
        let splitNumber = Number.MAX_VALUE;

        for (let node = 0; node < cycle.length - 1; node++) {
            let thisMargin = margin[cycle[node]][cycle[node+1]];
            thisMargin = thisMargin > 0 ? thisMargin : Number.MAX_VALUE;
            if (thisMargin < splitNumber) {
                splitNumber = thisMargin;
            }
        }
        let lastMargin = margin[cycle[cycle.length-1]][cycle[0]];
        lastMargin = lastMargin > 0 ? lastMargin : Number.MAX_VALUE;
        if (lastMargin < splitNumber) {
            splitNumber = lastMargin;
        }

        // console.log("Node: "+ splitNumber);

        // Update the cycle numbers by the split number
        for (let node = 0; node < cycle.length - 1; node++) {
            if (splitNumber > cycleNumber[cycle[node]][cycle[node+1]]) {
                cycleNumber[cycle[node]][cycle[node+1]] = splitNumber;
            }
        }
        if (splitNumber > cycleNumber[cycle[cycle.length-1]][cycle[0]]) {
            cycleNumber[cycle[cycle.length-1]][cycle[0]] = splitNumber;
        }
        // console.log("Cycle Numbers after cycle "+i+": ");
        // console.log(cycleNumber);
    }

    let defeatRelation = Array(rows).fill().map(() => Array(columns).fill(0));
    for (let x = 0; x < margin.length; x++) {
        for (let y = 0; y < margin.length; y++) {
            if (margin[x][y] > cycleNumber[x][y])
                defeatRelation[x][y] = 1;
        }
    }

    // console.log("defeat relation");
    // console.log(defeatRelation);

    // All undefeated alternatives are winners
    for (let x = 0; x < margin.length; x++) {
        let defeated = false;
        for (let y = 0; y < margin.length; y++) {
            if (defeatRelation[y][x])
                defeated = true;
        }
        if (!defeated) winners.push(x);
    }

    return {
        success: true,
        type: types.Lotteries,
        tooltip: "",
        result: helper.getWinnerLotteries(winners,margin.length)
    }
};

/**
 * Graph helper functions
 */

//Weighted Edge objects
exports._Edge = function Edge(from,to,weight) {
    this.from = from;
    this.to = to;
    this.weight = weight;
};

//Node objects storing stronger and weaker nodes
exports._Node = function Node(graphSize,graph) {
    this.size = graphSize;
    this.graph = graph;
    this.weakerThan = new Set();
    this.strongerThan = new Set();
};

exports._Node.prototype.isWinner = function () {
    return this.strongerThan.size === (this.size-1);
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
};


/**
 * Johnson's algorithm to find cycles - https://gist.github.com/m-mujica/1d1f25579a49bee300813aa1dc76da2a
 */
function Graph() {
    this.nodes = [];
    this.arrows = new Map();
}

// Tarjan's strongly connected components algorithm
Graph.prototype.stronglyConnectedComponents = function tarjan() {
    var index = 0;
    var stack = [];
    var result = [];
    var meta = new Map();

    var graph = this;

    var connect = function connect(node) {
        var entry = {
            onStack: true,
            index: index,
            lowLink: index
        };

        meta.set(node, entry);
        stack.push(node);
        index += 1;

        graph.arrows.get(node).forEach(function(adj) {
            if (!meta.has(adj)) {
                // adjacent node has not yet been visited, do it
                connect(adj);
                entry.lowLink = Math.min(entry.lowLink, meta.get(adj).lowLink);
            } else if (meta.get(adj).onStack) {
                entry.lowLink = Math.min(entry.lowLink, meta.get(adj).index);
            }
        });

        // check if node is a root node, pop the stack and generated an SCC
        if (entry.lowLink === entry.index) {
            var scc = [];
            var adj = null;

            do {
                adj = stack.pop();
                meta.get(adj).onStack = false;
                scc.push(adj);
            } while (node !== adj);

            result.push(scc);
        }
    };

    graph.nodes.forEach(function(node) {
        if (!meta.has(node)) {
            connect(node);
        }
    });

    return result;
};

// Based on Donald B. Johnson 1975 paper
// Finding all the elementary circuits of a directed graph
Graph.prototype.findCircuits = function findCircuits() {
    var startNode;
    var stack = [];
    var circuits = [];
    var blocked = new Map();

    // book keeping to prevent Tarjan's algorithm fruitless searches
    var b = new Map();

    var graph = this;

    function addCircuit(start, stack) {
        var orders = [start.order].concat(
            stack.map(function(n) {
                return n.order;
            })
        );

        // prevent duplicated cycles
        // TODO: figure out why this is needed, this is most likely related to
        // startNode being the "least" vertex in Vk
        if (Math.min.apply(null, orders) !== start.order) {
            circuits.push([].concat(stack).concat(start));
        }
    }

    function unblock(u) {
        blocked.set(u, false);

        if (b.has(u)) {
            b.get(u).forEach(function(w) {
                b.get(u).delete(w);
                if (blocked.get(w)) {
                    unblock(w);
                }
            });
        }
    }

    function circuit(node) {
        var found = false;

        stack.push(node);
        blocked.set(node, true);

        graph.arrows.get(node).forEach(function(w) {
            if (w === startNode) {
                found = true;
                addCircuit(startNode, stack);
            } else if (!blocked.get(w)) {
                if (circuit(w)) {
                    found = true;
                }
            }
        });

        if (found) {
            unblock(node);
        } else {
            graph.arrows.get(node).forEach(function(w) {
                var entry = b.get(w);

                if (!entry) {
                    entry = new Set();
                    b.set(w, entry);
                }

                entry.add(node);
            });
        }

        stack.pop();
        return found;
    }

    // console.log("Output start")
    // console.log(graph.arrows.get(0))
    // console.log("Output end")

    graph.nodes.forEach(function(node) {
        startNode = node;
        graph.arrows.get(node).forEach(circuit);
    });

    return circuits;
};