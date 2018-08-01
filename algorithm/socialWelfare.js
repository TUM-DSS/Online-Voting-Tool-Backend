const helper = require('./helper');
const types = require('./answerTypes');
const socialChoice  = require('./socialChoice');
const solver = require('javascript-lp-solver');

/**
 * Compute the social welfare functions
 */

/**
 * Find the Ranked Pair Profile of a given data object by repeated calls to tideman.
 */
exports.rankedPairs = function rankedPairs(data) {
    let size = data.staircase[0].length + 1;
    let index = Array.from(new Array(size), (x,i) => i);
    let ranking = [];

    while(index.length > 1) {
        let dom = socialChoice.rankedPairsWinner(data).result[0].findIndex(x => x>0);
        ranking.push(index[dom]);
        index.splice(dom,1);
        data.staircase = helper.stairSplice(data.staircase,dom);
    }

    if(index.length == 1) {
        ranking.push(index[0]);
    }

    return {
        success: true,
        type: types.Profile,
        result: ranking
    }
}

/**
 * Find the Kemeny Profile of a given data object
 */
exports.kemeny = function kemeny(data) {
    let size = data.staircase[0].length+1;

    //Abort Search after 10 Seconds
    let abortTime = (+new Date()) + 10000;

    let permutations = exports._getPermutations(size,abortTime);

    let maxScore = -Infinity;
    let maxPerm = []

    for (perm of permutations) {
        if((+new Date)> abortTime) {
            return {
                success:false,
                msg:"Server Timeout"
            }
        }

        let score = exports._getKemenyScore(perm,data.staircase);
        if(score > maxScore) {
            maxPerm = perm;
            maxScore = score;
        }
    }
    return {
        success:true,
        type: types.Profile,
        result: maxPerm
    }
};

/**
 * Find the Kemeny Profile of a given data object (with ILP)
 */
exports.kemenyILP = function kemenyILP(data) {
    let size = data.staircase[0].length+1;
    let margin = helper.getFullMargins(data.staircase);

    let model = ["max: Value"];
    let sum = "0.0";
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) if (i !== j) {
            let name = "d_"+i+"_"+j;
            model.push("int " + name);
            model.push(name + " >= 0");
            model.push(name + " <= 1");
        }
    }

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) if (i !== j) {
            if (i < j) {
                // Anti-Symmetry
                model.push("d_"+i+"_"+j + " + d_"+j+"_"+i + " = 1");
                sum += " + " + margin[i][j]+ " d_"+i+"_"+j;
            }
            for (let k = 0; k < size; k++) if (i !== k && j !== k) {
                // Transitivity
                model.push("d_"+i+"_"+j + " + d_"+j+"_"+k + " + d_"+k+"_"+i +" >= 1");
            }
        }
    }

    model.push(sum + " -1 Value = 0");

    let reformattedModel = solver.ReformatLP(model);
    let solution = solver.Solve(reformattedModel);

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) if (i !== j) {
            let name = "d_" + i + "_" + j;
            if (solution.hasOwnProperty(name)) {
                margin[i][j] = solution[name];
            }
            else {
                margin[i][j] = solution["d_" + j + "_" + i] === 0 ? 1 : 0;
            }
        }
    }

    let sortedAlready = [];
    // Search for the respectively maximal element
    let max = 0;
    whileLoop:
    while (sortedAlready.length < size) {
        while (sortedAlready.includes(max)) {
            max++;
        }
        for (let i = 0; i < size; i++) if (!sortedAlready.includes(i) && max !== i) {
            if (margin[i][max] > 0) {
                max++;
                continue whileLoop;
            }
        }
        sortedAlready.push(max);
        max = 0;
    }


    return {
        success:true,
        type: types.Profile,
        result: sortedAlready
    }
};

/**
 * Helper function: Computes the Kemeny Score of a given profile, given the staircase
 */
exports._getKemenyScore = function getKemenyScore(profile,stair) {
    let score = 0;
    for (var i = 0; i < profile.length; i++) {
        for (var j = i+1; j < profile.length; j++) {
            let top = profile[i];
            let bottom = profile[j];
            let sTop = Math.min(top,bottom);
            let sBottom = Math.max(top,bottom)-(sTop+1);

            if(top>bottom) {
                score-=stair[sTop][sBottom]
            } else {
                score+=stair[sTop][sBottom]
            }
        }
    }
    return score;
}

/**
 * Enumerates all possible permutations on n objects
 * can timeout
 */
exports._getPermutations = function getPermutations(size, abortTime) {
    let data = Array.from(new Array(size), (x,i) => i);

    let result = [];
    const permute = (arr, m = []) => {
        if(abortTime < +new Date()) {
            return;
        }


        if (arr.length === 0) {
            result.push(m)
        } else {
            for (let i = 0; i < arr.length; i++) {
                let curr = arr.slice();
                let next = curr.splice(i, 1);
                permute(curr.slice(), m.concat(next))
            }
        }
    }

    permute(data);
    return result;
}

/**
 * Find the Schulze Profile of a given data object
 */
exports.schulze = function schulze(data) {
    stair = data.staircase;
    power = helper.getFullMargins(stair).map(arr => arr.map(x => x>0?x:0));
    size = power.length;

    //Use Floyd-Warshall for graph search
    for (var i = 0; i < size; i++) {
        for (var j = 0; j < size; j++) {
            if(i != j) {
                for (var k = 0; k < size; k++) {
                    if(i != k && j!=k) {
                        power[j][k] = Math.max(power[j][k],Math.min(power[j][i],power[i][k]));
                    }
                }
            }
        }
    }

    //Compute the schulze majority margins
    for (var i = 0; i < size; i++) {
        for (var j = i+1; j < size; j++) {
            let si = i;
            let sj = j-(i+1);
            stair[si][sj] = Math.sign(power[i][j] - power[j][i])
        }
    }

    profile = exports._schulzeProfileExtract(stair);

    if(typeof profile == "undefined") {
        return {
            success: false,
            msg:"Schulze Method can't find enough dominant edges."
        }
    }
    return {
        success:true,
        type: types.Profile,
        result: profile
    };
}

/**
 * Extract the Schulze Preference Profile from its majority margin
 */
exports._schulzeProfileExtract = function (stair) {
    let margin = helper.getFullMargins(stair);
    let index = Array.from(new Array(size), (x,i) => i);
    let profile = [];

    while(index.length > 0) {
        //Iteretively get the best option, remove it from the stair and add it to the profile
        score = margin.map(arr => arr.reduce((acc,val)=> acc+(val>0?1:0)));
        max = margin.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);

        profile.push(index[max]);
        index.splice(max,1);
        margin.splice(max,1);
        margin.forEach(arr => arr.splice(max,1));
    }
    return profile;
};
