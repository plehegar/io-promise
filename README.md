# io-promise

I/O primitives using promises

```js
  const io = require("io-promise");
```

## Fetch support

```js
 io.fetch("http://www.example.org").then(function (res) {
   return res.text();
  })
```

```js
  io.fetch("http://www.example.com/object.json").then(function (res) {
   return res.json();
  })
```

```js
  io.post("http://www.example.org", {foo: "bar"} ).then(function (res) {
   return res.text();
  })
```

## File API support

```js
  io.readJSON("myfile.json").then(function (data) {
   do something with data;
  })
```

```js
  io.readJSON("myfile.json").then(function (data) {
   do something with data;
  })
```

```js
  io.fetch("http://www.example.org", { delay: 2 } ).then(function (res) {
   return res.text();
  })
```

## Response object

`status` HTTP status code
`url` URL requested
`headers` Object will all of the headers from the HTTP response
`text()` Returns the data as a string
`json()` Returns the data as an object

## Monitoring

```js
  io.monitor(); // active the monitoring
  io.returns an array contains all of the url requested
```

## Caching

Caching of fetch requests

```js
  var cache = new io.Cache("/tmp/");
  cache.load("http://www.example.org").then(function (res) {
    return res.text();
  })
```
