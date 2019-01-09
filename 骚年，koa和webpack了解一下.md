

![](https://user-gold-cdn.xitu.io/2018/12/1/16767d7c05e0fdcf?w=500&h=545&f=jpeg&s=56610)

有必要声明下，很多人在没看完这篇文章之后，就评论一些和文章主题不相符的内容。   

这篇文章主要讲述的是如何在本地开发环境下通过启动node服务器之后，无缝启动webpack，从而达到前后端配置一体化。  

适合做node全栈项目、node中间层，配合前端项目、等等。

## 前言

> * 日常开发中，我们用的都是使用Webpack这类构建工具进行模块化开发。  
> * 或者使用基于create-react-app和vue-cli等脚手架进行开发。  
> * 如果这个时候我们需要Node作为后端，React或者Vue作为前端，Webpack作为构建工具，那岂不是我们需要手动启动两个服务？  
> * 所以这里选用Koa和Webpack作为例子，启动koa服务器时，启动webpack。

### 文章比较长，请耐心阅读
 
### [前言](#前言)
### [搭建一个Koa服务器](#搭建一个Koa服务器)
### [搭建一个webpack服务器](#搭建一个webpack服务器)
### [这里有个痛点需要解决一下](#这里有个痛点需要解决一下)
### [使用cluster进程](#使用cluster进程)
### [总结](#总结)

## 搭建一个Koa服务器


### 搭建一个Koa服务器需要用到什么？
* 前端HTML开发模板采用koa-nunjucks-2
* 处理静态资源koa-static
* 处理后端路由koa-router
* 处理gzip压缩koa-compress

引用依赖
```javaScript
const Koa = require('koa');
const app = new Koa();
const koaNunjucks = require('koa-nunjucks-2');
const koaStatic = require('koa-static');
const KoaRouter = require('koa-router');
const router = new KoaRouter();
const path = require('path');
const compress = require('koa-compress');
```
初始化Koa核心配置
```javaScript
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
    //设置端口号
    this.port = this.config.listen.port;
    //cookie签名加密
    this.app.keys = this.config.keys ? this.config.keys : this.app.keys;
  }
}
```
实现继承,采用的是Es6的class类的方式。如果有不熟悉的，可以参考[Es6教程](http://es6.ruanyifeng.com/)

对于Koa的配置，是通过实例化一个对象，然后传入一个Object配置。这里可以参考Eggjs的[config.default.js](https://eggjs.org/zh-cn/basics/config.html)配置。  

实例化配置可以参考下
```javascript
  new AngelServer({
    routerUrl: path.join(process.cwd(), 'app/router.js'),//路由地址
    configUrl: path.join(process.cwd(), 'config/config.default.js') //默认读取config/config.default.js
  })
```

配置Koa中间件，包括前端模板，静态资源，路由，gzip压缩
```javascript
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
  
    //访问日志
    this.app.use(async (ctx, next) => {
      await next();
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
    //路由管理
    this.router({
      router,
      config: this.config,
      app: this.app
    });
  
    this.app.use(router.routes())
      .use(router.allowedMethods());

    // 静态资源
    this.app.use(koaStatic(this.config.root, this.config.static));
  
    // 启动服务器
    this.app.listen(this.port, () => {
      console.log(`当前服务器已经启动,请访问`,`http://127.0.0.1:${this.port}`.green);
    });
  }
}
```
这里可能有些人不知道我这里的router是怎么回事。  
分享下router.js
```javascript
/**
 *
 * @param {angel 实例化对象} app
 */

const html = require('./controller/home');
const business  = require('./controller/business');

module.exports = (app) => {
  let { router, config } = app;
  router.get('/',html);
  router.post('/system/api/issue/file',business.serverRelease);
  router.post('/system/api/user/reg',business.reg);
  router.get('/system/api/app/list',business.getList)
  router.get('/system/api/server/info',business.getServerInfo)
  router.get('/system/api/server/RAM',business.getServerRAM)
  router.get('/system/api/server/log',business.getServerLog)
}

