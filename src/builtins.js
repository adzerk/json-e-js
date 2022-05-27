var {BuiltinError} = require('./error');
var fromNow = require('./from-now');
var {
  isString, isNumber, isBool,
  isArray, isObject,
  isNull, isFunction,
} = require('./type-utils');

let types = {
  string: isString,
  number: isNumber,
  boolean: isBool,
  array: isArray,
  object: isObject,
  null: isNull,
  function: isFunction,
};

let builtinError = (builtin) => new BuiltinError(`invalid arguments to ${builtin}`);

module.exports = (context) => {
  let builtins = {};
  let define = (name, context, {
    argumentTests = [],
    minArgs = false,
    variadic = null,
    needsContext = false,
    invoke,
  }) => {
    context[name] = (...args) => {
      let ctx = args.shift();
      if (!variadic && args.length < argumentTests.length) {
        throw builtinError(`builtin: ${name}`, `${args.toString()}, too few arguments`);
      }

      if (minArgs && args.length < minArgs) {
        throw builtinError(`builtin: ${name}: expected at least ${minArgs} arguments`);
      }

      if (variadic) {
        argumentTests = args.map(() => variadic);
      }

      args.forEach((arg, i) => {
        if (!argumentTests[i].split('|').some(test => types[test](arg))) {
          throw builtinError(`builtin: ${name}`, `argument ${i + 1} to be ${argumentTests[i]} found ${typeof arg}`);
        }
      });
      if (needsContext)
        return invoke(ctx, ...args);

      return invoke(...args);
    };
    context[name].jsone_builtin = true;

    return context[name];
  };

  // Math functions
  ['max', 'min'].forEach(name => {
    if (Math[name] == undefined) {
      throw new Error(`${name} in Math undefined`);
    }
    define(name, builtins, {
      minArgs: 1,
      variadic: 'number',
      invoke: (...args) => Math[name](...args),
    });
  });

  ['sqrt', 'ceil', 'floor', 'abs'].forEach(name => {
    if (Math[name] == undefined) {
      throw new Error(`${name} in Math undefined`);
    }
    define(name, builtins, {
      argumentTests: ['number'],
      invoke: num => Math[name](num),
    });
  });

  // String manipulation
  define('lowercase', builtins, {
    argumentTests: ['string'],
    invoke: str => str.toLowerCase(),
  });

  define('uppercase', builtins, {
    argumentTests: ['string'],
    invoke: str => str.toUpperCase(),
  });

  define('str', builtins, {
    argumentTests: ['string|number|boolean|null'],
    invoke: obj => {
      if (obj === null) {
        return 'null';
      }
      return obj.toString();
    },
  });

  define('number', builtins, {
    argumentTests: ['string'],
    invoke: Number,
  });

  define('len', builtins, {
    argumentTests: ['string|array'],
    invoke: obj => Array.from(obj).length,
  });

  define('strip', builtins, {
    argumentTests: ['string'],
    invoke: str => str.trim(),
  });

  define('rstrip', builtins, {
    argumentTests: ['string'],
    invoke: str => str.replace(/\s+$/, ''),
  });

  define('lstrip', builtins, {
    argumentTests: ['string'],
    invoke: str => str.replace(/^\s+/, ''),
  });

  define('split', builtins, {
    minArgs: 1,
    variadic: 'string|number',
    invoke: (input, delimiter) => input.split(delimiter)
  });

  define('join', builtins, {
    argumentTests: ['array', 'string|number'],
    invoke: (list, separator) => list.join(separator) 
  });

  // Miscellaneous
  define('fromNow', builtins, {
    variadic: 'string',
    minArgs: 1,
    needsContext: true,
    invoke: (ctx, str, reference) => fromNow(str, reference || ctx.now),
  });

  define('typeof', builtins, {
    argumentTests: ['string|number|boolean|array|object|null|function'],
    invoke: x => {
      for (let type of ['string', 'number', 'boolean', 'array', 'object', 'function']) {
        if (types[type](x)) {
          return type;
        }
      }
      if (types['null'](x)) {
        return 'null';
      }
      throw builtinError('builtin: typeof', `argument ${x} to be a valid json-e type. found ${typeof arg}`);
    },
  });

  define('defined', builtins, {
    argumentTests: ['string'],
    needsContext: true,
    invoke: (ctx, str) => ctx.hasOwnProperty(str)
  });

  return Object.assign({}, builtins, context);
};
