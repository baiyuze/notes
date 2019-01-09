**本篇文章从express源码上来理解中间件，同时可以对express有更深层的理解**

## 前言
中间件函数可以执行哪些任务？
> * 执行任何代码。
> * 对请求和响应对象进行更改。
> * 结束请求/响应循环。
> * 调用堆栈中的下一个中间件函数。

我们从一个`app.use`开始，逐步分析到下一个中间件函数的执行。

## 初始化服务器

首先从[github](https://github.com/expressjs/express)上下载`express`源码。

建立一个文件`test.js`文件，引入根目录的`index.js`文件，实例化`express`，启动服务器。

```javascript

let express = require('../index.js');
let app = express()

function middlewareA(req, res, next) {
  console.log('A1');
  next();
  console.log('A2');
}

function middlewareB(req, res, next) {
  console.log('B1');
  next();
  console.log('B2');
}

function middlewareC(req, res, next) {
  console.log('C1');
  next();
  console.log('C2');
}

app.use(middlewareA);
app.use(middlewareB);
app.use(middlewareC);

app.listen(8888, () => {
  console.log("服务器已经启动访问http://127.0.0.1:8888");
})

```

启动服务器，通过访问`http://127.0.0.1:8888`服务，打开终端，看看终端日志执行顺序。


![](https://user-gold-cdn.xitu.io/2018/12/14/167ad30126227a1d?w=1424&h=244&f=png&s=80240)

从日志我们可以看出，每次`next()`之后，都会按照顺序依次调用下中间件函数，然后按照执行顺序依次打印`A1,B1,C1`,此时中间件已经调用完成，再依次打印`C2,B2,A2`。

## 目录结构
```json
--lib
    |__ middleware
        |__ init.js
        |__ query.js
    |__ router
        |__ index.js
        |__ layer.js
        |__ route.js
    |__ application.js
    |__ express.js
    |__ request.js
    |__ response.js
    |__ utils.js
    |__ view.js

```

通过实例化的express，我们可以看到，`index.js`文件实际上是暴露出`lib/express`的文件。

## 实例化express

`express`，通过`mixin`继承appLication，同时初始化application。

```javascript

function createApplication() {
  var app = function(req, res, next) {
    app.handle(req, res, next);
  };

  mixin(app, EventEmitter.prototype, false);
  mixin(app, proto, false);

  // expose the prototype that will get set on requests
  app.request = Object.create(req, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  })

  // expose the prototype that will get set on responses
  app.response = Object.create(res, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  })

  app.init();
  return app;
}

```

而mixin是`merge-descriptors`npm模块。*Merge objects using descriptors.*。

打开`application.js`文件，发现`express`的实例化源自`var app = exports = module.exports = {}`。  
进一步搜索`app.use`，找到`app.use`,而`app.use`又只是向应用程序路由器添加中间件的`Proxy`。

```javascript

/**
 * Proxy `Router#use()` to add middleware to the app router.
 * See Router#use() documentation for details.
 *
 * If the _fn_ parameter is an express app, then it will be
 * mounted at the _route_ specified.
 *
 * @public
 */

app.use = function use(fn) {
  var offset = 0;
  var path = '/';

  // 默认path 为 '/'
  // app.use([fn])
  //判断app.use传进来的是否是函数
  if (typeof fn !== 'function') {
    var arg = fn;

    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0];
    }

    // 第一个参数是路径
    //取出第一个参数，将第一个参数赋值给path。
    if (typeof arg !== 'function') {
      offset = 1;
      path = fn;
    }
  }
  //slice.call(arguments,offset),通过slice转为数据，slice可以改变具有length的类数组。
  //arguments是一个类数组对象。
  
  //处理多种中间件使用方式。
  // app.use(r1, r2);
  // app.use('/', [r1, r2]);
  // app.use(mw1, [mw2, r1, r2], subApp);
  
  var fns = flatten(slice.call(arguments, offset));//[funtion]

  //抛出错误
  if (fns.length === 0) {
    throw new TypeError('app.use() requires a middleware function')
  }

  //设置router
  this.lazyrouter();
  var router = this._router;

  fns.forEach(function (fn) {
    // 处理不是express的APP应用的情况，直接调用route.use。
    if (!fn || !fn.handle || !fn.set) {
    //path default to '/'
      return router.use(path, fn);
    }
    
    debug('.use app under %s', path);
    fn.mountpath = path;
    fn.parent = this;
    router.use(path, function mounted_app(req, res, next) {
      var orig = req.app;
      fn.handle(req, res, function (err) {
        setPrototypeOf(req, orig.request)
        setPrototypeOf(res, orig.response)
        next(err);
      });
    });

    // app mounted 触发emit
    fn.emit('mount', this);
  }, this);

  return this;
};


