//Answer efficiency queries.
const express = require('express');
const router = express.Router();
const solver = require('javascript-lp-solver');
const util = require('util');
const execSync = require('child_process').execSync;
const fs = require('fs');
const math = require('mathjs');

/**
 * Handle test requests
 * {lotteries,profile} => {success, sdresult, pcresult}
 * sdresult => [{success,efficient,dominator?,msg?}]
 * pcresult => [{success,efficient,dominator?,msg?}]
 */
router.post("",(req,res,next) => {
    let lotteries = req.body.lotteries;
    let exact = req.body.exact;
    let profile = req.body.profile;

    let response = (exact !== undefined) ?
        {
            success: true,
            sdresult: exactlyCheckSDEfficiency(exact,profile),
            pcresult: exactlyCheckPCEfficiency(exact,profile)
        }  :
        {
        success: true,
        sdresult: checkSDEfficiency(lotteries,profile),
        pcresult: checkPCEfficiency(lotteries,profile)
    };
    // console.log("Response",util.inspect(response));
    res.send(response);
});

module.exports = router;

function checkSDEfficiency(lotteries,profile) {
    let out = [];
    for (let lottery of lotteries) {
        let model = _getStochasticDominanceLP(lottery,profile);
        out.push(_getLotteryFromLPSolution(lottery, model));
    }
    return out;
}

function checkPCEfficiency(lotteries,profile) {
    let out = [];
    for (let lottery of lotteries) {
        let model = _getPairwiseComparisonLP(lottery,profile);
        out.push(_getLotteryFromLPSolution(lottery, model));
    }
    return out;
}

function exactlyCheckSDEfficiency(exactLotteries,profile) {
    let out = [];
    for (let lottery of exactLotteries) {
        let model = _getExactStochasticDominanceLP(lottery,profile);
        out.push(_getExactLotteryFromLPSolution(lottery, model));
    }
    return out;
}

function exactlyCheckPCEfficiency(exactLotteries,profile) {
    let out = [];
    for (let lottery of exactLotteries) {
        let model = _getExactPairwiseComparisonLP(lottery,profile);
        out.push(_getExactLotteryFromLPSolution(lottery, model));
    }
    return out;
}

/**
 * Solves a SD/PC LP and gets the dominating lottery if it extists.
 */
function _getLotteryFromLPSolution(lottery,model) {
    let solution = solver.Solve(model);

    if(solution.feasible) {
        if(solution.result === 0) {
            return {
                success: true,
                efficient: true
            }
        } else {
            let i;
            let dominator = [];

            //Extract the lottery from the LP solution
            for (i = 0; i < lottery.length; i++) {
                if(solution.hasOwnProperty(_qLotteryName(i))) {
                    dominator.push(solution[_qLotteryName(i)]);
                } else {
                    dominator.push(0);
                }
            }

            let diff = 0;
            for (i = 0; i < dominator.length; i++) {
                diff+= Math.abs(dominator[i] - lottery[i]);
            }

            if(diff < 0.0000001) {
                //The solution is caused by rounding error
                return {
                    success: true,
                    efficient: true
                }
            }

            return {
                success: true,
                efficient: false,
                dominator: dominator
            }
        }
    } else {
        console.log("Failed",solution);
        return {
            success: false,
            msg: "LP infeasible"
        }
    }
}

/**
 * Exactly solves a SD/PC LP and gets the exact dominating lottery if it exists.
 */
function _getExactLotteryFromLPSolution(lottery,model) {
    let fileName = "SCIP/Efficiency.for.model.ID."+model.hashCode()+".lp";
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
        if (feasible && solutionArea) {
            let splitLine = line.split("\t");
            solutionMap[splitLine[0]] = splitLine[1];
        }
        else if (line.includes("Primal solution (name, value):")) solutionArea = true;
    }

    if(feasible) {

        if(solutionMap["epsilon"] === "0") {
            return {
                success: true,
                efficient: true
            }
        } else {
            let i;
            let dominator = [];

            //Extract the lottery from the LP solution
            for (i = 0; i < lottery.length; i++) {
                if(solutionMap[_qLotteryName(i)] !== undefined) {
                    let solutionString  = solutionMap[_qLotteryName(i)];
                    if (solutionString.includes("/")){
                        let solutionArray = solutionString.split("/");
                        dominator.push([parseInt(solutionArray[0]),parseInt(solutionArray[1])]);
                    }

                    else
                        dominator.push([1,0]);
                } else {
                    dominator.push([0,1]);
                }
            }

            return {
                success: true,
                efficient: false,
                dominator: dominator
            }
        }
    } else {
        console.log("Failed",output);
        return {
            success: false,
            msg: "LP infeasible"
        }
    }
}

