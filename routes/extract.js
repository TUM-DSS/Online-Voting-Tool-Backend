const express = require('express');
const router = express.Router();

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

function extract (staircase) {
  voteSize = staircase[0].length+1;

  let pdic = {}
  do {
    arr = staircase.reduce((acc,val) => acc.concat(val))
                   .map(p => Math.abs(p));
    maxStar = Math.max.apply(null,arr)

    for (var k = 0; k < maxStar; k++) {
      profile = new Array(voteSize).fill(0);
      score = new Array(voteSize).fill(0);

      for (var i = 0; i < voteSize; i++) {
        let inc = 0;
        for(var j = i+1; j < voteSize; j++) {
          let si = i;
          let sj = j-(i+1);

          if(score[i] > score[j] || (score[i]==score[j] && staircase[si][sj]<0)) {
            inc++;
            staircase[si][sj]++;
          } else {
            score[j]++;
            staircase[si][sj]--;
          }
        }
        score[i]+=inc;
        profile[score[i]] = i;
      }

      if(! (profile in pdic)) {
        pdic[profile] = 0;
      }
      pdic[profile]++;
    }
  } while (maxStar > 0);

  out = [];

  for (var profile in pdic) {
    if (pdic.hasOwnProperty(profile)) {
      out.push({
        relation: JSON.parse('['+profile+']'),
        numberOfVoters: pdic[profile]
      });
    }
  }

  if(out.length == 0) {
    let sort = Array.from(new Array(voteSize),(x,i)=> i);
    let s1 = {relation: JSON.parse('['+sort+']'),numberOfVoters: 1}
    let s2 = {relation: JSON.parse('['+sort.reverse()+']'),numberOfVoters: 1}
    out = [s1,s2]
  }

  return out;
}