```

其实，这块router也是参考了Eggjs的写法[router.js](https://eggjs.org/zh-cn/basics/router.html#%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9)。
到这里Koa服务器已经配置完成。

![](https://user-gold-cdn.xitu.io/2018/12/1/1676843ea1151788?w=500&h=503&f=jpeg&s=34711)

## 搭建一个webpack服务器
webpack基本搭建原理，就是利用webpack提供的[webpack-dev-middleware](https://www.npmjs.com/package/webpack-dev-middleware) 和 [webpack-hot-middleware](https://www.npmjs.com/package/webpack-hot-middleware),然后配合koa服务。  

为了方便起见，我采用的是已经基于koa封装好的koa-webpack-dev-middleware和koa-webpack-hot-middleware。

首先引入依赖
```javascript
const webpack = require('webpack');
const path = require('path');
const colors = require('colors');

const chokidar = require('chokidar');
const cluster = require('cluster');

const KoaRouter = require('koa-router');
const router = new KoaRouter();
const Koa = require('koa');

const chalk = require('chalk');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const compress = require('koa-compress');
```
还是老样子，先实例化一个核心类
```javascript
//配置核心配置
class AngelCore {
  constructor(options) {
    this.webpackConfig = require(options.url);
    this.config = options.configUrl ? require(options.configUrl) : require(path.join(process.cwd(), 'config/config.default.js'));
  }
  
}
```
这里引入的是koa-webpack-dev-middleware配置，配置文件见[详情](https://www.npmjs.com/package/koa-webpack-dev-middleware#example-usage)。  

这里webpack我采用的是webpack@4.x版本，而且我们webpack配置一般都是放在项目根目录下的webpack.config.js内。

所以，我们需要支持导入webpack.config.js文件。
定义一个类，继承核心配置
```javascript
//处理webpack配置
class dealWebpackConfig extends AngelCore {
  constructor(options) {
    super(options);
    this.readConfig();
  }
  //处理webpack环境变量问题
  readConfig() {
    this.webpackConfig.mode = this.config.env.NODE_ENV;
    this.webpackConfig.plugins.push(new ProgressBarPlugin({
      format: ` ٩(๑❛ᴗ❛๑)۶ build [:bar] ${chalk.green.bold(':percent')}  (:elapsed 秒)`,
      complete: '-',
      clear: false
    }));
    this.compiler = webpack(this.webpackConfig); //webpack进度处理完成
    //导入webpack配置
    this.devMiddleware = require('koa-webpack-dev-middleware')(this.compiler, this.config.webpack.options);
    this.hotMiddleware = require('koa-webpack-hot-middleware')(this.compiler);
  }

}
```
* 由于webpack4.x版本可以自定义mode设置环境变量，所以，对这个导入的webpack.config.js进行了更改。同时将webpack打包时的progress进度条进行了替换。

![](https://user-gold-cdn.xitu.io/2018/12/1/16768646b51f2005?w=1242&h=162&f=jpeg&s=32768)
新建一个类用于启动webpack，同时继承dealWebpackConfig类。
```javascript
//运行
class angelWebpack extends dealWebpackConfig {
  constructor(options) {
    super(options);
    this.runWebpack();
  }
  //运行webpack
  runWebpack() {
    app.use(this.devMiddleware);
    app.use(this.hotMiddleware);

  }
}
```
再给webpack增加服务端口，用于koa服务器访问webpack的静态资源,默认端口9999。
```javascript
//重新启动一个koa服务器
class koaServer extends angelWebpack {
  constructor(options) {
    super(options);
    this.startKoa();
  }

