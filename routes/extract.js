//Answers Extract Queries
const express = require('express');
const router = express.Router();
const solver = require('javascript-lp-solver');
const helper = require('../algorithm/helper');


/**
 * Handle extract requests
 * {staircase} => {success, profies}
 */
router.post("",(req,res,next) => {
    let answer = extract(req.body.staircase);

    let response = {
        success: true,
        profiles: answer.profile,
        minimal: answer.minimal
    };

    res.send(response);
});

module.exports = router;

module.exports.extract = extract;


/**
 * Implementation of the staircase algorithm.
 */
function extractOld (staircase) {
    voteSize = staircase[0].length+1;

    let pdic = {}
    do {
        //Get the biggest Element of the Staircase
        arr = staircase.reduce((acc,val) => acc.concat(val))
            .map(p => Math.abs(p));
        maxStar = Math.max.apply(null,arr)

        //Repeat Extracting profiles
        for (var k = 0; k < maxStar; k++) {
            //Helping Datastructures:
            //Profile is the returned preference relation
            //Score is the current position in the prefernence ranking (large score is low position in the ranking)
            profile = new Array(voteSize).fill(0);
            score = new Array(voteSize).fill(0);

            //Iterate through the staircase
            for (var i = 0; i < voteSize; i++) {
                let inc = 0;
                for(var j = i+1; j < voteSize; j++) {
                    let si = i;
                    let sj = j-(i+1);
                    //If the j is prefered over i by the current preference relation or
                    //i is at least prefered/indifferent by the majority staircase...
                    if(score[i] > score[j] || (score[i]==score[j] && staircase[si][sj]<0)) {
                        //Increment the score of i -> becomes lower ranked (score of i is updated at the end of the iteration)
                        inc++;
                        //update the staircase
                        staircase[si][sj]++;
                    } else {
                        // i is prefered over j
                        //j becomes lower ranked
                        score[j]++;
                        staircase[si][sj]--;
                    }
                }
                score[i]+=inc;
                //Set the final position of i
                profile[score[i]] = i;
            }
            //Add the profile to the map if it is new
            if(! (profile in pdic)) {
                pdic[profile] = 0;
            }
            //Increment the number of voters of this profile.
            pdic[profile]++;
        }
    } while (maxStar > 0);

    out = [];
    //Transform the map to the server answer
    for (var profile in pdic) {
        if (pdic.hasOwnProperty(profile)) {
            out.push({
                relation: JSON.parse('['+profile+']'),
                numberOfVoters: pdic[profile]
            });
        }
    }

    //The algorithm terminated without an answer (i.e. the highest number in the matrix was zero)
    // -> Return the profile [1,2,....,n][n,n-1,...,1]
    if(out.length == 0) {
        let sort = Array.from(new Array(voteSize),(x,i)=> i);
        let s1 = {relation: JSON.parse('['+sort+']'),numberOfVoters: 1}
        let s2 = {relation: JSON.parse('['+sort.reverse()+']'),numberOfVoters: 1}
        out = [s1,s2]
    }

    return {
        profile: out,
        minimal: false
    };
}

function extractWithPromise (staircase) {
    let time = 10;

    // Create a promise that rejects in 'time' milliseconds and resolves with solution otherwise
    let getMinimalProfile =  new Promise((resolve,reject) => {
        console.log("In the promise!");

        setTimeout(() => {
            console.log("In the inner timeout!");
            // clearTimeout(id);
            reject('Timed out in '+ time + 'ms.')
        }, time);

        setTimeout(() => {
            console.log("Resolve!");
            resolve(extract(staircase));
        }, 1);

            // resolve(extractWithILP(staircase));
        });

    // Promise.race([getMinimalProfile]).then(  // timeout,
    getMinimalProfile.then(
        response => {
            console.log("New algorithm! ");
            return response;
        }).catch(
        error => {
            console.log("Old algorithm! "+error);
            return extractOld(staircase);
        });
}

