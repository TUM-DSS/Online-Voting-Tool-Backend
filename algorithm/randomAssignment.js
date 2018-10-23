const helper = require('./helper');
const types = require('./answerTypes');
const execSync = require('child_process').execSync;
const util = require('util');
const fs = require('fs');
const math = require('mathjs');

/**
 * Compute random assignments
 */

const factorial = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800];

/**
 * Random Serial Dictatorship
 */
exports.rsd = function rsd(data) {
    let size = data.staircase[0].length + 1;

    let profile = data.profile;
    let voterTypes = profile.length;
    let voterTypeIndex = [];
    for (let i = 0; i < voterTypes; i++ ) for (let j = 0; j < profile[i].numberOfVoters; j++) voterTypeIndex.push(i);

    if (size !== voterTypeIndex.length) {
        return {
            success: false,
            msg: "Number of voters and alternatives is not the same"
        }
    }

    let matrix = new Array(size);
    let factorialSize = factorial[size];
    for (let i = 0; i < size; i++ ) {
        matrix[i] = [];
        for (let j = 0; j < size; j++ ) {
            matrix[i][j] = [0, factorialSize];
        }
    }

    // let index = Array.from(new Array(size), (x,i) => i);
    // const swap = function (array, pos1, pos2) {
    //     let temp = array[pos1];
    //     array[pos1] = array[pos2];
    //     array[pos2] = temp;
    // };
    //
    // const heapsPermute = function (array, output, n) {
    //     let j;
    //     n = n || array.length; // set n default to array.length
    //     if (n === 1) {
    //         output(array);
    //     } else {
    //         for (let i = 1; i <= n; i += 1) {
    //             heapsPermute(array, output, n - 1);
    //             if (n % 2) {
    //                 j = 1;
    //             } else {
    //                 j = i;
    //             }
    //             swap(array, j - 1, n - 1); // -1 to account for javascript zero-indexing
    //         }
    //     }
    // };
    // let string = "[";
    // heapsPermute(index, function(input){string += "["+input +"], ";});
    // string = string.slice(0, -2) +"]";

    // fs.writeFileSync("permutations/"+size+".txt", string); // Write the file SYNCHRONOUSLY (!)
    let permutations = JSON.parse(fs.readFileSync("permutations/"+size+".txt").toString());


    // Permutation Loop
    for (let i = 0; i < factorialSize; i++ ) {
        let permutation = permutations[i];
        let index = Array.from(new Array(size), (x,j) => j);

        // Voter Loop
        for (let voterIndex = 0; voterIndex < size; voterIndex++ ) {
            let voter = permutation[voterIndex];
            let preference = profile[voterTypeIndex[voter]].relation;

            // Item Loop
            for (let k = 0; k < size; k++ ) {
                let item = preference[k];
                if (index.includes(item)) {
                    index.splice(index.indexOf(item), 1);
                    matrix[voter][item][0] = matrix[voter][item][0] + 1;
                    break;
                }
            }
        }
    }


    return {
        success: true,
        type: types.Matrix,
        result: matrix
    }
};




/**
 * Probabilistic Serial Rule
 */
