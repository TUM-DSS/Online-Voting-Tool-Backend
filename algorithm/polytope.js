const helper = require('./helper');
const types = require('./answerTypes');
// const solver = require('javascript-lp-solver');
const feasibilityCounter = require('./feasibilityCounter');
const execSync = require('child_process').execSync;
const fs = require('fs');
const util = require('util');

/**
 * Computes the polytopes of
 * maxLottery, essentialSet and homogeneousMaximalLottery
 */

/**
 * Compute the polytope of the MaximalLottery
 */
exports.maxLottery = function maxLottery(data) {
    // let size = data.staircase[0].length+1;
    let margin = helper.getFullMargins(data.staircase);
    let size = margin[0].length;

    // let model = exports._getMaxLotteryLP(data);
    //
    // let lotteries = exports._computePolytope(model,size);

    let startTime = (+new Date());
    let nashString = size + " " + size + "\n\n";

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            nashString += margin[i][j] + " ";
        }
        nashString += "\n";
    }
    nashString += "\n";
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            nashString += (-1 * margin[i][j]) + " ";
        }
        nashString += "\n";
    }
    let fileName = "lrs/Game.for.ID."+nashString.hashCode()+".lp";
    fs.writeFileSync(fileName, nashString); // Write the file SYNCHRONOUSLY (!)


    let output = execSync('./lrs/lrsnash ' + fileName).toString();
    execSync('rm '+fileName); // Delete the temporary file

    let nashLotteries = [];
    let exactNashLotteries = [];
    for (let line of output.split('\n')) {
        if (line.startsWith("1")) {
            let splitLine = line.split("  ");
            let nashLottery = [];
            let exactNashLottery = [];
            for (let i = 0; i < size; i++) {
                let entry = splitLine[i+1];
                exactNashLottery.push(entry.includes("/") ? entry.split("/").map(function (x) {return parseInt(x);}) : [parseInt(entry), 1]);
                nashLottery.push(eval(entry));
            }
            exactNashLotteries.push(exactNashLottery);
            nashLotteries.push(nashLottery);
        }
    }
    // For Debugging
    // console.log( "lrsNash Time: " + ((+new Date()) - startTime) / 1000);
    // console.log("nash: "+util.inspect(nashLotteries));
    // console.log("exact: "+util.inspect(exactNashLotteries));
    // console.log("LP: "+util.inspect(lotteries));

    //The polytope is empty
    if(nashLotteries.length === 0) {
        //Computation timed out
        if(exports.abort) {
            return {
                success: false,
                msg: "Server Timeout in Backend"
            }
        }

        return {
            success: false,
            msg: "LP infeasible"
        }
    } else {
        return {
            success: true,
            type: types.Lotteries,
            result: nashLotteries,
            exact: exactNashLotteries
        }
    }
};

/**
 * Compute the polytope of the homogeneousMaximalLottery by mapping the staircase first
 * and then computing the maximal lottery
 */
exports.homogeneousMaximalLottery = function homogeneousMaximalLottery(data) {
    let exp = data.parameter;
    if(typeof exp !== "number") {
        exp = 1;
    }
    data.staircase = data.staircase.map(arr => arr.map(entry => exports._signedExponent(entry,exp)));
    return exports.maxLottery(data)
};

/**
 * Computes the essential set by computing the C2-maximal lottery polytope and listing all candidates
 * with positive support
 */
exports.essentialSet = function essentialSet(data) {
    let res = exports.maxLottery(data);
    if(!res.success) {
        return res
    }

    let size = data.staircase[0].length+1;
    let support = Array.from(new Array(size),x => false);
    support = res.result.reduce( (sup,val) => {
        for (let i = 0; i < val.length; i++) {
            if(val[i]>0) {
                sup[i] = true;
            }
        }
        return sup
    },support);

    let lotteries = [];
    for (let i = 0; i < support.length; i++) {
        if(support[i]) {
            lotteries.push(Array.from(new Array(size), (x,index) => index===i?1:0));
        }
    }

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
};

