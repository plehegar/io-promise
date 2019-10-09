/*
 Copyright © 2018 World Wide Web Consortium, (Massachusetts Institute of Technology,
 European Research Consortium for Informatics and Mathematics, Keio University, Beihang).
 All Rights Reserved.

 This work is distributed under the W3C® Software License [1] in the hope that it will
 be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

 [1] http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231
*/
const https = require("https");
const http  = require("http");
const URL   = require("url");
const FS    = require("fs");

// array for monitoring
let MONITORING;

// array for caches
let caches = [];

// Definition of a response
class Response {
  constructor(options) {
    this.status = options.status;
    this.url    = options.url;
    this.data   = options.data; // @@ should be a buffer
    this.headers = options.headers;
  }
  text() {
    return Promise.resolve(this.data);
  }
  json() {
    return this.text().then(JSON.parse);
  }
}

any = function (params) {
  // console.log("Calling exports.any");
  let settings = {};
  let opts = (params.options === undefined)? {} : params.options;
  let delay = 0;
  if (opts.delay !== undefined) {
    delay = opts.delay * 1000; // use seconds instead of ms
  }
  if (opts.auth !== undefined) {
    settings.auth = opts.auth;
  }
  settings.method = params.verb;
  if (params.url === undefined) {
    return new Promise(function (resolve, reject) {
      reject(params.verb + " url is undefined");
    });
  } else {
    // ensure url is a string
    params.url = "" + params.url;
  }
  if (opts.headers !== undefined) {
    settings.headers = JSON.parse(JSON.stringify(params.options.headers));
  }
  if (settings.headers === undefined) settings.headers = {};
  if (params.data !== undefined) {
    if (settings.headers['Content-Type'] === undefined) {
      if (typeof params.data == "object") {
        settings.headers['Content-Type'] = "application/json";
        let data = JSON.stringify(params.data);
        params.data = data;
      } else {
        settings.headers['Content-Type'] = "application/octet-stream";
      }
    }
    if (settings.headers['Content-Length'] === undefined) {
      if (typeof params.data == "string") {
        settings.headers['Content-Length'] = params.data.length;
      }
      // @@support other primitive types?
    }
  }
  let library = (params.url.indexOf("https://") === 0)? https : http;
  if (MONITORING !== undefined) { // if monitoring
    MONITORING.push(params.url);
  }
  return new Promise(function (resolve, reject) {
    let location = URL.parse(params.url);
    settings.hostname = location.hostname;
    settings.path = location.path;
    let req = library.request(settings, function(res) {
      let buffer = "";
      res.on('data', function (chunk) {
        buffer += chunk;
      });
      res.on('end', function () {
        let response = new Response({ status: res.statusCode,
                                 url: params.url,
                                 data: buffer,
                                 headers: res.headers });
        let fct = reject;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          fct =resolve;
        }
        if (delay === 0) {
          fct(response);
        } else {
          // console.log("We're delaying...");
          setTimeout(function () {
            fct(response);
          }, delay);
        }
      });
    });
    req.on('error', function(err) {
      reject(err);
    });
    if (params.data !== undefined) req.write(params.data);
    req.end();
  });
};

exports.get = function (url, options) {
  return any({ verb: 'GET', url: url, options: options});
};

exports.head = function (url, options) {
  return any({ verb: 'HEAD', url: url, options: options});
};

exports.post = function (url, data, options) {
  return any({ verb: 'POST', url: url, data: data, options: options});
};

exports.delete = function (url, data, options) {
  return any({ verb: 'delete', url: url, data: data, options: options});
};

exports.put = function (url, data, options) {
  return any({ verb: 'POST', url: url, data: data, options: options});
};

exports.patch = function (url, data, options) {
  return any({ verb: 'PATCH', url: url, data: data, options: options});
};

exports.fetch = exports.get;

// File IO

exports.read = function (filename, options) {
  let opts = options;
  if (options === undefined) {
    opts = {  encoding: "utf-8" };
  }
  return new Promise(function (resolve, reject) {
    FS.readFile(filename, opts, function(err, data) {
      if (err) {
        reject (err);
      } else {
        resolve(data);
      }
    });
  });
};

