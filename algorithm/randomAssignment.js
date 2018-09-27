const helper = require('./helper');
const types = require('./answerTypes');
const execSync = require('child_process').execSync;
const util = require('util');
const fs = require('fs');

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
 * Probabilistic Serial
 */


/**
 * Popular Random Assignment
 */