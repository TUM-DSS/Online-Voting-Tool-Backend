//Answers Extract Queries
const express = require('express');
const router = express.Router();
// const solver = require('javascript-lp-solver');
const helper = require('../algorithm/helper');

// var exec = require('child_process').exec, child;
const execSync = require('child_process').execSync;
// const util = require('util');
const fs = require('fs');

let totalTimeout = 2;
let voterTimeoutLeft = totalTimeout;


/**
 * Handle extract requests
 * {staircase} => {success, profiles, minimal}
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
    let voteSize = staircase[0].length+1;

    // Assure that the input only contains integers and is of correct parity
    staircase[0][0] = Math.round(staircase[0][0]); // The first entry is rounded to nearest integer
    let parity = Math.abs(staircase[0][0] % 2); // The parity is defined by the first entry
    for(let i=0; i<staircase.length; i++) {
        for(let j=0; j<staircase[i].length; j++) {
            if (i===0 && j===0) {
                continue;
            }
            if(!Number.isInteger(staircase[i][j])) {
                if (Math.abs(Math.ceil(staircase[i][j]) % 2) === parity) {
                    staircase[i][j] = Math.ceil(staircase[i][j]);
                }
                else {
                    staircase[i][j] = Math.floor(staircase[i][j]);
                }
                // console.log(i+" "+j+": "+staircase[i][j]);
            }
            else if (Math.abs(staircase[i][j] % 2) !== parity) {
                staircase[i][j] = staircase[i][j] > 0 ? staircase[i][j] + 1 : staircase[i][j] - 1;
            }
        }
    }

    let pdic = {}
    do {
        //Get the biggest Element of the Staircase
        let arr = staircase.reduce((acc,val) => acc.concat(val))
            .map(p => Math.abs(p));
        var maxStar = Math.max.apply(null,arr);

        //Repeat Extracting profiles
        for (var k = 0; k < maxStar; k++) {
            //Helping Datastructures:
            //Profile is the returned preference relation
            //Score is the current position in the prefernence ranking (large score is low position in the ranking)
            profile = new Array(voteSize).fill(0);
            let score = new Array(voteSize).fill(0);

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

    let out = [];
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
    // Avoid I/O collisions
    let staircaseHash = staircase.toString().hashCode();

    // Check whether SoPlex binary file exists
    // const file = 'SCIP/bin/soplex';
    // fs.access(file, fs.constants.F_OK, (err) => {
    //     console.log(`${file} ${err ? 'does not exist' : 'exists'}`);
    // });

    // Check whether there are non-integer values
    let nonIntegerValues = false;
    for(let i=0; i<staircase.length; i++) {
        for(let j=0; j<staircase[i].length; j++) {
            if(!Number.isInteger(staircase[i][j])) {
                nonIntegerValues = true;
            }
        }
    }

    // Start with the largest margin as the first try for the minimal number of voters
    let maxRow = margin.map(function(row){ return Math.max.apply(Math, row); });
    let n = Math.floor(Math.max.apply(null, maxRow));
    // Start with the largest sum of the weights of any three-cycle
    // Improvement by Florian: Also take into account negative weights, i.e., three-cycles which are actually transitive
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) { // if (margin[i][j] > 0)
            for (let k = 0; k < size; k++) { // if (margin[j][k] > 0 && margin[k][i] > 0)
                let value1 = Math.sign(margin[i][j])*Math.floor(Math.abs(margin[i][j]));
                let value2 = Math.sign(margin[j][k])*Math.floor(Math.abs(margin[j][k]));
                let value3 = Math.sign(margin[k][i])*Math.floor(Math.abs(margin[k][i]));
                let sum = value1 + value2 + value3;
                if (n < sum) n = sum;
            }
        }
        }
    if (n === 0)
        n = 2;

    // Compute the backup solution in advance (via hard copy just to be sure)
    let backup = extractOld(JSON.parse(JSON.stringify(staircase)));
    let voterCount = 0;
    for (let prof of backup.profile) {
        voterCount += prof.numberOfVoters;
    }
    // If the backup solution is already minimal, then return it
    // Attention: This prevents any randomization otherwise used for finding a minimal profile
    if (voterCount === n && !nonIntegerValues) {
        backup.minimal = true;
        return backup;
    }

    // If the heuristic yields very large profile,
    // then start with it and try to decrease the size of the profile
    let downwardOptimization = false;
    // Attention: This is temporarily deactivated because analyzing three-cycles turns out to usually be a better heuristic!
    // if (voterCount > n + 20){
        // downwardOptimization = true;
        // n = voterCount - 2;
    // }


    let totalStartTime = (+new Date());

    try {
        // Check if there is preference profile with exactly n voters
        do {
            // console.log("Checking for "+n);
            voterTimeoutLeft = totalStartTime + (totalTimeout * 1000) - (+new Date());
            if (voterTimeoutLeft < 0) {
                throw "Timeout!";
            }
            let startTime = (+new Date());
            let modelStringForSCIP = "Minimize\n" + "0\n" + "Subject To\n";
            let variableNames = [];
            for (let v = 0; v < n; v++) {
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) if (i !== j) {
                        let name = "v_"+v+"_d_"+i+"_"+j;
                        variableNames.push(name);
                    }
                }
            }

            for (let v = 0; v < n; v++) {
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) if (i !== j) {
                        if (i < j) {
                            // Anti-Symmetry
                            modelStringForSCIP += "v_"+v+"_d_"+i+"_"+j + " + "+"v_"+v+"_d_"+j+"_"+i + " = 1\n";
                        }
                        for (let k = 0; k < size; k++) if (i !== k && j !== k) {
                            // Transitivity
                            modelStringForSCIP += "v_"+v+"_d_"+i+"_"+j + " + "+"v_"+v+"_d_"+j+"_"+k + " + "+"v_"+v+"_d_"+k+"_"+i +" >= 1\n";
                        }
                    }
                }
            }


            // Connect voters and matrix
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) if (i !== j) {
                    if (i < j) {
                        let sum = "";
                        for (let v = 0; v < n; v++) {
                            sum += " + v_"+v+"_d_"+i+"_"+j + " - v_"+v+"_d_"+j+"_"+i;
                        }
                        let thisMargin = margin[i][j];

                        if (thisMargin % 1 === 0) {
                            modelStringForSCIP += sum + " = " + thisMargin + "\n";
                        }
                        else if (thisMargin > 0 && thisMargin % 1 < 0.5) {
                            modelStringForSCIP += sum + " <= " + thisMargin + "\n";
                            modelStringForSCIP += sum + " >= " + 0 + "\n";
                        }
                        else if (thisMargin > 0 && thisMargin % 1 > 0.5) {
                            modelStringForSCIP += sum + " >= " + thisMargin + "\n";
                        }
                        else if (thisMargin > 0 && thisMargin % 1 === 0.5) {
                            modelStringForSCIP += sum + " >= " + (thisMargin-1) + "\n";
                            modelStringForSCIP += sum + " <= " + (thisMargin+1) + "\n";
                        }
                        else if (thisMargin < 0 && thisMargin % 1 > -0.5) {
                            modelStringForSCIP += sum + " >= " + thisMargin + "\n";
                            modelStringForSCIP += sum + " <= " + 0 + "\n";
                        }
                        else if (thisMargin < 0 && thisMargin % 1 < -0.5) {
                            modelStringForSCIP += sum + " <= " + thisMargin + "\n";
                        }
                        else if (thisMargin < 0 && thisMargin % 1 === -0.5) {
                            modelStringForSCIP += sum + " >= " + (thisMargin-1) + "\n";
                            modelStringForSCIP += sum + " <= " + (thisMargin+1) + "\n";
                        }
                        else {
                            throw "This case was not planned: " + thisMargin;
                        }
                    }
                }
            }

            modelStringForSCIP += "Binary\n";
            for (let i = 0; i < variableNames.length; i++) {
                modelStringForSCIP += " " + variableNames[i] + "\n";
            }
            modelStringForSCIP += "END";
            // console.log("SCIP Model Time: "+ (((+new Date()) - startTime) / 1000));

            // startTime = (+new Date());
            let fileName = "SCIP/" + (downwardOptimization ? "downward" : "" ) + "profileProblem.for.ID."+staircaseHash+".and."+n+".voters.lp";
            // console.log(fileName);
            fs.writeFileSync(fileName, modelStringForSCIP); // Write the file SYNCHRONOUSLY (!)
            // console.log("Write Time: "+ (((+new Date()) - startTime) / 1000));

            // Template to call SCIP or SoPlex via synchronous execution: https://stackoverflow.com/a/28394895/4050546
            // let solutionSTRING = "";
            //SCIP: ./SCIP/bin/scip -c "read problem.lp set limits time 1 optimize display solution quit"
            // SoPlex: ./SCIP/bin/soplex --loadset=SCIP/bin/exact.set SCIP/problem.lp -X
            // startTime = (+new Date());
            // Random seed to get different results when searching for profiles with specific manipulator
            let randomSeedOne = Math.floor(Math.random() * 2147483647);
            let randomSeedTwo = Math.floor(Math.random() * 2147483647);
            let output = execSync('./SCIP/bin/scip -c "read '+fileName+' set limits time ' + (voterTimeoutLeft/1000) + ' set randomization randomseedshift '+randomSeedOne+' set randomization permutationseed '+randomSeedTwo+' optimize display solution quit"').toString();
            // console.log(output);
            // console.log("Solve Time: "+ (((+new Date()) - startTime) / 1000));

            // startTime = (+new Date());
            let solutionSTRING = "";
            let solutionArea = false;
            let feasible = false;
            for (let line of output.split('\n')) {
                // console.log(line);
                if (line.includes("[infeasible]")) {
                    if (downwardOptimization) {
                        execSync('rm '+fileName); // Delete the temporary file
                        backup.minimal = true;
                        return backup;
                    }
                    break;
                }
                if (line.includes("[time limit reached]")) {
                    execSync('rm '+fileName); // Delete the temporary file
                    throw "Internal Timeout!";
                }
                if (line.includes("[optimal solution found]")) {
                    feasible = true;
                }
                if (feasible && solutionArea) solutionSTRING += line + "\n";
                else if (line.includes("objective value:")) solutionArea = true;
            }
            // console.log("String Time: "+ (((+new Date()) - startTime) / 1000));

            execSync('rm '+fileName); // Delete the temporary file

            // console.log("Total time: "+ (((+new Date()) - totalStartTime) / 1000) + " of total " + totalTimeout);

            // If the ILP is feasible, return the preference profile or store it as backup in the case of downward optimization
            if (feasible) {
                startTime = (+new Date());
                let profile = {};

                let matrix = [];
                for(let i = 0; i < size; i++) {
                    matrix[i] = new Array(size);
                }

                for (let v = 0; v < n; v++) {
                    // Extract the solution for voter v into a matrix
                    for (let i = 0; i < size; i++) {
                        for (let j = 0; j < size; j++) if (i !== j) {
                            matrix[i][j] = solutionSTRING.includes("v_"+v+"_d_" + i + "_" + j);
                        }
                    }

                    // Use the get Ranking from Matrix function
                    let ranking = helper.getRankingFromMatrix(matrix);

                    //Add the ranking to the map if it is new
                    if(!(ranking in profile)) {
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
                // console.log("Output Time: "+ (((+new Date()) - startTime) / 1000));
                if (downwardOptimization) {
                    backup = {
                        profile: out,
                        minimal: false
                    };
                } else {
                    return {
                        profile: out,
                        minimal: true
                    };
                }
            }

            // If not, increment (or decrement in case of downward optimization) n by two and start again;
            let step = nonIntegerValues ? 1 : 2;
            n = downwardOptimization ? n - step : n + step;
        } while (true);
    }
    catch (e) {
        // If ILP failed or timed out or something else failed, then use Dominik's staircase algorithm as backup
        console.log("Extraction with ILP failed due to " + e + "! Backup algorithm is used!");
        // fs.writeFileSync("log"+(+(new Date()))+".txt", "Extraction with ILP failed due to " + e + "! Backup algorithm is used!");
    }
    return backup;
}

String.prototype.hashCode = function() {
    var hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
        chr   = this.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};