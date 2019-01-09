> 延续上篇文章[骚年，Koa和Webpack了解一下？](https://juejin.im/post/5c01f46c51882516d725ee51)  

**本篇文章主要讲述的是如何通过Node创建一个稳定的web服务器，如果你看到这里想起了pm2等工具，那么你可以先抛弃pm2，进来看看，如果有哪些不合适的地方，恳请您指出。**

## 创建一个稳定的web服务器需要解决什么问题。

> * 如何利用多核CPU资源。
> * 多个工作进程的存活状态管理。
> * 工作进程的平滑重启。
> * 进程错误处理。
> * 工作进程限量重启。

## 如何利用多核CPU资源

#### 利用多核CPU资源有多种解决办法。  

    
* 通过在单机上部署多个Node服务，然后监听不同端口，通过一台Nginx负载均衡。  

    > 这种做法一般用于多台机器，在服务器集群时，采用这种做法，这里我们不采用。


* 通过单机启动一个master进程，然后fork多个子进程，master进程发送句柄给子进程后，关闭监听端口，让子进程来处理请求。
    > 这种做法也是Node单机集群普遍的做法。  
  

    
所幸的是，Node在v0.8版本新增的cluster模块，让我们不必使用[child_process](http://nodejs.cn/api/child_process.html)一步一步的去处理Node集群这么多细节。

**所以本篇文章讲述的是基于cluster模块解决上述的问题。**


**首先创建一个Web服务器**，Node端采用的是**Koa**框架。没有使用过的可以先去看下 ===> [传送门](https://koa.bootcss.com/)

下面的代码是创建一个基本的web服务需要的配置，看过上篇文章的可以先直接过滤这块代码，直接看后面。

```javascript
const Koa = require('koa');
const app = new Koa();
const koaNunjucks = require('koa-nunjucks-2');
const koaStatic = require('koa-static');
const KoaRouter = require('koa-router');
const router = new KoaRouter();
const path = require('path');
const colors = require('colors');
const compress = require('koa-compress');
const AngelLogger = require('../angel-logger')
const cluster = require('cluster');
const http = require('http');

class AngelConfig {
  constructor(options) {
    this.config = require(options.configUrl);
    this.app = app;
    this.router = require(options.routerUrl);
    this.setDefaultConfig(); 
    this.setServerConfig();
    
  }

  setDefaultConfig() {
    //静态文件根目录
    this.config.root = this.config.root ? this.config.root : path.join(process.cwd(), 'app/static');
    //默认静态配置
    this.config.static = this.config.static ? this.config.static : {};
  }

  setServerConfig() {
    this.port = this.config.listen.port;

    //cookie签名验证
    this.app.keys = this.config.keys ? this.config.keys : this.app.keys;

  }
}

//启动服务器
class AngelServer extends AngelConfig {
  constructor(options) {
    super(options);
    this.startService();
  }

  startService() {
    //开启gzip压缩
    this.app.use(compress(this.config.compress));

      //模板语法
    this.app.use(koaNunjucks({
      ext: 'html',
      path: path.join(process.cwd(), 'app/views'),
      nunjucksConfig: {
        trimBlocks: true
      }
    }));
    this.app.use(async (ctx, next) => {
      ctx.logger = new AngelLogger().logger;
      await next();
    })
  
    //访问日志
    this.app.use(async (ctx, next) => {
      await next();
      // console.log(ctx.logger,'loggerloggerlogger');
      const rt = ctx.response.get('X-Response-Time');
      ctx.logger.info(`angel ${ctx.method}`.green,` ${ctx.url} - `,`${rt}`.green);
    });
    
    // 响应时间
    this.app.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      ctx.set('X-Response-Time', `${ms}ms`);
    });

    this.app.use(router.routes())
      .use(router.allowedMethods());

    // 静态资源
    this.app.use(koaStatic(this.config.root, this.config.static));
  
    // 启动服务器
    this.server = this.app.listen(this.port, () => {
      console.log(`当前服务器已经启动,请访问`,`http://127.0.0.1:${this.port}`.green);
      this.router({
        router,
        config: this.config,
        app: this.app
      });
    });
  }
}

