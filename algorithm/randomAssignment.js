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
 * Popular Random Assignment
 */