exports.ps = function ps(data) {
    let size = data.staircase[0].length + 1;

    let profile = data.profile;
    let voterTypes = profile.length;
    let voterTypeIndex = [];
    for (let i = 0; i < voterTypes; i++ ) for (let j = 0; j < profile[i].numberOfVoters; j++) voterTypeIndex.push(i);

    if (size !== voterTypeIndex.length) {
        return {
            success: false,
            msg: "Number of voters and alternatives is not the same"
        }
    }

    let matrix = new Array(size);
    for (let i = 0; i < size; i++ ) {
        matrix[i] = [];
        for (let j = 0; j < size; j++ ) {
            matrix[i][j] = math.fraction(0);
        }
    }

    // Initial setup
    let cake = new Array(size);
    let bestAvailable = new Array(size);
    let eaters = new Array(size).fill(0);
    let sum = math.fraction(0);
    for (let i = 0; i < size; i++ ) {
        cake[i] = math.fraction(1.0);
        sum = math.add(sum, cake[i]);
        let item = profile[voterTypeIndex[i]].relation[0];
        bestAvailable[i] = item;
        eaters[item] = eaters[item] + 1;
    }

    while (sum["n"] !== 0) {
        // console.log("Cake: "+util.inspect(cake));
        // console.log("Best: "+util.inspect(bestAvailable));
        // console.log("Eaters: "+util.inspect(eaters));
        // console.log("Sum: "+util.inspect(sum.toString()));

        // Compute the eating length
        let nextStop = math.fraction(1.0);
        for (let i = 0; i < size; i++ ) if (eaters[i] !== 0){
            let ratio = math.divide(cake[i],eaters[i]);
            if (math.smaller(ratio, nextStop)) nextStop = ratio;
        }
        // Distribute parts of the cake
        sum = math.fraction(0);
        for (let i = 0; i < size; i++ ) {
            cake[i] = math.subtract(cake[i], math.multiply(eaters[i], nextStop));
            sum = math.add(sum, cake[i]);
            matrix[i][bestAvailable[i]] = math.add(matrix[i][bestAvailable[i]], nextStop);
        }
        // Setup the next step
        bestAvailable = new Array(size);
        eaters = new Array(size).fill(0);
        for (let v = 0; v < size; v++ ) {
            for (let i = 0; i < size; i++ ) {
                let item = profile[voterTypeIndex[v]].relation[i];
                if (cake[item]["n"] !== 0) {
                    bestAvailable[v] = item;
                    eaters[item] = eaters[item] + 1;
                    break;
                }
            }


        }
    }

    for (let i = 0; i < size; i++ ) {
        for (let j = 0; j < size; j++ ) {
            matrix[i][j] = [matrix[i][j]["n"], matrix[i][j]["d"]];
        }
    }

    return {
        success: true,
        type: types.Matrix,
        result: matrix
    }
};

/**
 * Popular Random Assignment by Kavitha et al. https://www.sciencedirect.com/science/article/pii/S0304397510001659
 * Computing all extreme vertices with David Avis' lrs.
 */