/**
 * Computes the bipartisan set by computing the C1-maximal lottery polytope and listing all candidates
 * with positive support
 */
exports.bipartisanSet = function bipartisanSet(data) {
    data.staircase = data.staircase.map(arr => arr.map(entry => exports._signedExponent(entry,0)));
    let res = exports.maxLottery(data);
    if(!res.success) {
        return res
    }

    let size = data.staircase[0].length+1;
    let support = Array.from(new Array(size),x => false);
    support = res.result.reduce( (sup,val) => {
        for (let i = 0; i < val.length; i++) {
            if(val[i]>0) {
                sup[i] = true;
            }
        }
        return sup
    },support);

    let lotteries = [];
    for (let i = 0; i < support.length; i++) {
        if(support[i]) {
            lotteries.push(Array.from(new Array(size), (x,index) => index===i?1:0));
        }
    }

    return {
        success: true,
        type: types.Lotteries,
        result: lotteries
    }
};

/**
 * Get the maximal lottery LP for a given staircase
 */
exports._getMaxLotteryLP = function getMaxLotteryLP(data) {
    let j;
    let i;
    const marg = helper.getFullMargins(data.staircase);
    const size = marg[0].length;

    //Reduce Magins
    for(i = 0; i < marg.length; i++) {
        //If Zero Row
        //Remove and continue
        if(marg[i].every(x => x===0)) {
            marg.splice(i,1);
            i--;
        }
    }

    for (i = 0; i < marg.length; i++) {
        for (j = i+1; j < marg.length; j++) {
                let multiple = true;
                let fac = 0;
                //Check if cFac * Marg[i] = Marg[j] with cFac > 0
                for(let k=0; k<size; k++) {
                    if(marg[i][k] === 0 && marg[j][k] === 0) {
                        continue;
                    }

                    if( (marg[i][k] !== marg[j][k]) && (marg[j][k] === 0 || marg[i][k] === 0)) {
                        multiple = false;
                        break;
                    }

                    if(marg[i][k] !== 0 && marg[j][k] !== 0) {
                        const cFac = Math.round(marg[i][k] / marg[j][k]);
                        if(fac === 0) {
                            fac = cFac;
                        }

                        if(cFac !== fac || cFac <= 0) {
                            multiple = false;
                            break;
                        }
                    }
                }
                //Remove j
                if(multiple) {
                    marg.splice(j,1);
                    j--;
                }
        }
    }

    //We use the unoptimized Minimax Strategy LP
    //maximize Value
    let model = ["max: Value"];

    //We want a lottery over the candidates
    let constraintB = "";
    for (i = 0; i < size; i++) {
        let constraintA = exports._voteName(i)+" >= 0";
        constraintB += "1 "+exports._voteName(i)+" ";
        model.push(constraintA);
    }
    constraintB += " = 1";
    model.push(constraintB);

    if(marg.length === 0) {
        model.push("1 Value = 0");
    }

    //The expected payoff of the lottery must be at least as high as the value
    for (i = 0; i < marg.length; i++) {
        let constraint = "";
        for (j = 0; j < size; j++) {
            if(marg[i][j] === 0) {
                continue;
            }
            constraint+= -marg[i][j]+" "+exports._voteName(j)+" ";
        }

        constraint += "-1 Value >= 0";
        model.push(constraint);
    }

    return solver.ReformatLP(model);
};

/**
 * Maps a LP solution to its corresponding lottery.
 */
exports._getLotteryFromSolution = function(solution,size) {
    let lottery = [];
    for (let i = 0; i < size; i++) {
        if (solution.hasOwnProperty(exports._voteName(i))) {
            lottery.push(solution[exports._voteName(i)]);
        } else {
            lottery.push(0);
        }
    }
    return lottery;
};

