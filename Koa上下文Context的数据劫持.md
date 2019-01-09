这几天我一直在思索，关于`Koa`我可以分享什么？  
分享`Koa`中间件实现原理?   
上一篇的《[从源码上理解express中间件](https://juejin.im/post/5c10b5176fb9a049af6d1e1e)》已经解释的比较完善了，`Koa`中间件实现也比较相似，只不过，是把中间件函数抽离出来为[`koa-compose`](https://github.com/koajs/compose/blob/master/index.js)，循环遍历的时候将函数外边套了`tryCatch`，里面加了`Promise.resolve(fn)`而已。 

因此，这篇文章主要分享下Koa的数据劫持。

如：
以下访问器和 Request 别名等效。
```javascript

ctx.header
ctx.headers
ctx.method
ctx.method=
ctx.url
ctx.url=
ctx.originalUrl
ctx.origin
ctx.href
ctx.path
ctx.path=
ctx.query
ctx.query=
ctx.querystring
ctx.querystring=
ctx.host
ctx.hostname
ctx.fresh
ctx.stale
ctx.socket
ctx.protocol
ctx.secure
ctx.ip
ctx.ips
ctx.subdomains
ctx.is()
ctx.accepts()
ctx.acceptsEncodings()
ctx.acceptsCharsets()
ctx.acceptsLanguages()
ctx.get()

```


## 上下文Context的创建

### `Koa`的源码主要分为四个部分:
* `application`。
* `context`。
* `request`。
* `response`。
 
`application`是继承自`Node`核心模块`events`，通过实例化`Application`，得到`Koa`。`application`在`constructor`的时候会通过`Object.create()`创建一个新对象，*带着指定的原型对象和属性*。  
点击这里查看[MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/create#Parameters)。  
```javascript
  constructor() {
    super();

    this.proxy = false;
    //中间件数组
    this.middleware = [];
    this.subdomainOffset = 2;
    //设置环境变量，默认development
    this.env = process.env.NODE_ENV || 'development';
    //使用现有的对象来提供新创建的对象的__proto__,即this.context.__proto__ === context //true
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
    if (util.inspect.custom) {
      this[util.inspect.custom] = this.inspect;
    }
  }
```

当用户执行`app.listen`时，调用callback函数，中间件函数的执行和调用`createContext()`。

```javascript
//启动Koa服务器
listen(...args) {
  debug('listen');
  const server = http.createServer(this.callback());
  return server.listen(...args);
}

//callback
callback() {
//处理Koa的中间件。
const fn = compose(this.middleware);

if (!this.listenerCount('error')) this.on('error', this.onerror);

const handleRequest = (req, res) => {
  const ctx = this.createContext(req, res);
  return this.handleRequest(ctx, fn);
};

return handleRequest;
}
//创建context
createContext(req, res) {
  const context = Object.create(this.context);
  const request = context.request = Object.create(this.request);
  const response = context.response = Object.create(this.response);
  //设置context的app、req、res、res、ctx
  context.app = request.app = response.app = this;
  context.req = request.req = response.req = req;
  context.res = request.res = response.res = res;
  request.ctx = response.ctx = context;
  request.response = response;
  response.request = request;
  context.originalUrl = request.originalUrl = req.url;
  context.state = {};
  return context;
}
```

## 上下文Context

`Context`属性代理一些参数主要是通过[`delegates`](https://github.com/tj/node-delegates)模块实现的，这里主要是以讲述`delegates`为主。

```javascript
//创建context的原型
const proto = module.exports = {
  ...
}

/**
 * Response delegation.
 */

delegate(proto, 'response')
  .method('attachment')
  .method('redirect')
  .method('remove')
  .method('vary')
  .method('set')
  .method('append')
  .method('flushHeaders')
  .access('status')
  .access('message')
  .access('body')
  .access('length')
  .access('type')
  .access('lastModified')
  .access('etag')
  .getter('headerSent')
  .getter('writable');

```

`Koa`的`context`主要应用了`delegates`的三个方法，分别是`method`、`access`、`getter`方法。  

初始化`Context`的时候，会在`createContext`中将`response`和`request`赋值给`ctx`，因此`context`含有`request`和`response`的`key`。  

```javascript
  //设置context的app、req、res、res、ctx
  context.app = request.app = response.app = this;
  context.req = request.req = response.req = req;
  context.res = request.res = response.res = res;
  request.ctx = response.ctx = context;
  request.response = response;
  response.request = request;

```

在创建`context`原型`proto`时候会调用`delegator`，将`response`和`request`的`key`传递进去，再依次链式调用`method`，`access`，`getter`，将`request`和`response`中需要代理的属性依次传入。    

如：当用户通过调用`ctx.set()`时, 在此之前，在`delegator`中调用了`method`方法，已经将`set`传递进去，`proto[name]`可以理解为`ctx['set']`，赋值给`proto[name]`一个函数，由于是`ctx`调用`set`，所以当前函数`this`的指向是`ctx`。

```javascript
/**
 * 委托方法的名字
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */
Delegator.prototype.method = function(name){
  // proto原型
  var proto = this.proto;
  //target 为delegate的第二个参数，这里是response | request
  var target = this.target;
  this.methods.push(name);

  proto[name] = function(){
    return this[target][name].apply(this[target], arguments);
  };

  return this;
};

```

而这个函数实际上就是通过将`ctx.response.set`通过`apply`进行调用，然后`return`出去的值。  


```javascript
/**
 * Delegator accessor `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

Delegator.prototype.access = function(name){
  return this.getter(name).setter(name);
};

/**
 * Delegator getter `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

Delegator.prototype.getter = function(name){
  var proto = this.proto;
  var target = this.target;
  this.getters.push(name);

  proto.__defineGetter__(name, function(){
    return this[target][name];
  });

  return this;
};

/**
 * Delegator setter `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

Delegator.prototype.setter = function(name){
  var proto = this.proto;
  var target = this.target;
  this.setters.push(name);

  proto.__defineSetter__(name, function(val){
    return this[target][name] = val;
  });

  return this;
};

```

而`access`方法是`setter`、`getting`方法的连续调用，通过设置`Object.__defineGetter__`和`Object.__defineSetter__`来进行数据劫持的。

由于[MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/__defineSetter__)并不推荐使用这种方法,因此这里使用`Object.defineProperty()`重新写`getter`和`setter`方法。

```javascript
//getter
Delegator.prototype.getter = function(name){
  var proto = this.proto;
  var target = this.target;
  this.setters.push(name);
    
    Object.defineProperty(proto, name, {
      get: function() {
        return this[target][name];
      }
    });

  return this;
};

//setter
Delegator.prototype.setter = function(name){
  var proto = this.proto;
  var target = this.target;
  this.setters.push(name);
    
    Object.defineProperty(proto, name, {
      set: function(val) {
        return this[target][name] = val;
      }
    });

  return this;
};

```

## 最后  

Koa的数据劫持主要是靠`Object.__defineSetter__`和`Object.__defineSetter__`的应用，不过说起来，`Koa`整体的设计模式还是很值得学习的。  



