const helper = require('./helper');
const types = require('./answerTypes');
const solver = require('javascript-lp-solver');
const feasibilityCounter = require('./feasibilityCounter');
/*
maxLottery
homogeneousMaximalLottery
essentialSet
maxLotteryFesibilityPolytope
homogeneousFesibilityPolytope

*/

exports.maxLottery = function maxLottery(data) {
  let size = data.staircase[0].length+1;
  let model = exports._getMaxLotteryLP(data);

  let lotteries = exports._computePolytope(model,size);

  if(lotteries.length == 0) {
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

exports.homogeneousMaximalLottery = function homogeneousMaximalLottery(data) {
  let exp = data.parameter;
  if(typeof exp != "number") {
    exp = 1;
  }
  data.staircase = data.staircase.map(arr => arr.map(entry => exports._signedExponent(entry,exp)));
  return exports.maxLottery(data)
}

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

exports._getMaxLotteryLP = function getMaxLotteryLP(data) {
  marg = helper.getFullMargins(data.staircase);
  size = marg[0].length;

  model = [ "max: Value"];

  let constraintB = "";
  for (var i = 0; i < size; i++) {
    let constraintA = exports._voteName(i)+" >= 0"
    constraintB += "1 "+exports._voteName(i)+" ";
    model.push(constraintA);
  }
  constraintB += " = 1";
  model.push(constraintB);

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

exports._computePolytope = function (model,size) {
  index = [];
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
  //Abort Search after 3 Seconds
  let abortTime = (+new Date()) + 3000;

  /*let constraintState = Array.from(new Array(index.length), x => true);
  let polySet = exports._searchPolytope(model,index,constraintState,size);

  lotteries = [];
  for (data of polySet) {
    lotteries.push(JSON.parse("["+data+"]"));
  }
  return lotteries;*/

  let counter = new feasibilityCounter(index.length);

  let solution = solver.Solve(model);
  let value = solution.result;
  let out = new Set([exports._getLotteryFromSolution(solution,size).toString()])

  while(counter.hasNext()) {
    console.log(abortTime);
    console.log(+new Date());
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
      out.add(exports._getLotteryFromSolution(solution,size).toString());
    } else {
      counter.infesible();
    }
  }

  lotteries = [];
  for (data of out) {
    lotteries.push(JSON.parse("["+data+"]"));
  }
  return lotteries;
};

/*
exports._searchPolytope = function(model,index,state,size,position = 0) {
  //Modify Model to state
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
    return new Set([exports._getLotteryFromSolution(solution,size).toString()]);
  }

  let out = new Set();
  for (var i = position; i < state.length; i++) {
    if(state[i]) {
        let copy = state.slice();
        copy[i] = false;
        let res = exports._searchPolytope(model,index,copy,size,i+1);
        res.forEach(e => out.add(e));
    }
  }
  return out;
}
*/

exports._signedExponent = function signedExponent(x,e) {
  return Math.sign(x)*Math.pow(Math.abs(x),e);
}

exports._voteName = function voteName(candidate) {
  return "Candidate"+String.fromCharCode(candidate+65);
}
