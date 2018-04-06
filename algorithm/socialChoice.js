const helper = require('./helper');
const types = require('./answerTypes');
const priorityQueue = require('./priorityQueue');

exports.borda = function borda(data) {
  let voteSize = data.staircase.length+1;
  let score = new Array(voteSize).fill(0);

  for (var i = 0; i < voteSize; i++) {
    for(var j = i+1; j < voteSize; j++) {
      let si = i;
      let sj = j-(i+1);

      if(data.staircase[si][sj] > 0) {
        score[i]+= data.staircase[si][sj];
        score[j]-= data.staircase[si][sj];
      } else {
        score[j]+= (-data.staircase[si][sj]);
        score[i]-= (-data.staircase[si][sj]);
      }
    }
  }

  let winScore = Math.max(...score);
  let winner = score.reduce((p,c,i,a) => c ==  winScore ? p.concat(i) : p,[]);
  lotteries = helper.getWinnerLotteries(winner,voteSize);

  return {
    success: true,
    type: types.Lotteries,
    result: lotteries
  }
}

exports.minimax = function minimax(data) {
  marg = helper.getFullMargins(data.staircase);
  mini = marg.map(arr => Math.min(...arr))

  let winScore = Math.max(...mini);
  let winner = mini.reduce((p,c,i,a) => c ==  winScore ? p.concat(i) : p,[]);
  let lotteries = helper.getWinnerLotteries(winner,marg.length);

  return {
    success: true,
    type: types.Lotteries,
    result: lotteries
  }
}

exports.nanson = function nanson(data) {
  let marg = helper.getFullMargins(data.staircase);
  let size = marg.length;
  let index = Array.from(new Array(size), (x,i) => i);

  do {
    score = marg.map(array => array.reduce((acc,val,i) => acc+val));
    negativeScoreIndices = index.filter( (e,i) => score[i]<0);
    marg = marg.filter((arr,i) => score[i]>=0);
    marg = marg.map(arr => arr.filter((e,i) => score[i]>=0));
    index = index.filter((e,i) => score[i]>= 0);
  } while(negativeScoreIndices.length > 0)

  let lotteries = helper.getWinnerLotteries(index,size);

  return {
    success: true,
    type: types.Lotteries,
    result: lotteries
  }
}

exports.black = function black(data) {
  margin = helper.getFullMargins(data.staircase);
  margin.forEach( (arr,i) => {arr.splice(i,1);return arr});
  condocet = margin.findIndex( arr => arr.every(e => e>0));

  if(condocet>=0) {
    return {
      success: true,
      type: types.Lotteries,
      result: helper.getWinnerLotteries([condocet],margin.length)
    }
  }

  return exports.borda(data);
}

exports.tideman = function tideman(data) {
  let queue = new priorityQueue( (a,b) => a.weight > b.weight);
  let stair = data.staircase;
  let size = stair[0].length + 1;
  for (var i = 0; i < stair.length; i++) {
    for (var j = 0; j < stair[i].length; j++) {
      let weight,from,to;

      if(stair[i][j]>0) {
        weight = stair[i][j];
        from = i;
        to = j+i+1;
      } else {
        weight = -stair[i][j]
        to = i;
        from = j+i+1;
      }
      //Buildup sorted pairlist: margin -> pair
      queue.push(new exports._Edge(from,to,weight));
    }
  }

  let graph = [];
  for (var i = 0; i < size; i++) {
    graph.push(new exports._Node(size,graph));
  }

  let domID,subID = 0

  while(!queue.isEmpty()) {
    let edge = queue.pop();
    //Find maximum -> (dom,sub)
    domID = edge.from;
    let dom = graph[domID];
    subID = edge.to;
    let sub = graph[subID];
    //if sub is not strongerThan dom:
    if(! sub.isStrongerThan(domID)) {
      // dom + dom.weakerThan ->  sub.weakerThan + transitive
      let strongSet = dom.weakerThan.union(new Set([domID]));
      sub.submitTo(strongSet);

      // sub + sub.strongerThan ->dom.strongerThan + transitive
      let weakSet   = sub.strongerThan.union(new Set([subID]));
      dom.dominate(weakSet);
    }

    for (var i = 0; i < size; i++) {
      if(graph[i].isWinner()) {
        return {
          success: true,
          type: types.Lotteries,
          result: helper.getWinnerLotteries([i],size)
        }
      }
    }
  }

  for (var i = 0; i < size; i++) {
    if(graph[i].isWinner()) {
      return {
        success: true,
        type: types.Lotteries,
        result: helper.getWinnerLotteries([i],size)
      }
    }
  }

  return {
    success: false,
    msg: "Search failed"
  }
}

exports._Edge = function Edge(from,to,weight) {
  this.from = from;
  this.to = to;
  this.weight = weight;
}

exports._Node = function Node(graphSize,graph) {
  this.size = graphSize;
  this.graph = graph;
  this.weakerThan = new Set();
  this.strongerThan = new Set();
}

exports._Node.prototype.isWinner = function () {
  return this.strongerThan.size == (this.size-1);
};

exports._Node.prototype.isStrongerThan = function (x) {
  return this.strongerThan.has(x);
};

exports._Node.prototype.dominate = function (set) {
  this.strongerThan = this.strongerThan.union(set);
  this.weakerThan.forEach(x => this.graph[x].dominate(set));
};

exports._Node.prototype.submitTo = function (set) {
  this.weakerThan = this.weakerThan.union(set);
  this.strongerThan.forEach(x => this.graph[x].submitTo(set));
};

Set.prototype.union = function(setB) {
    var union = new Set(this);
    for (var elem of setB) {
        union.add(elem);
    }
    return union;
}