/**
 *  Get the LP for Checking PC efficiency
 */
function _getPairwiseComparisonLP(lottery,preferenceProfile) {
    let nrOfCandidates = lottery.length;
    let nrOfVoters = preferenceProfile.length;

    //max  sum_(i in voters) e_i
    let rGoal = "max: ";
    for (var i = 0; i < nrOfVoters; i++) {
        rGoal+="1 "+_getEpsilonName(i)+" ";
    }

    let model = [rGoal];

    //forall i e_i >= 0
    for (var i = 0; i < nrOfVoters; i++) {
        model.push("1 "+_getEpsilonName(i)+" >= 0");
    }

    // q is a lottery
    //sum_(i in voters) q_i = 1
    //forall i q_i >=0
    let constraint = "";
    for (var i = 0; i < nrOfCandidates; i++) {
        constraint += "1 "+_qLotteryName(i)+" ";
        model.push("1 "+_qLotteryName(i)+" >= 0");
    }
    model.push(constraint+" = 1");

    for (var i = 0; i < nrOfVoters; i++) {
        // sum_(x >=_i y) (q(x)p(y)-q(y)p(x))  - e(i) >= 0 forall voters i, candidates y
        let constraint = "";

        let qIndex = Array.from(new Array(nrOfCandidates), (x,i) => 0);

        for (var y = 0; y < nrOfCandidates; y++) {
            for(let xind = preferenceProfile[i].indexOf(y)-1; xind > -1; xind--) {
                let x = preferenceProfile[i][xind];
                //p(y)q(x)
                qIndex[x] += lottery[y]
                // -p(x)q(y)
                qIndex[y] -= lottery[x]
            }
        }

        for (var l = 0; l < qIndex.length; l++) {
            if(Math.abs(qIndex[l])>0.000001) {
                constraint += qIndex[l]+"  "+_qLotteryName(l)+" ";
            }
        }

        if(constraint.length > 0) {
            model.push(constraint+ " -1 "+_getEpsilonName(i)+" >= 0");
        }
    }
    return solver.ReformatLP(model);
}

/**
 *  Get the LP for exactly checking PC efficiency
 */
function _getExactPairwiseComparisonLP(lottery,preferenceProfile) {
    let nrOfCandidates = lottery.length;
    let nrOfVoters = preferenceProfile.length;
    let i;

    let model = "Maximize\n" + "epsilon\n" + "Subject To\n";

    //max  sum_(i in voters) e_i
    let rGoal = "";
    for (i = 0; i < nrOfVoters; i++) {
        rGoal+=( i===0 ? "  " : "+ ")+_getEpsilonName(i)+" ";
    }
    model += rGoal + " - epsilon = 0\n";

    //forall i e_i >= 0
    for (i = 0; i < nrOfVoters; i++) {
        model += _getEpsilonName(i)+" >= 0\n";
    }

    // q is a lottery
    //sum_(i in voters) q_i = 1
    //forall i q_i >=0
    let constraint = "";
    for (i = 0; i < nrOfCandidates; i++) {
        constraint += "+ "+_qLotteryName(i)+" ";
        model += _qLotteryName(i)+" >= 0\n";
    }
    model += constraint + " = 1\n";

    for (i = 0; i < nrOfVoters; i++) {
        // sum_(x >=_i y) (q(x)p(y)-q(y)p(x))  - e(i) >= 0 forall voters i, candidates y
        let constraint = "";

        let qIndex = Array.from(new Array(nrOfCandidates), (x,i) => 0);

        for (let y = 0; y < nrOfCandidates; y++) {
            for(let xind = preferenceProfile[i].indexOf(y)-1; xind > -1; xind--) {
                let x = preferenceProfile[i][xind];
                //p(y)q(x)
                if (lottery[y][0] !== 0 )
                    constraint += " + " + lottery[y][0] + "/"  + lottery[y][1] +"  "+_qLotteryName(x)+" ";
                // -p(x)q(y)
                if (lottery[x][0] !== 0)
                    constraint += " - " + lottery[x][0] + "/"  + lottery[x][1] +"  "+_qLotteryName(y)+" ";
            }
        }

        if(constraint.length > 0) {
            model += constraint+ " -1 "+_getEpsilonName(i)+" >= 0\n";
        }
    }
    model += "END";
    return model;
}