/**
 * Computes the corners of a polytope by enumerating all constraint combination
 */
exports._computePolytope = function (model,size) {
    // console.log("------- ERROR --------");
    let index = [];
    let jsTIME = 0;
    let soplexTIME = 0;
    // console.log(util.inspect(model, false, null));
    //Get the <=  and >= constraints (i.e. the constraints that can be tight in a corner)
    for (let constraint in model.constraints) {
        if (model.constraints.hasOwnProperty(constraint)) {
            if(model.constraints[constraint].hasOwnProperty("min")){
                index.push({
                    type : "min",
                    name : constraint,
                    value : model.constraints[constraint]["min"]
                });
            }
            if (model.constraints[constraint].hasOwnProperty("max")){
                index.push({
                    type : "max",
                    name : constraint,
                    value : model.constraints[constraint]["max"]
                });
            }
        }
    }

    exports.abort = false;
    //Abort Search after 10 Seconds
    let abortTime = (+new Date()) + 10000;

    let counter = new feasibilityCounter(index.length);

    let solution = solver.Solve(model);
    let value = solution.result;

    if(!solution.feasible) {
        return [];
    }

    let sol = exports._getLotteryFromSolution(solution,size).toString();

    //Map maps the state number (= the set of tight constraints) to the result
    let map = {};
    map[0] = sol;
    let out = new Set();//([sol])

    while(counter.hasNext()) {
        if( (+new Date()) > abortTime) {
            exports.abort = true;
            return [];
        }


        let state = counter.next();

        state.forEach( (x,i) => {
            if(x) {
                model.constraints[index[i].name] = { equal: index[i].value}
            } else {
                if(index[i].type === "min") {
                    model.constraints[index[i].name] = { min: index[i].value}
                } else {
                    model.constraints[index[i].name] = { max: index[i].value}
                }
            }
        });

        let startTime = (+new Date());
        // Convert to LP file format
        // Step 0:
        let modelString = "";
        if (model.opType === 'max') {
            modelString = "Maximize\n" + "Value\n" + "Subject To\n";
        }

        // Step 1 - Find out all variables:
        let variableList = [];
        for (let variable in model.variables) {
            if (model.variables.hasOwnProperty(variable)) {
                variableList.push(variable);
            }
        }

        const util = require('util');

        // Step 2 - Write down the constraints:
        for (let constraint in model.constraints) {
            if (model.constraints.hasOwnProperty(constraint)) {
                for (let i in variableList) {
                    let variable = variableList[i];
                    if (model.variables[variable].hasOwnProperty(constraint)){
                        let coefficient = model.variables[variable][constraint].toString();
                        if (!coefficient.includes("-")) coefficient = "+ "+coefficient;
                        modelString += " " + coefficient + " " + variable + " ";
                    }
                }
                if(model.constraints[constraint].hasOwnProperty("min")){
                    modelString += " >= " + model.constraints[constraint]["min"] + " \n";
                }
                if(model.constraints[constraint].hasOwnProperty("max")){
                    modelString += " <= " + model.constraints[constraint]["max"] + " \n";
                }
                if(model.constraints[constraint].hasOwnProperty("equal")){
                    modelString += " = " + model.constraints[constraint]["equal"] + " \n";
                }
            }
        }
        modelString += "END";
        // console.log("Convert Time: "+ (((+new Date()) - startTime) / 1000));



        startTime = (+new Date());
        solution = solver.Solve(model);
        jsTIME += (((+new Date()) - startTime) / 1000);
        if(solution.feasible) {

            // SoPlex Solving
            // TODO: Use SoPlex only with the important instances?
            startTime = (+new Date());
            let fileName = "SCIP/MaximalLottery.for.model.ID."+modelString.hashCode()+".lp";
            fs.writeFileSync(fileName, modelString); // Write the file SYNCHRONOUSLY (!)
            // console.log("Write Time: "+ (((+new Date()) - startTime) / 1000));

            // Solving:
            // ./SCIP/bin/soplex --loadset=SCIP/bin/exact.set SCIP/problem.lp -X
            startTime = (+new Date());
            // let output = execSync('./SCIP/bin/soplex --loadset=SCIP/bin/exact.set ' + fileName + ' -X').toString();
            soplexTIME += (((+new Date()) - startTime) / 1000);
            execSync('rm '+fileName); // Delete the temporary file
            // TODO: Reconvert the solution
            // console.log(output);
            //
            // console.log(util.inspect(model, false, null));
            // console.log(" ");
            // console.log(modelString);
            // console.log("------------");

            //Check if the tight constraints of the found solution is a superset of another solution
            //if so remove this other solution since it isn't maximal (i.e. not a corner)
            for (let oldEntry in map) {
                if (map.hasOwnProperty(oldEntry)) {
                    if((oldEntry & counter.prev) === oldEntry) {
                        delete map[oldEntry];
                    }
                }
            }

            sol = exports._getLotteryFromSolution(solution,size).toString();
            map[counter.prev] = sol
            //out.add(sol);
        } else {
            counter.infesible();
        }
    }

    for (let entry in map) {
        if (map.hasOwnProperty(entry)) {
            out.add(map[entry])
        }
    }

    let lotteries = [];
    for (data of out) {
        lotteries.push(JSON.parse("["+data+"]"));
    }

    lotteries.sort( (a,b) => {
        for(let i=0;i<a.length;i++) {
            if(a[i]>b[i]) {
                return -1
            } else if(a[i]<b[i]) {
                return 1;
            }
        }
        return 0;
    });
    // For Debugging:
    // console.log("Solving Time jsLP: "+ jsTIME);
    // console.log("Solving Time SoPlex: "+ soplexTIME);
    // console.log("------------");
    return lotteries;
};

