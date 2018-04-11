//Answers Extract Querrys
const express = require('express');
const router = express.Router();


/**
* Handle extract requests
* {staircase} => {success, profies}
*/
router.post("",(req,res,next) => {
  prof = extract(req.body.staircase);

  response = {
    success:true,
    profiles: prof
  }

  res.send(response);
});

module.exports = router;

module.exports.extract = extract;


/**
* Implementation of the staircase algorithm.
*
*/
function extract (staircase) {
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

  return out;
}
