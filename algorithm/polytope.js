const helper = require('./helper');
const types = require('./answerTypes');
const solver = require('javascript-lp-solver');
const feasibilityCounter = require('./feasibilityCounter');

/**
* Computes the polytopes of
* maxLottery, essentialSet and homogeneousMaximalLottery
*/

/**
* Compute the polytope of the MaximalLottery
*/
exports.maxLottery = function maxLottery(data) {
  let size = data.staircase[0].length+1;
  if(data.staircase.every( array => array.every(entry => entry == 0))) {

    let res = Array.from(new Array(size), (x,i)=> {
      return Array.from(new Array(size), (y,j) => i==j?1:0)
    });

    return {
      success: true,
      type: types.Lotteries,
      result:res
    }
  }

  let model = exports._getMaxLotteryLP(data);

  let lotteries = exports._computePolytope(model,size);

  //The polytope is empty
  if(lotteries.length == 0) {
    //Computation timed out
    if(exports.abort) {
      return {
        success: false,
        msg: "Server Timeout"
      }
    }

    return {
      success: false,
      msg: "LP infesible"
    }
  } else {
    return {
      success: true,
      type: types.Lotteries,
      result: lotteries
    }
  }
}

/**
* Compute the polytope of the homogeneousMaximalLottery by mapping the staircase first
* and then computing the maximal lottery
*/
exports.homogeneousMaximalLottery = function homogeneousMaximalLottery(data) {
  let exp = data.parameter;
  if(typeof exp != "number") {
    exp = 1;
  }
  data.staircase = data.staircase.map(arr => arr.map(entry => exports._signedExponent(entry,exp)));
  return exports.maxLottery(data)
}

/**
* Computes the essential set by computing the maximal lottery polytope an listing all candidates
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
    for (var i = 0; i < val.length; i++) {
      if(val[i]>0) {
        sup[i] = true;
      }
    }
    return sup
  },support);

  let lotteries = [];
  for (var i = 0; i < support.length; i++) {
    if(support[i]) {
      lotteries.push(Array.from(new Array(size), (x,index) => index==i?1:0));
    }
  }

  return {
    success: true,
    type: types.Lotteries,
    result: lotteries
  }
}

/**
* Get the maximal lottery LP for a given staircase
*/
exports._getMaxLotteryLP = function getMaxLotteryLP(data) {
  marg = helper.getFullMargins(data.staircase);
  size = marg[0].length;

  //We use the unoptimized Minimax Strategy LP
  //maximize Value
  model = [ "max: Value"];

  //We want a lottery over the candidates
  let constraintB = "";
  for (var i = 0; i < size; i++) {
    let constraintA = exports._voteName(i)+" >= 0"
    constraintB += "1 "+exports._voteName(i)+" ";
    model.push(constraintA);
  }
  constraintB += " = 1";
  model.push(constraintB);

  //The expreced payoff of the lottery must be at least as high as the value
  for (var j = 0; j < size; j++) {
    let constraint = ""
    for (var i = 0; i < size; i++) {
      if(marg[i][j] == 0) {
        continue;
      }
      constraint+= marg[i][j]+" "+exports._voteName(i)+" ";
    }

    constraint += "-1 Value >= 0";
    model.push(constraint);
  }
  return solver.ReformatLP(model);
}

/**
* Maps a LP solution to its corresponding lottery.
*/
exports._getLotteryFromSolution = function(solution,size) {
  let lottery = [];
  for (var i = 0; i < size; i++) {
    if (solution.hasOwnProperty(exports._voteName(i))) {
      lottery.push(solution[exports._voteName(i)]);
    } else {
      lottery.push(0);
    }
  }
  return lottery;
}

/**
* Computes the corners of a polytope by enumerating all constraint combination
*/
exports._computePolytope = function (model,size) {
  index = [];
  //Get the <=  and >= constraints (i.e. the constraints that can be tight in a corner)
  for (var constraint in model.constraints) {
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

  //Map maps the state number (= the set of thight constraints) to the result
  let map = {}
  map[0] = sol;
  let out = new Set()//([sol])

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
        if(index[i].type== "min") {
          model.constraints[index[i].name] = { min: index[i].value}
        } else {
          model.constraints[index[i].name] = { max: index[i].value}
        }
      }
    });

    solution = solver.Solve(model);
    if(solution.feasible) {
      //Check if the theight constraints of the found solution is a superset of another solution
      //if so remove this other solution since it isn't maximal (i.e. not a corner)
      for (var oldEntry in map) {
        if (map.hasOwnProperty(oldEntry)) {
          if((oldEntry & counter.prev) == oldEntry) {
            delete map[oldEntry];
          }
        }
      }

      sol = exports._getLotteryFromSolution(solution,size).toString()
      map[counter.prev] = sol
      //out.add(sol);
    } else {
      counter.infesible();
    }
  }

  for (var entry in map) {
    if (map.hasOwnProperty(entry)) {
      out.add(map[entry])
    }
  }

  lotteries = [];
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
  })

  return lotteries;
};

/**
* Scaling function for homogeneousMaximalLottery f(x,e) = sign(x)*|x|^e
*/
exports._signedExponent = function signedExponent(x,e) {
  return Math.sign(x)*Math.pow(Math.abs(x),e);
}

exports._voteName = function voteName(candidate) {
  return "Candidate"+String.fromCharCode(candidate+65);
}