  startKoa() {
    
    //fork新进程
    let port = this.config.webpack.listen.port ? this.config.webpack.listen.port : 9999;
    //开启gzip压缩
    app.use(compress(this.config.compress));

    //访问日志
    app.use(async (ctx, next) => {
      await next();
      const rt = ctx.response.get('X-Response-Time');
      console.log(`webpack' ${ctx.method}`.green,` ${ctx.url} - `,`${rt}`.green);
    });

    router.get('/',(ctx) => {
      ctx.body = 'webpack';
    });

    app.use(router.routes()).use(router.allowedMethods());
    app.listen(port, () => {
      console.log('webpack服务器已经启动,请访问',`http://127.0.0.1:${port}`.green);
    });
  }
}
```
现在这里的webpack可以说已经配置完成了。
![](https://user-gold-cdn.xitu.io/2018/12/1/1676879988f5cac1?w=500&h=647&f=jpeg&s=17055)
## 这里有个痛点需要解决一下
我们想要的效果是当前端代码更改时，webpack重新构建，node端代码更改时，node服务即Koa服务进行重启，而不是Koa和webpack全部重启。  

所以这里采用webpack使用主进程，当webpack启动的时候，然后用work进程启动koa服务器，koa进程的重启，不会影响到webpack的重新构建。

## 使用cluster进程
现在的koa并没有监听代码更改，然后重启koa服务，可能需要使用外界模块
[supervisor](https://www.npmjs.com/package/supervisor)
 重启进程。  
所以这里我采用[chokidar](https://www.npmjs.com/package/chokidar)
监听nodejs文件是否更改，然后kill掉koa进程，重新fork进程一个新的work进程。
所以对上面的koaServer这个类进行修改。
```javascript
  class koaServer extends angelWebpack {
  constructor(options) {
    super(options);
    this.startKoa();
  }

  startKoa() {
    
    //fork新进程
    let port = this.config.webpack.listen.port ? this.config.webpack.listen.port : 9999;
    //开启gzip压缩
  
    app.use(compress(this.config.compress));

    //访问日志
    app.use(async (ctx, next) => {
      await next();
      const rt = ctx.response.get('X-Response-Time');
      console.log(`webpack' ${ctx.method}`.green,` ${ctx.url} - `,`${rt}`.green);
    });

    router.get('/',(ctx) => {
      ctx.body = 'webpack';
    });

    app.use(router.routes()).use(router.allowedMethods());
    //监听和重启服务。
    this.watchDir();
    app.listen(port, () => {
      console.log('webpack服务器已经启动,请访问',`http://127.0.0.1:${port}`.green);
    });
  }

  watchDir() {
    let worker = cluster.fork();
    const watchConfig = {
      dir: [ 'app', 'lib', 'bin', 'config'],
      options: {}
    };
    chokidar.watch(watchConfig.dir, watchConfig.options).on('change', filePath =>{
      console.log(`**********************${filePath}**********************`);
      worker && worker.kill();
      worker = cluster.fork().on('listening', (address) =>{
        console.log(`[master] 监听: id ${worker.id}, pid:${worker.process.pid} ,地址:http://127.0.0.1:${address.port}`);
      });
    });
  }

}
```
最后再在服务入口文件统一调用
```javascript
//fork一个新的进程，用于启动webpack
if(cluster.isMaster) {
  new angelWebpack({
    url: path.join(process.cwd(), 'assets/webpack.config.js'), //webpack配置地址
    configUrl: path.join(process.cwd(), 'config/config.default.js') //默认读取config/config.default.js
  });

}

// 启动angel服务
if(cluster.isWorker) {
  new AngelServer({
    routerUrl: path.join(process.cwd(), 'app/router.js'),//路由地址
    configUrl: path.join(process.cwd(), 'config/config.default.js') //默认读取config/config.default.js
  })
}
  


```

## 总结
最后，这里提供的只是一个开发环境用的环境，如果是生产环境的话，就需要去掉webpack层，把koa作为主进程，当然nodejs毕竟只是单进程运行的，所以这个koa服务不能完全发挥机器全部性能。    

当然解决这个痛点的方法也有，启动服务器的时候fork多个进程用来处理业务逻辑，每过来一个请求，分配一个进程去跑，业务逻辑跑完了，然后关闭进程，主进程再fork出去一个进程，把机器性能发挥最大化。 



Koa服务和webpack服务源码在我的[github](https://github.com/baiyuze/version-control-system/blob/master/lib/angel-webpack/index.js)，欢迎star。

![](https://user-gold-cdn.xitu.io/2018/12/1/16768909af5823df?w=220&h=220&f=jpeg&s=9281)

==========================================================================
可以看我的另外一篇[如何创建一个可靠稳定的Web服务器](https://juejin.im/post/5c0cf55c51882530544f22e2)

