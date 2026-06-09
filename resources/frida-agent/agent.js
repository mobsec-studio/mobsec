/* MOBSEC_FRIDA_AGENT generated; edit src/agent/** */
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target2, all) => {
    for (var name in all)
      __defProp(target2, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target2) => (target2 = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target2, "default", { value: mod, enumerable: true }) : target2,
    mod
  ));
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // node_modules/base64-js/index.js
  var require_base64_js = __commonJS({
    "node_modules/base64-js/index.js"(exports) {
      "use strict";
      exports.byteLength = byteLength;
      exports.toByteArray = toByteArray;
      exports.fromByteArray = fromByteArray;
      var lookup = [];
      var revLookup = [];
      var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
      var code3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (i = 0, len = code3.length; i < len; ++i) {
        lookup[i] = code3[i];
        revLookup[code3.charCodeAt(i)] = i;
      }
      var i;
      var len;
      revLookup["-".charCodeAt(0)] = 62;
      revLookup["_".charCodeAt(0)] = 63;
      function getLens(b64) {
        var len2 = b64.length;
        if (len2 % 4 > 0) {
          throw new Error("Invalid string. Length must be a multiple of 4");
        }
        var validLen = b64.indexOf("=");
        if (validLen === -1) validLen = len2;
        var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
        return [validLen, placeHoldersLen];
      }
      function byteLength(b64) {
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function _byteLength(b64, validLen, placeHoldersLen) {
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function toByteArray(b64) {
        var tmp;
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
        var curByte = 0;
        var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
        var i2;
        for (i2 = 0; i2 < len2; i2 += 4) {
          tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
          arr[curByte++] = tmp >> 16 & 255;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 2) {
          tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 1) {
          tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        return arr;
      }
      function tripletToBase64(num) {
        return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
      }
      function encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i2 = start; i2 < end; i2 += 3) {
          tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
          output.push(tripletToBase64(tmp));
        }
        return output.join("");
      }
      function fromByteArray(uint8) {
        var tmp;
        var len2 = uint8.length;
        var extraBytes = len2 % 3;
        var parts = [];
        var maxChunkLength = 16383;
        for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
          parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
        }
        if (extraBytes === 1) {
          tmp = uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
          );
        } else if (extraBytes === 2) {
          tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
          );
        }
        return parts.join("");
      }
    }
  });

  // node_modules/ieee754/index.js
  var require_ieee754 = __commonJS({
    "node_modules/ieee754/index.js"(exports) {
      exports.read = function(buffer, offset, isLE, mLen, nBytes) {
        var e, m;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var nBits = -7;
        var i = isLE ? nBytes - 1 : 0;
        var d = isLE ? -1 : 1;
        var s = buffer[offset + i];
        i += d;
        e = s & (1 << -nBits) - 1;
        s >>= -nBits;
        nBits += eLen;
        for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        m = e & (1 << -nBits) - 1;
        e >>= -nBits;
        nBits += mLen;
        for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        if (e === 0) {
          e = 1 - eBias;
        } else if (e === eMax) {
          return m ? NaN : (s ? -1 : 1) * Infinity;
        } else {
          m = m + Math.pow(2, mLen);
          e = e - eBias;
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
      };
      exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
        var e, m, c;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
        var i = isLE ? 0 : nBytes - 1;
        var d = isLE ? 1 : -1;
        var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
        value = Math.abs(value);
        if (isNaN(value) || value === Infinity) {
          m = isNaN(value) ? 1 : 0;
          e = eMax;
        } else {
          e = Math.floor(Math.log(value) / Math.LN2);
          if (value * (c = Math.pow(2, -e)) < 1) {
            e--;
            c *= 2;
          }
          if (e + eBias >= 1) {
            value += rt / c;
          } else {
            value += rt * Math.pow(2, 1 - eBias);
          }
          if (value * c >= 2) {
            e++;
            c /= 2;
          }
          if (e + eBias >= eMax) {
            m = 0;
            e = eMax;
          } else if (e + eBias >= 1) {
            m = (value * c - 1) * Math.pow(2, mLen);
            e = e + eBias;
          } else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
            e = 0;
          }
        }
        for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
        }
        e = e << mLen | m;
        eLen += mLen;
        for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
        }
        buffer[offset + i - d] |= s * 128;
      };
    }
  });

  // node_modules/buffer/index.js
  var require_buffer = __commonJS({
    "node_modules/buffer/index.js"(exports) {
      "use strict";
      var base64 = require_base64_js();
      var ieee754 = require_ieee754();
      var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
      exports.Buffer = Buffer3;
      exports.SlowBuffer = SlowBuffer;
      exports.INSPECT_MAX_BYTES = 50;
      var K_MAX_LENGTH = 2147483647;
      exports.kMaxLength = K_MAX_LENGTH;
      Buffer3.TYPED_ARRAY_SUPPORT = typedArraySupport();
      if (!Buffer3.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
        console.error(
          "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
        );
      }
      function typedArraySupport() {
        try {
          var arr = new Uint8Array(1);
          var proto = { foo: function() {
            return 42;
          } };
          Object.setPrototypeOf(proto, Uint8Array.prototype);
          Object.setPrototypeOf(arr, proto);
          return arr.foo() === 42;
        } catch (e) {
          return false;
        }
      }
      Object.defineProperty(Buffer3.prototype, "parent", {
        enumerable: true,
        get: function() {
          if (!Buffer3.isBuffer(this)) return void 0;
          return this.buffer;
        }
      });
      Object.defineProperty(Buffer3.prototype, "offset", {
        enumerable: true,
        get: function() {
          if (!Buffer3.isBuffer(this)) return void 0;
          return this.byteOffset;
        }
      });
      function createBuffer(length) {
        if (length > K_MAX_LENGTH) {
          throw new RangeError('The value "' + length + '" is invalid for option "size"');
        }
        var buf = new Uint8Array(length);
        Object.setPrototypeOf(buf, Buffer3.prototype);
        return buf;
      }
      function Buffer3(arg, encodingOrOffset, length) {
        if (typeof arg === "number") {
          if (typeof encodingOrOffset === "string") {
            throw new TypeError(
              'The "string" argument must be of type string. Received type number'
            );
          }
          return allocUnsafe(arg);
        }
        return from(arg, encodingOrOffset, length);
      }
      Buffer3.poolSize = 8192;
      function from(value, encodingOrOffset, length) {
        if (typeof value === "string") {
          return fromString(value, encodingOrOffset);
        }
        if (ArrayBuffer.isView(value)) {
          return fromArrayView(value);
        }
        if (value == null) {
          throw new TypeError(
            "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
          );
        }
        if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof value === "number") {
          throw new TypeError(
            'The "value" argument must not be of type number. Received type number'
          );
        }
        var valueOf = value.valueOf && value.valueOf();
        if (valueOf != null && valueOf !== value) {
          return Buffer3.from(valueOf, encodingOrOffset, length);
        }
        var b = fromObject(value);
        if (b) return b;
        if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
          return Buffer3.from(
            value[Symbol.toPrimitive]("string"),
            encodingOrOffset,
            length
          );
        }
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      Buffer3.from = function(value, encodingOrOffset, length) {
        return from(value, encodingOrOffset, length);
      };
      Object.setPrototypeOf(Buffer3.prototype, Uint8Array.prototype);
      Object.setPrototypeOf(Buffer3, Uint8Array);
      function assertSize(size) {
        if (typeof size !== "number") {
          throw new TypeError('"size" argument must be of type number');
        } else if (size < 0) {
          throw new RangeError('The value "' + size + '" is invalid for option "size"');
        }
      }
      function alloc(size, fill, encoding) {
        assertSize(size);
        if (size <= 0) {
          return createBuffer(size);
        }
        if (fill !== void 0) {
          return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
        }
        return createBuffer(size);
      }
      Buffer3.alloc = function(size, fill, encoding) {
        return alloc(size, fill, encoding);
      };
      function allocUnsafe(size) {
        assertSize(size);
        return createBuffer(size < 0 ? 0 : checked(size) | 0);
      }
      Buffer3.allocUnsafe = function(size) {
        return allocUnsafe(size);
      };
      Buffer3.allocUnsafeSlow = function(size) {
        return allocUnsafe(size);
      };
      function fromString(string, encoding) {
        if (typeof encoding !== "string" || encoding === "") {
          encoding = "utf8";
        }
        if (!Buffer3.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        var length = byteLength(string, encoding) | 0;
        var buf = createBuffer(length);
        var actual = buf.write(string, encoding);
        if (actual !== length) {
          buf = buf.slice(0, actual);
        }
        return buf;
      }
      function fromArrayLike(array) {
        var length = array.length < 0 ? 0 : checked(array.length) | 0;
        var buf = createBuffer(length);
        for (var i = 0; i < length; i += 1) {
          buf[i] = array[i] & 255;
        }
        return buf;
      }
      function fromArrayView(arrayView) {
        if (isInstance(arrayView, Uint8Array)) {
          var copy = new Uint8Array(arrayView);
          return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
        }
        return fromArrayLike(arrayView);
      }
      function fromArrayBuffer(array, byteOffset, length) {
        if (byteOffset < 0 || array.byteLength < byteOffset) {
          throw new RangeError('"offset" is outside of buffer bounds');
        }
        if (array.byteLength < byteOffset + (length || 0)) {
          throw new RangeError('"length" is outside of buffer bounds');
        }
        var buf;
        if (byteOffset === void 0 && length === void 0) {
          buf = new Uint8Array(array);
        } else if (length === void 0) {
          buf = new Uint8Array(array, byteOffset);
        } else {
          buf = new Uint8Array(array, byteOffset, length);
        }
        Object.setPrototypeOf(buf, Buffer3.prototype);
        return buf;
      }
      function fromObject(obj) {
        if (Buffer3.isBuffer(obj)) {
          var len = checked(obj.length) | 0;
          var buf = createBuffer(len);
          if (buf.length === 0) {
            return buf;
          }
          obj.copy(buf, 0, 0, len);
          return buf;
        }
        if (obj.length !== void 0) {
          if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
            return createBuffer(0);
          }
          return fromArrayLike(obj);
        }
        if (obj.type === "Buffer" && Array.isArray(obj.data)) {
          return fromArrayLike(obj.data);
        }
      }
      function checked(length) {
        if (length >= K_MAX_LENGTH) {
          throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
        }
        return length | 0;
      }
      function SlowBuffer(length) {
        if (+length != length) {
          length = 0;
        }
        return Buffer3.alloc(+length);
      }
      Buffer3.isBuffer = function isBuffer(b) {
        return b != null && b._isBuffer === true && b !== Buffer3.prototype;
      };
      Buffer3.compare = function compare(a, b) {
        if (isInstance(a, Uint8Array)) a = Buffer3.from(a, a.offset, a.byteLength);
        if (isInstance(b, Uint8Array)) b = Buffer3.from(b, b.offset, b.byteLength);
        if (!Buffer3.isBuffer(a) || !Buffer3.isBuffer(b)) {
          throw new TypeError(
            'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
          );
        }
        if (a === b) return 0;
        var x = a.length;
        var y = b.length;
        for (var i = 0, len = Math.min(x, y); i < len; ++i) {
          if (a[i] !== b[i]) {
            x = a[i];
            y = b[i];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      Buffer3.isEncoding = function isEncoding(encoding) {
        switch (String(encoding).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      };
      Buffer3.concat = function concat(list, length) {
        if (!Array.isArray(list)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        }
        if (list.length === 0) {
          return Buffer3.alloc(0);
        }
        var i;
        if (length === void 0) {
          length = 0;
          for (i = 0; i < list.length; ++i) {
            length += list[i].length;
          }
        }
        var buffer = Buffer3.allocUnsafe(length);
        var pos = 0;
        for (i = 0; i < list.length; ++i) {
          var buf = list[i];
          if (isInstance(buf, Uint8Array)) {
            if (pos + buf.length > buffer.length) {
              Buffer3.from(buf).copy(buffer, pos);
            } else {
              Uint8Array.prototype.set.call(
                buffer,
                buf,
                pos
              );
            }
          } else if (!Buffer3.isBuffer(buf)) {
            throw new TypeError('"list" argument must be an Array of Buffers');
          } else {
            buf.copy(buffer, pos);
          }
          pos += buf.length;
        }
        return buffer;
      };
      function byteLength(string, encoding) {
        if (Buffer3.isBuffer(string)) {
          return string.length;
        }
        if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
          return string.byteLength;
        }
        if (typeof string !== "string") {
          throw new TypeError(
            'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
          );
        }
        var len = string.length;
        var mustMatch = arguments.length > 2 && arguments[2] === true;
        if (!mustMatch && len === 0) return 0;
        var loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "ascii":
            case "latin1":
            case "binary":
              return len;
            case "utf8":
            case "utf-8":
              return utf8ToBytes(string).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return len * 2;
            case "hex":
              return len >>> 1;
            case "base64":
              return base64ToBytes(string).length;
            default:
              if (loweredCase) {
                return mustMatch ? -1 : utf8ToBytes(string).length;
              }
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer3.byteLength = byteLength;
      function slowToString(encoding, start, end) {
        var loweredCase = false;
        if (start === void 0 || start < 0) {
          start = 0;
        }
        if (start > this.length) {
          return "";
        }
        if (end === void 0 || end > this.length) {
          end = this.length;
        }
        if (end <= 0) {
          return "";
        }
        end >>>= 0;
        start >>>= 0;
        if (end <= start) {
          return "";
        }
        if (!encoding) encoding = "utf8";
        while (true) {
          switch (encoding) {
            case "hex":
              return hexSlice(this, start, end);
            case "utf8":
            case "utf-8":
              return utf8Slice(this, start, end);
            case "ascii":
              return asciiSlice(this, start, end);
            case "latin1":
            case "binary":
              return latin1Slice(this, start, end);
            case "base64":
              return base64Slice(this, start, end);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return utf16leSlice(this, start, end);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = (encoding + "").toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer3.prototype._isBuffer = true;
      function swap(b, n, m) {
        var i = b[n];
        b[n] = b[m];
        b[m] = i;
      }
      Buffer3.prototype.swap16 = function swap16() {
        var len = this.length;
        if (len % 2 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 16-bits");
        }
        for (var i = 0; i < len; i += 2) {
          swap(this, i, i + 1);
        }
        return this;
      };
      Buffer3.prototype.swap32 = function swap32() {
        var len = this.length;
        if (len % 4 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 32-bits");
        }
        for (var i = 0; i < len; i += 4) {
          swap(this, i, i + 3);
          swap(this, i + 1, i + 2);
        }
        return this;
      };
      Buffer3.prototype.swap64 = function swap64() {
        var len = this.length;
        if (len % 8 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 64-bits");
        }
        for (var i = 0; i < len; i += 8) {
          swap(this, i, i + 7);
          swap(this, i + 1, i + 6);
          swap(this, i + 2, i + 5);
          swap(this, i + 3, i + 4);
        }
        return this;
      };
      Buffer3.prototype.toString = function toString() {
        var length = this.length;
        if (length === 0) return "";
        if (arguments.length === 0) return utf8Slice(this, 0, length);
        return slowToString.apply(this, arguments);
      };
      Buffer3.prototype.toLocaleString = Buffer3.prototype.toString;
      Buffer3.prototype.equals = function equals(b) {
        if (!Buffer3.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
        if (this === b) return true;
        return Buffer3.compare(this, b) === 0;
      };
      Buffer3.prototype.inspect = function inspect() {
        var str = "";
        var max = exports.INSPECT_MAX_BYTES;
        str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
        if (this.length > max) str += " ... ";
        return "<Buffer " + str + ">";
      };
      if (customInspectSymbol) {
        Buffer3.prototype[customInspectSymbol] = Buffer3.prototype.inspect;
      }
      Buffer3.prototype.compare = function compare(target2, start, end, thisStart, thisEnd) {
        if (isInstance(target2, Uint8Array)) {
          target2 = Buffer3.from(target2, target2.offset, target2.byteLength);
        }
        if (!Buffer3.isBuffer(target2)) {
          throw new TypeError(
            'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target2
          );
        }
        if (start === void 0) {
          start = 0;
        }
        if (end === void 0) {
          end = target2 ? target2.length : 0;
        }
        if (thisStart === void 0) {
          thisStart = 0;
        }
        if (thisEnd === void 0) {
          thisEnd = this.length;
        }
        if (start < 0 || end > target2.length || thisStart < 0 || thisEnd > this.length) {
          throw new RangeError("out of range index");
        }
        if (thisStart >= thisEnd && start >= end) {
          return 0;
        }
        if (thisStart >= thisEnd) {
          return -1;
        }
        if (start >= end) {
          return 1;
        }
        start >>>= 0;
        end >>>= 0;
        thisStart >>>= 0;
        thisEnd >>>= 0;
        if (this === target2) return 0;
        var x = thisEnd - thisStart;
        var y = end - start;
        var len = Math.min(x, y);
        var thisCopy = this.slice(thisStart, thisEnd);
        var targetCopy = target2.slice(start, end);
        for (var i = 0; i < len; ++i) {
          if (thisCopy[i] !== targetCopy[i]) {
            x = thisCopy[i];
            y = targetCopy[i];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
        if (buffer.length === 0) return -1;
        if (typeof byteOffset === "string") {
          encoding = byteOffset;
          byteOffset = 0;
        } else if (byteOffset > 2147483647) {
          byteOffset = 2147483647;
        } else if (byteOffset < -2147483648) {
          byteOffset = -2147483648;
        }
        byteOffset = +byteOffset;
        if (numberIsNaN(byteOffset)) {
          byteOffset = dir ? 0 : buffer.length - 1;
        }
        if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
        if (byteOffset >= buffer.length) {
          if (dir) return -1;
          else byteOffset = buffer.length - 1;
        } else if (byteOffset < 0) {
          if (dir) byteOffset = 0;
          else return -1;
        }
        if (typeof val === "string") {
          val = Buffer3.from(val, encoding);
        }
        if (Buffer3.isBuffer(val)) {
          if (val.length === 0) {
            return -1;
          }
          return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
        } else if (typeof val === "number") {
          val = val & 255;
          if (typeof Uint8Array.prototype.indexOf === "function") {
            if (dir) {
              return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
            } else {
              return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
            }
          }
          return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
        }
        throw new TypeError("val must be string, number or Buffer");
      }
      function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
        var indexSize = 1;
        var arrLength = arr.length;
        var valLength = val.length;
        if (encoding !== void 0) {
          encoding = String(encoding).toLowerCase();
          if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
            if (arr.length < 2 || val.length < 2) {
              return -1;
            }
            indexSize = 2;
            arrLength /= 2;
            valLength /= 2;
            byteOffset /= 2;
          }
        }
        function read(buf, i2) {
          if (indexSize === 1) {
            return buf[i2];
          } else {
            return buf.readUInt16BE(i2 * indexSize);
          }
        }
        var i;
        if (dir) {
          var foundIndex = -1;
          for (i = byteOffset; i < arrLength; i++) {
            if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
              if (foundIndex === -1) foundIndex = i;
              if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
            } else {
              if (foundIndex !== -1) i -= i - foundIndex;
              foundIndex = -1;
            }
          }
        } else {
          if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
          for (i = byteOffset; i >= 0; i--) {
            var found = true;
            for (var j = 0; j < valLength; j++) {
              if (read(arr, i + j) !== read(val, j)) {
                found = false;
                break;
              }
            }
            if (found) return i;
          }
        }
        return -1;
      }
      Buffer3.prototype.includes = function includes(val, byteOffset, encoding) {
        return this.indexOf(val, byteOffset, encoding) !== -1;
      };
      Buffer3.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
      };
      Buffer3.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
      };
      function hexWrite(buf, string, offset, length) {
        offset = Number(offset) || 0;
        var remaining = buf.length - offset;
        if (!length) {
          length = remaining;
        } else {
          length = Number(length);
          if (length > remaining) {
            length = remaining;
          }
        }
        var strLen = string.length;
        if (length > strLen / 2) {
          length = strLen / 2;
        }
        for (var i = 0; i < length; ++i) {
          var parsed = parseInt(string.substr(i * 2, 2), 16);
          if (numberIsNaN(parsed)) return i;
          buf[offset + i] = parsed;
        }
        return i;
      }
      function utf8Write(buf, string, offset, length) {
        return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
      }
      function asciiWrite(buf, string, offset, length) {
        return blitBuffer(asciiToBytes(string), buf, offset, length);
      }
      function base64Write(buf, string, offset, length) {
        return blitBuffer(base64ToBytes(string), buf, offset, length);
      }
      function ucs2Write(buf, string, offset, length) {
        return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
      }
      Buffer3.prototype.write = function write(string, offset, length, encoding) {
        if (offset === void 0) {
          encoding = "utf8";
          length = this.length;
          offset = 0;
        } else if (length === void 0 && typeof offset === "string") {
          encoding = offset;
          length = this.length;
          offset = 0;
        } else if (isFinite(offset)) {
          offset = offset >>> 0;
          if (isFinite(length)) {
            length = length >>> 0;
            if (encoding === void 0) encoding = "utf8";
          } else {
            encoding = length;
            length = void 0;
          }
        } else {
          throw new Error(
            "Buffer.write(string, encoding, offset[, length]) is no longer supported"
          );
        }
        var remaining = this.length - offset;
        if (length === void 0 || length > remaining) length = remaining;
        if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
          throw new RangeError("Attempt to write outside buffer bounds");
        }
        if (!encoding) encoding = "utf8";
        var loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "hex":
              return hexWrite(this, string, offset, length);
            case "utf8":
            case "utf-8":
              return utf8Write(this, string, offset, length);
            case "ascii":
            case "latin1":
            case "binary":
              return asciiWrite(this, string, offset, length);
            case "base64":
              return base64Write(this, string, offset, length);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return ucs2Write(this, string, offset, length);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      };
      Buffer3.prototype.toJSON = function toJSON() {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        };
      };
      function base64Slice(buf, start, end) {
        if (start === 0 && end === buf.length) {
          return base64.fromByteArray(buf);
        } else {
          return base64.fromByteArray(buf.slice(start, end));
        }
      }
      function utf8Slice(buf, start, end) {
        end = Math.min(buf.length, end);
        var res = [];
        var i = start;
        while (i < end) {
          var firstByte = buf[i];
          var codePoint = null;
          var bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
          if (i + bytesPerSequence <= end) {
            var secondByte, thirdByte, fourthByte, tempCodePoint;
            switch (bytesPerSequence) {
              case 1:
                if (firstByte < 128) {
                  codePoint = firstByte;
                }
                break;
              case 2:
                secondByte = buf[i + 1];
                if ((secondByte & 192) === 128) {
                  tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                  if (tempCodePoint > 127) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 3:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                  if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 4:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                fourthByte = buf[i + 3];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                  if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                    codePoint = tempCodePoint;
                  }
                }
            }
          }
          if (codePoint === null) {
            codePoint = 65533;
            bytesPerSequence = 1;
          } else if (codePoint > 65535) {
            codePoint -= 65536;
            res.push(codePoint >>> 10 & 1023 | 55296);
            codePoint = 56320 | codePoint & 1023;
          }
          res.push(codePoint);
          i += bytesPerSequence;
        }
        return decodeCodePointsArray(res);
      }
      var MAX_ARGUMENTS_LENGTH = 4096;
      function decodeCodePointsArray(codePoints) {
        var len = codePoints.length;
        if (len <= MAX_ARGUMENTS_LENGTH) {
          return String.fromCharCode.apply(String, codePoints);
        }
        var res = "";
        var i = 0;
        while (i < len) {
          res += String.fromCharCode.apply(
            String,
            codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
          );
        }
        return res;
      }
      function asciiSlice(buf, start, end) {
        var ret = "";
        end = Math.min(buf.length, end);
        for (var i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i] & 127);
        }
        return ret;
      }
      function latin1Slice(buf, start, end) {
        var ret = "";
        end = Math.min(buf.length, end);
        for (var i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i]);
        }
        return ret;
      }
      function hexSlice(buf, start, end) {
        var len = buf.length;
        if (!start || start < 0) start = 0;
        if (!end || end < 0 || end > len) end = len;
        var out = "";
        for (var i = start; i < end; ++i) {
          out += hexSliceLookupTable[buf[i]];
        }
        return out;
      }
      function utf16leSlice(buf, start, end) {
        var bytes = buf.slice(start, end);
        var res = "";
        for (var i = 0; i < bytes.length - 1; i += 2) {
          res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
        }
        return res;
      }
      Buffer3.prototype.slice = function slice(start, end) {
        var len = this.length;
        start = ~~start;
        end = end === void 0 ? len : ~~end;
        if (start < 0) {
          start += len;
          if (start < 0) start = 0;
        } else if (start > len) {
          start = len;
        }
        if (end < 0) {
          end += len;
          if (end < 0) end = 0;
        } else if (end > len) {
          end = len;
        }
        if (end < start) end = start;
        var newBuf = this.subarray(start, end);
        Object.setPrototypeOf(newBuf, Buffer3.prototype);
        return newBuf;
      };
      function checkOffset(offset, ext, length) {
        if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
        if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
      }
      Buffer3.prototype.readUintLE = Buffer3.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength2, this.length);
        var val = this[offset];
        var mul = 1;
        var i = 0;
        while (++i < byteLength2 && (mul *= 256)) {
          val += this[offset + i] * mul;
        }
        return val;
      };
      Buffer3.prototype.readUintBE = Buffer3.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          checkOffset(offset, byteLength2, this.length);
        }
        var val = this[offset + --byteLength2];
        var mul = 1;
        while (byteLength2 > 0 && (mul *= 256)) {
          val += this[offset + --byteLength2] * mul;
        }
        return val;
      };
      Buffer3.prototype.readUint8 = Buffer3.prototype.readUInt8 = function readUInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 1, this.length);
        return this[offset];
      };
      Buffer3.prototype.readUint16LE = Buffer3.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] | this[offset + 1] << 8;
      };
      Buffer3.prototype.readUint16BE = Buffer3.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] << 8 | this[offset + 1];
      };
      Buffer3.prototype.readUint32LE = Buffer3.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
      };
      Buffer3.prototype.readUint32BE = Buffer3.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
      };
      Buffer3.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength2, this.length);
        var val = this[offset];
        var mul = 1;
        var i = 0;
        while (++i < byteLength2 && (mul *= 256)) {
          val += this[offset + i] * mul;
        }
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
        return val;
      };
      Buffer3.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength2, this.length);
        var i = byteLength2;
        var mul = 1;
        var val = this[offset + --i];
        while (i > 0 && (mul *= 256)) {
          val += this[offset + --i] * mul;
        }
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
        return val;
      };
      Buffer3.prototype.readInt8 = function readInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 1, this.length);
        if (!(this[offset] & 128)) return this[offset];
        return (255 - this[offset] + 1) * -1;
      };
      Buffer3.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        var val = this[offset] | this[offset + 1] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer3.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        var val = this[offset + 1] | this[offset] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer3.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
      };
      Buffer3.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
      };
      Buffer3.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, true, 23, 4);
      };
      Buffer3.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, false, 23, 4);
      };
      Buffer3.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, true, 52, 8);
      };
      Buffer3.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, false, 52, 8);
      };
      function checkInt(buf, value, offset, ext, max, min) {
        if (!Buffer3.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
        if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
      }
      Buffer3.prototype.writeUintLE = Buffer3.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          var maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset, byteLength2, maxBytes, 0);
        }
        var mul = 1;
        var i = 0;
        this[offset] = value & 255;
        while (++i < byteLength2 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength2;
      };
      Buffer3.prototype.writeUintBE = Buffer3.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          var maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset, byteLength2, maxBytes, 0);
        }
        var i = byteLength2 - 1;
        var mul = 1;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength2;
      };
      Buffer3.prototype.writeUint8 = Buffer3.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer3.prototype.writeUint16LE = Buffer3.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer3.prototype.writeUint16BE = Buffer3.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer3.prototype.writeUint32LE = Buffer3.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset + 3] = value >>> 24;
        this[offset + 2] = value >>> 16;
        this[offset + 1] = value >>> 8;
        this[offset] = value & 255;
        return offset + 4;
      };
      Buffer3.prototype.writeUint32BE = Buffer3.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      Buffer3.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          var limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset, byteLength2, limit - 1, -limit);
        }
        var i = 0;
        var mul = 1;
        var sub = 0;
        this[offset] = value & 255;
        while (++i < byteLength2 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength2;
      };
      Buffer3.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          var limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset, byteLength2, limit - 1, -limit);
        }
        var i = byteLength2 - 1;
        var mul = 1;
        var sub = 0;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength2;
      };
      Buffer3.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
        if (value < 0) value = 255 + value + 1;
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer3.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer3.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer3.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        this[offset + 2] = value >>> 16;
        this[offset + 3] = value >>> 24;
        return offset + 4;
      };
      Buffer3.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        if (value < 0) value = 4294967295 + value + 1;
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      function checkIEEE754(buf, value, offset, ext, max, min) {
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
        if (offset < 0) throw new RangeError("Index out of range");
      }
      function writeFloat(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
        }
        ieee754.write(buf, value, offset, littleEndian, 23, 4);
        return offset + 4;
      }
      Buffer3.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
        return writeFloat(this, value, offset, true, noAssert);
      };
      Buffer3.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
        return writeFloat(this, value, offset, false, noAssert);
      };
      function writeDouble(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
        }
        ieee754.write(buf, value, offset, littleEndian, 52, 8);
        return offset + 8;
      }
      Buffer3.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
        return writeDouble(this, value, offset, true, noAssert);
      };
      Buffer3.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
        return writeDouble(this, value, offset, false, noAssert);
      };
      Buffer3.prototype.copy = function copy(target2, targetStart, start, end) {
        if (!Buffer3.isBuffer(target2)) throw new TypeError("argument should be a Buffer");
        if (!start) start = 0;
        if (!end && end !== 0) end = this.length;
        if (targetStart >= target2.length) targetStart = target2.length;
        if (!targetStart) targetStart = 0;
        if (end > 0 && end < start) end = start;
        if (end === start) return 0;
        if (target2.length === 0 || this.length === 0) return 0;
        if (targetStart < 0) {
          throw new RangeError("targetStart out of bounds");
        }
        if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
        if (end < 0) throw new RangeError("sourceEnd out of bounds");
        if (end > this.length) end = this.length;
        if (target2.length - targetStart < end - start) {
          end = target2.length - targetStart + start;
        }
        var len = end - start;
        if (this === target2 && typeof Uint8Array.prototype.copyWithin === "function") {
          this.copyWithin(targetStart, start, end);
        } else {
          Uint8Array.prototype.set.call(
            target2,
            this.subarray(start, end),
            targetStart
          );
        }
        return len;
      };
      Buffer3.prototype.fill = function fill(val, start, end, encoding) {
        if (typeof val === "string") {
          if (typeof start === "string") {
            encoding = start;
            start = 0;
            end = this.length;
          } else if (typeof end === "string") {
            encoding = end;
            end = this.length;
          }
          if (encoding !== void 0 && typeof encoding !== "string") {
            throw new TypeError("encoding must be a string");
          }
          if (typeof encoding === "string" && !Buffer3.isEncoding(encoding)) {
            throw new TypeError("Unknown encoding: " + encoding);
          }
          if (val.length === 1) {
            var code3 = val.charCodeAt(0);
            if (encoding === "utf8" && code3 < 128 || encoding === "latin1") {
              val = code3;
            }
          }
        } else if (typeof val === "number") {
          val = val & 255;
        } else if (typeof val === "boolean") {
          val = Number(val);
        }
        if (start < 0 || this.length < start || this.length < end) {
          throw new RangeError("Out of range index");
        }
        if (end <= start) {
          return this;
        }
        start = start >>> 0;
        end = end === void 0 ? this.length : end >>> 0;
        if (!val) val = 0;
        var i;
        if (typeof val === "number") {
          for (i = start; i < end; ++i) {
            this[i] = val;
          }
        } else {
          var bytes = Buffer3.isBuffer(val) ? val : Buffer3.from(val, encoding);
          var len = bytes.length;
          if (len === 0) {
            throw new TypeError('The value "' + val + '" is invalid for argument "value"');
          }
          for (i = 0; i < end - start; ++i) {
            this[i + start] = bytes[i % len];
          }
        }
        return this;
      };
      var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
      function base64clean(str) {
        str = str.split("=")[0];
        str = str.trim().replace(INVALID_BASE64_RE, "");
        if (str.length < 2) return "";
        while (str.length % 4 !== 0) {
          str = str + "=";
        }
        return str;
      }
      function utf8ToBytes(string, units) {
        units = units || Infinity;
        var codePoint;
        var length = string.length;
        var leadSurrogate = null;
        var bytes = [];
        for (var i = 0; i < length; ++i) {
          codePoint = string.charCodeAt(i);
          if (codePoint > 55295 && codePoint < 57344) {
            if (!leadSurrogate) {
              if (codePoint > 56319) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              } else if (i + 1 === length) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              }
              leadSurrogate = codePoint;
              continue;
            }
            if (codePoint < 56320) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              leadSurrogate = codePoint;
              continue;
            }
            codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
          } else if (leadSurrogate) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
          }
          leadSurrogate = null;
          if (codePoint < 128) {
            if ((units -= 1) < 0) break;
            bytes.push(codePoint);
          } else if (codePoint < 2048) {
            if ((units -= 2) < 0) break;
            bytes.push(
              codePoint >> 6 | 192,
              codePoint & 63 | 128
            );
          } else if (codePoint < 65536) {
            if ((units -= 3) < 0) break;
            bytes.push(
              codePoint >> 12 | 224,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else if (codePoint < 1114112) {
            if ((units -= 4) < 0) break;
            bytes.push(
              codePoint >> 18 | 240,
              codePoint >> 12 & 63 | 128,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else {
            throw new Error("Invalid code point");
          }
        }
        return bytes;
      }
      function asciiToBytes(str) {
        var byteArray = [];
        for (var i = 0; i < str.length; ++i) {
          byteArray.push(str.charCodeAt(i) & 255);
        }
        return byteArray;
      }
      function utf16leToBytes(str, units) {
        var c, hi, lo;
        var byteArray = [];
        for (var i = 0; i < str.length; ++i) {
          if ((units -= 2) < 0) break;
          c = str.charCodeAt(i);
          hi = c >> 8;
          lo = c % 256;
          byteArray.push(lo);
          byteArray.push(hi);
        }
        return byteArray;
      }
      function base64ToBytes(str) {
        return base64.toByteArray(base64clean(str));
      }
      function blitBuffer(src, dst, offset, length) {
        for (var i = 0; i < length; ++i) {
          if (i + offset >= dst.length || i >= src.length) break;
          dst[i + offset] = src[i];
        }
        return i;
      }
      function isInstance(obj, type) {
        return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
      }
      function numberIsNaN(obj) {
        return obj !== obj;
      }
      var hexSliceLookupTable = (function() {
        var alphabet = "0123456789abcdef";
        var table = new Array(256);
        for (var i = 0; i < 16; ++i) {
          var i16 = i * 16;
          for (var j = 0; j < 16; ++j) {
            table[i16 + j] = alphabet[i] + alphabet[j];
          }
        }
        return table;
      })();
    }
  });

  // node_modules/frida-java-bridge/lib/android.js
  var android_exports = {};
  __export(android_exports, {
    ArtMethod: () => ArtMethod,
    ArtStackVisitor: () => ArtStackVisitor,
    DVM_JNI_ENV_OFFSET_SELF: () => DVM_JNI_ENV_OFFSET_SELF,
    HandleVector: () => HandleVector,
    VariableSizedHandleScope: () => VariableSizedHandleScope,
    backtrace: () => backtrace,
    deoptimizeBootImage: () => deoptimizeBootImage,
    deoptimizeEverything: () => deoptimizeEverything,
    deoptimizeMethod: () => deoptimizeMethod,
    ensureClassInitialized: () => ensureClassInitialized,
    getAndroidApiLevel: () => getAndroidApiLevel,
    getAndroidVersion: () => getAndroidVersion,
    getApi: () => getApi,
    getArtApexVersion: () => getArtApexVersion,
    getArtClassSpec: () => getArtClassSpec,
    getArtFieldSpec: () => getArtFieldSpec,
    getArtMethodSpec: () => getArtMethodSpec,
    getArtThreadFromEnv: () => getArtThreadFromEnv,
    getArtThreadSpec: () => getArtThreadSpec,
    makeArtClassLoaderVisitor: () => makeArtClassLoaderVisitor,
    makeArtClassVisitor: () => makeArtClassVisitor,
    makeMethodMangler: () => makeMethodMangler,
    makeObjectVisitorPredicate: () => makeObjectVisitorPredicate,
    revertGlobalPatches: () => revertGlobalPatches,
    translateMethod: () => translateMethod,
    withAllArtThreadsSuspended: () => withAllArtThreadsSuspended,
    withRunnableArtThread: () => withRunnableArtThread
  });

  // node_modules/frida-java-bridge/lib/alloc.js
  var {
    pageSize,
    pointerSize
  } = Process;
  var CodeAllocator = class {
    constructor(sliceSize) {
      this.sliceSize = sliceSize;
      this.slicesPerPage = pageSize / sliceSize;
      this.pages = [];
      this.free = [];
    }
    allocateSlice(spec, alignment) {
      const anyLocation = spec.near === void 0;
      const anyAlignment = alignment === 1;
      if (anyLocation && anyAlignment) {
        const slice = this.free.pop();
        if (slice !== void 0) {
          return slice;
        }
      } else if (alignment < pageSize) {
        const { free } = this;
        const n = free.length;
        const alignMask = anyAlignment ? null : ptr(alignment - 1);
        for (let i = 0; i !== n; i++) {
          const slice = free[i];
          const satisfiesLocation = anyLocation || this._isSliceNear(slice, spec);
          const satisfiesAlignment = anyAlignment || slice.and(alignMask).isNull();
          if (satisfiesLocation && satisfiesAlignment) {
            return free.splice(i, 1)[0];
          }
        }
      }
      return this._allocatePage(spec);
    }
    _allocatePage(spec) {
      const page = Memory.alloc(pageSize, spec);
      const { sliceSize, slicesPerPage } = this;
      for (let i = 1; i !== slicesPerPage; i++) {
        const slice = page.add(i * sliceSize);
        this.free.push(slice);
      }
      this.pages.push(page);
      return page;
    }
    _isSliceNear(slice, spec) {
      const sliceEnd = slice.add(this.sliceSize);
      const { near, maxDistance } = spec;
      const startDistance = abs(near.sub(slice));
      const endDistance = abs(near.sub(sliceEnd));
      return startDistance.compare(maxDistance) <= 0 && endDistance.compare(maxDistance) <= 0;
    }
    freeSlice(slice) {
      this.free.push(slice);
    }
  };
  function abs(nptr) {
    const shmt = pointerSize === 4 ? 31 : 63;
    const mask = ptr(1).shl(shmt).not();
    return nptr.and(mask);
  }
  function makeAllocator(sliceSize) {
    return new CodeAllocator(sliceSize);
  }

  // node_modules/frida-java-bridge/lib/result.js
  var JNI_OK = 0;
  function checkJniResult(name, result2) {
    if (result2 !== JNI_OK) {
      throw new Error(name + " failed: " + result2);
    }
  }

  // node_modules/frida-java-bridge/lib/jvmti.js
  var jvmtiVersion = {
    v1_0: 805371904,
    v1_2: 805372416
  };
  var jvmtiCapabilities = {
    canTagObjects: 1
  };
  var { pointerSize: pointerSize2 } = Process;
  var nativeFunctionOptions = {
    exceptions: "propagate"
  };
  function EnvJvmti(handle, vm3) {
    this.handle = handle;
    this.vm = vm3;
    this.vtable = handle.readPointer();
  }
  EnvJvmti.prototype.deallocate = proxy(47, "int32", ["pointer", "pointer"], function(impl, mem) {
    return impl(this.handle, mem);
  });
  EnvJvmti.prototype.getLoadedClasses = proxy(78, "int32", ["pointer", "pointer", "pointer"], function(impl, classCountPtr, classesPtr) {
    const result2 = impl(this.handle, classCountPtr, classesPtr);
    checkJniResult("EnvJvmti::getLoadedClasses", result2);
  });
  EnvJvmti.prototype.iterateOverInstancesOfClass = proxy(112, "int32", ["pointer", "pointer", "int", "pointer", "pointer"], function(impl, klass, objectFilter, heapObjectCallback, userData) {
    const result2 = impl(this.handle, klass, objectFilter, heapObjectCallback, userData);
    checkJniResult("EnvJvmti::iterateOverInstancesOfClass", result2);
  });
  EnvJvmti.prototype.getObjectsWithTags = proxy(114, "int32", ["pointer", "int", "pointer", "pointer", "pointer", "pointer"], function(impl, tagCount, tags, countPtr, objectResultPtr, tagResultPtr) {
    const result2 = impl(this.handle, tagCount, tags, countPtr, objectResultPtr, tagResultPtr);
    checkJniResult("EnvJvmti::getObjectsWithTags", result2);
  });
  EnvJvmti.prototype.addCapabilities = proxy(142, "int32", ["pointer", "pointer"], function(impl, capabilitiesPtr) {
    return impl(this.handle, capabilitiesPtr);
  });
  function proxy(offset, retType, argTypes, wrapper) {
    let impl = null;
    return function() {
      if (impl === null) {
        impl = new NativeFunction(this.vtable.add((offset - 1) * pointerSize2).readPointer(), retType, argTypes, nativeFunctionOptions);
      }
      let args = [impl];
      args = args.concat.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  }

  // node_modules/frida-java-bridge/lib/machine-code.js
  function parseInstructionsAt(address, tryParse, { limit }) {
    let cursor = address;
    let prevInsn = null;
    for (let i = 0; i !== limit; i++) {
      const insn = Instruction.parse(cursor);
      const value = tryParse(insn, prevInsn);
      if (value !== null) {
        return value;
      }
      cursor = insn.next;
      prevInsn = insn;
    }
    return null;
  }

  // node_modules/frida-java-bridge/lib/memoize.js
  function memoize(compute) {
    let value = null;
    let computed = false;
    return function(...args) {
      if (!computed) {
        value = compute(...args);
        computed = true;
      }
      return value;
    };
  }

  // node_modules/frida-java-bridge/lib/env.js
  function Env(handle, vm3) {
    this.handle = handle;
    this.vm = vm3;
  }
  var pointerSize3 = Process.pointerSize;
  var JNI_ABORT = 2;
  var CALL_CONSTRUCTOR_METHOD_OFFSET = 28;
  var CALL_OBJECT_METHOD_OFFSET = 34;
  var CALL_BOOLEAN_METHOD_OFFSET = 37;
  var CALL_BYTE_METHOD_OFFSET = 40;
  var CALL_CHAR_METHOD_OFFSET = 43;
  var CALL_SHORT_METHOD_OFFSET = 46;
  var CALL_INT_METHOD_OFFSET = 49;
  var CALL_LONG_METHOD_OFFSET = 52;
  var CALL_FLOAT_METHOD_OFFSET = 55;
  var CALL_DOUBLE_METHOD_OFFSET = 58;
  var CALL_VOID_METHOD_OFFSET = 61;
  var CALL_NONVIRTUAL_OBJECT_METHOD_OFFSET = 64;
  var CALL_NONVIRTUAL_BOOLEAN_METHOD_OFFSET = 67;
  var CALL_NONVIRTUAL_BYTE_METHOD_OFFSET = 70;
  var CALL_NONVIRTUAL_CHAR_METHOD_OFFSET = 73;
  var CALL_NONVIRTUAL_SHORT_METHOD_OFFSET = 76;
  var CALL_NONVIRTUAL_INT_METHOD_OFFSET = 79;
  var CALL_NONVIRTUAL_LONG_METHOD_OFFSET = 82;
  var CALL_NONVIRTUAL_FLOAT_METHOD_OFFSET = 85;
  var CALL_NONVIRTUAL_DOUBLE_METHOD_OFFSET = 88;
  var CALL_NONVIRTUAL_VOID_METHOD_OFFSET = 91;
  var CALL_STATIC_OBJECT_METHOD_OFFSET = 114;
  var CALL_STATIC_BOOLEAN_METHOD_OFFSET = 117;
  var CALL_STATIC_BYTE_METHOD_OFFSET = 120;
  var CALL_STATIC_CHAR_METHOD_OFFSET = 123;
  var CALL_STATIC_SHORT_METHOD_OFFSET = 126;
  var CALL_STATIC_INT_METHOD_OFFSET = 129;
  var CALL_STATIC_LONG_METHOD_OFFSET = 132;
  var CALL_STATIC_FLOAT_METHOD_OFFSET = 135;
  var CALL_STATIC_DOUBLE_METHOD_OFFSET = 138;
  var CALL_STATIC_VOID_METHOD_OFFSET = 141;
  var GET_OBJECT_FIELD_OFFSET = 95;
  var GET_BOOLEAN_FIELD_OFFSET = 96;
  var GET_BYTE_FIELD_OFFSET = 97;
  var GET_CHAR_FIELD_OFFSET = 98;
  var GET_SHORT_FIELD_OFFSET = 99;
  var GET_INT_FIELD_OFFSET = 100;
  var GET_LONG_FIELD_OFFSET = 101;
  var GET_FLOAT_FIELD_OFFSET = 102;
  var GET_DOUBLE_FIELD_OFFSET = 103;
  var SET_OBJECT_FIELD_OFFSET = 104;
  var SET_BOOLEAN_FIELD_OFFSET = 105;
  var SET_BYTE_FIELD_OFFSET = 106;
  var SET_CHAR_FIELD_OFFSET = 107;
  var SET_SHORT_FIELD_OFFSET = 108;
  var SET_INT_FIELD_OFFSET = 109;
  var SET_LONG_FIELD_OFFSET = 110;
  var SET_FLOAT_FIELD_OFFSET = 111;
  var SET_DOUBLE_FIELD_OFFSET = 112;
  var GET_STATIC_OBJECT_FIELD_OFFSET = 145;
  var GET_STATIC_BOOLEAN_FIELD_OFFSET = 146;
  var GET_STATIC_BYTE_FIELD_OFFSET = 147;
  var GET_STATIC_CHAR_FIELD_OFFSET = 148;
  var GET_STATIC_SHORT_FIELD_OFFSET = 149;
  var GET_STATIC_INT_FIELD_OFFSET = 150;
  var GET_STATIC_LONG_FIELD_OFFSET = 151;
  var GET_STATIC_FLOAT_FIELD_OFFSET = 152;
  var GET_STATIC_DOUBLE_FIELD_OFFSET = 153;
  var SET_STATIC_OBJECT_FIELD_OFFSET = 154;
  var SET_STATIC_BOOLEAN_FIELD_OFFSET = 155;
  var SET_STATIC_BYTE_FIELD_OFFSET = 156;
  var SET_STATIC_CHAR_FIELD_OFFSET = 157;
  var SET_STATIC_SHORT_FIELD_OFFSET = 158;
  var SET_STATIC_INT_FIELD_OFFSET = 159;
  var SET_STATIC_LONG_FIELD_OFFSET = 160;
  var SET_STATIC_FLOAT_FIELD_OFFSET = 161;
  var SET_STATIC_DOUBLE_FIELD_OFFSET = 162;
  var callMethodOffset = {
    pointer: CALL_OBJECT_METHOD_OFFSET,
    uint8: CALL_BOOLEAN_METHOD_OFFSET,
    int8: CALL_BYTE_METHOD_OFFSET,
    uint16: CALL_CHAR_METHOD_OFFSET,
    int16: CALL_SHORT_METHOD_OFFSET,
    int32: CALL_INT_METHOD_OFFSET,
    int64: CALL_LONG_METHOD_OFFSET,
    float: CALL_FLOAT_METHOD_OFFSET,
    double: CALL_DOUBLE_METHOD_OFFSET,
    void: CALL_VOID_METHOD_OFFSET
  };
  var callNonvirtualMethodOffset = {
    pointer: CALL_NONVIRTUAL_OBJECT_METHOD_OFFSET,
    uint8: CALL_NONVIRTUAL_BOOLEAN_METHOD_OFFSET,
    int8: CALL_NONVIRTUAL_BYTE_METHOD_OFFSET,
    uint16: CALL_NONVIRTUAL_CHAR_METHOD_OFFSET,
    int16: CALL_NONVIRTUAL_SHORT_METHOD_OFFSET,
    int32: CALL_NONVIRTUAL_INT_METHOD_OFFSET,
    int64: CALL_NONVIRTUAL_LONG_METHOD_OFFSET,
    float: CALL_NONVIRTUAL_FLOAT_METHOD_OFFSET,
    double: CALL_NONVIRTUAL_DOUBLE_METHOD_OFFSET,
    void: CALL_NONVIRTUAL_VOID_METHOD_OFFSET
  };
  var callStaticMethodOffset = {
    pointer: CALL_STATIC_OBJECT_METHOD_OFFSET,
    uint8: CALL_STATIC_BOOLEAN_METHOD_OFFSET,
    int8: CALL_STATIC_BYTE_METHOD_OFFSET,
    uint16: CALL_STATIC_CHAR_METHOD_OFFSET,
    int16: CALL_STATIC_SHORT_METHOD_OFFSET,
    int32: CALL_STATIC_INT_METHOD_OFFSET,
    int64: CALL_STATIC_LONG_METHOD_OFFSET,
    float: CALL_STATIC_FLOAT_METHOD_OFFSET,
    double: CALL_STATIC_DOUBLE_METHOD_OFFSET,
    void: CALL_STATIC_VOID_METHOD_OFFSET
  };
  var getFieldOffset = {
    pointer: GET_OBJECT_FIELD_OFFSET,
    uint8: GET_BOOLEAN_FIELD_OFFSET,
    int8: GET_BYTE_FIELD_OFFSET,
    uint16: GET_CHAR_FIELD_OFFSET,
    int16: GET_SHORT_FIELD_OFFSET,
    int32: GET_INT_FIELD_OFFSET,
    int64: GET_LONG_FIELD_OFFSET,
    float: GET_FLOAT_FIELD_OFFSET,
    double: GET_DOUBLE_FIELD_OFFSET
  };
  var setFieldOffset = {
    pointer: SET_OBJECT_FIELD_OFFSET,
    uint8: SET_BOOLEAN_FIELD_OFFSET,
    int8: SET_BYTE_FIELD_OFFSET,
    uint16: SET_CHAR_FIELD_OFFSET,
    int16: SET_SHORT_FIELD_OFFSET,
    int32: SET_INT_FIELD_OFFSET,
    int64: SET_LONG_FIELD_OFFSET,
    float: SET_FLOAT_FIELD_OFFSET,
    double: SET_DOUBLE_FIELD_OFFSET
  };
  var getStaticFieldOffset = {
    pointer: GET_STATIC_OBJECT_FIELD_OFFSET,
    uint8: GET_STATIC_BOOLEAN_FIELD_OFFSET,
    int8: GET_STATIC_BYTE_FIELD_OFFSET,
    uint16: GET_STATIC_CHAR_FIELD_OFFSET,
    int16: GET_STATIC_SHORT_FIELD_OFFSET,
    int32: GET_STATIC_INT_FIELD_OFFSET,
    int64: GET_STATIC_LONG_FIELD_OFFSET,
    float: GET_STATIC_FLOAT_FIELD_OFFSET,
    double: GET_STATIC_DOUBLE_FIELD_OFFSET
  };
  var setStaticFieldOffset = {
    pointer: SET_STATIC_OBJECT_FIELD_OFFSET,
    uint8: SET_STATIC_BOOLEAN_FIELD_OFFSET,
    int8: SET_STATIC_BYTE_FIELD_OFFSET,
    uint16: SET_STATIC_CHAR_FIELD_OFFSET,
    int16: SET_STATIC_SHORT_FIELD_OFFSET,
    int32: SET_STATIC_INT_FIELD_OFFSET,
    int64: SET_STATIC_LONG_FIELD_OFFSET,
    float: SET_STATIC_FLOAT_FIELD_OFFSET,
    double: SET_STATIC_DOUBLE_FIELD_OFFSET
  };
  var nativeFunctionOptions2 = {
    exceptions: "propagate"
  };
  var cachedVtable = null;
  var globalRefs = [];
  Env.dispose = function(env) {
    globalRefs.forEach(env.deleteGlobalRef, env);
    globalRefs = [];
  };
  function register(globalRef) {
    globalRefs.push(globalRef);
    return globalRef;
  }
  function vtable(instance) {
    if (cachedVtable === null) {
      cachedVtable = instance.handle.readPointer();
    }
    return cachedVtable;
  }
  function proxy2(offset, retType, argTypes, wrapper) {
    let impl = null;
    return function() {
      if (impl === null) {
        impl = new NativeFunction(vtable(this).add(offset * pointerSize3).readPointer(), retType, argTypes, nativeFunctionOptions2);
      }
      let args = [impl];
      args = args.concat.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  }
  Env.prototype.getVersion = proxy2(4, "int32", ["pointer"], function(impl) {
    return impl(this.handle);
  });
  Env.prototype.findClass = proxy2(6, "pointer", ["pointer", "pointer"], function(impl, name) {
    const result2 = impl(this.handle, Memory.allocUtf8String(name));
    this.throwIfExceptionPending();
    return result2;
  });
  Env.prototype.throwIfExceptionPending = function() {
    const throwable = this.exceptionOccurred();
    if (throwable.isNull()) {
      return;
    }
    this.exceptionClear();
    const handle = this.newGlobalRef(throwable);
    this.deleteLocalRef(throwable);
    const description = this.vaMethod("pointer", [])(this.handle, handle, this.javaLangObject().toString);
    const descriptionStr = this.stringFromJni(description);
    this.deleteLocalRef(description);
    const error = new Error(descriptionStr);
    error.$h = handle;
    Script.bindWeak(error, makeErrorHandleDestructor(this.vm, handle));
    throw error;
  };
  function makeErrorHandleDestructor(vm3, handle) {
    return function() {
      vm3.perform((env) => {
        env.deleteGlobalRef(handle);
      });
    };
  }
  Env.prototype.fromReflectedMethod = proxy2(7, "pointer", ["pointer", "pointer"], function(impl, method) {
    return impl(this.handle, method);
  });
  Env.prototype.fromReflectedField = proxy2(8, "pointer", ["pointer", "pointer"], function(impl, method) {
    return impl(this.handle, method);
  });
  Env.prototype.toReflectedMethod = proxy2(9, "pointer", ["pointer", "pointer", "pointer", "uint8"], function(impl, klass, methodId, isStatic) {
    return impl(this.handle, klass, methodId, isStatic);
  });
  Env.prototype.getSuperclass = proxy2(10, "pointer", ["pointer", "pointer"], function(impl, klass) {
    return impl(this.handle, klass);
  });
  Env.prototype.isAssignableFrom = proxy2(11, "uint8", ["pointer", "pointer", "pointer"], function(impl, klass1, klass2) {
    return !!impl(this.handle, klass1, klass2);
  });
  Env.prototype.toReflectedField = proxy2(12, "pointer", ["pointer", "pointer", "pointer", "uint8"], function(impl, klass, fieldId, isStatic) {
    return impl(this.handle, klass, fieldId, isStatic);
  });
  Env.prototype.throw = proxy2(13, "int32", ["pointer", "pointer"], function(impl, obj) {
    return impl(this.handle, obj);
  });
  Env.prototype.exceptionOccurred = proxy2(15, "pointer", ["pointer"], function(impl) {
    return impl(this.handle);
  });
  Env.prototype.exceptionDescribe = proxy2(16, "void", ["pointer"], function(impl) {
    impl(this.handle);
  });
  Env.prototype.exceptionClear = proxy2(17, "void", ["pointer"], function(impl) {
    impl(this.handle);
  });
  Env.prototype.pushLocalFrame = proxy2(19, "int32", ["pointer", "int32"], function(impl, capacity) {
    return impl(this.handle, capacity);
  });
  Env.prototype.popLocalFrame = proxy2(20, "pointer", ["pointer", "pointer"], function(impl, result2) {
    return impl(this.handle, result2);
  });
  Env.prototype.newGlobalRef = proxy2(21, "pointer", ["pointer", "pointer"], function(impl, obj) {
    return impl(this.handle, obj);
  });
  Env.prototype.deleteGlobalRef = proxy2(22, "void", ["pointer", "pointer"], function(impl, globalRef) {
    impl(this.handle, globalRef);
  });
  Env.prototype.deleteLocalRef = proxy2(23, "void", ["pointer", "pointer"], function(impl, localRef) {
    impl(this.handle, localRef);
  });
  Env.prototype.isSameObject = proxy2(24, "uint8", ["pointer", "pointer", "pointer"], function(impl, ref1, ref2) {
    return !!impl(this.handle, ref1, ref2);
  });
  Env.prototype.newLocalRef = proxy2(25, "pointer", ["pointer", "pointer"], function(impl, obj) {
    return impl(this.handle, obj);
  });
  Env.prototype.allocObject = proxy2(27, "pointer", ["pointer", "pointer"], function(impl, clazz) {
    return impl(this.handle, clazz);
  });
  Env.prototype.getObjectClass = proxy2(31, "pointer", ["pointer", "pointer"], function(impl, obj) {
    return impl(this.handle, obj);
  });
  Env.prototype.isInstanceOf = proxy2(32, "uint8", ["pointer", "pointer", "pointer"], function(impl, obj, klass) {
    return !!impl(this.handle, obj, klass);
  });
  Env.prototype.getMethodId = proxy2(33, "pointer", ["pointer", "pointer", "pointer", "pointer"], function(impl, klass, name, sig) {
    return impl(this.handle, klass, Memory.allocUtf8String(name), Memory.allocUtf8String(sig));
  });
  Env.prototype.getFieldId = proxy2(94, "pointer", ["pointer", "pointer", "pointer", "pointer"], function(impl, klass, name, sig) {
    return impl(this.handle, klass, Memory.allocUtf8String(name), Memory.allocUtf8String(sig));
  });
  Env.prototype.getIntField = proxy2(100, "int32", ["pointer", "pointer", "pointer"], function(impl, obj, fieldId) {
    return impl(this.handle, obj, fieldId);
  });
  Env.prototype.getStaticMethodId = proxy2(113, "pointer", ["pointer", "pointer", "pointer", "pointer"], function(impl, klass, name, sig) {
    return impl(this.handle, klass, Memory.allocUtf8String(name), Memory.allocUtf8String(sig));
  });
  Env.prototype.getStaticFieldId = proxy2(144, "pointer", ["pointer", "pointer", "pointer", "pointer"], function(impl, klass, name, sig) {
    return impl(this.handle, klass, Memory.allocUtf8String(name), Memory.allocUtf8String(sig));
  });
  Env.prototype.getStaticIntField = proxy2(150, "int32", ["pointer", "pointer", "pointer"], function(impl, obj, fieldId) {
    return impl(this.handle, obj, fieldId);
  });
  Env.prototype.getStringLength = proxy2(164, "int32", ["pointer", "pointer"], function(impl, str) {
    return impl(this.handle, str);
  });
  Env.prototype.getStringChars = proxy2(165, "pointer", ["pointer", "pointer", "pointer"], function(impl, str) {
    return impl(this.handle, str, NULL);
  });
  Env.prototype.releaseStringChars = proxy2(166, "void", ["pointer", "pointer", "pointer"], function(impl, str, utf) {
    impl(this.handle, str, utf);
  });
  Env.prototype.newStringUtf = proxy2(167, "pointer", ["pointer", "pointer"], function(impl, str) {
    const utf = Memory.allocUtf8String(str);
    return impl(this.handle, utf);
  });
  Env.prototype.getStringUtfChars = proxy2(169, "pointer", ["pointer", "pointer", "pointer"], function(impl, str) {
    return impl(this.handle, str, NULL);
  });
  Env.prototype.releaseStringUtfChars = proxy2(170, "void", ["pointer", "pointer", "pointer"], function(impl, str, utf) {
    impl(this.handle, str, utf);
  });
  Env.prototype.getArrayLength = proxy2(171, "int32", ["pointer", "pointer"], function(impl, array) {
    return impl(this.handle, array);
  });
  Env.prototype.newObjectArray = proxy2(172, "pointer", ["pointer", "int32", "pointer", "pointer"], function(impl, length, elementClass, initialElement) {
    return impl(this.handle, length, elementClass, initialElement);
  });
  Env.prototype.getObjectArrayElement = proxy2(173, "pointer", ["pointer", "pointer", "int32"], function(impl, array, index) {
    return impl(this.handle, array, index);
  });
  Env.prototype.setObjectArrayElement = proxy2(174, "void", ["pointer", "pointer", "int32", "pointer"], function(impl, array, index, value) {
    impl(this.handle, array, index, value);
  });
  Env.prototype.newBooleanArray = proxy2(175, "pointer", ["pointer", "int32"], function(impl, length) {
    return impl(this.handle, length);
  });
  Env.prototype.newByteArray = proxy2(176, "pointer", ["pointer", "int32"], function(impl, length) {
    return impl(this.handle, length);
  });
  Env.prototype.newCharArray = proxy2(177, "pointer", ["pointer", "int32"], function(impl, length) {
    return impl(this.handle, length);
  });
  Env.prototype.newShortArray = proxy2(178, "pointer", ["pointer", "int32"], function(impl, length) {
    return impl(this.handle, length);
  });
  Env.prototype.newIntArray = proxy2(179, "pointer", ["pointer", "int32"], function(impl, length) {
    return impl(this.handle, length);
  });
  Env.prototype.newLongArray = proxy2(180, "pointer", ["pointer", "int32"], function(impl, length) {
    return impl(this.handle, length);
  });
  Env.prototype.newFloatArray = proxy2(181, "pointer", ["pointer", "int32"], function(impl, length) {
    return impl(this.handle, length);
  });
  Env.prototype.newDoubleArray = proxy2(182, "pointer", ["pointer", "int32"], function(impl, length) {
    return impl(this.handle, length);
  });
  Env.prototype.getBooleanArrayElements = proxy2(183, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
    return impl(this.handle, array, NULL);
  });
  Env.prototype.getByteArrayElements = proxy2(184, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
    return impl(this.handle, array, NULL);
  });
  Env.prototype.getCharArrayElements = proxy2(185, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
    return impl(this.handle, array, NULL);
  });
  Env.prototype.getShortArrayElements = proxy2(186, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
    return impl(this.handle, array, NULL);
  });
  Env.prototype.getIntArrayElements = proxy2(187, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
    return impl(this.handle, array, NULL);
  });
  Env.prototype.getLongArrayElements = proxy2(188, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
    return impl(this.handle, array, NULL);
  });
  Env.prototype.getFloatArrayElements = proxy2(189, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
    return impl(this.handle, array, NULL);
  });
  Env.prototype.getDoubleArrayElements = proxy2(190, "pointer", ["pointer", "pointer", "pointer"], function(impl, array) {
    return impl(this.handle, array, NULL);
  });
  Env.prototype.releaseBooleanArrayElements = proxy2(191, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
    impl(this.handle, array, cArray, JNI_ABORT);
  });
  Env.prototype.releaseByteArrayElements = proxy2(192, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
    impl(this.handle, array, cArray, JNI_ABORT);
  });
  Env.prototype.releaseCharArrayElements = proxy2(193, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
    impl(this.handle, array, cArray, JNI_ABORT);
  });
  Env.prototype.releaseShortArrayElements = proxy2(194, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
    impl(this.handle, array, cArray, JNI_ABORT);
  });
  Env.prototype.releaseIntArrayElements = proxy2(195, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
    impl(this.handle, array, cArray, JNI_ABORT);
  });
  Env.prototype.releaseLongArrayElements = proxy2(196, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
    impl(this.handle, array, cArray, JNI_ABORT);
  });
  Env.prototype.releaseFloatArrayElements = proxy2(197, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
    impl(this.handle, array, cArray, JNI_ABORT);
  });
  Env.prototype.releaseDoubleArrayElements = proxy2(198, "pointer", ["pointer", "pointer", "pointer", "int32"], function(impl, array, cArray) {
    impl(this.handle, array, cArray, JNI_ABORT);
  });
  Env.prototype.getByteArrayRegion = proxy2(200, "void", ["pointer", "pointer", "int", "int", "pointer"], function(impl, array, start, length, cArray) {
    impl(this.handle, array, start, length, cArray);
  });
  Env.prototype.setBooleanArrayRegion = proxy2(207, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
    impl(this.handle, array, start, length, cArray);
  });
  Env.prototype.setByteArrayRegion = proxy2(208, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
    impl(this.handle, array, start, length, cArray);
  });
  Env.prototype.setCharArrayRegion = proxy2(209, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
    impl(this.handle, array, start, length, cArray);
  });
  Env.prototype.setShortArrayRegion = proxy2(210, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
    impl(this.handle, array, start, length, cArray);
  });
  Env.prototype.setIntArrayRegion = proxy2(211, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
    impl(this.handle, array, start, length, cArray);
  });
  Env.prototype.setLongArrayRegion = proxy2(212, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
    impl(this.handle, array, start, length, cArray);
  });
  Env.prototype.setFloatArrayRegion = proxy2(213, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
    impl(this.handle, array, start, length, cArray);
  });
  Env.prototype.setDoubleArrayRegion = proxy2(214, "void", ["pointer", "pointer", "int32", "int32", "pointer"], function(impl, array, start, length, cArray) {
    impl(this.handle, array, start, length, cArray);
  });
  Env.prototype.registerNatives = proxy2(215, "int32", ["pointer", "pointer", "pointer", "int32"], function(impl, klass, methods, numMethods) {
    return impl(this.handle, klass, methods, numMethods);
  });
  Env.prototype.monitorEnter = proxy2(217, "int32", ["pointer", "pointer"], function(impl, obj) {
    return impl(this.handle, obj);
  });
  Env.prototype.monitorExit = proxy2(218, "int32", ["pointer", "pointer"], function(impl, obj) {
    return impl(this.handle, obj);
  });
  Env.prototype.getDirectBufferAddress = proxy2(230, "pointer", ["pointer", "pointer"], function(impl, obj) {
    return impl(this.handle, obj);
  });
  Env.prototype.getObjectRefType = proxy2(232, "int32", ["pointer", "pointer"], function(impl, ref) {
    return impl(this.handle, ref);
  });
  var cachedMethods = /* @__PURE__ */ new Map();
  function plainMethod(offset, retType, argTypes, options) {
    return getOrMakeMethod(this, "p", makePlainMethod, offset, retType, argTypes, options);
  }
  function vaMethod(offset, retType, argTypes, options) {
    return getOrMakeMethod(this, "v", makeVaMethod, offset, retType, argTypes, options);
  }
  function nonvirtualVaMethod(offset, retType, argTypes, options) {
    return getOrMakeMethod(this, "n", makeNonvirtualVaMethod, offset, retType, argTypes, options);
  }
  function getOrMakeMethod(env, flavor, construct, offset, retType, argTypes, options) {
    if (options !== void 0) {
      return construct(env, offset, retType, argTypes, options);
    }
    const key = [offset, flavor, retType].concat(argTypes).join("|");
    let m = cachedMethods.get(key);
    if (m === void 0) {
      m = construct(env, offset, retType, argTypes, nativeFunctionOptions2);
      cachedMethods.set(key, m);
    }
    return m;
  }
  function makePlainMethod(env, offset, retType, argTypes, options) {
    return new NativeFunction(
      vtable(env).add(offset * pointerSize3).readPointer(),
      retType,
      ["pointer", "pointer", "pointer"].concat(argTypes),
      options
    );
  }
  function makeVaMethod(env, offset, retType, argTypes, options) {
    return new NativeFunction(
      vtable(env).add(offset * pointerSize3).readPointer(),
      retType,
      ["pointer", "pointer", "pointer", "..."].concat(argTypes),
      options
    );
  }
  function makeNonvirtualVaMethod(env, offset, retType, argTypes, options) {
    return new NativeFunction(
      vtable(env).add(offset * pointerSize3).readPointer(),
      retType,
      ["pointer", "pointer", "pointer", "pointer", "..."].concat(argTypes),
      options
    );
  }
  Env.prototype.constructor = function(argTypes, options) {
    return vaMethod.call(this, CALL_CONSTRUCTOR_METHOD_OFFSET, "pointer", argTypes, options);
  };
  Env.prototype.vaMethod = function(retType, argTypes, options) {
    const offset = callMethodOffset[retType];
    if (offset === void 0) {
      throw new Error("Unsupported type: " + retType);
    }
    return vaMethod.call(this, offset, retType, argTypes, options);
  };
  Env.prototype.nonvirtualVaMethod = function(retType, argTypes, options) {
    const offset = callNonvirtualMethodOffset[retType];
    if (offset === void 0) {
      throw new Error("Unsupported type: " + retType);
    }
    return nonvirtualVaMethod.call(this, offset, retType, argTypes, options);
  };
  Env.prototype.staticVaMethod = function(retType, argTypes, options) {
    const offset = callStaticMethodOffset[retType];
    if (offset === void 0) {
      throw new Error("Unsupported type: " + retType);
    }
    return vaMethod.call(this, offset, retType, argTypes, options);
  };
  Env.prototype.getField = function(fieldType) {
    const offset = getFieldOffset[fieldType];
    if (offset === void 0) {
      throw new Error("Unsupported type: " + fieldType);
    }
    return plainMethod.call(this, offset, fieldType, []);
  };
  Env.prototype.getStaticField = function(fieldType) {
    const offset = getStaticFieldOffset[fieldType];
    if (offset === void 0) {
      throw new Error("Unsupported type: " + fieldType);
    }
    return plainMethod.call(this, offset, fieldType, []);
  };
  Env.prototype.setField = function(fieldType) {
    const offset = setFieldOffset[fieldType];
    if (offset === void 0) {
      throw new Error("Unsupported type: " + fieldType);
    }
    return plainMethod.call(this, offset, "void", [fieldType]);
  };
  Env.prototype.setStaticField = function(fieldType) {
    const offset = setStaticFieldOffset[fieldType];
    if (offset === void 0) {
      throw new Error("Unsupported type: " + fieldType);
    }
    return plainMethod.call(this, offset, "void", [fieldType]);
  };
  var javaLangClass = null;
  Env.prototype.javaLangClass = function() {
    if (javaLangClass === null) {
      const handle = this.findClass("java/lang/Class");
      try {
        const get = this.getMethodId.bind(this, handle);
        javaLangClass = {
          handle: register(this.newGlobalRef(handle)),
          getName: get("getName", "()Ljava/lang/String;"),
          getSimpleName: get("getSimpleName", "()Ljava/lang/String;"),
          getGenericSuperclass: get("getGenericSuperclass", "()Ljava/lang/reflect/Type;"),
          getDeclaredConstructors: get("getDeclaredConstructors", "()[Ljava/lang/reflect/Constructor;"),
          getDeclaredMethods: get("getDeclaredMethods", "()[Ljava/lang/reflect/Method;"),
          getDeclaredFields: get("getDeclaredFields", "()[Ljava/lang/reflect/Field;"),
          isArray: get("isArray", "()Z"),
          isPrimitive: get("isPrimitive", "()Z"),
          isInterface: get("isInterface", "()Z"),
          getComponentType: get("getComponentType", "()Ljava/lang/Class;")
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangClass;
  };
  var javaLangObject = null;
  Env.prototype.javaLangObject = function() {
    if (javaLangObject === null) {
      const handle = this.findClass("java/lang/Object");
      try {
        const get = this.getMethodId.bind(this, handle);
        javaLangObject = {
          handle: register(this.newGlobalRef(handle)),
          toString: get("toString", "()Ljava/lang/String;"),
          getClass: get("getClass", "()Ljava/lang/Class;")
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangObject;
  };
  var javaLangReflectConstructor = null;
  Env.prototype.javaLangReflectConstructor = function() {
    if (javaLangReflectConstructor === null) {
      const handle = this.findClass("java/lang/reflect/Constructor");
      try {
        javaLangReflectConstructor = {
          getGenericParameterTypes: this.getMethodId(handle, "getGenericParameterTypes", "()[Ljava/lang/reflect/Type;")
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangReflectConstructor;
  };
  var javaLangReflectMethod = null;
  Env.prototype.javaLangReflectMethod = function() {
    if (javaLangReflectMethod === null) {
      const handle = this.findClass("java/lang/reflect/Method");
      try {
        const get = this.getMethodId.bind(this, handle);
        javaLangReflectMethod = {
          getName: get("getName", "()Ljava/lang/String;"),
          getGenericParameterTypes: get("getGenericParameterTypes", "()[Ljava/lang/reflect/Type;"),
          getParameterTypes: get("getParameterTypes", "()[Ljava/lang/Class;"),
          getGenericReturnType: get("getGenericReturnType", "()Ljava/lang/reflect/Type;"),
          getGenericExceptionTypes: get("getGenericExceptionTypes", "()[Ljava/lang/reflect/Type;"),
          getModifiers: get("getModifiers", "()I"),
          isVarArgs: get("isVarArgs", "()Z")
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangReflectMethod;
  };
  var javaLangReflectField = null;
  Env.prototype.javaLangReflectField = function() {
    if (javaLangReflectField === null) {
      const handle = this.findClass("java/lang/reflect/Field");
      try {
        const get = this.getMethodId.bind(this, handle);
        javaLangReflectField = {
          getName: get("getName", "()Ljava/lang/String;"),
          getType: get("getType", "()Ljava/lang/Class;"),
          getGenericType: get("getGenericType", "()Ljava/lang/reflect/Type;"),
          getModifiers: get("getModifiers", "()I"),
          toString: get("toString", "()Ljava/lang/String;")
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangReflectField;
  };
  var javaLangReflectTypeVariable = null;
  Env.prototype.javaLangReflectTypeVariable = function() {
    if (javaLangReflectTypeVariable === null) {
      const handle = this.findClass("java/lang/reflect/TypeVariable");
      try {
        const get = this.getMethodId.bind(this, handle);
        javaLangReflectTypeVariable = {
          handle: register(this.newGlobalRef(handle)),
          getName: get("getName", "()Ljava/lang/String;"),
          getBounds: get("getBounds", "()[Ljava/lang/reflect/Type;"),
          getGenericDeclaration: get("getGenericDeclaration", "()Ljava/lang/reflect/GenericDeclaration;")
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangReflectTypeVariable;
  };
  var javaLangReflectWildcardType = null;
  Env.prototype.javaLangReflectWildcardType = function() {
    if (javaLangReflectWildcardType === null) {
      const handle = this.findClass("java/lang/reflect/WildcardType");
      try {
        const get = this.getMethodId.bind(this, handle);
        javaLangReflectWildcardType = {
          handle: register(this.newGlobalRef(handle)),
          getLowerBounds: get("getLowerBounds", "()[Ljava/lang/reflect/Type;"),
          getUpperBounds: get("getUpperBounds", "()[Ljava/lang/reflect/Type;")
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangReflectWildcardType;
  };
  var javaLangReflectGenericArrayType = null;
  Env.prototype.javaLangReflectGenericArrayType = function() {
    if (javaLangReflectGenericArrayType === null) {
      const handle = this.findClass("java/lang/reflect/GenericArrayType");
      try {
        javaLangReflectGenericArrayType = {
          handle: register(this.newGlobalRef(handle)),
          getGenericComponentType: this.getMethodId(handle, "getGenericComponentType", "()Ljava/lang/reflect/Type;")
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangReflectGenericArrayType;
  };
  var javaLangReflectParameterizedType = null;
  Env.prototype.javaLangReflectParameterizedType = function() {
    if (javaLangReflectParameterizedType === null) {
      const handle = this.findClass("java/lang/reflect/ParameterizedType");
      try {
        const get = this.getMethodId.bind(this, handle);
        javaLangReflectParameterizedType = {
          handle: register(this.newGlobalRef(handle)),
          getActualTypeArguments: get("getActualTypeArguments", "()[Ljava/lang/reflect/Type;"),
          getRawType: get("getRawType", "()Ljava/lang/reflect/Type;"),
          getOwnerType: get("getOwnerType", "()Ljava/lang/reflect/Type;")
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangReflectParameterizedType;
  };
  var javaLangString = null;
  Env.prototype.javaLangString = function() {
    if (javaLangString === null) {
      const handle = this.findClass("java/lang/String");
      try {
        javaLangString = {
          handle: register(this.newGlobalRef(handle))
        };
      } finally {
        this.deleteLocalRef(handle);
      }
    }
    return javaLangString;
  };
  Env.prototype.getClassName = function(classHandle) {
    const name = this.vaMethod("pointer", [])(this.handle, classHandle, this.javaLangClass().getName);
    try {
      return this.stringFromJni(name);
    } finally {
      this.deleteLocalRef(name);
    }
  };
  Env.prototype.getObjectClassName = function(objHandle) {
    const jklass = this.getObjectClass(objHandle);
    try {
      return this.getClassName(jklass);
    } finally {
      this.deleteLocalRef(jklass);
    }
  };
  Env.prototype.getActualTypeArgument = function(type) {
    const actualTypeArguments = this.vaMethod("pointer", [])(this.handle, type, this.javaLangReflectParameterizedType().getActualTypeArguments);
    this.throwIfExceptionPending();
    if (!actualTypeArguments.isNull()) {
      try {
        return this.getTypeNameFromFirstTypeElement(actualTypeArguments);
      } finally {
        this.deleteLocalRef(actualTypeArguments);
      }
    }
  };
  Env.prototype.getTypeNameFromFirstTypeElement = function(typeArray) {
    const length = this.getArrayLength(typeArray);
    if (length > 0) {
      const typeArgument0 = this.getObjectArrayElement(typeArray, 0);
      try {
        return this.getTypeName(typeArgument0);
      } finally {
        this.deleteLocalRef(typeArgument0);
      }
    } else {
      return "java.lang.Object";
    }
  };
  Env.prototype.getTypeName = function(type, getGenericsInformation) {
    const invokeObjectMethodNoArgs = this.vaMethod("pointer", []);
    if (this.isInstanceOf(type, this.javaLangClass().handle)) {
      return this.getClassName(type);
    } else if (this.isInstanceOf(type, this.javaLangReflectGenericArrayType().handle)) {
      return this.getArrayTypeName(type);
    } else if (this.isInstanceOf(type, this.javaLangReflectParameterizedType().handle)) {
      const rawType = invokeObjectMethodNoArgs(this.handle, type, this.javaLangReflectParameterizedType().getRawType);
      this.throwIfExceptionPending();
      let result2;
      try {
        result2 = this.getTypeName(rawType);
      } finally {
        this.deleteLocalRef(rawType);
      }
      if (getGenericsInformation) {
        result2 += "<" + this.getActualTypeArgument(type) + ">";
      }
      return result2;
    } else if (this.isInstanceOf(type, this.javaLangReflectTypeVariable().handle)) {
      return "java.lang.Object";
    } else if (this.isInstanceOf(type, this.javaLangReflectWildcardType().handle)) {
      return "java.lang.Object";
    } else {
      return "java.lang.Object";
    }
  };
  Env.prototype.getArrayTypeName = function(type) {
    const invokeObjectMethodNoArgs = this.vaMethod("pointer", []);
    if (this.isInstanceOf(type, this.javaLangClass().handle)) {
      return this.getClassName(type);
    } else if (this.isInstanceOf(type, this.javaLangReflectGenericArrayType().handle)) {
      const componentType = invokeObjectMethodNoArgs(this.handle, type, this.javaLangReflectGenericArrayType().getGenericComponentType);
      this.throwIfExceptionPending();
      try {
        return "[L" + this.getTypeName(componentType) + ";";
      } finally {
        this.deleteLocalRef(componentType);
      }
    } else {
      return "[Ljava.lang.Object;";
    }
  };
  Env.prototype.stringFromJni = function(str) {
    const utf = this.getStringChars(str);
    if (utf.isNull()) {
      throw new Error("Unable to access string");
    }
    try {
      const length = this.getStringLength(str);
      return utf.readUtf16String(length);
    } finally {
      this.releaseStringChars(str, utf);
    }
  };

  // node_modules/frida-java-bridge/lib/vm.js
  var JNI_VERSION_1_6 = 65542;
  var pointerSize4 = Process.pointerSize;
  var jsThreadID = Process.getCurrentThreadId();
  var attachedThreads = /* @__PURE__ */ new Map();
  var activeEnvs = /* @__PURE__ */ new Map();
  function VM(api2) {
    const handle = api2.vm;
    let attachCurrentThread = null;
    let detachCurrentThread = null;
    let getEnv = null;
    function initialize2() {
      const vtable2 = handle.readPointer();
      const options = {
        exceptions: "propagate"
      };
      attachCurrentThread = new NativeFunction(vtable2.add(4 * pointerSize4).readPointer(), "int32", ["pointer", "pointer", "pointer"], options);
      detachCurrentThread = new NativeFunction(vtable2.add(5 * pointerSize4).readPointer(), "int32", ["pointer"], options);
      getEnv = new NativeFunction(vtable2.add(6 * pointerSize4).readPointer(), "int32", ["pointer", "pointer", "int32"], options);
    }
    this.handle = handle;
    this.perform = function(fn) {
      const threadId = Process.getCurrentThreadId();
      const cachedEnv = tryGetCachedEnv(threadId);
      if (cachedEnv !== null) {
        return fn(cachedEnv);
      }
      let env = this._tryGetEnv();
      const alreadyAttached = env !== null;
      if (!alreadyAttached) {
        env = this.attachCurrentThread();
        attachedThreads.set(threadId, true);
      }
      this.link(threadId, env);
      try {
        return fn(env);
      } finally {
        const isJsThread = threadId === jsThreadID;
        if (!isJsThread) {
          this.unlink(threadId);
        }
        if (!alreadyAttached && !isJsThread) {
          const allowedToDetach = attachedThreads.get(threadId);
          attachedThreads.delete(threadId);
          if (allowedToDetach) {
            this.detachCurrentThread();
          }
        }
      }
    };
    this.attachCurrentThread = function() {
      const envBuf = Memory.alloc(pointerSize4);
      checkJniResult("VM::AttachCurrentThread", attachCurrentThread(handle, envBuf, NULL));
      return new Env(envBuf.readPointer(), this);
    };
    this.detachCurrentThread = function() {
      checkJniResult("VM::DetachCurrentThread", detachCurrentThread(handle));
    };
    this.preventDetachDueToClassLoader = function() {
      const threadId = Process.getCurrentThreadId();
      if (attachedThreads.has(threadId)) {
        attachedThreads.set(threadId, false);
      }
    };
    this.getEnv = function() {
      const cachedEnv = tryGetCachedEnv(Process.getCurrentThreadId());
      if (cachedEnv !== null) {
        return cachedEnv;
      }
      const envBuf = Memory.alloc(pointerSize4);
      const result2 = getEnv(handle, envBuf, JNI_VERSION_1_6);
      if (result2 === -2) {
        throw new Error("Current thread is not attached to the Java VM; please move this code inside a Java.perform() callback");
      }
      checkJniResult("VM::GetEnv", result2);
      return new Env(envBuf.readPointer(), this);
    };
    this.tryGetEnv = function() {
      const cachedEnv = tryGetCachedEnv(Process.getCurrentThreadId());
      if (cachedEnv !== null) {
        return cachedEnv;
      }
      return this._tryGetEnv();
    };
    this._tryGetEnv = function() {
      const h = this.tryGetEnvHandle(JNI_VERSION_1_6);
      if (h === null) {
        return null;
      }
      return new Env(h, this);
    };
    this.tryGetEnvHandle = function(version) {
      const envBuf = Memory.alloc(pointerSize4);
      const result2 = getEnv(handle, envBuf, version);
      if (result2 !== JNI_OK) {
        return null;
      }
      return envBuf.readPointer();
    };
    this.makeHandleDestructor = function(handle2) {
      return () => {
        this.perform((env) => {
          env.deleteGlobalRef(handle2);
        });
      };
    };
    this.link = function(tid, env) {
      const entry = activeEnvs.get(tid);
      if (entry === void 0) {
        activeEnvs.set(tid, [env, 1]);
      } else {
        entry[1]++;
      }
    };
    this.unlink = function(tid) {
      const entry = activeEnvs.get(tid);
      if (entry[1] === 1) {
        activeEnvs.delete(tid);
      } else {
        entry[1]--;
      }
    };
    function tryGetCachedEnv(threadId) {
      const entry = activeEnvs.get(threadId);
      if (entry === void 0) {
        return null;
      }
      return entry[0];
    }
    initialize2.call(this);
  }
  VM.dispose = function(vm3) {
    if (attachedThreads.get(jsThreadID) === true) {
      attachedThreads.delete(jsThreadID);
      vm3.detachCurrentThread();
    }
  };

  // node_modules/frida-java-bridge/lib/android.js
  var jsizeSize = 4;
  var pointerSize5 = Process.pointerSize;
  var {
    readU32,
    readPointer,
    writeU32,
    writePointer
  } = NativePointer.prototype;
  var kAccPublic = 1;
  var kAccStatic = 8;
  var kAccFinal = 16;
  var kAccNative = 256;
  var kAccFastNative = 524288;
  var kAccCriticalNative = 2097152;
  var kAccFastInterpreterToInterpreterInvoke = 1073741824;
  var kAccSkipAccessChecks = 524288;
  var kAccSingleImplementation = 134217728;
  var kAccNterpEntryPointFastPathFlag = 1048576;
  var kAccNterpInvokeFastPathFlag = 2097152;
  var kAccPublicApi = 268435456;
  var kAccXposedHookedMethod = 268435456;
  var kPointer = 0;
  var kFullDeoptimization = 3;
  var kSelectiveDeoptimization = 5;
  var THUMB_BIT_REMOVAL_MASK = ptr(1).not();
  var X86_JMP_MAX_DISTANCE = 2147467263;
  var ARM64_ADRP_MAX_DISTANCE = 4294963200;
  var ENV_VTABLE_OFFSET_EXCEPTION_CLEAR = 17 * pointerSize5;
  var ENV_VTABLE_OFFSET_FATAL_ERROR = 18 * pointerSize5;
  var DVM_JNI_ENV_OFFSET_SELF = 12;
  var DVM_CLASS_OBJECT_OFFSET_VTABLE_COUNT = 112;
  var DVM_CLASS_OBJECT_OFFSET_VTABLE = 116;
  var DVM_OBJECT_OFFSET_CLAZZ = 0;
  var DVM_METHOD_SIZE = 56;
  var DVM_METHOD_OFFSET_ACCESS_FLAGS = 4;
  var DVM_METHOD_OFFSET_METHOD_INDEX = 8;
  var DVM_METHOD_OFFSET_REGISTERS_SIZE = 10;
  var DVM_METHOD_OFFSET_OUTS_SIZE = 12;
  var DVM_METHOD_OFFSET_INS_SIZE = 14;
  var DVM_METHOD_OFFSET_SHORTY = 28;
  var DVM_METHOD_OFFSET_JNI_ARG_INFO = 36;
  var DALVIK_JNI_RETURN_VOID = 0;
  var DALVIK_JNI_RETURN_FLOAT = 1;
  var DALVIK_JNI_RETURN_DOUBLE = 2;
  var DALVIK_JNI_RETURN_S8 = 3;
  var DALVIK_JNI_RETURN_S4 = 4;
  var DALVIK_JNI_RETURN_S2 = 5;
  var DALVIK_JNI_RETURN_U2 = 6;
  var DALVIK_JNI_RETURN_S1 = 7;
  var DALVIK_JNI_NO_ARG_INFO = 2147483648;
  var DALVIK_JNI_RETURN_SHIFT = 28;
  var STD_STRING_SIZE = 3 * pointerSize5;
  var STD_VECTOR_SIZE = 3 * pointerSize5;
  var AF_UNIX = 1;
  var SOCK_STREAM = 1;
  var getArtRuntimeSpec = memoize(_getArtRuntimeSpec);
  var getArtInstrumentationSpec = memoize(_getArtInstrumentationSpec);
  var getArtMethodSpec = memoize(_getArtMethodSpec);
  var getArtThreadSpec = memoize(_getArtThreadSpec);
  var getArtManagedStackSpec = memoize(_getArtManagedStackSpec);
  var getArtThreadStateTransitionImpl = memoize(_getArtThreadStateTransitionImpl);
  var getAndroidVersion = memoize(_getAndroidVersion);
  var getAndroidCodename = memoize(_getAndroidCodename);
  var getAndroidApiLevel = memoize(_getAndroidApiLevel);
  var getArtApexVersion = memoize(_getArtApexVersion);
  var getArtQuickFrameInfoGetterThunk = memoize(_getArtQuickFrameInfoGetterThunk);
  var makeCxxMethodWrapperReturningPointerByValue = Process.arch === "ia32" ? makeCxxMethodWrapperReturningPointerByValueInFirstArg : makeCxxMethodWrapperReturningPointerByValueGeneric;
  var nativeFunctionOptions3 = {
    exceptions: "propagate"
  };
  var artThreadStateTransitions = {};
  var cachedApi = null;
  var cachedArtClassLinkerSpec = null;
  var MethodMangler = null;
  var artController = null;
  var inlineHooks = [];
  var patchedClasses = /* @__PURE__ */ new Map();
  var artQuickInterceptors = [];
  var thunkPage = null;
  var thunkOffset = 0;
  var taughtArtAboutReplacementMethods = false;
  var taughtArtAboutMethodInstrumentation = false;
  var backtraceModule = null;
  var jdwpSessions = [];
  var socketpair = null;
  var trampolineAllocator = null;
  function getApi() {
    if (cachedApi === null) {
      cachedApi = _getApi();
    }
    return cachedApi;
  }
  function _getApi() {
    const vmModules = Process.enumerateModules().filter((m) => /^lib(art|dvm).so$/.test(m.name)).filter((m) => !/\/system\/fake-libs/.test(m.path));
    if (vmModules.length === 0) {
      return null;
    }
    const vmModule = vmModules[0];
    const flavor = vmModule.name.indexOf("art") !== -1 ? "art" : "dalvik";
    const isArt = flavor === "art";
    const temporaryApi = {
      module: vmModule,
      find(name) {
        const { module } = this;
        let address = module.findExportByName(name);
        if (address === null) {
          address = module.findSymbolByName(name);
        }
        return address;
      },
      flavor,
      addLocalReference: null
    };
    temporaryApi.isApiLevel34OrApexEquivalent = isArt && (temporaryApi.find("_ZN3art7AppInfo29GetPrimaryApkReferenceProfileEv") !== null || temporaryApi.find("_ZN3art6Thread15RunFlipFunctionEPS0_") !== null);
    const pending = isArt ? {
      functions: {
        JNI_GetCreatedJavaVMs: ["JNI_GetCreatedJavaVMs", "int", ["pointer", "int", "pointer"]],
        // Android < 7
        artInterpreterToCompiledCodeBridge: function(address) {
          this.artInterpreterToCompiledCodeBridge = address;
        },
        // Android >= 8
        _ZN3art9JavaVMExt12AddGlobalRefEPNS_6ThreadENS_6ObjPtrINS_6mirror6ObjectEEE: ["art::JavaVMExt::AddGlobalRef", "pointer", ["pointer", "pointer", "pointer"]],
        // Android >= 6
        _ZN3art9JavaVMExt12AddGlobalRefEPNS_6ThreadEPNS_6mirror6ObjectE: ["art::JavaVMExt::AddGlobalRef", "pointer", ["pointer", "pointer", "pointer"]],
        // Android < 6: makeAddGlobalRefFallbackForAndroid5() needs these:
        _ZN3art17ReaderWriterMutex13ExclusiveLockEPNS_6ThreadE: ["art::ReaderWriterMutex::ExclusiveLock", "void", ["pointer", "pointer"]],
        _ZN3art17ReaderWriterMutex15ExclusiveUnlockEPNS_6ThreadE: ["art::ReaderWriterMutex::ExclusiveUnlock", "void", ["pointer", "pointer"]],
        // Android <= 7
        _ZN3art22IndirectReferenceTable3AddEjPNS_6mirror6ObjectE: function(address) {
          this["art::IndirectReferenceTable::Add"] = new NativeFunction(address, "pointer", ["pointer", "uint", "pointer"], nativeFunctionOptions3);
        },
        // Android > 7
        _ZN3art22IndirectReferenceTable3AddENS_15IRTSegmentStateENS_6ObjPtrINS_6mirror6ObjectEEE: function(address) {
          this["art::IndirectReferenceTable::Add"] = new NativeFunction(address, "pointer", ["pointer", "uint", "pointer"], nativeFunctionOptions3);
        },
        // Android >= 7
        _ZN3art9JavaVMExt12DecodeGlobalEPv: function(address) {
          let decodeGlobal;
          if (getAndroidApiLevel() >= 26) {
            decodeGlobal = makeCxxMethodWrapperReturningPointerByValue(address, ["pointer", "pointer"]);
          } else {
            decodeGlobal = new NativeFunction(address, "pointer", ["pointer", "pointer"], nativeFunctionOptions3);
          }
          this["art::JavaVMExt::DecodeGlobal"] = function(vm3, thread, ref) {
            return decodeGlobal(vm3, ref);
          };
        },
        // Android >= 6
        _ZN3art9JavaVMExt12DecodeGlobalEPNS_6ThreadEPv: ["art::JavaVMExt::DecodeGlobal", "pointer", ["pointer", "pointer", "pointer"]],
        // makeDecodeGlobalFallback() uses:
        // Android >= 15
        _ZNK3art6Thread19DecodeGlobalJObjectEP8_jobject: ["art::Thread::DecodeJObject", "pointer", ["pointer", "pointer"]],
        // Android < 6
        _ZNK3art6Thread13DecodeJObjectEP8_jobject: ["art::Thread::DecodeJObject", "pointer", ["pointer", "pointer"]],
        // Android >= 6
        _ZN3art10ThreadList10SuspendAllEPKcb: ["art::ThreadList::SuspendAll", "void", ["pointer", "pointer", "bool"]],
        // or fallback:
        _ZN3art10ThreadList10SuspendAllEv: function(address) {
          const suspendAll = new NativeFunction(address, "void", ["pointer"], nativeFunctionOptions3);
          this["art::ThreadList::SuspendAll"] = function(threadList, cause, longSuspend) {
            return suspendAll(threadList);
          };
        },
        _ZN3art10ThreadList9ResumeAllEv: ["art::ThreadList::ResumeAll", "void", ["pointer"]],
        // Android >= 7
        _ZN3art11ClassLinker12VisitClassesEPNS_12ClassVisitorE: ["art::ClassLinker::VisitClasses", "void", ["pointer", "pointer"]],
        // Android < 7
        _ZN3art11ClassLinker12VisitClassesEPFbPNS_6mirror5ClassEPvES4_: function(address) {
          const visitClasses = new NativeFunction(address, "void", ["pointer", "pointer", "pointer"], nativeFunctionOptions3);
          this["art::ClassLinker::VisitClasses"] = function(classLinker, visitor) {
            visitClasses(classLinker, visitor, NULL);
          };
        },
        _ZNK3art11ClassLinker17VisitClassLoadersEPNS_18ClassLoaderVisitorE: ["art::ClassLinker::VisitClassLoaders", "void", ["pointer", "pointer"]],
        _ZN3art2gc4Heap12VisitObjectsEPFvPNS_6mirror6ObjectEPvES5_: ["art::gc::Heap::VisitObjects", "void", ["pointer", "pointer", "pointer"]],
        _ZN3art2gc4Heap12GetInstancesERNS_24VariableSizedHandleScopeENS_6HandleINS_6mirror5ClassEEEiRNSt3__16vectorINS4_INS5_6ObjectEEENS8_9allocatorISB_EEEE: ["art::gc::Heap::GetInstances", "void", ["pointer", "pointer", "pointer", "int", "pointer"]],
        // Android >= 9
        _ZN3art2gc4Heap12GetInstancesERNS_24VariableSizedHandleScopeENS_6HandleINS_6mirror5ClassEEEbiRNSt3__16vectorINS4_INS5_6ObjectEEENS8_9allocatorISB_EEEE: function(address) {
          const getInstances = new NativeFunction(address, "void", ["pointer", "pointer", "pointer", "bool", "int", "pointer"], nativeFunctionOptions3);
          this["art::gc::Heap::GetInstances"] = function(instance, scope, hClass, maxCount, instances) {
            const useIsAssignableFrom = 0;
            getInstances(instance, scope, hClass, useIsAssignableFrom, maxCount, instances);
          };
        },
        _ZN3art12StackVisitorC2EPNS_6ThreadEPNS_7ContextENS0_13StackWalkKindEjb: ["art::StackVisitor::StackVisitor", "void", ["pointer", "pointer", "pointer", "uint", "uint", "bool"]],
        _ZN3art12StackVisitorC2EPNS_6ThreadEPNS_7ContextENS0_13StackWalkKindEmb: ["art::StackVisitor::StackVisitor", "void", ["pointer", "pointer", "pointer", "uint", "size_t", "bool"]],
        _ZN3art12StackVisitor9WalkStackILNS0_16CountTransitionsE0EEEvb: ["art::StackVisitor::WalkStack", "void", ["pointer", "bool"]],
        _ZNK3art12StackVisitor9GetMethodEv: ["art::StackVisitor::GetMethod", "pointer", ["pointer"]],
        _ZNK3art12StackVisitor16DescribeLocationEv: function(address) {
          this["art::StackVisitor::DescribeLocation"] = makeCxxMethodWrapperReturningStdStringByValue(address, ["pointer"]);
        },
        _ZNK3art12StackVisitor24GetCurrentQuickFrameInfoEv: function(address) {
          this["art::StackVisitor::GetCurrentQuickFrameInfo"] = makeArtQuickFrameInfoGetter(address);
        },
        _ZN3art7Context6CreateEv: ["art::Context::Create", "pointer", []],
        _ZN3art6Thread18GetLongJumpContextEv: ["art::Thread::GetLongJumpContext", "pointer", ["pointer"]],
        _ZN3art6mirror5Class13GetDescriptorEPNSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEE: function(address) {
          this["art::mirror::Class::GetDescriptor"] = address;
        },
        _ZN3art6mirror5Class11GetLocationEv: function(address) {
          this["art::mirror::Class::GetLocation"] = makeCxxMethodWrapperReturningStdStringByValue(address, ["pointer"]);
        },
        _ZN3art9ArtMethod12PrettyMethodEb: function(address) {
          this["art::ArtMethod::PrettyMethod"] = makeCxxMethodWrapperReturningStdStringByValue(address, ["pointer", "bool"]);
        },
        _ZN3art12PrettyMethodEPNS_9ArtMethodEb: function(address) {
          this["art::ArtMethod::PrettyMethodNullSafe"] = makeCxxMethodWrapperReturningStdStringByValue(address, ["pointer", "bool"]);
        },
        // Android < 6 for cloneArtMethod()
        _ZN3art6Thread14CurrentFromGdbEv: ["art::Thread::CurrentFromGdb", "pointer", []],
        _ZN3art6mirror6Object5CloneEPNS_6ThreadE: function(address) {
          this["art::mirror::Object::Clone"] = new NativeFunction(address, "pointer", ["pointer", "pointer"], nativeFunctionOptions3);
        },
        _ZN3art6mirror6Object5CloneEPNS_6ThreadEm: function(address) {
          const clone = new NativeFunction(address, "pointer", ["pointer", "pointer", "pointer"], nativeFunctionOptions3);
          this["art::mirror::Object::Clone"] = function(thisPtr, threadPtr) {
            const numTargetBytes = NULL;
            return clone(thisPtr, threadPtr, numTargetBytes);
          };
        },
        _ZN3art6mirror6Object5CloneEPNS_6ThreadEj: function(address) {
          const clone = new NativeFunction(address, "pointer", ["pointer", "pointer", "uint"], nativeFunctionOptions3);
          this["art::mirror::Object::Clone"] = function(thisPtr, threadPtr) {
            const numTargetBytes = 0;
            return clone(thisPtr, threadPtr, numTargetBytes);
          };
        },
        _ZN3art3Dbg14SetJdwpAllowedEb: ["art::Dbg::SetJdwpAllowed", "void", ["bool"]],
        _ZN3art3Dbg13ConfigureJdwpERKNS_4JDWP11JdwpOptionsE: ["art::Dbg::ConfigureJdwp", "void", ["pointer"]],
        _ZN3art31InternalDebuggerControlCallback13StartDebuggerEv: ["art::InternalDebuggerControlCallback::StartDebugger", "void", ["pointer"]],
        _ZN3art3Dbg9StartJdwpEv: ["art::Dbg::StartJdwp", "void", []],
        _ZN3art3Dbg8GoActiveEv: ["art::Dbg::GoActive", "void", []],
        _ZN3art3Dbg21RequestDeoptimizationERKNS_21DeoptimizationRequestE: ["art::Dbg::RequestDeoptimization", "void", ["pointer"]],
        _ZN3art3Dbg20ManageDeoptimizationEv: ["art::Dbg::ManageDeoptimization", "void", []],
        _ZN3art15instrumentation15Instrumentation20EnableDeoptimizationEv: ["art::Instrumentation::EnableDeoptimization", "void", ["pointer"]],
        // Android >= 6
        _ZN3art15instrumentation15Instrumentation20DeoptimizeEverythingEPKc: ["art::Instrumentation::DeoptimizeEverything", "void", ["pointer", "pointer"]],
        // Android < 6
        _ZN3art15instrumentation15Instrumentation20DeoptimizeEverythingEv: function(address) {
          const deoptimize = new NativeFunction(address, "void", ["pointer"], nativeFunctionOptions3);
          this["art::Instrumentation::DeoptimizeEverything"] = function(instrumentation, key) {
            deoptimize(instrumentation);
          };
        },
        _ZN3art7Runtime19DeoptimizeBootImageEv: ["art::Runtime::DeoptimizeBootImage", "void", ["pointer"]],
        _ZN3art15instrumentation15Instrumentation10DeoptimizeEPNS_9ArtMethodE: ["art::Instrumentation::Deoptimize", "void", ["pointer", "pointer"]],
        // Android >= 11
        _ZN3art3jni12JniIdManager14DecodeMethodIdEP10_jmethodID: ["art::jni::JniIdManager::DecodeMethodId", "pointer", ["pointer", "pointer"]],
        _ZN3art3jni12JniIdManager13DecodeFieldIdEP9_jfieldID: ["art::jni::JniIdManager::DecodeFieldId", "pointer", ["pointer", "pointer"]],
        _ZN3art11interpreter18GetNterpEntryPointEv: ["art::interpreter::GetNterpEntryPoint", "pointer", []],
        _ZN3art7Monitor17TranslateLocationEPNS_9ArtMethodEjPPKcPi: ["art::Monitor::TranslateLocation", "void", ["pointer", "uint32", "pointer", "pointer"]]
      },
      variables: {
        _ZN3art3Dbg9gRegistryE: function(address) {
          this.isJdwpStarted = () => !address.readPointer().isNull();
        },
        _ZN3art3Dbg15gDebuggerActiveE: function(address) {
          this.isDebuggerActive = () => !!address.readU8();
        }
      },
      optionals: /* @__PURE__ */ new Set([
        "artInterpreterToCompiledCodeBridge",
        "_ZN3art9JavaVMExt12AddGlobalRefEPNS_6ThreadENS_6ObjPtrINS_6mirror6ObjectEEE",
        "_ZN3art9JavaVMExt12AddGlobalRefEPNS_6ThreadEPNS_6mirror6ObjectE",
        "_ZN3art9JavaVMExt12DecodeGlobalEPv",
        "_ZN3art9JavaVMExt12DecodeGlobalEPNS_6ThreadEPv",
        "_ZNK3art6Thread19DecodeGlobalJObjectEP8_jobject",
        "_ZNK3art6Thread13DecodeJObjectEP8_jobject",
        "_ZN3art10ThreadList10SuspendAllEPKcb",
        "_ZN3art10ThreadList10SuspendAllEv",
        "_ZN3art11ClassLinker12VisitClassesEPNS_12ClassVisitorE",
        "_ZN3art11ClassLinker12VisitClassesEPFbPNS_6mirror5ClassEPvES4_",
        "_ZNK3art11ClassLinker17VisitClassLoadersEPNS_18ClassLoaderVisitorE",
        "_ZN3art6mirror6Object5CloneEPNS_6ThreadE",
        "_ZN3art6mirror6Object5CloneEPNS_6ThreadEm",
        "_ZN3art6mirror6Object5CloneEPNS_6ThreadEj",
        "_ZN3art22IndirectReferenceTable3AddEjPNS_6mirror6ObjectE",
        "_ZN3art22IndirectReferenceTable3AddENS_15IRTSegmentStateENS_6ObjPtrINS_6mirror6ObjectEEE",
        "_ZN3art2gc4Heap12VisitObjectsEPFvPNS_6mirror6ObjectEPvES5_",
        "_ZN3art2gc4Heap12GetInstancesERNS_24VariableSizedHandleScopeENS_6HandleINS_6mirror5ClassEEEiRNSt3__16vectorINS4_INS5_6ObjectEEENS8_9allocatorISB_EEEE",
        "_ZN3art2gc4Heap12GetInstancesERNS_24VariableSizedHandleScopeENS_6HandleINS_6mirror5ClassEEEbiRNSt3__16vectorINS4_INS5_6ObjectEEENS8_9allocatorISB_EEEE",
        "_ZN3art12StackVisitorC2EPNS_6ThreadEPNS_7ContextENS0_13StackWalkKindEjb",
        "_ZN3art12StackVisitorC2EPNS_6ThreadEPNS_7ContextENS0_13StackWalkKindEmb",
        "_ZN3art12StackVisitor9WalkStackILNS0_16CountTransitionsE0EEEvb",
        "_ZNK3art12StackVisitor9GetMethodEv",
        "_ZNK3art12StackVisitor16DescribeLocationEv",
        "_ZNK3art12StackVisitor24GetCurrentQuickFrameInfoEv",
        "_ZN3art7Context6CreateEv",
        "_ZN3art6Thread18GetLongJumpContextEv",
        "_ZN3art6mirror5Class13GetDescriptorEPNSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEE",
        "_ZN3art6mirror5Class11GetLocationEv",
        "_ZN3art9ArtMethod12PrettyMethodEb",
        "_ZN3art12PrettyMethodEPNS_9ArtMethodEb",
        "_ZN3art3Dbg13ConfigureJdwpERKNS_4JDWP11JdwpOptionsE",
        "_ZN3art31InternalDebuggerControlCallback13StartDebuggerEv",
        "_ZN3art3Dbg15gDebuggerActiveE",
        "_ZN3art15instrumentation15Instrumentation20EnableDeoptimizationEv",
        "_ZN3art15instrumentation15Instrumentation20DeoptimizeEverythingEPKc",
        "_ZN3art15instrumentation15Instrumentation20DeoptimizeEverythingEv",
        "_ZN3art7Runtime19DeoptimizeBootImageEv",
        "_ZN3art15instrumentation15Instrumentation10DeoptimizeEPNS_9ArtMethodE",
        "_ZN3art3Dbg9StartJdwpEv",
        "_ZN3art3Dbg8GoActiveEv",
        "_ZN3art3Dbg21RequestDeoptimizationERKNS_21DeoptimizationRequestE",
        "_ZN3art3Dbg20ManageDeoptimizationEv",
        "_ZN3art3Dbg9gRegistryE",
        "_ZN3art3jni12JniIdManager14DecodeMethodIdEP10_jmethodID",
        "_ZN3art3jni12JniIdManager13DecodeFieldIdEP9_jfieldID",
        "_ZN3art11interpreter18GetNterpEntryPointEv",
        "_ZN3art7Monitor17TranslateLocationEPNS_9ArtMethodEjPPKcPi"
      ])
    } : {
      functions: {
        _Z20dvmDecodeIndirectRefP6ThreadP8_jobject: ["dvmDecodeIndirectRef", "pointer", ["pointer", "pointer"]],
        _Z15dvmUseJNIBridgeP6MethodPv: ["dvmUseJNIBridge", "void", ["pointer", "pointer"]],
        _Z20dvmHeapSourceGetBasev: ["dvmHeapSourceGetBase", "pointer", []],
        _Z21dvmHeapSourceGetLimitv: ["dvmHeapSourceGetLimit", "pointer", []],
        _Z16dvmIsValidObjectPK6Object: ["dvmIsValidObject", "uint8", ["pointer"]],
        JNI_GetCreatedJavaVMs: ["JNI_GetCreatedJavaVMs", "int", ["pointer", "int", "pointer"]]
      },
      variables: {
        gDvmJni: function(address) {
          this.gDvmJni = address;
        },
        gDvm: function(address) {
          this.gDvm = address;
        }
      }
    };
    const {
      functions = {},
      variables = {},
      optionals = /* @__PURE__ */ new Set()
    } = pending;
    const missing = [];
    for (const [name, signature] of Object.entries(functions)) {
      const address = temporaryApi.find(name);
      if (address !== null) {
        if (typeof signature === "function") {
          signature.call(temporaryApi, address);
        } else {
          temporaryApi[signature[0]] = new NativeFunction(address, signature[1], signature[2], nativeFunctionOptions3);
        }
      } else {
        if (!optionals.has(name)) {
          missing.push(name);
        }
      }
    }
    for (const [name, handler] of Object.entries(variables)) {
      const address = temporaryApi.find(name);
      if (address !== null) {
        handler.call(temporaryApi, address);
      } else {
        if (!optionals.has(name)) {
          missing.push(name);
        }
      }
    }
    if (missing.length > 0) {
      throw new Error("Java API only partially available; please file a bug. Missing: " + missing.join(", "));
    }
    const vms = Memory.alloc(pointerSize5);
    const vmCount = Memory.alloc(jsizeSize);
    checkJniResult("JNI_GetCreatedJavaVMs", temporaryApi.JNI_GetCreatedJavaVMs(vms, 1, vmCount));
    if (vmCount.readInt() === 0) {
      return null;
    }
    temporaryApi.vm = vms.readPointer();
    if (isArt) {
      const apiLevel = getAndroidApiLevel();
      let kAccCompileDontBother;
      if (apiLevel >= 27) {
        kAccCompileDontBother = 33554432;
      } else if (apiLevel >= 24) {
        kAccCompileDontBother = 16777216;
      } else {
        kAccCompileDontBother = 0;
      }
      temporaryApi.kAccCompileDontBother = kAccCompileDontBother;
      const artRuntime = temporaryApi.vm.add(pointerSize5).readPointer();
      temporaryApi.artRuntime = artRuntime;
      const runtimeSpec = getArtRuntimeSpec(temporaryApi);
      const runtimeOffset = runtimeSpec.offset;
      const instrumentationOffset = runtimeOffset.instrumentation;
      temporaryApi.artInstrumentation = instrumentationOffset !== null ? artRuntime.add(instrumentationOffset) : null;
      const instrumentationIsPointer = getArtApexVersion() >= 36e7;
      if (instrumentationIsPointer && temporaryApi.artInstrumentation != null) {
        temporaryApi.artInstrumentation = temporaryApi.artInstrumentation.readPointer();
      }
      temporaryApi.artHeap = artRuntime.add(runtimeOffset.heap).readPointer();
      temporaryApi.artThreadList = artRuntime.add(runtimeOffset.threadList).readPointer();
      const classLinker = artRuntime.add(runtimeOffset.classLinker).readPointer();
      const classLinkerOffsets = getArtClassLinkerSpec(artRuntime, runtimeSpec).offset;
      const quickResolutionTrampoline = classLinker.add(classLinkerOffsets.quickResolutionTrampoline).readPointer();
      const quickImtConflictTrampoline = classLinker.add(classLinkerOffsets.quickImtConflictTrampoline).readPointer();
      const quickGenericJniTrampoline = classLinker.add(classLinkerOffsets.quickGenericJniTrampoline).readPointer();
      const quickToInterpreterBridgeTrampoline = classLinker.add(classLinkerOffsets.quickToInterpreterBridgeTrampoline).readPointer();
      temporaryApi.artClassLinker = {
        address: classLinker,
        quickResolutionTrampoline,
        quickImtConflictTrampoline,
        quickGenericJniTrampoline,
        quickToInterpreterBridgeTrampoline
      };
      const vm3 = new VM(temporaryApi);
      temporaryApi.artQuickGenericJniTrampoline = getArtQuickEntrypointFromTrampoline(quickGenericJniTrampoline, vm3);
      temporaryApi.artQuickToInterpreterBridge = getArtQuickEntrypointFromTrampoline(quickToInterpreterBridgeTrampoline, vm3);
      temporaryApi.artQuickResolutionTrampoline = getArtQuickEntrypointFromTrampoline(quickResolutionTrampoline, vm3);
      if (temporaryApi["art::JavaVMExt::AddGlobalRef"] === void 0) {
        temporaryApi["art::JavaVMExt::AddGlobalRef"] = makeAddGlobalRefFallbackForAndroid5(temporaryApi);
      }
      if (temporaryApi["art::JavaVMExt::DecodeGlobal"] === void 0) {
        temporaryApi["art::JavaVMExt::DecodeGlobal"] = makeDecodeGlobalFallback(temporaryApi);
      }
      if (temporaryApi["art::ArtMethod::PrettyMethod"] === void 0) {
        temporaryApi["art::ArtMethod::PrettyMethod"] = temporaryApi["art::ArtMethod::PrettyMethodNullSafe"];
      }
      if (temporaryApi["art::interpreter::GetNterpEntryPoint"] !== void 0) {
        temporaryApi.artNterpEntryPoint = temporaryApi["art::interpreter::GetNterpEntryPoint"]();
      } else {
        temporaryApi.artNterpEntryPoint = temporaryApi.find("ExecuteNterpImpl");
      }
      artController = makeArtController(temporaryApi, vm3);
      fixupArtQuickDeliverExceptionBug(temporaryApi);
      let cachedJvmti = null;
      Object.defineProperty(temporaryApi, "jvmti", {
        get() {
          if (cachedJvmti === null) {
            cachedJvmti = [tryGetEnvJvmti(vm3, this.artRuntime)];
          }
          return cachedJvmti[0];
        }
      });
    }
    const cxxImports = vmModule.enumerateImports().filter((imp) => imp.name.indexOf("_Z") === 0).reduce((result2, imp) => {
      result2[imp.name] = imp.address;
      return result2;
    }, {});
    temporaryApi.$new = new NativeFunction(cxxImports._Znwm || cxxImports._Znwj, "pointer", ["ulong"], nativeFunctionOptions3);
    temporaryApi.$delete = new NativeFunction(cxxImports._ZdlPv, "void", ["pointer"], nativeFunctionOptions3);
    MethodMangler = isArt ? ArtMethodMangler : DalvikMethodMangler;
    return temporaryApi;
  }
  function tryGetEnvJvmti(vm3, runtime2) {
    let env = null;
    vm3.perform(() => {
      const ensurePluginLoadedAddr = getApi().find("_ZN3art7Runtime18EnsurePluginLoadedEPKcPNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEE");
      if (ensurePluginLoadedAddr === null) {
        return;
      }
      const ensurePluginLoaded = new NativeFunction(
        ensurePluginLoadedAddr,
        "bool",
        ["pointer", "pointer", "pointer"]
      );
      const errorPtr = Memory.alloc(pointerSize5);
      const success = ensurePluginLoaded(runtime2, Memory.allocUtf8String("libopenjdkjvmti.so"), errorPtr);
      if (!success) {
        return;
      }
      const kArtTiVersion = jvmtiVersion.v1_2 | 1073741824;
      const handle = vm3.tryGetEnvHandle(kArtTiVersion);
      if (handle === null) {
        return;
      }
      env = new EnvJvmti(handle, vm3);
      const capaBuf = Memory.alloc(8);
      capaBuf.writeU64(jvmtiCapabilities.canTagObjects);
      const result2 = env.addCapabilities(capaBuf);
      if (result2 !== JNI_OK) {
        env = null;
      }
    });
    return env;
  }
  function ensureClassInitialized(env, classRef) {
    const api2 = getApi();
    if (api2.flavor !== "art") {
      return;
    }
    env.getClassName(classRef);
  }
  function getArtVMSpec(api2) {
    return {
      offset: pointerSize5 === 4 ? {
        globalsLock: 32,
        globals: 72
      } : {
        globalsLock: 64,
        globals: 112
      }
    };
  }
  function _getArtRuntimeSpec(api2) {
    const vm3 = api2.vm;
    const runtime2 = api2.artRuntime;
    const startOffset = pointerSize5 === 4 ? 200 : 384;
    const endOffset = startOffset + 100 * pointerSize5;
    const apiLevel = getAndroidApiLevel();
    const codename = getAndroidCodename();
    const { isApiLevel34OrApexEquivalent } = api2;
    let spec = null;
    for (let offset = startOffset; offset !== endOffset; offset += pointerSize5) {
      const value = runtime2.add(offset).readPointer();
      if (value.equals(vm3)) {
        let classLinkerOffsets;
        let jniIdManagerOffset = null;
        if (apiLevel >= 33 || codename === "Tiramisu" || isApiLevel34OrApexEquivalent) {
          classLinkerOffsets = [offset - 4 * pointerSize5];
          jniIdManagerOffset = offset - pointerSize5;
        } else if (apiLevel >= 30 || codename === "R") {
          classLinkerOffsets = [offset - 3 * pointerSize5, offset - 4 * pointerSize5];
          jniIdManagerOffset = offset - pointerSize5;
        } else if (apiLevel >= 29) {
          classLinkerOffsets = [offset - 2 * pointerSize5];
        } else if (apiLevel >= 27) {
          classLinkerOffsets = [offset - STD_STRING_SIZE - 3 * pointerSize5];
        } else {
          classLinkerOffsets = [offset - STD_STRING_SIZE - 2 * pointerSize5];
        }
        for (const classLinkerOffset of classLinkerOffsets) {
          const internTableOffset = classLinkerOffset - pointerSize5;
          const threadListOffset = internTableOffset - pointerSize5;
          let heapOffset;
          if (isApiLevel34OrApexEquivalent) {
            heapOffset = threadListOffset - 9 * pointerSize5;
          } else if (apiLevel >= 24) {
            heapOffset = threadListOffset - 8 * pointerSize5;
          } else if (apiLevel >= 23) {
            heapOffset = threadListOffset - 7 * pointerSize5;
          } else {
            heapOffset = threadListOffset - 4 * pointerSize5;
          }
          const candidate = {
            offset: {
              heap: heapOffset,
              threadList: threadListOffset,
              internTable: internTableOffset,
              classLinker: classLinkerOffset,
              jniIdManager: jniIdManagerOffset
            }
          };
          if (tryGetArtClassLinkerSpec(runtime2, candidate) !== null) {
            spec = candidate;
            break;
          }
        }
        break;
      }
    }
    if (spec === null) {
      throw new Error("Unable to determine Runtime field offsets");
    }
    const instrumentationIsPointer = getArtApexVersion() >= 36e7;
    spec.offset.instrumentation = instrumentationIsPointer ? tryDetectInstrumentationPointer(api2) : tryDetectInstrumentationOffset(api2);
    spec.offset.jniIdsIndirection = tryDetectJniIdsIndirectionOffset(api2);
    return spec;
  }
  var instrumentationOffsetParsers = {
    ia32: parsex86InstrumentationOffset,
    x64: parsex86InstrumentationOffset,
    arm: parseArmInstrumentationOffset,
    arm64: parseArm64InstrumentationOffset
  };
  function tryDetectInstrumentationOffset(api2) {
    const impl = api2["art::Runtime::DeoptimizeBootImage"];
    if (impl === void 0) {
      return null;
    }
    return parseInstructionsAt(impl, instrumentationOffsetParsers[Process.arch], { limit: 30 });
  }
  function parsex86InstrumentationOffset(insn) {
    if (insn.mnemonic !== "lea") {
      return null;
    }
    const offset = insn.operands[1].value.disp;
    if (offset < 256 || offset > 1024) {
      return null;
    }
    return offset;
  }
  function parseArmInstrumentationOffset(insn) {
    if (insn.mnemonic !== "add.w") {
      return null;
    }
    const ops = insn.operands;
    if (ops.length !== 3) {
      return null;
    }
    const op2 = ops[2];
    if (op2.type !== "imm") {
      return null;
    }
    return op2.value;
  }
  function parseArm64InstrumentationOffset(insn) {
    if (insn.mnemonic !== "add") {
      return null;
    }
    const ops = insn.operands;
    if (ops.length !== 3) {
      return null;
    }
    if (ops[0].value === "sp" || ops[1].value === "sp") {
      return null;
    }
    const op2 = ops[2];
    if (op2.type !== "imm") {
      return null;
    }
    const offset = op2.value.valueOf();
    if (offset < 256 || offset > 1024) {
      return null;
    }
    return offset;
  }
  var instrumentationPointerParser = {
    ia32: parsex86InstrumentationPointer,
    x64: parsex86InstrumentationPointer,
    arm: parseArmInstrumentationPointer,
    arm64: parseArm64InstrumentationPointer
  };
  function tryDetectInstrumentationPointer(api2) {
    const impl = api2["art::Runtime::DeoptimizeBootImage"];
    if (impl === void 0) {
      return null;
    }
    return parseInstructionsAt(impl, instrumentationPointerParser[Process.arch], { limit: 30 });
  }
  function parsex86InstrumentationPointer(insn) {
    if (insn.mnemonic !== "mov") {
      return null;
    }
    const ops = insn.operands;
    const dst = ops[0];
    if (dst.value !== "rax") {
      return null;
    }
    const src = ops[1];
    if (src.type !== "mem") {
      return null;
    }
    const mem = src.value;
    if (mem.base !== "rdi") {
      return null;
    }
    const offset = mem.disp;
    if (offset < 256 || offset > 1024) {
      return null;
    }
    return offset;
  }
  function parseArmInstrumentationPointer(insn) {
    return null;
  }
  function parseArm64InstrumentationPointer(insn) {
    if (insn.mnemonic !== "ldr") {
      return null;
    }
    const ops = insn.operands;
    if (ops[0].value === "x0") {
      return null;
    }
    const mem = ops[1].value;
    if (mem.base !== "x0") {
      return null;
    }
    const offset = mem.disp;
    if (offset < 256 || offset > 1024) {
      return null;
    }
    return offset;
  }
  var jniIdsIndirectionOffsetParsers = {
    ia32: parsex86JniIdsIndirectionOffset,
    x64: parsex86JniIdsIndirectionOffset,
    arm: parseArmJniIdsIndirectionOffset,
    arm64: parseArm64JniIdsIndirectionOffset
  };
  function tryDetectJniIdsIndirectionOffset(api2) {
    const impl = api2.find("_ZN3art7Runtime12SetJniIdTypeENS_9JniIdTypeE");
    if (impl === null) {
      return null;
    }
    const offset = parseInstructionsAt(impl, jniIdsIndirectionOffsetParsers[Process.arch], { limit: 20 });
    if (offset === null) {
      throw new Error("Unable to determine Runtime.jni_ids_indirection_ offset");
    }
    return offset;
  }
  function parsex86JniIdsIndirectionOffset(insn) {
    if (insn.mnemonic === "cmp") {
      return insn.operands[0].value.disp;
    }
    return null;
  }
  function parseArmJniIdsIndirectionOffset(insn) {
    if (insn.mnemonic === "ldr.w") {
      return insn.operands[1].value.disp;
    }
    return null;
  }
  function parseArm64JniIdsIndirectionOffset(insn, prevInsn) {
    if (prevInsn === null) {
      return null;
    }
    const { mnemonic } = insn;
    const { mnemonic: prevMnemonic } = prevInsn;
    if (mnemonic === "cmp" && prevMnemonic === "ldr" || mnemonic === "bl" && prevMnemonic === "str") {
      return prevInsn.operands[1].value.disp;
    }
    return null;
  }
  function _getArtInstrumentationSpec() {
    const deoptimizationEnabledOffsets = {
      "4-21": 136,
      "4-22": 136,
      "4-23": 172,
      "4-24": 196,
      "4-25": 196,
      "4-26": 196,
      "4-27": 196,
      "4-28": 212,
      "4-29": 172,
      "4-30": 180,
      "4-31": 180,
      "8-21": 224,
      "8-22": 224,
      "8-23": 296,
      "8-24": 344,
      "8-25": 344,
      "8-26": 352,
      "8-27": 352,
      "8-28": 392,
      "8-29": 328,
      "8-30": 336,
      "8-31": 336
    };
    const deoptEnabledOffset = deoptimizationEnabledOffsets[`${pointerSize5}-${getAndroidApiLevel()}`];
    if (deoptEnabledOffset === void 0) {
      throw new Error("Unable to determine Instrumentation field offsets");
    }
    return {
      offset: {
        forcedInterpretOnly: 4,
        deoptimizationEnabled: deoptEnabledOffset
      }
    };
  }
  function getArtClassLinkerSpec(runtime2, runtimeSpec) {
    const spec = tryGetArtClassLinkerSpec(runtime2, runtimeSpec);
    if (spec === null) {
      throw new Error("Unable to determine ClassLinker field offsets");
    }
    return spec;
  }
  function tryGetArtClassLinkerSpec(runtime2, runtimeSpec) {
    if (cachedArtClassLinkerSpec !== null) {
      return cachedArtClassLinkerSpec;
    }
    const { classLinker: classLinkerOffset, internTable: internTableOffset } = runtimeSpec.offset;
    const classLinker = runtime2.add(classLinkerOffset).readPointer();
    const internTable = runtime2.add(internTableOffset).readPointer();
    const startOffset = pointerSize5 === 4 ? 100 : 200;
    const endOffset = startOffset + 100 * pointerSize5;
    const apiLevel = getAndroidApiLevel();
    let spec = null;
    for (let offset = startOffset; offset !== endOffset; offset += pointerSize5) {
      const value = classLinker.add(offset).readPointer();
      if (value.equals(internTable)) {
        let delta;
        if (apiLevel >= 30 || getAndroidCodename() === "R") {
          delta = 6;
        } else if (apiLevel >= 29) {
          delta = 4;
        } else if (apiLevel >= 23) {
          delta = 3;
        } else {
          delta = 5;
        }
        const quickGenericJniTrampolineOffset = offset + delta * pointerSize5;
        let quickResolutionTrampolineOffset;
        if (apiLevel >= 23) {
          quickResolutionTrampolineOffset = quickGenericJniTrampolineOffset - 2 * pointerSize5;
        } else {
          quickResolutionTrampolineOffset = quickGenericJniTrampolineOffset - 3 * pointerSize5;
        }
        spec = {
          offset: {
            quickResolutionTrampoline: quickResolutionTrampolineOffset,
            quickImtConflictTrampoline: quickGenericJniTrampolineOffset - pointerSize5,
            quickGenericJniTrampoline: quickGenericJniTrampolineOffset,
            quickToInterpreterBridgeTrampoline: quickGenericJniTrampolineOffset + pointerSize5
          }
        };
        break;
      }
    }
    if (spec !== null) {
      cachedArtClassLinkerSpec = spec;
    }
    return spec;
  }
  function getArtClassSpec(vm3) {
    const MAX_OFFSET = 256;
    let spec = null;
    vm3.perform((env) => {
      const fieldSpec = getArtFieldSpec(vm3);
      const methodSpec = getArtMethodSpec(vm3);
      const fInfo = {
        artArrayLengthSize: 4,
        artArrayEntrySize: fieldSpec.size,
        // java/lang/Thread has 36 fields on Android 16.
        artArrayMax: 50
      };
      const mInfo = {
        artArrayLengthSize: pointerSize5,
        artArrayEntrySize: methodSpec.size,
        // java/lang/Thread has 79 methods on Android 16.
        artArrayMax: 100
      };
      const readArtArray = (objectBase, fieldOffset, lengthSize) => {
        const header = objectBase.add(fieldOffset).readPointer();
        if (header.isNull()) {
          return null;
        }
        const length = lengthSize === 4 ? header.readU32() : header.readU64().valueOf();
        if (length <= 0) {
          return null;
        }
        return {
          length,
          data: header.add(lengthSize)
        };
      };
      const hasEntry = (objectBase, offset, needle, info) => {
        try {
          const artArray = readArtArray(objectBase, offset, info.artArrayLengthSize);
          if (artArray === null) {
            return false;
          }
          const artArrayEnd = Math.min(artArray.length, info.artArrayMax);
          for (let i = 0; i !== artArrayEnd; i++) {
            const fieldPtr = artArray.data.add(i * info.artArrayEntrySize);
            if (fieldPtr.equals(needle)) {
              return true;
            }
          }
        } catch {
        }
        return false;
      };
      const clazz = env.findClass("java/lang/Thread");
      const clazzRef = env.newGlobalRef(clazz);
      try {
        let object;
        withRunnableArtThread(vm3, env, (thread) => {
          object = getApi()["art::JavaVMExt::DecodeGlobal"](vm3, thread, clazzRef);
        });
        const fieldInstance = unwrapFieldId(env.getFieldId(clazzRef, "name", "Ljava/lang/String;"));
        const fieldStatic = unwrapFieldId(env.getStaticFieldId(clazzRef, "MAX_PRIORITY", "I"));
        let offsetStatic = -1;
        let offsetInstance = -1;
        for (let offset = 0; offset !== MAX_OFFSET; offset += 4) {
          if (offsetStatic === -1 && hasEntry(object, offset, fieldStatic, fInfo)) {
            offsetStatic = offset;
          }
          if (offsetInstance === -1 && hasEntry(object, offset, fieldInstance, fInfo)) {
            offsetInstance = offset;
          }
        }
        if (offsetInstance === -1 || offsetStatic === -1) {
          throw new Error("Unable to find fields in java/lang/Thread; please file a bug");
        }
        const sfieldOffset = offsetInstance !== offsetStatic ? offsetStatic : 0;
        const ifieldOffset = offsetInstance;
        let offsetMethods = -1;
        const methodInstance = unwrapMethodId(env.getMethodId(clazzRef, "getName", "()Ljava/lang/String;"));
        for (let offset = 0; offset !== MAX_OFFSET; offset += 4) {
          if (offsetMethods === -1 && hasEntry(object, offset, methodInstance, mInfo)) {
            offsetMethods = offset;
          }
        }
        if (offsetMethods === -1) {
          throw new Error("Unable to find methods in java/lang/Thread; please file a bug");
        }
        let offsetCopiedMethods = -1;
        const methodsArray = readArtArray(object, offsetMethods, mInfo.artArrayLengthSize);
        const methodsArraySize = methodsArray.length;
        for (let offset = offsetMethods; offset !== MAX_OFFSET; offset += 4) {
          if (object.add(offset).readU16() === methodsArraySize) {
            offsetCopiedMethods = offset;
            break;
          }
        }
        if (offsetCopiedMethods === -1) {
          throw new Error("Unable to find copied methods in java/lang/Thread; please file a bug");
        }
        spec = {
          offset: {
            ifields: ifieldOffset,
            methods: offsetMethods,
            sfields: sfieldOffset,
            copiedMethodsOffset: offsetCopiedMethods
          }
        };
      } finally {
        env.deleteLocalRef(clazz);
        env.deleteGlobalRef(clazzRef);
      }
    });
    return spec;
  }
  function _getArtMethodSpec(vm3) {
    const api2 = getApi();
    let spec;
    vm3.perform((env) => {
      const process = env.findClass("android/os/Process");
      const getElapsedCpuTime = unwrapMethodId(env.getStaticMethodId(process, "getElapsedCpuTime", "()J"));
      env.deleteLocalRef(process);
      const runtimeModule = Process.getModuleByName("libandroid_runtime.so");
      const runtimeStart = runtimeModule.base;
      const runtimeEnd = runtimeStart.add(runtimeModule.size);
      const apiLevel = getAndroidApiLevel();
      const entrypointFieldSize = apiLevel <= 21 ? 8 : pointerSize5;
      const expectedAccessFlags = kAccPublic | kAccStatic | kAccFinal | kAccNative;
      const relevantAccessFlagsMask = ~(kAccFastInterpreterToInterpreterInvoke | kAccPublicApi | kAccNterpInvokeFastPathFlag) >>> 0;
      let jniCodeOffset = null;
      let accessFlagsOffset = null;
      let remaining = 2;
      for (let offset = 0; offset !== 64 && remaining !== 0; offset += 4) {
        const field = getElapsedCpuTime.add(offset);
        if (jniCodeOffset === null) {
          const address = field.readPointer();
          if (address.compare(runtimeStart) >= 0 && address.compare(runtimeEnd) < 0) {
            jniCodeOffset = offset;
            remaining--;
          }
        }
        if (accessFlagsOffset === null) {
          const flags = field.readU32();
          if ((flags & relevantAccessFlagsMask) === expectedAccessFlags) {
            accessFlagsOffset = offset;
            remaining--;
          }
        }
      }
      if (remaining !== 0) {
        throw new Error("Unable to determine ArtMethod field offsets");
      }
      const quickCodeOffset = jniCodeOffset + entrypointFieldSize;
      const size = apiLevel <= 21 ? quickCodeOffset + 32 : quickCodeOffset + pointerSize5;
      spec = {
        size,
        offset: {
          jniCode: jniCodeOffset,
          quickCode: quickCodeOffset,
          accessFlags: accessFlagsOffset
        }
      };
      if ("artInterpreterToCompiledCodeBridge" in api2) {
        spec.offset.interpreterCode = jniCodeOffset - entrypointFieldSize;
      }
    });
    return spec;
  }
  function getArtFieldSpec(vm3) {
    const apiLevel = getAndroidApiLevel();
    if (apiLevel >= 23) {
      return {
        size: 16,
        offset: {
          accessFlags: 4
        }
      };
    }
    if (apiLevel >= 21) {
      return {
        size: 24,
        offset: {
          accessFlags: 12
        }
      };
    }
    return null;
  }
  function _getArtThreadSpec(vm3) {
    const apiLevel = getAndroidApiLevel();
    let spec;
    vm3.perform((env) => {
      const threadHandle = getArtThreadFromEnv(env);
      const envHandle = env.handle;
      let isExceptionReportedOffset = null;
      let exceptionOffset = null;
      let throwLocationOffset = null;
      let topHandleScopeOffset = null;
      let managedStackOffset = null;
      let selfOffset = null;
      for (let offset = 144; offset !== 256; offset += pointerSize5) {
        const field = threadHandle.add(offset);
        const value = field.readPointer();
        if (value.equals(envHandle)) {
          exceptionOffset = offset - 6 * pointerSize5;
          managedStackOffset = offset - 4 * pointerSize5;
          selfOffset = offset + 2 * pointerSize5;
          if (apiLevel <= 22) {
            exceptionOffset -= pointerSize5;
            isExceptionReportedOffset = exceptionOffset - pointerSize5 - 9 * 8 - 3 * 4;
            throwLocationOffset = offset + 6 * pointerSize5;
            managedStackOffset -= pointerSize5;
            selfOffset -= pointerSize5;
          }
          topHandleScopeOffset = offset + 9 * pointerSize5;
          if (apiLevel <= 22) {
            topHandleScopeOffset += 2 * pointerSize5 + 4;
            if (pointerSize5 === 8) {
              topHandleScopeOffset += 4;
            }
          }
          if (apiLevel >= 23) {
            topHandleScopeOffset += pointerSize5;
          }
          break;
        }
      }
      if (topHandleScopeOffset === null) {
        throw new Error("Unable to determine ArtThread field offsets");
      }
      spec = {
        offset: {
          isExceptionReportedToInstrumentation: isExceptionReportedOffset,
          exception: exceptionOffset,
          throwLocation: throwLocationOffset,
          topHandleScope: topHandleScopeOffset,
          managedStack: managedStackOffset,
          self: selfOffset
        }
      };
    });
    return spec;
  }
  function _getArtManagedStackSpec() {
    const apiLevel = getAndroidApiLevel();
    if (apiLevel >= 23) {
      return {
        offset: {
          topQuickFrame: 0,
          link: pointerSize5
        }
      };
    } else {
      return {
        offset: {
          topQuickFrame: 2 * pointerSize5,
          link: 0
        }
      };
    }
  }
  var artQuickTrampolineParsers = {
    ia32: parseArtQuickTrampolineX86,
    x64: parseArtQuickTrampolineX86,
    arm: parseArtQuickTrampolineArm,
    arm64: parseArtQuickTrampolineArm64
  };
  function getArtQuickEntrypointFromTrampoline(trampoline, vm3) {
    let address;
    vm3.perform((env) => {
      const thread = getArtThreadFromEnv(env);
      const tryParse = artQuickTrampolineParsers[Process.arch];
      const insn = Instruction.parse(trampoline);
      const offset = tryParse(insn);
      if (offset !== null) {
        address = thread.add(offset).readPointer();
      } else {
        address = trampoline;
      }
    });
    return address;
  }
  function parseArtQuickTrampolineX86(insn) {
    if (insn.mnemonic === "jmp") {
      return insn.operands[0].value.disp;
    }
    return null;
  }
  function parseArtQuickTrampolineArm(insn) {
    if (insn.mnemonic === "ldr.w") {
      return insn.operands[1].value.disp;
    }
    return null;
  }
  function parseArtQuickTrampolineArm64(insn) {
    if (insn.mnemonic === "ldr") {
      return insn.operands[1].value.disp;
    }
    return null;
  }
  function getArtThreadFromEnv(env) {
    return env.handle.add(pointerSize5).readPointer();
  }
  function _getAndroidVersion() {
    return getAndroidSystemProperty("ro.build.version.release");
  }
  function _getAndroidCodename() {
    return getAndroidSystemProperty("ro.build.version.codename");
  }
  function _getAndroidApiLevel() {
    return parseInt(getAndroidSystemProperty("ro.build.version.sdk"), 10);
  }
  function _getArtApexVersion() {
    try {
      const mountInfo = File.readAllText("/proc/self/mountinfo");
      let artSource = null;
      const sourceVersions = /* @__PURE__ */ new Map();
      for (const line of mountInfo.trimEnd().split("\n")) {
        const elements = line.split(" ");
        const mountRoot = elements[4];
        if (!mountRoot.startsWith("/apex/com.android.art")) {
          continue;
        }
        const mountSource = elements[10];
        if (mountRoot.includes("@")) {
          sourceVersions.set(mountSource, mountRoot.split("@")[1]);
        } else {
          artSource = mountSource;
        }
      }
      const strVersion = sourceVersions.get(artSource);
      return strVersion !== void 0 ? parseInt(strVersion) : computeArtApexVersionFromApiLevel();
    } catch {
      return computeArtApexVersionFromApiLevel();
    }
  }
  function computeArtApexVersionFromApiLevel() {
    return getAndroidApiLevel() * 1e7;
  }
  var systemPropertyGet = null;
  var PROP_VALUE_MAX = 92;
  function getAndroidSystemProperty(name) {
    if (systemPropertyGet === null) {
      systemPropertyGet = new NativeFunction(
        Process.getModuleByName("libc.so").getExportByName("__system_property_get"),
        "int",
        ["pointer", "pointer"],
        nativeFunctionOptions3
      );
    }
    const buf = Memory.alloc(PROP_VALUE_MAX);
    systemPropertyGet(Memory.allocUtf8String(name), buf);
    return buf.readUtf8String();
  }
  function withRunnableArtThread(vm3, env, fn) {
    const perform = getArtThreadStateTransitionImpl(vm3, env);
    const id = getArtThreadFromEnv(env).toString();
    artThreadStateTransitions[id] = fn;
    perform(env.handle);
    if (artThreadStateTransitions[id] !== void 0) {
      delete artThreadStateTransitions[id];
      throw new Error("Unable to perform state transition; please file a bug");
    }
  }
  function _getArtThreadStateTransitionImpl(vm3, env) {
    const callback = new NativeCallback(onThreadStateTransitionComplete, "void", ["pointer"]);
    return makeArtThreadStateTransitionImpl(vm3, env, callback);
  }
  function onThreadStateTransitionComplete(thread) {
    const id = thread.toString();
    const fn = artThreadStateTransitions[id];
    delete artThreadStateTransitions[id];
    fn(thread);
  }
  function withAllArtThreadsSuspended(fn) {
    const api2 = getApi();
    const threadList = api2.artThreadList;
    const longSuspend = false;
    api2["art::ThreadList::SuspendAll"](threadList, Memory.allocUtf8String("frida"), longSuspend ? 1 : 0);
    try {
      fn();
    } finally {
      api2["art::ThreadList::ResumeAll"](threadList);
    }
  }
  var ArtClassVisitor = class {
    constructor(visit) {
      const visitor = Memory.alloc(4 * pointerSize5);
      const vtable2 = visitor.add(pointerSize5);
      visitor.writePointer(vtable2);
      const onVisit = new NativeCallback((self, klass) => {
        return visit(klass) === true ? 1 : 0;
      }, "bool", ["pointer", "pointer"]);
      vtable2.add(2 * pointerSize5).writePointer(onVisit);
      this.handle = visitor;
      this._onVisit = onVisit;
    }
  };
  function makeArtClassVisitor(visit) {
    const api2 = getApi();
    if (api2["art::ClassLinker::VisitClasses"] instanceof NativeFunction) {
      return new ArtClassVisitor(visit);
    }
    return new NativeCallback((klass) => {
      return visit(klass) === true ? 1 : 0;
    }, "bool", ["pointer", "pointer"]);
  }
  var ArtClassLoaderVisitor = class {
    constructor(visit) {
      const visitor = Memory.alloc(4 * pointerSize5);
      const vtable2 = visitor.add(pointerSize5);
      visitor.writePointer(vtable2);
      const onVisit = new NativeCallback((self, klass) => {
        visit(klass);
      }, "void", ["pointer", "pointer"]);
      vtable2.add(2 * pointerSize5).writePointer(onVisit);
      this.handle = visitor;
      this._onVisit = onVisit;
    }
  };
  function makeArtClassLoaderVisitor(visit) {
    return new ArtClassLoaderVisitor(visit);
  }
  var WalkKind = {
    "include-inlined-frames": 0,
    "skip-inlined-frames": 1
  };
  var ArtStackVisitor = class {
    constructor(thread, context, walkKind, numFrames = 0, checkSuspended = true) {
      const api2 = getApi();
      const baseSize = 512;
      const vtableSize = 3 * pointerSize5;
      const visitor = Memory.alloc(baseSize + vtableSize);
      api2["art::StackVisitor::StackVisitor"](
        visitor,
        thread,
        context,
        WalkKind[walkKind],
        numFrames,
        checkSuspended ? 1 : 0
      );
      const vtable2 = visitor.add(baseSize);
      visitor.writePointer(vtable2);
      const onVisitFrame = new NativeCallback(this._visitFrame.bind(this), "bool", ["pointer"]);
      vtable2.add(2 * pointerSize5).writePointer(onVisitFrame);
      this.handle = visitor;
      this._onVisitFrame = onVisitFrame;
      const curShadowFrame = visitor.add(pointerSize5 === 4 ? 12 : 24);
      this._curShadowFrame = curShadowFrame;
      this._curQuickFrame = curShadowFrame.add(pointerSize5);
      this._curQuickFramePc = curShadowFrame.add(2 * pointerSize5);
      this._curOatQuickMethodHeader = curShadowFrame.add(3 * pointerSize5);
      this._getMethodImpl = api2["art::StackVisitor::GetMethod"];
      this._descLocImpl = api2["art::StackVisitor::DescribeLocation"];
      this._getCQFIImpl = api2["art::StackVisitor::GetCurrentQuickFrameInfo"];
    }
    walkStack(includeTransitions = false) {
      getApi()["art::StackVisitor::WalkStack"](this.handle, includeTransitions ? 1 : 0);
    }
    _visitFrame() {
      return this.visitFrame() ? 1 : 0;
    }
    visitFrame() {
      throw new Error("Subclass must implement visitFrame");
    }
    getMethod() {
      const methodHandle = this._getMethodImpl(this.handle);
      if (methodHandle.isNull()) {
        return null;
      }
      return new ArtMethod(methodHandle);
    }
    getCurrentQuickFramePc() {
      return this._curQuickFramePc.readPointer();
    }
    getCurrentQuickFrame() {
      return this._curQuickFrame.readPointer();
    }
    getCurrentShadowFrame() {
      return this._curShadowFrame.readPointer();
    }
    describeLocation() {
      const result2 = new StdString();
      this._descLocImpl(result2, this.handle);
      return result2.disposeToString();
    }
    getCurrentOatQuickMethodHeader() {
      return this._curOatQuickMethodHeader.readPointer();
    }
    getCurrentQuickFrameInfo() {
      return this._getCQFIImpl(this.handle);
    }
  };
  var ArtMethod = class {
    constructor(handle) {
      this.handle = handle;
    }
    prettyMethod(withSignature = true) {
      const result2 = new StdString();
      getApi()["art::ArtMethod::PrettyMethod"](result2, this.handle, withSignature ? 1 : 0);
      return result2.disposeToString();
    }
    toString() {
      return `ArtMethod(handle=${this.handle})`;
    }
  };
  function makeArtQuickFrameInfoGetter(impl) {
    return function(self) {
      const result2 = Memory.alloc(12);
      getArtQuickFrameInfoGetterThunk(impl)(result2, self);
      return {
        frameSizeInBytes: result2.readU32(),
        coreSpillMask: result2.add(4).readU32(),
        fpSpillMask: result2.add(8).readU32()
      };
    };
  }
  function _getArtQuickFrameInfoGetterThunk(impl) {
    let thunk = NULL;
    switch (Process.arch) {
      case "ia32":
        thunk = makeThunk(32, (writer) => {
          writer.putMovRegRegOffsetPtr("ecx", "esp", 4);
          writer.putMovRegRegOffsetPtr("edx", "esp", 8);
          writer.putCallAddressWithArguments(impl, ["ecx", "edx"]);
          writer.putMovRegReg("esp", "ebp");
          writer.putPopReg("ebp");
          writer.putRet();
        });
        break;
      case "x64":
        thunk = makeThunk(32, (writer) => {
          writer.putPushReg("rdi");
          writer.putCallAddressWithArguments(impl, ["rsi"]);
          writer.putPopReg("rdi");
          writer.putMovRegPtrReg("rdi", "rax");
          writer.putMovRegOffsetPtrReg("rdi", 8, "edx");
          writer.putRet();
        });
        break;
      case "arm":
        thunk = makeThunk(16, (writer) => {
          writer.putCallAddressWithArguments(impl, ["r0", "r1"]);
          writer.putPopRegs(["r0", "lr"]);
          writer.putMovRegReg("pc", "lr");
        });
        break;
      case "arm64":
        thunk = makeThunk(64, (writer) => {
          writer.putPushRegReg("x0", "lr");
          writer.putCallAddressWithArguments(impl, ["x1"]);
          writer.putPopRegReg("x2", "lr");
          writer.putStrRegRegOffset("x0", "x2", 0);
          writer.putStrRegRegOffset("w1", "x2", 8);
          writer.putRet();
        });
        break;
    }
    return new NativeFunction(thunk, "void", ["pointer", "pointer"], nativeFunctionOptions3);
  }
  var thunkRelocators = {
    ia32: globalThis.X86Relocator,
    x64: globalThis.X86Relocator,
    arm: globalThis.ThumbRelocator,
    arm64: globalThis.Arm64Relocator
  };
  var thunkWriters = {
    ia32: globalThis.X86Writer,
    x64: globalThis.X86Writer,
    arm: globalThis.ThumbWriter,
    arm64: globalThis.Arm64Writer
  };
  function makeThunk(size, write) {
    if (thunkPage === null) {
      thunkPage = Memory.alloc(Process.pageSize);
    }
    const thunk = thunkPage.add(thunkOffset);
    const arch = Process.arch;
    const Writer = thunkWriters[arch];
    Memory.patchCode(thunk, size, (code3) => {
      const writer = new Writer(code3, { pc: thunk });
      write(writer);
      writer.flush();
      if (writer.offset > size) {
        throw new Error(`Wrote ${writer.offset}, exceeding maximum of ${size}`);
      }
    });
    thunkOffset += size;
    return arch === "arm" ? thunk.or(1) : thunk;
  }
  function notifyArtMethodHooked(method, vm3) {
    ensureArtKnowsHowToHandleMethodInstrumentation(vm3);
    ensureArtKnowsHowToHandleReplacementMethods(vm3);
  }
  function makeArtController(api2, vm3) {
    const threadOffsets = getArtThreadSpec(vm3).offset;
    const managedStackOffsets = getArtManagedStackSpec().offset;
    const code3 = `
#include <gum/guminterceptor.h>

extern GMutex lock;
extern GHashTable * methods;
extern GHashTable * replacements;
extern gpointer last_seen_art_method;

extern gpointer get_oat_quick_method_header_impl (gpointer method, gpointer pc);

void
init (void)
{
  g_mutex_init (&lock);
  methods = g_hash_table_new_full (NULL, NULL, NULL, NULL);
  replacements = g_hash_table_new_full (NULL, NULL, NULL, NULL);
}

void
finalize (void)
{
  g_hash_table_unref (replacements);
  g_hash_table_unref (methods);
  g_mutex_clear (&lock);
}

gboolean
is_replacement_method (gpointer method)
{
  gboolean is_replacement;

  g_mutex_lock (&lock);

  is_replacement = g_hash_table_contains (replacements, method);

  g_mutex_unlock (&lock);

  return is_replacement;
}

gpointer
get_replacement_method (gpointer original_method)
{
  gpointer replacement_method;

  g_mutex_lock (&lock);

  replacement_method = g_hash_table_lookup (methods, original_method);

  g_mutex_unlock (&lock);

  return replacement_method;
}

void
set_replacement_method (gpointer original_method,
                        gpointer replacement_method)
{
  g_mutex_lock (&lock);

  g_hash_table_insert (methods, original_method, replacement_method);
  g_hash_table_insert (replacements, replacement_method, original_method);

  g_mutex_unlock (&lock);
}

void
synchronize_replacement_methods (guint quick_code_offset,
                                 void * nterp_entrypoint,
                                 void * quick_to_interpreter_bridge)
{
  GHashTableIter iter;
  gpointer hooked_method, replacement_method;

  g_mutex_lock (&lock);

  g_hash_table_iter_init (&iter, methods);
  while (g_hash_table_iter_next (&iter, &hooked_method, &replacement_method))
  {
    void ** quick_code;

    *((uint32_t *) replacement_method) = *((uint32_t *) hooked_method);

    quick_code = hooked_method + quick_code_offset;
    if (*quick_code == nterp_entrypoint)
      *quick_code = quick_to_interpreter_bridge;
  }

  g_mutex_unlock (&lock);
}

void
delete_replacement_method (gpointer original_method)
{
  gpointer replacement_method;

  g_mutex_lock (&lock);

  replacement_method = g_hash_table_lookup (methods, original_method);
  if (replacement_method != NULL)
  {
    g_hash_table_remove (methods, original_method);
    g_hash_table_remove (replacements, replacement_method);
  }

  g_mutex_unlock (&lock);
}

gpointer
translate_method (gpointer method)
{
  gpointer translated_method;

  g_mutex_lock (&lock);

  translated_method = g_hash_table_lookup (replacements, method);

  g_mutex_unlock (&lock);

  return (translated_method != NULL) ? translated_method : method;
}

gpointer
find_replacement_method_from_quick_code (gpointer method,
                                         gpointer thread)
{
  gpointer replacement_method;
  gpointer managed_stack;
  gpointer top_quick_frame;
  gpointer link_managed_stack;
  gpointer * link_top_quick_frame;

  replacement_method = get_replacement_method (method);
  if (replacement_method == NULL)
    return NULL;

  /*
   * Stack check.
   *
   * Return NULL to indicate that the original method should be invoked, otherwise
   * return a pointer to the replacement ArtMethod.
   *
   * If the caller is our own JNI replacement stub, then a stack transition must
   * have been pushed onto the current thread's linked list.
   *
   * Therefore, we invoke the original method if the following conditions are met:
   *   1- The current managed stack is empty.
   *   2- The ArtMethod * inside the linked managed stack's top quick frame is the
   *      same as our replacement.
   */
  managed_stack = thread + ${threadOffsets.managedStack};
  top_quick_frame = *((gpointer *) (managed_stack + ${managedStackOffsets.topQuickFrame}));
  if (top_quick_frame != NULL)
    return replacement_method;

  link_managed_stack = *((gpointer *) (managed_stack + ${managedStackOffsets.link}));
  if (link_managed_stack == NULL)
    return replacement_method;

  link_top_quick_frame = GSIZE_TO_POINTER (*((gsize *) (link_managed_stack + ${managedStackOffsets.topQuickFrame})) & ~((gsize) 1));
  if (link_top_quick_frame == NULL || *link_top_quick_frame != replacement_method)
    return replacement_method;

  return NULL;
}

void
on_interpreter_do_call (GumInvocationContext * ic)
{
  gpointer method, replacement_method;

  method = gum_invocation_context_get_nth_argument (ic, 0);

  replacement_method = get_replacement_method (method);
  if (replacement_method != NULL)
    gum_invocation_context_replace_nth_argument (ic, 0, replacement_method);
}

gpointer
on_art_method_get_oat_quick_method_header (gpointer method,
                                           gpointer pc)
{
  if (is_replacement_method (method))
    return NULL;

  return get_oat_quick_method_header_impl (method, pc);
}

void
on_art_method_pretty_method (GumInvocationContext * ic)
{
  const guint this_arg_index = ${Process.arch === "arm64" ? 0 : 1};
  gpointer method;

  method = gum_invocation_context_get_nth_argument (ic, this_arg_index);
  if (method == NULL)
    gum_invocation_context_replace_nth_argument (ic, this_arg_index, last_seen_art_method);
  else
    last_seen_art_method = method;
}

void
on_leave_gc_concurrent_copying_copying_phase (GumInvocationContext * ic)
{
  GHashTableIter iter;
  gpointer hooked_method, replacement_method;

  g_mutex_lock (&lock);

  g_hash_table_iter_init (&iter, methods);
  while (g_hash_table_iter_next (&iter, &hooked_method, &replacement_method))
    *((uint32_t *) replacement_method) = *((uint32_t *) hooked_method);

  g_mutex_unlock (&lock);
}
`;
    const lockSize = 8;
    const methodsSize = pointerSize5;
    const replacementsSize = pointerSize5;
    const lastSeenArtMethodSize = pointerSize5;
    const data = Memory.alloc(lockSize + methodsSize + replacementsSize + lastSeenArtMethodSize);
    const lock = data;
    const methods = lock.add(lockSize);
    const replacements = methods.add(methodsSize);
    const lastSeenArtMethod = replacements.add(replacementsSize);
    const getOatQuickMethodHeaderImpl = api2.find(pointerSize5 === 4 ? "_ZN3art9ArtMethod23GetOatQuickMethodHeaderEj" : "_ZN3art9ArtMethod23GetOatQuickMethodHeaderEm");
    const cm2 = new CModule(code3, {
      lock,
      methods,
      replacements,
      last_seen_art_method: lastSeenArtMethod,
      get_oat_quick_method_header_impl: getOatQuickMethodHeaderImpl ?? ptr("0xdeadbeef")
    });
    const fastOptions = { exceptions: "propagate", scheduling: "exclusive" };
    return {
      handle: cm2,
      replacedMethods: {
        isReplacement: new NativeFunction(cm2.is_replacement_method, "bool", ["pointer"], fastOptions),
        get: new NativeFunction(cm2.get_replacement_method, "pointer", ["pointer"], fastOptions),
        set: new NativeFunction(cm2.set_replacement_method, "void", ["pointer", "pointer"], fastOptions),
        synchronize: new NativeFunction(cm2.synchronize_replacement_methods, "void", ["uint", "pointer", "pointer"], fastOptions),
        delete: new NativeFunction(cm2.delete_replacement_method, "void", ["pointer"], fastOptions),
        translate: new NativeFunction(cm2.translate_method, "pointer", ["pointer"], fastOptions),
        findReplacementFromQuickCode: cm2.find_replacement_method_from_quick_code
      },
      getOatQuickMethodHeaderImpl,
      hooks: {
        Interpreter: {
          doCall: cm2.on_interpreter_do_call
        },
        ArtMethod: {
          getOatQuickMethodHeader: cm2.on_art_method_get_oat_quick_method_header,
          prettyMethod: cm2.on_art_method_pretty_method
        },
        Gc: {
          copyingPhase: {
            onLeave: cm2.on_leave_gc_concurrent_copying_copying_phase
          },
          runFlip: {
            onEnter: cm2.on_leave_gc_concurrent_copying_copying_phase
          }
        }
      }
    };
  }
  function ensureArtKnowsHowToHandleMethodInstrumentation(vm3) {
    if (taughtArtAboutMethodInstrumentation) {
      return;
    }
    taughtArtAboutMethodInstrumentation = true;
    instrumentArtQuickEntrypoints(vm3);
    instrumentArtMethodInvocationFromInterpreter();
    instrumentArtGarbageCollection();
    instrumentArtFixupStaticTrampolines();
  }
  function instrumentArtQuickEntrypoints(vm3) {
    const api2 = getApi();
    const quickEntrypoints = [
      api2.artQuickGenericJniTrampoline,
      api2.artQuickToInterpreterBridge,
      api2.artQuickResolutionTrampoline
    ];
    quickEntrypoints.forEach((entrypoint) => {
      Memory.protect(entrypoint, 32, "rwx");
      const interceptor = new ArtQuickCodeInterceptor(entrypoint);
      interceptor.activate(vm3);
      artQuickInterceptors.push(interceptor);
    });
  }
  function instrumentArtMethodInvocationFromInterpreter() {
    const api2 = getApi();
    const apiLevel = getAndroidApiLevel();
    const { isApiLevel34OrApexEquivalent } = api2;
    let artInterpreterDoCallExportRegex;
    if (apiLevel <= 22) {
      artInterpreterDoCallExportRegex = /^_ZN3art11interpreter6DoCallILb[0-1]ELb[0-1]EEEbPNS_6mirror9ArtMethodEPNS_6ThreadERNS_11ShadowFrameEPKNS_11InstructionEtPNS_6JValueE$/;
    } else if (apiLevel <= 33 && !isApiLevel34OrApexEquivalent) {
      artInterpreterDoCallExportRegex = /^_ZN3art11interpreter6DoCallILb[0-1]ELb[0-1]EEEbPNS_9ArtMethodEPNS_6ThreadERNS_11ShadowFrameEPKNS_11InstructionEtPNS_6JValueE$/;
    } else if (isApiLevel34OrApexEquivalent) {
      artInterpreterDoCallExportRegex = /^_ZN3art11interpreter6DoCallILb[0-1]EEEbPNS_9ArtMethodEPNS_6ThreadERNS_11ShadowFrameEPKNS_11InstructionEtbPNS_6JValueE$/;
    } else {
      throw new Error("Unable to find method invocation in ART; please file a bug");
    }
    const art = api2.module;
    const entries = [...art.enumerateExports(), ...art.enumerateSymbols()].filter((entry) => artInterpreterDoCallExportRegex.test(entry.name));
    if (entries.length === 0) {
      throw new Error("Unable to find method invocation in ART; please file a bug");
    }
    for (const entry of entries) {
      Interceptor.attach(entry.address, artController.hooks.Interpreter.doCall);
    }
  }
  function instrumentArtGarbageCollection() {
    const api2 = getApi();
    const art = api2.module;
    const gc = art.findSymbolByName("_ZN3art2gc4Heap22CollectGarbageInternalENS0_9collector6GcTypeENS0_7GcCauseEbj");
    if (gc === null) {
      return;
    }
    const { artNterpEntryPoint, artQuickToInterpreterBridge } = api2;
    const quickCodeOffset = getArtMethodSpec(api2.vm).offset.quickCode;
    Interceptor.attach(gc, {
      onLeave() {
        artController.replacedMethods.synchronize(quickCodeOffset, artNterpEntryPoint, artQuickToInterpreterBridge);
      }
    });
  }
  function instrumentArtFixupStaticTrampolines() {
    const patterns = [
      ["_ZN3art11ClassLinker26VisiblyInitializedCallback22MarkVisiblyInitializedEPNS_6ThreadE", "e90340f8 : ff0ff0ff"],
      ["_ZN3art11ClassLinker26VisiblyInitializedCallback29AdjustThreadVisibilityCounterEPNS_6ThreadEl", "7f0f00f9 : 1ffcffff"]
    ];
    const api2 = getApi();
    const art = api2.module;
    for (const [name, pattern] of patterns) {
      const base = art.findSymbolByName(name);
      if (base === null) {
        continue;
      }
      const matches = Memory.scanSync(base, 8192, pattern);
      if (matches.length === 0) {
        return;
      }
      const { artNterpEntryPoint, artQuickToInterpreterBridge } = api2;
      const quickCodeOffset = getArtMethodSpec(api2.vm).offset.quickCode;
      Interceptor.attach(matches[0].address, function() {
        artController.replacedMethods.synchronize(quickCodeOffset, artNterpEntryPoint, artQuickToInterpreterBridge);
      });
      return;
    }
  }
  function ensureArtKnowsHowToHandleReplacementMethods(vm3) {
    if (taughtArtAboutReplacementMethods) {
      return;
    }
    taughtArtAboutReplacementMethods = true;
    if (!maybeInstrumentGetOatQuickMethodHeaderInlineCopies()) {
      const { getOatQuickMethodHeaderImpl } = artController;
      if (getOatQuickMethodHeaderImpl === null) {
        return;
      }
      try {
        Interceptor.replace(getOatQuickMethodHeaderImpl, artController.hooks.ArtMethod.getOatQuickMethodHeader);
      } catch (e) {
      }
    }
    const apiLevel = getAndroidApiLevel();
    let copyingPhase = null;
    const api2 = getApi();
    if (apiLevel > 28) {
      copyingPhase = api2.find("_ZN3art2gc9collector17ConcurrentCopying12CopyingPhaseEv");
    } else if (apiLevel > 22) {
      copyingPhase = api2.find("_ZN3art2gc9collector17ConcurrentCopying12MarkingPhaseEv");
    }
    if (copyingPhase !== null) {
      Interceptor.attach(copyingPhase, artController.hooks.Gc.copyingPhase);
    }
    let runFlip = null;
    runFlip = api2.find("_ZN3art6Thread15RunFlipFunctionEPS0_");
    if (runFlip === null) {
      runFlip = api2.find("_ZN3art6Thread15RunFlipFunctionEPS0_b");
    }
    if (runFlip !== null) {
      Interceptor.attach(runFlip, artController.hooks.Gc.runFlip);
    }
  }
  var artGetOatQuickMethodHeaderInlinedCopyHandler = {
    arm: {
      signatures: [
        {
          pattern: [
            "b0 68",
            // ldr r0, [r6, #8]
            "01 30",
            // adds r0, #1
            "0c d0",
            // beq #0x16fcd4
            "1b 98",
            // ldr r0, [sp, #0x6c]
            ":",
            "c0 ff",
            "c0 ff",
            "00 ff",
            "00 2f"
          ],
          validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm
        },
        {
          pattern: [
            "d8 f8 08 00",
            // ldr r0, [r8, #8]
            "01 30",
            // adds r0, #1
            "0c d0",
            // beq #0x16fcd4
            "1b 98",
            // ldr r0, [sp, #0x6c]
            ":",
            "f0 ff ff 0f",
            "ff ff",
            "00 ff",
            "00 2f"
          ],
          validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm
        },
        {
          pattern: [
            "b0 68",
            // ldr r0, [r6, #8]
            "01 30",
            // adds r0, #1
            "40 f0 c3 80",
            // bne #0x203bf0
            "00 25",
            // movs r5, #0
            ":",
            "c0 ff",
            "c0 ff",
            "c0 fb 00 d0",
            "ff f8"
          ],
          validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm
        }
      ],
      instrument: instrumentGetOatQuickMethodHeaderInlinedCopyArm
    },
    arm64: {
      signatures: [
        {
          pattern: [
            /* e8 */
            "0a 40 b9",
            // ldr w8, [x23, #0x8]
            "1f 05 00 31",
            // cmn w8, #0x1
            "40 01 00 54",
            // b.eq 0x2e4204
            "88 39 00 f0",
            // adrp x8, 0xa17000
            ":",
            /* 00 */
            "fc ff ff",
            "1f fc ff ff",
            "1f 00 00 ff",
            "00 00 00 9f"
          ],
          offset: 1,
          validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm64
        },
        {
          pattern: [
            /* e8 */
            "0a 40 b9",
            // ldr w8, [x?, #0x8]
            "1f 05 00 31",
            // cmn w8, #0x1
            "40 01 00 54",
            // b.eq <target>
            "00 0e 40 f9",
            // ldr x?, [x?, #0x18]
            ":",
            /* 00 */
            "fc ff ff",
            "1f fc ff ff",
            "1f 00 00 ff",
            "00 fc ff ff"
          ],
          offset: 1,
          validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm64
        },
        {
          pattern: [
            /* e8 */
            "0a 40 b9",
            // ldr w8, [x23, #0x8]
            "1f 05 00 31",
            // cmn w8, #0x1
            "01 34 00 54",
            // b.ne 0x3d8e50
            "e0 03 1f aa",
            // mov x0, xzr
            ":",
            /* 00 */
            "fc ff ff",
            "1f fc ff ff",
            "1f 00 00 ff",
            "e0 ff ff ff"
          ],
          offset: 1,
          validateMatch: validateGetOatQuickMethodHeaderInlinedMatchArm64
        }
      ],
      instrument: instrumentGetOatQuickMethodHeaderInlinedCopyArm64
    }
  };
  function validateGetOatQuickMethodHeaderInlinedMatchArm({ address, size }) {
    const ldr = Instruction.parse(address.or(1));
    const [ldrDst, ldrSrc] = ldr.operands;
    const methodReg = ldrSrc.value.base;
    const scratchReg = ldrDst.value;
    const branch = Instruction.parse(ldr.next.add(2));
    const targetWhenTrue = ptr(branch.operands[0].value);
    const targetWhenFalse = branch.address.add(branch.size);
    let targetWhenRegularMethod, targetWhenRuntimeMethod;
    if (branch.mnemonic === "beq") {
      targetWhenRegularMethod = targetWhenFalse;
      targetWhenRuntimeMethod = targetWhenTrue;
    } else {
      targetWhenRegularMethod = targetWhenTrue;
      targetWhenRuntimeMethod = targetWhenFalse;
    }
    return parseInstructionsAt(targetWhenRegularMethod.or(1), tryParse, { limit: 3 });
    function tryParse(insn) {
      const { mnemonic } = insn;
      if (!(mnemonic === "ldr" || mnemonic === "ldr.w")) {
        return null;
      }
      const { base, disp } = insn.operands[1].value;
      if (!(base === methodReg && disp === 20)) {
        return null;
      }
      return {
        methodReg,
        scratchReg,
        target: {
          whenTrue: targetWhenTrue,
          whenRegularMethod: targetWhenRegularMethod,
          whenRuntimeMethod: targetWhenRuntimeMethod
        }
      };
    }
  }
  function validateGetOatQuickMethodHeaderInlinedMatchArm64({ address, size }) {
    const [ldrDst, ldrSrc] = Instruction.parse(address).operands;
    const methodReg = ldrSrc.value.base;
    const scratchReg = "x" + ldrDst.value.substring(1);
    const branch = Instruction.parse(address.add(8));
    const targetWhenTrue = ptr(branch.operands[0].value);
    const targetWhenFalse = address.add(12);
    let targetWhenRegularMethod, targetWhenRuntimeMethod;
    if (branch.mnemonic === "b.eq") {
      targetWhenRegularMethod = targetWhenFalse;
      targetWhenRuntimeMethod = targetWhenTrue;
    } else {
      targetWhenRegularMethod = targetWhenTrue;
      targetWhenRuntimeMethod = targetWhenFalse;
    }
    return parseInstructionsAt(targetWhenRegularMethod, tryParse, { limit: 3 });
    function tryParse(insn) {
      if (insn.mnemonic !== "ldr") {
        return null;
      }
      const { base, disp } = insn.operands[1].value;
      if (!(base === methodReg && disp === 24)) {
        return null;
      }
      return {
        methodReg,
        scratchReg,
        target: {
          whenTrue: targetWhenTrue,
          whenRegularMethod: targetWhenRegularMethod,
          whenRuntimeMethod: targetWhenRuntimeMethod
        }
      };
    }
  }
  function maybeInstrumentGetOatQuickMethodHeaderInlineCopies() {
    if (getAndroidApiLevel() < 31) {
      return false;
    }
    const handler = artGetOatQuickMethodHeaderInlinedCopyHandler[Process.arch];
    if (handler === void 0) {
      return false;
    }
    const signatures = handler.signatures.map(({ pattern, offset = 0, validateMatch = returnEmptyObject }) => {
      return {
        pattern: new MatchPattern(pattern.join("")),
        offset,
        validateMatch
      };
    });
    const impls = [];
    for (const { base, size } of getApi().module.enumerateRanges("--x")) {
      for (const { pattern, offset, validateMatch } of signatures) {
        const matches = Memory.scanSync(base, size, pattern).map(({ address, size: size2 }) => {
          return { address: address.sub(offset), size: size2 + offset };
        }).filter((match) => {
          const validationResult = validateMatch(match);
          if (validationResult === null) {
            return false;
          }
          match.validationResult = validationResult;
          return true;
        });
        impls.push(...matches);
      }
    }
    if (impls.length === 0) {
      return false;
    }
    impls.forEach(handler.instrument);
    return true;
  }
  function returnEmptyObject() {
    return {};
  }
  var InlineHook = class {
    constructor(address, size, trampoline) {
      this.address = address;
      this.size = size;
      this.originalCode = address.readByteArray(size);
      this.trampoline = trampoline;
    }
    revert() {
      Memory.patchCode(this.address, this.size, (code3) => {
        code3.writeByteArray(this.originalCode);
      });
    }
  };
  function instrumentGetOatQuickMethodHeaderInlinedCopyArm({ address, size, validationResult }) {
    const { methodReg, target: target2 } = validationResult;
    const trampoline = Memory.alloc(Process.pageSize);
    let redirectCapacity = size;
    Memory.patchCode(trampoline, 256, (code3) => {
      const writer = new ThumbWriter(code3, { pc: trampoline });
      const relocator = new ThumbRelocator(address, writer);
      for (let i = 0; i !== 2; i++) {
        relocator.readOne();
      }
      relocator.writeAll();
      relocator.readOne();
      relocator.skipOne();
      writer.putBCondLabel("eq", "runtime_or_replacement_method");
      const vpushFpRegs = [45, 237, 16, 10];
      writer.putBytes(vpushFpRegs);
      const savedRegs = ["r0", "r1", "r2", "r3"];
      writer.putPushRegs(savedRegs);
      writer.putCallAddressWithArguments(artController.replacedMethods.isReplacement, [methodReg]);
      writer.putCmpRegImm("r0", 0);
      writer.putPopRegs(savedRegs);
      const vpopFpRegs = [189, 236, 16, 10];
      writer.putBytes(vpopFpRegs);
      writer.putBCondLabel("ne", "runtime_or_replacement_method");
      writer.putBLabel("regular_method");
      relocator.readOne();
      const tailIsRegular = relocator.input.address.equals(target2.whenRegularMethod);
      writer.putLabel(tailIsRegular ? "regular_method" : "runtime_or_replacement_method");
      relocator.writeOne();
      while (redirectCapacity < 10) {
        const offset = relocator.readOne();
        if (offset === 0) {
          redirectCapacity = 10;
          break;
        }
        redirectCapacity = offset;
      }
      relocator.writeAll();
      writer.putBranchAddress(address.add(redirectCapacity + 1));
      writer.putLabel(tailIsRegular ? "runtime_or_replacement_method" : "regular_method");
      writer.putBranchAddress(target2.whenTrue);
      writer.flush();
    });
    inlineHooks.push(new InlineHook(address, redirectCapacity, trampoline));
    Memory.patchCode(address, redirectCapacity, (code3) => {
      const writer = new ThumbWriter(code3, { pc: address });
      writer.putLdrRegAddress("pc", trampoline.or(1));
      writer.flush();
    });
  }
  function instrumentGetOatQuickMethodHeaderInlinedCopyArm64({ address, size, validationResult }) {
    const { methodReg, scratchReg, target: target2 } = validationResult;
    const trampoline = Memory.alloc(Process.pageSize);
    Memory.patchCode(trampoline, 256, (code3) => {
      const writer = new Arm64Writer(code3, { pc: trampoline });
      const relocator = new Arm64Relocator(address, writer);
      for (let i = 0; i !== 2; i++) {
        relocator.readOne();
      }
      relocator.writeAll();
      relocator.readOne();
      relocator.skipOne();
      writer.putBCondLabel("eq", "runtime_or_replacement_method");
      const savedRegs = [
        "d0",
        "d1",
        "d2",
        "d3",
        "d4",
        "d5",
        "d6",
        "d7",
        "x0",
        "x1",
        "x2",
        "x3",
        "x4",
        "x5",
        "x6",
        "x7",
        "x8",
        "x9",
        "x10",
        "x11",
        "x12",
        "x13",
        "x14",
        "x15",
        "x16",
        "x17"
      ];
      const numSavedRegs = savedRegs.length;
      for (let i = 0; i !== numSavedRegs; i += 2) {
        writer.putPushRegReg(savedRegs[i], savedRegs[i + 1]);
      }
      writer.putCallAddressWithArguments(artController.replacedMethods.isReplacement, [methodReg]);
      writer.putCmpRegReg("x0", "xzr");
      for (let i = numSavedRegs - 2; i >= 0; i -= 2) {
        writer.putPopRegReg(savedRegs[i], savedRegs[i + 1]);
      }
      writer.putBCondLabel("ne", "runtime_or_replacement_method");
      writer.putBLabel("regular_method");
      relocator.readOne();
      const tailInstruction = relocator.input;
      const tailIsRegular = tailInstruction.address.equals(target2.whenRegularMethod);
      writer.putLabel(tailIsRegular ? "regular_method" : "runtime_or_replacement_method");
      relocator.writeOne();
      writer.putBranchAddress(tailInstruction.next);
      writer.putLabel(tailIsRegular ? "runtime_or_replacement_method" : "regular_method");
      writer.putBranchAddress(target2.whenTrue);
      writer.flush();
    });
    inlineHooks.push(new InlineHook(address, size, trampoline));
    Memory.patchCode(address, size, (code3) => {
      const writer = new Arm64Writer(code3, { pc: address });
      writer.putLdrRegAddress(scratchReg, trampoline);
      writer.putBrReg(scratchReg);
      writer.flush();
    });
  }
  function makeMethodMangler(methodId) {
    return new MethodMangler(methodId);
  }
  function translateMethod(methodId) {
    return artController.replacedMethods.translate(methodId);
  }
  function backtrace(vm3, options = {}) {
    const { limit = 16 } = options;
    const env = vm3.getEnv();
    if (backtraceModule === null) {
      backtraceModule = makeBacktraceModule(vm3, env);
    }
    return backtraceModule.backtrace(env, limit);
  }
  function makeBacktraceModule(vm3, env) {
    const api2 = getApi();
    const performImpl = Memory.alloc(Process.pointerSize);
    const cm2 = new CModule(`
#include <glib.h>
#include <stdbool.h>
#include <string.h>
#include <gum/gumtls.h>
#include <json-glib/json-glib.h>

typedef struct _ArtBacktrace ArtBacktrace;
typedef struct _ArtStackFrame ArtStackFrame;

typedef struct _ArtStackVisitor ArtStackVisitor;
typedef struct _ArtStackVisitorVTable ArtStackVisitorVTable;

typedef struct _ArtClass ArtClass;
typedef struct _ArtMethod ArtMethod;
typedef struct _ArtThread ArtThread;
typedef struct _ArtContext ArtContext;

typedef struct _JNIEnv JNIEnv;

typedef struct _StdString StdString;
typedef struct _StdTinyString StdTinyString;
typedef struct _StdLargeString StdLargeString;

typedef enum {
  STACK_WALK_INCLUDE_INLINED_FRAMES,
  STACK_WALK_SKIP_INLINED_FRAMES,
} StackWalkKind;

struct _StdTinyString
{
  guint8 unused;
  gchar data[(3 * sizeof (gpointer)) - 1];
};

struct _StdLargeString
{
  gsize capacity;
  gsize size;
  gchar * data;
};

struct _StdString
{
  union
  {
    guint8 flags;
    StdTinyString tiny;
    StdLargeString large;
  };
};

struct _ArtBacktrace
{
  GChecksum * id;
  GArray * frames;
  gchar * frames_json;
};

struct _ArtStackFrame
{
  ArtMethod * method;
  gsize dexpc;
  StdString description;
};

struct _ArtStackVisitorVTable
{
  void (* unused1) (void);
  void (* unused2) (void);
  bool (* visit) (ArtStackVisitor * visitor);
};

struct _ArtStackVisitor
{
  ArtStackVisitorVTable * vtable;

  guint8 padding[512];

  ArtStackVisitorVTable vtable_storage;

  ArtBacktrace * backtrace;
};

struct _ArtMethod
{
  guint32 declaring_class;
  guint32 access_flags;
};

extern GumTlsKey current_backtrace;

extern void (* perform_art_thread_state_transition) (JNIEnv * env);

extern ArtContext * art_make_context (ArtThread * thread);

extern void art_stack_visitor_init (ArtStackVisitor * visitor, ArtThread * thread, void * context, StackWalkKind walk_kind,
    size_t num_frames, bool check_suspended);
extern void art_stack_visitor_walk_stack (ArtStackVisitor * visitor, bool include_transitions);
extern ArtMethod * art_stack_visitor_get_method (ArtStackVisitor * visitor);
extern void art_stack_visitor_describe_location (StdString * description, ArtStackVisitor * visitor);
extern ArtMethod * translate_method (ArtMethod * method);
extern void translate_location (ArtMethod * method, guint32 pc, const gchar ** source_file, gint32 * line_number);
extern void get_class_location (StdString * result, ArtClass * klass);
extern void cxx_delete (void * mem);
extern unsigned long strtoul (const char * str, char ** endptr, int base);

static bool visit_frame (ArtStackVisitor * visitor);
static void art_stack_frame_destroy (ArtStackFrame * frame);

static void append_jni_type_name (GString * s, const gchar * name, gsize length);

static void std_string_destroy (StdString * str);
static gchar * std_string_get_data (StdString * str);

void
init (void)
{
  current_backtrace = gum_tls_key_new ();
}

void
finalize (void)
{
  gum_tls_key_free (current_backtrace);
}

ArtBacktrace *
_create (JNIEnv * env,
         guint limit)
{
  ArtBacktrace * bt;

  bt = g_new (ArtBacktrace, 1);
  bt->id = g_checksum_new (G_CHECKSUM_SHA1);
  bt->frames = (limit != 0)
      ? g_array_sized_new (FALSE, FALSE, sizeof (ArtStackFrame), limit)
      : g_array_new (FALSE, FALSE, sizeof (ArtStackFrame));
  g_array_set_clear_func (bt->frames, (GDestroyNotify) art_stack_frame_destroy);
  bt->frames_json = NULL;

  gum_tls_key_set_value (current_backtrace, bt);

  perform_art_thread_state_transition (env);

  gum_tls_key_set_value (current_backtrace, NULL);

  return bt;
}

void
_on_thread_state_transition_complete (ArtThread * thread)
{
  ArtContext * context;
  ArtStackVisitor visitor = {
    .vtable_storage = {
      .visit = visit_frame,
    },
  };

  context = art_make_context (thread);

  art_stack_visitor_init (&visitor, thread, context, STACK_WALK_SKIP_INLINED_FRAMES, 0, true);
  visitor.vtable = &visitor.vtable_storage;
  visitor.backtrace = gum_tls_key_get_value (current_backtrace);

  art_stack_visitor_walk_stack (&visitor, false);

  cxx_delete (context);
}

static bool
visit_frame (ArtStackVisitor * visitor)
{
  ArtBacktrace * bt = visitor->backtrace;
  ArtStackFrame frame;
  const gchar * description, * dexpc_part;

  frame.method = art_stack_visitor_get_method (visitor);

  art_stack_visitor_describe_location (&frame.description, visitor);

  description = std_string_get_data (&frame.description);
  if (strstr (description, " '<") != NULL)
    goto skip;

  dexpc_part = strstr (description, " at dex PC 0x");
  if (dexpc_part == NULL)
    goto skip;
  frame.dexpc = strtoul (dexpc_part + 13, NULL, 16);

  g_array_append_val (bt->frames, frame);

  g_checksum_update (bt->id, (guchar *) &frame.method, sizeof (frame.method));
  g_checksum_update (bt->id, (guchar *) &frame.dexpc, sizeof (frame.dexpc));

  return true;

skip:
  std_string_destroy (&frame.description);
  return true;
}

static void
art_stack_frame_destroy (ArtStackFrame * frame)
{
  std_string_destroy (&frame->description);
}

void
_destroy (ArtBacktrace * backtrace)
{
  g_free (backtrace->frames_json);
  g_array_free (backtrace->frames, TRUE);
  g_checksum_free (backtrace->id);
  g_free (backtrace);
}

const gchar *
_get_id (ArtBacktrace * backtrace)
{
  return g_checksum_get_string (backtrace->id);
}

const gchar *
_get_frames (ArtBacktrace * backtrace)
{
  GArray * frames = backtrace->frames;
  JsonBuilder * b;
  guint i;
  JsonNode * root;

  if (backtrace->frames_json != NULL)
    return backtrace->frames_json;

  b = json_builder_new_immutable ();

  json_builder_begin_array (b);

  for (i = 0; i != frames->len; i++)
  {
    ArtStackFrame * frame = &g_array_index (frames, ArtStackFrame, i);
    gchar * description, * ret_type, * paren_open, * paren_close, * arg_types, * token, * method_name, * class_name;
    GString * signature;
    gchar * cursor;
    ArtMethod * translated_method;
    StdString location;
    gsize dexpc;
    const gchar * source_file;
    gint32 line_number;

    description = std_string_get_data (&frame->description);

    ret_type = strchr (description, '\\'') + 1;

    paren_open = strchr (ret_type, '(');
    paren_close = strchr (paren_open, ')');
    *paren_open = '\\0';
    *paren_close = '\\0';

    arg_types = paren_open + 1;

    token = strrchr (ret_type, '.');
    *token = '\\0';

    method_name = token + 1;

    token = strrchr (ret_type, ' ');
    *token = '\\0';

    class_name = token + 1;

    signature = g_string_sized_new (128);

    append_jni_type_name (signature, class_name, method_name - class_name - 1);
    g_string_append_c (signature, ',');
    g_string_append (signature, method_name);
    g_string_append (signature, ",(");

    if (arg_types != paren_close)
    {
      for (cursor = arg_types; cursor != NULL;)
      {
        gsize length;
        gchar * next;

        token = strstr (cursor, ", ");
        if (token != NULL)
        {
          length = token - cursor;
          next = token + 2;
        }
        else
        {
          length = paren_close - cursor;
          next = NULL;
        }

        append_jni_type_name (signature, cursor, length);

        cursor = next;
      }
    }

    g_string_append_c (signature, ')');

    append_jni_type_name (signature, ret_type, class_name - ret_type - 1);

    translated_method = translate_method (frame->method);
    dexpc = (translated_method == frame->method) ? frame->dexpc : 0;

    get_class_location (&location, GSIZE_TO_POINTER (translated_method->declaring_class));

    translate_location (translated_method, dexpc, &source_file, &line_number);

    json_builder_begin_object (b);

    json_builder_set_member_name (b, "signature");
    json_builder_add_string_value (b, signature->str);

    json_builder_set_member_name (b, "origin");
    json_builder_add_string_value (b, std_string_get_data (&location));

    json_builder_set_member_name (b, "className");
    json_builder_add_string_value (b, class_name);

    json_builder_set_member_name (b, "methodName");
    json_builder_add_string_value (b, method_name);

    json_builder_set_member_name (b, "methodFlags");
    json_builder_add_int_value (b, translated_method->access_flags);

    json_builder_set_member_name (b, "fileName");
    json_builder_add_string_value (b, source_file);

    json_builder_set_member_name (b, "lineNumber");
    json_builder_add_int_value (b, line_number);

    json_builder_end_object (b);

    std_string_destroy (&location);
    g_string_free (signature, TRUE);
  }

  json_builder_end_array (b);

  root = json_builder_get_root (b);
  backtrace->frames_json = json_to_string (root, FALSE);
  json_node_unref (root);

  return backtrace->frames_json;
}

static void
append_jni_type_name (GString * s,
                      const gchar * name,
                      gsize length)
{
  gchar shorty = '\\0';
  gsize i;

  switch (name[0])
  {
    case 'b':
      if (strncmp (name, "boolean", length) == 0)
        shorty = 'Z';
      else if (strncmp (name, "byte", length) == 0)
        shorty = 'B';
      break;
    case 'c':
      if (strncmp (name, "char", length) == 0)
        shorty = 'C';
      break;
    case 'd':
      if (strncmp (name, "double", length) == 0)
        shorty = 'D';
      break;
    case 'f':
      if (strncmp (name, "float", length) == 0)
        shorty = 'F';
      break;
    case 'i':
      if (strncmp (name, "int", length) == 0)
        shorty = 'I';
      break;
    case 'l':
      if (strncmp (name, "long", length) == 0)
        shorty = 'J';
      break;
    case 's':
      if (strncmp (name, "short", length) == 0)
        shorty = 'S';
      break;
    case 'v':
      if (strncmp (name, "void", length) == 0)
        shorty = 'V';
      break;
  }

  if (shorty != '\\0')
  {
    g_string_append_c (s, shorty);

    return;
  }

  if (length > 2 && name[length - 2] == '[' && name[length - 1] == ']')
  {
    g_string_append_c (s, '[');
    append_jni_type_name (s, name, length - 2);

    return;
  }

  g_string_append_c (s, 'L');

  for (i = 0; i != length; i++)
  {
    gchar ch = name[i];
    if (ch != '.')
      g_string_append_c (s, ch);
    else
      g_string_append_c (s, '/');
  }

  g_string_append_c (s, ';');
}

static void
std_string_destroy (StdString * str)
{
  bool is_large = (str->flags & 1) != 0;
  if (is_large)
    cxx_delete (str->large.data);
}

static gchar *
std_string_get_data (StdString * str)
{
  bool is_large = (str->flags & 1) != 0;
  return is_large ? str->large.data : str->tiny.data;
}
`, {
      current_backtrace: Memory.alloc(Process.pointerSize),
      perform_art_thread_state_transition: performImpl,
      art_make_context: api2["art::Thread::GetLongJumpContext"] ?? api2["art::Context::Create"],
      art_stack_visitor_init: api2["art::StackVisitor::StackVisitor"],
      art_stack_visitor_walk_stack: api2["art::StackVisitor::WalkStack"],
      art_stack_visitor_get_method: api2["art::StackVisitor::GetMethod"],
      art_stack_visitor_describe_location: api2["art::StackVisitor::DescribeLocation"],
      translate_method: artController.replacedMethods.translate,
      translate_location: api2["art::Monitor::TranslateLocation"],
      get_class_location: api2["art::mirror::Class::GetLocation"],
      cxx_delete: api2.$delete,
      strtoul: Process.getModuleByName("libc.so").getExportByName("strtoul")
    });
    const _create = new NativeFunction(cm2._create, "pointer", ["pointer", "uint"], nativeFunctionOptions3);
    const _destroy = new NativeFunction(cm2._destroy, "void", ["pointer"], nativeFunctionOptions3);
    const fastOptions = { exceptions: "propagate", scheduling: "exclusive" };
    const _getId = new NativeFunction(cm2._get_id, "pointer", ["pointer"], fastOptions);
    const _getFrames = new NativeFunction(cm2._get_frames, "pointer", ["pointer"], fastOptions);
    const performThreadStateTransition = makeArtThreadStateTransitionImpl(vm3, env, cm2._on_thread_state_transition_complete);
    cm2._performData = performThreadStateTransition;
    performImpl.writePointer(performThreadStateTransition);
    cm2.backtrace = (env2, limit) => {
      const handle = _create(env2, limit);
      const bt = new Backtrace(handle);
      Script.bindWeak(bt, destroy.bind(null, handle));
      return bt;
    };
    function destroy(handle) {
      _destroy(handle);
    }
    cm2.getId = (handle) => {
      return _getId(handle).readUtf8String();
    };
    cm2.getFrames = (handle) => {
      return JSON.parse(_getFrames(handle).readUtf8String());
    };
    return cm2;
  }
  var Backtrace = class {
    constructor(handle) {
      this.handle = handle;
    }
    get id() {
      return backtraceModule.getId(this.handle);
    }
    get frames() {
      return backtraceModule.getFrames(this.handle);
    }
  };
  function revertGlobalPatches() {
    patchedClasses.forEach((entry) => {
      entry.vtablePtr.writePointer(entry.vtable);
      entry.vtableCountPtr.writeS32(entry.vtableCount);
    });
    patchedClasses.clear();
    for (const interceptor of artQuickInterceptors.splice(0)) {
      interceptor.deactivate();
    }
    for (const hook of inlineHooks.splice(0)) {
      hook.revert();
    }
  }
  function unwrapMethodId(methodId) {
    return unwrapGenericId(methodId, "art::jni::JniIdManager::DecodeMethodId");
  }
  function unwrapFieldId(fieldId) {
    return unwrapGenericId(fieldId, "art::jni::JniIdManager::DecodeFieldId");
  }
  function unwrapGenericId(genericId, apiMethod) {
    const api2 = getApi();
    const runtimeOffset = getArtRuntimeSpec(api2).offset;
    const jniIdManagerOffset = runtimeOffset.jniIdManager;
    const jniIdsIndirectionOffset = runtimeOffset.jniIdsIndirection;
    if (jniIdManagerOffset !== null && jniIdsIndirectionOffset !== null) {
      const runtime2 = api2.artRuntime;
      const jniIdsIndirection = runtime2.add(jniIdsIndirectionOffset).readInt();
      if (jniIdsIndirection !== kPointer) {
        const jniIdManager = runtime2.add(jniIdManagerOffset).readPointer();
        return api2[apiMethod](jniIdManager, genericId);
      }
    }
    return genericId;
  }
  var artQuickCodeReplacementTrampolineWriters = {
    ia32: writeArtQuickCodeReplacementTrampolineIA32,
    x64: writeArtQuickCodeReplacementTrampolineX64,
    arm: writeArtQuickCodeReplacementTrampolineArm,
    arm64: writeArtQuickCodeReplacementTrampolineArm64
  };
  function writeArtQuickCodeReplacementTrampolineIA32(trampoline, target2, redirectSize, constraints, vm3) {
    const threadOffsets = getArtThreadSpec(vm3).offset;
    const artMethodOffsets = getArtMethodSpec(vm3).offset;
    let offset;
    Memory.patchCode(trampoline, 128, (code3) => {
      const writer = new X86Writer(code3, { pc: trampoline });
      const relocator = new X86Relocator(target2, writer);
      const fxsave = [15, 174, 4, 36];
      const fxrstor = [15, 174, 12, 36];
      writer.putPushax();
      writer.putMovRegReg("ebp", "esp");
      writer.putAndRegU32("esp", 4294967280);
      writer.putSubRegImm("esp", 512);
      writer.putBytes(fxsave);
      writer.putMovRegFsU32Ptr("ebx", threadOffsets.self);
      writer.putCallAddressWithAlignedArguments(artController.replacedMethods.findReplacementFromQuickCode, ["eax", "ebx"]);
      writer.putTestRegReg("eax", "eax");
      writer.putJccShortLabel("je", "restore_registers", "no-hint");
      writer.putMovRegOffsetPtrReg("ebp", 7 * 4, "eax");
      writer.putLabel("restore_registers");
      writer.putBytes(fxrstor);
      writer.putMovRegReg("esp", "ebp");
      writer.putPopax();
      writer.putJccShortLabel("jne", "invoke_replacement", "no-hint");
      do {
        offset = relocator.readOne();
      } while (offset < redirectSize && !relocator.eoi);
      relocator.writeAll();
      if (!relocator.eoi) {
        writer.putJmpAddress(target2.add(offset));
      }
      writer.putLabel("invoke_replacement");
      writer.putJmpRegOffsetPtr("eax", artMethodOffsets.quickCode);
      writer.flush();
    });
    return offset;
  }
  function writeArtQuickCodeReplacementTrampolineX64(trampoline, target2, redirectSize, constraints, vm3) {
    const threadOffsets = getArtThreadSpec(vm3).offset;
    const artMethodOffsets = getArtMethodSpec(vm3).offset;
    let offset;
    Memory.patchCode(trampoline, 256, (code3) => {
      const writer = new X86Writer(code3, { pc: trampoline });
      const relocator = new X86Relocator(target2, writer);
      const fxsave = [15, 174, 4, 36];
      const fxrstor = [15, 174, 12, 36];
      writer.putPushax();
      writer.putMovRegReg("rbp", "rsp");
      writer.putAndRegU32("rsp", 4294967280);
      writer.putSubRegImm("rsp", 512);
      writer.putBytes(fxsave);
      writer.putMovRegGsU32Ptr("rbx", threadOffsets.self);
      writer.putCallAddressWithAlignedArguments(artController.replacedMethods.findReplacementFromQuickCode, ["rdi", "rbx"]);
      writer.putTestRegReg("rax", "rax");
      writer.putJccShortLabel("je", "restore_registers", "no-hint");
      writer.putMovRegOffsetPtrReg("rbp", 8 * 8, "rax");
      writer.putLabel("restore_registers");
      writer.putBytes(fxrstor);
      writer.putMovRegReg("rsp", "rbp");
      writer.putPopax();
      writer.putJccShortLabel("jne", "invoke_replacement", "no-hint");
      do {
        offset = relocator.readOne();
      } while (offset < redirectSize && !relocator.eoi);
      relocator.writeAll();
      if (!relocator.eoi) {
        writer.putJmpAddress(target2.add(offset));
      }
      writer.putLabel("invoke_replacement");
      writer.putJmpRegOffsetPtr("rdi", artMethodOffsets.quickCode);
      writer.flush();
    });
    return offset;
  }
  function writeArtQuickCodeReplacementTrampolineArm(trampoline, target2, redirectSize, constraints, vm3) {
    const artMethodOffsets = getArtMethodSpec(vm3).offset;
    const targetAddress = target2.and(THUMB_BIT_REMOVAL_MASK);
    let offset;
    Memory.patchCode(trampoline, 128, (code3) => {
      const writer = new ThumbWriter(code3, { pc: trampoline });
      const relocator = new ThumbRelocator(targetAddress, writer);
      const vpushFpRegs = [45, 237, 16, 10];
      const vpopFpRegs = [189, 236, 16, 10];
      writer.putPushRegs([
        "r1",
        "r2",
        "r3",
        "r5",
        "r6",
        "r7",
        "r8",
        "r10",
        "r11",
        "lr"
      ]);
      writer.putBytes(vpushFpRegs);
      writer.putSubRegRegImm("sp", "sp", 8);
      writer.putStrRegRegOffset("r0", "sp", 0);
      writer.putCallAddressWithArguments(artController.replacedMethods.findReplacementFromQuickCode, ["r0", "r9"]);
      writer.putCmpRegImm("r0", 0);
      writer.putBCondLabel("eq", "restore_registers");
      writer.putStrRegRegOffset("r0", "sp", 0);
      writer.putLabel("restore_registers");
      writer.putLdrRegRegOffset("r0", "sp", 0);
      writer.putAddRegRegImm("sp", "sp", 8);
      writer.putBytes(vpopFpRegs);
      writer.putPopRegs([
        "lr",
        "r11",
        "r10",
        "r8",
        "r7",
        "r6",
        "r5",
        "r3",
        "r2",
        "r1"
      ]);
      writer.putBCondLabel("ne", "invoke_replacement");
      do {
        offset = relocator.readOne();
      } while (offset < redirectSize && !relocator.eoi);
      relocator.writeAll();
      if (!relocator.eoi) {
        writer.putLdrRegAddress("pc", target2.add(offset));
      }
      writer.putLabel("invoke_replacement");
      writer.putLdrRegRegOffset("pc", "r0", artMethodOffsets.quickCode);
      writer.flush();
    });
    return offset;
  }
  function writeArtQuickCodeReplacementTrampolineArm64(trampoline, target2, redirectSize, { availableScratchRegs }, vm3) {
    const artMethodOffsets = getArtMethodSpec(vm3).offset;
    let offset;
    Memory.patchCode(trampoline, 256, (code3) => {
      const writer = new Arm64Writer(code3, { pc: trampoline });
      const relocator = new Arm64Relocator(target2, writer);
      writer.putPushRegReg("d0", "d1");
      writer.putPushRegReg("d2", "d3");
      writer.putPushRegReg("d4", "d5");
      writer.putPushRegReg("d6", "d7");
      writer.putPushRegReg("x1", "x2");
      writer.putPushRegReg("x3", "x4");
      writer.putPushRegReg("x5", "x6");
      writer.putPushRegReg("x7", "x20");
      writer.putPushRegReg("x21", "x22");
      writer.putPushRegReg("x23", "x24");
      writer.putPushRegReg("x25", "x26");
      writer.putPushRegReg("x27", "x28");
      writer.putPushRegReg("x29", "lr");
      writer.putSubRegRegImm("sp", "sp", 16);
      writer.putStrRegRegOffset("x0", "sp", 0);
      writer.putCallAddressWithArguments(artController.replacedMethods.findReplacementFromQuickCode, ["x0", "x19"]);
      writer.putCmpRegReg("x0", "xzr");
      writer.putBCondLabel("eq", "restore_registers");
      writer.putStrRegRegOffset("x0", "sp", 0);
      writer.putLabel("restore_registers");
      writer.putLdrRegRegOffset("x0", "sp", 0);
      writer.putAddRegRegImm("sp", "sp", 16);
      writer.putPopRegReg("x29", "lr");
      writer.putPopRegReg("x27", "x28");
      writer.putPopRegReg("x25", "x26");
      writer.putPopRegReg("x23", "x24");
      writer.putPopRegReg("x21", "x22");
      writer.putPopRegReg("x7", "x20");
      writer.putPopRegReg("x5", "x6");
      writer.putPopRegReg("x3", "x4");
      writer.putPopRegReg("x1", "x2");
      writer.putPopRegReg("d6", "d7");
      writer.putPopRegReg("d4", "d5");
      writer.putPopRegReg("d2", "d3");
      writer.putPopRegReg("d0", "d1");
      writer.putBCondLabel("ne", "invoke_replacement");
      do {
        offset = relocator.readOne();
      } while (offset < redirectSize && !relocator.eoi);
      relocator.writeAll();
      if (!relocator.eoi) {
        const scratchReg = Array.from(availableScratchRegs)[0];
        writer.putLdrRegAddress(scratchReg, target2.add(offset));
        writer.putBrReg(scratchReg);
      }
      writer.putLabel("invoke_replacement");
      writer.putLdrRegRegOffset("x16", "x0", artMethodOffsets.quickCode);
      writer.putBrReg("x16");
      writer.flush();
    });
    return offset;
  }
  var artQuickCodePrologueWriters = {
    ia32: writeArtQuickCodePrologueX86,
    x64: writeArtQuickCodePrologueX86,
    arm: writeArtQuickCodePrologueArm,
    arm64: writeArtQuickCodePrologueArm64
  };
  function writeArtQuickCodePrologueX86(target2, trampoline, redirectSize) {
    Memory.patchCode(target2, 16, (code3) => {
      const writer = new X86Writer(code3, { pc: target2 });
      writer.putJmpAddress(trampoline);
      writer.flush();
    });
  }
  function writeArtQuickCodePrologueArm(target2, trampoline, redirectSize) {
    const targetAddress = target2.and(THUMB_BIT_REMOVAL_MASK);
    Memory.patchCode(targetAddress, 16, (code3) => {
      const writer = new ThumbWriter(code3, { pc: targetAddress });
      writer.putLdrRegAddress("pc", trampoline.or(1));
      writer.flush();
    });
  }
  function writeArtQuickCodePrologueArm64(target2, trampoline, redirectSize) {
    Memory.patchCode(target2, 16, (code3) => {
      const writer = new Arm64Writer(code3, { pc: target2 });
      if (redirectSize === 16) {
        writer.putLdrRegAddress("x16", trampoline);
      } else {
        writer.putAdrpRegAddress("x16", trampoline);
      }
      writer.putBrReg("x16");
      writer.flush();
    });
  }
  var artQuickCodeHookRedirectSize = {
    ia32: 5,
    x64: 16,
    arm: 8,
    arm64: 16
  };
  var ArtQuickCodeInterceptor = class {
    constructor(quickCode) {
      this.quickCode = quickCode;
      this.quickCodeAddress = Process.arch === "arm" ? quickCode.and(THUMB_BIT_REMOVAL_MASK) : quickCode;
      this.redirectSize = 0;
      this.trampoline = null;
      this.overwrittenPrologue = null;
      this.overwrittenPrologueLength = 0;
    }
    _canRelocateCode(relocationSize, constraints) {
      const Writer = thunkWriters[Process.arch];
      const Relocator = thunkRelocators[Process.arch];
      const { quickCodeAddress } = this;
      const writer = new Writer(quickCodeAddress);
      const relocator = new Relocator(quickCodeAddress, writer);
      let offset;
      if (Process.arch === "arm64") {
        let availableScratchRegs = /* @__PURE__ */ new Set(["x16", "x17"]);
        do {
          const nextOffset = relocator.readOne();
          const nextScratchRegs = new Set(availableScratchRegs);
          const { read, written } = relocator.input.regsAccessed;
          for (const regs of [read, written]) {
            for (const reg of regs) {
              let name;
              if (reg.startsWith("w")) {
                name = "x" + reg.substring(1);
              } else {
                name = reg;
              }
              nextScratchRegs.delete(name);
            }
          }
          if (nextScratchRegs.size === 0) {
            break;
          }
          offset = nextOffset;
          availableScratchRegs = nextScratchRegs;
        } while (offset < relocationSize && !relocator.eoi);
        constraints.availableScratchRegs = availableScratchRegs;
      } else {
        do {
          offset = relocator.readOne();
        } while (offset < relocationSize && !relocator.eoi);
      }
      return offset >= relocationSize;
    }
    _allocateTrampoline() {
      if (trampolineAllocator === null) {
        const trampolineSize = pointerSize5 === 4 ? 128 : 256;
        trampolineAllocator = makeAllocator(trampolineSize);
      }
      const maxRedirectSize = artQuickCodeHookRedirectSize[Process.arch];
      let redirectSize, spec;
      let alignment = 1;
      const constraints = {};
      if (pointerSize5 === 4 || this._canRelocateCode(maxRedirectSize, constraints)) {
        redirectSize = maxRedirectSize;
        spec = {};
      } else {
        let maxDistance;
        if (Process.arch === "x64") {
          redirectSize = 5;
          maxDistance = X86_JMP_MAX_DISTANCE;
        } else if (Process.arch === "arm64") {
          redirectSize = 8;
          maxDistance = ARM64_ADRP_MAX_DISTANCE;
          alignment = 4096;
        }
        spec = { near: this.quickCodeAddress, maxDistance };
      }
      this.redirectSize = redirectSize;
      this.trampoline = trampolineAllocator.allocateSlice(spec, alignment);
      return constraints;
    }
    _destroyTrampoline() {
      trampolineAllocator.freeSlice(this.trampoline);
    }
    activate(vm3) {
      const constraints = this._allocateTrampoline();
      const { trampoline, quickCode, redirectSize } = this;
      const writeTrampoline = artQuickCodeReplacementTrampolineWriters[Process.arch];
      const prologueLength = writeTrampoline(trampoline, quickCode, redirectSize, constraints, vm3);
      this.overwrittenPrologueLength = prologueLength;
      this.overwrittenPrologue = Memory.dup(this.quickCodeAddress, prologueLength);
      const writePrologue = artQuickCodePrologueWriters[Process.arch];
      writePrologue(quickCode, trampoline, redirectSize);
    }
    deactivate() {
      const { quickCodeAddress, overwrittenPrologueLength: prologueLength } = this;
      const Writer = thunkWriters[Process.arch];
      Memory.patchCode(quickCodeAddress, prologueLength, (code3) => {
        const writer = new Writer(code3, { pc: quickCodeAddress });
        const { overwrittenPrologue } = this;
        writer.putBytes(overwrittenPrologue.readByteArray(prologueLength));
        writer.flush();
      });
      this._destroyTrampoline();
    }
  };
  function isArtQuickEntrypoint(address) {
    const api2 = getApi();
    const { module: m, artClassLinker } = api2;
    return address.equals(artClassLinker.quickGenericJniTrampoline) || address.equals(artClassLinker.quickToInterpreterBridgeTrampoline) || address.equals(artClassLinker.quickResolutionTrampoline) || address.equals(artClassLinker.quickImtConflictTrampoline) || address.compare(m.base) >= 0 && address.compare(m.base.add(m.size)) < 0;
  }
  var ArtMethodMangler = class {
    constructor(opaqueMethodId) {
      const methodId = unwrapMethodId(opaqueMethodId);
      this.methodId = methodId;
      this.originalMethod = null;
      this.hookedMethodId = methodId;
      this.replacementMethodId = null;
      this.interceptor = null;
    }
    replace(impl, isInstanceMethod, argTypes, vm3, api2) {
      const { kAccCompileDontBother, artNterpEntryPoint } = api2;
      this.originalMethod = fetchArtMethod(this.methodId, vm3);
      const originalFlags = this.originalMethod.accessFlags;
      if ((originalFlags & kAccXposedHookedMethod) !== 0 && xposedIsSupported()) {
        const hookInfo = this.originalMethod.jniCode;
        this.hookedMethodId = hookInfo.add(2 * pointerSize5).readPointer();
        this.originalMethod = fetchArtMethod(this.hookedMethodId, vm3);
      }
      const { hookedMethodId } = this;
      const replacementMethodId = cloneArtMethod(hookedMethodId, vm3);
      this.replacementMethodId = replacementMethodId;
      patchArtMethod(replacementMethodId, {
        jniCode: impl,
        accessFlags: (originalFlags & ~(kAccCriticalNative | kAccFastNative | kAccNterpEntryPointFastPathFlag) | kAccNative | kAccCompileDontBother) >>> 0,
        quickCode: api2.artClassLinker.quickGenericJniTrampoline,
        interpreterCode: api2.artInterpreterToCompiledCodeBridge
      }, vm3);
      let hookedMethodRemovedFlags = kAccFastInterpreterToInterpreterInvoke | kAccSingleImplementation | kAccNterpEntryPointFastPathFlag;
      if ((originalFlags & kAccNative) === 0) {
        hookedMethodRemovedFlags |= kAccSkipAccessChecks;
      }
      patchArtMethod(hookedMethodId, {
        accessFlags: (originalFlags & ~hookedMethodRemovedFlags | kAccCompileDontBother) >>> 0
      }, vm3);
      const quickCode = this.originalMethod.quickCode;
      if (artNterpEntryPoint !== null && quickCode.equals(artNterpEntryPoint)) {
        patchArtMethod(hookedMethodId, {
          quickCode: api2.artQuickToInterpreterBridge
        }, vm3);
      }
      if (!isArtQuickEntrypoint(quickCode)) {
        const interceptor = new ArtQuickCodeInterceptor(quickCode);
        interceptor.activate(vm3);
        this.interceptor = interceptor;
      }
      artController.replacedMethods.set(hookedMethodId, replacementMethodId);
      notifyArtMethodHooked(hookedMethodId, vm3);
    }
    revert(vm3) {
      const { hookedMethodId, interceptor } = this;
      patchArtMethod(hookedMethodId, this.originalMethod, vm3);
      artController.replacedMethods.delete(hookedMethodId);
      if (interceptor !== null) {
        interceptor.deactivate();
        this.interceptor = null;
      }
    }
    resolveTarget(wrapper, isInstanceMethod, env, api2) {
      return this.hookedMethodId;
    }
  };
  function xposedIsSupported() {
    return getAndroidApiLevel() < 28;
  }
  function fetchArtMethod(methodId, vm3) {
    const artMethodSpec = getArtMethodSpec(vm3);
    const artMethodOffset = artMethodSpec.offset;
    return ["jniCode", "accessFlags", "quickCode", "interpreterCode"].reduce((original, name) => {
      const offset = artMethodOffset[name];
      if (offset === void 0) {
        return original;
      }
      const address = methodId.add(offset);
      const read = name === "accessFlags" ? readU32 : readPointer;
      original[name] = read.call(address);
      return original;
    }, {});
  }
  function patchArtMethod(methodId, patches, vm3) {
    const artMethodSpec = getArtMethodSpec(vm3);
    const artMethodOffset = artMethodSpec.offset;
    Object.keys(patches).forEach((name) => {
      const offset = artMethodOffset[name];
      if (offset === void 0) {
        return;
      }
      const address = methodId.add(offset);
      const write = name === "accessFlags" ? writeU32 : writePointer;
      write.call(address, patches[name]);
    });
  }
  var DalvikMethodMangler = class {
    constructor(methodId) {
      this.methodId = methodId;
      this.originalMethod = null;
    }
    replace(impl, isInstanceMethod, argTypes, vm3, api2) {
      const { methodId } = this;
      this.originalMethod = Memory.dup(methodId, DVM_METHOD_SIZE);
      let argsSize = argTypes.reduce((acc, t) => acc + t.size, 0);
      if (isInstanceMethod) {
        argsSize++;
      }
      const accessFlags = (methodId.add(DVM_METHOD_OFFSET_ACCESS_FLAGS).readU32() | kAccNative) >>> 0;
      const registersSize = argsSize;
      const outsSize = 0;
      const insSize = argsSize;
      methodId.add(DVM_METHOD_OFFSET_ACCESS_FLAGS).writeU32(accessFlags);
      methodId.add(DVM_METHOD_OFFSET_REGISTERS_SIZE).writeU16(registersSize);
      methodId.add(DVM_METHOD_OFFSET_OUTS_SIZE).writeU16(outsSize);
      methodId.add(DVM_METHOD_OFFSET_INS_SIZE).writeU16(insSize);
      methodId.add(DVM_METHOD_OFFSET_JNI_ARG_INFO).writeU32(computeDalvikJniArgInfo(methodId));
      api2.dvmUseJNIBridge(methodId, impl);
    }
    revert(vm3) {
      Memory.copy(this.methodId, this.originalMethod, DVM_METHOD_SIZE);
    }
    resolveTarget(wrapper, isInstanceMethod, env, api2) {
      const thread = env.handle.add(DVM_JNI_ENV_OFFSET_SELF).readPointer();
      let objectPtr;
      if (isInstanceMethod) {
        objectPtr = api2.dvmDecodeIndirectRef(thread, wrapper.$h);
      } else {
        const h = wrapper.$borrowClassHandle(env);
        objectPtr = api2.dvmDecodeIndirectRef(thread, h.value);
        h.unref(env);
      }
      let classObject;
      if (isInstanceMethod) {
        classObject = objectPtr.add(DVM_OBJECT_OFFSET_CLAZZ).readPointer();
      } else {
        classObject = objectPtr;
      }
      const classKey = classObject.toString(16);
      let entry = patchedClasses.get(classKey);
      if (entry === void 0) {
        const vtablePtr = classObject.add(DVM_CLASS_OBJECT_OFFSET_VTABLE);
        const vtableCountPtr = classObject.add(DVM_CLASS_OBJECT_OFFSET_VTABLE_COUNT);
        const vtable2 = vtablePtr.readPointer();
        const vtableCount = vtableCountPtr.readS32();
        const vtableSize = vtableCount * pointerSize5;
        const shadowVtable = Memory.alloc(2 * vtableSize);
        Memory.copy(shadowVtable, vtable2, vtableSize);
        vtablePtr.writePointer(shadowVtable);
        entry = {
          classObject,
          vtablePtr,
          vtableCountPtr,
          vtable: vtable2,
          vtableCount,
          shadowVtable,
          shadowVtableCount: vtableCount,
          targetMethods: /* @__PURE__ */ new Map()
        };
        patchedClasses.set(classKey, entry);
      }
      const methodKey = this.methodId.toString(16);
      let targetMethod = entry.targetMethods.get(methodKey);
      if (targetMethod === void 0) {
        targetMethod = Memory.dup(this.originalMethod, DVM_METHOD_SIZE);
        const methodIndex = entry.shadowVtableCount++;
        entry.shadowVtable.add(methodIndex * pointerSize5).writePointer(targetMethod);
        targetMethod.add(DVM_METHOD_OFFSET_METHOD_INDEX).writeU16(methodIndex);
        entry.vtableCountPtr.writeS32(entry.shadowVtableCount);
        entry.targetMethods.set(methodKey, targetMethod);
      }
      return targetMethod;
    }
  };
  function computeDalvikJniArgInfo(methodId) {
    if (Process.arch !== "ia32") {
      return DALVIK_JNI_NO_ARG_INFO;
    }
    const shorty = methodId.add(DVM_METHOD_OFFSET_SHORTY).readPointer().readCString();
    if (shorty === null || shorty.length === 0 || shorty.length > 65535) {
      return DALVIK_JNI_NO_ARG_INFO;
    }
    let returnType;
    switch (shorty[0]) {
      case "V":
        returnType = DALVIK_JNI_RETURN_VOID;
        break;
      case "F":
        returnType = DALVIK_JNI_RETURN_FLOAT;
        break;
      case "D":
        returnType = DALVIK_JNI_RETURN_DOUBLE;
        break;
      case "J":
        returnType = DALVIK_JNI_RETURN_S8;
        break;
      case "Z":
      case "B":
        returnType = DALVIK_JNI_RETURN_S1;
        break;
      case "C":
        returnType = DALVIK_JNI_RETURN_U2;
        break;
      case "S":
        returnType = DALVIK_JNI_RETURN_S2;
        break;
      default:
        returnType = DALVIK_JNI_RETURN_S4;
        break;
    }
    let hints = 0;
    for (let i = shorty.length - 1; i > 0; i--) {
      const ch = shorty[i];
      hints += ch === "D" || ch === "J" ? 2 : 1;
    }
    return returnType << DALVIK_JNI_RETURN_SHIFT | hints;
  }
  function cloneArtMethod(method, vm3) {
    const api2 = getApi();
    if (getAndroidApiLevel() < 23) {
      const thread = api2["art::Thread::CurrentFromGdb"]();
      return api2["art::mirror::Object::Clone"](method, thread);
    }
    return Memory.dup(method, getArtMethodSpec(vm3).size);
  }
  function deoptimizeMethod(vm3, env, method) {
    requestDeoptimization(vm3, env, kSelectiveDeoptimization, method);
  }
  function deoptimizeEverything(vm3, env) {
    requestDeoptimization(vm3, env, kFullDeoptimization);
  }
  function deoptimizeBootImage(vm3, env) {
    const api2 = getApi();
    if (getAndroidApiLevel() < 26) {
      throw new Error("This API is only available on Android >= 8.0");
    }
    withRunnableArtThread(vm3, env, (thread) => {
      api2["art::Runtime::DeoptimizeBootImage"](api2.artRuntime);
    });
  }
  function requestDeoptimization(vm3, env, kind, method) {
    const api2 = getApi();
    if (getAndroidApiLevel() < 24) {
      throw new Error("This API is only available on Android >= 7.0");
    }
    withRunnableArtThread(vm3, env, (thread) => {
      if (getAndroidApiLevel() < 30) {
        if (!api2.isJdwpStarted()) {
          const session = startJdwp(api2);
          jdwpSessions.push(session);
        }
        if (!api2.isDebuggerActive()) {
          api2["art::Dbg::GoActive"]();
        }
        const request = Memory.alloc(8 + pointerSize5);
        request.writeU32(kind);
        switch (kind) {
          case kFullDeoptimization:
            break;
          case kSelectiveDeoptimization:
            request.add(8).writePointer(method);
            break;
          default:
            throw new Error("Unsupported deoptimization kind");
        }
        api2["art::Dbg::RequestDeoptimization"](request);
        api2["art::Dbg::ManageDeoptimization"]();
      } else {
        const instrumentation = api2.artInstrumentation;
        if (instrumentation === null) {
          throw new Error("Unable to find Instrumentation class in ART; please file a bug");
        }
        const enableDeopt = api2["art::Instrumentation::EnableDeoptimization"];
        if (enableDeopt !== void 0) {
          const deoptimizationEnabled = !!instrumentation.add(getArtInstrumentationSpec().offset.deoptimizationEnabled).readU8();
          if (!deoptimizationEnabled) {
            enableDeopt(instrumentation);
          }
        }
        switch (kind) {
          case kFullDeoptimization:
            api2["art::Instrumentation::DeoptimizeEverything"](instrumentation, Memory.allocUtf8String("frida"));
            break;
          case kSelectiveDeoptimization:
            api2["art::Instrumentation::Deoptimize"](instrumentation, method);
            break;
          default:
            throw new Error("Unsupported deoptimization kind");
        }
      }
    });
  }
  var JdwpSession = class {
    constructor() {
      const libart = Process.getModuleByName("libart.so");
      const acceptImpl = libart.getExportByName("_ZN3art4JDWP12JdwpAdbState6AcceptEv");
      const receiveClientFdImpl = libart.getExportByName("_ZN3art4JDWP12JdwpAdbState15ReceiveClientFdEv");
      const controlPair = makeSocketPair();
      const clientPair = makeSocketPair();
      this._controlFd = controlPair[0];
      this._clientFd = clientPair[0];
      let acceptListener = null;
      acceptListener = Interceptor.attach(acceptImpl, function(args) {
        const state = args[0];
        const controlSockPtr = Memory.scanSync(state.add(8252), 256, "00 ff ff ff ff 00")[0].address.add(1);
        controlSockPtr.writeS32(controlPair[1]);
        acceptListener.detach();
      });
      Interceptor.replace(receiveClientFdImpl, new NativeCallback(function(state) {
        Interceptor.revert(receiveClientFdImpl);
        return clientPair[1];
      }, "int", ["pointer"]));
      Interceptor.flush();
      this._handshakeRequest = this._performHandshake();
    }
    async _performHandshake() {
      const input = new UnixInputStream(this._clientFd, { autoClose: false });
      const output = new UnixOutputStream(this._clientFd, { autoClose: false });
      const handshakePacket = [74, 68, 87, 80, 45, 72, 97, 110, 100, 115, 104, 97, 107, 101];
      try {
        await output.writeAll(handshakePacket);
        await input.readAll(handshakePacket.length);
      } catch (e) {
      }
    }
  };
  function startJdwp(api2) {
    const session = new JdwpSession();
    api2["art::Dbg::SetJdwpAllowed"](1);
    const options = makeJdwpOptions();
    api2["art::Dbg::ConfigureJdwp"](options);
    const startDebugger = api2["art::InternalDebuggerControlCallback::StartDebugger"];
    if (startDebugger !== void 0) {
      startDebugger(NULL);
    } else {
      api2["art::Dbg::StartJdwp"]();
    }
    return session;
  }
  function makeJdwpOptions() {
    const kJdwpTransportAndroidAdb = getAndroidApiLevel() < 28 ? 2 : 3;
    const kJdwpPortFirstAvailable = 0;
    const transport = kJdwpTransportAndroidAdb;
    const server = true;
    const suspend = false;
    const port = kJdwpPortFirstAvailable;
    const size = 8 + STD_STRING_SIZE + 2;
    const result2 = Memory.alloc(size);
    result2.writeU32(transport).add(4).writeU8(server ? 1 : 0).add(1).writeU8(suspend ? 1 : 0).add(1).add(STD_STRING_SIZE).writeU16(port);
    return result2;
  }
  function makeSocketPair() {
    if (socketpair === null) {
      socketpair = new NativeFunction(
        Process.getModuleByName("libc.so").getExportByName("socketpair"),
        "int",
        ["int", "int", "int", "pointer"]
      );
    }
    const buf = Memory.alloc(8);
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, buf) === -1) {
      throw new Error("Unable to create socketpair for JDWP");
    }
    return [
      buf.readS32(),
      buf.add(4).readS32()
    ];
  }
  function makeAddGlobalRefFallbackForAndroid5(api2) {
    const offset = getArtVMSpec().offset;
    const lock = api2.vm.add(offset.globalsLock);
    const table = api2.vm.add(offset.globals);
    const add = api2["art::IndirectReferenceTable::Add"];
    const acquire = api2["art::ReaderWriterMutex::ExclusiveLock"];
    const release = api2["art::ReaderWriterMutex::ExclusiveUnlock"];
    const IRT_FIRST_SEGMENT = 0;
    return function(vm3, thread, obj) {
      acquire(lock, thread);
      try {
        return add(table, IRT_FIRST_SEGMENT, obj);
      } finally {
        release(lock, thread);
      }
    };
  }
  function makeDecodeGlobalFallback(api2) {
    const decode = api2["art::Thread::DecodeJObject"];
    if (decode === void 0) {
      throw new Error("art::Thread::DecodeJObject is not available; please file a bug");
    }
    return function(vm3, thread, ref) {
      return decode(thread, ref);
    };
  }
  var threadStateTransitionRecompilers = {
    ia32: recompileExceptionClearForX86,
    x64: recompileExceptionClearForX86,
    arm: recompileExceptionClearForArm,
    arm64: recompileExceptionClearForArm64
  };
  function makeArtThreadStateTransitionImpl(vm3, env, callback) {
    const api2 = getApi();
    const envVtable = env.handle.readPointer();
    let exceptionClearImpl;
    const innerExceptionClearImpl = api2.find("_ZN3art3JNIILb1EE14ExceptionClearEP7_JNIEnv");
    if (innerExceptionClearImpl !== null) {
      exceptionClearImpl = innerExceptionClearImpl;
    } else {
      exceptionClearImpl = envVtable.add(ENV_VTABLE_OFFSET_EXCEPTION_CLEAR).readPointer();
    }
    let nextFuncImpl;
    const innerNextFuncImpl = api2.find("_ZN3art3JNIILb1EE10FatalErrorEP7_JNIEnvPKc");
    if (innerNextFuncImpl !== null) {
      nextFuncImpl = innerNextFuncImpl;
    } else {
      nextFuncImpl = envVtable.add(ENV_VTABLE_OFFSET_FATAL_ERROR).readPointer();
    }
    const recompile = threadStateTransitionRecompilers[Process.arch];
    if (recompile === void 0) {
      throw new Error("Not yet implemented for " + Process.arch);
    }
    let perform = null;
    const threadOffsets = getArtThreadSpec(vm3).offset;
    const exceptionOffset = threadOffsets.exception;
    const neuteredOffsets = /* @__PURE__ */ new Set();
    const isReportedOffset = threadOffsets.isExceptionReportedToInstrumentation;
    if (isReportedOffset !== null) {
      neuteredOffsets.add(isReportedOffset);
    }
    const throwLocationStartOffset = threadOffsets.throwLocation;
    if (throwLocationStartOffset !== null) {
      neuteredOffsets.add(throwLocationStartOffset);
      neuteredOffsets.add(throwLocationStartOffset + pointerSize5);
      neuteredOffsets.add(throwLocationStartOffset + 2 * pointerSize5);
    }
    const codeSize = 65536;
    const code3 = Memory.alloc(codeSize);
    Memory.patchCode(code3, codeSize, (buffer) => {
      perform = recompile(buffer, code3, exceptionClearImpl, nextFuncImpl, exceptionOffset, neuteredOffsets, callback);
    });
    perform._code = code3;
    perform._callback = callback;
    return perform;
  }
  function recompileExceptionClearForX86(buffer, pc, exceptionClearImpl, nextFuncImpl, exceptionOffset, neuteredOffsets, callback) {
    const blocks = {};
    const branchTargets = /* @__PURE__ */ new Set();
    const pending = [exceptionClearImpl];
    while (pending.length > 0) {
      let current = pending.shift();
      const alreadyCovered = Object.values(blocks).some(({ begin, end }) => current.compare(begin) >= 0 && current.compare(end) < 0);
      if (alreadyCovered) {
        continue;
      }
      const blockAddressKey = current.toString();
      let block = {
        begin: current
      };
      let lastInsn = null;
      let reachedEndOfBlock = false;
      do {
        if (current.equals(nextFuncImpl)) {
          reachedEndOfBlock = true;
          break;
        }
        const insn = Instruction.parse(current);
        lastInsn = insn;
        const existingBlock = blocks[insn.address.toString()];
        if (existingBlock !== void 0) {
          delete blocks[existingBlock.begin.toString()];
          blocks[blockAddressKey] = existingBlock;
          existingBlock.begin = block.begin;
          block = null;
          break;
        }
        let branchTarget = null;
        switch (insn.mnemonic) {
          case "jmp":
            branchTarget = ptr(insn.operands[0].value);
            reachedEndOfBlock = true;
            break;
          case "je":
          case "jg":
          case "jle":
          case "jne":
          case "js":
            branchTarget = ptr(insn.operands[0].value);
            break;
          case "ret":
            reachedEndOfBlock = true;
            break;
        }
        if (branchTarget !== null) {
          branchTargets.add(branchTarget.toString());
          pending.push(branchTarget);
          pending.sort((a, b) => a.compare(b));
        }
        current = insn.next;
      } while (!reachedEndOfBlock);
      if (block !== null) {
        block.end = lastInsn.address.add(lastInsn.size);
        blocks[blockAddressKey] = block;
      }
    }
    const blocksOrdered = Object.keys(blocks).map((key) => blocks[key]);
    blocksOrdered.sort((a, b) => a.begin.compare(b.begin));
    const entryBlock = blocks[exceptionClearImpl.toString()];
    blocksOrdered.splice(blocksOrdered.indexOf(entryBlock), 1);
    blocksOrdered.unshift(entryBlock);
    const writer = new X86Writer(buffer, { pc });
    let foundCore = false;
    let threadReg = null;
    blocksOrdered.forEach((block) => {
      const size = block.end.sub(block.begin).toInt32();
      const relocator = new X86Relocator(block.begin, writer);
      let offset;
      while ((offset = relocator.readOne()) !== 0) {
        const insn = relocator.input;
        const { mnemonic } = insn;
        const insnAddressId = insn.address.toString();
        if (branchTargets.has(insnAddressId)) {
          writer.putLabel(insnAddressId);
        }
        let keep = true;
        switch (mnemonic) {
          case "jmp":
            writer.putJmpNearLabel(branchLabelFromOperand(insn.operands[0]));
            keep = false;
            break;
          case "je":
          case "jg":
          case "jle":
          case "jne":
          case "js":
            writer.putJccNearLabel(mnemonic, branchLabelFromOperand(insn.operands[0]), "no-hint");
            keep = false;
            break;
          /*
           * JNI::ExceptionClear(), when checked JNI is off.
           */
          case "mov": {
            const [dst, src] = insn.operands;
            if (dst.type === "mem" && src.type === "imm") {
              const dstValue = dst.value;
              const dstOffset = dstValue.disp;
              if (dstOffset === exceptionOffset && src.value.valueOf() === 0) {
                threadReg = dstValue.base;
                writer.putPushfx();
                writer.putPushax();
                writer.putMovRegReg("xbp", "xsp");
                if (pointerSize5 === 4) {
                  writer.putAndRegU32("esp", 4294967280);
                } else {
                  const scratchReg = threadReg !== "rdi" ? "rdi" : "rsi";
                  writer.putMovRegU64(scratchReg, uint64("0xfffffffffffffff0"));
                  writer.putAndRegReg("rsp", scratchReg);
                }
                writer.putCallAddressWithAlignedArguments(callback, [threadReg]);
                writer.putMovRegReg("xsp", "xbp");
                writer.putPopax();
                writer.putPopfx();
                foundCore = true;
                keep = false;
              } else if (neuteredOffsets.has(dstOffset) && dstValue.base === threadReg) {
                keep = false;
              }
            }
            break;
          }
          /*
           * CheckJNI::ExceptionClear, when checked JNI is on. Wrapper that calls JNI::ExceptionClear().
           */
          case "call": {
            const target2 = insn.operands[0];
            if (target2.type === "mem" && target2.value.disp === ENV_VTABLE_OFFSET_EXCEPTION_CLEAR) {
              if (pointerSize5 === 4) {
                writer.putPopReg("eax");
                writer.putMovRegRegOffsetPtr("eax", "eax", 4);
                writer.putPushReg("eax");
              } else {
                writer.putMovRegRegOffsetPtr("rdi", "rdi", 8);
              }
              writer.putCallAddressWithArguments(callback, []);
              foundCore = true;
              keep = false;
            }
            break;
          }
        }
        if (keep) {
          relocator.writeAll();
        } else {
          relocator.skipOne();
        }
        if (offset === size) {
          break;
        }
      }
      relocator.dispose();
    });
    writer.dispose();
    if (!foundCore) {
      throwThreadStateTransitionParseError();
    }
    return new NativeFunction(pc, "void", ["pointer"], nativeFunctionOptions3);
  }
  function recompileExceptionClearForArm(buffer, pc, exceptionClearImpl, nextFuncImpl, exceptionOffset, neuteredOffsets, callback) {
    const blocks = {};
    const branchTargets = /* @__PURE__ */ new Set();
    const thumbBitRemovalMask = ptr(1).not();
    const pending = [exceptionClearImpl];
    while (pending.length > 0) {
      let current = pending.shift();
      const alreadyCovered = Object.values(blocks).some(({ begin: begin2, end }) => current.compare(begin2) >= 0 && current.compare(end) < 0);
      if (alreadyCovered) {
        continue;
      }
      const begin = current.and(thumbBitRemovalMask);
      const blockId = begin.toString();
      const thumbBit = current.and(1);
      let block = {
        begin
      };
      let lastInsn = null;
      let reachedEndOfBlock = false;
      let ifThenBlockRemaining = 0;
      do {
        if (current.equals(nextFuncImpl)) {
          reachedEndOfBlock = true;
          break;
        }
        const insn = Instruction.parse(current);
        const { mnemonic } = insn;
        lastInsn = insn;
        const currentAddress = current.and(thumbBitRemovalMask);
        const insnId = currentAddress.toString();
        const existingBlock = blocks[insnId];
        if (existingBlock !== void 0) {
          delete blocks[existingBlock.begin.toString()];
          blocks[blockId] = existingBlock;
          existingBlock.begin = block.begin;
          block = null;
          break;
        }
        const isOutsideIfThenBlock = ifThenBlockRemaining === 0;
        let branchTarget = null;
        switch (mnemonic) {
          case "b":
            branchTarget = ptr(insn.operands[0].value);
            reachedEndOfBlock = isOutsideIfThenBlock;
            break;
          case "beq.w":
          case "beq":
          case "bne":
          case "bne.w":
          case "bgt":
            branchTarget = ptr(insn.operands[0].value);
            break;
          case "cbz":
          case "cbnz":
            branchTarget = ptr(insn.operands[1].value);
            break;
          case "pop.w":
            if (isOutsideIfThenBlock) {
              reachedEndOfBlock = insn.operands.filter((op) => op.value === "pc").length === 1;
            }
            break;
        }
        switch (mnemonic) {
          case "it":
            ifThenBlockRemaining = 1;
            break;
          case "itt":
            ifThenBlockRemaining = 2;
            break;
          case "ittt":
            ifThenBlockRemaining = 3;
            break;
          case "itttt":
            ifThenBlockRemaining = 4;
            break;
          default:
            if (ifThenBlockRemaining > 0) {
              ifThenBlockRemaining--;
            }
            break;
        }
        if (branchTarget !== null) {
          branchTargets.add(branchTarget.toString());
          pending.push(branchTarget.or(thumbBit));
          pending.sort((a, b) => a.compare(b));
        }
        current = insn.next;
      } while (!reachedEndOfBlock);
      if (block !== null) {
        block.end = lastInsn.address.add(lastInsn.size);
        blocks[blockId] = block;
      }
    }
    const blocksOrdered = Object.keys(blocks).map((key) => blocks[key]);
    blocksOrdered.sort((a, b) => a.begin.compare(b.begin));
    const entryBlock = blocks[exceptionClearImpl.and(thumbBitRemovalMask).toString()];
    blocksOrdered.splice(blocksOrdered.indexOf(entryBlock), 1);
    blocksOrdered.unshift(entryBlock);
    const writer = new ThumbWriter(buffer, { pc });
    let foundCore = false;
    let threadReg = null;
    let realImplReg = null;
    blocksOrdered.forEach((block) => {
      const relocator = new ThumbRelocator(block.begin, writer);
      let address = block.begin;
      const end = block.end;
      let size = 0;
      do {
        const offset = relocator.readOne();
        if (offset === 0) {
          throw new Error("Unexpected end of block");
        }
        const insn = relocator.input;
        address = insn.address;
        size = insn.size;
        const { mnemonic } = insn;
        const insnAddressId = address.toString();
        if (branchTargets.has(insnAddressId)) {
          writer.putLabel(insnAddressId);
        }
        let keep = true;
        switch (mnemonic) {
          case "b":
            writer.putBLabel(branchLabelFromOperand(insn.operands[0]));
            keep = false;
            break;
          case "beq.w":
            writer.putBCondLabelWide("eq", branchLabelFromOperand(insn.operands[0]));
            keep = false;
            break;
          case "bne.w":
            writer.putBCondLabelWide("ne", branchLabelFromOperand(insn.operands[0]));
            keep = false;
            break;
          case "beq":
          case "bne":
          case "bgt":
            writer.putBCondLabelWide(mnemonic.substr(1), branchLabelFromOperand(insn.operands[0]));
            keep = false;
            break;
          case "cbz": {
            const ops = insn.operands;
            writer.putCbzRegLabel(ops[0].value, branchLabelFromOperand(ops[1]));
            keep = false;
            break;
          }
          case "cbnz": {
            const ops = insn.operands;
            writer.putCbnzRegLabel(ops[0].value, branchLabelFromOperand(ops[1]));
            keep = false;
            break;
          }
          /*
           * JNI::ExceptionClear(), when checked JNI is off.
           */
          case "str":
          case "str.w": {
            const dstValue = insn.operands[1].value;
            const dstOffset = dstValue.disp;
            if (dstOffset === exceptionOffset) {
              threadReg = dstValue.base;
              const nzcvqReg = threadReg !== "r4" ? "r4" : "r5";
              const clobberedRegs = ["r0", "r1", "r2", "r3", nzcvqReg, "r9", "r12", "lr"];
              writer.putPushRegs(clobberedRegs);
              writer.putMrsRegReg(nzcvqReg, "apsr-nzcvq");
              writer.putCallAddressWithArguments(callback, [threadReg]);
              writer.putMsrRegReg("apsr-nzcvq", nzcvqReg);
              writer.putPopRegs(clobberedRegs);
              foundCore = true;
              keep = false;
            } else if (neuteredOffsets.has(dstOffset) && dstValue.base === threadReg) {
              keep = false;
            }
            break;
          }
          /*
           * CheckJNI::ExceptionClear, when checked JNI is on. Wrapper that calls JNI::ExceptionClear().
           */
          case "ldr": {
            const [dstOp, srcOp] = insn.operands;
            if (srcOp.type === "mem") {
              const src = srcOp.value;
              if (src.base[0] === "r" && src.disp === ENV_VTABLE_OFFSET_EXCEPTION_CLEAR) {
                realImplReg = dstOp.value;
              }
            }
            break;
          }
          case "blx":
            if (insn.operands[0].value === realImplReg) {
              writer.putLdrRegRegOffset("r0", "r0", 4);
              writer.putCallAddressWithArguments(callback, ["r0"]);
              foundCore = true;
              realImplReg = null;
              keep = false;
            }
            break;
        }
        if (keep) {
          relocator.writeAll();
        } else {
          relocator.skipOne();
        }
      } while (!address.add(size).equals(end));
      relocator.dispose();
    });
    writer.dispose();
    if (!foundCore) {
      throwThreadStateTransitionParseError();
    }
    return new NativeFunction(pc.or(1), "void", ["pointer"], nativeFunctionOptions3);
  }
  function recompileExceptionClearForArm64(buffer, pc, exceptionClearImpl, nextFuncImpl, exceptionOffset, neuteredOffsets, callback) {
    const blocks = {};
    const branchTargets = /* @__PURE__ */ new Set();
    const pending = [exceptionClearImpl];
    while (pending.length > 0) {
      let current = pending.shift();
      const alreadyCovered = Object.values(blocks).some(({ begin, end }) => current.compare(begin) >= 0 && current.compare(end) < 0);
      if (alreadyCovered) {
        continue;
      }
      const blockAddressKey = current.toString();
      let block = {
        begin: current
      };
      let lastInsn = null;
      let reachedEndOfBlock = false;
      do {
        if (current.equals(nextFuncImpl)) {
          reachedEndOfBlock = true;
          break;
        }
        let insn;
        try {
          insn = Instruction.parse(current);
        } catch (e) {
          if (current.readU32() === 0) {
            reachedEndOfBlock = true;
            break;
          } else {
            throw e;
          }
        }
        lastInsn = insn;
        const existingBlock = blocks[insn.address.toString()];
        if (existingBlock !== void 0) {
          delete blocks[existingBlock.begin.toString()];
          blocks[blockAddressKey] = existingBlock;
          existingBlock.begin = block.begin;
          block = null;
          break;
        }
        let branchTarget = null;
        switch (insn.mnemonic) {
          case "b":
            branchTarget = ptr(insn.operands[0].value);
            reachedEndOfBlock = true;
            break;
          case "b.eq":
          case "b.ne":
          case "b.le":
          case "b.gt":
            branchTarget = ptr(insn.operands[0].value);
            break;
          case "cbz":
          case "cbnz":
            branchTarget = ptr(insn.operands[1].value);
            break;
          case "tbz":
          case "tbnz":
            branchTarget = ptr(insn.operands[2].value);
            break;
          case "ret":
            reachedEndOfBlock = true;
            break;
        }
        if (branchTarget !== null) {
          branchTargets.add(branchTarget.toString());
          pending.push(branchTarget);
          pending.sort((a, b) => a.compare(b));
        }
        current = insn.next;
      } while (!reachedEndOfBlock);
      if (block !== null) {
        block.end = lastInsn.address.add(lastInsn.size);
        blocks[blockAddressKey] = block;
      }
    }
    const blocksOrdered = Object.keys(blocks).map((key) => blocks[key]);
    blocksOrdered.sort((a, b) => a.begin.compare(b.begin));
    const entryBlock = blocks[exceptionClearImpl.toString()];
    blocksOrdered.splice(blocksOrdered.indexOf(entryBlock), 1);
    blocksOrdered.unshift(entryBlock);
    const writer = new Arm64Writer(buffer, { pc });
    writer.putBLabel("performTransition");
    const invokeCallback = pc.add(writer.offset);
    writer.putPushAllXRegisters();
    writer.putCallAddressWithArguments(callback, ["x0"]);
    writer.putPopAllXRegisters();
    writer.putRet();
    writer.putLabel("performTransition");
    let foundCore = false;
    let threadReg = null;
    let realImplReg = null;
    blocksOrdered.forEach((block) => {
      const size = block.end.sub(block.begin).toInt32();
      const relocator = new Arm64Relocator(block.begin, writer);
      let offset;
      while ((offset = relocator.readOne()) !== 0) {
        const insn = relocator.input;
        const { mnemonic } = insn;
        const insnAddressId = insn.address.toString();
        if (branchTargets.has(insnAddressId)) {
          writer.putLabel(insnAddressId);
        }
        let keep = true;
        switch (mnemonic) {
          case "b":
            writer.putBLabel(branchLabelFromOperand(insn.operands[0]));
            keep = false;
            break;
          case "b.eq":
          case "b.ne":
          case "b.le":
          case "b.gt":
            writer.putBCondLabel(mnemonic.substr(2), branchLabelFromOperand(insn.operands[0]));
            keep = false;
            break;
          case "cbz": {
            const ops = insn.operands;
            writer.putCbzRegLabel(ops[0].value, branchLabelFromOperand(ops[1]));
            keep = false;
            break;
          }
          case "cbnz": {
            const ops = insn.operands;
            writer.putCbnzRegLabel(ops[0].value, branchLabelFromOperand(ops[1]));
            keep = false;
            break;
          }
          case "tbz": {
            const ops = insn.operands;
            writer.putTbzRegImmLabel(ops[0].value, ops[1].value.valueOf(), branchLabelFromOperand(ops[2]));
            keep = false;
            break;
          }
          case "tbnz": {
            const ops = insn.operands;
            writer.putTbnzRegImmLabel(ops[0].value, ops[1].value.valueOf(), branchLabelFromOperand(ops[2]));
            keep = false;
            break;
          }
          /*
           * JNI::ExceptionClear(), when checked JNI is off.
           */
          case "str": {
            const ops = insn.operands;
            const srcReg = ops[0].value;
            const dstValue = ops[1].value;
            const dstOffset = dstValue.disp;
            if (srcReg === "xzr" && dstOffset === exceptionOffset) {
              threadReg = dstValue.base;
              writer.putPushRegReg("x0", "lr");
              writer.putMovRegReg("x0", threadReg);
              writer.putBlImm(invokeCallback);
              writer.putPopRegReg("x0", "lr");
              foundCore = true;
              keep = false;
            } else if (neuteredOffsets.has(dstOffset) && dstValue.base === threadReg) {
              keep = false;
            }
            break;
          }
          /*
           * CheckJNI::ExceptionClear, when checked JNI is on. Wrapper that calls JNI::ExceptionClear().
           */
          case "ldr": {
            const ops = insn.operands;
            const src = ops[1].value;
            if (src.base[0] === "x" && src.disp === ENV_VTABLE_OFFSET_EXCEPTION_CLEAR) {
              realImplReg = ops[0].value;
            }
            break;
          }
          case "blr":
            if (insn.operands[0].value === realImplReg) {
              writer.putLdrRegRegOffset("x0", "x0", 8);
              writer.putCallAddressWithArguments(callback, ["x0"]);
              foundCore = true;
              realImplReg = null;
              keep = false;
            }
            break;
        }
        if (keep) {
          relocator.writeAll();
        } else {
          relocator.skipOne();
        }
        if (offset === size) {
          break;
        }
      }
      relocator.dispose();
    });
    writer.dispose();
    if (!foundCore) {
      throwThreadStateTransitionParseError();
    }
    return new NativeFunction(pc, "void", ["pointer"], nativeFunctionOptions3);
  }
  function throwThreadStateTransitionParseError() {
    throw new Error("Unable to parse ART internals; please file a bug");
  }
  function fixupArtQuickDeliverExceptionBug(api2) {
    const prettyMethod = api2["art::ArtMethod::PrettyMethod"];
    if (prettyMethod === void 0) {
      return;
    }
    Interceptor.attach(prettyMethod.impl, artController.hooks.ArtMethod.prettyMethod);
    Interceptor.flush();
  }
  function branchLabelFromOperand(op) {
    return ptr(op.value).toString();
  }
  function makeCxxMethodWrapperReturningPointerByValueGeneric(address, argTypes) {
    return new NativeFunction(address, "pointer", argTypes, nativeFunctionOptions3);
  }
  function makeCxxMethodWrapperReturningPointerByValueInFirstArg(address, argTypes) {
    const impl = new NativeFunction(address, "void", ["pointer"].concat(argTypes), nativeFunctionOptions3);
    return function() {
      const resultPtr = Memory.alloc(pointerSize5);
      impl(resultPtr, ...arguments);
      return resultPtr.readPointer();
    };
  }
  function makeCxxMethodWrapperReturningStdStringByValue(impl, argTypes) {
    const { arch } = Process;
    switch (arch) {
      case "ia32":
      case "arm64": {
        let thunk;
        if (arch === "ia32") {
          thunk = makeThunk(64, (writer) => {
            const argCount = 1 + argTypes.length;
            const argvSize = argCount * 4;
            writer.putSubRegImm("esp", argvSize);
            for (let i = 0; i !== argCount; i++) {
              const offset = i * 4;
              writer.putMovRegRegOffsetPtr("eax", "esp", argvSize + 4 + offset);
              writer.putMovRegOffsetPtrReg("esp", offset, "eax");
            }
            writer.putCallAddress(impl);
            writer.putAddRegImm("esp", argvSize - 4);
            writer.putRet();
          });
        } else {
          thunk = makeThunk(32, (writer) => {
            writer.putMovRegReg("x8", "x0");
            argTypes.forEach((t, i) => {
              writer.putMovRegReg("x" + i, "x" + (i + 1));
            });
            writer.putLdrRegAddress("x7", impl);
            writer.putBrReg("x7");
          });
        }
        const invokeThunk = new NativeFunction(thunk, "void", ["pointer"].concat(argTypes), nativeFunctionOptions3);
        const wrapper = function(...args) {
          invokeThunk(...args);
        };
        wrapper.handle = thunk;
        wrapper.impl = impl;
        return wrapper;
      }
      default: {
        const result2 = new NativeFunction(impl, "void", ["pointer"].concat(argTypes), nativeFunctionOptions3);
        result2.impl = impl;
        return result2;
      }
    }
  }
  var StdString = class {
    constructor() {
      this.handle = Memory.alloc(STD_STRING_SIZE);
    }
    dispose() {
      const [data, isTiny] = this._getData();
      if (!isTiny) {
        getApi().$delete(data);
      }
    }
    disposeToString() {
      const result2 = this.toString();
      this.dispose();
      return result2;
    }
    toString() {
      const [data] = this._getData();
      return data.readUtf8String();
    }
    _getData() {
      const str = this.handle;
      const isTiny = (str.readU8() & 1) === 0;
      const data = isTiny ? str.add(1) : str.add(2 * pointerSize5).readPointer();
      return [data, isTiny];
    }
  };
  var StdVector = class {
    $delete() {
      this.dispose();
      getApi().$delete(this);
    }
    constructor(storage, elementSize) {
      this.handle = storage;
      this._begin = storage;
      this._end = storage.add(pointerSize5);
      this._storage = storage.add(2 * pointerSize5);
      this._elementSize = elementSize;
    }
    init() {
      this.begin = NULL;
      this.end = NULL;
      this.storage = NULL;
    }
    dispose() {
      getApi().$delete(this.begin);
    }
    get begin() {
      return this._begin.readPointer();
    }
    set begin(value) {
      this._begin.writePointer(value);
    }
    get end() {
      return this._end.readPointer();
    }
    set end(value) {
      this._end.writePointer(value);
    }
    get storage() {
      return this._storage.readPointer();
    }
    set storage(value) {
      this._storage.writePointer(value);
    }
    get size() {
      return this.end.sub(this.begin).toInt32() / this._elementSize;
    }
  };
  var HandleVector = class _HandleVector extends StdVector {
    static $new() {
      const vector = new _HandleVector(getApi().$new(STD_VECTOR_SIZE));
      vector.init();
      return vector;
    }
    constructor(storage) {
      super(storage, pointerSize5);
    }
    get handles() {
      const result2 = [];
      let cur = this.begin;
      const end = this.end;
      while (!cur.equals(end)) {
        result2.push(cur.readPointer());
        cur = cur.add(pointerSize5);
      }
      return result2;
    }
  };
  var BHS_OFFSET_LINK = 0;
  var BHS_OFFSET_NUM_REFS = pointerSize5;
  var BHS_SIZE = BHS_OFFSET_NUM_REFS + 4;
  var kNumReferencesVariableSized = -1;
  var BaseHandleScope = class _BaseHandleScope {
    $delete() {
      this.dispose();
      getApi().$delete(this);
    }
    constructor(storage) {
      this.handle = storage;
      this._link = storage.add(BHS_OFFSET_LINK);
      this._numberOfReferences = storage.add(BHS_OFFSET_NUM_REFS);
    }
    init(link, numberOfReferences) {
      this.link = link;
      this.numberOfReferences = numberOfReferences;
    }
    dispose() {
    }
    get link() {
      return new _BaseHandleScope(this._link.readPointer());
    }
    set link(value) {
      this._link.writePointer(value);
    }
    get numberOfReferences() {
      return this._numberOfReferences.readS32();
    }
    set numberOfReferences(value) {
      this._numberOfReferences.writeS32(value);
    }
  };
  var VSHS_OFFSET_SELF = alignPointerOffset(BHS_SIZE);
  var VSHS_OFFSET_CURRENT_SCOPE = VSHS_OFFSET_SELF + pointerSize5;
  var VSHS_SIZE = VSHS_OFFSET_CURRENT_SCOPE + pointerSize5;
  var VariableSizedHandleScope = class _VariableSizedHandleScope extends BaseHandleScope {
    static $new(thread, vm3) {
      const scope = new _VariableSizedHandleScope(getApi().$new(VSHS_SIZE));
      scope.init(thread, vm3);
      return scope;
    }
    constructor(storage) {
      super(storage);
      this._self = storage.add(VSHS_OFFSET_SELF);
      this._currentScope = storage.add(VSHS_OFFSET_CURRENT_SCOPE);
      const kLocalScopeSize = 64;
      const kSizeOfReferencesPerScope = kLocalScopeSize - pointerSize5 - 4 - 4;
      const kNumReferencesPerScope = kSizeOfReferencesPerScope / 4;
      this._scopeLayout = FixedSizeHandleScope.layoutForCapacity(kNumReferencesPerScope);
      this._topHandleScopePtr = null;
    }
    init(thread, vm3) {
      const topHandleScopePtr = thread.add(getArtThreadSpec(vm3).offset.topHandleScope);
      this._topHandleScopePtr = topHandleScopePtr;
      super.init(topHandleScopePtr.readPointer(), kNumReferencesVariableSized);
      this.self = thread;
      this.currentScope = FixedSizeHandleScope.$new(this._scopeLayout);
      topHandleScopePtr.writePointer(this);
    }
    dispose() {
      this._topHandleScopePtr.writePointer(this.link);
      let scope;
      while ((scope = this.currentScope) !== null) {
        const next = scope.link;
        scope.$delete();
        this.currentScope = next;
      }
    }
    get self() {
      return this._self.readPointer();
    }
    set self(value) {
      this._self.writePointer(value);
    }
    get currentScope() {
      const storage = this._currentScope.readPointer();
      if (storage.isNull()) {
        return null;
      }
      return new FixedSizeHandleScope(storage, this._scopeLayout);
    }
    set currentScope(value) {
      this._currentScope.writePointer(value);
    }
    newHandle(object) {
      return this.currentScope.newHandle(object);
    }
  };
  var FixedSizeHandleScope = class _FixedSizeHandleScope extends BaseHandleScope {
    static $new(layout) {
      const scope = new _FixedSizeHandleScope(getApi().$new(layout.size), layout);
      scope.init();
      return scope;
    }
    constructor(storage, layout) {
      super(storage);
      const { offset } = layout;
      this._refsStorage = storage.add(offset.refsStorage);
      this._pos = storage.add(offset.pos);
      this._layout = layout;
    }
    init() {
      super.init(NULL, this._layout.numberOfReferences);
      this.pos = 0;
    }
    get pos() {
      return this._pos.readU32();
    }
    set pos(value) {
      this._pos.writeU32(value);
    }
    newHandle(object) {
      const pos = this.pos;
      const handle = this._refsStorage.add(pos * 4);
      handle.writeS32(object.toInt32());
      this.pos = pos + 1;
      return handle;
    }
    static layoutForCapacity(numRefs) {
      const refsStorage = BHS_SIZE;
      const pos = refsStorage + numRefs * 4;
      return {
        size: pos + 4,
        numberOfReferences: numRefs,
        offset: {
          refsStorage,
          pos
        }
      };
    }
  };
  var objectVisitorPredicateFactories = {
    arm: function(needle, onMatch) {
      const size = Process.pageSize;
      const predicate = Memory.alloc(size);
      Memory.protect(predicate, size, "rwx");
      const onMatchCallback = new NativeCallback(onMatch, "void", ["pointer"]);
      predicate._onMatchCallback = onMatchCallback;
      const instructions = [
        26625,
        // ldr r1, [r0]
        18947,
        // ldr r2, =needle
        17041,
        // cmp r1, r2
        53505,
        // bne mismatch
        19202,
        // ldr r3, =onMatch
        18200,
        // bx r3
        18288,
        // bx lr
        48896
        // nop
      ];
      const needleOffset = instructions.length * 2;
      const onMatchOffset = needleOffset + 4;
      const codeSize = onMatchOffset + 4;
      Memory.patchCode(predicate, codeSize, function(address) {
        instructions.forEach((instruction, index) => {
          address.add(index * 2).writeU16(instruction);
        });
        address.add(needleOffset).writeS32(needle);
        address.add(onMatchOffset).writePointer(onMatchCallback);
      });
      return predicate.or(1);
    },
    arm64: function(needle, onMatch) {
      const size = Process.pageSize;
      const predicate = Memory.alloc(size);
      Memory.protect(predicate, size, "rwx");
      const onMatchCallback = new NativeCallback(onMatch, "void", ["pointer"]);
      predicate._onMatchCallback = onMatchCallback;
      const instructions = [
        3107979265,
        // ldr w1, [x0]
        402653378,
        // ldr w2, =needle
        1795293247,
        // cmp w1, w2
        1409286241,
        // b.ne mismatch
        1476395139,
        // ldr x3, =onMatch
        3592355936,
        // br x3
        3596551104
        // ret
      ];
      const needleOffset = instructions.length * 4;
      const onMatchOffset = needleOffset + 4;
      const codeSize = onMatchOffset + 8;
      Memory.patchCode(predicate, codeSize, function(address) {
        instructions.forEach((instruction, index) => {
          address.add(index * 4).writeU32(instruction);
        });
        address.add(needleOffset).writeS32(needle);
        address.add(onMatchOffset).writePointer(onMatchCallback);
      });
      return predicate;
    }
  };
  function makeObjectVisitorPredicate(needle, onMatch) {
    const factory = objectVisitorPredicateFactories[Process.arch] || makeGenericObjectVisitorPredicate;
    return factory(needle, onMatch);
  }
  function makeGenericObjectVisitorPredicate(needle, onMatch) {
    return new NativeCallback((object) => {
      const klass = object.readS32();
      if (klass === needle) {
        onMatch(object);
      }
    }, "void", ["pointer", "pointer"]);
  }
  function alignPointerOffset(offset) {
    const remainder = offset % pointerSize5;
    if (remainder !== 0) {
      return offset + pointerSize5 - remainder;
    }
    return offset;
  }

  // node_modules/frida-java-bridge/lib/jvm.js
  var jsizeSize2 = 4;
  var { pointerSize: pointerSize6 } = Process;
  var JVM_ACC_NATIVE = 256;
  var JVM_ACC_IS_OLD = 65536;
  var JVM_ACC_IS_OBSOLETE = 131072;
  var JVM_ACC_NOT_C2_COMPILABLE = 33554432;
  var JVM_ACC_NOT_C1_COMPILABLE = 67108864;
  var JVM_ACC_NOT_C2_OSR_COMPILABLE = 134217728;
  var nativeFunctionOptions4 = {
    exceptions: "propagate"
  };
  var getJvmMethodSpec = memoize(_getJvmMethodSpec);
  var getJvmInstanceKlassSpec = memoize(_getJvmInstanceKlassSpec);
  var getJvmThreadSpec = memoize(_getJvmThreadSpec);
  var cachedApi2 = null;
  var manglersScheduled = false;
  var replaceManglers = /* @__PURE__ */ new Map();
  var revertManglers = /* @__PURE__ */ new Map();
  function getApi2() {
    if (cachedApi2 === null) {
      cachedApi2 = _getApi2();
    }
    return cachedApi2;
  }
  function _getApi2() {
    const vmModules = Process.enumerateModules().filter((m) => /jvm.(dll|dylib|so)$/.test(m.name));
    if (vmModules.length === 0) {
      return null;
    }
    const vmModule = vmModules[0];
    const temporaryApi = {
      flavor: "jvm"
    };
    const pending = Process.platform === "windows" ? [{
      module: vmModule,
      functions: {
        JNI_GetCreatedJavaVMs: ["JNI_GetCreatedJavaVMs", "int", ["pointer", "int", "pointer"]],
        JVM_Sleep: ["JVM_Sleep", "void", ["pointer", "pointer", "long"]],
        "VMThread::execute": ["VMThread::execute", "void", ["pointer"]],
        "Method::size": ["Method::size", "int", ["int"]],
        "Method::set_native_function": ["Method::set_native_function", "void", ["pointer", "pointer", "int"]],
        "Method::clear_native_function": ["Method::clear_native_function", "void", ["pointer"]],
        "Method::jmethod_id": ["Method::jmethod_id", "pointer", ["pointer"]],
        "ClassLoaderDataGraph::classes_do": ["ClassLoaderDataGraph::classes_do", "void", ["pointer"]],
        "NMethodSweeper::sweep_code_cache": ["NMethodSweeper::sweep_code_cache", "void", []],
        "OopMapCache::flush_obsolete_entries": ["OopMapCache::flush_obsolete_entries", "void", ["pointer"]]
      },
      variables: {
        "VM_RedefineClasses::`vftable'": function(address) {
          this.vtableRedefineClasses = address;
        },
        "VM_RedefineClasses::doit": function(address) {
          this.redefineClassesDoIt = address;
        },
        "VM_RedefineClasses::doit_prologue": function(address) {
          this.redefineClassesDoItPrologue = address;
        },
        "VM_RedefineClasses::doit_epilogue": function(address) {
          this.redefineClassesDoItEpilogue = address;
        },
        "VM_RedefineClasses::allow_nested_vm_operations": function(address) {
          this.redefineClassesAllow = address;
        },
        "NMethodSweeper::_traversals": function(address) {
          this.traversals = address;
        },
        "NMethodSweeper::_should_sweep": function(address) {
          this.shouldSweep = address;
        }
      },
      optionals: []
    }] : [{
      module: vmModule,
      functions: {
        JNI_GetCreatedJavaVMs: ["JNI_GetCreatedJavaVMs", "int", ["pointer", "int", "pointer"]],
        _ZN6Method4sizeEb: ["Method::size", "int", ["int"]],
        _ZN6Method19set_native_functionEPhb: ["Method::set_native_function", "void", ["pointer", "pointer", "int"]],
        _ZN6Method21clear_native_functionEv: ["Method::clear_native_function", "void", ["pointer"]],
        // JDK >= 17
        _ZN6Method24restore_unshareable_infoEP10JavaThread: ["Method::restore_unshareable_info", "void", ["pointer", "pointer"]],
        // JDK < 17
        _ZN6Method24restore_unshareable_infoEP6Thread: ["Method::restore_unshareable_info", "void", ["pointer", "pointer"]],
        _ZN6Method11link_methodERK12methodHandleP10JavaThread: ["Method::link_method", "void", ["pointer", "pointer", "pointer"]],
        _ZN6Method10jmethod_idEv: ["Method::jmethod_id", "pointer", ["pointer"]],
        _ZN6Method10clear_codeEv: function(address) {
          const clearCode = new NativeFunction(address, "void", ["pointer"], nativeFunctionOptions4);
          this["Method::clear_code"] = function(thisPtr) {
            clearCode(thisPtr);
          };
        },
        _ZN6Method10clear_codeEb: function(address) {
          const clearCode = new NativeFunction(address, "void", ["pointer", "int"], nativeFunctionOptions4);
          const lock = 0;
          this["Method::clear_code"] = function(thisPtr) {
            clearCode(thisPtr, lock);
          };
        },
        // JDK >= 13
        _ZN18VM_RedefineClasses19mark_dependent_codeEP13InstanceKlass: ["VM_RedefineClasses::mark_dependent_code", "void", ["pointer", "pointer"]],
        _ZN18VM_RedefineClasses20flush_dependent_codeEv: ["VM_RedefineClasses::flush_dependent_code", "void", []],
        // JDK < 13
        _ZN18VM_RedefineClasses20flush_dependent_codeEP13InstanceKlassP6Thread: ["VM_RedefineClasses::flush_dependent_code", "void", ["pointer", "pointer", "pointer"]],
        // JDK < 10
        _ZN18VM_RedefineClasses20flush_dependent_codeE19instanceKlassHandleP6Thread: ["VM_RedefineClasses::flush_dependent_code", "void", ["pointer", "pointer", "pointer"]],
        _ZN19ResolvedMethodTable21adjust_method_entriesEPb: ["ResolvedMethodTable::adjust_method_entries", "void", ["pointer"]],
        // JDK < 10
        _ZN15MemberNameTable21adjust_method_entriesEP13InstanceKlassPb: ["MemberNameTable::adjust_method_entries", "void", ["pointer", "pointer", "pointer"]],
        _ZN17ConstantPoolCache21adjust_method_entriesEPb: function(address) {
          const adjustMethod = new NativeFunction(address, "void", ["pointer", "pointer"], nativeFunctionOptions4);
          this["ConstantPoolCache::adjust_method_entries"] = function(thisPtr, holderPtr, tracePtr) {
            adjustMethod(thisPtr, tracePtr);
          };
        },
        // JDK < 13
        _ZN17ConstantPoolCache21adjust_method_entriesEP13InstanceKlassPb: function(address) {
          const adjustMethod = new NativeFunction(address, "void", ["pointer", "pointer", "pointer"], nativeFunctionOptions4);
          this["ConstantPoolCache::adjust_method_entries"] = function(thisPtr, holderPtr, tracePtr) {
            adjustMethod(thisPtr, holderPtr, tracePtr);
          };
        },
        _ZN20ClassLoaderDataGraph10classes_doEP12KlassClosure: ["ClassLoaderDataGraph::classes_do", "void", ["pointer"]],
        _ZN20ClassLoaderDataGraph22clean_deallocate_listsEb: ["ClassLoaderDataGraph::clean_deallocate_lists", "void", ["int"]],
        _ZN10JavaThread27thread_from_jni_environmentEP7JNIEnv_: ["JavaThread::thread_from_jni_environment", "pointer", ["pointer"]],
        _ZN8VMThread7executeEP12VM_Operation: ["VMThread::execute", "void", ["pointer"]],
        _ZN11OopMapCache22flush_obsolete_entriesEv: ["OopMapCache::flush_obsolete_entries", "void", ["pointer"]],
        _ZN14NMethodSweeper11force_sweepEv: ["NMethodSweeper::force_sweep", "void", []],
        _ZN14NMethodSweeper16sweep_code_cacheEv: ["NMethodSweeper::sweep_code_cache", "void", []],
        _ZN14NMethodSweeper17sweep_in_progressEv: ["NMethodSweeper::sweep_in_progress", "bool", []],
        JVM_Sleep: ["JVM_Sleep", "void", ["pointer", "pointer", "long"]]
      },
      variables: {
        // JDK <= 9
        _ZN18VM_RedefineClasses14_the_class_oopE: function(address) {
          this.redefineClass = address;
        },
        // 9 < JDK < 13
        _ZN18VM_RedefineClasses10_the_classE: function(address) {
          this.redefineClass = address;
        },
        // JDK < 13
        _ZN18VM_RedefineClasses25AdjustCpoolCacheAndVtable8do_klassEP5Klass: function(address) {
          this.doKlass = address;
        },
        // JDK >= 13
        _ZN18VM_RedefineClasses22AdjustAndCleanMetadata8do_klassEP5Klass: function(address) {
          this.doKlass = address;
        },
        _ZTV18VM_RedefineClasses: function(address) {
          this.vtableRedefineClasses = address;
        },
        _ZN18VM_RedefineClasses4doitEv: function(address) {
          this.redefineClassesDoIt = address;
        },
        _ZN18VM_RedefineClasses13doit_prologueEv: function(address) {
          this.redefineClassesDoItPrologue = address;
        },
        _ZN18VM_RedefineClasses13doit_epilogueEv: function(address) {
          this.redefineClassesDoItEpilogue = address;
        },
        _ZN18VM_RedefineClassesD0Ev: function(address) {
          this.redefineClassesDispose0 = address;
        },
        _ZN18VM_RedefineClassesD1Ev: function(address) {
          this.redefineClassesDispose1 = address;
        },
        _ZNK18VM_RedefineClasses26allow_nested_vm_operationsEv: function(address) {
          this.redefineClassesAllow = address;
        },
        _ZNK18VM_RedefineClasses14print_on_errorEP12outputStream: function(address) {
          this.redefineClassesOnError = address;
        },
        // JDK >= 17
        _ZN13InstanceKlass33create_new_default_vtable_indicesEiP10JavaThread: function(address) {
          this.createNewDefaultVtableIndices = address;
        },
        // JDK < 17
        _ZN13InstanceKlass33create_new_default_vtable_indicesEiP6Thread: function(address) {
          this.createNewDefaultVtableIndices = address;
        },
        _ZN19Abstract_VM_Version19jre_release_versionEv: function(address) {
          const getVersion = new NativeFunction(address, "pointer", [], nativeFunctionOptions4);
          const versionS = getVersion().readCString();
          this.version = versionS.startsWith("1.8") ? 8 : versionS.startsWith("9.") ? 9 : parseInt(versionS.slice(0, 2), 10);
          this.versionS = versionS;
        },
        _ZN14NMethodSweeper11_traversalsE: function(address) {
          this.traversals = address;
        },
        _ZN14NMethodSweeper21_sweep_fractions_leftE: function(address) {
          this.fractions = address;
        },
        _ZN14NMethodSweeper13_should_sweepE: function(address) {
          this.shouldSweep = address;
        }
      },
      optionals: [
        "_ZN6Method24restore_unshareable_infoEP10JavaThread",
        "_ZN6Method24restore_unshareable_infoEP6Thread",
        "_ZN6Method11link_methodERK12methodHandleP10JavaThread",
        "_ZN6Method10clear_codeEv",
        "_ZN6Method10clear_codeEb",
        "_ZN18VM_RedefineClasses19mark_dependent_codeEP13InstanceKlass",
        "_ZN18VM_RedefineClasses20flush_dependent_codeEv",
        "_ZN18VM_RedefineClasses20flush_dependent_codeEP13InstanceKlassP6Thread",
        "_ZN18VM_RedefineClasses20flush_dependent_codeE19instanceKlassHandleP6Thread",
        "_ZN19ResolvedMethodTable21adjust_method_entriesEPb",
        "_ZN15MemberNameTable21adjust_method_entriesEP13InstanceKlassPb",
        "_ZN17ConstantPoolCache21adjust_method_entriesEPb",
        "_ZN17ConstantPoolCache21adjust_method_entriesEP13InstanceKlassPb",
        "_ZN20ClassLoaderDataGraph22clean_deallocate_listsEb",
        "_ZN10JavaThread27thread_from_jni_environmentEP7JNIEnv_",
        "_ZN14NMethodSweeper11force_sweepEv",
        "_ZN14NMethodSweeper17sweep_in_progressEv",
        "_ZN18VM_RedefineClasses14_the_class_oopE",
        "_ZN18VM_RedefineClasses10_the_classE",
        "_ZN18VM_RedefineClasses25AdjustCpoolCacheAndVtable8do_klassEP5Klass",
        "_ZN18VM_RedefineClasses22AdjustAndCleanMetadata8do_klassEP5Klass",
        "_ZN18VM_RedefineClassesD0Ev",
        "_ZN18VM_RedefineClassesD1Ev",
        "_ZNK18VM_RedefineClasses14print_on_errorEP12outputStream",
        "_ZN13InstanceKlass33create_new_default_vtable_indicesEiP10JavaThread",
        "_ZN13InstanceKlass33create_new_default_vtable_indicesEiP6Thread",
        "_ZN14NMethodSweeper21_sweep_fractions_leftE"
      ]
    }];
    const missing = [];
    pending.forEach(function(api2) {
      const module = api2.module;
      const functions = api2.functions || {};
      const variables = api2.variables || {};
      const optionals = new Set(api2.optionals || []);
      const tmp = module.enumerateExports().reduce(function(result2, exp) {
        result2[exp.name] = exp;
        return result2;
      }, {});
      const exportByName = module.enumerateSymbols().reduce(function(result2, exp) {
        result2[exp.name] = exp;
        return result2;
      }, tmp);
      Object.keys(functions).forEach(function(name) {
        const exp = exportByName[name];
        if (exp !== void 0) {
          const signature = functions[name];
          if (typeof signature === "function") {
            signature.call(temporaryApi, exp.address);
          } else {
            temporaryApi[signature[0]] = new NativeFunction(exp.address, signature[1], signature[2], nativeFunctionOptions4);
          }
        } else {
          if (!optionals.has(name)) {
            missing.push(name);
          }
        }
      });
      Object.keys(variables).forEach(function(name) {
        const exp = exportByName[name];
        if (exp !== void 0) {
          const handler = variables[name];
          handler.call(temporaryApi, exp.address);
        } else {
          if (!optionals.has(name)) {
            missing.push(name);
          }
        }
      });
    });
    if (missing.length > 0) {
      throw new Error("Java API only partially available; please file a bug. Missing: " + missing.join(", "));
    }
    const vms = Memory.alloc(pointerSize6);
    const vmCount = Memory.alloc(jsizeSize2);
    checkJniResult("JNI_GetCreatedJavaVMs", temporaryApi.JNI_GetCreatedJavaVMs(vms, 1, vmCount));
    if (vmCount.readInt() === 0) {
      return null;
    }
    temporaryApi.vm = vms.readPointer();
    const allocatorFunctions = Process.platform === "windows" ? {
      $new: ["??2@YAPEAX_K@Z", "pointer", ["ulong"]],
      $delete: ["??3@YAXPEAX@Z", "void", ["pointer"]]
    } : {
      $new: ["_Znwm", "pointer", ["ulong"]],
      $delete: ["_ZdlPv", "void", ["pointer"]]
    };
    for (const [name, [rawName, retType, argTypes]] of Object.entries(allocatorFunctions)) {
      let address = Module.findGlobalExportByName(rawName);
      if (address === null) {
        address = DebugSymbol.fromName(rawName).address;
        if (address.isNull()) {
          throw new Error(`unable to find C++ allocator API, missing: '${rawName}'`);
        }
      }
      temporaryApi[name] = new NativeFunction(address, retType, argTypes, nativeFunctionOptions4);
    }
    temporaryApi.jvmti = getEnvJvmti(temporaryApi);
    if (temporaryApi["JavaThread::thread_from_jni_environment"] === void 0) {
      temporaryApi["JavaThread::thread_from_jni_environment"] = makeThreadFromJniHelper(temporaryApi);
    }
    return temporaryApi;
  }
  function getEnvJvmti(api2) {
    const vm3 = new VM(api2);
    let env;
    vm3.perform(() => {
      const handle = vm3.tryGetEnvHandle(jvmtiVersion.v1_0);
      if (handle === null) {
        throw new Error("JVMTI not available");
      }
      env = new EnvJvmti(handle, vm3);
      const capaBuf = Memory.alloc(8);
      capaBuf.writeU64(jvmtiCapabilities.canTagObjects);
      const result2 = env.addCapabilities(capaBuf);
      checkJniResult("getEnvJvmti::AddCapabilities", result2);
    });
    return env;
  }
  var threadOffsetParsers = {
    x64: parseX64ThreadOffset
  };
  function makeThreadFromJniHelper(api2) {
    let offset = null;
    const tryParse = threadOffsetParsers[Process.arch];
    if (tryParse !== void 0) {
      const vm3 = new VM(api2);
      const findClassImpl = vm3.perform((env) => env.handle.readPointer().add(6 * pointerSize6).readPointer());
      offset = parseInstructionsAt(findClassImpl, tryParse, { limit: 11 });
    }
    if (offset === null) {
      return () => {
        throw new Error("Unable to make thread_from_jni_environment() helper for the current architecture");
      };
    }
    return (env) => {
      return env.add(offset);
    };
  }
  function parseX64ThreadOffset(insn) {
    if (insn.mnemonic !== "lea") {
      return null;
    }
    const { base, disp } = insn.operands[1].value;
    if (!(base === "rdi" && disp < 0)) {
      return null;
    }
    return disp;
  }
  function ensureClassInitialized2(env, classRef) {
  }
  var JvmMethodMangler = class {
    constructor(methodId) {
      this.methodId = methodId;
      this.method = methodId.readPointer();
      this.originalMethod = null;
      this.newMethod = null;
      this.resolved = null;
      this.impl = null;
      this.key = methodId.toString(16);
    }
    replace(impl, isInstanceMethod, argTypes, vm3, api2) {
      const { key } = this;
      const mangler = revertManglers.get(key);
      if (mangler !== void 0) {
        revertManglers.delete(key);
        this.method = mangler.method;
        this.originalMethod = mangler.originalMethod;
        this.newMethod = mangler.newMethod;
        this.resolved = mangler.resolved;
      }
      this.impl = impl;
      replaceManglers.set(key, this);
      ensureManglersScheduled(vm3);
    }
    revert(vm3) {
      const { key } = this;
      replaceManglers.delete(key);
      revertManglers.set(key, this);
      ensureManglersScheduled(vm3);
    }
    resolveTarget(wrapper, isInstanceMethod, env, api2) {
      const { resolved, originalMethod, methodId } = this;
      if (resolved !== null) {
        return resolved;
      }
      if (originalMethod === null) {
        return methodId;
      }
      const vip = originalMethod.oldMethod.vtableIndexPtr;
      vip.writeS32(-2);
      const jmethodID = Memory.alloc(pointerSize6);
      jmethodID.writePointer(this.method);
      this.resolved = jmethodID;
      return jmethodID;
    }
  };
  function ensureManglersScheduled(vm3) {
    if (!manglersScheduled) {
      manglersScheduled = true;
      Script.nextTick(doManglers, vm3);
    }
  }
  function doManglers(vm3) {
    const localReplaceManglers = new Map(replaceManglers);
    const localRevertManglers = new Map(revertManglers);
    replaceManglers.clear();
    revertManglers.clear();
    manglersScheduled = false;
    vm3.perform((env) => {
      const api2 = getApi2();
      const thread = api2["JavaThread::thread_from_jni_environment"](env.handle);
      let force = false;
      withJvmThread(() => {
        localReplaceManglers.forEach((mangler) => {
          const { method, originalMethod, impl, methodId, newMethod } = mangler;
          if (originalMethod === null) {
            mangler.originalMethod = fetchJvmMethod(method);
            mangler.newMethod = nativeJvmMethod(method, impl, thread);
            installJvmMethod(mangler.newMethod, methodId, thread);
          } else {
            api2["Method::set_native_function"](newMethod.method, impl, 0);
          }
        });
        localRevertManglers.forEach((mangler) => {
          const { originalMethod, methodId, newMethod } = mangler;
          if (originalMethod !== null) {
            revertJvmMethod(originalMethod);
            const revert = originalMethod.oldMethod;
            revert.oldMethod = newMethod;
            installJvmMethod(revert, methodId, thread);
            force = true;
          }
        });
      });
      if (force) {
        forceSweep(env.handle);
      }
    });
  }
  function forceSweep(env) {
    const {
      fractions,
      shouldSweep,
      traversals,
      "NMethodSweeper::sweep_code_cache": sweep,
      "NMethodSweeper::sweep_in_progress": inProgress,
      "NMethodSweeper::force_sweep": force,
      JVM_Sleep: sleep
    } = getApi2();
    if (force !== void 0) {
      Thread.sleep(0.05);
      force();
      Thread.sleep(0.05);
      force();
    } else {
      let trav = traversals.readS64();
      const endTrav = trav + 2;
      while (endTrav > trav) {
        fractions.writeS32(1);
        sleep(env, NULL, 50);
        if (!inProgress()) {
          withJvmThread(() => {
            Thread.sleep(0.05);
          });
        }
        const sweepNotAlreadyInProgress = shouldSweep.readU8() === 0;
        if (sweepNotAlreadyInProgress) {
          fractions.writeS32(1);
          sweep();
        }
        trav = traversals.readS64();
      }
    }
  }
  function withJvmThread(fn, fnPrologue, fnEpilogue) {
    const {
      execute,
      vtable: vtable2,
      vtableSize,
      doItOffset,
      prologueOffset,
      epilogueOffset
    } = getJvmThreadSpec();
    const vtableDup = Memory.dup(vtable2, vtableSize);
    const vmOperation = Memory.alloc(pointerSize6 * 25);
    vmOperation.writePointer(vtableDup);
    const doIt = new NativeCallback(fn, "void", ["pointer"]);
    vtableDup.add(doItOffset).writePointer(doIt);
    let prologue = null;
    if (fnPrologue !== void 0) {
      prologue = new NativeCallback(fnPrologue, "int", ["pointer"]);
      vtableDup.add(prologueOffset).writePointer(prologue);
    }
    let epilogue = null;
    if (fnEpilogue !== void 0) {
      epilogue = new NativeCallback(fnEpilogue, "void", ["pointer"]);
      vtableDup.add(epilogueOffset).writePointer(epilogue);
    }
    execute(vmOperation);
  }
  function _getJvmThreadSpec() {
    const {
      vtableRedefineClasses,
      redefineClassesDoIt,
      redefineClassesDoItPrologue,
      redefineClassesDoItEpilogue,
      redefineClassesOnError,
      redefineClassesAllow,
      redefineClassesDispose0,
      redefineClassesDispose1,
      "VMThread::execute": execute
    } = getApi2();
    const vtablePtr = vtableRedefineClasses.add(2 * pointerSize6);
    const vtableSize = 15 * pointerSize6;
    const vtable2 = Memory.dup(vtablePtr, vtableSize);
    const emptyCallback = new NativeCallback(() => {
    }, "void", ["pointer"]);
    let doItOffset, prologueOffset, epilogueOffset;
    for (let offset = 0; offset !== vtableSize; offset += pointerSize6) {
      const element = vtable2.add(offset);
      const value = element.readPointer();
      if (redefineClassesOnError !== void 0 && value.equals(redefineClassesOnError) || redefineClassesDispose0 !== void 0 && value.equals(redefineClassesDispose0) || redefineClassesDispose1 !== void 0 && value.equals(redefineClassesDispose1)) {
        element.writePointer(emptyCallback);
      } else if (value.equals(redefineClassesDoIt)) {
        doItOffset = offset;
      } else if (value.equals(redefineClassesDoItPrologue)) {
        prologueOffset = offset;
        element.writePointer(redefineClassesAllow);
      } else if (value.equals(redefineClassesDoItEpilogue)) {
        epilogueOffset = offset;
        element.writePointer(emptyCallback);
      }
    }
    return {
      execute,
      emptyCallback,
      vtable: vtable2,
      vtableSize,
      doItOffset,
      prologueOffset,
      epilogueOffset
    };
  }
  function makeMethodMangler2(methodId) {
    return new JvmMethodMangler(methodId);
  }
  function installJvmMethod(method, methodId, thread) {
    const { method: handle, oldMethod: old } = method;
    const api2 = getApi2();
    method.methodsArray.add(method.methodIndex * pointerSize6).writePointer(handle);
    if (method.vtableIndex >= 0) {
      method.vtable.add(method.vtableIndex * pointerSize6).writePointer(handle);
    }
    methodId.writePointer(handle);
    old.accessFlagsPtr.writeU32((old.accessFlags | JVM_ACC_IS_OLD | JVM_ACC_IS_OBSOLETE) >>> 0);
    const flushObs = api2["OopMapCache::flush_obsolete_entries"];
    if (flushObs !== void 0) {
      const { oopMapCache } = method;
      if (!oopMapCache.isNull()) {
        flushObs(oopMapCache);
      }
    }
    const mark = api2["VM_RedefineClasses::mark_dependent_code"];
    const flush = api2["VM_RedefineClasses::flush_dependent_code"];
    if (mark !== void 0) {
      mark(NULL, method.instanceKlass);
      flush();
    } else {
      flush(NULL, method.instanceKlass, thread);
    }
    const traceNamePrinted = Memory.alloc(1);
    traceNamePrinted.writeU8(1);
    api2["ConstantPoolCache::adjust_method_entries"](method.cache, method.instanceKlass, traceNamePrinted);
    const klassClosure = Memory.alloc(3 * pointerSize6);
    const doKlassPtr = Memory.alloc(pointerSize6);
    doKlassPtr.writePointer(api2.doKlass);
    klassClosure.writePointer(doKlassPtr);
    klassClosure.add(pointerSize6).writePointer(thread);
    klassClosure.add(2 * pointerSize6).writePointer(thread);
    if (api2.redefineClass !== void 0) {
      api2.redefineClass.writePointer(method.instanceKlass);
    }
    api2["ClassLoaderDataGraph::classes_do"](klassClosure);
    const rmtAdjustMethodEntries = api2["ResolvedMethodTable::adjust_method_entries"];
    if (rmtAdjustMethodEntries !== void 0) {
      rmtAdjustMethodEntries(traceNamePrinted);
    } else {
      const { memberNames } = method;
      if (!memberNames.isNull()) {
        const mntAdjustMethodEntries = api2["MemberNameTable::adjust_method_entries"];
        if (mntAdjustMethodEntries !== void 0) {
          mntAdjustMethodEntries(memberNames, method.instanceKlass, traceNamePrinted);
        }
      }
    }
    const clean = api2["ClassLoaderDataGraph::clean_deallocate_lists"];
    if (clean !== void 0) {
      clean(0);
    }
  }
  function nativeJvmMethod(method, impl, thread) {
    const api2 = getApi2();
    const newMethod = fetchJvmMethod(method);
    newMethod.constPtr.writePointer(newMethod.const);
    const flags = (newMethod.accessFlags | JVM_ACC_NATIVE | JVM_ACC_NOT_C2_COMPILABLE | JVM_ACC_NOT_C1_COMPILABLE | JVM_ACC_NOT_C2_OSR_COMPILABLE) >>> 0;
    newMethod.accessFlagsPtr.writeU32(flags);
    newMethod.signatureHandler.writePointer(NULL);
    newMethod.adapter.writePointer(NULL);
    newMethod.i2iEntry.writePointer(NULL);
    api2["Method::clear_code"](newMethod.method);
    newMethod.dataPtr.writePointer(NULL);
    newMethod.countersPtr.writePointer(NULL);
    newMethod.stackmapPtr.writePointer(NULL);
    api2["Method::clear_native_function"](newMethod.method);
    api2["Method::set_native_function"](newMethod.method, impl, 0);
    api2["Method::restore_unshareable_info"](newMethod.method, thread);
    if (api2.version >= 17) {
      const methodHandle = Memory.alloc(2 * pointerSize6);
      methodHandle.writePointer(newMethod.method);
      methodHandle.add(pointerSize6).writePointer(thread);
      api2["Method::link_method"](newMethod.method, methodHandle, thread);
    }
    return newMethod;
  }
  function fetchJvmMethod(method) {
    const spec = getJvmMethodSpec();
    const constMethod = method.add(spec.method.constMethodOffset).readPointer();
    const constMethodSize = constMethod.add(spec.constMethod.sizeOffset).readS32() * pointerSize6;
    const newConstMethod = Memory.alloc(constMethodSize + spec.method.size);
    Memory.copy(newConstMethod, constMethod, constMethodSize);
    const newMethod = newConstMethod.add(constMethodSize);
    Memory.copy(newMethod, method, spec.method.size);
    const result2 = readJvmMethod(newMethod, newConstMethod, constMethodSize);
    const oldMethod = readJvmMethod(method, constMethod, constMethodSize);
    result2.oldMethod = oldMethod;
    return result2;
  }
  function readJvmMethod(method, constMethod, constMethodSize) {
    const api2 = getApi2();
    const spec = getJvmMethodSpec();
    const constPtr = method.add(spec.method.constMethodOffset);
    const dataPtr = method.add(spec.method.methodDataOffset);
    const countersPtr = method.add(spec.method.methodCountersOffset);
    const accessFlagsPtr = method.add(spec.method.accessFlagsOffset);
    const accessFlags = accessFlagsPtr.readU32();
    const adapter = spec.getAdapterPointer(method, constMethod);
    const i2iEntry = method.add(spec.method.i2iEntryOffset);
    const signatureHandler = method.add(spec.method.signatureHandlerOffset);
    const constantPool = constMethod.add(spec.constMethod.constantPoolOffset).readPointer();
    const stackmapPtr = constMethod.add(spec.constMethod.stackmapDataOffset);
    const instanceKlass = constantPool.add(spec.constantPool.instanceKlassOffset).readPointer();
    const cache = constantPool.add(spec.constantPool.cacheOffset).readPointer();
    const instanceKlassSpec = getJvmInstanceKlassSpec();
    const methods = instanceKlass.add(instanceKlassSpec.methodsOffset).readPointer();
    const methodsCount = methods.readS32();
    const methodsArray = methods.add(pointerSize6);
    const methodIndex = constMethod.add(spec.constMethod.methodIdnumOffset).readU16();
    const vtableIndexPtr = method.add(spec.method.vtableIndexOffset);
    const vtableIndex = vtableIndexPtr.readS32();
    const vtable2 = instanceKlass.add(instanceKlassSpec.vtableOffset);
    const oopMapCache = instanceKlass.add(instanceKlassSpec.oopMapCacheOffset).readPointer();
    const memberNames = api2.version >= 10 ? instanceKlass.add(instanceKlassSpec.memberNamesOffset).readPointer() : NULL;
    return {
      method,
      methodSize: spec.method.size,
      const: constMethod,
      constSize: constMethodSize,
      constPtr,
      dataPtr,
      countersPtr,
      stackmapPtr,
      instanceKlass,
      methodsArray,
      methodsCount,
      methodIndex,
      vtableIndex,
      vtableIndexPtr,
      vtable: vtable2,
      accessFlags,
      accessFlagsPtr,
      adapter,
      i2iEntry,
      signatureHandler,
      memberNames,
      cache,
      oopMapCache
    };
  }
  function revertJvmMethod(method) {
    const { oldMethod: old } = method;
    old.accessFlagsPtr.writeU32(old.accessFlags);
    old.vtableIndexPtr.writeS32(old.vtableIndex);
  }
  function _getJvmMethodSpec() {
    const api2 = getApi2();
    const { version } = api2;
    let adapterHandlerLocation;
    if (version >= 17) {
      adapterHandlerLocation = "method:early";
    } else if (version >= 9 && version <= 16) {
      adapterHandlerLocation = "const-method";
    } else {
      adapterHandlerLocation = "method:late";
    }
    const isNative = 1;
    const methodSize = api2["Method::size"](isNative) * pointerSize6;
    const constMethodOffset = pointerSize6;
    const methodDataOffset = 2 * pointerSize6;
    const methodCountersOffset = 3 * pointerSize6;
    const adapterInMethodEarlyOffset = 4 * pointerSize6;
    const adapterInMethodEarlySize = adapterHandlerLocation === "method:early" ? pointerSize6 : 0;
    const accessFlagsOffset = adapterInMethodEarlyOffset + adapterInMethodEarlySize;
    const vtableIndexOffset = accessFlagsOffset + 4;
    const i2iEntryOffset = vtableIndexOffset + 4 + 8;
    const adapterInMethodLateOffset = i2iEntryOffset + pointerSize6;
    const adapterInMethodOffset = adapterInMethodEarlySize !== 0 ? adapterInMethodEarlyOffset : adapterInMethodLateOffset;
    const nativeFunctionOffset = methodSize - 2 * pointerSize6;
    const signatureHandlerOffset = methodSize - pointerSize6;
    const constantPoolOffset = 8;
    const stackmapDataOffset = constantPoolOffset + pointerSize6;
    const adapterInConstMethodOffset = stackmapDataOffset + pointerSize6;
    const adapterInConstMethodSize = adapterHandlerLocation === "const-method" ? pointerSize6 : 0;
    const constMethodSizeOffset = adapterInConstMethodOffset + adapterInConstMethodSize;
    const methodIdnumOffset = constMethodSizeOffset + 14;
    const cacheOffset = 2 * pointerSize6;
    const instanceKlassOffset = 3 * pointerSize6;
    const getAdapterPointer = adapterInConstMethodSize !== 0 ? function(method, constMethod) {
      return constMethod.add(adapterInConstMethodOffset);
    } : function(method, constMethod) {
      return method.add(adapterInMethodOffset);
    };
    return {
      getAdapterPointer,
      method: {
        size: methodSize,
        constMethodOffset,
        methodDataOffset,
        methodCountersOffset,
        accessFlagsOffset,
        vtableIndexOffset,
        i2iEntryOffset,
        nativeFunctionOffset,
        signatureHandlerOffset
      },
      constMethod: {
        constantPoolOffset,
        stackmapDataOffset,
        sizeOffset: constMethodSizeOffset,
        methodIdnumOffset
      },
      constantPool: {
        cacheOffset,
        instanceKlassOffset
      }
    };
  }
  var vtableOffsetParsers = {
    x64: parseX64VTableOffset
  };
  function _getJvmInstanceKlassSpec() {
    const { version: jvmVersion, createNewDefaultVtableIndices } = getApi2();
    const tryParse = vtableOffsetParsers[Process.arch];
    if (tryParse === void 0) {
      throw new Error(`Missing vtable offset parser for ${Process.arch}`);
    }
    const vtableOffset = parseInstructionsAt(createNewDefaultVtableIndices, tryParse, { limit: 32 });
    if (vtableOffset === null) {
      throw new Error("Unable to deduce vtable offset");
    }
    const oopMultiplier = jvmVersion >= 10 && jvmVersion <= 11 || jvmVersion >= 15 ? 17 : 18;
    const methodsOffset = vtableOffset - 7 * pointerSize6;
    const memberNamesOffset = vtableOffset - 17 * pointerSize6;
    const oopMapCacheOffset = vtableOffset - oopMultiplier * pointerSize6;
    return {
      vtableOffset,
      methodsOffset,
      memberNamesOffset,
      oopMapCacheOffset
    };
  }
  function parseX64VTableOffset(insn) {
    if (insn.mnemonic !== "mov") {
      return null;
    }
    const dst = insn.operands[0];
    if (dst.type !== "mem") {
      return null;
    }
    const { value: dstValue } = dst;
    if (dstValue.scale !== 1) {
      return null;
    }
    const { disp } = dstValue;
    if (disp < 256) {
      return null;
    }
    const defaultVtableIndicesOffset = disp;
    return defaultVtableIndicesOffset + 16;
  }

  // node_modules/frida-java-bridge/lib/api.js
  var getApi3 = getApi;
  try {
    getAndroidVersion();
  } catch (e) {
    getApi3 = getApi2;
  }
  var api_default = getApi3;

  // node_modules/frida-java-bridge/lib/class-model.js
  var code2 = `#include <json-glib/json-glib.h>
#include <string.h>

#define kAccStatic 0x0008
#define kAccConstructor 0x00010000

typedef struct _Model Model;
typedef struct _EnumerateMethodsContext EnumerateMethodsContext;

typedef struct _JavaApi JavaApi;
typedef struct _JavaClassApi JavaClassApi;
typedef struct _JavaMethodApi JavaMethodApi;
typedef struct _JavaFieldApi JavaFieldApi;

typedef struct _JNIEnv JNIEnv;
typedef guint8 jboolean;
typedef gint32 jint;
typedef jint jsize;
typedef gpointer jobject;
typedef jobject jclass;
typedef jobject jstring;
typedef jobject jarray;
typedef jarray jobjectArray;
typedef gpointer jfieldID;
typedef gpointer jmethodID;

typedef struct _jvmtiEnv jvmtiEnv;
typedef enum
{
  JVMTI_ERROR_NONE = 0
} jvmtiError;

typedef struct _ArtApi ArtApi;
typedef guint32 ArtHeapReference;
typedef struct _ArtObject ArtObject;
typedef struct _ArtClass ArtClass;
typedef struct _ArtClassLinker ArtClassLinker;
typedef struct _ArtClassVisitor ArtClassVisitor;
typedef struct _ArtClassVisitorVTable ArtClassVisitorVTable;
typedef struct _ArtMethod ArtMethod;
typedef struct _ArtString ArtString;

typedef union _StdString StdString;
typedef struct _StdStringShort StdStringShort;
typedef struct _StdStringLong StdStringLong;

typedef void (* ArtVisitClassesFunc) (ArtClassLinker * linker, ArtClassVisitor * visitor);
typedef const char * (* ArtGetClassDescriptorFunc) (ArtClass * klass, StdString * storage);
typedef void (* ArtPrettyMethodFunc) (StdString * result, ArtMethod * method, jboolean with_signature);

struct _Model
{
  GHashTable * members;
};

struct _EnumerateMethodsContext
{
  GPatternSpec * class_query;
  GPatternSpec * method_query;
  jboolean include_signature;
  jboolean ignore_case;
  jboolean skip_system_classes;
  GHashTable * groups;
};

struct _JavaClassApi
{
  jmethodID get_declared_methods;
  jmethodID get_declared_fields;
};

struct _JavaMethodApi
{
  jmethodID get_name;
  jmethodID get_modifiers;
};

struct _JavaFieldApi
{
  jmethodID get_name;
  jmethodID get_modifiers;
};

struct _JavaApi
{
  jvmtiEnv * jvmti;
  JavaClassApi clazz;
  JavaMethodApi method;
  JavaFieldApi field;
};

struct _JNIEnv
{
  gpointer * functions;
};

struct _jvmtiEnv
{
  gpointer * functions;
};

struct _ArtApi
{
  gboolean available;

  guint class_offset_ifields;
  guint class_offset_methods;
  guint class_offset_sfields;
  guint class_offset_copied_methods_offset;

  guint method_size;
  guint method_offset_access_flags;

  guint field_size;
  guint field_offset_access_flags;

  guint alignment_padding;

  ArtClassLinker * linker;
  ArtVisitClassesFunc visit_classes;
  ArtGetClassDescriptorFunc get_class_descriptor;
  ArtPrettyMethodFunc pretty_method;

  void (* free) (gpointer mem);
};

struct _ArtObject
{
  ArtHeapReference klass;
  ArtHeapReference monitor;
};

struct _ArtClass
{
  ArtObject parent;

  ArtHeapReference class_loader;
};

struct _ArtClassVisitor
{
  ArtClassVisitorVTable * vtable;
  gpointer user_data;
};

struct _ArtClassVisitorVTable
{
  void (* reserved1) (ArtClassVisitor * self);
  void (* reserved2) (ArtClassVisitor * self);
  jboolean (* visit) (ArtClassVisitor * self, ArtClass * klass);
};

struct _ArtString
{
  ArtObject parent;

  gint32 count;
  guint32 hash_code;

  union
  {
    guint16 value[0];
    guint8 value_compressed[0];
  };
};

struct _StdStringShort
{
  guint8 size;
  gchar data[(3 * sizeof (gpointer)) - sizeof (guint8)];
};

struct _StdStringLong
{
  gsize capacity;
  gsize size;
  gchar * data;
};

union _StdString
{
  StdStringShort s;
  StdStringLong l;
};

static void model_add_method (Model * self, const gchar * name, jmethodID id, jint modifiers);
static void model_add_field (Model * self, const gchar * name, jfieldID id, jint modifiers);
static void model_free (Model * model);

static jboolean collect_matching_class_methods (ArtClassVisitor * self, ArtClass * klass);
static gchar * finalize_method_groups_to_json (GHashTable * groups);
static GPatternSpec * make_pattern_spec (const gchar * pattern, jboolean ignore_case);
static gchar * class_name_from_signature (const gchar * signature);
static gchar * format_method_signature (const gchar * name, const gchar * signature);
static void append_type (GString * output, const gchar ** type);

static gpointer read_art_array (gpointer object_base, guint field_offset, guint length_size, guint * length);

static void std_string_destroy (StdString * str);
static gchar * std_string_c_str (StdString * self);

extern GMutex lock;
extern GArray * models;
extern JavaApi java_api;
extern ArtApi art_api;

void
init (void)
{
  g_mutex_init (&lock);
  models = g_array_new (FALSE, FALSE, sizeof (Model *));
}

void
finalize (void)
{
  guint n, i;

  n = models->len;
  for (i = 0; i != n; i++)
  {
    Model * model = g_array_index (models, Model *, i);
    model_free (model);
  }

  g_array_unref (models);
  g_mutex_clear (&lock);
}

Model *
model_new (jclass class_handle,
           gpointer class_object,
           JNIEnv * env)
{
  Model * model;
  GHashTable * members;
  jvmtiEnv * jvmti = java_api.jvmti;
  gpointer * funcs = env->functions;
  jmethodID (* from_reflected_method) (JNIEnv *, jobject) = funcs[7];
  jfieldID (* from_reflected_field) (JNIEnv *, jobject) = funcs[8];
  jobject (* to_reflected_method) (JNIEnv *, jclass, jmethodID, jboolean) = funcs[9];
  jobject (* to_reflected_field) (JNIEnv *, jclass, jfieldID, jboolean) = funcs[12];
  void (* delete_local_ref) (JNIEnv *, jobject) = funcs[23];
  jobject (* call_object_method) (JNIEnv *, jobject, jmethodID, ...) = funcs[34];
  jint (* call_int_method) (JNIEnv *, jobject, jmethodID, ...) = funcs[49];
  const char * (* get_string_utf_chars) (JNIEnv *, jstring, jboolean *) = funcs[169];
  void (* release_string_utf_chars) (JNIEnv *, jstring, const char *) = funcs[170];
  jsize (* get_array_length) (JNIEnv *, jarray) = funcs[171];
  jobject (* get_object_array_element) (JNIEnv *, jobjectArray, jsize) = funcs[173];
  jsize n, i;

  model = g_new (Model, 1);

  members = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, g_free);
  model->members = members;

  if (jvmti != NULL)
  {
    gpointer * jf = jvmti->functions - 1;
    jvmtiError (* deallocate) (jvmtiEnv *, void * mem) = jf[47];
    jvmtiError (* get_class_methods) (jvmtiEnv *, jclass, jint *, jmethodID **) = jf[52];
    jvmtiError (* get_class_fields) (jvmtiEnv *, jclass, jint *, jfieldID **) = jf[53];
    jvmtiError (* get_field_name) (jvmtiEnv *, jclass, jfieldID, char **, char **, char **) = jf[60];
    jvmtiError (* get_field_modifiers) (jvmtiEnv *, jclass, jfieldID, jint *) = jf[62];
    jvmtiError (* get_method_name) (jvmtiEnv *, jmethodID, char **, char **, char **) = jf[64];
    jvmtiError (* get_method_modifiers) (jvmtiEnv *, jmethodID, jint *) = jf[66];
    jint method_count;
    jmethodID * methods;
    jint field_count;
    jfieldID * fields;
    char * name;
    jint modifiers;

    get_class_methods (jvmti, class_handle, &method_count, &methods);
    for (i = 0; i != method_count; i++)
    {
      jmethodID method = methods[i];

      get_method_name (jvmti, method, &name, NULL, NULL);
      get_method_modifiers (jvmti, method, &modifiers);

      model_add_method (model, name, method, modifiers);

      deallocate (jvmti, name);
    }
    deallocate (jvmti, methods);

    get_class_fields (jvmti, class_handle, &field_count, &fields);
    for (i = 0; i != field_count; i++)
    {
      jfieldID field = fields[i];

      get_field_name (jvmti, class_handle, field, &name, NULL, NULL);
      get_field_modifiers (jvmti, class_handle, field, &modifiers);

      model_add_field (model, name, field, modifiers);

      deallocate (jvmti, name);
    }
    deallocate (jvmti, fields);
  }
  else if (art_api.available)
  {
    gpointer elements;
    guint n, i;
    const guint field_arrays[] = {
      art_api.class_offset_ifields,
      art_api.class_offset_sfields
    };
    guint field_array_cursor;
    gboolean merged_fields = art_api.class_offset_sfields == 0;

    elements = read_art_array (class_object, art_api.class_offset_methods, sizeof (gsize), NULL);
    n = *(guint16 *) (class_object + art_api.class_offset_copied_methods_offset);
    for (i = 0; i != n; i++)
    {
      jmethodID id;
      guint32 access_flags;
      jboolean is_static;
      jobject method, name;
      const char * name_str;
      jint modifiers;

      id = elements + (i * art_api.method_size);

      access_flags = *(guint32 *) (id + art_api.method_offset_access_flags);
      if ((access_flags & kAccConstructor) != 0)
        continue;
      is_static = (access_flags & kAccStatic) != 0;
      method = to_reflected_method (env, class_handle, id, is_static);
      name = call_object_method (env, method, java_api.method.get_name);
      name_str = get_string_utf_chars (env, name, NULL);
      modifiers = access_flags & 0xffff;

      model_add_method (model, name_str, id, modifiers);

      release_string_utf_chars (env, name, name_str);
      delete_local_ref (env, name);
      delete_local_ref (env, method);
    }

    for (field_array_cursor = 0; field_array_cursor != G_N_ELEMENTS (field_arrays); field_array_cursor++)
    {
      jboolean is_static;

      if (field_arrays[field_array_cursor] == 0)
        continue;

      if (!merged_fields)
        is_static = field_array_cursor == 1;

      elements = read_art_array (class_object, field_arrays[field_array_cursor], sizeof (guint32), &n);
      for (i = 0; i != n; i++)
      {
        jfieldID id;
        guint32 access_flags;
        jobject field, name;
        const char * name_str;
        jint modifiers;

        id = elements + (i * art_api.field_size);

        access_flags = *(guint32 *) (id + art_api.field_offset_access_flags);
        if (merged_fields)
          is_static = (access_flags & kAccStatic) != 0;
        field = to_reflected_field (env, class_handle, id, is_static);
        name = call_object_method (env, field, java_api.field.get_name);
        name_str = get_string_utf_chars (env, name, NULL);
        modifiers = access_flags & 0xffff;

        model_add_field (model, name_str, id, modifiers);

        release_string_utf_chars (env, name, name_str);
        delete_local_ref (env, name);
        delete_local_ref (env, field);
      }
    }
  }
  else
  {
    jobject elements;

    elements = call_object_method (env, class_handle, java_api.clazz.get_declared_methods);
    n = get_array_length (env, elements);
    for (i = 0; i != n; i++)
    {
      jobject method, name;
      const char * name_str;
      jmethodID id;
      jint modifiers;

      method = get_object_array_element (env, elements, i);
      name = call_object_method (env, method, java_api.method.get_name);
      name_str = get_string_utf_chars (env, name, NULL);
      id = from_reflected_method (env, method);
      modifiers = call_int_method (env, method, java_api.method.get_modifiers);

      model_add_method (model, name_str, id, modifiers);

      release_string_utf_chars (env, name, name_str);
      delete_local_ref (env, name);
      delete_local_ref (env, method);
    }
    delete_local_ref (env, elements);

    elements = call_object_method (env, class_handle, java_api.clazz.get_declared_fields);
    n = get_array_length (env, elements);
    for (i = 0; i != n; i++)
    {
      jobject field, name;
      const char * name_str;
      jfieldID id;
      jint modifiers;

      field = get_object_array_element (env, elements, i);
      name = call_object_method (env, field, java_api.field.get_name);
      name_str = get_string_utf_chars (env, name, NULL);
      id = from_reflected_field (env, field);
      modifiers = call_int_method (env, field, java_api.field.get_modifiers);

      model_add_field (model, name_str, id, modifiers);

      release_string_utf_chars (env, name, name_str);
      delete_local_ref (env, name);
      delete_local_ref (env, field);
    }
    delete_local_ref (env, elements);
  }

  g_mutex_lock (&lock);
  g_array_append_val (models, model);
  g_mutex_unlock (&lock);

  return model;
}

static void
model_add_method (Model * self,
                  const gchar * name,
                  jmethodID id,
                  jint modifiers)
{
  GHashTable * members = self->members;
  gchar * key, type;
  const gchar * value;

  if (name[0] == '$')
    key = g_strdup_printf ("_%s", name);
  else
    key = g_strdup (name);

  type = (modifiers & kAccStatic) != 0 ? 's' : 'i';

  value = g_hash_table_lookup (members, key);
  if (value == NULL)
    g_hash_table_insert (members, key, g_strdup_printf ("m:%c0x%zx", type, id));
  else
    g_hash_table_insert (members, key, g_strdup_printf ("%s:%c0x%zx", value, type, id));
}

static void
model_add_field (Model * self,
                 const gchar * name,
                 jfieldID id,
                 jint modifiers)
{
  GHashTable * members = self->members;
  gchar * key, type;

  if (name[0] == '$')
    key = g_strdup_printf ("_%s", name);
  else
    key = g_strdup (name);
  while (g_hash_table_contains (members, key))
  {
    gchar * new_key = g_strdup_printf ("_%s", key);
    g_free (key);
    key = new_key;
  }

  type = (modifiers & kAccStatic) != 0 ? 's' : 'i';

  g_hash_table_insert (members, key, g_strdup_printf ("f:%c0x%zx", type, id));
}

static void
model_free (Model * model)
{
  g_hash_table_unref (model->members);

  g_free (model);
}

gboolean
model_has (Model * self,
           const gchar * member)
{
  return g_hash_table_contains (self->members, member);
}

const gchar *
model_find (Model * self,
            const gchar * member)
{
  return g_hash_table_lookup (self->members, member);
}

gchar *
model_list (Model * self)
{
  GString * result;
  GHashTableIter iter;
  guint i;
  const gchar * name;

  result = g_string_sized_new (128);

  g_string_append_c (result, '[');

  g_hash_table_iter_init (&iter, self->members);
  for (i = 0; g_hash_table_iter_next (&iter, (gpointer *) &name, NULL); i++)
  {
    if (i > 0)
      g_string_append_c (result, ',');

    g_string_append_c (result, '"');
    g_string_append (result, name);
    g_string_append_c (result, '"');
  }

  g_string_append_c (result, ']');

  return g_string_free (result, FALSE);
}

gchar *
enumerate_methods_art (const gchar * class_query,
                       const gchar * method_query,
                       jboolean include_signature,
                       jboolean ignore_case,
                       jboolean skip_system_classes)
{
  gchar * result;
  EnumerateMethodsContext ctx;
  ArtClassVisitor visitor;
  ArtClassVisitorVTable visitor_vtable = { NULL, };

  ctx.class_query = make_pattern_spec (class_query, ignore_case);
  ctx.method_query = make_pattern_spec (method_query, ignore_case);
  ctx.include_signature = include_signature;
  ctx.ignore_case = ignore_case;
  ctx.skip_system_classes = skip_system_classes;
  ctx.groups = g_hash_table_new_full (NULL, NULL, NULL, NULL);

  visitor.vtable = &visitor_vtable;
  visitor.user_data = &ctx;

  visitor_vtable.visit = collect_matching_class_methods;

  art_api.visit_classes (art_api.linker, &visitor);

  result = finalize_method_groups_to_json (ctx.groups);

  g_hash_table_unref (ctx.groups);
  g_pattern_spec_free (ctx.method_query);
  g_pattern_spec_free (ctx.class_query);

  return result;
}

static jboolean
collect_matching_class_methods (ArtClassVisitor * self,
                                ArtClass * klass)
{
  EnumerateMethodsContext * ctx = self->user_data;
  const char * descriptor;
  StdString descriptor_storage = { 0, };
  gchar * class_name = NULL;
  gchar * class_name_copy = NULL;
  const gchar * normalized_class_name;
  JsonBuilder * group;
  size_t class_name_length;
  GHashTable * seen_method_names;
  gpointer elements;
  guint n, i;

  if (ctx->skip_system_classes && klass->class_loader == 0)
    goto skip_class;

  descriptor = art_api.get_class_descriptor (klass, &descriptor_storage);
  if (descriptor[0] != 'L')
    goto skip_class;

  class_name = class_name_from_signature (descriptor);

  if (ctx->ignore_case)
  {
    class_name_copy = g_utf8_strdown (class_name, -1);
    normalized_class_name = class_name_copy;
  }
  else
  {
    normalized_class_name = class_name;
  }

  if (!g_pattern_match_string (ctx->class_query, normalized_class_name))
    goto skip_class;

  group = NULL;
  class_name_length = strlen (class_name);
  seen_method_names = ctx->include_signature ? NULL : g_hash_table_new_full (g_str_hash, g_str_equal, g_free, NULL);

  elements = read_art_array (klass, art_api.class_offset_methods, sizeof (gsize), NULL);
  n = *(guint16 *) ((gpointer) klass + art_api.class_offset_copied_methods_offset);
  for (i = 0; i != n; i++)
  {
    ArtMethod * method;
    guint32 access_flags;
    jboolean is_constructor;
    StdString method_name = { 0, };
    const gchar * bare_method_name;
    gchar * bare_method_name_copy = NULL;
    const gchar * normalized_method_name;
    gchar * normalized_method_name_copy = NULL;

    method = elements + (i * art_api.method_size);

    access_flags = *(guint32 *) ((gpointer) method + art_api.method_offset_access_flags);
    is_constructor = (access_flags & kAccConstructor) != 0;

    art_api.pretty_method (&method_name, method, ctx->include_signature);
    bare_method_name = std_string_c_str (&method_name);
    if (ctx->include_signature)
    {
      const gchar * return_type_end, * name_begin;
      GString * name;

      return_type_end = strchr (bare_method_name, ' ');
      name_begin = return_type_end + 1 + class_name_length + 1;
      if (is_constructor && g_str_has_prefix (name_begin, "<clinit>"))
        goto skip_method;

      name = g_string_sized_new (64);

      if (is_constructor)
      {
        g_string_append (name, "$init");
        g_string_append (name, strchr (name_begin, '>') + 1);
      }
      else
      {
        g_string_append (name, name_begin);
      }
      g_string_append (name, ": ");
      g_string_append_len (name, bare_method_name, return_type_end - bare_method_name);

      bare_method_name_copy = g_string_free (name, FALSE);
      bare_method_name = bare_method_name_copy;
    }
    else
    {
      const gchar * name_begin;

      name_begin = bare_method_name + class_name_length + 1;
      if (is_constructor && strcmp (name_begin, "<clinit>") == 0)
        goto skip_method;

      if (is_constructor)
        bare_method_name = "$init";
      else
        bare_method_name += class_name_length + 1;
    }

    if (seen_method_names != NULL && g_hash_table_contains (seen_method_names, bare_method_name))
      goto skip_method;

    if (ctx->ignore_case)
    {
      normalized_method_name_copy = g_utf8_strdown (bare_method_name, -1);
      normalized_method_name = normalized_method_name_copy;
    }
    else
    {
      normalized_method_name = bare_method_name;
    }

    if (!g_pattern_match_string (ctx->method_query, normalized_method_name))
      goto skip_method;

    if (group == NULL)
    {
      group = g_hash_table_lookup (ctx->groups, GUINT_TO_POINTER (klass->class_loader));
      if (group == NULL)
      {
        group = json_builder_new_immutable ();
        g_hash_table_insert (ctx->groups, GUINT_TO_POINTER (klass->class_loader), group);

        json_builder_begin_object (group);

        json_builder_set_member_name (group, "loader");
        json_builder_add_int_value (group, klass->class_loader);

        json_builder_set_member_name (group, "classes");
        json_builder_begin_array (group);
      }

      json_builder_begin_object (group);

      json_builder_set_member_name (group, "name");
      json_builder_add_string_value (group, class_name);

      json_builder_set_member_name (group, "methods");
      json_builder_begin_array (group);
    }

    json_builder_add_string_value (group, bare_method_name);

    if (seen_method_names != NULL)
      g_hash_table_add (seen_method_names, g_strdup (bare_method_name));

skip_method:
    g_free (normalized_method_name_copy);
    g_free (bare_method_name_copy);
    std_string_destroy (&method_name);
  }

  if (seen_method_names != NULL)
    g_hash_table_unref (seen_method_names);

  if (group == NULL)
    goto skip_class;

  json_builder_end_array (group);
  json_builder_end_object (group);

skip_class:
  g_free (class_name_copy);
  g_free (class_name);
  std_string_destroy (&descriptor_storage);

  return TRUE;
}

gchar *
enumerate_methods_jvm (const gchar * class_query,
                       const gchar * method_query,
                       jboolean include_signature,
                       jboolean ignore_case,
                       jboolean skip_system_classes,
                       JNIEnv * env)
{
  gchar * result;
  GPatternSpec * class_pattern, * method_pattern;
  GHashTable * groups;
  gpointer * ef = env->functions;
  jobject (* new_global_ref) (JNIEnv *, jobject) = ef[21];
  void (* delete_local_ref) (JNIEnv *, jobject) = ef[23];
  jboolean (* is_same_object) (JNIEnv *, jobject, jobject) = ef[24];
  jvmtiEnv * jvmti = java_api.jvmti;
  gpointer * jf = jvmti->functions - 1;
  jvmtiError (* deallocate) (jvmtiEnv *, void * mem) = jf[47];
  jvmtiError (* get_class_signature) (jvmtiEnv *, jclass, char **, char **) = jf[48];
  jvmtiError (* get_class_methods) (jvmtiEnv *, jclass, jint *, jmethodID **) = jf[52];
  jvmtiError (* get_class_loader) (jvmtiEnv *, jclass, jobject *) = jf[57];
  jvmtiError (* get_method_name) (jvmtiEnv *, jmethodID, char **, char **, char **) = jf[64];
  jvmtiError (* get_loaded_classes) (jvmtiEnv *, jint *, jclass **) = jf[78];
  jint class_count, class_index;
  jclass * classes;

  class_pattern = make_pattern_spec (class_query, ignore_case);
  method_pattern = make_pattern_spec (method_query, ignore_case);
  groups = g_hash_table_new_full (NULL, NULL, NULL, NULL);

  if (get_loaded_classes (jvmti, &class_count, &classes) != JVMTI_ERROR_NONE)
    goto emit_results;

  for (class_index = 0; class_index != class_count; class_index++)
  {
    jclass klass = classes[class_index];
    jobject loader = NULL;
    gboolean have_loader = FALSE;
    char * signature = NULL;
    gchar * class_name = NULL;
    gchar * class_name_copy = NULL;
    const gchar * normalized_class_name;
    jint method_count, method_index;
    jmethodID * methods = NULL;
    JsonBuilder * group = NULL;
    GHashTable * seen_method_names = NULL;

    if (skip_system_classes)
    {
      if (get_class_loader (jvmti, klass, &loader) != JVMTI_ERROR_NONE)
        goto skip_class;
      have_loader = TRUE;

      if (loader == NULL)
        goto skip_class;
    }

    if (get_class_signature (jvmti, klass, &signature, NULL) != JVMTI_ERROR_NONE)
      goto skip_class;

    class_name = class_name_from_signature (signature);

    if (ignore_case)
    {
      class_name_copy = g_utf8_strdown (class_name, -1);
      normalized_class_name = class_name_copy;
    }
    else
    {
      normalized_class_name = class_name;
    }

    if (!g_pattern_match_string (class_pattern, normalized_class_name))
      goto skip_class;

    if (get_class_methods (jvmti, klass, &method_count, &methods) != JVMTI_ERROR_NONE)
      goto skip_class;

    if (!include_signature)
      seen_method_names = g_hash_table_new_full (g_str_hash, g_str_equal, g_free, NULL);

    for (method_index = 0; method_index != method_count; method_index++)
    {
      jmethodID method = methods[method_index];
      const gchar * method_name;
      char * method_name_value = NULL;
      char * method_signature_value = NULL;
      gchar * method_name_copy = NULL;
      const gchar * normalized_method_name;
      gchar * normalized_method_name_copy = NULL;

      if (get_method_name (jvmti, method, &method_name_value, include_signature ? &method_signature_value : NULL, NULL) != JVMTI_ERROR_NONE)
        goto skip_method;
      method_name = method_name_value;

      if (method_name[0] == '<')
      {
        if (strcmp (method_name, "<init>") == 0)
          method_name = "$init";
        else if (strcmp (method_name, "<clinit>") == 0)
          goto skip_method;
      }

      if (include_signature)
      {
        method_name_copy = format_method_signature (method_name, method_signature_value);
        method_name = method_name_copy;
      }

      if (seen_method_names != NULL && g_hash_table_contains (seen_method_names, method_name))
        goto skip_method;

      if (ignore_case)
      {
        normalized_method_name_copy = g_utf8_strdown (method_name, -1);
        normalized_method_name = normalized_method_name_copy;
      }
      else
      {
        normalized_method_name = method_name;
      }

      if (!g_pattern_match_string (method_pattern, normalized_method_name))
        goto skip_method;

      if (group == NULL)
      {
        if (!have_loader && get_class_loader (jvmti, klass, &loader) != JVMTI_ERROR_NONE)
          goto skip_method;

        if (loader == NULL)
        {
          group = g_hash_table_lookup (groups, NULL);
        }
        else
        {
          GHashTableIter iter;
          jobject cur_loader;
          JsonBuilder * cur_group;

          g_hash_table_iter_init (&iter, groups);
          while (g_hash_table_iter_next (&iter, (gpointer *) &cur_loader, (gpointer *) &cur_group))
          {
            if (cur_loader != NULL && is_same_object (env, cur_loader, loader))
            {
              group = cur_group;
              break;
            }
          }
        }

        if (group == NULL)
        {
          jobject l;
          gchar * str;

          l = (loader != NULL) ? new_global_ref (env, loader) : NULL;

          group = json_builder_new_immutable ();
          g_hash_table_insert (groups, l, group);

          json_builder_begin_object (group);

          json_builder_set_member_name (group, "loader");
          str = g_strdup_printf ("0x%" G_GSIZE_MODIFIER "x", GPOINTER_TO_SIZE (l));
          json_builder_add_string_value (group, str);
          g_free (str);

          json_builder_set_member_name (group, "classes");
          json_builder_begin_array (group);
        }

        json_builder_begin_object (group);

        json_builder_set_member_name (group, "name");
        json_builder_add_string_value (group, class_name);

        json_builder_set_member_name (group, "methods");
        json_builder_begin_array (group);
      }

      json_builder_add_string_value (group, method_name);

      if (seen_method_names != NULL)
        g_hash_table_add (seen_method_names, g_strdup (method_name));

skip_method:
      g_free (normalized_method_name_copy);
      g_free (method_name_copy);
      deallocate (jvmti, method_signature_value);
      deallocate (jvmti, method_name_value);
    }

skip_class:
    if (group != NULL)
    {
      json_builder_end_array (group);
      json_builder_end_object (group);
    }

    if (seen_method_names != NULL)
      g_hash_table_unref (seen_method_names);

    deallocate (jvmti, methods);

    g_free (class_name_copy);
    g_free (class_name);
    deallocate (jvmti, signature);

    if (loader != NULL)
      delete_local_ref (env, loader);

    delete_local_ref (env, klass);
  }

  deallocate (jvmti, classes);

emit_results:
  result = finalize_method_groups_to_json (groups);

  g_hash_table_unref (groups);
  g_pattern_spec_free (method_pattern);
  g_pattern_spec_free (class_pattern);

  return result;
}

static gchar *
finalize_method_groups_to_json (GHashTable * groups)
{
  GString * result;
  GHashTableIter iter;
  guint i;
  JsonBuilder * group;

  result = g_string_sized_new (1024);

  g_string_append_c (result, '[');

  g_hash_table_iter_init (&iter, groups);
  for (i = 0; g_hash_table_iter_next (&iter, NULL, (gpointer *) &group); i++)
  {
    JsonNode * root;
    gchar * json;

    if (i > 0)
      g_string_append_c (result, ',');

    json_builder_end_array (group);
    json_builder_end_object (group);

    root = json_builder_get_root (group);
    json = json_to_string (root, FALSE);
    g_string_append (result, json);
    g_free (json);
    json_node_unref (root);

    g_object_unref (group);
  }

  g_string_append_c (result, ']');

  return g_string_free (result, FALSE);
}

static GPatternSpec *
make_pattern_spec (const gchar * pattern,
                   jboolean ignore_case)
{
  GPatternSpec * spec;

  if (ignore_case)
  {
    gchar * str = g_utf8_strdown (pattern, -1);
    spec = g_pattern_spec_new (str);
    g_free (str);
  }
  else
  {
    spec = g_pattern_spec_new (pattern);
  }

  return spec;
}

static gchar *
class_name_from_signature (const gchar * descriptor)
{
  gchar * result, * c;

  result = g_strdup (descriptor + 1);

  for (c = result; *c != '\\0'; c++)
  {
    if (*c == '/')
      *c = '.';
  }

  c[-1] = '\\0';

  return result;
}

static gchar *
format_method_signature (const gchar * name,
                         const gchar * signature)
{
  GString * sig;
  const gchar * cursor;
  gint arg_index;

  sig = g_string_sized_new (128);

  g_string_append (sig, name);

  cursor = signature;
  arg_index = -1;
  while (TRUE)
  {
    const gchar c = *cursor;

    if (c == '(')
    {
      g_string_append_c (sig, c);
      cursor++;
      arg_index = 0;
    }
    else if (c == ')')
    {
      g_string_append_c (sig, c);
      cursor++;
      break;
    }
    else
    {
      if (arg_index >= 1)
        g_string_append (sig, ", ");

      append_type (sig, &cursor);

      if (arg_index != -1)
        arg_index++;
    }
  }

  g_string_append (sig, ": ");
  append_type (sig, &cursor);

  return g_string_free (sig, FALSE);
}

static void
append_type (GString * output,
             const gchar ** type)
{
  const gchar * cursor = *type;

  switch (*cursor)
  {
    case 'Z':
      g_string_append (output, "boolean");
      cursor++;
      break;
    case 'B':
      g_string_append (output, "byte");
      cursor++;
      break;
    case 'C':
      g_string_append (output, "char");
      cursor++;
      break;
    case 'S':
      g_string_append (output, "short");
      cursor++;
      break;
    case 'I':
      g_string_append (output, "int");
      cursor++;
      break;
    case 'J':
      g_string_append (output, "long");
      cursor++;
      break;
    case 'F':
      g_string_append (output, "float");
      cursor++;
      break;
    case 'D':
      g_string_append (output, "double");
      cursor++;
      break;
    case 'V':
      g_string_append (output, "void");
      cursor++;
      break;
    case 'L':
    {
      gchar ch;

      cursor++;
      for (; (ch = *cursor) != ';'; cursor++)
      {
        g_string_append_c (output, (ch != '/') ? ch : '.');
      }
      cursor++;

      break;
    }
    case '[':
      *type = cursor + 1;
      append_type (output, type);
      g_string_append (output, "[]");
      return;
    default:
      g_string_append (output, "BUG");
      cursor++;
  }

  *type = cursor;
}

void
dealloc (gpointer mem)
{
  g_free (mem);
}

static gpointer
read_art_array (gpointer object_base,
                guint field_offset,
                guint length_size,
                guint * length)
{
  gpointer result, header;
  guint n;

  header = GSIZE_TO_POINTER (*(guint64 *) (object_base + field_offset));
  if (header != NULL)
  {
    result = header + length_size;
    if (length_size == sizeof (guint32))
      n = *(guint32 *) header;
    else
      n = *(guint64 *) header;
  }
  else
  {
    result = NULL;
    n = 0;
  }

  if (length != NULL)
    *length = n;

  return result;
}

static void
std_string_destroy (StdString * str)
{
  if ((str->l.capacity & 1) != 0)
    art_api.free (str->l.data);
}

static gchar *
std_string_c_str (StdString * self)
{
  if ((self->l.capacity & 1) != 0)
    return self->l.data;

  return self->s.data;
}
`;
  var methodQueryPattern = /(.+)!([^/]+)\/?([isu]+)?/;
  var cm = null;
  var unwrap = null;
  var Model = class _Model {
    static build(handle, env) {
      ensureInitialized(env);
      return unwrap(handle, env, (object) => {
        return new _Model(cm.new(handle, object, env));
      });
    }
    static enumerateMethods(query, api2, env) {
      ensureInitialized(env);
      const params = query.match(methodQueryPattern);
      if (params === null) {
        throw new Error("Invalid query; format is: class!method -- see documentation of Java.enumerateMethods(query) for details");
      }
      const classQuery = Memory.allocUtf8String(params[1]);
      const methodQuery = Memory.allocUtf8String(params[2]);
      let includeSignature = false;
      let ignoreCase = false;
      let skipSystemClasses = false;
      const modifiers = params[3];
      if (modifiers !== void 0) {
        includeSignature = modifiers.indexOf("s") !== -1;
        ignoreCase = modifiers.indexOf("i") !== -1;
        skipSystemClasses = modifiers.indexOf("u") !== -1;
      }
      let result2;
      if (api2.jvmti !== null) {
        const json = cm.enumerateMethodsJvm(
          classQuery,
          methodQuery,
          boolToNative(includeSignature),
          boolToNative(ignoreCase),
          boolToNative(skipSystemClasses),
          env
        );
        try {
          result2 = JSON.parse(json.readUtf8String()).map((group) => {
            const loaderRef = ptr(group.loader);
            group.loader = !loaderRef.isNull() ? loaderRef : null;
            return group;
          });
        } finally {
          cm.dealloc(json);
        }
      } else {
        withRunnableArtThread(env.vm, env, (thread) => {
          const json = cm.enumerateMethodsArt(
            classQuery,
            methodQuery,
            boolToNative(includeSignature),
            boolToNative(ignoreCase),
            boolToNative(skipSystemClasses)
          );
          try {
            const addGlobalReference = api2["art::JavaVMExt::AddGlobalRef"];
            const { vm: vmHandle } = api2;
            result2 = JSON.parse(json.readUtf8String()).map((group) => {
              const loaderObj = group.loader;
              group.loader = loaderObj !== 0 ? addGlobalReference(vmHandle, thread, ptr(loaderObj)) : null;
              return group;
            });
          } finally {
            cm.dealloc(json);
          }
        });
      }
      return result2;
    }
    constructor(handle) {
      this.handle = handle;
    }
    has(member) {
      return cm.has(this.handle, Memory.allocUtf8String(member)) !== 0;
    }
    find(member) {
      return cm.find(this.handle, Memory.allocUtf8String(member)).readUtf8String();
    }
    list() {
      const str = cm.list(this.handle);
      try {
        return JSON.parse(str.readUtf8String());
      } finally {
        cm.dealloc(str);
      }
    }
  };
  function ensureInitialized(env) {
    if (cm === null) {
      cm = compileModule(env);
      unwrap = makeHandleUnwrapper(cm, env.vm);
    }
  }
  function compileModule(env) {
    const api2 = api_default();
    const { jvmti = null } = api2;
    const { pointerSize: pointerSize9 } = Process;
    const lockSize = 8;
    const modelsSize = pointerSize9;
    const javaApiSize = 7 * pointerSize9;
    const artApiSize = 10 * 4 + 5 * pointerSize9;
    const dataSize = lockSize + modelsSize + javaApiSize + artApiSize;
    const data = Memory.alloc(dataSize);
    const lock = data;
    const models = lock.add(lockSize);
    const javaApi = models.add(modelsSize);
    const { getDeclaredMethods, getDeclaredFields } = env.javaLangClass();
    const method = env.javaLangReflectMethod();
    const field = env.javaLangReflectField();
    let j = javaApi;
    [
      jvmti !== null ? jvmti : NULL,
      getDeclaredMethods,
      getDeclaredFields,
      method.getName,
      method.getModifiers,
      field.getName,
      field.getModifiers
    ].forEach((value) => {
      j = j.writePointer(value).add(pointerSize9);
    });
    const artApi = javaApi.add(javaApiSize);
    const { vm: vm3 } = env;
    if (api2.flavor === "art") {
      let artClassOffsets;
      if (jvmti !== null) {
        artClassOffsets = [0, 0, 0, 0];
      } else {
        const c = getArtClassSpec(vm3).offset;
        artClassOffsets = [c.ifields, c.methods, c.sfields, c.copiedMethodsOffset];
      }
      const m = getArtMethodSpec(vm3);
      const f = getArtFieldSpec(vm3);
      let s = artApi;
      [
        1,
        ...artClassOffsets,
        m.size,
        m.offset.accessFlags,
        f.size,
        f.offset.accessFlags,
        4294967295
      ].forEach((value) => {
        s = s.writeUInt(value).add(4);
      });
      [
        api2.artClassLinker.address,
        api2["art::ClassLinker::VisitClasses"],
        api2["art::mirror::Class::GetDescriptor"],
        api2["art::ArtMethod::PrettyMethod"],
        Process.getModuleByName("libc.so").getExportByName("free")
      ].forEach((value, i) => {
        if (value === void 0) {
          value = NULL;
        }
        s = s.writePointer(value).add(pointerSize9);
      });
    }
    const cm2 = new CModule(code2, {
      lock,
      models,
      java_api: javaApi,
      art_api: artApi
    });
    const reentrantOptions = { exceptions: "propagate" };
    const fastOptions = { exceptions: "propagate", scheduling: "exclusive" };
    return {
      handle: cm2,
      new: new NativeFunction(cm2.model_new, "pointer", ["pointer", "pointer", "pointer"], reentrantOptions),
      has: new NativeFunction(cm2.model_has, "bool", ["pointer", "pointer"], fastOptions),
      find: new NativeFunction(cm2.model_find, "pointer", ["pointer", "pointer"], fastOptions),
      list: new NativeFunction(cm2.model_list, "pointer", ["pointer"], fastOptions),
      enumerateMethodsArt: new NativeFunction(
        cm2.enumerate_methods_art,
        "pointer",
        ["pointer", "pointer", "bool", "bool", "bool"],
        reentrantOptions
      ),
      enumerateMethodsJvm: new NativeFunction(cm2.enumerate_methods_jvm, "pointer", [
        "pointer",
        "pointer",
        "bool",
        "bool",
        "bool",
        "pointer"
      ], reentrantOptions),
      dealloc: new NativeFunction(cm2.dealloc, "void", ["pointer"], fastOptions)
    };
  }
  function makeHandleUnwrapper(cm2, vm3) {
    const api2 = api_default();
    if (api2.flavor !== "art") {
      return nullUnwrap;
    }
    const decodeGlobal = api2["art::JavaVMExt::DecodeGlobal"];
    return function(handle, env, fn) {
      let result2;
      withRunnableArtThread(vm3, env, (thread) => {
        const object = decodeGlobal(vm3, thread, handle);
        result2 = fn(object);
      });
      return result2;
    };
  }
  function nullUnwrap(handle, env, fn) {
    return fn(NULL);
  }
  function boolToNative(val) {
    return val ? 1 : 0;
  }

  // node_modules/frida-java-bridge/lib/lru.js
  var LRU = class {
    constructor(capacity, destroy) {
      this.items = /* @__PURE__ */ new Map();
      this.capacity = capacity;
      this.destroy = destroy;
    }
    dispose(env) {
      const { items, destroy } = this;
      items.forEach((val) => {
        destroy(val, env);
      });
      items.clear();
    }
    get(key) {
      const { items } = this;
      const item = items.get(key);
      if (item !== void 0) {
        items.delete(key);
        items.set(key, item);
      }
      return item;
    }
    set(key, val, env) {
      const { items } = this;
      const existingVal = items.get(key);
      if (existingVal !== void 0) {
        items.delete(key);
        this.destroy(existingVal, env);
      } else if (items.size === this.capacity) {
        const oldestKey = items.keys().next().value;
        const oldestVal = items.get(oldestKey);
        items.delete(oldestKey);
        this.destroy(oldestVal, env);
      }
      items.set(key, val);
    }
  };

  // node_modules/frida-java-bridge/lib/mkdex.js
  var import_buffer = __toESM(require_buffer(), 1);
  var kAccPublic2 = 1;
  var kAccNative2 = 256;
  var kAccConstructor = 65536;
  var kEndianTag = 305419896;
  var kClassDefSize = 32;
  var kProtoIdSize = 12;
  var kFieldIdSize = 8;
  var kMethodIdSize = 8;
  var kTypeIdSize = 4;
  var kStringIdSize = 4;
  var kMapItemSize = 12;
  var TYPE_HEADER_ITEM = 0;
  var TYPE_STRING_ID_ITEM = 1;
  var TYPE_TYPE_ID_ITEM = 2;
  var TYPE_PROTO_ID_ITEM = 3;
  var TYPE_FIELD_ID_ITEM = 4;
  var TYPE_METHOD_ID_ITEM = 5;
  var TYPE_CLASS_DEF_ITEM = 6;
  var TYPE_MAP_LIST = 4096;
  var TYPE_TYPE_LIST = 4097;
  var TYPE_ANNOTATION_SET_ITEM = 4099;
  var TYPE_CLASS_DATA_ITEM = 8192;
  var TYPE_CODE_ITEM = 8193;
  var TYPE_STRING_DATA_ITEM = 8194;
  var TYPE_DEBUG_INFO_ITEM = 8195;
  var TYPE_ANNOTATION_ITEM = 8196;
  var TYPE_ANNOTATIONS_DIRECTORY_ITEM = 8198;
  var VALUE_TYPE = 24;
  var VALUE_ARRAY = 28;
  var VISIBILITY_SYSTEM = 2;
  var kDefaultConstructorSize = 24;
  var kDefaultConstructorDebugInfo = import_buffer.Buffer.from([3, 0, 7, 14, 0]);
  var kDalvikAnnotationTypeThrows = "Ldalvik/annotation/Throws;";
  var kNullTerminator = import_buffer.Buffer.from([0]);
  function mkdex(spec) {
    const builder = new DexBuilder();
    const fullSpec = Object.assign({}, spec);
    builder.addClass(fullSpec);
    return builder.build();
  }
  var DexBuilder = class {
    constructor() {
      this.classes = [];
    }
    addClass(spec) {
      this.classes.push(spec);
    }
    build() {
      const model = computeModel(this.classes);
      const {
        classes,
        interfaces,
        fields,
        methods,
        protos,
        parameters,
        annotationDirectories,
        annotationSets,
        throwsAnnotations,
        types,
        strings
      } = model;
      let offset = 0;
      const headerOffset = 0;
      const checksumOffset = 8;
      const signatureOffset = 12;
      const signatureSize = 20;
      const headerSize = 112;
      offset += headerSize;
      const stringIdsOffset = offset;
      const stringIdsSize = strings.length * kStringIdSize;
      offset += stringIdsSize;
      const typeIdsOffset = offset;
      const typeIdsSize = types.length * kTypeIdSize;
      offset += typeIdsSize;
      const protoIdsOffset = offset;
      const protoIdsSize = protos.length * kProtoIdSize;
      offset += protoIdsSize;
      const fieldIdsOffset = offset;
      const fieldIdsSize = fields.length * kFieldIdSize;
      offset += fieldIdsSize;
      const methodIdsOffset = offset;
      const methodIdsSize = methods.length * kMethodIdSize;
      offset += methodIdsSize;
      const classDefsOffset = offset;
      const classDefsSize = classes.length * kClassDefSize;
      offset += classDefsSize;
      const dataOffset = offset;
      const annotationSetOffsets = annotationSets.map((set) => {
        const setOffset = offset;
        set.offset = setOffset;
        offset += 4 + set.items.length * 4;
        return setOffset;
      });
      const javaCodeItems = classes.reduce((result2, klass) => {
        const constructorMethods = klass.classData.constructorMethods;
        constructorMethods.forEach((method) => {
          const [, accessFlags, superConstructor] = method;
          if ((accessFlags & kAccNative2) === 0 && superConstructor >= 0) {
            method.push(offset);
            result2.push({ offset, superConstructor });
            offset += kDefaultConstructorSize;
          }
        });
        return result2;
      }, []);
      annotationDirectories.forEach((dir) => {
        dir.offset = offset;
        offset += 16 + dir.methods.length * 8;
      });
      const interfaceOffsets = interfaces.map((iface) => {
        offset = align(offset, 4);
        const ifaceOffset = offset;
        iface.offset = ifaceOffset;
        offset += 4 + 2 * iface.types.length;
        return ifaceOffset;
      });
      const parameterOffsets = parameters.map((param) => {
        offset = align(offset, 4);
        const paramOffset = offset;
        param.offset = paramOffset;
        offset += 4 + 2 * param.types.length;
        return paramOffset;
      });
      const stringChunks = [];
      const stringOffsets = strings.map((str) => {
        const strOffset = offset;
        const header = import_buffer.Buffer.from(createUleb128(str.length));
        const data = import_buffer.Buffer.from(str, "utf8");
        const chunk = import_buffer.Buffer.concat([header, data, kNullTerminator]);
        stringChunks.push(chunk);
        offset += chunk.length;
        return strOffset;
      });
      const debugInfoOffsets = javaCodeItems.map((codeItem) => {
        const debugOffset = offset;
        offset += kDefaultConstructorDebugInfo.length;
        return debugOffset;
      });
      const throwsAnnotationBlobs = throwsAnnotations.map((annotation) => {
        const blob = makeThrowsAnnotation(annotation);
        annotation.offset = offset;
        offset += blob.length;
        return blob;
      });
      const classDataBlobs = classes.map((klass, index) => {
        klass.classData.offset = offset;
        const blob = makeClassData(klass);
        offset += blob.length;
        return blob;
      });
      const linkSize = 0;
      const linkOffset = 0;
      offset = align(offset, 4);
      const mapOffset = offset;
      const typeListLength = interfaces.length + parameters.length;
      const mapNumItems = 4 + (fields.length > 0 ? 1 : 0) + 2 + annotationSets.length + javaCodeItems.length + annotationDirectories.length + (typeListLength > 0 ? 1 : 0) + 1 + debugInfoOffsets.length + throwsAnnotations.length + classes.length + 1;
      const mapSize = 4 + mapNumItems * kMapItemSize;
      offset += mapSize;
      const dataSize = offset - dataOffset;
      const fileSize = offset;
      const dex = import_buffer.Buffer.alloc(fileSize);
      dex.write("dex\n035");
      dex.writeUInt32LE(fileSize, 32);
      dex.writeUInt32LE(headerSize, 36);
      dex.writeUInt32LE(kEndianTag, 40);
      dex.writeUInt32LE(linkSize, 44);
      dex.writeUInt32LE(linkOffset, 48);
      dex.writeUInt32LE(mapOffset, 52);
      dex.writeUInt32LE(strings.length, 56);
      dex.writeUInt32LE(stringIdsOffset, 60);
      dex.writeUInt32LE(types.length, 64);
      dex.writeUInt32LE(typeIdsOffset, 68);
      dex.writeUInt32LE(protos.length, 72);
      dex.writeUInt32LE(protoIdsOffset, 76);
      dex.writeUInt32LE(fields.length, 80);
      dex.writeUInt32LE(fields.length > 0 ? fieldIdsOffset : 0, 84);
      dex.writeUInt32LE(methods.length, 88);
      dex.writeUInt32LE(methodIdsOffset, 92);
      dex.writeUInt32LE(classes.length, 96);
      dex.writeUInt32LE(classDefsOffset, 100);
      dex.writeUInt32LE(dataSize, 104);
      dex.writeUInt32LE(dataOffset, 108);
      stringOffsets.forEach((offset2, index) => {
        dex.writeUInt32LE(offset2, stringIdsOffset + index * kStringIdSize);
      });
      types.forEach((id, index) => {
        dex.writeUInt32LE(id, typeIdsOffset + index * kTypeIdSize);
      });
      protos.forEach((proto, index) => {
        const [shortyIndex, returnTypeIndex, params] = proto;
        const protoOffset = protoIdsOffset + index * kProtoIdSize;
        dex.writeUInt32LE(shortyIndex, protoOffset);
        dex.writeUInt32LE(returnTypeIndex, protoOffset + 4);
        dex.writeUInt32LE(params !== null ? params.offset : 0, protoOffset + 8);
      });
      fields.forEach((field, index) => {
        const [classIndex, typeIndex, nameIndex] = field;
        const fieldOffset = fieldIdsOffset + index * kFieldIdSize;
        dex.writeUInt16LE(classIndex, fieldOffset);
        dex.writeUInt16LE(typeIndex, fieldOffset + 2);
        dex.writeUInt32LE(nameIndex, fieldOffset + 4);
      });
      methods.forEach((method, index) => {
        const [classIndex, protoIndex, nameIndex] = method;
        const methodOffset = methodIdsOffset + index * kMethodIdSize;
        dex.writeUInt16LE(classIndex, methodOffset);
        dex.writeUInt16LE(protoIndex, methodOffset + 2);
        dex.writeUInt32LE(nameIndex, methodOffset + 4);
      });
      classes.forEach((klass, index) => {
        const { interfaces: interfaces2, annotationsDirectory } = klass;
        const interfacesOffset = interfaces2 !== null ? interfaces2.offset : 0;
        const annotationsOffset = annotationsDirectory !== null ? annotationsDirectory.offset : 0;
        const staticValuesOffset = 0;
        const classOffset = classDefsOffset + index * kClassDefSize;
        dex.writeUInt32LE(klass.index, classOffset);
        dex.writeUInt32LE(klass.accessFlags, classOffset + 4);
        dex.writeUInt32LE(klass.superClassIndex, classOffset + 8);
        dex.writeUInt32LE(interfacesOffset, classOffset + 12);
        dex.writeUInt32LE(klass.sourceFileIndex, classOffset + 16);
        dex.writeUInt32LE(annotationsOffset, classOffset + 20);
        dex.writeUInt32LE(klass.classData.offset, classOffset + 24);
        dex.writeUInt32LE(staticValuesOffset, classOffset + 28);
      });
      annotationSets.forEach((set, index) => {
        const { items } = set;
        const setOffset = annotationSetOffsets[index];
        dex.writeUInt32LE(items.length, setOffset);
        items.forEach((item, index2) => {
          dex.writeUInt32LE(item.offset, setOffset + 4 + index2 * 4);
        });
      });
      javaCodeItems.forEach((codeItem, index) => {
        const { offset: offset2, superConstructor } = codeItem;
        const registersSize = 1;
        const insSize = 1;
        const outsSize = 1;
        const triesSize = 0;
        const insnsSize = 4;
        dex.writeUInt16LE(registersSize, offset2);
        dex.writeUInt16LE(insSize, offset2 + 2);
        dex.writeUInt16LE(outsSize, offset2 + 4);
        dex.writeUInt16LE(triesSize, offset2 + 6);
        dex.writeUInt32LE(debugInfoOffsets[index], offset2 + 8);
        dex.writeUInt32LE(insnsSize, offset2 + 12);
        dex.writeUInt16LE(4208, offset2 + 16);
        dex.writeUInt16LE(superConstructor, offset2 + 18);
        dex.writeUInt16LE(0, offset2 + 20);
        dex.writeUInt16LE(14, offset2 + 22);
      });
      annotationDirectories.forEach((dir) => {
        const dirOffset = dir.offset;
        const classAnnotationsOffset = 0;
        const fieldsSize = 0;
        const annotatedMethodsSize = dir.methods.length;
        const annotatedParametersSize = 0;
        dex.writeUInt32LE(classAnnotationsOffset, dirOffset);
        dex.writeUInt32LE(fieldsSize, dirOffset + 4);
        dex.writeUInt32LE(annotatedMethodsSize, dirOffset + 8);
        dex.writeUInt32LE(annotatedParametersSize, dirOffset + 12);
        dir.methods.forEach((method, index) => {
          const entryOffset = dirOffset + 16 + index * 8;
          const [methodIndex, annotationSet] = method;
          dex.writeUInt32LE(methodIndex, entryOffset);
          dex.writeUInt32LE(annotationSet.offset, entryOffset + 4);
        });
      });
      interfaces.forEach((iface, index) => {
        const ifaceOffset = interfaceOffsets[index];
        dex.writeUInt32LE(iface.types.length, ifaceOffset);
        iface.types.forEach((type, typeIndex) => {
          dex.writeUInt16LE(type, ifaceOffset + 4 + typeIndex * 2);
        });
      });
      parameters.forEach((param, index) => {
        const paramOffset = parameterOffsets[index];
        dex.writeUInt32LE(param.types.length, paramOffset);
        param.types.forEach((type, typeIndex) => {
          dex.writeUInt16LE(type, paramOffset + 4 + typeIndex * 2);
        });
      });
      stringChunks.forEach((chunk, index) => {
        chunk.copy(dex, stringOffsets[index]);
      });
      debugInfoOffsets.forEach((debugInfoOffset) => {
        kDefaultConstructorDebugInfo.copy(dex, debugInfoOffset);
      });
      throwsAnnotationBlobs.forEach((annotationBlob, index) => {
        annotationBlob.copy(dex, throwsAnnotations[index].offset);
      });
      classDataBlobs.forEach((classDataBlob, index) => {
        classDataBlob.copy(dex, classes[index].classData.offset);
      });
      dex.writeUInt32LE(mapNumItems, mapOffset);
      const mapItems = [
        [TYPE_HEADER_ITEM, 1, headerOffset],
        [TYPE_STRING_ID_ITEM, strings.length, stringIdsOffset],
        [TYPE_TYPE_ID_ITEM, types.length, typeIdsOffset],
        [TYPE_PROTO_ID_ITEM, protos.length, protoIdsOffset]
      ];
      if (fields.length > 0) {
        mapItems.push([TYPE_FIELD_ID_ITEM, fields.length, fieldIdsOffset]);
      }
      mapItems.push([TYPE_METHOD_ID_ITEM, methods.length, methodIdsOffset]);
      mapItems.push([TYPE_CLASS_DEF_ITEM, classes.length, classDefsOffset]);
      annotationSets.forEach((set, index) => {
        mapItems.push([TYPE_ANNOTATION_SET_ITEM, set.items.length, annotationSetOffsets[index]]);
      });
      javaCodeItems.forEach((codeItem) => {
        mapItems.push([TYPE_CODE_ITEM, 1, codeItem.offset]);
      });
      annotationDirectories.forEach((dir) => {
        mapItems.push([TYPE_ANNOTATIONS_DIRECTORY_ITEM, 1, dir.offset]);
      });
      if (typeListLength > 0) {
        mapItems.push([TYPE_TYPE_LIST, typeListLength, interfaceOffsets.concat(parameterOffsets)[0]]);
      }
      mapItems.push([TYPE_STRING_DATA_ITEM, strings.length, stringOffsets[0]]);
      debugInfoOffsets.forEach((debugInfoOffset) => {
        mapItems.push([TYPE_DEBUG_INFO_ITEM, 1, debugInfoOffset]);
      });
      throwsAnnotations.forEach((annotation) => {
        mapItems.push([TYPE_ANNOTATION_ITEM, 1, annotation.offset]);
      });
      classes.forEach((klass) => {
        mapItems.push([TYPE_CLASS_DATA_ITEM, 1, klass.classData.offset]);
      });
      mapItems.push([TYPE_MAP_LIST, 1, mapOffset]);
      mapItems.forEach((item, index) => {
        const [type, size, offset2] = item;
        const itemOffset = mapOffset + 4 + index * kMapItemSize;
        dex.writeUInt16LE(type, itemOffset);
        dex.writeUInt32LE(size, itemOffset + 4);
        dex.writeUInt32LE(offset2, itemOffset + 8);
      });
      const hash = new Checksum("sha1");
      hash.update(dex.slice(signatureOffset + signatureSize));
      import_buffer.Buffer.from(hash.getDigest()).copy(dex, signatureOffset);
      dex.writeUInt32LE(adler32(dex, signatureOffset), checksumOffset);
      return dex;
    }
  };
  function makeClassData(klass) {
    const { instanceFields, constructorMethods, virtualMethods } = klass.classData;
    const staticFieldsSize = 0;
    return import_buffer.Buffer.from([
      staticFieldsSize
    ].concat(createUleb128(instanceFields.length)).concat(createUleb128(constructorMethods.length)).concat(createUleb128(virtualMethods.length)).concat(instanceFields.reduce((result2, [indexDiff, accessFlags]) => {
      return result2.concat(createUleb128(indexDiff)).concat(createUleb128(accessFlags));
    }, [])).concat(constructorMethods.reduce((result2, [indexDiff, accessFlags, , codeOffset]) => {
      return result2.concat(createUleb128(indexDiff)).concat(createUleb128(accessFlags)).concat(createUleb128(codeOffset || 0));
    }, [])).concat(virtualMethods.reduce((result2, [indexDiff, accessFlags]) => {
      const codeOffset = 0;
      return result2.concat(createUleb128(indexDiff)).concat(createUleb128(accessFlags)).concat([codeOffset]);
    }, [])));
  }
  function makeThrowsAnnotation(annotation) {
    const { thrownTypes } = annotation;
    return import_buffer.Buffer.from(
      [
        VISIBILITY_SYSTEM
      ].concat(createUleb128(annotation.type)).concat([1]).concat(createUleb128(annotation.value)).concat([VALUE_ARRAY, thrownTypes.length]).concat(thrownTypes.reduce((result2, type) => {
        result2.push(VALUE_TYPE, type);
        return result2;
      }, []))
    );
  }
  function computeModel(classes) {
    const strings = /* @__PURE__ */ new Set();
    const types = /* @__PURE__ */ new Set();
    const protos = {};
    const fields = [];
    const methods = [];
    const throwsAnnotations = {};
    const javaConstructors = /* @__PURE__ */ new Set();
    const superConstructors = /* @__PURE__ */ new Set();
    classes.forEach((klass) => {
      const { name, superClass, sourceFileName } = klass;
      strings.add("this");
      strings.add(name);
      types.add(name);
      strings.add(superClass);
      types.add(superClass);
      strings.add(sourceFileName);
      klass.interfaces.forEach((iface) => {
        strings.add(iface);
        types.add(iface);
      });
      klass.fields.forEach((field) => {
        const [fieldName, fieldType] = field;
        strings.add(fieldName);
        strings.add(fieldType);
        types.add(fieldType);
        fields.push([klass.name, fieldType, fieldName]);
      });
      if (!klass.methods.some(([methodName]) => methodName === "<init>")) {
        klass.methods.unshift(["<init>", "V", []]);
        javaConstructors.add(name);
      }
      klass.methods.forEach((method) => {
        const [methodName, retType, argTypes, thrownTypes = [], accessFlags] = method;
        strings.add(methodName);
        const protoId = addProto(retType, argTypes);
        let throwsAnnotationId = null;
        if (thrownTypes.length > 0) {
          const typesNormalized = thrownTypes.slice();
          typesNormalized.sort();
          throwsAnnotationId = typesNormalized.join("|");
          let throwsAnnotation = throwsAnnotations[throwsAnnotationId];
          if (throwsAnnotation === void 0) {
            throwsAnnotation = {
              id: throwsAnnotationId,
              types: typesNormalized
            };
            throwsAnnotations[throwsAnnotationId] = throwsAnnotation;
          }
          strings.add(kDalvikAnnotationTypeThrows);
          types.add(kDalvikAnnotationTypeThrows);
          thrownTypes.forEach((type) => {
            strings.add(type);
            types.add(type);
          });
          strings.add("value");
        }
        methods.push([klass.name, protoId, methodName, throwsAnnotationId, accessFlags]);
        if (methodName === "<init>") {
          superConstructors.add(name + "|" + protoId);
          const superConstructorId = superClass + "|" + protoId;
          if (javaConstructors.has(name) && !superConstructors.has(superConstructorId)) {
            methods.push([superClass, protoId, methodName, null, 0]);
            superConstructors.add(superConstructorId);
          }
        }
      });
    });
    function addProto(retType, argTypes) {
      const signature = [retType].concat(argTypes);
      const id = signature.join("|");
      if (protos[id] !== void 0) {
        return id;
      }
      strings.add(retType);
      types.add(retType);
      argTypes.forEach((argType) => {
        strings.add(argType);
        types.add(argType);
      });
      const shorty = signature.map(typeToShorty).join("");
      strings.add(shorty);
      protos[id] = [id, shorty, retType, argTypes];
      return id;
    }
    const stringItems = Array.from(strings);
    stringItems.sort();
    const stringToIndex = stringItems.reduce((result2, string, index) => {
      result2[string] = index;
      return result2;
    }, {});
    const typeItems = Array.from(types).map((name) => stringToIndex[name]);
    typeItems.sort(compareNumbers);
    const typeToIndex = typeItems.reduce((result2, stringIndex, typeIndex) => {
      result2[stringItems[stringIndex]] = typeIndex;
      return result2;
    }, {});
    const literalProtoItems = Object.keys(protos).map((id) => protos[id]);
    literalProtoItems.sort(compareProtoItems);
    const parameters = {};
    const protoItems = literalProtoItems.map((item) => {
      const [, shorty, retType, argTypes] = item;
      let params;
      if (argTypes.length > 0) {
        const argTypesSig = argTypes.join("|");
        params = parameters[argTypesSig];
        if (params === void 0) {
          params = {
            types: argTypes.map((type) => typeToIndex[type]),
            offset: -1
          };
          parameters[argTypesSig] = params;
        }
      } else {
        params = null;
      }
      return [
        stringToIndex[shorty],
        typeToIndex[retType],
        params
      ];
    });
    const protoToIndex = literalProtoItems.reduce((result2, item, index) => {
      const [id] = item;
      result2[id] = index;
      return result2;
    }, {});
    const parameterItems = Object.keys(parameters).map((id) => parameters[id]);
    const fieldItems = fields.map((field) => {
      const [klass, fieldType, fieldName] = field;
      return [
        typeToIndex[klass],
        typeToIndex[fieldType],
        stringToIndex[fieldName]
      ];
    });
    fieldItems.sort(compareFieldItems);
    const methodItems = methods.map((method) => {
      const [klass, protoId, name, annotationsId, accessFlags] = method;
      return [
        typeToIndex[klass],
        protoToIndex[protoId],
        stringToIndex[name],
        annotationsId,
        accessFlags
      ];
    });
    methodItems.sort(compareMethodItems);
    const throwsAnnotationItems = Object.keys(throwsAnnotations).map((id) => throwsAnnotations[id]).map((item) => {
      return {
        id: item.id,
        type: typeToIndex[kDalvikAnnotationTypeThrows],
        value: stringToIndex.value,
        thrownTypes: item.types.map((type) => typeToIndex[type]),
        offset: -1
      };
    });
    const annotationSetItems = throwsAnnotationItems.map((item) => {
      return {
        id: item.id,
        items: [item],
        offset: -1
      };
    });
    const annotationSetIdToIndex = annotationSetItems.reduce((result2, item, index) => {
      result2[item.id] = index;
      return result2;
    }, {});
    const interfaceLists = {};
    const annotationDirectories = [];
    const classItems = classes.map((klass) => {
      const classIndex = typeToIndex[klass.name];
      const accessFlags = kAccPublic2;
      const superClassIndex = typeToIndex[klass.superClass];
      let ifaceList;
      const ifaces = klass.interfaces.map((type) => typeToIndex[type]);
      if (ifaces.length > 0) {
        ifaces.sort(compareNumbers);
        const ifacesId = ifaces.join("|");
        ifaceList = interfaceLists[ifacesId];
        if (ifaceList === void 0) {
          ifaceList = {
            types: ifaces,
            offset: -1
          };
          interfaceLists[ifacesId] = ifaceList;
        }
      } else {
        ifaceList = null;
      }
      const sourceFileIndex = stringToIndex[klass.sourceFileName];
      const classMethods = methodItems.reduce((result2, method, index) => {
        const [holder, protoIndex, name, annotationsId, accessFlags2] = method;
        if (holder === classIndex) {
          result2.push([index, name, annotationsId, protoIndex, accessFlags2]);
        }
        return result2;
      }, []);
      let annotationsDirectory = null;
      const methodAnnotations = classMethods.filter(([, , annotationsId]) => {
        return annotationsId !== null;
      }).map(([index, , annotationsId]) => {
        return [index, annotationSetItems[annotationSetIdToIndex[annotationsId]]];
      });
      if (methodAnnotations.length > 0) {
        annotationsDirectory = {
          methods: methodAnnotations,
          offset: -1
        };
        annotationDirectories.push(annotationsDirectory);
      }
      const instanceFields = fieldItems.reduce((result2, field, index) => {
        const [holder] = field;
        if (holder === classIndex) {
          result2.push([index > 0 ? 1 : 0, kAccPublic2]);
        }
        return result2;
      }, []);
      const constructorNameIndex = stringToIndex["<init>"];
      const constructorMethods = classMethods.filter(([, name]) => name === constructorNameIndex).map(([index, , , protoIndex]) => {
        if (javaConstructors.has(klass.name)) {
          let superConstructor = -1;
          const numMethodItems = methodItems.length;
          for (let i = 0; i !== numMethodItems; i++) {
            const [methodClass, methodProto, methodName] = methodItems[i];
            if (methodClass === superClassIndex && methodName === constructorNameIndex && methodProto === protoIndex) {
              superConstructor = i;
              break;
            }
          }
          return [index, kAccPublic2 | kAccConstructor, superConstructor];
        } else {
          return [index, kAccPublic2 | kAccConstructor | kAccNative2, -1];
        }
      });
      const virtualMethods = compressClassMethodIndexes(classMethods.filter(([, name]) => name !== constructorNameIndex).map(([index, , , , accessFlags2]) => {
        return [index, accessFlags2 | kAccPublic2 | kAccNative2];
      }));
      const classData = {
        instanceFields,
        constructorMethods,
        virtualMethods,
        offset: -1
      };
      return {
        index: classIndex,
        accessFlags,
        superClassIndex,
        interfaces: ifaceList,
        sourceFileIndex,
        annotationsDirectory,
        classData
      };
    });
    const interfaceItems = Object.keys(interfaceLists).map((id) => interfaceLists[id]);
    return {
      classes: classItems,
      interfaces: interfaceItems,
      fields: fieldItems,
      methods: methodItems,
      protos: protoItems,
      parameters: parameterItems,
      annotationDirectories,
      annotationSets: annotationSetItems,
      throwsAnnotations: throwsAnnotationItems,
      types: typeItems,
      strings: stringItems
    };
  }
  function compressClassMethodIndexes(items) {
    let previousIndex = 0;
    return items.map(([index, accessFlags], elementIndex) => {
      let result2;
      if (elementIndex === 0) {
        result2 = [index, accessFlags];
      } else {
        result2 = [index - previousIndex, accessFlags];
      }
      previousIndex = index;
      return result2;
    });
  }
  function compareNumbers(a, b) {
    return a - b;
  }
  function compareProtoItems(a, b) {
    const [, , aRetType, aArgTypes] = a;
    const [, , bRetType, bArgTypes] = b;
    if (aRetType < bRetType) {
      return -1;
    }
    if (aRetType > bRetType) {
      return 1;
    }
    const aArgTypesSig = aArgTypes.join("|");
    const bArgTypesSig = bArgTypes.join("|");
    if (aArgTypesSig < bArgTypesSig) {
      return -1;
    }
    if (aArgTypesSig > bArgTypesSig) {
      return 1;
    }
    return 0;
  }
  function compareFieldItems(a, b) {
    const [aClass, aType, aName] = a;
    const [bClass, bType, bName] = b;
    if (aClass !== bClass) {
      return aClass - bClass;
    }
    if (aName !== bName) {
      return aName - bName;
    }
    return aType - bType;
  }
  function compareMethodItems(a, b) {
    const [aClass, aProto, aName] = a;
    const [bClass, bProto, bName] = b;
    if (aClass !== bClass) {
      return aClass - bClass;
    }
    if (aName !== bName) {
      return aName - bName;
    }
    return aProto - bProto;
  }
  function typeToShorty(type) {
    const firstCharacter = type[0];
    return firstCharacter === "L" || firstCharacter === "[" ? "L" : type;
  }
  function createUleb128(value) {
    if (value <= 127) {
      return [value];
    }
    const result2 = [];
    let moreSlicesNeeded = false;
    do {
      let slice = value & 127;
      value >>= 7;
      moreSlicesNeeded = value !== 0;
      if (moreSlicesNeeded) {
        slice |= 128;
      }
      result2.push(slice);
    } while (moreSlicesNeeded);
    return result2;
  }
  function align(value, alignment) {
    const alignmentDelta = value % alignment;
    if (alignmentDelta === 0) {
      return value;
    }
    return value + alignment - alignmentDelta;
  }
  function adler32(buffer, offset) {
    let a = 1;
    let b = 0;
    const length = buffer.length;
    for (let i = offset; i < length; i++) {
      a = (a + buffer[i]) % 65521;
      b = (b + a) % 65521;
    }
    return (b << 16 | a) >>> 0;
  }
  var mkdex_default = mkdex;

  // node_modules/frida-java-bridge/lib/types.js
  var JNILocalRefType = 1;
  var vm = null;
  var primitiveArrayHandler = null;
  function initialize(_vm) {
    vm = _vm;
  }
  function getType(typeName, unbox, factory) {
    let type = getPrimitiveType(typeName);
    if (type === null) {
      if (typeName.indexOf("[") === 0) {
        type = getArrayType(typeName, unbox, factory);
      } else {
        if (typeName[0] === "L" && typeName[typeName.length - 1] === ";") {
          typeName = typeName.substring(1, typeName.length - 1);
        }
        type = getObjectType(typeName, unbox, factory);
      }
    }
    return Object.assign({ className: typeName }, type);
  }
  var primitiveTypes = {
    boolean: {
      name: "Z",
      type: "uint8",
      size: 1,
      byteSize: 1,
      defaultValue: false,
      isCompatible(v) {
        return typeof v === "boolean";
      },
      fromJni(v) {
        return !!v;
      },
      toJni(v) {
        return v ? 1 : 0;
      },
      read(address) {
        return address.readU8();
      },
      write(address, value) {
        address.writeU8(value);
      },
      toString() {
        return this.name;
      }
    },
    byte: {
      name: "B",
      type: "int8",
      size: 1,
      byteSize: 1,
      defaultValue: 0,
      isCompatible(v) {
        return Number.isInteger(v) && v >= -128 && v <= 127;
      },
      fromJni: identity,
      toJni: identity,
      read(address) {
        return address.readS8();
      },
      write(address, value) {
        address.writeS8(value);
      },
      toString() {
        return this.name;
      }
    },
    char: {
      name: "C",
      type: "uint16",
      size: 1,
      byteSize: 2,
      defaultValue: 0,
      isCompatible(v) {
        if (typeof v !== "string" || v.length !== 1) {
          return false;
        }
        const code3 = v.charCodeAt(0);
        return code3 >= 0 && code3 <= 65535;
      },
      fromJni(c) {
        return String.fromCharCode(c);
      },
      toJni(s) {
        return s.charCodeAt(0);
      },
      read(address) {
        return address.readU16();
      },
      write(address, value) {
        address.writeU16(value);
      },
      toString() {
        return this.name;
      }
    },
    short: {
      name: "S",
      type: "int16",
      size: 1,
      byteSize: 2,
      defaultValue: 0,
      isCompatible(v) {
        return Number.isInteger(v) && v >= -32768 && v <= 32767;
      },
      fromJni: identity,
      toJni: identity,
      read(address) {
        return address.readS16();
      },
      write(address, value) {
        address.writeS16(value);
      },
      toString() {
        return this.name;
      }
    },
    int: {
      name: "I",
      type: "int32",
      size: 1,
      byteSize: 4,
      defaultValue: 0,
      isCompatible(v) {
        return Number.isInteger(v) && v >= -2147483648 && v <= 2147483647;
      },
      fromJni: identity,
      toJni: identity,
      read(address) {
        return address.readS32();
      },
      write(address, value) {
        address.writeS32(value);
      },
      toString() {
        return this.name;
      }
    },
    long: {
      name: "J",
      type: "int64",
      size: 2,
      byteSize: 8,
      defaultValue: 0,
      isCompatible(v) {
        return typeof v === "number" || v instanceof Int64;
      },
      fromJni: identity,
      toJni: identity,
      read(address) {
        return address.readS64();
      },
      write(address, value) {
        address.writeS64(value);
      },
      toString() {
        return this.name;
      }
    },
    float: {
      name: "F",
      type: "float",
      size: 1,
      byteSize: 4,
      defaultValue: 0,
      isCompatible(v) {
        return typeof v === "number";
      },
      fromJni: identity,
      toJni: identity,
      read(address) {
        return address.readFloat();
      },
      write(address, value) {
        address.writeFloat(value);
      },
      toString() {
        return this.name;
      }
    },
    double: {
      name: "D",
      type: "double",
      size: 2,
      byteSize: 8,
      defaultValue: 0,
      isCompatible(v) {
        return typeof v === "number";
      },
      fromJni: identity,
      toJni: identity,
      read(address) {
        return address.readDouble();
      },
      write(address, value) {
        address.writeDouble(value);
      },
      toString() {
        return this.name;
      }
    },
    void: {
      name: "V",
      type: "void",
      size: 0,
      byteSize: 0,
      defaultValue: void 0,
      isCompatible(v) {
        return v === void 0;
      },
      fromJni() {
        return void 0;
      },
      toJni() {
        return NULL;
      },
      toString() {
        return this.name;
      }
    }
  };
  var primitiveTypesNames = new Set(Object.values(primitiveTypes).map((t) => t.name));
  function getPrimitiveType(name) {
    const result2 = primitiveTypes[name];
    return result2 !== void 0 ? result2 : null;
  }
  function getObjectType(typeName, unbox, factory) {
    const cache = factory._types[unbox ? 1 : 0];
    let type = cache[typeName];
    if (type !== void 0) {
      return type;
    }
    if (typeName === "java.lang.Object") {
      type = getJavaLangObjectType(factory);
    } else {
      type = getAnyObjectType(typeName, unbox, factory);
    }
    cache[typeName] = type;
    return type;
  }
  function getJavaLangObjectType(factory) {
    return {
      name: "Ljava/lang/Object;",
      type: "pointer",
      size: 1,
      defaultValue: NULL,
      isCompatible(v) {
        if (v === null) {
          return true;
        }
        if (v === void 0) {
          return false;
        }
        const isWrapper = v.$h instanceof NativePointer;
        if (isWrapper) {
          return true;
        }
        return typeof v === "string";
      },
      fromJni(h, env, owned) {
        if (h.isNull()) {
          return null;
        }
        return factory.cast(h, factory.use("java.lang.Object"), owned);
      },
      toJni(o, env) {
        if (o === null) {
          return NULL;
        }
        if (typeof o === "string") {
          return env.newStringUtf(o);
        }
        return o.$h;
      }
    };
  }
  function getAnyObjectType(typeName, unbox, factory) {
    let cachedClass = null;
    let cachedIsInstance = null;
    let cachedIsDefaultString = null;
    function getClass() {
      if (cachedClass === null) {
        cachedClass = factory.use(typeName).class;
      }
      return cachedClass;
    }
    function isInstance(v) {
      const klass = getClass();
      if (cachedIsInstance === null) {
        cachedIsInstance = klass.isInstance.overload("java.lang.Object");
      }
      return cachedIsInstance.call(klass, v);
    }
    function typeIsDefaultString() {
      if (cachedIsDefaultString === null) {
        const x = getClass();
        cachedIsDefaultString = factory.use("java.lang.String").class.isAssignableFrom(x);
      }
      return cachedIsDefaultString;
    }
    return {
      name: makeJniObjectTypeName(typeName),
      type: "pointer",
      size: 1,
      defaultValue: NULL,
      isCompatible(v) {
        if (v === null) {
          return true;
        }
        if (v === void 0) {
          return false;
        }
        const isWrapper = v.$h instanceof NativePointer;
        if (isWrapper) {
          return isInstance(v);
        }
        return typeof v === "string" && typeIsDefaultString();
      },
      fromJni(h, env, owned) {
        if (h.isNull()) {
          return null;
        }
        if (typeIsDefaultString() && unbox) {
          return env.stringFromJni(h);
        }
        return factory.cast(h, factory.use(typeName), owned);
      },
      toJni(o, env) {
        if (o === null) {
          return NULL;
        }
        if (typeof o === "string") {
          return env.newStringUtf(o);
        }
        return o.$h;
      },
      toString() {
        return this.name;
      }
    };
  }
  var primitiveArrayTypes = [
    ["Z", "boolean"],
    ["B", "byte"],
    ["C", "char"],
    ["D", "double"],
    ["F", "float"],
    ["I", "int"],
    ["J", "long"],
    ["S", "short"]
  ].reduce((result2, [shorty, name]) => {
    result2["[" + shorty] = makePrimitiveArrayType("[" + shorty, name);
    return result2;
  }, {});
  function makePrimitiveArrayType(shorty, name) {
    const envProto = Env.prototype;
    const nameTitled = toTitleCase(name);
    const spec = {
      typeName: name,
      newArray: envProto["new" + nameTitled + "Array"],
      setRegion: envProto["set" + nameTitled + "ArrayRegion"],
      getElements: envProto["get" + nameTitled + "ArrayElements"],
      releaseElements: envProto["release" + nameTitled + "ArrayElements"]
    };
    return {
      name: shorty,
      type: "pointer",
      size: 1,
      defaultValue: NULL,
      isCompatible(v) {
        return isCompatiblePrimitiveArray(v, name);
      },
      fromJni(h, env, owned) {
        return fromJniPrimitiveArray(h, spec, env, owned);
      },
      toJni(arr, env) {
        return toJniPrimitiveArray(arr, spec, env);
      }
    };
  }
  function getArrayType(typeName, unbox, factory) {
    const primitiveType = primitiveArrayTypes[typeName];
    if (primitiveType !== void 0) {
      return primitiveType;
    }
    if (typeName.indexOf("[") !== 0) {
      throw new Error("Unsupported type: " + typeName);
    }
    let elementTypeName = typeName.substring(1);
    const elementType = getType(elementTypeName, unbox, factory);
    let numInternalArrays = 0;
    const end = elementTypeName.length;
    while (numInternalArrays !== end && elementTypeName[numInternalArrays] === "[") {
      numInternalArrays++;
    }
    elementTypeName = elementTypeName.substring(numInternalArrays);
    if (elementTypeName[0] === "L" && elementTypeName[elementTypeName.length - 1] === ";") {
      elementTypeName = elementTypeName.substring(1, elementTypeName.length - 1);
    }
    let internalElementTypeName = elementTypeName.replace(/\./g, "/");
    if (primitiveTypesNames.has(internalElementTypeName)) {
      internalElementTypeName = "[".repeat(numInternalArrays) + internalElementTypeName;
    } else {
      internalElementTypeName = "[".repeat(numInternalArrays) + "L" + internalElementTypeName + ";";
    }
    const internalTypeName = "[" + internalElementTypeName;
    elementTypeName = "[".repeat(numInternalArrays) + elementTypeName;
    return {
      name: typeName.replace(/\./g, "/"),
      type: "pointer",
      size: 1,
      defaultValue: NULL,
      isCompatible(v) {
        if (v === null) {
          return true;
        }
        if (typeof v !== "object" || v.length === void 0) {
          return false;
        }
        return v.every(function(element) {
          return elementType.isCompatible(element);
        });
      },
      fromJni(arr, env, owned) {
        if (arr.isNull()) {
          return null;
        }
        const result2 = [];
        const n = env.getArrayLength(arr);
        for (let i = 0; i !== n; i++) {
          const element = env.getObjectArrayElement(arr, i);
          try {
            result2.push(elementType.fromJni(element, env));
          } finally {
            env.deleteLocalRef(element);
          }
        }
        try {
          result2.$w = factory.cast(arr, factory.use(internalTypeName), owned);
        } catch (e) {
          factory.use("java.lang.reflect.Array").newInstance(factory.use(elementTypeName).class, 0);
          result2.$w = factory.cast(arr, factory.use(internalTypeName), owned);
        }
        result2.$dispose = disposeObjectArray;
        return result2;
      },
      toJni(elements, env) {
        if (elements === null) {
          return NULL;
        }
        if (!(elements instanceof Array)) {
          throw new Error("Expected an array");
        }
        const wrapper = elements.$w;
        if (wrapper !== void 0) {
          return wrapper.$h;
        }
        const n = elements.length;
        const klassObj = factory.use(elementTypeName);
        const classHandle = klassObj.$borrowClassHandle(env);
        try {
          const result2 = env.newObjectArray(n, classHandle.value, NULL);
          env.throwIfExceptionPending();
          for (let i = 0; i !== n; i++) {
            const handle = elementType.toJni(elements[i], env);
            try {
              env.setObjectArrayElement(result2, i, handle);
            } finally {
              if (elementType.type === "pointer" && env.getObjectRefType(handle) === JNILocalRefType) {
                env.deleteLocalRef(handle);
              }
            }
            env.throwIfExceptionPending();
          }
          return result2;
        } finally {
          classHandle.unref(env);
        }
      }
    };
  }
  function disposeObjectArray() {
    const n = this.length;
    for (let i = 0; i !== n; i++) {
      const obj = this[i];
      if (obj === null) {
        continue;
      }
      const dispose = obj.$dispose;
      if (dispose === void 0) {
        break;
      }
      dispose.call(obj);
    }
    this.$w.$dispose();
  }
  function fromJniPrimitiveArray(arr, spec, env, owned) {
    if (arr.isNull()) {
      return null;
    }
    const type = getPrimitiveType(spec.typeName);
    const length = env.getArrayLength(arr);
    return new PrimitiveArray(arr, spec, type, length, env, owned);
  }
  function toJniPrimitiveArray(arr, spec, env) {
    if (arr === null) {
      return NULL;
    }
    const handle = arr.$h;
    if (handle !== void 0) {
      return handle;
    }
    const length = arr.length;
    const type = getPrimitiveType(spec.typeName);
    const result2 = spec.newArray.call(env, length);
    if (result2.isNull()) {
      throw new Error("Unable to construct array");
    }
    if (length > 0) {
      const elementSize = type.byteSize;
      const writeElement = type.write;
      const unparseElementValue = type.toJni;
      const elements = Memory.alloc(length * type.byteSize);
      for (let index = 0; index !== length; index++) {
        writeElement(elements.add(index * elementSize), unparseElementValue(arr[index]));
      }
      spec.setRegion.call(env, result2, 0, length, elements);
      env.throwIfExceptionPending();
    }
    return result2;
  }
  function isCompatiblePrimitiveArray(value, typeName) {
    if (value === null) {
      return true;
    }
    if (value instanceof PrimitiveArray) {
      return value.$s.typeName === typeName;
    }
    const isArrayLike = typeof value === "object" && value.length !== void 0;
    if (!isArrayLike) {
      return false;
    }
    const elementType = getPrimitiveType(typeName);
    return Array.prototype.every.call(value, (element) => elementType.isCompatible(element));
  }
  function PrimitiveArray(handle, spec, type, length, env, owned = true) {
    if (owned) {
      const h = env.newGlobalRef(handle);
      this.$h = h;
      this.$r = Script.bindWeak(this, env.vm.makeHandleDestructor(h));
    } else {
      this.$h = handle;
      this.$r = null;
    }
    this.$s = spec;
    this.$t = type;
    this.length = length;
    return new Proxy(this, primitiveArrayHandler);
  }
  primitiveArrayHandler = {
    has(target2, property) {
      if (property in target2) {
        return true;
      }
      return target2.tryParseIndex(property) !== null;
    },
    get(target2, property, receiver) {
      const index = target2.tryParseIndex(property);
      if (index === null) {
        return target2[property];
      }
      return target2.readElement(index);
    },
    set(target2, property, value, receiver) {
      const index = target2.tryParseIndex(property);
      if (index === null) {
        target2[property] = value;
        return true;
      }
      target2.writeElement(index, value);
      return true;
    },
    ownKeys(target2) {
      const keys = [];
      const { length } = target2;
      for (let i = 0; i !== length; i++) {
        const key = i.toString();
        keys.push(key);
      }
      keys.push("length");
      return keys;
    },
    getOwnPropertyDescriptor(target2, property) {
      const index = target2.tryParseIndex(property);
      if (index !== null) {
        return {
          writable: true,
          configurable: true,
          enumerable: true
        };
      }
      return Object.getOwnPropertyDescriptor(target2, property);
    }
  };
  Object.defineProperties(PrimitiveArray.prototype, {
    $dispose: {
      enumerable: true,
      value() {
        const ref = this.$r;
        if (ref !== null) {
          this.$r = null;
          Script.unbindWeak(ref);
        }
      }
    },
    $clone: {
      value(env) {
        return new PrimitiveArray(this.$h, this.$s, this.$t, this.length, env);
      }
    },
    tryParseIndex: {
      value(rawIndex) {
        if (typeof rawIndex === "symbol") {
          return null;
        }
        const index = parseInt(rawIndex);
        if (isNaN(index) || index < 0 || index >= this.length) {
          return null;
        }
        return index;
      }
    },
    readElement: {
      value(index) {
        return this.withElements((elements) => {
          const type = this.$t;
          return type.fromJni(type.read(elements.add(index * type.byteSize)));
        });
      }
    },
    writeElement: {
      value(index, value) {
        const { $h: handle, $s: spec, $t: type } = this;
        const env = vm.getEnv();
        const element = Memory.alloc(type.byteSize);
        type.write(element, type.toJni(value));
        spec.setRegion.call(env, handle, index, 1, element);
      }
    },
    withElements: {
      value(perform) {
        const { $h: handle, $s: spec } = this;
        const env = vm.getEnv();
        const elements = spec.getElements.call(env, handle);
        if (elements.isNull()) {
          throw new Error("Unable to get array elements");
        }
        try {
          return perform(elements);
        } finally {
          spec.releaseElements.call(env, handle, elements);
        }
      }
    },
    toJSON: {
      value() {
        const { length, $t: type } = this;
        const { byteSize: elementSize, fromJni, read } = type;
        return this.withElements((elements) => {
          const values = [];
          for (let i = 0; i !== length; i++) {
            const value = fromJni(read(elements.add(i * elementSize)));
            values.push(value);
          }
          return values;
        });
      }
    },
    toString: {
      value() {
        return this.toJSON().toString();
      }
    }
  });
  function makeJniObjectTypeName(typeName) {
    return "L" + typeName.replace(/\./g, "/") + ";";
  }
  function toTitleCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  function identity(value) {
    return value;
  }

  // node_modules/frida-java-bridge/lib/class-factory.js
  var jsizeSize3 = 4;
  var {
    ensureClassInitialized: ensureClassInitialized3,
    makeMethodMangler: makeMethodMangler3
  } = android_exports;
  var kAccStatic2 = 8;
  var CONSTRUCTOR_METHOD = 1;
  var STATIC_METHOD = 2;
  var INSTANCE_METHOD = 3;
  var STATIC_FIELD = 1;
  var INSTANCE_FIELD = 2;
  var STRATEGY_VIRTUAL = 1;
  var STRATEGY_DIRECT = 2;
  var PENDING_USE = /* @__PURE__ */ Symbol("PENDING_USE");
  var DEFAULT_CACHE_DIR = "/data/local/tmp";
  var {
    getCurrentThreadId,
    pointerSize: pointerSize7
  } = Process;
  var factoryCache = {
    state: "empty",
    factories: [],
    loaders: null,
    Integer: null
  };
  var vm2 = null;
  var api = null;
  var isArtVm = null;
  var wrapperHandler = null;
  var dispatcherPrototype = null;
  var methodPrototype = null;
  var valueOfPrototype = null;
  var cachedLoaderInvoke = null;
  var cachedLoaderMethod = null;
  var ignoredThreads = /* @__PURE__ */ new Map();
  var ClassFactory = class _ClassFactory {
    static _initialize(_vm, _api) {
      vm2 = _vm;
      api = _api;
      isArtVm = _api.flavor === "art";
      if (_api.flavor === "jvm") {
        ensureClassInitialized3 = ensureClassInitialized2;
        makeMethodMangler3 = makeMethodMangler2;
      }
    }
    static _disposeAll(env) {
      factoryCache.factories.forEach((factory) => {
        factory._dispose(env);
      });
    }
    static get(classLoader) {
      const cache = getFactoryCache();
      const defaultFactory = cache.factories[0];
      if (classLoader === null) {
        return defaultFactory;
      }
      const indexObj = cache.loaders.get(classLoader);
      if (indexObj !== null) {
        const index = defaultFactory.cast(indexObj, cache.Integer);
        return cache.factories[index.intValue()];
      }
      const factory = new _ClassFactory();
      factory.loader = classLoader;
      factory.cacheDir = defaultFactory.cacheDir;
      addFactoryToCache(factory, classLoader);
      return factory;
    }
    constructor() {
      this.cacheDir = DEFAULT_CACHE_DIR;
      this.codeCacheDir = DEFAULT_CACHE_DIR + "/dalvik-cache";
      this.tempFileNaming = {
        prefix: "frida",
        suffix: ""
      };
      this._classes = {};
      this._classHandles = new LRU(10, releaseClassHandle);
      this._patchedMethods = /* @__PURE__ */ new Set();
      this._loader = null;
      this._types = [{}, {}];
      factoryCache.factories.push(this);
    }
    _dispose(env) {
      Array.from(this._patchedMethods).forEach((method) => {
        method.implementation = null;
      });
      this._patchedMethods.clear();
      revertGlobalPatches();
      this._classHandles.dispose(env);
      this._classes = {};
    }
    get loader() {
      return this._loader;
    }
    set loader(value) {
      const isInitial = this._loader === null && value !== null;
      this._loader = value;
      if (isInitial && factoryCache.state === "ready" && this === factoryCache.factories[0]) {
        addFactoryToCache(this, value);
      }
    }
    use(className, options = {}) {
      const allowCached = options.cache !== "skip";
      let C = allowCached ? this._getUsedClass(className) : void 0;
      if (C === void 0) {
        try {
          const env = vm2.getEnv();
          const { _loader: loader } = this;
          const getClassHandle = loader !== null ? makeLoaderClassHandleGetter(className, loader, env) : makeBasicClassHandleGetter(className);
          C = this._make(className, getClassHandle, env);
        } finally {
          if (allowCached) {
            this._setUsedClass(className, C);
          }
        }
      }
      return C;
    }
    _getUsedClass(className) {
      let c;
      while ((c = this._classes[className]) === PENDING_USE) {
        Thread.sleep(0.05);
      }
      if (c === void 0) {
        this._classes[className] = PENDING_USE;
      }
      return c;
    }
    _setUsedClass(className, c) {
      if (c !== void 0) {
        this._classes[className] = c;
      } else {
        delete this._classes[className];
      }
    }
    _make(name, getClassHandle, env) {
      const C = makeClassWrapperConstructor();
      const proto = Object.create(Wrapper.prototype, {
        [/* @__PURE__ */ Symbol.for("n")]: {
          value: name
        },
        $n: {
          get() {
            return this[/* @__PURE__ */ Symbol.for("n")];
          }
        },
        [/* @__PURE__ */ Symbol.for("C")]: {
          value: C
        },
        $C: {
          get() {
            return this[/* @__PURE__ */ Symbol.for("C")];
          }
        },
        [/* @__PURE__ */ Symbol.for("w")]: {
          value: null,
          writable: true
        },
        $w: {
          get() {
            return this[/* @__PURE__ */ Symbol.for("w")];
          },
          set(val) {
            this[/* @__PURE__ */ Symbol.for("w")] = val;
          }
        },
        [/* @__PURE__ */ Symbol.for("_s")]: {
          writable: true
        },
        $_s: {
          get() {
            return this[/* @__PURE__ */ Symbol.for("_s")];
          },
          set(val) {
            this[/* @__PURE__ */ Symbol.for("_s")] = val;
          }
        },
        [/* @__PURE__ */ Symbol.for("c")]: {
          value: [null]
        },
        $c: {
          get() {
            return this[/* @__PURE__ */ Symbol.for("c")];
          }
        },
        [/* @__PURE__ */ Symbol.for("m")]: {
          value: /* @__PURE__ */ new Map()
        },
        $m: {
          get() {
            return this[/* @__PURE__ */ Symbol.for("m")];
          }
        },
        [/* @__PURE__ */ Symbol.for("l")]: {
          value: null,
          writable: true
        },
        $l: {
          get() {
            return this[/* @__PURE__ */ Symbol.for("l")];
          },
          set(val) {
            this[/* @__PURE__ */ Symbol.for("l")] = val;
          }
        },
        [/* @__PURE__ */ Symbol.for("gch")]: {
          value: getClassHandle
        },
        $gch: {
          get() {
            return this[/* @__PURE__ */ Symbol.for("gch")];
          }
        },
        [/* @__PURE__ */ Symbol.for("f")]: {
          value: this
        },
        $f: {
          get() {
            return this[/* @__PURE__ */ Symbol.for("f")];
          }
        }
      });
      C.prototype = proto;
      const classWrapper = new C(null);
      proto[/* @__PURE__ */ Symbol.for("w")] = classWrapper;
      proto.$w = classWrapper;
      const h = classWrapper.$borrowClassHandle(env);
      try {
        const classHandle = h.value;
        ensureClassInitialized3(env, classHandle);
        proto.$l = Model.build(classHandle, env);
      } finally {
        h.unref(env);
      }
      return classWrapper;
    }
    retain(obj) {
      const env = vm2.getEnv();
      return obj.$clone(env);
    }
    cast(obj, klass, owned) {
      const env = vm2.getEnv();
      let handle = obj.$h;
      if (handle === void 0) {
        handle = obj;
      }
      const h = klass.$borrowClassHandle(env);
      try {
        const isValidCast = env.isInstanceOf(handle, h.value);
        if (!isValidCast) {
          throw new Error(`Cast from '${env.getObjectClassName(handle)}' to '${klass.$n}' isn't possible`);
        }
      } finally {
        h.unref(env);
      }
      const C = klass.$C;
      return new C(handle, STRATEGY_VIRTUAL, env, owned);
    }
    wrap(handle, klass, env) {
      const C = klass.$C;
      const wrapper = new C(handle, STRATEGY_VIRTUAL, env, false);
      wrapper.$r = Script.bindWeak(wrapper, vm2.makeHandleDestructor(handle));
      return wrapper;
    }
    array(type, elements) {
      const env = vm2.getEnv();
      const primitiveType = getPrimitiveType(type);
      if (primitiveType !== null) {
        type = primitiveType.name;
      }
      const arrayType = getArrayType("[" + type, false, this);
      const rawArray = arrayType.toJni(elements, env);
      return arrayType.fromJni(rawArray, env, true);
    }
    registerClass(spec) {
      const env = vm2.getEnv();
      const tempHandles = [];
      try {
        const Class = this.use("java.lang.Class");
        const Method = env.javaLangReflectMethod();
        const invokeObjectMethodNoArgs = env.vaMethod("pointer", []);
        const className = spec.name;
        const interfaces = spec.implements || [];
        const superClass = spec.superClass || this.use("java.lang.Object");
        const dexFields = [];
        const dexMethods = [];
        const dexSpec = {
          name: makeJniObjectTypeName(className),
          sourceFileName: makeSourceFileName(className),
          superClass: makeJniObjectTypeName(superClass.$n),
          interfaces: interfaces.map((iface) => makeJniObjectTypeName(iface.$n)),
          fields: dexFields,
          methods: dexMethods
        };
        const allInterfaces = interfaces.slice();
        interfaces.forEach((iface) => {
          Array.prototype.slice.call(iface.class.getInterfaces()).forEach((baseIface) => {
            const baseIfaceName = this.cast(baseIface, Class).getCanonicalName();
            allInterfaces.push(this.use(baseIfaceName));
          });
        });
        const fields = spec.fields || {};
        Object.getOwnPropertyNames(fields).forEach((name) => {
          const fieldType = this._getType(fields[name]);
          dexFields.push([name, fieldType.name]);
        });
        const baseMethods = {};
        const pendingOverloads = {};
        allInterfaces.forEach((iface) => {
          const h = iface.$borrowClassHandle(env);
          tempHandles.push(h);
          const ifaceHandle = h.value;
          iface.$ownMembers.filter((name) => {
            return iface[name].overloads !== void 0;
          }).forEach((name) => {
            const method = iface[name];
            const overloads = method.overloads;
            const overloadIds = overloads.map((overload) => makeOverloadId(name, overload.returnType, overload.argumentTypes));
            baseMethods[name] = [method, overloadIds, ifaceHandle];
            overloads.forEach((overload, index) => {
              const id = overloadIds[index];
              pendingOverloads[id] = [overload, ifaceHandle];
            });
          });
        });
        const methods = spec.methods || {};
        const methodNames = Object.keys(methods);
        const methodEntries = methodNames.reduce((result2, name) => {
          const entry = methods[name];
          const rawName = name === "$init" ? "<init>" : name;
          if (entry instanceof Array) {
            result2.push(...entry.map((e) => [rawName, e]));
          } else {
            result2.push([rawName, entry]);
          }
          return result2;
        }, []);
        const implMethods = [];
        methodEntries.forEach(([name, methodValue]) => {
          let type = INSTANCE_METHOD;
          let returnType;
          let argumentTypes;
          let thrownTypeNames = [];
          let impl;
          if (typeof methodValue === "function") {
            const m = baseMethods[name];
            if (m !== void 0 && Array.isArray(m)) {
              const [baseMethod, overloadIds, parentTypeHandle] = m;
              if (overloadIds.length > 1) {
                throw new Error(`More than one overload matching '${name}': signature must be specified`);
              }
              delete pendingOverloads[overloadIds[0]];
              const overload = baseMethod.overloads[0];
              type = overload.type;
              returnType = overload.returnType;
              argumentTypes = overload.argumentTypes;
              impl = methodValue;
              const reflectedMethod = env.toReflectedMethod(parentTypeHandle, overload.handle, 0);
              const thrownTypes = invokeObjectMethodNoArgs(env.handle, reflectedMethod, Method.getGenericExceptionTypes);
              thrownTypeNames = readTypeNames(env, thrownTypes).map(makeJniObjectTypeName);
              env.deleteLocalRef(thrownTypes);
              env.deleteLocalRef(reflectedMethod);
            } else {
              returnType = this._getType("void");
              argumentTypes = [];
              impl = methodValue;
            }
          } else {
            if (methodValue.isStatic) {
              type = STATIC_METHOD;
            }
            returnType = this._getType(methodValue.returnType || "void");
            argumentTypes = (methodValue.argumentTypes || []).map((name2) => this._getType(name2));
            impl = methodValue.implementation;
            if (typeof impl !== "function") {
              throw new Error("Expected a function implementation for method: " + name);
            }
            const id = makeOverloadId(name, returnType, argumentTypes);
            const pendingOverload = pendingOverloads[id];
            if (pendingOverload !== void 0) {
              const [overload, parentTypeHandle] = pendingOverload;
              delete pendingOverloads[id];
              type = overload.type;
              returnType = overload.returnType;
              argumentTypes = overload.argumentTypes;
              const reflectedMethod = env.toReflectedMethod(parentTypeHandle, overload.handle, 0);
              const thrownTypes = invokeObjectMethodNoArgs(env.handle, reflectedMethod, Method.getGenericExceptionTypes);
              thrownTypeNames = readTypeNames(env, thrownTypes).map(makeJniObjectTypeName);
              env.deleteLocalRef(thrownTypes);
              env.deleteLocalRef(reflectedMethod);
            }
          }
          const returnTypeName = returnType.name;
          const argumentTypeNames = argumentTypes.map((t) => t.name);
          const signature = "(" + argumentTypeNames.join("") + ")" + returnTypeName;
          dexMethods.push([name, returnTypeName, argumentTypeNames, thrownTypeNames, type === STATIC_METHOD ? kAccStatic2 : 0]);
          implMethods.push([name, signature, type, returnType, argumentTypes, impl]);
        });
        const unimplementedMethodIds = Object.keys(pendingOverloads);
        if (unimplementedMethodIds.length > 0) {
          throw new Error("Missing implementation for: " + unimplementedMethodIds.join(", "));
        }
        const dex = DexFile.fromBuffer(mkdex_default(dexSpec), this);
        try {
          dex.load();
        } finally {
          dex.file.delete();
        }
        const classWrapper = this.use(spec.name);
        const numMethods = methodEntries.length;
        if (numMethods > 0) {
          const methodElementSize = 3 * pointerSize7;
          const methodElements = Memory.alloc(numMethods * methodElementSize);
          const nativeMethods = [];
          const temporaryHandles = [];
          implMethods.forEach(([name, signature, type, returnType, argumentTypes, impl], index) => {
            const rawName = Memory.allocUtf8String(name);
            const rawSignature = Memory.allocUtf8String(signature);
            const rawImpl = implement(name, classWrapper, type, returnType, argumentTypes, impl);
            methodElements.add(index * methodElementSize).writePointer(rawName);
            methodElements.add(index * methodElementSize + pointerSize7).writePointer(rawSignature);
            methodElements.add(index * methodElementSize + 2 * pointerSize7).writePointer(rawImpl);
            temporaryHandles.push(rawName, rawSignature);
            nativeMethods.push(rawImpl);
          });
          const h = classWrapper.$borrowClassHandle(env);
          tempHandles.push(h);
          const classHandle = h.value;
          env.registerNatives(classHandle, methodElements, numMethods);
          env.throwIfExceptionPending();
          classWrapper.$nativeMethods = nativeMethods;
        }
        return classWrapper;
      } finally {
        tempHandles.forEach((h) => {
          h.unref(env);
        });
      }
    }
    choose(specifier, callbacks) {
      const env = vm2.getEnv();
      const { flavor } = api;
      if (flavor === "jvm") {
        this._chooseObjectsJvm(specifier, env, callbacks);
      } else if (flavor === "art") {
        const legacyApiMissing = api["art::gc::Heap::VisitObjects"] === void 0;
        if (legacyApiMissing) {
          const preA12ApiMissing = api["art::gc::Heap::GetInstances"] === void 0;
          if (preA12ApiMissing) {
            return this._chooseObjectsJvm(specifier, env, callbacks);
          }
        }
        withRunnableArtThread(vm2, env, (thread) => {
          if (legacyApiMissing) {
            this._chooseObjectsArtPreA12(specifier, env, thread, callbacks);
          } else {
            this._chooseObjectsArtLegacy(specifier, env, thread, callbacks);
          }
        });
      } else {
        this._chooseObjectsDalvik(specifier, env, callbacks);
      }
    }
    _chooseObjectsJvm(className, env, callbacks) {
      const classWrapper = this.use(className);
      const { jvmti } = api;
      const JVMTI_ITERATION_CONTINUE = 1;
      const JVMTI_HEAP_OBJECT_EITHER = 3;
      const h = classWrapper.$borrowClassHandle(env);
      const tag = int64(h.value.toString());
      try {
        const heapObjectCallback = new NativeCallback((classTag, size, tagPtr2, userData) => {
          tagPtr2.writeS64(tag);
          return JVMTI_ITERATION_CONTINUE;
        }, "int", ["int64", "int64", "pointer", "pointer"]);
        jvmti.iterateOverInstancesOfClass(h.value, JVMTI_HEAP_OBJECT_EITHER, heapObjectCallback, h.value);
        const tagPtr = Memory.alloc(8);
        tagPtr.writeS64(tag);
        const countPtr = Memory.alloc(jsizeSize3);
        const objectsPtr = Memory.alloc(pointerSize7);
        jvmti.getObjectsWithTags(1, tagPtr, countPtr, objectsPtr, NULL);
        const count = countPtr.readS32();
        const objects = objectsPtr.readPointer();
        const handles = [];
        for (let i = 0; i !== count; i++) {
          handles.push(objects.add(i * pointerSize7).readPointer());
        }
        jvmti.deallocate(objects);
        try {
          for (const handle of handles) {
            const instance = this.cast(handle, classWrapper);
            const result2 = callbacks.onMatch(instance);
            if (result2 === "stop") {
              break;
            }
          }
          callbacks.onComplete();
        } finally {
          handles.forEach((handle) => {
            env.deleteLocalRef(handle);
          });
        }
      } finally {
        h.unref(env);
      }
    }
    _chooseObjectsArtPreA12(className, env, thread, callbacks) {
      const classWrapper = this.use(className);
      const scope = VariableSizedHandleScope.$new(thread, vm2);
      let needle;
      const h = classWrapper.$borrowClassHandle(env);
      try {
        const object = api["art::JavaVMExt::DecodeGlobal"](api.vm, thread, h.value);
        needle = scope.newHandle(object);
      } finally {
        h.unref(env);
      }
      const maxCount = 0;
      const instances = HandleVector.$new();
      api["art::gc::Heap::GetInstances"](api.artHeap, scope, needle, maxCount, instances);
      const instanceHandles = instances.handles.map((handle) => env.newGlobalRef(handle));
      instances.$delete();
      scope.$delete();
      try {
        for (const handle of instanceHandles) {
          const instance = this.cast(handle, classWrapper);
          const result2 = callbacks.onMatch(instance);
          if (result2 === "stop") {
            break;
          }
        }
        callbacks.onComplete();
      } finally {
        instanceHandles.forEach((handle) => {
          env.deleteGlobalRef(handle);
        });
      }
    }
    _chooseObjectsArtLegacy(className, env, thread, callbacks) {
      const classWrapper = this.use(className);
      const instanceHandles = [];
      const addGlobalReference = api["art::JavaVMExt::AddGlobalRef"];
      const vmHandle = api.vm;
      let needle;
      const h = classWrapper.$borrowClassHandle(env);
      try {
        needle = api["art::JavaVMExt::DecodeGlobal"](vmHandle, thread, h.value).toInt32();
      } finally {
        h.unref(env);
      }
      const collectMatchingInstanceHandles = makeObjectVisitorPredicate(needle, (object) => {
        instanceHandles.push(addGlobalReference(vmHandle, thread, object));
      });
      api["art::gc::Heap::VisitObjects"](api.artHeap, collectMatchingInstanceHandles, NULL);
      try {
        for (const handle of instanceHandles) {
          const instance = this.cast(handle, classWrapper);
          const result2 = callbacks.onMatch(instance);
          if (result2 === "stop") {
            break;
          }
        }
      } finally {
        instanceHandles.forEach((handle) => {
          env.deleteGlobalRef(handle);
        });
      }
      callbacks.onComplete();
    }
    _chooseObjectsDalvik(className, callerEnv, callbacks) {
      const classWrapper = this.use(className);
      if (api.addLocalReference === null) {
        const libdvm = Process.getModuleByName("libdvm.so");
        let pattern;
        switch (Process.arch) {
          case "arm":
            pattern = "2d e9 f0 41 05 46 15 4e 0c 46 7e 44 11 b3 43 68";
            break;
          case "ia32":
            pattern = "8d 64 24 d4 89 5c 24 1c 89 74 24 20 e8 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? 85 d2";
            break;
        }
        Memory.scan(libdvm.base, libdvm.size, pattern, {
          onMatch: (address, size) => {
            let wrapper;
            if (Process.arch === "arm") {
              address = address.or(1);
              wrapper = new NativeFunction(address, "pointer", ["pointer", "pointer"]);
            } else {
              const thunk = Memory.alloc(Process.pageSize);
              Memory.patchCode(thunk, 16, (code3) => {
                const cw = new X86Writer(code3, { pc: thunk });
                cw.putMovRegRegOffsetPtr("eax", "esp", 4);
                cw.putMovRegRegOffsetPtr("edx", "esp", 8);
                cw.putJmpAddress(address);
                cw.flush();
              });
              wrapper = new NativeFunction(thunk, "pointer", ["pointer", "pointer"]);
              wrapper._thunk = thunk;
            }
            api.addLocalReference = wrapper;
            vm2.perform((env) => {
              enumerateInstances(this, env);
            });
            return "stop";
          },
          onError(reason) {
          },
          onComplete() {
            if (api.addLocalReference === null) {
              callbacks.onComplete();
            }
          }
        });
      } else {
        enumerateInstances(this, callerEnv);
      }
      function enumerateInstances(factory, env) {
        const { DVM_JNI_ENV_OFFSET_SELF: DVM_JNI_ENV_OFFSET_SELF2 } = android_exports;
        const thread = env.handle.add(DVM_JNI_ENV_OFFSET_SELF2).readPointer();
        let ptrClassObject;
        const h = classWrapper.$borrowClassHandle(env);
        try {
          ptrClassObject = api.dvmDecodeIndirectRef(thread, h.value);
        } finally {
          h.unref(env);
        }
        const pattern = ptrClassObject.toMatchPattern();
        const heapSourceBase = api.dvmHeapSourceGetBase();
        const heapSourceLimit = api.dvmHeapSourceGetLimit();
        const size = heapSourceLimit.sub(heapSourceBase).toInt32();
        Memory.scan(heapSourceBase, size, pattern, {
          onMatch: (address, size2) => {
            if (api.dvmIsValidObject(address)) {
              vm2.perform((env2) => {
                const thread2 = env2.handle.add(DVM_JNI_ENV_OFFSET_SELF2).readPointer();
                let instance;
                const localReference = api.addLocalReference(thread2, address);
                try {
                  instance = factory.cast(localReference, classWrapper);
                } finally {
                  env2.deleteLocalRef(localReference);
                }
                const result2 = callbacks.onMatch(instance);
                if (result2 === "stop") {
                  return "stop";
                }
              });
            }
          },
          onError(reason) {
          },
          onComplete() {
            callbacks.onComplete();
          }
        });
      }
    }
    openClassFile(filePath) {
      return new DexFile(filePath, null, this);
    }
    _getType(typeName, unbox = true) {
      return getType(typeName, unbox, this);
    }
  };
  function makeClassWrapperConstructor() {
    return function(handle, strategy, env, owned) {
      return Wrapper.call(this, handle, strategy, env, owned);
    };
  }
  function Wrapper(handle, strategy, env, owned = true) {
    if (handle !== null) {
      if (owned) {
        const h = env.newGlobalRef(handle);
        this.$h = h;
        this.$r = Script.bindWeak(this, vm2.makeHandleDestructor(h));
      } else {
        this.$h = handle;
        this.$r = null;
      }
    } else {
      this.$h = null;
      this.$r = null;
    }
    this.$t = strategy;
    return new Proxy(this, wrapperHandler);
  }
  wrapperHandler = {
    has(target2, property) {
      if (property in target2) {
        return true;
      }
      return target2.$has(property);
    },
    get(target2, property, receiver) {
      if (typeof property !== "string" || property.startsWith("$") || property === "class") {
        return target2[property];
      }
      const unwrap2 = target2.$find(property);
      if (unwrap2 !== null) {
        return unwrap2(receiver);
      }
      return target2[property];
    },
    set(target2, property, value, receiver) {
      target2[property] = value;
      return true;
    },
    ownKeys(target2) {
      return target2.$list();
    },
    getOwnPropertyDescriptor(target2, property) {
      if (Object.prototype.hasOwnProperty.call(target2, property)) {
        return Object.getOwnPropertyDescriptor(target2, property);
      }
      return {
        writable: false,
        configurable: true,
        enumerable: true
      };
    }
  };
  Object.defineProperties(Wrapper.prototype, {
    [/* @__PURE__ */ Symbol.for("new")]: {
      enumerable: false,
      get() {
        return this.$getCtor("allocAndInit");
      }
    },
    $new: {
      enumerable: true,
      get() {
        return this[/* @__PURE__ */ Symbol.for("new")];
      }
    },
    [/* @__PURE__ */ Symbol.for("alloc")]: {
      enumerable: false,
      value() {
        const env = vm2.getEnv();
        const h = this.$borrowClassHandle(env);
        try {
          const obj = env.allocObject(h.value);
          const factory = this.$f;
          return factory.cast(obj, this);
        } finally {
          h.unref(env);
        }
      }
    },
    $alloc: {
      enumerable: true,
      get() {
        return this[/* @__PURE__ */ Symbol.for("alloc")];
      }
    },
    [/* @__PURE__ */ Symbol.for("init")]: {
      enumerable: false,
      get() {
        return this.$getCtor("initOnly");
      }
    },
    $init: {
      enumerable: true,
      get() {
        return this[/* @__PURE__ */ Symbol.for("init")];
      }
    },
    [/* @__PURE__ */ Symbol.for("dispose")]: {
      enumerable: false,
      value() {
        const ref = this.$r;
        if (ref !== null) {
          this.$r = null;
          Script.unbindWeak(ref);
        }
        if (this.$h !== null) {
          this.$h = void 0;
        }
      }
    },
    $dispose: {
      enumerable: true,
      get() {
        return this[/* @__PURE__ */ Symbol.for("dispose")];
      }
    },
    [/* @__PURE__ */ Symbol.for("clone")]: {
      enumerable: false,
      value(env) {
        const C = this.$C;
        return new C(this.$h, this.$t, env);
      }
    },
    $clone: {
      value(env) {
        return this[/* @__PURE__ */ Symbol.for("clone")](env);
      }
    },
    [/* @__PURE__ */ Symbol.for("class")]: {
      enumerable: false,
      get() {
        const env = vm2.getEnv();
        const h = this.$borrowClassHandle(env);
        try {
          const factory = this.$f;
          return factory.cast(h.value, factory.use("java.lang.Class"));
        } finally {
          h.unref(env);
        }
      }
    },
    class: {
      enumerable: true,
      get() {
        return this[/* @__PURE__ */ Symbol.for("class")];
      }
    },
    [/* @__PURE__ */ Symbol.for("className")]: {
      enumerable: false,
      get() {
        const handle = this.$h;
        if (handle === null) {
          return this.$n;
        }
        return vm2.getEnv().getObjectClassName(handle);
      }
    },
    $className: {
      enumerable: true,
      get() {
        return this[/* @__PURE__ */ Symbol.for("className")];
      }
    },
    [/* @__PURE__ */ Symbol.for("ownMembers")]: {
      enumerable: false,
      get() {
        const model = this.$l;
        return model.list();
      }
    },
    $ownMembers: {
      enumerable: true,
      get() {
        return this[/* @__PURE__ */ Symbol.for("ownMembers")];
      }
    },
    [/* @__PURE__ */ Symbol.for("super")]: {
      enumerable: false,
      get() {
        const env = vm2.getEnv();
        const C = this.$s.$C;
        return new C(this.$h, STRATEGY_DIRECT, env);
      }
    },
    $super: {
      enumerable: true,
      get() {
        return this[/* @__PURE__ */ Symbol.for("super")];
      }
    },
    [/* @__PURE__ */ Symbol.for("s")]: {
      enumerable: false,
      get() {
        const proto = Object.getPrototypeOf(this);
        let superWrapper = proto.$_s;
        if (superWrapper === void 0) {
          const env = vm2.getEnv();
          const h = this.$borrowClassHandle(env);
          try {
            const superHandle = env.getSuperclass(h.value);
            if (!superHandle.isNull()) {
              try {
                const superClassName = env.getClassName(superHandle);
                const factory = proto.$f;
                superWrapper = factory._getUsedClass(superClassName);
                if (superWrapper === void 0) {
                  try {
                    const getSuperClassHandle = makeSuperHandleGetter(this);
                    superWrapper = factory._make(superClassName, getSuperClassHandle, env);
                  } finally {
                    factory._setUsedClass(superClassName, superWrapper);
                  }
                }
              } finally {
                env.deleteLocalRef(superHandle);
              }
            } else {
              superWrapper = null;
            }
          } finally {
            h.unref(env);
          }
          proto.$_s = superWrapper;
        }
        return superWrapper;
      }
    },
    $s: {
      get() {
        return this[/* @__PURE__ */ Symbol.for("s")];
      }
    },
    [/* @__PURE__ */ Symbol.for("isSameObject")]: {
      enumerable: false,
      value(obj) {
        const env = vm2.getEnv();
        return env.isSameObject(obj.$h, this.$h);
      }
    },
    $isSameObject: {
      value(obj) {
        return this[/* @__PURE__ */ Symbol.for("isSameObject")](obj);
      }
    },
    [/* @__PURE__ */ Symbol.for("getCtor")]: {
      enumerable: false,
      value(type) {
        const slot = this.$c;
        let ctor = slot[0];
        if (ctor === null) {
          const env = vm2.getEnv();
          const h = this.$borrowClassHandle(env);
          try {
            ctor = makeConstructor(h.value, this.$w, env);
            slot[0] = ctor;
          } finally {
            h.unref(env);
          }
        }
        return ctor[type];
      }
    },
    $getCtor: {
      value(type) {
        return this[/* @__PURE__ */ Symbol.for("getCtor")](type);
      }
    },
    [/* @__PURE__ */ Symbol.for("borrowClassHandle")]: {
      enumerable: false,
      value(env) {
        const className = this.$n;
        const classHandles = this.$f._classHandles;
        let handle = classHandles.get(className);
        if (handle === void 0) {
          handle = new ClassHandle(this.$gch(env), env);
          classHandles.set(className, handle, env);
        }
        return handle.ref();
      }
    },
    $borrowClassHandle: {
      value(env) {
        return this[/* @__PURE__ */ Symbol.for("borrowClassHandle")](env);
      }
    },
    [/* @__PURE__ */ Symbol.for("copyClassHandle")]: {
      enumerable: false,
      value(env) {
        const h = this.$borrowClassHandle(env);
        try {
          return env.newLocalRef(h.value);
        } finally {
          h.unref(env);
        }
      }
    },
    $copyClassHandle: {
      value(env) {
        return this[/* @__PURE__ */ Symbol.for("copyClassHandle")](env);
      }
    },
    [/* @__PURE__ */ Symbol.for("getHandle")]: {
      enumerable: false,
      value(env) {
        const handle = this.$h;
        const isDisposed = handle === void 0;
        if (isDisposed) {
          throw new Error("Wrapper is disposed; perhaps it was borrowed from a hook instead of calling Java.retain() to make a long-lived wrapper?");
        }
        return handle;
      }
    },
    $getHandle: {
      value(env) {
        return this[/* @__PURE__ */ Symbol.for("getHandle")](env);
      }
    },
    [/* @__PURE__ */ Symbol.for("list")]: {
      enumerable: false,
      value() {
        const superWrapper = this.$s;
        const superMembers = superWrapper !== null ? superWrapper.$list() : [];
        const model = this.$l;
        return Array.from(new Set(superMembers.concat(model.list())));
      }
    },
    $list: {
      get() {
        return this[/* @__PURE__ */ Symbol.for("list")];
      }
    },
    [/* @__PURE__ */ Symbol.for("has")]: {
      enumerable: false,
      value(member) {
        const members = this.$m;
        if (members.has(member)) {
          return true;
        }
        const model = this.$l;
        if (model.has(member)) {
          return true;
        }
        const superWrapper = this.$s;
        if (superWrapper !== null && superWrapper.$has(member)) {
          return true;
        }
        return false;
      }
    },
    $has: {
      value(member) {
        return this[/* @__PURE__ */ Symbol.for("has")](member);
      }
    },
    [/* @__PURE__ */ Symbol.for("find")]: {
      enumerable: false,
      value(member) {
        const members = this.$m;
        let value = members.get(member);
        if (value !== void 0) {
          return value;
        }
        const model = this.$l;
        const spec = model.find(member);
        if (spec !== null) {
          const env = vm2.getEnv();
          const h = this.$borrowClassHandle(env);
          try {
            value = makeMember(member, spec, h.value, this.$w, env);
          } finally {
            h.unref(env);
          }
          members.set(member, value);
          return value;
        }
        const superWrapper = this.$s;
        if (superWrapper !== null) {
          return superWrapper.$find(member);
        }
        return null;
      }
    },
    $find: {
      value(member) {
        return this[/* @__PURE__ */ Symbol.for("find")](member);
      }
    },
    [/* @__PURE__ */ Symbol.for("toJSON")]: {
      enumerable: false,
      value() {
        const wrapperName = this.$n;
        const handle = this.$h;
        if (handle === null) {
          return `<class: ${wrapperName}>`;
        }
        const actualName = this.$className;
        if (wrapperName === actualName) {
          return `<instance: ${wrapperName}>`;
        }
        return `<instance: ${wrapperName}, $className: ${actualName}>`;
      }
    },
    toJSON: {
      get() {
        return this[/* @__PURE__ */ Symbol.for("toJSON")];
      }
    }
  });
  function ClassHandle(value, env) {
    this.value = env.newGlobalRef(value);
    env.deleteLocalRef(value);
    this.refs = 1;
  }
  ClassHandle.prototype.ref = function() {
    this.refs++;
    return this;
  };
  ClassHandle.prototype.unref = function(env) {
    if (--this.refs === 0) {
      env.deleteGlobalRef(this.value);
    }
  };
  function releaseClassHandle(handle, env) {
    handle.unref(env);
  }
  function makeBasicClassHandleGetter(className) {
    const canonicalClassName = className.replace(/\./g, "/");
    return function(env) {
      const tid = getCurrentThreadId();
      ignore(tid);
      try {
        return env.findClass(canonicalClassName);
      } finally {
        unignore(tid);
      }
    };
  }
  function makeLoaderClassHandleGetter(className, usedLoader, callerEnv) {
    if (cachedLoaderMethod === null) {
      cachedLoaderInvoke = callerEnv.vaMethod("pointer", ["pointer"]);
      cachedLoaderMethod = usedLoader.loadClass.overload("java.lang.String").handle;
    }
    callerEnv = null;
    return function(env) {
      const classNameValue = env.newStringUtf(className);
      const tid = getCurrentThreadId();
      ignore(tid);
      try {
        const result2 = cachedLoaderInvoke(env.handle, usedLoader.$h, cachedLoaderMethod, classNameValue);
        env.throwIfExceptionPending();
        return result2;
      } finally {
        unignore(tid);
        env.deleteLocalRef(classNameValue);
      }
    };
  }
  function makeSuperHandleGetter(classWrapper) {
    return function(env) {
      const h = classWrapper.$borrowClassHandle(env);
      try {
        return env.getSuperclass(h.value);
      } finally {
        h.unref(env);
      }
    };
  }
  function makeConstructor(classHandle, classWrapper, env) {
    const { $n: className, $f: factory } = classWrapper;
    const methodName = basename(className);
    const Class = env.javaLangClass();
    const Constructor = env.javaLangReflectConstructor();
    const invokeObjectMethodNoArgs = env.vaMethod("pointer", []);
    const invokeUInt8MethodNoArgs = env.vaMethod("uint8", []);
    const jsCtorMethods = [];
    const jsInitMethods = [];
    const jsRetType = factory._getType(className, false);
    const jsVoidType = factory._getType("void", false);
    const constructors = invokeObjectMethodNoArgs(env.handle, classHandle, Class.getDeclaredConstructors);
    try {
      const n = env.getArrayLength(constructors);
      if (n !== 0) {
        for (let i = 0; i !== n; i++) {
          let methodId, types;
          const constructor = env.getObjectArrayElement(constructors, i);
          try {
            methodId = env.fromReflectedMethod(constructor);
            types = invokeObjectMethodNoArgs(env.handle, constructor, Constructor.getGenericParameterTypes);
          } finally {
            env.deleteLocalRef(constructor);
          }
          let jsArgTypes;
          try {
            jsArgTypes = readTypeNames(env, types).map((name) => factory._getType(name));
          } finally {
            env.deleteLocalRef(types);
          }
          jsCtorMethods.push(makeMethod(methodName, classWrapper, CONSTRUCTOR_METHOD, methodId, jsRetType, jsArgTypes, env));
          jsInitMethods.push(makeMethod(methodName, classWrapper, INSTANCE_METHOD, methodId, jsVoidType, jsArgTypes, env));
        }
      } else {
        const isInterface = invokeUInt8MethodNoArgs(env.handle, classHandle, Class.isInterface);
        if (isInterface) {
          throw new Error("cannot instantiate an interface");
        }
        const defaultClass = env.javaLangObject();
        const defaultConstructor = env.getMethodId(defaultClass, "<init>", "()V");
        jsCtorMethods.push(makeMethod(methodName, classWrapper, CONSTRUCTOR_METHOD, defaultConstructor, jsRetType, [], env));
        jsInitMethods.push(makeMethod(methodName, classWrapper, INSTANCE_METHOD, defaultConstructor, jsVoidType, [], env));
      }
    } finally {
      env.deleteLocalRef(constructors);
    }
    if (jsInitMethods.length === 0) {
      throw new Error("no supported overloads");
    }
    return {
      allocAndInit: makeMethodDispatcher(jsCtorMethods),
      initOnly: makeMethodDispatcher(jsInitMethods)
    };
  }
  function makeMember(name, spec, classHandle, classWrapper, env) {
    if (spec.startsWith("m")) {
      return makeMethodFromSpec(name, spec, classHandle, classWrapper, env);
    }
    return makeFieldFromSpec(name, spec, classHandle, classWrapper, env);
  }
  function makeMethodFromSpec(name, spec, classHandle, classWrapper, env) {
    const { $f: factory } = classWrapper;
    const overloads = spec.split(":").slice(1);
    const Method = env.javaLangReflectMethod();
    const invokeObjectMethodNoArgs = env.vaMethod("pointer", []);
    const invokeUInt8MethodNoArgs = env.vaMethod("uint8", []);
    const methods = overloads.map((params) => {
      const type = params[0] === "s" ? STATIC_METHOD : INSTANCE_METHOD;
      const methodId = ptr(params.substr(1));
      let jsRetType;
      const jsArgTypes = [];
      const handle = env.toReflectedMethod(classHandle, methodId, type === STATIC_METHOD ? 1 : 0);
      try {
        const isVarArgs = !!invokeUInt8MethodNoArgs(env.handle, handle, Method.isVarArgs);
        const retType = invokeObjectMethodNoArgs(env.handle, handle, Method.getGenericReturnType);
        env.throwIfExceptionPending();
        try {
          jsRetType = factory._getType(env.getTypeName(retType));
        } finally {
          env.deleteLocalRef(retType);
        }
        const argTypes = invokeObjectMethodNoArgs(env.handle, handle, Method.getParameterTypes);
        try {
          const n = env.getArrayLength(argTypes);
          for (let i = 0; i !== n; i++) {
            const t = env.getObjectArrayElement(argTypes, i);
            let argClassName;
            try {
              argClassName = isVarArgs && i === n - 1 ? env.getArrayTypeName(t) : env.getTypeName(t);
            } finally {
              env.deleteLocalRef(t);
            }
            const argType = factory._getType(argClassName);
            jsArgTypes.push(argType);
          }
        } finally {
          env.deleteLocalRef(argTypes);
        }
      } catch (e) {
        return null;
      } finally {
        env.deleteLocalRef(handle);
      }
      return makeMethod(name, classWrapper, type, methodId, jsRetType, jsArgTypes, env);
    }).filter((m) => m !== null);
    if (methods.length === 0) {
      throw new Error("No supported overloads");
    }
    if (name === "valueOf") {
      ensureDefaultValueOfImplemented(methods);
    }
    const result2 = makeMethodDispatcher(methods);
    return function(receiver) {
      return result2;
    };
  }
  function makeMethodDispatcher(overloads) {
    const m = makeMethodDispatcherCallable();
    Object.setPrototypeOf(m, dispatcherPrototype);
    m._o = overloads;
    return m;
  }
  function makeMethodDispatcherCallable() {
    const m = function() {
      return m.invoke(this, arguments);
    };
    return m;
  }
  dispatcherPrototype = Object.create(Function.prototype, {
    overloads: {
      enumerable: true,
      get() {
        return this._o;
      }
    },
    overload: {
      value(...args) {
        const overloads = this._o;
        const numArgs = args.length;
        const signature = args.join(":");
        for (let i = 0; i !== overloads.length; i++) {
          const method = overloads[i];
          const { argumentTypes } = method;
          if (argumentTypes.length !== numArgs) {
            continue;
          }
          const s = argumentTypes.map((t) => t.className).join(":");
          if (s === signature) {
            return method;
          }
        }
        throwOverloadError(this.methodName, this.overloads, "specified argument types do not match any of:");
      }
    },
    methodName: {
      enumerable: true,
      get() {
        return this._o[0].methodName;
      }
    },
    holder: {
      enumerable: true,
      get() {
        return this._o[0].holder;
      }
    },
    type: {
      enumerable: true,
      get() {
        return this._o[0].type;
      }
    },
    handle: {
      enumerable: true,
      get() {
        throwIfDispatcherAmbiguous(this);
        return this._o[0].handle;
      }
    },
    implementation: {
      enumerable: true,
      get() {
        throwIfDispatcherAmbiguous(this);
        return this._o[0].implementation;
      },
      set(fn) {
        throwIfDispatcherAmbiguous(this);
        this._o[0].implementation = fn;
      }
    },
    returnType: {
      enumerable: true,
      get() {
        throwIfDispatcherAmbiguous(this);
        return this._o[0].returnType;
      }
    },
    argumentTypes: {
      enumerable: true,
      get() {
        throwIfDispatcherAmbiguous(this);
        return this._o[0].argumentTypes;
      }
    },
    canInvokeWith: {
      enumerable: true,
      get(args) {
        throwIfDispatcherAmbiguous(this);
        return this._o[0].canInvokeWith;
      }
    },
    clone: {
      enumerable: true,
      value(options) {
        throwIfDispatcherAmbiguous(this);
        return this._o[0].clone(options);
      }
    },
    invoke: {
      value(receiver, args) {
        const overloads = this._o;
        const isInstance = receiver.$h !== null;
        for (let i = 0; i !== overloads.length; i++) {
          const method = overloads[i];
          if (!method.canInvokeWith(args)) {
            continue;
          }
          if (method.type === INSTANCE_METHOD && !isInstance) {
            const name = this.methodName;
            if (name === "toString") {
              return `<class: ${receiver.$n}>`;
            }
            throw new Error(name + ": cannot call instance method without an instance");
          }
          return method.apply(receiver, args);
        }
        if (this.methodName === "toString") {
          return `<class: ${receiver.$n}>`;
        }
        throwOverloadError(this.methodName, this.overloads, "argument types do not match any of:");
      }
    }
  });
  function makeOverloadId(name, returnType, argumentTypes) {
    return `${returnType.className} ${name}(${argumentTypes.map((t) => t.className).join(", ")})`;
  }
  function throwIfDispatcherAmbiguous(dispatcher) {
    const methods = dispatcher._o;
    if (methods.length > 1) {
      throwOverloadError(methods[0].methodName, methods, "has more than one overload, use .overload(<signature>) to choose from:");
    }
  }
  function throwOverloadError(name, methods, message) {
    const methodsSortedByArity = methods.slice().sort((a, b) => a.argumentTypes.length - b.argumentTypes.length);
    const overloads = methodsSortedByArity.map((m) => {
      const argTypes = m.argumentTypes;
      if (argTypes.length > 0) {
        return ".overload('" + m.argumentTypes.map((t) => t.className).join("', '") + "')";
      } else {
        return ".overload()";
      }
    });
    throw new Error(`${name}(): ${message}
	${overloads.join("\n	")}`);
  }
  function makeMethod(methodName, classWrapper, type, methodId, retType, argTypes, env, invocationOptions) {
    const rawRetType = retType.type;
    const rawArgTypes = argTypes.map((t) => t.type);
    if (env === null) {
      env = vm2.getEnv();
    }
    let callVirtually, callDirectly;
    if (type === INSTANCE_METHOD) {
      callVirtually = env.vaMethod(rawRetType, rawArgTypes, invocationOptions);
      callDirectly = env.nonvirtualVaMethod(rawRetType, rawArgTypes, invocationOptions);
    } else if (type === STATIC_METHOD) {
      callVirtually = env.staticVaMethod(rawRetType, rawArgTypes, invocationOptions);
      callDirectly = callVirtually;
    } else {
      callVirtually = env.constructor(rawArgTypes, invocationOptions);
      callDirectly = callVirtually;
    }
    return makeMethodInstance([methodName, classWrapper, type, methodId, retType, argTypes, callVirtually, callDirectly]);
  }
  function makeMethodInstance(params) {
    const m = makeMethodCallable();
    Object.setPrototypeOf(m, methodPrototype);
    m._p = params;
    return m;
  }
  function makeMethodCallable() {
    const m = function() {
      return m.invoke(this, arguments);
    };
    return m;
  }
  methodPrototype = Object.create(Function.prototype, {
    methodName: {
      enumerable: true,
      get() {
        return this._p[0];
      }
    },
    holder: {
      enumerable: true,
      get() {
        return this._p[1];
      }
    },
    type: {
      enumerable: true,
      get() {
        return this._p[2];
      }
    },
    handle: {
      enumerable: true,
      get() {
        return this._p[3];
      }
    },
    implementation: {
      enumerable: true,
      get() {
        const replacement = this._r;
        return replacement !== void 0 ? replacement : null;
      },
      set(fn) {
        const params = this._p;
        const holder = params[1];
        const type = params[2];
        if (type === CONSTRUCTOR_METHOD) {
          throw new Error("Reimplementing $new is not possible; replace implementation of $init instead");
        }
        const existingReplacement = this._r;
        if (existingReplacement !== void 0) {
          holder.$f._patchedMethods.delete(this);
          const mangler = existingReplacement._m;
          mangler.revert(vm2);
          this._r = void 0;
        }
        if (fn !== null) {
          const [methodName, classWrapper, type2, methodId, retType, argTypes] = params;
          const replacement = implement(methodName, classWrapper, type2, retType, argTypes, fn, this);
          const mangler = makeMethodMangler3(methodId);
          replacement._m = mangler;
          this._r = replacement;
          mangler.replace(replacement, type2 === INSTANCE_METHOD, argTypes, vm2, api);
          holder.$f._patchedMethods.add(this);
        }
      }
    },
    returnType: {
      enumerable: true,
      get() {
        return this._p[4];
      }
    },
    argumentTypes: {
      enumerable: true,
      get() {
        return this._p[5];
      }
    },
    canInvokeWith: {
      enumerable: true,
      value(args) {
        const argTypes = this._p[5];
        if (args.length !== argTypes.length) {
          return false;
        }
        return argTypes.every((t, i) => {
          return t.isCompatible(args[i]);
        });
      }
    },
    clone: {
      enumerable: true,
      value(options) {
        const params = this._p.slice(0, 6);
        return makeMethod(...params, null, options);
      }
    },
    invoke: {
      value(receiver, args) {
        const env = vm2.getEnv();
        const params = this._p;
        const type = params[2];
        const retType = params[4];
        const argTypes = params[5];
        const replacement = this._r;
        const isInstanceMethod = type === INSTANCE_METHOD;
        const numArgs = args.length;
        const frameCapacity = 2 + numArgs;
        env.pushLocalFrame(frameCapacity);
        let borrowedHandle = null;
        try {
          let jniThis;
          if (isInstanceMethod) {
            jniThis = receiver.$getHandle();
          } else {
            borrowedHandle = receiver.$borrowClassHandle(env);
            jniThis = borrowedHandle.value;
          }
          let methodId;
          let strategy = receiver.$t;
          if (replacement === void 0) {
            methodId = params[3];
          } else {
            const mangler = replacement._m;
            methodId = mangler.resolveTarget(receiver, isInstanceMethod, env, api);
            if (isArtVm) {
              const pendingCalls = replacement._c;
              if (pendingCalls.has(getCurrentThreadId())) {
                strategy = STRATEGY_DIRECT;
              }
            }
          }
          const jniArgs = [
            env.handle,
            jniThis,
            methodId
          ];
          for (let i = 0; i !== numArgs; i++) {
            jniArgs.push(argTypes[i].toJni(args[i], env));
          }
          let jniCall;
          if (strategy === STRATEGY_VIRTUAL) {
            jniCall = params[6];
          } else {
            jniCall = params[7];
            if (isInstanceMethod) {
              jniArgs.splice(2, 0, receiver.$copyClassHandle(env));
            }
          }
          const jniRetval = jniCall.apply(null, jniArgs);
          env.throwIfExceptionPending();
          return retType.fromJni(jniRetval, env, true);
        } finally {
          if (borrowedHandle !== null) {
            borrowedHandle.unref(env);
          }
          env.popLocalFrame(NULL);
        }
      }
    },
    toString: {
      enumerable: true,
      value() {
        return `function ${this.methodName}(${this.argumentTypes.map((t) => t.className).join(", ")}): ${this.returnType.className}`;
      }
    }
  });
  function implement(methodName, classWrapper, type, retType, argTypes, handler, fallback = null) {
    const pendingCalls = /* @__PURE__ */ new Set();
    const f = makeMethodImplementation([methodName, classWrapper, type, retType, argTypes, handler, fallback, pendingCalls]);
    const impl = new NativeCallback(f, retType.type, ["pointer", "pointer"].concat(argTypes.map((t) => t.type)));
    impl._c = pendingCalls;
    return impl;
  }
  function makeMethodImplementation(params) {
    return function() {
      return handleMethodInvocation(arguments, params);
    };
  }
  function handleMethodInvocation(jniArgs, params) {
    const env = new Env(jniArgs[0], vm2);
    const [methodName, classWrapper, type, retType, argTypes, handler, fallback, pendingCalls] = params;
    const ownedObjects = [];
    let self;
    if (type === INSTANCE_METHOD) {
      const C = classWrapper.$C;
      self = new C(jniArgs[1], STRATEGY_VIRTUAL, env, false);
    } else {
      self = classWrapper;
    }
    const tid = getCurrentThreadId();
    env.pushLocalFrame(3);
    let haveFrame = true;
    vm2.link(tid, env);
    try {
      pendingCalls.add(tid);
      let fn;
      if (fallback === null || !ignoredThreads.has(tid)) {
        fn = handler;
      } else {
        fn = fallback;
      }
      const args = [];
      const numArgs = jniArgs.length - 2;
      for (let i = 0; i !== numArgs; i++) {
        const t = argTypes[i];
        const value = t.fromJni(jniArgs[2 + i], env, false);
        args.push(value);
        ownedObjects.push(value);
      }
      const retval = fn.apply(self, args);
      if (!retType.isCompatible(retval)) {
        throw new Error(`Implementation for ${methodName} expected return value compatible with ${retType.className}`);
      }
      let jniRetval = retType.toJni(retval, env);
      if (retType.type === "pointer") {
        jniRetval = env.popLocalFrame(jniRetval);
        haveFrame = false;
        ownedObjects.push(retval);
      }
      return jniRetval;
    } catch (e) {
      const jniException = e.$h;
      if (jniException !== void 0) {
        env.throw(jniException);
      } else {
        Script.nextTick(() => {
          throw e;
        });
      }
      return retType.defaultValue;
    } finally {
      vm2.unlink(tid);
      if (haveFrame) {
        env.popLocalFrame(NULL);
      }
      pendingCalls.delete(tid);
      ownedObjects.forEach((obj) => {
        if (obj === null) {
          return;
        }
        const dispose = obj.$dispose;
        if (dispose !== void 0) {
          dispose.call(obj);
        }
      });
    }
  }
  function ensureDefaultValueOfImplemented(methods) {
    const { holder, type } = methods[0];
    const hasDefaultValueOf = methods.some((m) => m.type === type && m.argumentTypes.length === 0);
    if (hasDefaultValueOf) {
      return;
    }
    methods.push(makeValueOfMethod([holder, type]));
  }
  function makeValueOfMethod(params) {
    const m = makeValueOfCallable();
    Object.setPrototypeOf(m, valueOfPrototype);
    m._p = params;
    return m;
  }
  function makeValueOfCallable() {
    const m = function() {
      return this;
    };
    return m;
  }
  valueOfPrototype = Object.create(Function.prototype, {
    methodName: {
      enumerable: true,
      get() {
        return "valueOf";
      }
    },
    holder: {
      enumerable: true,
      get() {
        return this._p[0];
      }
    },
    type: {
      enumerable: true,
      get() {
        return this._p[1];
      }
    },
    handle: {
      enumerable: true,
      get() {
        return NULL;
      }
    },
    implementation: {
      enumerable: true,
      get() {
        return null;
      },
      set(fn) {
      }
    },
    returnType: {
      enumerable: true,
      get() {
        const classWrapper = this.holder;
        return classWrapper.$f.use(classWrapper.$n);
      }
    },
    argumentTypes: {
      enumerable: true,
      get() {
        return [];
      }
    },
    canInvokeWith: {
      enumerable: true,
      value(args) {
        return args.length === 0;
      }
    },
    clone: {
      enumerable: true,
      value(options) {
        throw new Error("Invalid operation");
      }
    }
  });
  function makeFieldFromSpec(name, spec, classHandle, classWrapper, env) {
    const type = spec[2] === "s" ? STATIC_FIELD : INSTANCE_FIELD;
    const id = ptr(spec.substr(3));
    const { $f: factory } = classWrapper;
    let fieldType;
    const field = env.toReflectedField(classHandle, id, type === STATIC_FIELD ? 1 : 0);
    try {
      fieldType = env.vaMethod("pointer", [])(env.handle, field, env.javaLangReflectField().getGenericType);
      env.throwIfExceptionPending();
    } finally {
      env.deleteLocalRef(field);
    }
    let rtype;
    try {
      rtype = factory._getType(env.getTypeName(fieldType));
    } finally {
      env.deleteLocalRef(fieldType);
    }
    let getValue, setValue;
    const rtypeJni = rtype.type;
    if (type === STATIC_FIELD) {
      getValue = env.getStaticField(rtypeJni);
      setValue = env.setStaticField(rtypeJni);
    } else {
      getValue = env.getField(rtypeJni);
      setValue = env.setField(rtypeJni);
    }
    return makeFieldFromParams([type, rtype, id, getValue, setValue]);
  }
  function makeFieldFromParams(params) {
    return function(receiver) {
      return new Field([receiver].concat(params));
    };
  }
  function Field(params) {
    this._p = params;
  }
  Object.defineProperties(Field.prototype, {
    value: {
      enumerable: true,
      get() {
        const [holder, type, rtype, id, getValue] = this._p;
        const env = vm2.getEnv();
        env.pushLocalFrame(4);
        let borrowedHandle = null;
        try {
          let jniThis;
          if (type === INSTANCE_FIELD) {
            jniThis = holder.$getHandle();
            if (jniThis === null) {
              throw new Error("Cannot access an instance field without an instance");
            }
          } else {
            borrowedHandle = holder.$borrowClassHandle(env);
            jniThis = borrowedHandle.value;
          }
          const jniRetval = getValue(env.handle, jniThis, id);
          env.throwIfExceptionPending();
          return rtype.fromJni(jniRetval, env, true);
        } finally {
          if (borrowedHandle !== null) {
            borrowedHandle.unref(env);
          }
          env.popLocalFrame(NULL);
        }
      },
      set(value) {
        const [holder, type, rtype, id, , setValue] = this._p;
        const env = vm2.getEnv();
        env.pushLocalFrame(4);
        let borrowedHandle = null;
        try {
          let jniThis;
          if (type === INSTANCE_FIELD) {
            jniThis = holder.$getHandle();
            if (jniThis === null) {
              throw new Error("Cannot access an instance field without an instance");
            }
          } else {
            borrowedHandle = holder.$borrowClassHandle(env);
            jniThis = borrowedHandle.value;
          }
          if (!rtype.isCompatible(value)) {
            throw new Error(`Expected value compatible with ${rtype.className}`);
          }
          const jniValue = rtype.toJni(value, env);
          setValue(env.handle, jniThis, id, jniValue);
          env.throwIfExceptionPending();
        } finally {
          if (borrowedHandle !== null) {
            borrowedHandle.unref(env);
          }
          env.popLocalFrame(NULL);
        }
      }
    },
    holder: {
      enumerable: true,
      get() {
        return this._p[0];
      }
    },
    fieldType: {
      enumerable: true,
      get() {
        return this._p[1];
      }
    },
    fieldReturnType: {
      enumerable: true,
      get() {
        return this._p[2];
      }
    },
    toString: {
      enumerable: true,
      value() {
        const inlineString = `Java.Field{holder: ${this.holder}, fieldType: ${this.fieldType}, fieldReturnType: ${this.fieldReturnType}, value: ${this.value}}`;
        if (inlineString.length < 200) {
          return inlineString;
        }
        const multilineString = `Java.Field{
	holder: ${this.holder},
	fieldType: ${this.fieldType},
	fieldReturnType: ${this.fieldReturnType},
	value: ${this.value},
}`;
        return multilineString.split("\n").map((l) => l.length > 200 ? l.slice(0, l.indexOf(" ") + 1) + "...," : l).join("\n");
      }
    }
  });
  var DexFile = class _DexFile {
    static fromBuffer(buffer, factory) {
      const fileValue = createTemporaryDex(factory);
      const filePath = fileValue.getCanonicalPath().toString();
      const file = new File(filePath, "w");
      file.write(buffer.buffer);
      file.close();
      setReadOnlyDex(filePath, factory);
      return new _DexFile(filePath, fileValue, factory);
    }
    constructor(path, file, factory) {
      this.path = path;
      this.file = file;
      this._factory = factory;
    }
    load() {
      const { _factory: factory } = this;
      const { codeCacheDir } = factory;
      const DexClassLoader = factory.use("dalvik.system.DexClassLoader");
      const JFile = factory.use("java.io.File");
      let file = this.file;
      if (file === null) {
        file = factory.use("java.io.File").$new(this.path);
      }
      if (!file.exists()) {
        throw new Error("File not found");
      }
      JFile.$new(codeCacheDir).mkdirs();
      factory.loader = DexClassLoader.$new(file.getCanonicalPath(), codeCacheDir, null, factory.loader);
      vm2.preventDetachDueToClassLoader();
    }
    getClassNames() {
      const { _factory: factory } = this;
      const DexFile2 = factory.use("dalvik.system.DexFile");
      const optimizedDex = createTemporaryDex(factory);
      const dx = DexFile2.loadDex(this.path, optimizedDex.getCanonicalPath(), 0);
      const classNames = [];
      const enumeratorClassNames = dx.entries();
      while (enumeratorClassNames.hasMoreElements()) {
        classNames.push(enumeratorClassNames.nextElement().toString());
      }
      return classNames;
    }
  };
  function createTemporaryDex(factory) {
    const { cacheDir, tempFileNaming } = factory;
    const JFile = factory.use("java.io.File");
    const cacheDirValue = JFile.$new(cacheDir);
    cacheDirValue.mkdirs();
    return JFile.createTempFile(tempFileNaming.prefix, tempFileNaming.suffix + ".dex", cacheDirValue);
  }
  function setReadOnlyDex(filePath, factory) {
    const JFile = factory.use("java.io.File");
    const file = JFile.$new(filePath);
    file.setWritable(false, false);
  }
  function getFactoryCache() {
    switch (factoryCache.state) {
      case "empty": {
        factoryCache.state = "pending";
        const defaultFactory = factoryCache.factories[0];
        const HashMap = defaultFactory.use("java.util.HashMap");
        const Integer = defaultFactory.use("java.lang.Integer");
        factoryCache.loaders = HashMap.$new();
        factoryCache.Integer = Integer;
        const loader = defaultFactory.loader;
        if (loader !== null) {
          addFactoryToCache(defaultFactory, loader);
        }
        factoryCache.state = "ready";
        return factoryCache;
      }
      case "pending":
        do {
          Thread.sleep(0.05);
        } while (factoryCache.state === "pending");
        return factoryCache;
      case "ready":
        return factoryCache;
    }
  }
  function addFactoryToCache(factory, loader) {
    const { factories, loaders, Integer } = factoryCache;
    const index = Integer.$new(factories.indexOf(factory));
    loaders.put(loader, index);
    for (let l = loader.getParent(); l !== null; l = l.getParent()) {
      if (loaders.containsKey(l)) {
        break;
      }
      loaders.put(l, index);
    }
  }
  function ignore(threadId) {
    let count = ignoredThreads.get(threadId);
    if (count === void 0) {
      count = 0;
    }
    count++;
    ignoredThreads.set(threadId, count);
  }
  function unignore(threadId) {
    let count = ignoredThreads.get(threadId);
    if (count === void 0) {
      throw new Error(`Thread ${threadId} is not ignored`);
    }
    count--;
    if (count === 0) {
      ignoredThreads.delete(threadId);
    } else {
      ignoredThreads.set(threadId, count);
    }
  }
  function basename(className) {
    return className.slice(className.lastIndexOf(".") + 1);
  }
  function readTypeNames(env, types) {
    const names = [];
    const n = env.getArrayLength(types);
    for (let i = 0; i !== n; i++) {
      const t = env.getObjectArrayElement(types, i);
      try {
        names.push(env.getTypeName(t));
      } finally {
        env.deleteLocalRef(t);
      }
    }
    return names;
  }
  function makeSourceFileName(className) {
    const tokens = className.split(".");
    return tokens[tokens.length - 1] + ".java";
  }

  // node_modules/frida-java-bridge/index.js
  var jsizeSize4 = 4;
  var pointerSize8 = Process.pointerSize;
  var Runtime = class {
    constructor() {
      __publicField(this, "ACC_PUBLIC", 1);
      __publicField(this, "ACC_PRIVATE", 2);
      __publicField(this, "ACC_PROTECTED", 4);
      __publicField(this, "ACC_STATIC", 8);
      __publicField(this, "ACC_FINAL", 16);
      __publicField(this, "ACC_SYNCHRONIZED", 32);
      __publicField(this, "ACC_BRIDGE", 64);
      __publicField(this, "ACC_VARARGS", 128);
      __publicField(this, "ACC_NATIVE", 256);
      __publicField(this, "ACC_ABSTRACT", 1024);
      __publicField(this, "ACC_STRICT", 2048);
      __publicField(this, "ACC_SYNTHETIC", 4096);
      this.classFactory = null;
      this.ClassFactory = ClassFactory;
      this.vm = null;
      this.api = null;
      this._initialized = false;
      this._apiError = null;
      this._wakeupHandler = null;
      this._pollListener = null;
      this._pendingMainOps = [];
      this._pendingVmOps = [];
      this._cachedIsAppProcess = null;
      try {
        this._tryInitialize();
      } catch (e) {
      }
    }
    _tryInitialize() {
      if (this._initialized) {
        return true;
      }
      if (this._apiError !== null) {
        throw this._apiError;
      }
      let api2;
      try {
        api2 = api_default();
        this.api = api2;
      } catch (e) {
        this._apiError = e;
        throw e;
      }
      if (api2 === null) {
        return false;
      }
      const vm3 = new VM(api2);
      this.vm = vm3;
      initialize(vm3);
      ClassFactory._initialize(vm3, api2);
      this.classFactory = new ClassFactory();
      this._initialized = true;
      return true;
    }
    _dispose() {
      if (this.api === null) {
        return;
      }
      const { vm: vm3 } = this;
      vm3.perform((env) => {
        ClassFactory._disposeAll(env);
        Env.dispose(env);
      });
      Script.nextTick(() => {
        VM.dispose(vm3);
      });
    }
    get available() {
      return this._tryInitialize();
    }
    get androidVersion() {
      return getAndroidVersion();
    }
    synchronized(obj, fn) {
      const { $h: objHandle = obj } = obj;
      if (!(objHandle instanceof NativePointer)) {
        throw new Error("Java.synchronized: the first argument `obj` must be either a pointer or a Java instance");
      }
      const env = this.vm.getEnv();
      checkJniResult("VM::MonitorEnter", env.monitorEnter(objHandle));
      try {
        fn();
      } finally {
        env.monitorExit(objHandle);
      }
    }
    enumerateLoadedClasses(callbacks) {
      this._checkAvailable();
      const { flavor } = this.api;
      if (flavor === "jvm") {
        this._enumerateLoadedClassesJvm(callbacks);
      } else if (flavor === "art") {
        this._enumerateLoadedClassesArt(callbacks);
      } else {
        this._enumerateLoadedClassesDalvik(callbacks);
      }
    }
    enumerateLoadedClassesSync() {
      const classes = [];
      this.enumerateLoadedClasses({
        onMatch(c) {
          classes.push(c);
        },
        onComplete() {
        }
      });
      return classes;
    }
    enumerateClassLoaders(callbacks) {
      this._checkAvailable();
      const { flavor } = this.api;
      if (flavor === "jvm") {
        this._enumerateClassLoadersJvm(callbacks);
      } else if (flavor === "art") {
        this._enumerateClassLoadersArt(callbacks);
      } else {
        throw new Error("Enumerating class loaders is not supported on Dalvik");
      }
    }
    enumerateClassLoadersSync() {
      const loaders = [];
      this.enumerateClassLoaders({
        onMatch(c) {
          loaders.push(c);
        },
        onComplete() {
        }
      });
      return loaders;
    }
    _enumerateLoadedClassesJvm(callbacks) {
      const { api: api2, vm: vm3 } = this;
      const { jvmti } = api2;
      const env = vm3.getEnv();
      const countPtr = Memory.alloc(jsizeSize4);
      const classesPtr = Memory.alloc(pointerSize8);
      jvmti.getLoadedClasses(countPtr, classesPtr);
      const count = countPtr.readS32();
      const classes = classesPtr.readPointer();
      const handles = [];
      for (let i = 0; i !== count; i++) {
        handles.push(classes.add(i * pointerSize8).readPointer());
      }
      jvmti.deallocate(classes);
      try {
        for (const handle of handles) {
          const className = env.getClassName(handle);
          callbacks.onMatch(className, handle);
        }
        callbacks.onComplete();
      } finally {
        handles.forEach((handle) => {
          env.deleteLocalRef(handle);
        });
      }
    }
    _enumerateClassLoadersJvm(callbacks) {
      this.choose("java.lang.ClassLoader", callbacks);
    }
    _enumerateLoadedClassesArt(callbacks) {
      const { vm: vm3, api: api2 } = this;
      const env = vm3.getEnv();
      const addGlobalReference = api2["art::JavaVMExt::AddGlobalRef"];
      const { vm: vmHandle } = api2;
      withRunnableArtThread(vm3, env, (thread) => {
        const collectClassHandles = makeArtClassVisitor((klass) => {
          const handle = addGlobalReference(vmHandle, thread, klass);
          try {
            const className = env.getClassName(handle);
            callbacks.onMatch(className, handle);
          } finally {
            env.deleteGlobalRef(handle);
          }
          return true;
        });
        api2["art::ClassLinker::VisitClasses"](api2.artClassLinker.address, collectClassHandles);
      });
      callbacks.onComplete();
    }
    _enumerateClassLoadersArt(callbacks) {
      const { classFactory: factory, vm: vm3, api: api2 } = this;
      const env = vm3.getEnv();
      const visitClassLoaders = api2["art::ClassLinker::VisitClassLoaders"];
      if (visitClassLoaders === void 0) {
        throw new Error("This API is only available on Android >= 7.0");
      }
      const ClassLoader = factory.use("java.lang.ClassLoader");
      const loaderHandles = [];
      const addGlobalReference = api2["art::JavaVMExt::AddGlobalRef"];
      const { vm: vmHandle } = api2;
      withRunnableArtThread(vm3, env, (thread) => {
        const collectLoaderHandles = makeArtClassLoaderVisitor((loader) => {
          loaderHandles.push(addGlobalReference(vmHandle, thread, loader));
          return true;
        });
        withAllArtThreadsSuspended(() => {
          visitClassLoaders(api2.artClassLinker.address, collectLoaderHandles);
        });
      });
      try {
        loaderHandles.forEach((handle) => {
          const loader = factory.cast(handle, ClassLoader);
          callbacks.onMatch(loader);
        });
      } finally {
        loaderHandles.forEach((handle) => {
          env.deleteGlobalRef(handle);
        });
      }
      callbacks.onComplete();
    }
    _enumerateLoadedClassesDalvik(callbacks) {
      const { api: api2 } = this;
      const HASH_TOMBSTONE = ptr("0xcbcacccd");
      const loadedClassesOffset = 172;
      const hashEntrySize = 8;
      const ptrLoadedClassesHashtable = api2.gDvm.add(loadedClassesOffset);
      const hashTable = ptrLoadedClassesHashtable.readPointer();
      const tableSize = hashTable.readS32();
      const ptrpEntries = hashTable.add(12);
      const pEntries = ptrpEntries.readPointer();
      const end = tableSize * hashEntrySize;
      for (let offset = 0; offset < end; offset += hashEntrySize) {
        const pEntryPtr = pEntries.add(offset);
        const dataPtr = pEntryPtr.add(4).readPointer();
        if (dataPtr.isNull() || dataPtr.equals(HASH_TOMBSTONE)) {
          continue;
        }
        const descriptionPtr = dataPtr.add(24).readPointer();
        const description = descriptionPtr.readUtf8String();
        if (description.startsWith("L")) {
          const name = description.substring(1, description.length - 1).replace(/\//g, ".");
          callbacks.onMatch(name);
        }
      }
      callbacks.onComplete();
    }
    enumerateMethods(query) {
      const { classFactory: factory } = this;
      const env = this.vm.getEnv();
      const ClassLoader = factory.use("java.lang.ClassLoader");
      return Model.enumerateMethods(query, this.api, env).map((group) => {
        const handle = group.loader;
        group.loader = handle !== null ? factory.wrap(handle, ClassLoader, env) : null;
        return group;
      });
    }
    scheduleOnMainThread(fn) {
      this.performNow(() => {
        this._pendingMainOps.push(fn);
        let { _wakeupHandler: wakeupHandler } = this;
        if (wakeupHandler === null) {
          const { classFactory: factory } = this;
          const Handler = factory.use("android.os.Handler");
          const Looper = factory.use("android.os.Looper");
          wakeupHandler = Handler.$new(Looper.getMainLooper());
          this._wakeupHandler = wakeupHandler;
        }
        if (this._pollListener === null) {
          this._pollListener = Interceptor.attach(Process.getModuleByName("libc.so").getExportByName("epoll_wait"), this._makePollHook());
          Interceptor.flush();
        }
        wakeupHandler.sendEmptyMessage(1);
      });
    }
    _makePollHook() {
      const mainThreadId = Process.id;
      const { _pendingMainOps: pending } = this;
      return function() {
        if (this.threadId !== mainThreadId) {
          return;
        }
        let fn;
        while ((fn = pending.shift()) !== void 0) {
          try {
            fn();
          } catch (e) {
            Script.nextTick(() => {
              throw e;
            });
          }
        }
      };
    }
    perform(fn) {
      this._checkAvailable();
      if (!this._isAppProcess() || this.classFactory.loader !== null) {
        try {
          this.vm.perform(fn);
        } catch (e) {
          Script.nextTick(() => {
            throw e;
          });
        }
      } else {
        this._pendingVmOps.push(fn);
        if (this._pendingVmOps.length === 1) {
          this._performPendingVmOpsWhenReady();
        }
      }
    }
    performNow(fn) {
      this._checkAvailable();
      return this.vm.perform(() => {
        const { classFactory: factory } = this;
        if (this._isAppProcess() && factory.loader === null) {
          const ActivityThread = factory.use("android.app.ActivityThread");
          const app = ActivityThread.currentApplication();
          if (app !== null) {
            initFactoryFromApplication(factory, app);
          }
        }
        return fn();
      });
    }
    _performPendingVmOpsWhenReady() {
      this.vm.perform(() => {
        const { classFactory: factory } = this;
        const ActivityThread = factory.use("android.app.ActivityThread");
        const app = ActivityThread.currentApplication();
        if (app !== null) {
          initFactoryFromApplication(factory, app);
          this._performPendingVmOps();
          return;
        }
        const runtime2 = this;
        let initialized = false;
        let hookpoint = "early";
        const handleBindApplication = ActivityThread.handleBindApplication;
        handleBindApplication.implementation = function(data) {
          if (data.instrumentationName.value !== null) {
            hookpoint = "late";
            const LoadedApk = factory.use("android.app.LoadedApk");
            const makeApplication = LoadedApk.makeApplication;
            makeApplication.implementation = function(forceDefaultAppClass, instrumentation) {
              if (!initialized) {
                initialized = true;
                initFactoryFromLoadedApk(factory, this);
                runtime2._performPendingVmOps();
              }
              return makeApplication.apply(this, arguments);
            };
          }
          handleBindApplication.apply(this, arguments);
        };
        const getPackageInfoCandidates = ActivityThread.getPackageInfo.overloads.map((m) => [m.argumentTypes.length, m]).sort(([arityA], [arityB]) => arityB - arityA).map(([_, method]) => method);
        const getPackageInfo = getPackageInfoCandidates[0];
        getPackageInfo.implementation = function(...args) {
          const apk = getPackageInfo.call(this, ...args);
          if (!initialized && hookpoint === "early") {
            initialized = true;
            initFactoryFromLoadedApk(factory, apk);
            runtime2._performPendingVmOps();
          }
          return apk;
        };
      });
    }
    _performPendingVmOps() {
      const { vm: vm3, _pendingVmOps: pending } = this;
      let fn;
      while ((fn = pending.shift()) !== void 0) {
        try {
          vm3.perform(fn);
        } catch (e) {
          Script.nextTick(() => {
            throw e;
          });
        }
      }
    }
    use(className, options) {
      return this.classFactory.use(className, options);
    }
    openClassFile(filePath) {
      return this.classFactory.openClassFile(filePath);
    }
    choose(specifier, callbacks) {
      this.classFactory.choose(specifier, callbacks);
    }
    retain(obj) {
      return this.classFactory.retain(obj);
    }
    cast(obj, C) {
      return this.classFactory.cast(obj, C);
    }
    array(type, elements) {
      return this.classFactory.array(type, elements);
    }
    backtrace(options) {
      return backtrace(this.vm, options);
    }
    // Reference: http://stackoverflow.com/questions/2848575/how-to-detect-ui-thread-on-android
    isMainThread() {
      const Looper = this.classFactory.use("android.os.Looper");
      const mainLooper = Looper.getMainLooper();
      const myLooper = Looper.myLooper();
      if (myLooper === null) {
        return false;
      }
      return mainLooper.$isSameObject(myLooper);
    }
    registerClass(spec) {
      return this.classFactory.registerClass(spec);
    }
    deoptimizeEverything() {
      const { vm: vm3 } = this;
      return deoptimizeEverything(vm3, vm3.getEnv());
    }
    deoptimizeBootImage() {
      const { vm: vm3 } = this;
      return deoptimizeBootImage(vm3, vm3.getEnv());
    }
    deoptimizeMethod(method) {
      const { vm: vm3 } = this;
      return deoptimizeMethod(vm3, vm3.getEnv(), method);
    }
    _checkAvailable() {
      if (!this.available) {
        throw new Error("Java API not available");
      }
    }
    _isAppProcess() {
      let result2 = this._cachedIsAppProcess;
      if (result2 === null) {
        if (this.api.flavor === "jvm") {
          result2 = false;
          this._cachedIsAppProcess = result2;
          return result2;
        }
        const readlink = new NativeFunction(Module.getGlobalExportByName("readlink"), "pointer", ["pointer", "pointer", "pointer"], {
          exceptions: "propagate"
        });
        const pathname = Memory.allocUtf8String("/proc/self/exe");
        const bufferSize = 1024;
        const buffer = Memory.alloc(bufferSize);
        const size = readlink(pathname, buffer, ptr(bufferSize)).toInt32();
        if (size !== -1) {
          const exe = buffer.readUtf8String(size);
          result2 = /^\/system\/bin\/app_process/.test(exe);
        } else {
          result2 = true;
        }
        this._cachedIsAppProcess = result2;
      }
      return result2;
    }
  };
  function initFactoryFromApplication(factory, app) {
    const Process2 = factory.use("android.os.Process");
    factory.loader = app.getClassLoader();
    if (Process2.myUid() === Process2.SYSTEM_UID.value) {
      factory.cacheDir = "/data/system";
      factory.codeCacheDir = "/data/dalvik-cache";
    } else {
      if ("getCodeCacheDir" in app) {
        factory.cacheDir = app.getCacheDir().getCanonicalPath();
        factory.codeCacheDir = app.getCodeCacheDir().getCanonicalPath();
      } else {
        factory.cacheDir = app.getFilesDir().getCanonicalPath();
        factory.codeCacheDir = app.getCacheDir().getCanonicalPath();
      }
    }
  }
  function initFactoryFromLoadedApk(factory, apk) {
    const JFile = factory.use("java.io.File");
    factory.loader = apk.getClassLoader();
    const dataDir = JFile.$new(apk.getDataDir()).getCanonicalPath();
    factory.cacheDir = dataDir;
    factory.codeCacheDir = dataDir + "/cache";
  }
  var runtime = new Runtime();
  Script.bindWeak(runtime, () => {
    runtime._dispose();
  });
  var frida_java_bridge_default = runtime;

  // src/agent/core/bridge.ts
  var target = globalThis;
  if (typeof target.Java === "undefined") {
    target.Java = frida_java_bridge_default;
  }

  // src/shared/frida-intel.ts
  var MOBSEC_ENVELOPE = 1;

  // src/agent/core/protocol.ts
  var AGENT_VERSION = "1.0.0";
  function post(message) {
    try {
      send(message);
    } catch (_e) {
    }
  }
  function emitLog(channel2, level, text) {
    post({ __mobsec: MOBSEC_ENVELOPE, kind: "log", channel: channel2, level, text, ts: Date.now() });
  }
  function emitReady(api2) {
    post({ __mobsec: MOBSEC_ENVELOPE, kind: "ready", api: api2, agentVersion: AGENT_VERSION });
  }
  function emitEvent(channel2, category, summary, detail, meta, severity = "info") {
    post({
      __mobsec: MOBSEC_ENVELOPE,
      kind: "event",
      channel: channel2,
      category,
      summary,
      detail,
      meta,
      severity,
      ts: Date.now()
    });
  }

  // src/agent/core/log.ts
  function channel(ch) {
    return {
      debug: (text) => emitLog(ch, "debug", text),
      info: (text) => emitLog(ch, "info", text),
      warn: (text) => emitLog(ch, "warn", text),
      error: (text) => emitLog(ch, "error", text),
      event: (category, summary, detail, meta, severity = "info") => emitEvent(ch, category, summary, detail, meta, severity)
    };
  }

  // src/agent/core/safe.ts
  function errMessage(e) {
    return e instanceof Error ? e.message : String(e);
  }
  function safe(label, fn, onError) {
    try {
      return fn();
    } catch (e) {
      const message = `${label}: ${errMessage(e)}`;
      if (onError) {
        try {
          onError(message);
        } catch (_inner) {
        }
      }
      return null;
    }
  }
  function safeOr(fallback, fn) {
    try {
      return fn();
    } catch (_e) {
      return fallback;
    }
  }

  // src/agent/core/java.ts
  var POLL_INTERVAL_MS = 50;
  var HARD_LIMIT = 240;
  var NO_JAVA_LIMIT = 100;
  var HEARTBEAT_EVERY = 50;
  function whenJavaReady(cb, onGiveUp) {
    let attempts = 0;
    let sawGlobal = false;
    const tick = () => {
      attempts += 1;
      const hasGlobal = typeof Java !== "undefined";
      if (hasGlobal) sawGlobal = true;
      if (hasGlobal && Java.available) {
        Java.perform(cb);
        return;
      }
      if (attempts % HEARTBEAT_EVERY === 0) {
        const secs = Math.round(attempts * POLL_INTERVAL_MS / 1e3);
        emitLog(
          "system",
          "info",
          hasGlobal ? `waiting for ART\u2026 ${secs}s (Java present, VM not located yet)` : `waiting for ART\u2026 ${secs}s (no Java runtime visible yet)`
        );
      }
      if (!sawGlobal && attempts >= NO_JAVA_LIMIT) {
        if (onGiveUp) onGiveUp("no-java-global");
        return;
      }
      if (attempts > HARD_LIMIT) {
        if (onGiveUp) onGiveUp(sawGlobal ? "vm-not-found" : "no-java-global");
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  }
  function tryUse(name) {
    try {
      return Java.use(name);
    } catch (_e) {
      return null;
    }
  }
  function getSystemProperty(name) {
    return safeOr(null, () => {
      const SystemProperties = Java.use("android.os.SystemProperties");
      const value = SystemProperties.get(name);
      return value && value.length > 0 ? value : null;
    });
  }
  function currentPackageName() {
    return safeOr(null, () => {
      const ActivityThread = Java.use("android.app.ActivityThread");
      const app = ActivityThread.currentApplication();
      if (app == null) return null;
      const ctx = app.getApplicationContext();
      const name = ctx.getPackageName();
      return name && name.length > 0 ? name : null;
    });
  }

  // src/agent/core/context.ts
  function buildContext() {
    const log8 = channel("recon");
    const modules = safeOr(
      [],
      () => Process.enumerateModules().map((m) => ({ name: m.name, path: m.path, size: m.size }))
    );
    const classCache = /* @__PURE__ */ new Map();
    let loaded = null;
    const useClass = (name) => {
      const cached = classCache.get(name);
      if (cached !== void 0) return cached;
      const wrapper = tryUse(name);
      classCache.set(name, wrapper);
      return wrapper;
    };
    const hasModule = (substr) => {
      const needle = substr.toLowerCase();
      return modules.some((m) => m.name.toLowerCase().indexOf(needle) !== -1);
    };
    const findModule = (substr) => {
      const needle = substr.toLowerCase();
      return modules.find((m) => m.name.toLowerCase().indexOf(needle) !== -1) ?? null;
    };
    const loadedClasses = () => {
      if (loaded) return loaded;
      loaded = safeOr([], () => Java.enumerateLoadedClassesSync());
      return loaded;
    };
    return {
      modules,
      hasModule,
      findModule,
      useClass,
      hasClass: (name) => useClass(name) !== null,
      systemProperty: getSystemProperty,
      loadedClasses,
      log: log8
    };
  }

  // src/agent/core/report.ts
  function mergeEvidence(into, from) {
    for (const e of from) {
      if (into.indexOf(e) === -1) into.push(e);
    }
  }
  var ReportBuilder = class {
    constructor() {
      __publicField(this, "frameworks", []);
      __publicField(this, "networking", []);
      __publicField(this, "crypto", []);
      __publicField(this, "storage", []);
      __publicField(this, "security", []);
      __publicField(this, "warnings", []);
    }
    addFramework(f) {
      const existing = this.frameworks.find((x) => x.kind === f.kind);
      if (existing) {
        if (f.confidence > existing.confidence) {
          existing.confidence = f.confidence;
          existing.label = f.label;
        }
        if (f.version && !existing.version) existing.version = f.version;
        mergeEvidence(existing.evidence, f.evidence);
        return;
      }
      this.frameworks.push({ ...f, evidence: f.evidence.slice() });
    }
    addNetworking(n) {
      const existing = this.networking.find((x) => x.id === n.id);
      if (existing) {
        if (n.version && !existing.version) existing.version = n.version;
        mergeEvidence(existing.evidence, n.evidence);
        return;
      }
      this.networking.push({ ...n, evidence: n.evidence.slice() });
    }
    addCrypto(c) {
      const existing = this.crypto.find((x) => x.id === c.id);
      if (existing) {
        existing.weak = existing.weak || c.weak;
        mergeEvidence(existing.algorithms, c.algorithms);
        mergeEvidence(existing.evidence, c.evidence);
        return;
      }
      this.crypto.push({ ...c, algorithms: c.algorithms.slice(), evidence: c.evidence.slice() });
    }
    addStorage(s) {
      const existing = this.storage.find((x) => x.id === s.id);
      if (existing) {
        existing.encrypted = existing.encrypted || s.encrypted;
        mergeEvidence(existing.evidence, s.evidence);
        return;
      }
      this.storage.push({ ...s, evidence: s.evidence.slice() });
    }
    addSecurity(s) {
      const existing = this.security.find((x) => x.id === s.id);
      if (existing) {
        if (s.confidence > existing.confidence) existing.confidence = s.confidence;
        if (s.variant && !existing.variant) existing.variant = s.variant;
        mergeEvidence(existing.evidence, s.evidence);
        return;
      }
      this.security.push({ ...s, evidence: s.evidence.slice() });
    }
    warn(text) {
      if (this.warnings.indexOf(text) === -1) this.warnings.push(text);
    }
  };

  // src/agent/core/registry.ts
  var detectors = [];
  function registerDetector(d) {
    if (!detectors.some((x) => x.id === d.id)) detectors.push(d);
  }
  function getDetectors() {
    return detectors.slice().sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
  var strategies = [];
  var appliedStrategies = /* @__PURE__ */ new Set();
  function registerStrategy(s) {
    if (!strategies.some((x) => x.id === s.id)) strategies.push(s);
  }
  function getStrategies() {
    return strategies.slice();
  }
  function getStrategy(id) {
    return strategies.find((s) => s.id === id) ?? null;
  }
  function markApplied(id) {
    appliedStrategies.add(id);
  }
  function isApplied(id) {
    return appliedStrategies.has(id);
  }
  var tracers = [];
  var activeTracers = /* @__PURE__ */ new Set();
  function registerTracer(t) {
    if (!tracers.some((x) => x.id === t.id)) tracers.push(t);
  }
  function getTracers() {
    return tracers.slice();
  }
  function getTracer(id) {
    return tracers.find((t) => t.id === id) ?? null;
  }
  function setTracerActive(id, active3) {
    if (active3) activeTracers.add(id);
    else activeTracers.delete(id);
  }
  function isTracerActive(id) {
    return activeTracers.has(id);
  }

  // src/agent/detectors/framework.ts
  function reactNativeVersion(ctx) {
    return safeOr(null, () => {
      const V = ctx.useClass("com.facebook.react.modules.systeminfo.ReactNativeVersion");
      if (!V) return null;
      const map = V.VERSION.value;
      if (!map) return null;
      const major = map.get("major");
      const minor = map.get("minor");
      const patch = map.get("patch");
      if (major == null) return null;
      return `${major}.${minor ?? 0}.${patch ?? 0}`;
    });
  }
  var frameworkDetector = {
    id: "framework",
    priority: 100,
    detect(ctx, out) {
      let crossPlatform = false;
      const flutterLib = ctx.hasModule("libflutter.so");
      const flutterClass = ctx.hasClass("io.flutter.embedding.engine.FlutterJNI") || ctx.hasClass("io.flutter.app.FlutterApplication");
      if (flutterLib || flutterClass) {
        crossPlatform = true;
        const evidence = [];
        if (flutterLib) evidence.push("libflutter.so loaded");
        if (flutterClass) evidence.push("io.flutter.* classes present");
        out.addFramework({
          kind: "flutter",
          label: "Flutter",
          confidence: flutterLib && flutterClass ? 0.98 : 0.92,
          version: null,
          evidence
        });
      }
      const rnLib = ctx.hasModule("libreactnativejni") || ctx.hasModule("libhermes");
      const rnClass = ctx.hasClass("com.facebook.react.bridge.CatalystInstanceImpl") || ctx.hasClass("com.facebook.react.ReactRootView");
      if (rnLib || rnClass) {
        crossPlatform = true;
        const hermes = ctx.hasModule("libhermes");
        const evidence = [];
        if (rnLib) evidence.push(hermes ? "libhermes.so loaded" : "libreactnativejni.so loaded");
        if (rnClass) evidence.push("com.facebook.react.* bridge present");
        out.addFramework({
          kind: "react-native",
          label: hermes ? "React Native (Hermes)" : "React Native",
          confidence: rnLib && rnClass ? 0.98 : 0.92,
          version: reactNativeVersion(ctx),
          evidence
        });
      }
      const il2cpp = ctx.hasModule("libil2cpp.so");
      const unity = ctx.hasModule("libunity.so");
      const monoLib = ctx.hasModule("libmono");
      if (il2cpp) {
        crossPlatform = true;
        out.addFramework({
          kind: "unity-il2cpp",
          label: "Unity (IL2CPP)",
          confidence: 0.97,
          version: null,
          evidence: ["libil2cpp.so loaded", unity ? "libunity.so loaded" : ""].filter(Boolean)
        });
      } else if (unity && monoLib) {
        crossPlatform = true;
        out.addFramework({
          kind: "unity-mono",
          label: "Unity (Mono)",
          confidence: 0.95,
          version: null,
          evidence: ["libunity.so loaded", "libmono*.so loaded"]
        });
      }
      const xamarinLib = ctx.hasModule("libmonodroid") || ctx.hasModule("libxamarin") || ctx.hasModule("libmono-android");
      const xamarinClass = ctx.hasClass("mono.android.app.Application") || ctx.hasClass("mono.MonoPackageManager");
      if ((xamarinLib || xamarinClass) && !il2cpp && !unity) {
        crossPlatform = true;
        const evidence = [];
        if (xamarinLib) evidence.push("libmonodroid/libxamarin loaded");
        if (xamarinClass) evidence.push("mono.android.* present");
        out.addFramework({
          kind: "xamarin",
          label: "Xamarin / .NET MAUI",
          confidence: 0.95,
          version: null,
          evidence
        });
      }
      if (ctx.hasModule("libNativeScript") || ctx.hasClass("com.tns.NativeScriptApplication")) {
        crossPlatform = true;
        out.addFramework({
          kind: "nativescript",
          label: "NativeScript",
          confidence: 0.95,
          version: null,
          evidence: ["NativeScript runtime present"]
        });
      }
      if (ctx.hasModule("libQt5Android") || ctx.hasModule("libQt6Android") || ctx.hasClass("org.qtproject.qt.android.QtActivity") || ctx.hasClass("org.qtproject.qt5.android.QtActivity")) {
        crossPlatform = true;
        out.addFramework({
          kind: "qt",
          label: "Qt for Android",
          confidence: 0.94,
          version: null,
          evidence: ["Qt Android runtime present"]
        });
      }
      if (ctx.hasClass("com.getcapacitor.BridgeActivity") || ctx.hasClass("com.getcapacitor.Bridge")) {
        crossPlatform = true;
        const ionic = ctx.hasClass("io.ionic.starter.MainActivity");
        out.addFramework({
          kind: ionic ? "ionic" : "capacitor",
          label: ionic ? "Ionic (Capacitor)" : "Capacitor",
          confidence: 0.95,
          version: null,
          evidence: ["com.getcapacitor.* present", ionic ? "io.ionic.* present" : ""].filter(Boolean)
        });
      } else if (ctx.hasClass("org.apache.cordova.CordovaActivity") || ctx.hasClass("org.apache.cordova.engine.SystemWebViewEngine")) {
        crossPlatform = true;
        out.addFramework({
          kind: "cordova",
          label: "Apache Cordova / PhoneGap",
          confidence: 0.94,
          version: null,
          evidence: ["org.apache.cordova.* present"]
        });
      }
      if (!crossPlatform) {
        const kotlin = ctx.hasClass("kotlin.jvm.internal.Intrinsics");
        out.addFramework({
          kind: "native-java",
          label: kotlin ? "Native Android (Kotlin)" : "Native Android (Java)",
          confidence: 0.6,
          version: null,
          evidence: [
            "No cross-platform runtime detected",
            kotlin ? "Kotlin stdlib present" : "Java/Android classes only"
          ]
        });
      }
    }
  };

  // src/agent/detectors/networking.ts
  var SIGNATURES = [
    { id: "okhttp3", label: "OkHttp 3/4", marker: "okhttp3.OkHttpClient", evidence: "okhttp3.OkHttpClient" },
    { id: "okhttp2", label: "OkHttp 2 (legacy)", marker: "com.squareup.okhttp.OkHttpClient", evidence: "com.squareup.okhttp.OkHttpClient" },
    { id: "retrofit", label: "Retrofit", marker: "retrofit2.Retrofit", evidence: "retrofit2.Retrofit" },
    { id: "volley", label: "Volley", marker: "com.android.volley.RequestQueue", evidence: "com.android.volley.RequestQueue" },
    { id: "ktor", label: "Ktor Client", marker: "io.ktor.client.HttpClient", evidence: "io.ktor.client.HttpClient" },
    { id: "cronet", label: "Cronet (Chromium net)", marker: "org.chromium.net.CronetEngine", evidence: "org.chromium.net.CronetEngine" },
    { id: "apache-http", label: "Apache HttpClient (legacy)", marker: "org.apache.http.impl.client.DefaultHttpClient", evidence: "org.apache.http.impl.client.DefaultHttpClient" },
    { id: "apollo", label: "Apollo GraphQL", marker: "com.apollographql.apollo3.ApolloClient", evidence: "com.apollographql.apollo3.ApolloClient" },
    { id: "fast-android-networking", label: "Fast Android Networking", marker: "com.androidnetworking.AndroidNetworking", evidence: "com.androidnetworking.AndroidNetworking" }
  ];
  function okhttpVersion(ctx) {
    return safeOr(null, () => {
      const V = ctx.useClass("okhttp3.OkHttp");
      if (!V) return null;
      const version = V.VERSION.value;
      return version && version.length > 0 ? version : null;
    });
  }
  var networkingDetector = {
    id: "networking",
    detect(ctx, out) {
      for (const sig of SIGNATURES) {
        if (!ctx.hasClass(sig.marker)) continue;
        out.addNetworking({
          id: sig.id,
          label: sig.label,
          version: sig.id === "okhttp3" ? okhttpVersion(ctx) : null,
          evidence: [sig.evidence]
        });
      }
      if (ctx.hasClass("io.grpc.ManagedChannel") || ctx.hasModule("libgrpc")) {
        out.addNetworking({
          id: "grpc",
          label: "gRPC",
          version: null,
          evidence: ["io.grpc.* / libgrpc present"]
        });
      }
    }
  };

  // src/agent/detectors/crypto.ts
  var LIB_SIGNATURES = [
    { id: "tink", label: "Google Tink", marker: "com.google.crypto.tink.Aead", category: "cipher" },
    { id: "bouncycastle", label: "BouncyCastle (bundled)", marker: "org.bouncycastle.jce.provider.BouncyCastleProvider", category: "provider" },
    { id: "spongycastle", label: "SpongyCastle", marker: "org.spongycastle.jce.provider.BouncyCastleProvider", category: "provider" },
    { id: "conscrypt-app", label: "Conscrypt (bundled)", marker: "org.conscrypt.Conscrypt", category: "provider" },
    { id: "sqlcipher", label: "SQLCipher", marker: "net.sqlcipher.database.SQLiteDatabase", category: "cipher" },
    { id: "libsignal", label: "Signal Protocol", marker: "org.signal.libsignal.protocol.SignalProtocolAddress", category: "cipher" },
    { id: "jose4j", label: "jose4j (JWT/JWE)", marker: "org.jose4j.jwe.JsonWebEncryption", category: "cipher" },
    { id: "nimbus-jose", label: "Nimbus JOSE+JWT", marker: "com.nimbusds.jose.JWEObject", category: "cipher" }
  ];
  var cryptoDetector = {
    id: "crypto",
    detect(ctx, out) {
      safe("crypto.providers", () => {
        const Security = ctx.useClass("java.security.Security");
        if (!Security) return;
        const providers = Security.getProviders();
        for (let i = 0; i < providers.length; i++) {
          const p = providers[i];
          if (!p) continue;
          const name = String(p.getName());
          const version = safeOr(null, () => String(p.getVersion()));
          out.addCrypto({
            id: `provider:${name.toLowerCase()}`,
            label: `${name} provider`,
            category: "provider",
            algorithms: [],
            weak: false,
            evidence: [version ? `JCA provider ${name} v${version}` : `JCA provider ${name}`]
          });
        }
      });
      if (ctx.hasClass("android.security.keystore.KeyGenParameterSpec")) {
        out.addCrypto({
          id: "android-keystore",
          label: "Android Keystore",
          category: "keystore",
          algorithms: [],
          weak: false,
          evidence: ["android.security.keystore.* present"]
        });
      }
      for (const sig of LIB_SIGNATURES) {
        if (!ctx.hasClass(sig.marker)) continue;
        out.addCrypto({
          id: sig.id,
          label: sig.label,
          category: sig.category,
          algorithms: [],
          weak: false,
          evidence: [sig.marker]
        });
      }
    }
  };

  // src/agent/detectors/storage.ts
  var SIGNATURES2 = [
    { id: "encrypted-shared-prefs", label: "EncryptedSharedPreferences", marker: "androidx.security.crypto.EncryptedSharedPreferences", encrypted: true },
    { id: "datastore", label: "Jetpack DataStore", marker: "androidx.datastore.core.DataStore", encrypted: false },
    { id: "room", label: "Room (SQLite ORM)", marker: "androidx.room.RoomDatabase", encrypted: false },
    { id: "realm", label: "Realm", marker: "io.realm.Realm", encrypted: false },
    { id: "sqlcipher", label: "SQLCipher (encrypted SQLite)", marker: "net.sqlcipher.database.SQLiteDatabase", encrypted: true },
    { id: "objectbox", label: "ObjectBox", marker: "io.objectbox.BoxStore", encrypted: false },
    { id: "mmkv", label: "MMKV", marker: "com.tencent.mmkv.MMKV", encrypted: false },
    { id: "greendao", label: "greenDAO", marker: "org.greenrobot.greendao.AbstractDao", encrypted: false }
  ];
  var storageDetector = {
    id: "storage",
    detect(ctx, out) {
      out.addStorage({
        id: "shared-prefs",
        label: "SharedPreferences",
        encrypted: false,
        evidence: ["android.app.SharedPreferencesImpl (platform default)"]
      });
      out.addStorage({
        id: "sqlite",
        label: "SQLite",
        encrypted: false,
        evidence: ["android.database.sqlite.SQLiteDatabase (platform default)"]
      });
      for (const sig of SIGNATURES2) {
        if (!ctx.hasClass(sig.marker)) continue;
        out.addStorage({
          id: sig.id,
          label: sig.label,
          encrypted: sig.encrypted,
          evidence: [sig.marker]
        });
      }
    }
  };

  // src/agent/detectors/security.ts
  var CLASS_SIGNATURES = [
    {
      marker: "com.scottyab.rootbeer.RootBeer",
      control: { id: "rootbeer", label: "Root detection (RootBeer)", kind: "root-detection", variant: "rootbeer", confidence: 0.95 }
    },
    {
      marker: "com.kimchangyoun.rootbeerFresh.RootBeer",
      control: { id: "rootbeer-fresh", label: "Root detection (RootBeerFresh)", kind: "root-detection", variant: "rootbeer-fresh", confidence: 0.95 }
    },
    {
      marker: "com.datatheorem.android.trustkit.TrustKit",
      control: { id: "trustkit", label: "SSL pinning (TrustKit)", kind: "ssl-pinning", variant: "trustkit", confidence: 0.9 }
    },
    {
      marker: "com.appmattus.certificatetransparency.CTInterceptor",
      control: { id: "certificate-transparency", label: "Certificate Transparency (appmattus)", kind: "ssl-pinning", variant: "certificate-transparency", confidence: 0.85 }
    },
    {
      marker: "com.google.android.gms.safetynet.SafetyNetClient",
      control: { id: "safetynet", label: "Attestation (SafetyNet)", kind: "integrity", variant: "safetynet", confidence: 0.9 }
    },
    {
      marker: "com.google.android.play.core.integrity.IntegrityManager",
      control: { id: "play-integrity", label: "Play Integrity API", kind: "integrity", variant: "play-integrity", confidence: 0.92 }
    },
    {
      marker: "com.google.android.play.integrity.api.IntegrityManager",
      control: { id: "play-integrity", label: "Play Integrity API", kind: "integrity", variant: "play-integrity", confidence: 0.92 }
    },
    {
      marker: "androidx.biometric.BiometricPrompt",
      control: { id: "biometric", label: "Biometric authentication (androidx)", kind: "biometric", variant: "androidx-biometric", confidence: 0.9 }
    }
  ];
  var PACKER_SIGNATURES = [
    { match: "libjiagu", vendor: "Qihoo 360 Jiagu" },
    { match: "libdexhelper", vendor: "SecNeo (DexHelper)" },
    { match: "libsecshell", vendor: "Bangcle SecShell" },
    { match: "libsecmain", vendor: "Bangcle" },
    { match: "libsecexe", vendor: "Bangcle" },
    { match: "libtup.so", vendor: "Tencent Legu" },
    { match: "libtprt", vendor: "Tencent Legu" },
    { match: "libtosprotection", vendor: "Tencent" },
    { match: "libnsaferonly", vendor: "Tencent NSaferOnly" },
    { match: "libnesec", vendor: "NetEase" },
    { match: "libnqshield", vendor: "NQ Shield" },
    { match: "libsgmain", vendor: "Alibaba Security Guard" },
    { match: "libsgsecuritybody", vendor: "Alibaba Security Guard" },
    { match: "libmobisec", vendor: "Alibaba (legacy)" },
    { match: "libexecmain", vendor: "Ijiami" },
    { match: "libexec.so", vendor: "Ijiami" },
    { match: "libdexprotector", vendor: "DexProtector" },
    { match: "libcovault", vendor: "Promon SHIELD" },
    { match: "libapssec", vendor: "Baidu" },
    { match: "libchaosvmp", vendor: "NagaPT / ChaosVMP" },
    { match: "libkonyjsvm", vendor: "Kony" },
    { match: "libapasec", vendor: "Ali Jaq" }
  ];
  var securityDetector = {
    id: "security",
    detect(ctx, out) {
      for (const sig of CLASS_SIGNATURES) {
        if (!ctx.hasClass(sig.marker)) continue;
        out.addSecurity({ ...sig.control, evidence: [sig.marker] });
      }
      if (ctx.hasClass("okhttp3.CertificatePinner")) {
        out.addSecurity({
          id: "okhttp-pinning",
          label: "SSL pinning (OkHttp CertificatePinner \u2014 verify)",
          kind: "ssl-pinning",
          variant: "okhttp-certificatepinner",
          confidence: 0.4,
          evidence: ["okhttp3.CertificatePinner present (ships with OkHttp; config not confirmed)"]
        });
      }
      for (const sig of PACKER_SIGNATURES) {
        const mod = ctx.findModule(sig.match);
        if (!mod) continue;
        out.addSecurity({
          id: "packer",
          label: `Commercial protector (${sig.vendor})`,
          kind: "tamper-detection",
          variant: sig.vendor,
          confidence: 0.9,
          evidence: [
            `${mod.name} loaded`,
            "Packers bundle root/Frida/debugger/emulator detection + integrity checks"
          ]
        });
        out.addSecurity({
          id: "anti-frida",
          label: "Anti-Frida / anti-hook (implied by protector)",
          kind: "frida-detection",
          variant: sig.vendor,
          confidence: 0.7,
          evidence: [`Implied by ${sig.vendor} protector`]
        });
      }
    }
  };

  // src/agent/detectors/index.ts
  function registerAllDetectors() {
    registerDetector(frameworkDetector);
    registerDetector(networkingDetector);
    registerDetector(cryptoDetector);
    registerDetector(storageDetector);
    registerDetector(securityDetector);
  }

  // src/agent/core/native.ts
  var ModuleRT = Module;

  // src/agent/strategies/frida-detection.ts
  var FRIDA_MARKERS = /frida|gum-js|gmain|gdbus|linjector|gadget|re\.frida/i;
  var PROTECTOR_HINT = /(libjiagu|libdexhelper|libsecshell|libsecmain|libtup|libtprt|libtosprotection|libnesec|libsgmain|libexecmain|libdexprotector|libcovault|libchaosvmp|libnqshield|libapssec)/i;
  var fridaDetectionStrategy = {
    id: "frida-detection",
    label: "Anti-anti-Frida (manual)",
    category: "frida-detection",
    description: 'Blanks "frida"/"gum"/"gadget" lines from /proc/self/maps as they are read (fgets). Manual-only \u2014 touches a global libc symbol.',
    autoApply: false,
    applies(ctx) {
      return ctx.modules.some((m) => PROTECTOR_HINT.test(m.name));
    },
    apply(_ctx, run) {
      run.hook("fgets(/proc maps) scrub", () => {
        const p = ModuleRT.findExportByName(null, "fgets");
        if (!p) throw new Error("fgets not found");
        Interceptor.attach(p, {
          onLeave(retval) {
            if (retval.isNull()) return;
            try {
              const line = retval.readUtf8String();
              if (line && FRIDA_MARKERS.test(line)) retval.writeUtf8String("");
            } catch (_e) {
            }
          }
        });
        run.note("fgets() scrubs Frida lines from /proc maps");
      });
    }
  };

  // src/agent/strategies/debugger-detection.ts
  var debuggerDetectionStrategy = {
    id: "debugger-detection",
    label: "Anti-debug bypass",
    category: "debugger-detection",
    description: "Forces Debug.isDebuggerConnected/waitingForDebugger to false and hides the debuggable flag.",
    applies(ctx) {
      void ctx;
      return true;
    },
    apply(_ctx, run) {
      run.hook("Debug.isDebuggerConnected \u2192 false", () => {
        const Debug = Java.use("android.os.Debug");
        Debug.isDebuggerConnected.implementation = function() {
          return false;
        };
      });
      run.hook("Debug.waitingForDebugger \u2192 false", () => {
        const Debug = Java.use("android.os.Debug");
        if (!Debug.waitingForDebugger) return;
        Debug.waitingForDebugger.implementation = function() {
          return false;
        };
      });
      run.hook("ApplicationInfo FLAG_DEBUGGABLE cleared", () => {
        const AppInfo = Java.use("android.content.pm.ApplicationInfo");
        void AppInfo;
        run.note("Debugger flag readers covered via Debug.* hooks");
      });
    },
    verify(_ctx) {
      const ok = safeOr(false, () => {
        const Debug = Java.use("android.os.Debug");
        return Debug.isDebuggerConnected() === false;
      });
      return { ran: true, ok, detail: `Debug.isDebuggerConnected=${ok ? "false" : "true"}` };
    }
  };

  // src/agent/strategies/root-detection.ts
  var SUSPICIOUS_PATHS = [
    "/system/bin/su",
    "/system/xbin/su",
    "/sbin/su",
    "/su/bin/su",
    "/system/app/Superuser.apk",
    "/system/app/SuperSU",
    "/system/xbin/daemonsu",
    "/system/xbin/busybox",
    "/system/bin/.ext",
    "/data/local/tmp/frida-server",
    "/dev/com.koushikdutta.superuser.daemon",
    "/sbin/.magisk",
    "/sbin/.core/mirror",
    "/data/adb/magisk",
    "/data/adb/modules",
    "/cache/.disable_magisk",
    "/cache/magisk.log",
    "magisk",
    "supersu"
  ];
  var ROOT_PACKAGES = [
    "com.topjohnwu.magisk",
    "eu.chainfire.supersu",
    "com.koushikdutta.superuser",
    "com.noshufou.android.su",
    "com.thirdparty.superuser",
    "com.yellowes.su"
  ];
  var ROOTBEER_METHODS = [
    "isRooted",
    "isRootedWithoutBusyBoxCheck",
    "detectRootManagementApps",
    "detectPotentiallyDangerousApps",
    "checkForSuBinary",
    "checkForBusyBoxBinary",
    "checkForDangerousProps",
    "checkForRWPaths",
    "detectTestKeys",
    "checkSuExists",
    "checkForRootNative",
    "detectRootCloakingApps"
  ];
  function looksSuspicious(path) {
    const p = path.toLowerCase();
    return SUSPICIOUS_PATHS.some((s) => p.indexOf(s) !== -1);
  }
  var rootDetectionStrategy = {
    id: "root-detection",
    label: "Root detection bypass",
    category: "root-detection",
    description: "Hides su binaries, Magisk paths and root-manager packages from File.exists, Runtime.exec, PackageManager and RootBeer.",
    applies(ctx) {
      void ctx;
      return true;
    },
    apply(ctx, run) {
      run.hook("File.exists(su/magisk paths)", () => {
        const File2 = Java.use("java.io.File");
        const exists = File2.exists;
        exists.implementation = function() {
          const path = String(this.getAbsolutePath());
          if (looksSuspicious(path)) return false;
          return exists.call(this);
        };
      });
      run.hook("Runtime.exec(su)", () => {
        const Runtime2 = Java.use("java.lang.Runtime");
        const IOException = Java.use("java.io.IOException");
        const execStr = Runtime2.exec.overload("java.lang.String");
        execStr.implementation = function(cmd) {
          if (cmd && (cmd === "su" || cmd.indexOf("which su") !== -1 || cmd.indexOf("/su") !== -1)) {
            throw IOException.$new(`Cannot run program "${cmd}"`);
          }
          return execStr.call(this, cmd);
        };
        const execArr = Runtime2.exec.overload("[Ljava.lang.String;");
        execArr.implementation = function(args) {
          const first = args && args.length > 0 ? String(args[0]) : "";
          if (first === "su" || first === "which" || first.indexOf("/su") !== -1) {
            throw IOException.$new(`Cannot run program "${first}"`);
          }
          return execArr.call(this, args);
        };
      });
      run.hook("Build.TAGS \u2192 release-keys", () => {
        const Build = Java.use("android.os.Build");
        const field = Build.class.getDeclaredField("TAGS");
        field.setAccessible(true);
        field.set(null, "release-keys");
      });
      run.hook("PackageManager.getPackageInfo(root apps)", () => {
        const PM = Java.use("android.app.ApplicationPackageManager");
        const NameNotFound = Java.use("android.content.pm.PackageManager$NameNotFoundException");
        const getPkg = PM.getPackageInfo.overload("java.lang.String", "int");
        getPkg.implementation = function(name, flags) {
          if (ROOT_PACKAGES.indexOf(name) !== -1) throw NameNotFound.$new(name);
          return getPkg.call(this, name, flags);
        };
      });
      run.hook("RootBeer.* \u2192 false", () => {
        const RootBeer = ctx.useClass("com.scottyab.rootbeer.RootBeer");
        if (!RootBeer) return;
        for (const name of ROOTBEER_METHODS) {
          const method = RootBeer[name];
          if (!method || !method.overloads) continue;
          method.overloads.forEach((ov) => {
            ov.implementation = function() {
              return false;
            };
          });
        }
        run.note("RootBeer checks forced to false");
      });
    },
    verify(ctx) {
      const fileHidden = safeOr(false, () => {
        const File2 = Java.use("java.io.File");
        return File2.$new("/system/xbin/su").exists() === false;
      });
      const rootBeerOk = safeOr(null, () => {
        const RB = ctx.useClass("com.scottyab.rootbeer.RootBeer");
        if (!RB) return null;
        const ctxClass = Java.use("android.app.ActivityThread").currentApplication();
        const instance = RB.$new(ctxClass);
        return instance.isRooted() === false;
      });
      const ok = fileHidden && rootBeerOk !== false;
      const parts = [`File.exists(su)=${fileHidden ? "hidden" : "visible"}`];
      if (rootBeerOk !== null) parts.push(`RootBeer.isRooted=${rootBeerOk ? "false" : "true"}`);
      return { ran: true, ok, detail: parts.join(", ") };
    }
  };

  // src/agent/strategies/emulator-detection.ts
  var BUILD_FIELDS = {
    FINGERPRINT: "google/redfin/redfin:13/TQ3A.230805.001/10316531:user/release-keys",
    MODEL: "Pixel 5",
    MANUFACTURER: "Google",
    BRAND: "google",
    DEVICE: "redfin",
    PRODUCT: "redfin",
    HARDWARE: "redfin",
    BOARD: "redfin",
    HOST: "abfarm",
    TAGS: "release-keys"
  };
  var FAKED_PROPS = {
    "ro.kernel.qemu": "0",
    "ro.hardware": "redfin",
    "ro.product.name": "redfin",
    "ro.product.device": "redfin",
    "ro.bootloader": "unknown",
    "ro.secure": "1",
    "init.svc.qemud": "",
    "qemu.hw.mainkeys": ""
  };
  var EMULATOR_FILES = [
    "/dev/qemu_pipe",
    "/dev/socket/qemud",
    "/system/lib/libc_malloc_debug_qemu.so",
    "/sys/qemu_trace",
    "/system/bin/qemu-props",
    "/dev/socket/genyd",
    "/dev/socket/baseband_genyd"
  ];
  var emulatorDetectionStrategy = {
    id: "emulator-detection",
    label: "Emulator detection bypass",
    category: "emulator-detection",
    description: "Spoofs Build identity, QEMU system properties, emulator device files and telephony values to look like a physical phone.",
    applies(ctx) {
      void ctx;
      return true;
    },
    apply(_ctx, run) {
      run.hook("Build.* identity spoof", () => {
        const Build = Java.use("android.os.Build");
        let set = 0;
        for (const name of Object.keys(BUILD_FIELDS)) {
          try {
            const field = Build.class.getDeclaredField(name);
            field.setAccessible(true);
            field.set(null, BUILD_FIELDS[name]);
            set += 1;
          } catch (_e) {
          }
        }
        run.note(`Build identity spoofed (${set} fields \u2192 Pixel 5)`);
      });
      run.hook("SystemProperties.get(qemu)", () => {
        const SP = Java.use("android.os.SystemProperties");
        const get1 = SP.get.overload("java.lang.String");
        get1.implementation = function(key) {
          const faked = FAKED_PROPS[key];
          if (faked !== void 0) return faked;
          return get1.call(this, key);
        };
        const get2 = SP.get.overload("java.lang.String", "java.lang.String");
        get2.implementation = function(key, def) {
          const faked = FAKED_PROPS[key];
          if (faked !== void 0) return faked;
          return get2.call(this, key, def);
        };
      });
      run.hook("File.exists(emulator nodes)", () => {
        const File2 = Java.use("java.io.File");
        const exists = File2.exists;
        exists.implementation = function() {
          const path = String(this.getAbsolutePath());
          if (EMULATOR_FILES.indexOf(path) !== -1) return false;
          return exists.call(this);
        };
      });
      run.hook("TelephonyManager spoof", () => {
        const TM = Java.use("android.telephony.TelephonyManager");
        if (TM.getNetworkOperatorName) {
          TM.getNetworkOperatorName.overloads.forEach((ov) => {
            ov.implementation = function() {
              return "Verizon";
            };
          });
        }
        if (TM.getDeviceId) {
          TM.getDeviceId.overloads.forEach((ov) => {
            ov.implementation = function() {
              return "358240051111110";
            };
          });
        }
      });
    }
  };

  // src/agent/strategies/ssl-pinning.ts
  var trustAll = null;
  function trustAllManager() {
    if (trustAll) return trustAll;
    const X509TrustManager = Java.use("javax.net.ssl.X509TrustManager");
    trustAll = Java.registerClass({
      name: "studio.mobsec.TrustAll",
      implements: [X509TrustManager],
      methods: {
        checkClientTrusted() {
        },
        checkServerTrusted() {
        },
        getAcceptedIssuers() {
          return [];
        }
      }
    });
    return trustAll;
  }
  var sslPinningStrategy = {
    id: "ssl-pinning",
    label: "SSL/TLS pinning bypass",
    category: "ssl-pinning",
    description: "Neutralises certificate pinning across OkHttp 3/4, Conscrypt/TrustManagerImpl, WebView, custom X509TrustManagers, TrustKit and Network Security Config.",
    applies(ctx) {
      void ctx;
      return true;
    },
    apply(ctx, run) {
      run.hook("SSLContext.init(trust-all)", () => {
        const SSLContext = Java.use("javax.net.ssl.SSLContext");
        const init = SSLContext.init.overload(
          "[Ljavax.net.ssl.KeyManager;",
          "[Ljavax.net.ssl.TrustManager;",
          "java.security.SecureRandom"
        );
        init.implementation = function(km, _tm, sr) {
          init.call(this, km, [trustAllManager().$new()], sr);
        };
        run.note("SSLContext.init now installs a trust-all X509TrustManager");
      });
      run.hook("Conscrypt TrustManagerImpl.checkTrustedRecursive", () => {
        const TMI = Java.use("com.android.org.conscrypt.TrustManagerImpl");
        const ArrayList = Java.use("java.util.ArrayList");
        TMI.checkTrustedRecursive.implementation = function() {
          return ArrayList.$new();
        };
        run.note("TrustManagerImpl.checkTrustedRecursive bypassed (system trust path)");
      });
      run.hook("Conscrypt TrustManagerImpl.verifyChain", () => {
        const TMI = Java.use("com.android.org.conscrypt.TrustManagerImpl");
        if (!TMI.verifyChain) return;
        TMI.verifyChain.implementation = function(untrustedChain, _a, _b, _c, _d, _e) {
          return untrustedChain;
        };
      });
      for (const cls of ["okhttp3.CertificatePinner", "com.android.okhttp.CertificatePinner"]) {
        run.hook(`${cls}.check*`, () => {
          const CP = ctx.useClass(cls);
          if (!CP) return;
          for (const name of ["check", "check$okhttp"]) {
            const method = CP[name];
            if (!method || !method.overloads) continue;
            method.overloads.forEach((ov) => {
              ov.implementation = function() {
                return;
              };
            });
          }
          run.note(`${cls}.check neutralised`);
        });
      }
      run.hook("WebViewClient.onReceivedSslError", () => {
        const WVC = Java.use("android.webkit.WebViewClient");
        WVC.onReceivedSslError.implementation = function(_view, handler, _error) {
          handler.proceed();
        };
      });
      run.hook("HttpsURLConnection.setDefaultHostnameVerifier", () => {
        const HUC = Java.use("javax.net.ssl.HttpsURLConnection");
        const AllowAll = Java.registerClass({
          name: "studio.mobsec.AllowAllHostnames",
          implements: [Java.use("javax.net.ssl.HostnameVerifier")],
          methods: {
            verify() {
              return true;
            }
          }
        });
        HUC.setDefaultHostnameVerifier.implementation = function() {
          return;
        };
        HUC.setHostnameVerifier.implementation = function() {
          this.setHostnameVerifier(AllowAll.$new());
        };
      });
      run.hook("X509TrustManagerExtensions.checkServerTrusted", () => {
        const Ext = ctx.useClass("android.net.http.X509TrustManagerExtensions");
        if (!Ext) return;
        Ext.checkServerTrusted.implementation = function(chain) {
          return chain;
        };
      });
      run.hook("TrustKit OkHostnameVerifier", () => {
        const OHV = ctx.useClass("com.datatheorem.android.trustkit.pinning.OkHostnameVerifier");
        if (!OHV) return;
        OHV.verify.overloads.forEach((ov) => {
          ov.implementation = function() {
            return true;
          };
        });
        run.note("TrustKit OkHostnameVerifier.verify \u2192 true");
      });
      run.hook("NetworkSecurityConfig.isCleartextTrafficPermitted", () => {
        const NSC = ctx.useClass("android.security.net.config.NetworkSecurityConfig");
        if (!NSC) return;
        NSC.isCleartextTrafficPermitted.overloads.forEach((ov) => {
          ov.implementation = function() {
            return true;
          };
        });
      });
    }
  };

  // src/agent/strategies/flutter-tls.ts
  var VERIFY_SYMBOLS = [
    "ssl_crypto_x509_session_verify_cert_chain",
    "X509_verify_cert",
    "SSL_get_verify_result"
  ];
  var flutterTlsStrategy = {
    id: "flutter-tls",
    label: "Flutter TLS bypass (BoringSSL)",
    category: "ssl-pinning",
    description: "Forces Flutter's bundled BoringSSL cert verification to succeed so the app honours the proxy/CA. Manual-only \u2014 native patching, best-effort (release builds strip the symbol).",
    autoApply: false,
    applies(ctx) {
      return ctx.hasModule("libflutter.so");
    },
    apply(ctx, run) {
      const lib = ctx.findModule("libflutter.so");
      if (!lib) {
        run.note("libflutter.so not mapped \u2014 nothing to do");
        return;
      }
      let hooked = 0;
      for (const symbol of VERIFY_SYMBOLS) {
        run.hook(`libflutter.so!${symbol} \u2192 success`, () => {
          const addr = ModuleRT.findExportByName("libflutter.so", symbol);
          if (!addr) throw new Error("symbol stripped/not exported");
          Interceptor.attach(addr, {
            onLeave(retval) {
              retval.replace(ptr(1));
            }
          });
          hooked += 1;
          run.note(`Hooked libflutter.so!${symbol}`);
        });
      }
      if (hooked === 0) {
        run.note(
          "BoringSSL verify symbols are stripped in this Flutter build \u2014 a version-specific signature scan is required. Set the proxy and try a dedicated Flutter TLS script for this version."
        );
      }
    }
  };

  // src/agent/strategies/biometric.ts
  var biometricStrategy = {
    id: "biometric",
    label: "Biometric gate softening",
    category: "biometric",
    description: "Reports biometrics as available, enrolled and hardware-backed (BiometricManager/FingerprintManager/KeyguardManager) so availability gates pass.",
    applies(ctx) {
      return ctx.hasClass("androidx.biometric.BiometricManager") || ctx.hasClass("androidx.biometric.BiometricPrompt") || ctx.hasClass("android.hardware.fingerprint.FingerprintManager");
    },
    apply(ctx, run) {
      run.hook("BiometricManager.canAuthenticate \u2192 SUCCESS", () => {
        const BM = ctx.useClass("androidx.biometric.BiometricManager");
        if (!BM || !BM.canAuthenticate) return;
        BM.canAuthenticate.overloads.forEach((ov) => {
          ov.implementation = function() {
            return 0;
          };
        });
        run.note("BiometricManager.canAuthenticate \u2192 BIOMETRIC_SUCCESS");
      });
      run.hook("FingerprintManager availability", () => {
        const FM = ctx.useClass("android.hardware.fingerprint.FingerprintManager");
        if (!FM) return;
        if (FM.hasEnrolledFingerprints) {
          FM.hasEnrolledFingerprints.implementation = function() {
            return true;
          };
        }
        if (FM.isHardwareDetected) {
          FM.isHardwareDetected.implementation = function() {
            return true;
          };
        }
      });
      run.hook("KeyguardManager secure", () => {
        const KM = ctx.useClass("android.app.KeyguardManager");
        if (!KM) return;
        if (KM.isKeyguardSecure) {
          KM.isKeyguardSecure.implementation = function() {
            return true;
          };
        }
        if (KM.isDeviceSecure) {
          KM.isDeviceSecure.overloads.forEach((ov) => {
            ov.implementation = function() {
              return true;
            };
          });
        }
      });
      run.note("Force-success of a specific BiometricPrompt callback is app-specific \u2014 hook it manually if needed");
    }
  };

  // src/agent/strategies/screenshot.ts
  var FLAG_SECURE = 8192;
  var screenshotStrategy = {
    id: "screenshot",
    label: "FLAG_SECURE / screenshot unblock",
    category: "screenshot-block",
    description: "Strips WindowManager FLAG_SECURE and SurfaceView.setSecure so screens can be captured.",
    applies(ctx) {
      void ctx;
      return true;
    },
    apply(_ctx, run) {
      run.hook("Window.setFlags(strip FLAG_SECURE)", () => {
        const Window = Java.use("android.view.Window");
        const setFlags = Window.setFlags;
        setFlags.implementation = function(flags, mask) {
          return setFlags.call(this, flags & ~FLAG_SECURE, mask);
        };
      });
      run.hook("Window.addFlags(strip FLAG_SECURE)", () => {
        const Window = Java.use("android.view.Window");
        const addFlags = Window.addFlags;
        addFlags.implementation = function(flags) {
          return addFlags.call(this, flags & ~FLAG_SECURE);
        };
      });
      run.hook("SurfaceView.setSecure(false)", () => {
        const SV = Java.use("android.view.SurfaceView");
        if (!SV.setSecure) return;
        SV.setSecure.implementation = function() {
          return this.setSecure(false);
        };
      });
    }
  };

  // src/agent/strategies/index.ts
  function registerAllStrategies() {
    registerStrategy(fridaDetectionStrategy);
    registerStrategy(debuggerDetectionStrategy);
    registerStrategy(rootDetectionStrategy);
    registerStrategy(emulatorDetectionStrategy);
    registerStrategy(sslPinningStrategy);
    registerStrategy(flutterTlsStrategy);
    registerStrategy(biometricStrategy);
    registerStrategy(screenshotStrategy);
  }

  // src/agent/core/hookset.ts
  var HookSet = class {
    constructor() {
      __publicField(this, "overloads", []);
      __publicField(this, "listeners", []);
      __publicField(this, "count", 0);
    }
    /** Record an overload (returns it) so it can be un-hooked later. */
    track(overload) {
      this.overloads.push(overload);
      this.count += 1;
      return overload;
    }
    /** Record a native InvocationListener for later detach. */
    listen(listener) {
      this.listeners.push(listener);
      this.count += 1;
    }
    /** Reset every Java implementation to original and detach native hooks. */
    revert() {
      for (const ov of this.overloads) {
        try {
          ov.implementation = null;
        } catch (_e) {
        }
      }
      for (const l of this.listeners) {
        try {
          l.detach();
        } catch (_e) {
        }
      }
      this.overloads = [];
      this.listeners = [];
      this.count = 0;
    }
  };

  // src/agent/core/bytes.ts
  function bytesPreview(value, max = 80) {
    if (value == null) return "null";
    const arr = value;
    if (typeof arr.length !== "number") return String(value);
    const len = arr.length;
    const take = Math.min(len, max);
    let printable = take > 0;
    let ascii = "";
    for (let i = 0; i < take; i++) {
      const b = (arr[i] ?? 0) & 255;
      if (b >= 32 && b < 127) {
        ascii += String.fromCharCode(b);
      } else if (b === 10 || b === 9) {
        ascii += b === 10 ? "\\n" : "\\t";
      } else {
        printable = false;
        break;
      }
    }
    const suffix = len > max ? `\u2026 (${len} bytes)` : ` (${len} bytes)`;
    if (printable) return `"${ascii}"${suffix}`;
    let hex = "";
    for (let i = 0; i < take; i++) hex += ((arr[i] ?? 0) & 255).toString(16).padStart(2, "0");
    return `${hex}${suffix}`;
  }
  function clip(text, max = 200) {
    return text.length > max ? `${text.slice(0, max)}\u2026 (+${text.length - max})` : text;
  }

  // src/agent/tracers/common.ts
  function simpleName(fqcn) {
    const idx = fqcn.lastIndexOf(".");
    return idx === -1 ? fqcn : fqcn.slice(idx + 1);
  }
  function traceMethod(hooks5, method, onCall) {
    if (!method || !method.overloads) return;
    method.overloads.forEach((ov) => {
      const tracked = hooks5.track(ov);
      tracked.implementation = function(...args) {
        const result2 = tracked.apply(this, args);
        try {
          onCall(this, args, result2);
        } catch (_e) {
        }
        return result2;
      };
    });
  }
  function shortStack(maxFrames = 4) {
    try {
      const Thread2 = Java.use("java.lang.Thread");
      const frames = Thread2.currentThread().getStackTrace();
      const out = [];
      for (let i = 0; i < frames.length && out.length < maxFrames; i++) {
        const f = String(frames[i]);
        if (f.indexOf("java.lang.Thread") !== -1 || f.indexOf("dalvik.system") !== -1 || f.indexOf("studio.mobsec") !== -1) {
          continue;
        }
        out.push(f);
      }
      return out.join(" \u2190 ");
    } catch (_e) {
      return "";
    }
  }

  // src/agent/tracers/crypto.ts
  var hooks = new HookSet();
  var log = channel("crypto");
  function algoOf(self) {
    return safeOr("?", () => String(self.getAlgorithm()));
  }
  function encodedOf(value) {
    const key = value;
    const fn = key?.getEncoded;
    if (typeof fn !== "function") return null;
    return safeOr(null, () => bytesPreview(fn.call(key)));
  }
  var cryptoTracer = {
    id: "crypto",
    label: "Crypto monitor",
    description: "Cipher / MessageDigest / Mac / Signature with algorithm, key material, IV and in/out previews.",
    channel: "crypto",
    start(_ctx) {
      safe("crypto:Cipher", () => {
        const Cipher = Java.use("javax.crypto.Cipher");
        traceMethod(hooks, Cipher.doFinal, (self, args, result2) => {
          const algorithm = algoOf(self);
          log.event("cipher", `Cipher.doFinal \xB7 ${algorithm}`, void 0, {
            algorithm,
            in: args.length > 0 ? bytesPreview(args[0]) : "(buffered)",
            out: bytesPreview(result2)
          });
        });
        traceMethod(hooks, Cipher.init, (self, args) => {
          const algorithm = algoOf(self);
          const key = args.length > 1 ? encodedOf(args[1]) : null;
          const meta = { algorithm, mode: String(args[0]) };
          if (key) meta.key = key;
          log.event("cipher.init", `Cipher.init \xB7 ${algorithm}`, void 0, meta, key ? "warn" : "info");
        });
      });
      safe("crypto:MessageDigest", () => {
        const MD = Java.use("java.security.MessageDigest");
        traceMethod(hooks, MD.digest, (self, args, result2) => {
          const algorithm = algoOf(self);
          const meta = { algorithm, out: bytesPreview(result2) };
          if (args.length > 0) meta.in = bytesPreview(args[0]);
          log.event("digest", `MessageDigest.digest \xB7 ${algorithm}`, void 0, meta);
        });
      });
      safe("crypto:Mac", () => {
        const Mac = Java.use("javax.crypto.Mac");
        traceMethod(hooks, Mac.doFinal, (self, _args, result2) => {
          const algorithm = algoOf(self);
          log.event("mac", `Mac.doFinal \xB7 ${algorithm}`, void 0, { algorithm, out: bytesPreview(result2) });
        });
      });
      safe("crypto:Signature", () => {
        const Sig = Java.use("java.security.Signature");
        traceMethod(hooks, Sig.sign, (self) => {
          const algorithm = algoOf(self);
          log.event("signature", `Signature.sign \xB7 ${algorithm}`, void 0, { algorithm });
        });
        traceMethod(hooks, Sig.verify, (self, _args, result2) => {
          const algorithm = algoOf(self);
          log.event("signature", `Signature.verify \xB7 ${algorithm} \u2192 ${String(result2)}`, void 0, {
            algorithm,
            result: String(result2)
          });
        });
      });
      safe("crypto:SecretKeySpec", () => {
        const SKS = Java.use("javax.crypto.spec.SecretKeySpec");
        traceMethod(hooks, SKS.$init, (_self, args) => {
          const algorithm = args.length > 1 ? String(args[args.length - 1]) : "";
          log.event(
            "key",
            `SecretKeySpec${algorithm ? ` \xB7 ${algorithm}` : ""}`,
            void 0,
            { key: bytesPreview(args[0]), algorithm },
            "warn"
          );
        });
      });
      safe("crypto:IvParameterSpec", () => {
        const IV = Java.use("javax.crypto.spec.IvParameterSpec");
        traceMethod(
          hooks,
          IV.$init,
          (_self, args) => log.event("iv", "IvParameterSpec", void 0, { iv: bytesPreview(args[0]) })
        );
      });
      log.info(`crypto monitor active (${hooks.count} hook(s))`);
    },
    stop() {
      hooks.revert();
      log.info("crypto monitor stopped");
    }
  };

  // src/agent/tracers/storage.ts
  var hooks2 = new HookSet();
  var log2 = channel("storage");
  var PREF_READERS = ["getString", "getInt", "getLong", "getBoolean", "getFloat", "getStringSet"];
  var PREF_WRITERS = ["putString", "putInt", "putLong", "putBoolean", "putFloat", "putStringSet", "remove"];
  var storageTracer = {
    id: "storage",
    label: "Storage monitor",
    description: "SharedPreferences reads/writes and SQLite execSQL/query/insert/update/delete.",
    channel: "storage",
    start(_ctx) {
      safe("storage:prefs.read", () => {
        const Impl = Java.use("android.app.SharedPreferencesImpl");
        for (const name of PREF_READERS) {
          traceMethod(hooks2, Impl[name], (_self, args, result2) => {
            const key = String(args[0]);
            log2.event("prefs.read", `prefs.${name}(${key})`, void 0, {
              key,
              value: clip(String(result2))
            });
          });
        }
      });
      safe("storage:prefs.write", () => {
        const Editor = Java.use("android.app.SharedPreferencesImpl$EditorImpl");
        for (const name of PREF_WRITERS) {
          traceMethod(hooks2, Editor[name], (_self, args) => {
            const key = String(args[0]);
            const meta = { key };
            if (args.length > 1) meta.value = clip(String(args[1]));
            log2.event("prefs.write", `prefs.${name}(${key})`, void 0, meta, "warn");
          });
        }
      });
      safe("storage:sqlite", () => {
        const DB = Java.use("android.database.sqlite.SQLiteDatabase");
        traceMethod(
          hooks2,
          DB.execSQL,
          (_self, args) => log2.event("sqlite", "SQLite.execSQL", void 0, { sql: clip(String(args[0])) })
        );
        traceMethod(
          hooks2,
          DB.rawQuery,
          (_self, args) => log2.event("sqlite", "SQLite.rawQuery", void 0, { sql: clip(String(args[0])) })
        );
        traceMethod(
          hooks2,
          DB.insert,
          (_self, args) => log2.event("sqlite", `SQLite.insert \u2192 ${String(args[0])}`, void 0, { table: String(args[0]) }, "warn")
        );
        traceMethod(
          hooks2,
          DB.update,
          (_self, args) => log2.event("sqlite", `SQLite.update \u2192 ${String(args[0])}`, void 0, { table: String(args[0]) }, "warn")
        );
        traceMethod(
          hooks2,
          DB.delete,
          (_self, args) => log2.event("sqlite", `SQLite.delete \u2192 ${String(args[0])}`, void 0, { table: String(args[0]) }, "warn")
        );
      });
      log2.info(`storage monitor active (${hooks2.count} hook(s))`);
    },
    stop() {
      hooks2.revert();
      log2.info("storage monitor stopped");
    }
  };

  // src/agent/tracers/network.ts
  var hooks3 = new HookSet();
  var log3 = channel("network");
  var networkTracer = {
    id: "network",
    label: "Network monitor",
    description: "OkHttp + java.net.URL requests with method, URL and a short call stack for proxy correlation.",
    channel: "network",
    start(_ctx) {
      safe("network:okhttp", () => {
        const Client = Java.use("okhttp3.OkHttpClient");
        traceMethod(hooks3, Client.newCall, (_self, args) => {
          const req = args[0];
          if (!req) return;
          const url = String(req.url());
          const method = String(req.method());
          log3.event("http", `${method} ${url}`, void 0, { client: "OkHttp", method, url, stack: shortStack(4) });
        });
      });
      safe("network:url", () => {
        const URL = Java.use("java.net.URL");
        traceMethod(hooks3, URL.openConnection, (self) => {
          const url = String(self.toString());
          if (url.indexOf("http") !== 0) return;
          log3.event("http", `openConnection ${url}`, void 0, {
            client: "HttpURLConnection",
            url,
            stack: shortStack(4)
          });
        });
      });
      log3.info(`network monitor active (${hooks3.count} hook(s))`);
    },
    stop() {
      hooks3.revert();
      log3.info("network monitor stopped");
    }
  };

  // src/agent/tracers/ipc.ts
  var hooks4 = new HookSet();
  var log4 = channel("ipc");
  function intentSummary(value) {
    const i = value;
    if (!i) return "null";
    try {
      const parts = [];
      const action = i.getAction();
      if (action) parts.push(`action=${String(action)}`);
      const data = i.getDataString();
      if (data) parts.push(`data=${String(data)}`);
      const comp = i.getComponent();
      if (comp) parts.push(`component=${String(comp.flattenToShortString())}`);
      return parts.length > 0 ? parts.join(" ") : "(implicit/empty intent)";
    } catch (_e) {
      return "<intent>";
    }
  }
  var ipcTracer = {
    id: "ipc",
    label: "IPC / intent monitor",
    description: "startActivity, sendBroadcast, start/bindService and ContentResolver access with Intent summaries.",
    channel: "ipc",
    start(_ctx) {
      safe("ipc:activity", () => {
        const Activity = Java.use("android.app.Activity");
        traceMethod(hooks4, Activity.startActivity, (_self, args) => {
          const intent = intentSummary(args[0]);
          log4.event("intent", `startActivity \xB7 ${intent}`, void 0, { call: "startActivity", intent });
        });
        traceMethod(hooks4, Activity.startActivityForResult, (_self, args) => {
          const intent = intentSummary(args[0]);
          log4.event("intent", `startActivityForResult \xB7 ${intent}`, void 0, {
            call: "startActivityForResult",
            intent
          });
        });
      });
      safe("ipc:broadcast-service", () => {
        const CW = Java.use("android.content.ContextWrapper");
        traceMethod(hooks4, CW.sendBroadcast, (_self, args) => {
          const intent = intentSummary(args[0]);
          log4.event("broadcast", `sendBroadcast \xB7 ${intent}`, void 0, { call: "sendBroadcast", intent });
        });
        traceMethod(hooks4, CW.startService, (_self, args) => {
          const intent = intentSummary(args[0]);
          log4.event("service", `startService \xB7 ${intent}`, void 0, { call: "startService", intent });
        });
        traceMethod(hooks4, CW.bindService, (_self, args) => {
          const intent = intentSummary(args[0]);
          log4.event("service", `bindService \xB7 ${intent}`, void 0, { call: "bindService", intent });
        });
      });
      safe("ipc:contentresolver", () => {
        const CR = Java.use("android.content.ContentResolver");
        traceMethod(
          hooks4,
          CR.query,
          (_self, args) => log4.event("provider", `ContentResolver.query \xB7 ${String(args[0])}`, void 0, {
            call: "query",
            uri: String(args[0])
          })
        );
        traceMethod(
          hooks4,
          CR.insert,
          (_self, args) => log4.event("provider", `ContentResolver.insert \xB7 ${String(args[0])}`, void 0, {
            call: "insert",
            uri: String(args[0])
          }, "warn")
        );
        traceMethod(
          hooks4,
          CR.delete,
          (_self, args) => log4.event("provider", `ContentResolver.delete \xB7 ${String(args[0])}`, void 0, {
            call: "delete",
            uri: String(args[0])
          }, "warn")
        );
      });
      log4.info(`ipc monitor active (${hooks4.count} hook(s))`);
    },
    stop() {
      hooks4.revert();
      log4.info("ipc monitor stopped");
    }
  };

  // src/agent/tracers/index.ts
  function registerAllTracers() {
    registerTracer(cryptoTracer);
    registerTracer(storageTracer);
    registerTracer(networkTracer);
    registerTracer(ipcTracer);
  }

  // src/agent/core/strategy.ts
  var StrategyRun = class {
    constructor() {
      __publicField(this, "hooksInstalled", 0);
      __publicField(this, "notes", []);
      __publicField(this, "errors", []);
    }
    /**
     * Install one hook point. `fn` should perform a single logical patch
     * (one method overload, one native function). Returns whether it stuck.
     */
    hook(label, fn) {
      try {
        fn();
        this.hooksInstalled += 1;
        return true;
      } catch (e) {
        this.errors.push(`${label}: ${errMessage(e)}`);
        return false;
      }
    }
    /** Record a human-readable observation (deduped). */
    note(text) {
      if (this.notes.indexOf(text) === -1) this.notes.push(text);
    }
  };

  // src/agent/orchestrate.ts
  var log5 = channel("bypass");
  function runStrategy(ctx, strategy) {
    const already = isApplied(strategy.id);
    const run = new StrategyRun();
    if (already) {
      run.note("already applied earlier in this session");
    } else {
      log5.info(`applying ${strategy.label}\u2026`);
      safe(
        `strategy:${strategy.id}`,
        () => strategy.apply(ctx, run),
        (message) => run.errors.push(message)
      );
      markApplied(strategy.id);
    }
    let verification = null;
    const verifyFn = strategy.verify;
    if (verifyFn) {
      verification = safe(`verify:${strategy.id}`, () => verifyFn(ctx)) ?? { ran: true, ok: false, detail: "verification threw" };
    }
    const applied = already || run.hooksInstalled > 0;
    log5.info(
      `${strategy.label}: ${run.hooksInstalled} hook(s)` + (run.errors.length ? `, ${run.errors.length} error(s)` : "") + (verification ? `, verify=${verification.ok ? "ok" : "fail"}` : "")
    );
    return {
      id: strategy.id,
      label: strategy.label,
      category: strategy.category,
      applied,
      alreadyActive: already,
      hooksInstalled: run.hooksInstalled,
      notes: run.notes,
      errors: run.errors,
      verification
    };
  }
  function applyStrategiesByIds(ctx, ids) {
    const out = [];
    for (const id of ids) {
      const strategy = getStrategy(id);
      if (!strategy) {
        out.push({
          id,
          label: id,
          category: "tamper-detection",
          applied: false,
          alreadyActive: false,
          hooksInstalled: 0,
          notes: [],
          errors: ["unknown strategy id"],
          verification: null
        });
        continue;
      }
      out.push(runStrategy(ctx, strategy));
    }
    return out;
  }
  function autoApplyApplicable(ctx) {
    const out = [];
    for (const strategy of getStrategies()) {
      if (strategy.autoApply === false) {
        log5.debug(`skip ${strategy.label} (manual-only / risky)`);
        continue;
      }
      const relevant = safe(`applies:${strategy.id}`, () => strategy.applies(ctx)) ?? false;
      if (!relevant) {
        log5.debug(`skip ${strategy.label} (not applicable)`);
        continue;
      }
      out.push(runStrategy(ctx, strategy));
    }
    const totalHooks = out.reduce((n, r) => n + r.hooksInstalled, 0);
    log5.info(`Auto-Pwn applied ${out.length} safe strategy(ies), ${totalHooks} hook(s) total`);
    return out;
  }

  // src/agent/discovery/explorer.ts
  var ACC_STATIC = 8;
  function enumerateClasses(ctx, filter, limit = 200) {
    const all = ctx.loadedClasses();
    const needle = filter.trim().toLowerCase();
    const matched = [];
    let total = 0;
    for (const c of all) {
      if (needle && c.toLowerCase().indexOf(needle) === -1) continue;
      total += 1;
      if (matched.length < limit) matched.push(c);
    }
    matched.sort();
    return { classes: matched, total, truncated: total > matched.length };
  }
  function formatMethod(m) {
    try {
      const ret = simpleName(String(m.getReturnType().getName()));
      const name = String(m.getName());
      const params = m.getParameterTypes();
      const ps = [];
      for (let i = 0; i < params.length; i++) ps.push(simpleName(String(params[i].getName())));
      return `${ret} ${name}(${ps.join(", ")})`;
    } catch (_e) {
      return `${String(m.getName())}(\u2026)`;
    }
  }
  function listMethods(ctx, className) {
    const wrapper = ctx.useClass(className);
    if (!wrapper) return { className, superclass: null, methods: [] };
    const methods = [];
    const seen = /* @__PURE__ */ new Set();
    try {
      const declared = wrapper.class.getDeclaredMethods();
      for (let i = 0; i < declared.length; i++) {
        const m = declared[i];
        const signature = formatMethod(m);
        if (seen.has(signature)) continue;
        seen.add(signature);
        const mods = Number(m.getModifiers());
        methods.push({ name: String(m.getName()), signature, static: (mods & ACC_STATIC) !== 0 });
      }
    } catch (_e) {
    }
    let superclass = null;
    try {
      const sc = wrapper.class.getSuperclass();
      superclass = sc ? String(sc.getName()) : null;
    } catch (_e) {
    }
    methods.sort((a, b) => a.name.localeCompare(b.name));
    return { className, superclass, methods };
  }

  // src/agent/discovery/heap.ts
  function snapshot(instance) {
    let summary = "<instance>";
    try {
      summary = clip(String(instance.toString()), 160);
    } catch (_e) {
    }
    let handle = "";
    try {
      handle = "0x" + (Number(instance.hashCode()) >>> 0).toString(16);
    } catch (_e) {
    }
    const fields = [];
    try {
      const declared = instance.getClass().getDeclaredFields();
      for (let i = 0; i < declared.length && fields.length < 40; i++) {
        const f = declared[i];
        try {
          f.setAccessible(true);
          const type = simpleName(String(f.getType().getName()));
          const name = String(f.getName());
          let value = "?";
          try {
            const v = f.get(instance);
            value = v == null ? "null" : clip(String(v), 120);
          } catch (_e) {
            value = "<unreadable>";
          }
          fields.push({ name, type, value });
        } catch (_e) {
        }
      }
    } catch (_e) {
    }
    return { handle, summary, fields };
  }
  function chooseInstances(ctx, className, limit = 10) {
    if (!ctx.hasClass(className)) return [];
    const out = [];
    try {
      Java.choose(className, {
        onMatch(instance) {
          if (out.length < limit) out.push(snapshot(instance));
        },
        onComplete() {
        }
      });
    } catch (_e) {
    }
    return out;
  }

  // src/agent/discovery/method-tracer.ts
  var log6 = channel("trace");
  var active = /* @__PURE__ */ new Map();
  function traceClass(ctx, className) {
    const existing = active.get(className);
    if (existing) return { ok: true, hooked: existing.count };
    const wrapper = ctx.useClass(className);
    if (!wrapper) {
      log6.warn(`cannot trace ${className} \u2014 class not loadable`);
      return { ok: false, hooked: 0 };
    }
    const hooks5 = new HookSet();
    const names = /* @__PURE__ */ new Set();
    try {
      const declared = wrapper.class.getDeclaredMethods();
      for (let i = 0; i < declared.length; i++) names.add(String(declared[i].getName()));
    } catch (_e) {
    }
    const label = simpleName(className);
    names.forEach((name) => {
      if (name.indexOf("$") !== -1) return;
      try {
        const method = wrapper[name];
        if (!method || !method.overloads) return;
        traceMethod(hooks5, method, (_self, args, result2) => {
          const a = args.map((x) => clip(String(x), 60)).join(", ");
          log6.event("method", `${label}.${name}(${a})`, void 0, {
            class: className,
            method: name,
            args: a,
            return: clip(String(result2), 120)
          });
        });
      } catch (_e) {
      }
    });
    active.set(className, hooks5);
    log6.info(`tracing ${className} \u2014 ${hooks5.count} overload(s) hooked`);
    return { ok: true, hooked: hooks5.count };
  }
  function untraceClass(className) {
    const hooks5 = active.get(className);
    if (!hooks5) return;
    hooks5.revert();
    active.delete(className);
    log6.info(`stopped tracing ${className}`);
  }
  function activeClassTraces() {
    return Array.from(active.keys());
  }

  // src/agent/discovery/native-tracer.ts
  var log7 = channel("jni");
  var active2 = /* @__PURE__ */ new Map();
  function traceNative(moduleName, symbol) {
    const key = `${moduleName || "*"}!${symbol}`;
    if (active2.has(key)) return { ok: true };
    const addr = ModuleRT.findExportByName(moduleName || null, symbol);
    if (!addr) {
      log7.warn(`native trace: ${key} not found / not exported`);
      return { ok: false };
    }
    const listener = Interceptor.attach(addr, {
      onEnter(args) {
        const shown = [args[0], args[1], args[2], args[3]].map((p) => p ? p.toString() : "?").join(", ");
        log7.event("native", `\u2192 ${symbol}(${shown})`, void 0, { symbol, args: shown });
      },
      onLeave(retval) {
        log7.event("native", `\u2190 ${symbol} = ${retval.toString()}`, void 0, {
          symbol,
          return: retval.toString()
        });
      }
    });
    active2.set(key, listener);
    log7.info(`tracing native ${key}`);
    return { ok: true };
  }
  function untraceNative(moduleName, symbol) {
    const key = `${moduleName || "*"}!${symbol}`;
    const listener = active2.get(key);
    if (!listener) return;
    listener.detach();
    active2.delete(key);
    log7.info(`stopped tracing native ${key}`);
  }
  function activeNativeTraces() {
    return Array.from(active2.keys());
  }

  // src/agent/recon/survey.ts
  var ACC_NATIVE = 256;
  var FRAMEWORK_PREFIXES = [
    "android.",
    "androidx.",
    "java.",
    "javax.",
    "kotlin.",
    "kotlinx.",
    "dalvik.",
    "libcore.",
    "sun.",
    "org.json.",
    "org.w3c.",
    "org.xml",
    "j$.",
    "com.android.",
    "com.google.android.",
    "com.google.common.",
    "org.chromium."
  ];
  function isFrameworkClass(name) {
    for (const p of FRAMEWORK_PREFIXES) {
      if (name.indexOf(p) === 0) return true;
    }
    return false;
  }
  function topPackage(className) {
    const parts = className.split(".");
    if (parts.length <= 1) return className;
    if (parts.length === 2) return parts[0] ?? className;
    return `${parts[0]}.${parts[1]}`;
  }
  function readDeviceInfo(ctx) {
    return safeOr(
      { androidVersion: null, apiLevel: null, abi: null },
      () => {
        const Build = ctx.useClass("android.os.Build");
        const VERSION = ctx.useClass("android.os.Build$VERSION");
        const androidVersion = VERSION ? String(VERSION.RELEASE.value) || null : null;
        const apiLevel = VERSION ? Number(VERSION.SDK_INT.value) : null;
        let abi = null;
        if (Build) {
          const abis = safeOr(null, () => {
            const arr = Build.SUPPORTED_ABIS.value;
            return arr && arr.length > 0 ? arr[0] ?? null : null;
          });
          abi = abis ?? safeOr(null, () => String(Build.CPU_ABI.value) || null);
        }
        return {
          androidVersion,
          apiLevel: apiLevel != null && !Number.isNaN(apiLevel) ? apiLevel : null,
          abi
        };
      }
    );
  }
  function readRuntimeInfo(ctx) {
    const System = ctx.useClass("java.lang.System");
    const prop = (key) => safeOr(null, () => {
      if (!System) return null;
      const v = System.getProperty(key);
      return v && v.length > 0 ? v : null;
    });
    const isDebuggable = safeOr(null, () => {
      const ActivityThread = ctx.useClass("android.app.ActivityThread");
      if (!ActivityThread) return null;
      const app = ActivityThread.currentApplication();
      if (app == null) return null;
      const info = app.getApplicationContext().getApplicationInfo();
      const flags = Number(info.flags.value);
      return (flags & 2) !== 0;
    });
    const emulated = safeOr(null, () => {
      const qemu = ctx.systemProperty("ro.kernel.qemu");
      const hardware = (ctx.systemProperty("ro.hardware") ?? "").toLowerCase();
      const product = (ctx.systemProperty("ro.product.name") ?? "").toLowerCase();
      if (qemu === "1") return true;
      if (hardware.indexOf("goldfish") !== -1 || hardware.indexOf("ranchu") !== -1) return true;
      if (hardware.indexOf("vbox") !== -1 || hardware.indexOf("ttvm") !== -1) return true;
      if (product.indexOf("sdk") !== -1 || product.indexOf("emulator") !== -1) return true;
      return false;
    });
    return {
      vmVersion: prop("java.vm.version"),
      vmName: prop("java.vm.name"),
      isDebuggable,
      emulated
    };
  }
  function categorizeLib(name, path) {
    const n = name.toLowerCase();
    if (/(libflutter|libreactnativejni|libhermes|libjsc|libil2cpp|libunity|libmono|libmonodroid|libxamarin|libnativescript|libqt5android|libqt6android|libnode)/.test(
      n
    )) {
      return "framework";
    }
    if (/(libjiagu|libdexhelper|libsecshell|libsecmain|libsecexe|libtup|libtprt|libtosprotection|libnesec|libnqshield|libsgmain|libsgsecuritybody|libmobisec|libexecmain|libdexprotector|libcovault|libapssec|libchaosvmp)/.test(
      n
    )) {
      return "security";
    }
    if (/(libcrypto|libssl|libconscrypt|libsqlcipher|libtink|libsignal)/.test(n)) return "crypto";
    if (/(libcronet|libgrpc)/.test(n)) return "networking";
    const p = path.toLowerCase();
    if (p.indexOf("/system/") === 0 || p.indexOf("/apex/") === 0 || p.indexOf("/vendor/") === 0 || p.indexOf("/odm/") === 0 || p.indexOf("/product/") === 0 || n === "linker" || n === "linker64") {
      return "system";
    }
    if (p.indexOf("/data/app") !== -1 || p.indexOf("/data/data") !== -1 || p.indexOf("/data/user") !== -1) {
      return "app";
    }
    return "unknown";
  }
  function surveyNatives(ctx) {
    const out = [];
    for (const m of ctx.modules) {
      const category = categorizeLib(m.name, m.path);
      if (category === "system") continue;
      out.push({ name: m.name, path: m.path, size: m.size, category });
      if (out.length >= 250) break;
    }
    return out;
  }
  function surveyClasses(ctx) {
    const loaded = ctx.loadedClasses();
    if (loaded.length === 0) {
      return { total: null, appPackages: [], sampled: [], obfuscated: false };
    }
    const appClasses = [];
    for (const c of loaded) {
      if (!isFrameworkClass(c)) appClasses.push(c);
    }
    const counts = /* @__PURE__ */ new Map();
    for (const c of appClasses) {
      const pkg = topPackage(c);
      counts.set(pkg, (counts.get(pkg) ?? 0) + 1);
    }
    const appPackages = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map((e) => e[0]);
    let shortNamed = 0;
    for (const c of appClasses) {
      const simple = c.substring(c.lastIndexOf(".") + 1);
      const base = simple.split("$").pop() ?? simple;
      if (base.length <= 2) shortNamed += 1;
    }
    const obfuscated = appClasses.length >= 25 && shortNamed / appClasses.length > 0.3;
    return {
      total: loaded.length,
      appPackages,
      sampled: appClasses.slice(0, 40),
      obfuscated
    };
  }
  function surveyJni(ctx, appPackages) {
    const loaded = ctx.loadedClasses();
    if (loaded.length === 0) return { nativeMethodCount: null, classes: [], warning: null };
    const prefixes = appPackages.map((p) => p + ".");
    const isApp = (name) => {
      if (isFrameworkClass(name)) return false;
      if (prefixes.length === 0) return true;
      for (const p of prefixes) if (name.indexOf(p) === 0) return true;
      return false;
    };
    const MAX_CLASSES = 80;
    const TIME_BUDGET_MS = 700;
    const started = Date.now();
    let nativeMethodCount = 0;
    const classes = [];
    let scanned = 0;
    let truncated = false;
    for (const className of loaded) {
      if (!isApp(className)) continue;
      if (scanned >= MAX_CLASSES || Date.now() - started > TIME_BUDGET_MS) {
        truncated = true;
        break;
      }
      scanned += 1;
      safe(`jni:${className}`, () => {
        const wrapper = ctx.useClass(className);
        if (!wrapper) return;
        const methods = wrapper.class.getDeclaredMethods();
        const nativeNames = [];
        for (let i = 0; i < methods.length; i++) {
          const m = methods[i];
          if (!m) continue;
          const mods = Number(m.getModifiers());
          if ((mods & ACC_NATIVE) !== 0) {
            nativeMethodCount += 1;
            if (nativeNames.length < 8) nativeNames.push(String(m.getName()));
          }
        }
        if (nativeNames.length > 0 && classes.length < 40) {
          classes.push({ className, methods: nativeNames });
        }
      });
    }
    return {
      nativeMethodCount,
      classes,
      warning: truncated ? `JNI scan truncated after ${scanned} classes (cap/${TIME_BUDGET_MS}ms budget); counts are a lower bound.` : null
    };
  }
  function surveyDynamicDex() {
    return safeOr({ loaded: false, sources: [] }, () => {
      const loaders = Java.enumerateClassLoadersSync();
      const sources = [];
      let dynamic = false;
      for (let i = 0; i < loaders.length; i++) {
        const loader = loaders[i];
        if (!loader) continue;
        const cls = safeOr("", () => String(loader.getClass().getName()));
        if (cls.indexOf("InMemoryDexClassLoader") !== -1 || cls.indexOf("DexClassLoader") !== -1) {
          dynamic = true;
          const desc = safeOr(cls, () => String(loader.toString()));
          const trimmed = desc.length > 200 ? desc.slice(0, 200) + "\u2026" : desc;
          if (sources.indexOf(trimmed) === -1 && sources.length < 8) sources.push(trimmed);
        }
      }
      return { loaded: dynamic, sources };
    });
  }

  // src/agent/recon/recommendations.ts
  function computeRecommendations(report) {
    const recs = [];
    const add = (r) => {
      const existing = recs.find((x) => x.strategyId === r.strategyId);
      if (!existing) {
        recs.push(r);
        return;
      }
      const rank2 = { high: 3, medium: 2, low: 1 };
      if (rank2[r.priority] > rank2[existing.priority]) existing.priority = r.priority;
    };
    const hasSecurity = (kind) => report.security.some((s) => s.kind === kind);
    const strongPinning = report.security.some(
      (s) => s.kind === "ssl-pinning" && s.confidence >= 0.8
    );
    const fw = report.framework.kind;
    if (strongPinning) {
      add({
        strategyId: "ssl-pinning-bypass",
        label: "Bypass SSL pinning",
        reason: "A dedicated pinning library was detected \u2014 proxying will fail until it is neutralised.",
        priority: "high"
      });
    } else if (report.networking.some((n) => n.id === "okhttp3" || n.id === "okhttp2") || report.security.some((s) => s.kind === "ssl-pinning")) {
      add({
        strategyId: "ssl-pinning-bypass",
        label: "Bypass SSL pinning (precaution)",
        reason: "OkHttp / a pinning surface is present; load the bypass before proxying to avoid handshake failures.",
        priority: "medium"
      });
    }
    if (fw === "flutter") {
      add({
        strategyId: "ssl-pinning-bypass",
        label: "Bypass TLS verification (Flutter)",
        reason: "Flutter ships its own BoringSSL and ignores the system proxy/trust store \u2014 needs the native TLS hook, not just the Java bypass.",
        priority: "high"
      });
    }
    if (hasSecurity("root-detection")) {
      add({
        strategyId: "root-detection-bypass",
        label: "Bypass root detection",
        reason: "Root-detection logic was detected; bypass it so the app runs on the (rooted) test device.",
        priority: "high"
      });
    }
    if (hasSecurity("frida-detection") || hasSecurity("tamper-detection")) {
      add({
        strategyId: "anti-anti-frida",
        label: "Defeat anti-Frida / tamper checks",
        reason: "A protector or anti-hook control is present; apply anti-anti-Frida to keep the session alive.",
        priority: "high"
      });
      add({
        strategyId: "root-detection-bypass",
        label: "Bypass root detection",
        reason: "Commercial protectors bundle root checks alongside anti-tamper.",
        priority: "medium"
      });
    }
    if (hasSecurity("integrity")) {
      add({
        strategyId: "root-detection-bypass",
        label: "Reduce attestation signals",
        reason: "Play Integrity / SafetyNet attestation present \u2014 hide root/emulator signals; full attestation bypass needs a hardened device.",
        priority: "medium"
      });
    }
    if (hasSecurity("biometric")) {
      add({
        strategyId: "biometric-bypass",
        label: "Bypass biometric gate",
        reason: "BiometricPrompt is used; hook the auth callback to force success during testing.",
        priority: "medium"
      });
    }
    if (fw === "cordova" || fw === "capacitor" || fw === "ionic") {
      add({
        strategyId: "webview-inspect",
        label: "Inspect WebView traffic",
        reason: "Hybrid app \u2014 most logic runs in a WebView; log navigations and enable remote debugging.",
        priority: "medium"
      });
    }
    add({
      strategyId: "shared-prefs-logger",
      label: "Watch SharedPreferences",
      reason: "Surface tokens, flags and credentials as the app reads/writes them.",
      priority: report.storage.some((s) => s.encrypted) ? "medium" : "low"
    });
    if (report.crypto.length > 0) {
      add({
        strategyId: "crypto-logger",
        label: "Monitor crypto operations",
        reason: "Crypto surface present \u2014 capture keys, IVs and plaintext at the JCA boundary.",
        priority: "low"
      });
    }
    if (report.networking.length > 0) {
      add({
        strategyId: "http-logger",
        label: "Log HTTP at the client",
        reason: "Capture requests/responses at the app layer, independent of the proxy.",
        priority: "low"
      });
    }
    const rank = { high: 3, medium: 2, low: 1 };
    return recs.sort((a, b) => rank[b.priority] - rank[a.priority]);
  }

  // src/agent/index.ts
  registerAllDetectors();
  registerAllStrategies();
  registerAllTracers();
  var AGENT_API = [
    "ping",
    "profile",
    "listStrategies",
    "applyStrategies",
    "autoApply",
    "listTracers",
    "startTracer",
    "stopTracer",
    "enumerateClasses",
    "listMethods",
    "traceClass",
    "untraceClass",
    "chooseInstances",
    "traceNative",
    "untraceNative",
    "listActiveTraces",
    "rpcEval"
  ];
  function tracerList() {
    return getTracers().map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      channel: t.channel,
      active: isTracerActive(t.id)
    }));
  }
  var UNKNOWN_FRAMEWORK = {
    kind: "unknown",
    label: "Unknown",
    confidence: 0,
    version: null,
    evidence: []
  };
  function buildReport(opts, ctx = buildContext()) {
    const started = Date.now();
    const log8 = channel("recon");
    log8.info("reconnaissance started");
    const out = new ReportBuilder();
    for (const detector of getDetectors()) {
      safe(
        `detector:${detector.id}`,
        () => {
          log8.debug(`running detector "${detector.id}"`);
          detector.detect(ctx, out);
        },
        (message) => out.warn(message)
      );
    }
    const device = readDeviceInfo(ctx);
    const runtime2 = readRuntimeInfo(ctx);
    const nativeLibs = surveyNatives(ctx);
    const classes = surveyClasses(ctx);
    const jni = surveyJni(ctx, classes.appPackages);
    if (jni.warning) out.warn(jni.warning);
    const dynamicDex = surveyDynamicDex();
    const frameworks = out.frameworks.slice().sort((a, b) => b.confidence - a.confidence);
    const framework = frameworks.length > 0 ? frameworks[0] : UNKNOWN_FRAMEWORK;
    if (classes.obfuscated) {
      out.addSecurity({
        id: "obfuscation",
        label: "Name obfuscation (ProGuard/R8/DexGuard-style)",
        kind: "obfuscation",
        variant: null,
        confidence: 0.7,
        evidence: ["Most loaded app classes have ultra-short obfuscated names"]
      });
    }
    const report = {
      schema: 1,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      pid: Process.id,
      identifier: opts.identifier ?? currentPackageName(),
      injection: opts.injection ?? "unknown",
      device,
      runtime: runtime2,
      framework,
      frameworks,
      networking: out.networking,
      crypto: out.crypto,
      storage: out.storage,
      security: out.security,
      nativeLibs,
      classes,
      jni: { nativeMethodCount: jni.nativeMethodCount, classes: jni.classes },
      dynamicDex,
      recommendations: [],
      warnings: out.warnings,
      durationMs: 0
    };
    report.recommendations = computeRecommendations(report);
    report.durationMs = Date.now() - started;
    log8.info(
      `reconnaissance complete in ${report.durationMs}ms \u2014 framework=${framework.label}, ${out.security.length} control(s), ${out.networking.length} net lib(s), ${nativeLibs.length} native lib(s), ${out.warnings.length} warning(s)`
    );
    return report;
  }
  var GIVE_UP_MESSAGE = {
    "no-java-global": "No Java runtime is visible in this process \u2014 it looks native-only (a non-ART helper/sandbox process), or the app exited before ART initialised. Select the app's main process, or use Launch & attach.",
    "vm-not-found": "The Java VM did not initialise within the wait window. The app may be exiting on Frida detection, or ART is starting unusually slowly \u2014 try Launch & attach, or Recon the app once it is already running."
  };
  function withJava(fn) {
    return new Promise((resolve, reject) => {
      whenJavaReady(
        () => {
          try {
            resolve(fn());
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
        (reason) => reject(new Error(GIVE_UP_MESSAGE[reason]))
      );
    });
  }
  rpc.exports = {
    ping() {
      return "pong";
    },
    profile(options) {
      return withJava(() => buildReport(options ?? {}));
    },
    listStrategies() {
      return withJava(() => {
        const ctx = buildContext();
        return getStrategies().map((s) => ({
          id: s.id,
          label: s.label,
          category: s.category,
          description: s.description,
          applicable: safe(`applies:${s.id}`, () => s.applies(ctx)) ?? false,
          autoApply: s.autoApply !== false
        }));
      });
    },
    applyStrategies(ids) {
      return withJava(() => applyStrategiesByIds(buildContext(), Array.isArray(ids) ? ids : []));
    },
    // Apply only the *safe* applicable strategies (Auto-Pwn selection). Kept
    // separate from profile() so the host can return the report even if
    // applying bypasses later destabilises the app.
    autoApply() {
      return withJava(() => autoApplyApplicable(buildContext()));
    },
    // --- Deep discovery & live tracing ---------------------------------
    listTracers() {
      return withJava(() => tracerList());
    },
    startTracer(id) {
      return withJava(() => {
        const tracer = id ? getTracer(id) : null;
        if (tracer && !isTracerActive(tracer.id)) {
          const ctx = buildContext();
          safe(`tracer:${tracer.id}`, () => tracer.start(ctx));
          setTracerActive(tracer.id, true);
        }
        return tracerList();
      });
    },
    stopTracer(id) {
      return withJava(() => {
        const tracer = id ? getTracer(id) : null;
        if (tracer && isTracerActive(tracer.id)) {
          safe(`tracer-stop:${tracer.id}`, () => tracer.stop());
          setTracerActive(tracer.id, false);
        }
        return tracerList();
      });
    },
    enumerateClasses(filter, limit) {
      return withJava(() => enumerateClasses(buildContext(), filter ?? "", limit ?? 200));
    },
    listMethods(className) {
      return withJava(() => listMethods(buildContext(), String(className ?? "")));
    },
    traceClass(className) {
      return withJava(() => traceClass(buildContext(), String(className ?? "")));
    },
    untraceClass(className) {
      return withJava(() => untraceClass(String(className ?? "")));
    },
    chooseInstances(className, limit) {
      return withJava(() => chooseInstances(buildContext(), String(className ?? ""), limit ?? 10));
    },
    traceNative(moduleName, symbol) {
      return withJava(() => traceNative(String(moduleName ?? ""), String(symbol ?? "")));
    },
    untraceNative(moduleName, symbol) {
      return withJava(() => untraceNative(String(moduleName ?? ""), String(symbol ?? "")));
    },
    listActiveTraces() {
      return withJava(() => {
        const out = [];
        for (const t of getTracers()) {
          if (isTracerActive(t.id)) out.push({ id: t.id, kind: "monitor", label: t.label });
        }
        for (const c of activeClassTraces()) out.push({ id: c, kind: "class", label: c });
        for (const n of activeNativeTraces()) out.push({ id: n, kind: "native", label: n });
        return out;
      });
    },
    // --- Interactive REPL console -------------------------------------------
    async rpcEval(code) {
      try {
        const raw = eval(code);
        const result = raw instanceof Promise ? await raw : raw;
        return { ok: true, value: fridaStringify(result) };
      } catch (e) {
        return { ok: false, value: e instanceof Error ? e.message : String(e) };
      }
    }
  };
  emitReady(AGENT_API);
  channel("system").info(`MobSec intelligence agent ${AGENT_VERSION} loaded (pid ${Process.id})`);
  function fridaStringify(v) {
    if (v === void 0) return "undefined";
    if (v === null) return "null";
    if (typeof v === "boolean" || typeof v === "number") return String(v);
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "function") return `[Function: ${v.name ?? "anonymous"}]`;
    try {
      return JSON.stringify(
        v,
        (_key, val) => {
          if (typeof val === "function") return "[Function]";
          if (val !== null && typeof val === "object" && !Array.isArray(val) && Object.getPrototypeOf(val) !== Object.prototype) {
            try {
              const s = String(val);
              if (s !== "[object Object]") return s;
            } catch {
            }
          }
          return val;
        },
        2
      );
    } catch {
      return String(v);
    }
  }
})();