module.exports = AngelServer;

```

**在启动服务器之后，将`this.app.listen`赋值给`this.server`，后面会用到。**

一般我们做**单机集群**时，我们`fork`的进程数量是机器的CPU数量。当然更多也不限定，只是一般不推荐。

```javascript
const cluster = require('cluster');
const { cpus } = require('os'); 
const AngelServer = require('../server/index.js');
const path = require('path');
let cpusNum = cpus().length;

//超时
let timeout = null;

//重启次数
let limit = 10;
// 时间
let during = 60000;
let restart = [];

//master进程
if(cluster.isMaster) {
  //fork多个工作进程
  for(let i = 0; i < cpusNum; i++) {
    creatServer();
  }

} else {
  //worker进程
  let angelServer = new AngelServer({
    routerUrl: path.join(process.cwd(), 'app/router.js'),//路由地址
    configUrl: path.join(process.cwd(), 'config/config.default.js')  
    //默认读取config/config.default.js
  });
}

// master.js
//创建服务进程  
function creatServer() {
  let worker = cluster.fork();
  console.log(`工作进程已经重启pid: ${worker.process.pid}`);
}

```
使用进程的方式，其实就是通过`cluster.isMaster`和`cluster.isWorker`来进行判断的。

主从进程代码写在一块可能也不太好理解。这种写法也是Node官方的写法，当然也有更加清晰的写法，借助[`cluster.setupMaster`](http://nodejs.cn/api/cluster.html#cluster_cluster_setupmaster_settings)实现，这里不去详细解释。

通过Node执行代码，看看究竟发生了什么。


![](https://user-gold-cdn.xitu.io/2018/12/9/1679253db1777ae4?w=1454&h=482&f=png&s=319810)

首先判断`cluster.isMaster`是否存在，然后循环调用`createServer()`,**fork**4个工作进程。打印工作进程**pid**。

`cluster`启动时，它会在内部启动**TCP**服务，在`cluster.fork()`子进程时，将这个**TCP**服务端`socket`的文件描述符发送给工作进程。如果工作进程中存在`listen()`监听网络端口的调用，它将拿到该文件的文件描述符，通过**SO_REUSEADDR**端口重用，从而实现多个子进程共享端口。


## 进程管理、平滑重启、和错误处理。

一般来说，master进程比较稳定，工作进程并不是太稳定。 

因为工作进程处理的是业务逻辑，因此，我们需要给工作进程添加**自动重启**的功能，也就是如果子进程因为业务中不可控的原因报错了，而且阻塞了，此时，我们应该停止该进程接收任何请求，然后**优雅**的关闭该工作进程。

```javascript
//超时
let timeout = null;

//重启次数
let limit = 10;
// 时间
let during = 60000;
let restart = [];

if(cluster.isMaster) {
  //fork多个工作进程
  for(let i = 0; i < cpusNum; i++) {
    creatServer();
  }

} else {
  //worker
  let angelServer = new AngelServer({
    routerUrl: path.join(process.cwd(), 'app/router.js'),//路由地址
    configUrl: path.join(process.cwd(), 'config/config.default.js') //默认读取config/config.default.js
  });

  //服务器优雅退出
  angelServer.app.on('error', err => {
    //发送一个自杀信号
    process.send({ act: 'suicide' });
    cluster.worker.disconnect();
    angelServer.server.close(() => {
      //所有已有连接断开后，退出进程
      process.exit(1);
    });
    //5秒后退出进程
    timeout = setTimeout(() => {
      process.exit(1);
    },5000);
  });
}

// master.js
//创建服务进程  
function creatServer() {

  let worker = cluster.fork();
  console.log(`工作进程已经重启pid: ${worker.process.pid}`);
  //监听message事件，监听自杀信号，如果有子进程发送自杀信号，则立即重启进程。
  //平滑重启 重启在前，自杀在后。
  worker.on('message', (msg) => {
    //msg为自杀信号，则重启进程
    if(msg.act == 'suicide') {
      creatServer();
    }
  });

  //清理定时器。
  worker.on('disconnect', () => {
    clearTimeout(timeout);
  });

}

