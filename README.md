# Army5 Data rework

As is so happens, the creators of [Army5](http://www.infinitythegame.com/army/), the Infinity Army builder by Corvus Belli (CB), saw fit to put __all unit data__ inside the data.js file in a custom created text storage medium made from joining entire factions together with `#`, `@`, `|`, and `!D!`, then fetch and parse it every time someone loads. This manner of storage is a bitch to deal with for anyone, not CB, and this system is a translator, to make it into JSON readable for whatever system that may want to use it, thus making it easier to make software based on their specs.

## Copyright

Copyright for all Corvus Belli data, images, code, etc are owned by Corvus Belli and used without permission. 

## License

GPL V2, Copyleft
License does not cover Corvus Belli owned materials, only code written new for this repo.