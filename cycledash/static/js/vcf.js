(function() {
"use strict";

if (typeof _ === 'function') {
  // pass
} else if (typeof require === 'function') {
  _ = require('underscore');
} else {
  throw Error("Cannot find or require underscore.js");
}


// TODO(ihodes): Add function that appends 1 to N more VCF records send from
//               server to the VCF.


  //////////////////////////
 //   Parsing VCF Files  //
//////////////////////////

// There are 9 columns before samples are listed.
var NUM_STANDARD_HEADER_COLUMNS = 9;

// The default format of text we're parsing. Can be VCF or JSON.
var DEFAULT_TYPE = 'vcf';

var BASES = ['A', 'C', 'T', 'G'];

// Console prints messages when deriving undefined types.
// TODO(ihodes): enable setting this.
var WARN = false;

// VCF values can be comma-separated lists, so here we want to convert them into
// lists of the proper type, else return the singleton value of that type. All
// values are also nullable, signified with a '.', we want to watch out for
// those as well.
function maybeMapOverVal(fn, val) {
  var vals = val.split(',');
  if (vals.length > 1) {
    return _.map(vals, function(v) { return v == '.' ? null : fn(v); });
  }
  return val == '.' ? null : fn(val);
}

// Set radix to 10 to prevent problems in strangley-formed VCFs. Otherwise we
// may end up parsing octal, for example.
// c.f. http://stackoverflow.com/questions/7818903/jslint-says-missing-radix-parameter-what-should-i-do
var _parseInt = function(i) { return parseInt(i, 10); };

// This map associates types with functions to parse from strings the associated
// JS types.
var HEADER_TYPES = {'Integer': _.partial(maybeMapOverVal, _parseInt),
                    'Float': _.partial(maybeMapOverVal, parseFloat),
                    'Flag': _.constant(true),
                    'Character': _.partial(maybeMapOverVal, _.identity),
                    'String': function(v) { return v == '.' ? null : v; }}

function deriveType(val) {
  // Returns the derived type, falling back to String if nothing else works.
  //
  // Attempts to guess the type of a value when the type isn't specicifed in
  // the header. NB: Currently the only numeric type returned is Float (not
  // Integer).

  // TODO(ihodes): Derive Integer type separately from Float.
  var type;
  if (!val || val.length === 0) {
    type = 'Flag';
  } else if (!_.isNaN(parseFloat(val))) {
    type = 'Float';
  } else {
    type = 'String';
  }
  return type;
}


  ////////////////////////////////////////////////////////
 // Below: parsing the header metadata of a VCF file.  //
////////////////////////////////////////////////////////

function parseHeader(headers) {
  // Returns a header object with keys header line types (.e.g format, info,
  // sample) and values arrays of objects containing the key-value information
  // stored therein.
  var header = {};
  header.__raw = headers;
  // VCF header lines always start with either one or two # signs.
  headers = _.map(headers, function(h) { return h.replace(/^##?/, ""); });

  header.columns = headers[headers.length-1].split('\t');
  header.sampleNames = header.columns.slice(NUM_STANDARD_HEADER_COLUMNS);

  // TODO(ihodes): parse other, less frequently used, header lines like
  //               'assembly', 'contig', 'PEDIGREE'
  header.version = parseVCFVersion(headers);
  header.alt = parseHeadersOf('ALT', headers);
  header.info = parseHeadersOf('INFO', headers);
  header.format = parseHeadersOf('FORMAT', headers);
  header.sample = parseHeadersOf('SAMPLE', headers);

  return header;
}

function headersOf(type, lines) {
  // Returns the header lines out of `lines` matching `type`.
  return _.filter(lines, function(h) {
    return h.substr(0, type.length) == type;
  });
}

function parseHeaderLines(lines) {
  // Returns a list of parsed header lines.
  //
  // `lines` - an array of header strings (stripped of "##").
  return _.reduce(lines, function(headers, line) {
    var specRe = /<(.*)>/,
        descriptionRe = /.*?(Description="(.*?)",?).*?/,
        spec = specRe.exec(line)[1],
        description = descriptionRe.exec(spec)[2];

    spec = spec.replace(/Description=".*?",?/, '');
    window.s = spec;
    var kvs = _.map(spec.split(','), function(kv) {
      return kv.split('=');
    });

    if (description)  kvs.push(['Description', description]);

    headers.push(_.reduce(kvs, function(acc, kv){
      var val = kv[1],
          key = kv[0];
      if (key.length <= 0)  return acc;

      if (val === '.')  val = null;
      else if (key === 'Number')  val = parseInt(val);
      acc[key] = val;
      return acc;
    }, {}))
    return headers;
  }, []);
}

function parseVCFVersion(headers) {
  // Returns the version of the VCF file. Hacky.
  var version = headers[0].split('=')[1];
  if (version != 'VCFv4.1' && version != 'VCFv4.0') {
    throw Error("VCF version must be 4.1.");
  }
  return '4.1';
}

function parseHeadersOf(type, headers) {
  // Returns a list of parsed headers for a given type.
  //
  // `type` - String, type (e.g. ALT) of header line.
  // `headers` - List of split header strings.
  return parseHeaderLines(headersOf(type, headers));
}


  ////////////////////////////////////////////////////////
 // Below: parsing columns of individual VCF records.  //
////////////////////////////////////////////////////////
function _parseChrom(chrom, header) {
  return chrom;
}

function _parsePos(pos, header) {
  return parseInt(pos);
}

function _parseId(id, header) {
  return id.split(';');
}

function _parseRef(ref, header) {
  return ref;
}

function _parseAlt(alt, header) {
  return alt.split(',');
}

function _parseQual(qual, header) {
  return parseFloat(qual);
}

function _parseFilter(filters, header) {
  return filters.split(';');
}

function _parseInfo(info, header) {
  return _.reduce(info.split(';'), function(acc, kv) {
    kv = kv.split('=')
    var key = kv[0],
        val = kv[1],
        headerSpec = _.findWhere(header.info, {ID: key}),
        type;

    if (headerSpec && headerSpec.Type) {
      type = headerSpec.Type;
      val = HEADER_TYPES[type](val);
    } else {
      type = deriveType(val);
      val = HEADER_TYPES[type](val);
      if (WARN) {
        console.log("Warning: INFO type '" + key + "' is not defined in header. (Value = '" + val + "'). Derived type as '" + type + "'.");
      }
    }

    acc[key] = val;
    return acc;
  }, {});
}

function _parseFormat(format, header) {
  // Returns a list of format tags.
  return format.split(':');
}

function _parseSample(sample, format, header) {
  sample = sample.split(':');
  return _.reduce(sample, function(sample, val, idx) {
    var key = format[idx],
    headerSpec = _.findWhere(header.format, {ID: key}),
    type;

    if (headerSpec && headerSpec.Type) {
      type = headerSpec.Type;
      val = HEADER_TYPES[type](val);
    } else {
      // No type defined in header: we'll try to derive it, and fall back
      // to String.
      type = deriveType(val);
      val = HEADER_TYPES[type](val);
      if (WARN) {
        console.log("Warning: INFO type '" + key + "' is not defined in header. (Value = '" + val + "'). Derived type as '" + type + "'.");
      }
    }

    sample[key] = val;
    return sample;
  }, {});
}

function _genKey(record) {
  return 'chr' + record.CHROM + ':' + record.POS + "(" + record.REF + "->" + record.ALT + ")";
}



function vcf() {
  var data = {},
      header = [],
      parseChrom = _parseChrom,
      parsePos = _parsePos,
      parseId = _parseId,
      parseRef = _parseRef,
      parseAlt = _parseAlt,
      parseQual = _parseQual,
      parseFilter = _parseFilter,
      parseInfo = _parseInfo,
      parseFormat = _parseFormat,
      parseSample = _parseSample,
      genKey = _genKey;

  var vcf_ = function() {
    return this;
  };

    //////////////////////////////////////////////////////////////////////
   // Below: initializing Records and parsing their constituent data.  //
  //////////////////////////////////////////////////////////////////////

  function initializeRecord(vals, header) {
    return _.reduce(header.columns, function(record, colname, idx) {
      // null if val is '.' (VCF null), else the trimmed value.
      var val = vals[idx] ? vals[idx].trim() : null;
      record[colname] = val === '.' ? null : val;
      return record;
    }, {__header: header});
  }

  function Record(line, header) {
    // Returns a VCF record.
    //
    // `line` - a line of the VCF file that represents an individual record.
    // `header` - the parsed VCF header.
    var vals = line.split('\t'),
    record = initializeRecord(vals, header);

    if (record.CHROM)   record.CHROM = parseChrom(record.CHROM, header);
    if (record.POS)     record.POS = parsePos(record.POS, header);
    if (record.ID)      record.ID = parseId(record.ID, header);
    if (record.REF)     record.REF = parseRef(record.REF, header);
    if (record.ALT)     record.ALT = parseAlt(record.ALT, header);
    if (record.QUAL)    record.QUAL = parseQual(record.QUAL, header);
    if (record.FILTER)  record.FILTER = parseFilter(record.FILTER, header);
    if (record.INFO)    record.INFO = parseInfo(record.INFO, header);
    if (record.FORMAT)  record.FORMAT = parseFormat(record.FORMAT, header);

    record.__KEY__ = genKey(record);

    _.each(header.sampleNames, function(sampleName) {
      var sample = record[sampleName];
      if (sample) {
        record[sampleName] = parseSample(sample, record.FORMAT, header);
      }
    });

    record.variantType = function() {
      if (record.isSnv()) return 'SNV';
      if (record.isSv()) return 'SV';
      if (record.isIndel()) return record.isDeletion() ? 'DELETION' : 'INSERTION';
      return 'UNKNOWN';
    }

    record.isSnv = function() {
      var isSnv = true;
      if (record.REF && record.REF.length > 1) isSnv = false;
      _.each(record.ALT, function(alt) {
        if (alt && !_.contains(BASES, alt)) isSnv = false;
      });
      return isSnv;
    }

    record.isSv = function() {
      if (record.INFO && record.INFO.SVTYPE) return true;
      return false;
    }

    record.isCnv = function() {
      if (record.INFO && record.INFO.SVTYPE === 'CNV') return true;
      return false;
    }

    record.isIndel = function() {
      return record.isDeletion() || record.isInsertion();
    }

    record.isDeletion = function() {
      if (record.isSv()) return false;
      if (record.ALT && record.ALT.length > 1) return false;
      if (record.REF && record.ALT && record.ALT.length <= 1) {
        if (record.REF.length > record.ALT[0].length) return true;
      }
      return false;
    }

    record.isInsertion = function() {
      if (record.isSv()) return false;
      if (record.REF && record.ALT && record.ALT.length >= 1) {
        if (record.REF.length < record.ALT[0].length) return true;
      }
      return false;
    }

    return record;
  }


  function parseVCF(text) {
    // Returns a parsed VCF object, with attributed `data` and `header`.
    //    `data` - a list of VCF Records.
    //    `header` - an object of the metadata parsed from the VCF header.
    //
    // `text` - VCF plaintext.
    var lines = _.reject(text.split('\n'), function(line) {
      return line === '';
    })

    var partitions = _.partition(lines, function(line) {
      return line[0] === '#';
    });

    var header = parseHeader(partitions[0]),
    data = _.map(partitions[1], function(line) {
      return new Record(line, header);
    });

    return {header: header, data: data};
  }


    ///////////////////////////
   //   Primary VCF.js API  //
  ///////////////////////////

  function parseData(text, type) {
    var data, header;
    type = type.toLowerCase();
    if (type === 'vcf') {
      var parsedVcf = parseVCF(text);
      data = parsedVcf.data;
      header = parsedVcf.header;
    } else if (type === 'json') {
      // TODO(ihodes): Need a spec and correspondance between
      //               Records and these (add __header -> header,
      //               etc).
      data = JSON.parse(text).data;
      header = JSON.parse(text).header;
    } else {
      throw TypeError("Type '" +  type + "' not recognized: use VCF or JSON.");
    }
    return {data: data, header: header}
  }


  vcf_.parseChrom = function(_) {
    if (!arguments.length) return parseChrom;
    parseChrom = _;
    return vcf_;
  };
  vcf_.parsePos = function(_) {
    if (!arguments.length) return parsePos;
    parsePos = _;
    return vcf_;
  };
  vcf_.parseId = function(_) {
    if (!arguments.length) return parseId;
    parseId = _;
    return vcf_;
  };
  vcf_.parseRef = function(_) {
    if (!arguments.length) return parseRef;
    parseRef = _;
    return vcf_;
  };
  vcf_.parseAlt = function(_) {
    if (!arguments.length) return parseAlt;
    parseAlt = _;
    return vcf_;
  };
  vcf_.parseQual = function(_) {
    if (!arguments.length) return parseQual;
    parseQual = _;
    return vcf_;
  };
  vcf_.parseFilter = function(_) {
    if (!arguments.length) return parseFilter;
    parseFilter = _;
    return vcf_;
  };
  vcf_.parseInfo = function(_) {
    if (!arguments.length) return parseInfo;
    parseInfo = _;
    return vcf_;
  };
  vcf_.parseFormat = function(_) {
    if (!arguments.length) return parseFormat;
    parseFormat = _;
    return vcf_;
  };
  vcf_.parseSample = function(_) {
    if (!arguments.length) return parseSample;
    parseSample = _;
    return vcf_;
  };
  vcf_.genKey = function(_) {
    if (!arguments.length) return genKey;
    genKey = _;
    return vcf_;
  };

  vcf_.header = function() {
    return header;
  };

  vcf_.data = function(text, type) {
    if (!arguments.length)  return data;

    var result = parseData(text, type || DEFAULT_TYPE);
    data = result.data;
    header = result.header;
    return vcf_;
  };
  vcf_.fetch = function(chromosome, start, end) {
    // O(N) time. TODO(ihodes): Add sorted option to get O(lnN),
    //                          fallback to O(N).
    return _.filter(data, function(record) {
      if (chromosome != record.CHROM)
        return false;

      if (record.POS < end) {
        if (record.POS >= start)
          return true;
        if (record.INFO && record.INFO.END &&
            record.INFO.END >= start && record.POS < end)
          return true;
      }
      return false;
    });
  };
  vcf_.get = function(idx) {
    return this.data()[idx];
  };
  vcf_.filter = function(fn) {
    // TODO(ihodes): Should this return a vcf object with new data internally
    //               instead of a plain array? Not sure I like this API.
    return _.filter(data, fn);
  };

  return vcf_;
}

if (typeof define === "function" && define.amd) {
  define(vcf);
} else if (typeof module === "object" && module.exports) {
  module.exports = vcf;
} else {
  window.vcf = vcf;
}

})();