```


定义默认参数`offer`和`path`。然后处理`fn`形参不同类型的情况。将不同类型的中间件使用方式的形参转为扁平化数组，赋值给`fns`。

`forEach`遍历fns,判断如果`fn`、`fn.handle`、`fn.set`参数不存在，return出去`router.use(path, fn)`。

否则继续执行`router.use`。

## 调用`handle`函数，执行中间件。

代码如下：

```javascript
/**
*将一个req, res对分派到应用程序中。中间件执行开始。
*如果没有提供回调，则默认错误处理程序将作出响应
*在堆栈中冒泡出现错误时。
*/
app.handle = function handle(req, res, callback) {
  var router = this._router;

  // 最后报错处理error。
  var done = callback || finalhandler(req, res, {
    env: this.get('env'),
    onerror: logerror.bind(this)
  });

  // no routes
  if (!router) {
    debug('no routes defined on app');
    done();
    return;
  }

  router.handle(req, res, done);
};

```

## 惰性添加Router。

从上述代码中可以知道，`app.use`的作用实际上是将各种应用函数传递给`router`的一个中间层代理。

而且，在app.use中有调用`this.lazyrouter()`函数，惰性的添加默认`router`。

```javascript
app.lazyrouter = function lazyrouter() {

  if (!this._router) {
    this._router = new Router({
      caseSensitive: this.enabled('case sensitive routing'),
      strict: this.enabled('strict routing')
    });

    this._router.use(query(this.get('query parser fn')));
    //初始化router
    this._router.use(middleware.init(this));
  }
};

```

这里对`Router`进行了实例化，同时设置基本的`option`，`caseSensitive` 是否区分大小写，`strict` 是否设置严格模式。

![](https://user-gold-cdn.xitu.io/2018/12/17/167bb4e1bf9f33ee?w=1824&h=852&f=png&s=357246) 


`Router`初始化如下：

```
/**
 * 用给定的“选项”初始化一个新的“路由器”。
 * 
 * @param {Object} [options] [{ caseSensitive: false, strict: false }]
 * @return {Router} which is an callable function
 * @public
 */

var proto = module.exports = function(options) {

  var opts = options || {};

  function router(req, res, next) {
    router.handle(req, res, next);
  }

  // 混合路由器类函数
  setPrototypeOf(router, proto)

  router.params = {};
  router._params = [];
  router.caseSensitive = opts.caseSensitive;
  router.mergeParams = opts.mergeParams;
  router.strict = opts.strict;
  router.stack = [];

  return router;
};

```

调用`app.use`时，参数都会传递给`router.use`，因此，打开`router/index.js`文件，查找`router.use`。

```javascript

/**
*使用给定的中间件函数，具有可选路径，默认为“/”。
* Use(如' .all ')将用于任何http方法，但不会添加
*这些方法的处理程序，所以选项请求不会考虑“。use”
*函数，即使它们可以响应。
*另一个区别是_route_ path被剥离，不可见
*到处理程序函数。这个特性的主要作用是安装
*无论“前缀”是什么，处理程序都可以在不更改任何代码的情况下操作
*路径名。
 *
 * @public
 */

proto.use = function use(fn) {
  var offset = 0;
  var path = '/';

  // 默认路径  '/'
  // 消除歧义 router.use([fn])
  // 判断是否是函数
  if (typeof fn !== 'function') {
    var arg = fn;
    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0];
    }
    // 第一个参数是函数
    if (typeof arg !== 'function') {
      offset = 1;
      path = fn;
    }
  }

  //将arguments转为数组，然后扁平化多维数组
  var callbacks = flatten(slice.call(arguments, offset));

  //如果callbacks内没有传递函数，抛错
  if (callbacks.length === 0) {
    throw new TypeError('Router.use() requires a middleware function')
  }

  //循环callbacks数组
  for (var i = 0; i < callbacks.length; i++) {
    var fn = callbacks[i];
    
    if (typeof fn !== 'function') {
      throw new TypeError('Router.use() requires a middleware function but got a ' + gettype(fn))
    }

    //解析下query和expressInit的含义
    // 添加中间件
    //匿名 anonymous 函数
    debug('use %o %s', path, fn.name || '<anonymous>')

    var layer = new Layer(path, {
      sensitive: this.caseSensitive, //敏感区分大小写 //默认为false
      strict: false, //严格
      end: false //结束
    }, fn);

    layer.route = undefined;
    this.stack.push(layer);
  }

  return this;
}