function extract (staircase) {
    let size = staircase[0].length+1;
    let margin = helper.getFullMargins(staircase);

    // Start with the largest margin as the first try for the minimal number of voters
    let maxRow = margin.map(function(row){ return Math.max.apply(Math, row); });
    let n = Math.max.apply(null, maxRow);

    // Compute the backup solution in advance
    let backup = extractOld(staircase);
    let voterCount = 0;
    for (let prof of backup.profile) {
        voterCount += prof.numberOfVoters;
    }
    if (voterCount === n) {
        backup.minimal = true;
        return backup;
    }
    if (n > 7 || size > 6) {
        // We cannot yet stop the LP, so we do not try "large" instances at all for now
        // TODO: Remove this when we can stop the LP
        return backup;
    }

    let maxRunTime = 100;
    let latestFinish = (+new Date()) + maxRunTime;

    try {
        // Check if there is preference profile with exactly n voters
        do {
            console.log("Checking for "+n);
            if (latestFinish <= (+new Date())) {
                throw "Timeout!";
            }
            let model = ["min: 0"];
            for (let v = 0; v < n; v++) {
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) if (i !== j) {
                        let name = "v_"+v+"_d_"+i+"_"+j;
                        model.push("int " + name);
                        model.push(name + " >= 0");
                        model.push(name + " <= 1");
                    }
                }
            }

            for (let v = 0; v < n; v++) {
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) if (i !== j) {
                        if (i < j) {
                            // Anti-Symmetry
                            model.push("v_"+v+"_d_"+i+"_"+j + " + "+"v_"+v+"_d_"+j+"_"+i + " = 1");
                        }
                        for (let k = 0; k < size; k++) if (i !== k && j !== k) {
                            // Transitivity
                            model.push("v_"+v+"_d_"+i+"_"+j + " + "+"v_"+v+"_d_"+j+"_"+k + " + "+"v_"+v+"_d_"+k+"_"+i +" >= 1");
                        }
                    }
                }
            }


            // Connect voters and matrix
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) if (i !== j) {
                    if (i < j) {
                        let sum = "0.0";
                        for (let v = 0; v < n; v++) {
                            sum += " + v_"+v+"_d_"+i+"_"+j + " - v_"+v+"_d_"+j+"_"+i;
                        }
                        model.push(sum + " = " + margin[i][j]);
                    }
                }
            }

            let reformattedModel = solver.ReformatLP(model);

            // TODO : Support some form of timeout in the LP solver (!)
            // reformattedModel["expects"] = {
            //     _timeout: 1
            // };
            // const util = require('util');
            // console.log(util.inspect(reformattedModel, false, null));

            let solution = solver.Solve(reformattedModel);

            // console.log("Done with solving: "+solution["feasible"]);
            // console.log("Details: " + util.inspect(solution, false, null));

            if (solution["feasible"]) {
                // console.log("DONE! Time left: " + (-(+new Date()) + latestFinish));
                // If the ILP is feasible, return the preference profile
                let profile = {};

                let matrix = [];
                for(let i = 0; i < size; i++) {
                    matrix[i] = new Array(size);
                }

                for (let v = 0; v < n; v++) {
                    // Extract the solution for voter v into a matrix
                    for (let i = 0; i < size; i++) {
                        for (let j = 0; j < size; j++) if (i !== j) {
                            let name = "v_"+v+"_d_" + i + "_" + j;
                            if (solution.hasOwnProperty(name)) {
                                matrix[i][j] = solution[name];
                            }
                            else {
                                matrix[i][j] = solution["v_"+v+"_d_" + j + "_" + i] === 0 ? 1 : 0;
                            }
                        }
                    }

                    // Use the get Ranking from Matrix function
                    let ranking = helper.getRankingFromMatrix(matrix);

                    //Add the ranking to the map if it is new
                    if(! (ranking in profile)) {
                        profile[ranking] = 0;
                    }
                    //Increment the number of voters of this ranking.
                    profile[ranking]++;
                }

                // Result
                let out = [];
                //Transform the map to the server answer
                for (let ranking in profile) {
                    if (profile.hasOwnProperty(ranking)) {
                        out.push({
                            relation: JSON.parse('['+ranking+']'),
                            numberOfVoters: profile[ranking]
                        });
                    }
                }

                return {
                    profile: out,
                    minimal: true
                };
            }

            // If not, increment n by two and start again;
            n = n + 2;
        } while (true);
    }
    catch (e) {
        // If ILP failed or timed out or something else failed, then use Dominik's staircase algorithm as backup
        console.log("Extraction with ILP failed due to " + e + "! Backup algorithm is used!");
    }
    return backup;
}