/**
 * Scaling function for homogeneousMaximalLottery f(x,e) = sign(x)*|x|^e
 */
exports._signedExponent = function signedExponent(x,e) {
    return Math.sign(x)*Math.pow(Math.abs(x),e);
};

exports._voteName = function voteName(candidate) {
    return "Candidate"+String.fromCharCode(candidate+65);
};


/**
 * Compute random dictatorship
 */
exports.randomDictatorship = function randomDictatorship(data) {
    let alternatives = data.staircase.length+1;
    let score = new Array(alternatives).fill(0);
    let exactLottery = new Array(alternatives).fill([0,1]);

    let profile = data.profile;
    let sum = 0;
    for (let i = 0; i < profile.length; i++) {
        score[profile[i].relation[0]] += profile[i].numberOfVoters;
        sum += profile[i].numberOfVoters;
    }

    for (let i = 0; i < alternatives; i++) {
        exactLottery[i][0] = score[i];
        exactLottery[i][1] = sum;
        score[i] = 1.0 * score[i] / sum;
    }

    return {
        success: true,
        type: types.Lotteries,
        result: [score],
        exact: [exactLottery]
    }
};

/**
 * Compute proportional Borda
 */
exports.proportionalBorda = function proportionalBorda(data) {
    let alternatives = data.staircase.length+1;
    let score = new Array(alternatives).fill(0);
    let exactLottery = new Array(alternatives).fill([0,1]);

    let profile = data.profile;
    let sum = 0;
    for (let i = 0; i < profile.length; i++) {
        for (let j = 0; j < alternatives; j++) {
            let points = profile[i].numberOfVoters * (alternatives - j);
            score[profile[i].relation[j]] += points;
            sum += points;
        }

    }

    for (let i = 0; i < alternatives; i++) {
        exactLottery[i][0] = score[i];
        exactLottery[i][1] = sum;
        score[i] = 1.0 * score[i] / sum;
    }


    return {
        success: true,
        type: types.Lotteries,
        result: [score],
        exact: [exactLottery]
    }
};

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