exports.save = function (filename, data, options) {
  let opts = options;
  if (options === undefined) {
    opts = { encoding: "utf-8" };
  }
  if (typeof data == "object") {
    // Use JSON serializer for objects
    bytes = JSON.stringify(data);
  } else {
    bytes = data;
  }
  return new Promise(function (resolve, reject) {
    FS.writeFile(filename, bytes, opts, function(err) {
      if (err) {
        reject (err);
      } else {
        resolve(data);
      }
    });
  });
};

exports.readJSON = function (filename) {
  return exports.read(filename).then(JSON.parse);
};

// monitoring functions for fetch

exports.fetches = function() {
  // makes a copy
  if (MONITORING !== undefined) {
    return MONITORING.map(function (u) {
      return u;
    });
  }
};

exports.fetchesCount = function() {
  return (MONITORING === undefined)? 0 : MONITORING.length;
};

exports.monitor = function () {
  MONITORING = [];
};

// delay a promise

exports.wait = function (delay, continuation) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      let result;
      if (continuation !== undefined) {
        if (typeof continuation == "function") {
          try {
            result = continuation();
          } catch (err) {
            reject (err);
            return undefined;
          }
        } else {
          result = continuation;
        }
      }
      resolve(result);
    }, delay);}
  );
};

// caching

exports.Cache = function (path) {
  let cache; // keep the caches[path] object
  if (path === undefined) {
    path = "/tmp/";
  }
  // @@ analyze the path for clean up

   // load the cache index from the path
  function loadCache() {
    if (cache !== undefined) {
      return Promise.resolve(cache);
    } else if (caches[path] !== undefined) {
      cache = caches[path];
      return Promise.resolve(cache);
     } else {
      return exports.readJSON(path + "index.json").catch(err => {
        console.log(err);
        return {};
      }).then(obj => {
        caches[path] = obj;
        cache = obj;
        return obj;
      });
    }
  }
  // creates a uniq hash for cache entry
  function getUniqId() {
    let id = Math.random() * 10**10; // creates a hash
    for (let key in cache) {
      if (cache[key].data === id) {
        return getUniqId();
      }
    }
    return id;
  }
  // add an entry in the cache
  function addEntry(url, entry) {
    if (cache !== undefined) {
      cache[url] = entry;
      return exports.save(path + "index.json", cache);
    } else {
      console.log("hu?!? cache isn't activated?!?"); // unreachable
    }
  }
  // fetch a resource and add it into the cache
  function fetchNCache(url, options) {
    return exports.fetch(url, options).then(res => {
      let copy = cache[url];
      let id = getUniqId();
      if (copy !== undefined) {
        id = copy.data; // overwrite this entry
      }
      let copy = cache[url];
      let entry = { status : res.status, url : res.url, data : id, headers : res.headers };
      return exports.save(path + id + ".meta.json", entry).then(meta => {
        return exports.save(path + id + ".data", res.data).then(data => {
          return addEntry(url, entry).then(r => res);
        });
      });
    })
  }
  // load a resource, from the cache or add it there as well if needed
  this.load = function(url, options) {
    let invalidate = false || (options !== undefined && options.invalidate);
    if (invalidate) console.log("invalidate");
    return loadCache().then(cache => {
       let copy = cache[url];
       if (copy !== undefined) {
//        if (copy !== undefined && !!invalidate) {
          return exports.read(path + copy.data + ".meta.json").then(meta => {
           return exports.read(path + copy.data + ".data").then(data => {
             return new Response({ status : meta.status, url : meta.url, data : data, headers : meta.headers });
           });
         }).catch(err => {
           console.log(err);
           return fetchNCache(url, options);
         });
       } else {
         if (copy === undefined) {
          console.log("Not in cache " + url);
         } else {
          console.log("Invalidating cache " + url);
         }
         return fetchNCache(url, options);
       }
    });
  }
}
