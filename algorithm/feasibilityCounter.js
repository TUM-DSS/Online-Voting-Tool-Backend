function FeasibilityCounter(states) {
  this.prev = 0;
  this.number = 1;
  this.masks = [];
  this.states = states
  this.max = 1<<this.states;
};

FeasibilityCounter.prototype = {
  hasNext: function() {
    return this.number<this.max;
  },

  next: function() {
    this.prev = this.number;
    let out = this._convertToBitstring(this.number);

    let inc = false;
    do {
      inc = false;
      this.number++;

      for (mask of this.masks) {
        if((this.number & mask)==mask) {
          inc = true;
          break;
        }
      }

    } while(inc)

    return out;
  },

  _convertToBitstring: function(number) {
    return Array.from(new Array(this.states),(x,i) => ((1<<i)&this.number)>0);
  },

  infesible: function() {
    this.masks.push(this.prev);
  }
}

module.exports = FeasibilityCounter;
