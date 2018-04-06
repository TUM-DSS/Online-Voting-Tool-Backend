const express = require('express');
const router = express.Router();
const solver = require('javascript-lp-solver');

router.post("",(req,res,next) => {
  let lotteries = req.body.lotteries;
  let profile = req.body.profile;

  response = {
    success: true,
    sdresult: checkSDEfficency(lotteries,profile),
    pcresult: checkPCEfficency(lotteries,profile)
  };
  //console.log("Response",response);
  res.send(response);
});

module.exports = router;

function checkSDEfficency(lotteries,profile) {
  let out = [];
  for (lottery of lotteries) {
    out.push(_checkStochsticDominance(lottery,profile));
  }
  return out;
}

function checkPCEfficency(lotteries,profile) {
  let out = [];
  for (lottery of lotteries) {
    out.push(_checkPairwiseComparison(lottery,profile));
  }
  return out;
}

function _checkPairwiseComparison(lottery,preferenceProfile) {
  let model = _getPairwiseComparisonLP(lottery,preferenceProfile);
  return _getLotteryFromLPSolution(lottery, model);
}

function _checkStochsticDominance(lottery, preferenceProfile) {
  let model = _getStochsticDominanceLP(lottery,preferenceProfile);
  return _getLotteryFromLPSolution(lottery, model);
}

function _getLotteryFromLPSolution(lottery,model) {
  let solution = solver.Solve(model);

  if(solution.feasible) {
    if(solution.result == 0) {
      return {
        success: true,
        efficient: true
      }
    } else {
      let dominator = []

      for (var i = 0; i < lottery.length; i++) {
          if(solution.hasOwnProperty(_qLotteryName(i))) {
            dominator.push(solution[_qLotteryName(i)]);
          } else {
            dominator.push(0);
          }
      }

      let diff = 0;
      for (var i = 0; i < dominator.length; i++) {
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
    return {
      success: false,
      msg: "LP infesible"
    }
  }
}

function _getPairwiseComparisonLP(lottery,preferenceProfile) {
  let nrOfCandidates = lottery.length;
  let nrOfVoters = preferenceProfile.length;

  let rGoal = "max: ";
  for (var i = 0; i < nrOfVoters; i++) {
    rGoal+="1 "+_getEpsilonName(i)+" ";
  }

  let model = [rGoal];

  for (var i = 0; i < nrOfVoters; i++) {
    model.push("1 "+_getEpsilonName(i)+" >= 0");
  }

  // q is a lottery
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
      if(qIndex!=0) {
        constraint += qIndex[l]+"  "+_qLotteryName(l)+" ";
      }
    }

    if(constraint.length > 0) {
      model.push(constraint+ " -1 "+_getEpsilonName(i)+" >= 0");
    }
  }
  return solver.ReformatLP(model);
}

function _getEpsilonName(voter) {
  return "e_"+voter;
}

function _getStochsticDominanceLP(lottery,preferenceProfile) {
  /*
  lottery: [0.1,0.4,0.2,0.3]
  preferenceProfile: [[1,3,2,0],[3,2,1,0],...]
  */
  let nrOfCandidates = lottery.length;
  let nrOfVoters = preferenceProfile.length;

  //Goal function
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

      model.push(constraint+" = "+value);
    }
  }

  let constraint = "";
  for (var i = 0; i < nrOfCandidates; i++) {
    constraint += "1 "+_qLotteryName(i)+" ";
    model.push("1 "+_qLotteryName(i)+" >= 0");
  }
  model.push(constraint+" = 1");

  for (let i=0; i < nrOfVoters; i++) {
    for (let j=0; j< nrOfCandidates; j++) {
      model.push(_rMatrixName(i,j)+" >= 0");
    }
  }
  return solver.ReformatLP(model);
}

function _rMatrixName(voter,candidate) {
  return "r_"+voter+"_"+candidate;
}

function _qLotteryName(candidate) {
  return "q_"+candidate;
}