```

我们在实例化`AngelServer`后，得到`angelServer`，通过拿到`angelServer.app`拿到`Koa`的实例，从而监听Koa的`error`事件。  

当监听到错误发生时，发送一个自杀信号`process.send({ act: 'suicide' })`。
调用`cluster.worker.disconnect()`方法，调用此方法会关闭所有的server，并等待这些server的 'close'事件执行，然后关闭IPC管道。  

调用`angelServer.server.close()`方法，当所有连接都关闭后，通往该工作进程的IPC管道将会关闭，允许工作进程优雅地死掉。

如果5s的时间还没有退出进程，此时，5s后将强制关闭该进程。

Koa的`app.listen`是`http.createServer(app.callback()).listen();`的语法糖，因此可以调用close方法。

**worker**监听`message`，如果是该信号，此时先重启新的进程。
同时监听`disconnect`事件，清理定时器。

正常来说，我们应该监听`process`的`uncaughtException`事件，*如果 Javascript 未捕获的异常，沿着代码调用路径反向传递回事件循环，会触发 'uncaughtException' 事件。*

但是`Koa`已经在[middleware](https://github.com/chenshenhai/koajs-design-note/blob/master/note/chapter01/06.md)外边加了`tryCatch`。因此在uncaughtException捕获不到。

在这里，还得特别感谢下[大深海](https://github.com/chenshenhai)老哥，深夜里，在群里给我指点迷津。

## 限量重启

通过自杀信号告知主进程可以使新连接总是有进程服务，但是依然还是有极端的情况。
工作进程不能无限制的被频繁重启。

因此在单位时间规定只能重启多少次，超过限制就触发giveup事件。

```javascript
//检查启动次数是否太过频繁，超过一定次数，重新启动。
function isRestartNum() {

  //记录重启的时间
  let time = Date.now();
  let length = restart.push(time);
  if(length > limit) {
    //取出最后10个
    restart = restart.slice(limit * -1);
  }
  //1分钟重启的次数是否太过频繁
  return restart.length >= limit && restart[restart.length - 1] - restart[0] < during;
}

```

同时将createServer修改成

```javascript
// master.js
//创建服务进程  
function creatServer() {
  //检查启动是否太过频繁
  if(isRestartNum()) {
    process.emit('giveup', length, during);
    return;
  }
  let worker = cluster.fork();
  console.log(`工作进程已经重启pid: ${worker.process.pid}`);
  //监听message事件，监听自杀信号，如果有子进程发送自杀信号，则立即重启进程。
  //平滑重启 重启在前，自杀在后。
  worker.on('message', (msg) => {
    //msg为自杀信号，则重启进程
    if(msg.act == 'suicide') {
      creatServer();
    }
  });
  //清理定时器。
  worker.on('disconnect', () => {
    clearTimeout(timeout);
  });

}

```

## 更改负载均衡策略

默认的是操作系统抢占式，就是在一堆工作进程中，闲着的进程对到来的请求进行争抢，谁抢到谁服务。  

对于是否繁忙是由CPU和I/O决定的，但是影响抢占的是CPU。  

对于不同的业务，会有的I/O繁忙，但CPU空闲的情况，这时会造成负载不均衡的情况。  
因此我们使用node的另一种策略，名为轮叫制度。

```javascript
cluster.schedulingPolicy = cluster.SCHED_RR;
```

## 最后

当然创建一个稳定的web服务还需要注意很多地方，比如优化处理进程之间的通信，数据共享等等。

本片文章只是给大家一个参考，如果有哪些地方写的不合适的地方，恳请您指出。

完整代码请见[github](https://github.com/baiyuze/version-control-system/blob/master/lib/angel-cluster/master.js)。

参考资料：**深入浅出nodejs**