```

`router.use`的主要作用就是将从`app.use`中传递过来的函数，通过`Layer`实例化的处理，添加一些**处理错误**、**处理请求**的方法，以便后续调用处理。同时将传递过来的`path`，通过`path-to-regexp`模块把路径转为正则表达式(`this.regexp`),调用`this.regexp.exec(path)`，将参数提取出来。

`Layer`代码较多，这里不贴代码了，可以参考[express/lib/router/layer.js](https://github.com/expressjs/express/blob/master/lib/router/layer.js)。

## 处理中间件。

处理中间件就是将放入`this,stack`的`new Layout([options],fn)`,拿出来依次执行。

```javascript
proto.handle = function handle(req, res, out) {
  var self = this;

  debug('dispatching %s %s', req.method, req.url);

  var idx = 0;
  //获取协议与URL地址
  var protohost = getProtohost(req.url) || ''
  var removed = '';
  //是否添加斜杠
  var slashAdded = false;
  var paramcalled = {};

  //存储选项请求的选项
  //仅在选项请求时使用
  var options = [];

  // 中间件和路由
  var stack = self.stack;
  // 管理inter-router变量
  //req.params 请求参数
  var parentParams = req.params;
  var parentUrl = req.baseUrl || '';
  var done = restore(out, req, 'baseUrl', 'next', 'params');

  // 设置下一层
  req.next = next;

  // 对于选项请求，如果没有其他响应，则使用默认响应
  if (req.method === 'OPTIONS') {
    done = wrap(done, function(old, err) {
      if (err || options.length === 0) return old(err);
      sendOptionsResponse(res, options, old);
    });
  }

  // 设置基本的req值
  req.baseUrl = parentUrl;
  req.originalUrl = req.originalUrl || req.url;

  next();

  function next(err) {
    var layerError = err === 'route'
      ? null
      : err;

    //是否添加斜线 默认false
    if (slashAdded) {
      req.url = req.url.substr(1);
      slashAdded = false;
    }

    // 恢复改变req.url
    if (removed.length !== 0) {
      req.baseUrl = parentUrl;
      req.url = protohost + removed + req.url.substr(protohost.length);
      removed = '';
    }

    // 出口路由器信号
    if (layerError === 'router') {
      setImmediate(done, null)
      return
    }

    // 不再匹配图层
    if (idx >= stack.length) {
      setImmediate(done, layerError);
      return;
    }

    // 获取路径pathname
    var path = getPathname(req);

    if (path == null) {
      return done(layerError);
    }

    // 找到下一个匹配层
    var layer;
    var match;
    var route;

    while (match !== true && idx < stack.length) {
      layer = stack[idx++];
      //try layer.match(path) catch err
      //搜索 path matchLayer有两种状态一种是boolean，一种是string。
      match = matchLayer(layer, path);
      route = layer.route;

      if (typeof match !== 'boolean') {
        layerError = layerError || match;
      }

      if (match !== true) {
        continue;
      }

      if (!route) {
        //正常处理非路由处理程序
        continue;
      }

      if (layerError) {
        // routes do not match with a pending error
        match = false;
        continue;
      }

      var method = req.method;
      var has_method = route._handles_method(method);

      // build up automatic options response
      if (!has_method && method === 'OPTIONS') {
        appendMethods(options, route._options());
      }

      // don't even bother matching route
      if (!has_method && method !== 'HEAD') {
        match = false;
        continue;
      }
    }

    // no match
    if (match !== true) {
      return done(layerError);
    }

    //重新赋值router。
    if (route) {
      req.route = route;
    }

    // 合并参数
    req.params = self.mergeParams
      ? mergeParams(layer.params, parentParams)
      : layer.params;
      
    var layerPath = layer.path;

    // 处理参数
    self.process_params(layer, paramcalled, req, res, function (err) {
      if (err) {
        return next(layerError || err);
      }

      if (route) {
        return layer.handle_request(req, res, next);
      }

    // 处理req.url和layerPath，同时对layer中的请求error和handle_error加tryCatch处理。
      trim_prefix(layer, layerError, layerPath, path);
    });
  }

```

执行`proto.handle`中间件也就的`while`循环中的一些核心代码，每次调用`app.use`中的回调函数中的`next()`都会让`idx`加一，将`stack[idx++];`赋值给`layer`，调用一开始说到的`layer.handle_request`,然后调用`trim_prefix(layer, layerError, layerPath, path)`，添加一些报错处理。

`trim_prefix`函数如下: 

```javascript

 function trim_prefix(layer, layerError, layerPath, path) {
    if (layerPath.length !== 0) {
      // Validate path breaks on a path separator
      var c = path[layerPath.length]
      if (c && c !== '/' && c !== '.') return next(layerError)

      // //删除url中与路由匹配的部分
      // middleware (.use stuff) needs to have the path stripped
      debug('trim prefix (%s) from url %s', layerPath, req.url);
      removed = layerPath;
      req.url = protohost + req.url.substr(protohost.length + removed.length);

      // Ensure leading slash
      if (!protohost && req.url[0] !== '/') {
        req.url = '/' + req.url;
        slashAdded = true;
      }

      // 设置 base URL (no trailing slash)
      req.baseUrl = parentUrl + (removed[removed.length - 1] === '/'
        ? removed.substring(0, removed.length - 1)
        : removed);
    }

    debug('%s %s : %s', layer.name, layerPath, req.originalUrl);

    if (layerError) {
      layer.handle_error(layerError, req, res, next);
    } else {
      layer.handle_request(req, res, next);
    }
  }
};

```

## 总结

以上就是通过`app.use`调用之后，一步步执行中间件函数`router.handle`。 

`next`核心代码很简单，但是需要考虑的场景却是很多，通过这次源码阅读，更能进一步的理解express的核心功能。

虽说平常做项目用到`express`框架很少，或者可以说基本不用，一般都是用`Koa`或者`Egg`，可以说基本上些规模的场景的项目用的都是`Egg`。  

但是不可否认得是，`express`框架还是一款非常经典的框架。


**以上代码纯属个人理解，如有不合适的地方，望在评论区留言。**