exports.praAll = function praAll(data) {
    let size = data.staircase[0].length + 1;
    let variableSize = size * size + 2*size + 1;

    let profile = data.profile;
    let voterTypes = profile.length;
    let voterTypeIndex = [];
    for (let i = 0; i < voterTypes; i++ ) for (let j = 0; j < profile[i].numberOfVoters; j++) voterTypeIndex.push(i);

    if (size !== voterTypeIndex.length) {
        return {
            success: false,
            msg: "Number of voters and alternatives is not the same"
        }
    }

    let name = Math.abs(util.inspect(profile).hashCode());
    let lp = "Name: " + name +"\n"+"H-representation\n";
    lp += "linearity "+ (2*size + 1) + " ";
    for (let i = 1; i <= (2*size + 1); i++ ) lp += i + " ";
    lp += "\nbegin\n";
    lp +=  (3*size + 1 + 2 * size * size + 1) + " " + variableSize +" rational\n";

    // Equality constraints (called "linearity" by David Avis)
    // Lottery constraint for the agents (# constraints: size)
    for (let a = 0; a < size; a++ ) {
        let array = new Array(variableSize);
        array.fill(0);
        array[0] = -1;
        for (let i = 0; i < size; i++ ) {
            array[1+size*a+i] = 1;
        }
        lp += array.toString().replace(/,/g," ") + "\n";
    }

    // Lottery constraint for the items (# constraints: size)
    for (let i = 0; i < size; i++ ) {
        let array = new Array(variableSize);
        array.fill(0);
        array[0] = -1;
        for (let a = 0; a < size; a++ ) {
            array[1+size*a+i] = 1;
        }
        lp += array.toString().replace(/,/g," ") + "\n";
    }

    // Optimality constraint (# constraints: 1)
    let array = new Array(variableSize);
    array.fill(0);
    for (let i = size*size + 1; i < variableSize; i++ ) {
        array[i] = 1;
    }
    lp += array.toString().replace(/,/g," ") + "\n";

    // Inequality constraints
    // Betas are non-negative (# constraints: size)
    for (let i = 0; i < size; i++ ) {
        let array = new Array(variableSize);
        array.fill(0);
        array[variableSize-i-1] = 1;
        lp += array.toString().replace(/,/g," ") + "\n";
    }

    // Sum of betas is bounded (# constraints: 1)
    array = new Array(variableSize);
    array.fill(0);
    array[0] = size;
    for (let i = 0; i < size; i++ ) {
        array[variableSize-i-1] = -1;
    }
    lp += array.toString().replace(/,/g," ") + "\n";

    // Lottery constraints (# constraints: size ^ 2)
    for (let entry = 0; entry < size * size; entry++ ) {
        let array = new Array(variableSize);
        array.fill(0);
        array[1+entry] = 1;
        lp += array.toString().replace(/,/g," ") + "\n";
    }

    // Dual PRA constraint (# constraints: size ^ 2)
    for (let a = 0; a < size; a++ ) for (let h = 0; h < size; h++) {
        let array = new Array(variableSize);
        array.fill(0);
        array[size * size + 1 + a] = 1;
        array[size * size + size + 1 + h] = 1;

        for (let i = 0; i < size; i++) if (i !== h)
            array[1 + (a * size) + i] = profile[voterTypeIndex[a]].relation.indexOf(i) < profile[voterTypeIndex[a]].relation.indexOf(h) ? 1 : -1;

        lp += array.toString().replace(/,/g, " ") + "\n";
    }

    lp += "end\n";

    // Minimize sum of betas (for the first vertex)
    array = new Array(variableSize);
    array.fill(0);
    for (let i = 0; i < size; i++ ) {
        array[variableSize-i-1] = 1;
    }
    lp += "dualperturb\n" + "minimize " + array.toString().replace(/,/g," ") + "\n";
    // lp += "maxoutput " + 7 + "\n";
    // lp += "maxcobases " + 100 + "\n";
    // lp += "truncate \n";

    console.log(lp);

    let fileName = "lrs/PRA.LP.for.ID."+name+".ine";
    fs.writeFileSync(fileName, lp); // Write the file SYNCHRONOUSLY (!)


    let output = execSync('./lrs/lrs ' + fileName, {stdio:[]}).toString();
    execSync('rm '+fileName); // Delete the temporary file


    console.log(output);

    return {
        success: false,
        msg: "We have not finished yet with computing all vertices."
    }

    return {
        success: true,
        type: types.Matrices,
        result: matrices
    }
};

/**
 * Popular Random Assignment by Kavitha et al. https://www.sciencedirect.com/science/article/pii/S0304397510001659
 * Computing some assignment with LP solver
 */
