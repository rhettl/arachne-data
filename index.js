var fs = require('fs');
var Infinity = require('./dataLoader.js');

Infinity.getData({
  //includeRaw: true
}, function (e, d) {
  if (e) {
    throw e;
  } else {
    var file = fs.createWriteStream(__dirname + '/out.json');
    file.write(JSON.stringify(d, null, 2));
    file.end();
  }
});
Infinity.getData({
  //includeRaw: true
}, function (e, d) {
  if (e) {
    throw e;
  } else {
    var fileMin = fs.createWriteStream(__dirname + '/out.min.json');
    fileMin.write(JSON.stringify(d));
    fileMin.end();
  }
});



//console.log(Infinity);
//Infinity.map(function(i, j){
//  console.log(j);
//  i.map(function(p, k){
//    console.log(j, k, p.units);
//  });
//});

//console.log(
//  Infinity[5][1].units
//    .map(function (i) {
//      //return i.raw[3];
//      i.raw = null;
//      return i;
//    })
//    //.filter(function (i) {
//    //  return i.flags.extremelyImpetuous
//    //})
//    //.map(function (i) {
//    //  return i.name
//    //})
//);