function _getEpsilonName(voter) {
    return "e_"+voter;
}

/**
 * Get the LP for Checking SD efficiency
 */
function _getStochasticDominanceLP(lottery,preferenceProfile) {
    let nrOfCandidates = lottery.length;
    let nrOfVoters = preferenceProfile.length;

    //Goal function
    // max sum_(i in voters) sum_(j in candidates) r_(i,j)
    let rGoal = ""
    for (let i=0; i < nrOfVoters; i++) {
        for (let j=0; j< nrOfCandidates; j++) {
            rGoal += "1 "+_rMatrixName(i,j)+" ";
        }
    }

    let model = ["max: "+rGoal];

    //Constraint 1  sum {y (>=pref_i) j} (q_y - r_i,j) = sum {y (>=pref_i) j} py
    for (let i=0; i < nrOfVoters; i++) {
        for (let j=0; j< nrOfCandidates; j++) {

            let value = 0;
            let constraint = "";

            var count = 0;
            for(let y=preferenceProfile[i].indexOf(j); y > -1; y--) {
                value += lottery[ preferenceProfile[i][y] ];
                constraint += "1 "+_qLotteryName(preferenceProfile[i][y])+" ";
                count--;
            }
            constraint += count+" "+_rMatrixName(i,j)+" ";

            //Value can't be negative
            value = Math.max(value,0);
            model.push(constraint+" = "+value);
        }
    }
    // console.log(model);

    //q is a lottery
    let constraint = "";
    for (var i = 0; i < nrOfCandidates; i++) {
        constraint += "1 "+_qLotteryName(i)+" ";
        model.push("1 "+_qLotteryName(i)+" >= 0");
    }
    model.push(constraint+" = 1");

    //forall i,j r_(i,j) >=0
    for (let i=0; i < nrOfVoters; i++) {
        for (let j=0; j< nrOfCandidates; j++) {
            model.push(_rMatrixName(i,j)+" >= 0");
        }
    }

    return solver.ReformatLP(model);
}

/**
 * Get the LP for exactly checking SD efficiency
 */
function _getExactStochasticDominanceLP(lottery,preferenceProfile) {
    let nrOfCandidates = lottery.length;
    let nrOfVoters = preferenceProfile.length;

    let model = "Maximize\n" + "epsilon\n" + "Subject To\n";

    //Goal function
    // max sum_(i in voters) sum_(j in candidates) r_(i,j)
    let rGoal = "";
    for (let i=0; i < nrOfVoters; i++) {
        for (let j=0; j< nrOfCandidates; j++) {
            rGoal += (i === 0 && j === 0 ? "" : " + ")+_rMatrixName(i,j)+" ";
        }
    }

    model += rGoal + " - epsilon = 0\n";

    //Constraint 1  sum {y (>=pref_i) j} (q_y - r_i,j) = sum {y (>=pref_i) j} py
    for (let i=0; i < nrOfVoters; i++) {
        for (let j=0; j< nrOfCandidates; j++) {

            let value = math.fraction('0');
            let constraint = "";


            let count = 0;
            for(let y=preferenceProfile[i].indexOf(j); y > -1; y--) {
                let fractionPair = lottery[ preferenceProfile[i][y] ];
                value = math.add(value, math.fraction(fractionPair[0],fractionPair[1]));
                constraint += "+ "+_qLotteryName(preferenceProfile[i][y])+" ";
                count--;
            }
            constraint += count+" "+_rMatrixName(i,j)+" ";
            model += constraint + " = " + value["n"] + "/" + value["d"] + "\n";
        }
    }


    //q is a lottery
    let constraint = "";
    for (let i = 0; i < nrOfCandidates; i++) {
        constraint += " + "+_qLotteryName(i)+" ";
        model += _qLotteryName(i)+" >= 0\n";
    }
    model += constraint+" = 1\n";

    //forall i,j r_(i,j) >=0
    for (let i=0; i < nrOfVoters; i++) {
        for (let j=0; j< nrOfCandidates; j++) {
            model += _rMatrixName(i,j)+" >= 0\n";
        }
    }
    model += "END";

    return model;
}

function _rMatrixName(voter,candidate) {
    return "r_"+voter+"_"+candidate;
}

function _qLotteryName(candidate) {
    return "q_"+candidate;
}