exports.pra = function pra(data) {
    let size = data.staircase[0].length + 1;
    let variableSize = size * size + 2 * size + 1;

    let profile = data.profile;
    let voterTypes = profile.length;
    let voterTypeIndex = [];
    for (let i = 0; i < voterTypes; i++) for (let j = 0; j < profile[i].numberOfVoters; j++) voterTypeIndex.push(i);

    if (size !== voterTypeIndex.length) {
        return {
            success: false,
            msg: "Number of voters and alternatives is not the same"
        }
    }

    let matrix = new Array(size);
    for (let i = 0; i < size; i++ ) {
        matrix[i] = [];
        for (let j = 0; j < size; j++ ) {
            matrix[i][j] = math.fraction(0);
        }
    }


    // LP model
    // SoPlex refuses to accept negative solution values.
    // We use a workaround by shifting all alphas by "size"
    let model =  "Minimize\n" + "0\n" + "Subject To\n";

    // Equality constraints
    // Lottery constraint for the agents (# constraints: size)
    for (let i = 0; i < size; i++) {
        let sum = "";
        for (let h = 0; h < size; h++) sum += " p_" + i + "_" + h + " +";
        model += sum.slice(0, -1) + " = 1\n";
    }

    // Lottery constraint for the items (# constraints: size)
    for (let h = 0; h < size; h++) {
        let sum = "";
        for (let i = 0; i < size; i++) sum += " p_" + i + "_" + h + " +";
        model += sum.slice(0, -1) + " = 1\n";
    }

    // Optimality constraint (# constraints: 1)
    let sum = "";
    for (let i = 0; i < size; i++) {
        sum += " alpha_" + i + " + beta_" + i +" +";
    }
    model += sum.slice(0, -1) + " = " + (size*size) + "\n";

    // Inequality constraints
    // Betas are non-negative (# constraints: size)
    for (let h = 0; h < size; h++) model += " beta_" + h + " >= 0\n";

    // Sum of betas is bounded (# constraints: 1)
    // sum = "";
    // for (let i = 0; i < size; i++) {
    //     sum += " beta_" + i +" +";
    // }
    // model += sum.slice(0, -1) + " <= " + size + "\n";


    // Lottery constraints (# constraints: size ^ 2)
    for (let h = 0; h < size; h++) for (let i = 0; i < size; i++) model += " p_" + i + "_" + h + " >= 0\n";

    // Dual PRA constraint (# constraints: size ^ 2)
    for (let a = 0; a < size; a++ ) for (let h = 0; h < size; h++) {
        sum = " alpha_"+a + " + beta_"+h + " ";
        for (let i = 0; i < size; i++) if (i !== h)
            sum += (profile[voterTypeIndex[a]].relation.indexOf(i) < profile[voterTypeIndex[a]].relation.indexOf(h) ? "+" : "-") + " p_" + a + "_" + i +" ";

        model += sum +" >= " + size + "\n";
    }

    // Equal treatment of equals (# constraints: size * # pairs of equal preferences)
    for (let v1 = 0; v1 < size; v1++) for (let v2 = v1 + 1; v2 < size; v2++)
        if (profile[voterTypeIndex[v1]].relation === profile[voterTypeIndex[v2]].relation)
            for (let a = 0; a < size; a++)
                model += " p_" + v1 + "_" + a + " - p_" + v2 + "_" + a + "  = 0\n";

    model += "end\n";

    // SoPlex Solving
    let fileName = "SCIP/PRA.for.model.ID." + model.hashCode() + ".lp";
    fs.writeFileSync(fileName, model); // Write the file SYNCHRONOUSLY (!)

    // console.log(model);

    // Solving:
    // ./SCIP/bin/soplex --loadset=SCIP/bin/exact.set SCIP/problem.lp -X
    let output = execSync('./SCIP/bin/soplex --loadset=SCIP/bin/exact.set ' + fileName + ' -X').toString();
    execSync('rm '+fileName); // Delete the temporary file

    for (let i = 0; i < size; i++) for (let h = 0; h < size; h++) {
        let name = "p_" + i + "_" + h;
    }

    for (let line of output.split('\n')) {
        if (line.startsWith("p_")) {
            let splitLine = line.split("\t");
            let ids = splitLine[0].replace(/\t/g,'').split("_");
            matrix[parseInt(ids[1])][parseInt(ids[2])] = math.fraction(splitLine[1].replace(/\t/g,''));
        }
    }


    // Convert from fraction to pair
    for (let i = 0; i < size; i++ ) {
        for (let j = 0; j < size; j++ ) {
            matrix[i][j] = [matrix[i][j]["n"], matrix[i][j]["d"]];
        }
    }

    return {
        success: true,
        type: types.Matrix,
        result: matrix
    }
};