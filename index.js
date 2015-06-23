var Infinity = require('./dataLoader.js')();

//console.log(Infinity);
//Infinity.map(function(i, j){
//  console.log(j);
//  i.map(function(p, k){
//    console.log(j, k, p.units);
//  });
//});


console.log(
    Infinity[5][1].units
      .map(function (i) {
        //return i.raw[3];
          i.raw=null;
        return i;
      })
        .filter(function (i) {
          return i.flags.extremelyImpetuous
        })
        .map(function (i) {
          return i.name
        })
);