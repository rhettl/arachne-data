var vm = require("vm");
var fs = require("fs");
var http = require("http");
var extend = require("extend");
var q = require("q");
var requestify = require("requestify");


/*
 Private Functions
 */

function noop () {
}

/**
 * Contextualizes client side scripts for running in node
 *
 * @param {String} path location on FS of file to read
 * @param {Object} [context={}] initial object to be used as window/this/global
 *
 * @returns {Object}
 */
var requireFile = function (path, context) {
  context = context || {};
  var data = fs.readFileSync(path);
  vm.runInNewContext(data, context, path);
  return context;
};

var checkTmpFileAge = function (options) {
  var age = -1;


  // Chec for directory and make if not existent
  try {
    var stat = fs.statSync(options.tmpLoc + "/" + options.tmpDataName);

    // now() minus last modify, convert milli->sec, last round to a whole number
    age = Math.round(((new Date()).getTime() - stat.mtime.getTime()) / 1000);
  } catch (e) {
    // ignore error made from .tmp file existing already
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }

  return age;
};

/**
 * Get data from remote site via HTTP and store in tmp location
 *
 * @param {Object} options Object with options including tmpLoc
 * @return {Function} for promise stream
 */
var getData = function (options) {

  /**
   *
   * @param {String} url Location of file in remote server
   *
   * @return {Promise}
   */
  return function (url) {
    var deferred = q.defer();

    // need url
    if (!url) {
      return deferred.reject(new Error("No url provided for data source."));
    }

    //set temporary location and create a write stream to that location
    var tmpDir = options.tmpLoc;
    var tmpLoc = tmpDir + "/" + options.tmpDataName;

    // Chec for directory and make if not existent
    try {
      fs.mkdirSync(tmpDir);
    } catch (e) {
      // ignore error made from .tmp file existing already
      if (e.code !== 'EEXIST') {
        throw e;
      }
    }

    var file = fs.createWriteStream(tmpLoc);

    var request = requestify
          .get(url)
          .then(function (i) {
            file.write(i.getBody());
            file.end();
            deferred.resolve(tmpLoc);
          })
          .fail(function (e) {
            return deferred.reject(e);
          })
      ;

    //var temp = '';
    //get data and write to location
    //var request = http
    //  .get(url, function (response) {
    //    console.log(response.getBody())
    //  })
    //  .on('error', function (e) {
    //    return deferred.reject(e);
    //  });

    return deferred.promise;
  };
};


/**
 * Gets data file location with date of most recent changes.
 *
 * @param {String} armyRoot Root location where normal user goes to load the Army5 army builder application
 *
 * @return {Promise}
 */
var getDataLoc = function (armyRoot) {
  var deferred = q.defer();

  armyRoot = armyRoot || 'http://www.infinitythegame.com/army/';

  requestify
    .get(armyRoot)
    .then(function (resp) {
      var body = resp.body;
      var match = body.match(/src="(.*data\.js.*)"/i);
      if (match[1]) {
        var loc = armyRoot + match[1].trim();

        if (/data\.js\?.*v=\d+$/.test(loc)) {
          return deferred.resolve(loc);
        } else {
          return deferred.reject(new Error("Failed to find location, found: " + loc));
        }
      }
    })
    .fail(function (e) {
      deferred.reject(e);
    });

  return deferred.promise;
};

/**
 * Gets the names of the factions using a ported Army5 function, precargaNombres() in principal.js
 *
 * Presently this function is located at http://www.infinitythegame.com/army/js/principal.js line #92
 *
 *
 */
var getSectorialNames = function (armyUrl, lang) {
  var deferred = q.defer();

  requestify
    .post(armyUrl + 'ajxIdiomas.php?accion=cargaNombres&lang=' + lang)
    .then(function (resp) {
      return resp.body.split('|');
    })
    .then(function (names) {
      return deferred.resolve(names);
    })
    .fail(function (err) {
      deferred.reject(err);
    })
  ;


  return deferred.promise;
};


/*
 Data Parsing
 */
var parseIntoFactions = function (lang) {

  return function (context) {
    var data = {};

    for (var i = 1; i <= 10; i++) {
      for (var j = 1; j <= 5; j++) {
        context.SECTORIAL_ACTUAL = parseInt("" + i + j);

        context.cargaDataLogos(lang);
        if (context.dataLogos.length > 1) {
          //context.cargaNombresLogos(lang);

          if (!data[i]) {
            data[i] = {};
          }
          //data[i][j] = {
          //  //names: context.nombreLogos,
          //  units: context.dataLogos
          //};
          data[i][j] = context.dataLogos;
        }
      }
    }

    return data;
  }
};

