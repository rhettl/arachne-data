var vm = require("vm");
var fs = require("fs");

var requireFile = function(path, context) {
    context = context || {};
    var data = fs.readFileSync(path);
    vm.runInNewContext(data, context, path);
    return context;
};

var english = 2;
var context = requireFile('./data.js');

module.exports = function(lang){
    lang = lang || english;

    var data = [];

    for (var i = 1; i <= 10; i ++) {
        for (var j = 1; j <= 5; j ++) {
            context.SECTORIAL_ACTUAL = parseInt("" + i + j);

            context.cargaDataLogos(lang);
            if (context.dataLogos.length > 1) {
                context.cargaNombresLogos(lang);

                if (!data[i]) {
                    data[i] = [];
                }
                data[i][j] = {
                    names: context.nombreLogos,
                    units: context.dataLogos.slice(1).map(function (i) {
                        return i.split('|');
                    }).map(function (i) {
                        var basicStats = i[3].split('@');
                        return {
                            id: parseInt(i[0]),
                            numUnits: parseInt(i[2]),
                            icsName: i[1],
                            name: basicStats[8],
                            type: basicStats[0],
                            role: basicStats[1],
                            flags: {
                                cube: basicStats[2] === '1',
                                normalOrder: basicStats[4] === '1',
                                frenzied: basicStats[7] === '1',
                                impetuous: basicStats[5] === '1',
                                extremelyImpetuous: basicStats[9] === '1',
                                hackable: basicStats[10] === '1'
                            },
                            stats: {},
                            raw: i
                        }
                    })
                };
            }
        }
    }


    return data;
};