var parseMove = function (move) {
  var matches = move.match(/(\d{1,2})-(\d{1,2})/);

  if (matches) {

    return [
      (matches[1] / 5) * 2,  // Convert to inches
      (matches[2] / 5) * 2   // Convert to inches
    ];

  } else {

    return [0, 0];
  }
};
var parseNotes = function (notes) {
  return notes
    .trim()                               // Clean
    .replace(/<\/p\s*>/ig, '')            // remove un-needed tag
    .replace(/note \d{1,2}:/ig, '')       // remove un-needed "NOTE #:"
    .split(/<p\s*>/i)                     // split by other tag
    .map(function (i) {
      return i.trim()
    })    // trim all remaining
    .filter(function (i) {
      return !!i
    })      // remove empty
    ;
};
var parseHas = function (skills) {
  var args = [];
  // Change arguments to an array;
  for (var i = 0, l = arguments.length; i < l; i++) {
    if (arguments[i]) {
      args.push(arguments[i]);
    }
  }

  args = args.join('');
  var matches = args.match(/elemento_hab'>[\w\s:]*<\//g);
  if (matches) {
    matches = matches
      .slice(1)
      .map(function (i) {
        return i.match(/>([\w\s:]*)</)[1]
      });
  }

  return matches || [];
};

var profileToObject = function (p) {
  var t      = p.split(/#/),
      orders = t[8].split(/%/).map(function (i) {
        return parseInt(i)
      });

  return {
    id        : parseInt(t[0]),
    name      : t[1],
    weapon    : t[2],
    ccw       : t[3],
    swc       : t[4],
    extraSwc  : !!(t[4].match(/\+/)),
    pts       : parseInt(t[5]),
    selectable: !isNaN(parseInt(t[7])),
    attachment: parseInt(t[7]) || false,
    order     : {
      regular  : orders[0],
      irregular: orders[1],
      impetuous: orders[2]
    },
    numUnits  : parseInt(t[6]),
    duo       : t[9] === '1'
  };
}

var parseUnitString = function (str, options) {
  if (!str) throw new Error('No unit string given');

  //console.log(str);

  var sec         = str.split('|'),
      basic       = sec[3].split('@'),    //  0|type|SK   1|class|Spec. Trained  Troops   2|cube|1   3|?|0   4|regular|1   5|irregular|0   6|impetuous|0
                                          //  7|frenzied|0   8|name|MORAN, Maasai Hunter   9|ext.impetuous|0   10|hackable|0   11|?|0   12|?|0   13|notes|''
      stats       = sec[4].split('@'),    //  0|move|10-5   1|cc|14   2|bs|13   3|ph|11   4|wip|13   5|arm|3   6|bts|0   7|w|1   8|ava|3   9|w-is-str|0   10|?|0   11|?|0   12|s|2

      profileSets = [
        {
          basic   : sec[3].split('@'),
          stats   : sec[4].split('@'),
          skills  : parseHas(sec[5], sec[7]),
          equip   : parseHas(sec[6]),
          profiles: sec[18].split('@')
        },
        {
          basic   : sec[8].split('@'),
          stats   : sec[9].split('@'),
          skills  : parseHas(sec[10], sec[12]),
          equip   : parseHas(sec[11]),
          profiles: sec[19].split('@')
        },
        {
          basic   : sec[13].split('@'),
          stats   : sec[14].split('@'),
          skills  : parseHas(sec[15], sec[17]),
          equip   : parseHas(sec[16]),
          profiles: sec[20].split('@')
        }
      ],

      rootUnit    = {
        id         : parseInt(sec[0]),
        faction    : '',
        sectorial  : '',
        isSectorial: false,
        iscName    : sec[1],
        numUnits   : sec[2],
        windowType : sec[21],

        units: [],

        duo: false


        //raw: str
      };

  rootUnit.units = profileSets
    .filter(function (unit) {
      return (unit.basic || []).length > 1
    })
    .map(function (unit) {
      unit.profiles = unit.profiles.filter(function (i) {
        return !!i;
      });
      return unit;
    })
    .map(function (unit) {

      var profiles = unit.profiles
            .map(profileToObject)
            .filter(function (i) {
              if (i.duo) {
                // Put this profile on root unit for better reference
                i.selectable = true;
                delete i.duo;
                rootUnit.duo = i;
                // to be removed with filter after this map
              }
              return !i.duo;
            })
        ;


      return {

        type : unit.basic[0],
        class: unit.basic[1],
        name : unit.basic[8],
        notes: parseNotes(unit.basic[13] || ''),

        stats   : {
          move: parseMove(unit.stats[0]),
          cc  : parseInt(unit.stats[1]),
          bs  : parseInt(unit.stats[2]),
          ph  : parseInt(unit.stats[3]),
          wip : parseInt(unit.stats[4]),
          arm : parseInt(unit.stats[5]),
          bts : parseInt(unit.stats[6]),
          w   : unit.stats[9] == 0 ? parseInt(unit.stats[7]) : null,
          str : unit.stats[9] == 0 ? null : parseInt(unit.stats[7]),
          s   : parseInt(unit.stats[12]),
          ava : parseInt(unit.stats[8])
        },
        order   : {
          regular           : unit.basic[4] === '1',
          irregular         : unit.basic[5] === '1',
          impetuous         : unit.basic[6] === '1',
          extremelyImpetuous: unit.basic[9] === '1',
        },
        flags   : {
          cube    : unit.basic[2] === '1',
          cube2   : unit.basic[3] === '1',
          frenzied: unit.basic[7] === '1',
          hackable: unit.basic[10] === '1',
        },
        skills  : unit.skills,
        equip   : unit.equip,
        profiles: profiles

      }
    })
  ;

  if (rootUnit.duo) {
    rootUnit.duo.units = rootUnit.units
      .map(function (u) {
        return u.profiles[0];
      })
      .map(function (p) {
        p.duo = rootUnit.duo.id;
        return p.id;
      })
  }


  if (options.includeRaw) {
    rootUnit.raw = str;
  }

  console.log('');

  return rootUnit;
};



/*
 Public Variables
 */


/**
 * Language constants set by Corvus Belli
 * @type {{ESP: number, ENG: number, FRA: number}}
 */
module.exports.LANG = {
  ESP: 1,
  ENG: 2,
  FRA: 3
};

module.exports.DEFAULTS = {
  lang       : module.exports.LANG.ENG,                  // Must be 1, 2, or 3. Rec. use LANG[lang]
  armyRoot   : 'http://www.infinitythegame.com/army/',   // Location of infinity's army builder
  cache      : 3600,                                        // Number of seconds to cache the data.js before fetching a new one.
  tmpLoc     : __dirname + '/.tmp',
  tmpDataName: 'data.js',
  includeRaw : false
};

module.exports.FACTIONS = {};
module.exports.SECTORIALS = {};


/*
 Public Functions
 */
module.exports.getFullData = function (options, callback) {
  //options optional
  if (typeof options === "function" && !callback) {
    callback = options;
    options = {};
  }

  callback = callback || function (e, d) {
      if (e) throw e;
    };
  var options = extend({}, module.exports.DEFAULTS, options);

  // get mod date
  var data,
      dataAge = checkTmpFileAge(options);

  // fetch file if no file (-1) or mod date is older than cache length (+3600)
  if (options.cache && (dataAge < 0 || dataAge > options.cache)) {

    // Get location and mod date of data.js from army5 root location
    data = getDataLoc(options.armyRoot)
      // Get the date from retrieved data.js
      .then(getData(options))

      // put file into a virtual context
      .then(requireFile);

  } else {
    // else just read file from temp location
    // wrap in a promise to normalize with the if statement block above
    data = q.fcall(requireFile, options.tmpLoc + '/' + options.tmpDataName);
  }

  data = data
    // parse context to get raw unit info per sectorial
    .then(parseIntoFactions(options.lang))

    // move sectorials off root and into units object
    .then(function (facts) {
      Object.getOwnPropertyNames(facts).forEach(function (fid) {
        Object.getOwnPropertyNames(facts[fid]).forEach(function (sid) {
          facts[fid][sid].shift();
          facts[fid][sid] = {
            faction    : '',
            sectorial  : '',
            isSectorial: false,
            units      : facts[fid][sid]
          };
        });
      });
      return facts;
    })

    // Convert raw unit information into basic object. keep raw under "raw" for now.
    .then(function (facts) {
      Object.getOwnPropertyNames(facts).forEach(function (fid) {
        Object.getOwnPropertyNames(facts[fid]).forEach(function (sid) {
          facts[fid][sid].units = facts[fid][sid].units.map(function (row) {
            return parseUnitString(row, options);
          });
        });
      });

      return facts;
    })

    // log, for me. not in production
    //.then(function(i){
    //  console.log('hi');
    //  console.log(i[5][1]);
    //  return i;
    //})


    // Output to user
    //.then(function (i) {
    //  callback(null, i);
    //})
    //// Show error messages
    //.fail(function (e) {
    //  callback(e);
    //})
  ;

  var names = getSectorialNames(options.armyRoot, options.lang);

  // Once I have all names and data
  //  Attach names to data
  q.all([data, names])
    .spread(function(data, names){
      //parse factions
      Object.getOwnPropertyNames(data).forEach(function(fid){
        var faction = data[fid];

        // Get faction name from names array
        var facName = names.shift();
        module.exports.FACTIONS[fid] = facName;

        //parse sectorials
        Object.getOwnPropertyNames(faction).forEach(function(sid){
          var sectorial = faction[sid];

          // if sectorial get sectorial name else use "General"
          var secName = sid == 1 ? 'General' : names.shift();
          module.exports.SECTORIALS['' + fid + sid] = secName;

          //console.log("" + fid + sid, facName, secName);

          // Save faction and sectorial information to respective data locations
          sectorial.faction = facName;
          sectorial.sectorial = secName;
          sectorial.isSectorial = secName != 1;

          sectorial.units.forEach(function(i, j){
            i.faction = facName;
            i.sectorial = secName;
            i.isSectorial = secName != 1;
          });

        });
      });

      return data;

    })
    .then(function(data){

    })

    // Output to user
    .then(function (i) {
      callback(null, i);
    })
    // Show error messages
    .fail(function (e) {
      callback(e);
    })
    .done()
  ;

};

































