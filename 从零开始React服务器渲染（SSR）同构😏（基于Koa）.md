## 前言

自前端框架（`React`,`Vue`,`Angelar`）出现以来，每个框架携带不同理念，分为三大阵营，以前使用`JQuery`的时代已经成为过去，以前每个页面就是一个`HTML`，引入相对应的`JS`、`CSS`，同时在`HTML`中书写`DOM`。正因为是这样，每次用户访问进来，由于`HTML`中有`DOM`的存在，给用户的感觉响应其实并不是很慢。  

但是自从使用了框架之后，无论是多少个页面，就是单独一个单页面，即`SPA`。`HTML`中所有的`DOM`元素，必须在客户端下载完`js`之后，通过调用执行`React.render()`才能够进行渲染，所以就有了很多网站上，一进来很长时间的`loading`动画。  

为了解决这一并不是很友好的问题，社区上提出了很多方案，例如`预渲染`、`SSR`、`同构`。

当然这篇文章主要讲述的是从零开始搭建一个**React服务器渲染同构**。


![](https://user-gold-cdn.xitu.io/2019/2/14/168eb1c4e355f319?w=720&h=508&f=png&s=253917)

## 选择方案

### 方案一 使用社区精选框架Next.js

`Next.js` 是一个轻量级的 `React` 服务端渲染应用框架。有兴趣的可以去[`Next.js`](http://nextjs.frontendx.cn/)官网学习下。

### 方案二 同构

关于同构有两种方案：   

### 通过babel转义node端代码和React代码后执行

```
let app = express();
app.get('/todo', (req, res) => {
     let html = renderToString(
     <Route path="/" component={ IComponent } >
        <Route path="/todo" component={ AComponent }>
        </Route>
    </Route>)
     res.send( indexPage(html) )
    }
})  

```
在这里有两个问题需要处理：   
* `Node`不支持前端的`import`语法，需要引入`babel`支持。
* `Node`不能解析标签语法。

所以执行`Node`时，需要使用`babel`来进行转义，如果出现错误了，也无从查起，个人并不推荐这样做。  

所以这里采用第二种方案
### webpack进行编译处理

使用`webpack`打包两份代码，一份用于`Node`进行服务器渲染，一份用于浏览器进行渲染。

下面具体详细说明下。

## 搭建Node服务器

由于使用习惯，经常使用`Egg`框架，而`Koa`是`Egg`的底层框架，因此，这里我们采用`Koa`框架进行服务搭建。

搭建最基本的一个`Node`服务。
```js
const Koa = require('koa');
const app = new Koa();

app.listen(3000, () => {
  console.log("服务器已启动，请访问http://127.0.0.1:3000")
});
```

## 配置webpack
众所周知，`React`代码需要经过打包编译才能执行的，而服务端和客户端运行的代码只有一部分相同，甚至有些代码根本不需要将代码打包，这时就需要将客户端代码和服务端运行的代码分开，也就有了两份`webpack`配置  

`webpack` 将同一份代码，通过不同的`webpack`配置，分别为`serverConfig`和`clientConfig`，打包为两份代码。

### serverConfig和clientConfig配置

通过[webpack](https://www.webpackjs.com/configuration/target/)文档我们可以知道，webpack不仅可以编译web端代码还可以编译其他内容。


![](https://user-gold-cdn.xitu.io/2019/2/14/168eb551d6f7c6ce?w=1408&h=920&f=png&s=247131)

这里我们将`target`设为`node`。

配置入口文件和出口位置：
```js
const serverConfig = {
  target: 'node',
  entry: {
    page1: './web/render/serverRouter.js',
  },
  resolve,
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, './app/build'),
    libraryTarget: 'commonjs'
  }
 }

```
**注意⚠**  

服务端配置需要配置`libraryTarget`，设置`commonjs`或者`umd`,用于服务端进行`require`引用，不然`require`值为`{}`。

在这里客户端和服务端配置没有什么区别，无需配置`target`（默认`web`环境），其他入门文件和输出文件不一致。
```js
const clientConfig = {
  entry: {
    page1: './web/render/clientRouter.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, './public')
  }
}
```
### 配置babel
由于打包的是`React`代码，因此还需要配置`babel`。  
新建`.babelrc`文件。

```js
{
  "presets": ["@babel/preset-react",
    ["@babel/preset-env",{
      "targets": {
        "browsers": [
          "ie >= 9",
          "ff >= 30",
          "chrome >= 34",
          "safari >= 7",
          "opera >= 23",
          "bb >= 10"
        ]
      }
    }]
  ],
  "plugins": [
    [
      "import",
      { "libraryName": "antd", "style": true }
    ] 
  ]
}
```

这份配置由服务端和客户端共用，用来处理`React`和转义为`ES5`和浏览器兼容问题。
### 处理服务端引用问题

服务端使用`CommonJS`规范，而且服务端代码也并不需要构建，因此，对于node_modules中的依赖并不需要打包，所以借助`webpack`第三方模块`webpack-node-externals`来进行处理，经过这样的处理，两份构建过的文件大小已经相差甚远了。

### 处理css

服务端和客户端的区别，可能就在于一个默认处理，一个需要将`CSS`单独提取出为一个文件，和处理`CSS`前缀。

服务端配置
```js
  {
    test: /\.(css|less)$/,
    use: [
      {
        loader: 'css-loader',
        options: {
          importLoaders: 1
        }
      },
      {
        loader: 'less-loader',
      }
    ]
  }
```

客户端配置

```js
  {
    test: /\.(css|less)$/,
    use: [
      {
        loader: MiniCssExtractPlugin.loader,
      },
      {
        loader: 'css-loader'
      },
      {
        loader: 'postcss-loader',
        options: {
          plugins: [
            require('precss'),
            require('autoprefixer')
          ],
        }
      },
      {
        loader: 'less-loader',
        options: {
          javascriptEnabled: true,
          // modifyVars: theme   //antd默认主题样式
        }
      }
    ],
  }
```

## SSR 中客户端渲染与服务器端渲染路由代码的差异

实现 `React` 的 `SSR` 架构，我们需要让相同的代码在客户端和服务端各自执行一遍，但是这里各自执行一遍，并不包括路由端的代码，造成这种原因主要是因为客户端是通过地址栏来渲染不同的组件的，而服务端是通过请求路径来进行组件渲染的。  
因此，在客户端我们采用`BrowserRouter`来配置路由，在服务端采用`StaticRouter`来配置路由。

### 客户端配置

```js
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from "react-router-dom";
import Router from '../router';

function ClientRender() {
  return (
      <BrowserRouter >
        <Router />
      </BrowserRouter>
  )
}

```

### 服务端配置

```javascript
import React from 'react';
import { StaticRouter } from 'react-router'
import Router from '../router.js';

function ServerRender(req, initStore) {

  return (props, context) => {
    return (
        <StaticRouter location={req.url} context={context} >
          <Router />  
        </StaticRouter>
    )
  }
}

export default ServerRender;

```

## 再次配置Node进行服务器渲染
上面配置的服务器，只是简单启动个服务，没有深入进行配置。
### 引入ReactDOMServer


```js

const Koa = require('koa');
const app = new Koa();
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const koaStatic = require('koa-static');
const router = new KoaRouter();

const routerManagement = require('./app/router');
const manifest = require('./public/manifest.json');
/**
 * 处理链接
 * @param {*要进行服务器渲染的文件名默认是build文件夹下的文件} fileName 
 */
function handleLink(fileName, req, defineParams) {
  let obj = {};
  fileName = fileName.indexOf('.') !== -1 ? fileName.split('.')[0] : fileName;

  try {
    obj.script = `<script src="${manifest[`${fileName}.js`]}"></script>`;
  } catch (error) {
    console.error(new Error(error));
  }
  try {
    obj.link = `<link rel="stylesheet" href="${manifest[`${fileName}.css`]}"/>`;
    
  } catch (error) {
    console.error(new Error(error));
  }
  //服务器渲染
  const dom = require(path.join(process.cwd(),`app/build/${fileName}.js`)).default;
  let element = React.createElement(dom(req, defineParams));
  obj.html = ReactDOMServer.renderToString(element);

  return obj;
}

/**
 * 设置静态资源
 */
app.use(koaStatic(path.resolve(__dirname, './public'), {
  maxage: 0, //浏览器缓存max-age（以毫秒为单位）
  hidden: false, //允许传输隐藏文件
  index: 'index.html', // 默认文件名，默认为'index.html'
  defer: false, //如果为true，则使用后return next()，允许任何下游中间件首先响应。
  gzip: true, //当客户端支持gzip时，如果存在扩展名为.gz的请求文件，请尝试自动提供文件的gzip压缩版本。默认为true。
}));

/**
* 处理响应
* 
* **/
app.use((ctx) => {
    let obj = handleLink('page1', ctx.req, {});
    ctx.body = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="ie=edge">
          <title>koa-React服务器渲染</title>
          ${obj.link}
        </head>
        
        <body>
          <div id='app'>
             ${obj.html}
          </div>
        </body>
        ${obj.script}
        </html>
    `
})

app.listen(3000, () => {
  console.log("服务器已启动，请访问http://127.0.0.1:3000")
});
```
这里涉及一个`manifest`文件，这个文件是`webpack`插件`webpack-manifest-plugin`生成的，里面包含编译后的地址和文件。大概结构是这样：
```js
{
  "page1.css": "page1.css",
  "page1.js": "page1.js"
}
```
我们把他引入到`clientConfig`中，添加如下配置：
```js
...
plugins: [
    // 提取样式，生成单独文件
    new MiniCssExtractPlugin({
        filename: `[name].css`,
        chunkFilename: `[name].chunk.css`
    }),
    new ManifestPlugin()
]
```
在上述服务端代码中，我们对于`ServerRender.js`进行了柯里化处理，这样做的目的在于，我们在`ServerRender`中，使用了服务端可以识别的`StaticRouter`，并配置了`location`参数，而`location`需要参数`URL`。  
因此，我们需要在`renderToString`中传递`req`，以让服务端能够正确解析React组件。

```js
  let element = React.createElement(dom(req, defineParams));
  obj.html = ReactDOMServer.renderToString(element);
```

通过`handleLink`的解析，我们可以得到一个`obj`，包含三个参数，`link`（`css`链接），`script`（`JS`链接）和`html`（生成`Dom`元素）。

通过`ctx.body`渲染`html`。

### renderToString()

将 `React` 元素渲染到其初始 `HTML` 中。 该函数应该只在服务器上使用。 `React` 将返回一个 `HTML` 字符串。 您可以使用此方法在服务器上生成 `HTML` ，并在初始请求时发送标记，以加快网页加载速度，并允许搜索引擎抓取你的网页以实现 `SEO` 目的。

如果在已经具有此服务器渲染标记的节点上调用 `ReactDOM.hydrate()` ，`React` 将保留它，并且只附加事件处理程序，从而使您拥有非常高性能的第一次加载体验。

### renderToStaticMarkup()

类似于 `renderToString` ，除了这不会创建 `React` 在内部使用的额外`DOM`属性，如 `data-reactroot`。 如果你想使用`React` 作为一个简单的静态页面生成器，这很有用，因为剥离额外的属性可以节省一些字节。

但是如果这种方法是在浏览访问之后，会全部替换掉服务端渲染的内容，因此会造成页面闪烁，所以并不推荐使用该方法。

### renderToNodeStream()

将 `React` 元素渲染到其最初的 `HTML` 中。返回一个 可读的 流(`stream`) ，即输出 `HTML` 字符串。这个 流(`stream`) 输出的 `HTML` 完全等同于 `ReactDOMServer.renderToString` 将返回的内容。

我们也可以使用上述`renderToNodeSteam`将其改造下：

```
  let element = React.createElement(dom(req, defineParams));
  
  ctx.res.write('
  <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="ie=edge">
          <title>koa-React服务器渲染</title>
      </head><body><div id="app">');
  
  // 把组件渲染成流，并且给Response
  const stream = ReactDOMServer.renderToNodeStream(element);
  stream.pipe(ctx.res, { end: 'false' });
  
  // 当React渲染结束后，发送剩余的HTML部分给浏览器
  stream.on('end', () => {
    ctx.res.end('</div></body></html>');
  });
```

### renderToStaticNodeStream()

类似于 `renderToNodeStream` ，除了这不会创建 `React` 在内部使用的额外`DOM`属性，如 `data-reactroot` 。 如果你想使用 `React` 作为一个简单的静态页面生成器，这很有用，因为剥离额外的属性可以节省一些字节。

这个 流(`stream`) 输出的 `HTML` 完全等同于 `ReactDOMServer.renderToStaticMarkup` 将返回的内容。


## 添加状态管理redux

以上开发一个静态网站，或者一个相对于比较简单的项目已经`OK`了，但是对于复杂的项目，这些还远远不够，这里，我们再给它加上全局状态管理`Redux`。

服务器渲染中其顺序是同步的，因此，要想在渲染时出现首屏数据渲染，必须得提前准备好数据。

* 提前获取数据
* 初始化store
* 根据路由显示组件
* 结合数据和组件生成 HTML，一次性返回

对于客户端来说添加`redux`和常规的`redux`并无太大差别，只是对于`store`添加了一个初始的`window.__INIT_STORE__`。

```js
let initStore = window.__INIT_STORE__;
let store = configStore(initStore);

function ClientRender() {
  return (
    <Provider store={store}>
      <BrowserRouter >
        <Router />
      </BrowserRouter>
    </Provider>

  )
}
```

而对于服务端来说在初始数据获取完成之后，可以采用`Promise.all()`来进行并发请求，当请求结束时，将数据填充到`script`标签内，命名为`window.__INIT_STORE__`。

```html
`<script>window.__INIT_STORE__ = ${JSON.stringify(initStore)}</script>`
```

然后将服务端的`store`重新配置下。

```js
function ServerRender(req, initStore) {
  let store = CreateStore(JSON.parse(initStore.store));

  return (props, context) => {
    return (
      <Provider store={store}>
        <StaticRouter location={req.url} context={context} >
          <Router />  
        </StaticRouter>
      </Provider>
    )
  }
}
```

![](https://user-gold-cdn.xitu.io/2019/2/15/168f0106bef8b999?w=640&h=400&f=gif&s=2282198)

## 整理Koa

考虑后面开发的便利性，添加如下功能：
* Router功能
* HTML模板
### 添加Koa-Router

```js
/**
 * 注册路由
 */
const router = new KoaRouter();
const routerManagement = require('./app/router');
...
routerManagement(router);
app.use(router.routes()).use(router.allowedMethods());

```

为了保证开发时，接口规整，这里将所有的路由都提到一个新的文件中进行书写。并保证如以下格式：

```js
/**
 *
 * @param {router 实例化对象} router
 */

const home = require('./controller/home');

module.exports = (router) => {
  router.get('/',home.renderHtml);
  router.get('/page2',home.renderHtml);
  router.get('/favicon.ico',home.favicon);
  router.get('/test',home.test);
}

```

### 处理模板

将`html`放入代码中，给人感觉并不是很友好，因此，这里同样引入了服务模板`koa-nunjucks-2`。  

同时在其上在套一层中间件，以便传递参数和处理各种静态资源链接。

```js
...
const koaNunjucks = require('koa-nunjucks-2');
...
/**
 * 服务器渲染，渲染HTML，渲染模板
 * @param {*} ctx 
 */
function renderServer(ctx) {
  return (fileName, defineParams) => {
    let obj = handleLink(fileName, ctx.req, defineParams);
    // 处理自定义参数
    defineParams = String(defineParams) === "[object Object]" ? defineParams : {};
    obj = Object.assign(obj, defineParams);
    ctx.render('index', obj);
  }
}

...

/**
 * 模板渲染
 */
app.use(koaNunjucks({
  ext: 'html',
  path: path.join(process.cwd(), 'app/view'),
  nunjucksConfig: {
    trimBlocks: true
  }
}));

/**
 * 渲染Html
 */
app.use(async (ctx, next) => {
  ctx.renderServer = renderServer(ctx);
  await next();
});
```

在用户访问该服务器时，通过调用`renderServer`函数，处理链接，执行到最后，调用`ctx.render`完成渲染。

```js

/**
 * 渲染react页面
 */

 exports.renderHtml = async (ctx) => {
    let initState = ctx.query.state ? JSON.parse(ctx.query.state) : null;
    ctx.renderServer("page1", {store: JSON.stringify(initState ? initState : { counter: 1 }) });
 }
 exports.favicon = (ctx) => {
   ctx.body = null;
 }

 exports.test = (ctx) => {
   ctx.body = {
     data: `测试数据`
   }
 }

```
关于`koa-nunjucks-2`中，在渲染`HTML`时，会将有`<  >`进行安全处理，因此，我们还需对我们传入的数据进行过滤处理。

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>koa-React服务器渲染</title>
  {{ link | safe }}
</head>

<body>
  <div id='app'>
    {{ html | safe }}
  </div>
</body>
<script>
  window.__INIT_STORE__ = {{ store | safe }}
</script>
{{ script | safe }}
</html>
```
## 文档结构

```js
├── README.md
├── app  //node端业务代码
│   ├── build
│   │   ├── page1.js
│   │   └── page2.js
│   ├── controller
│   │   └── home.js
│   ├── router.js
│   └── view
│       └── index.html
├── index.js
├── package.json
├── public //前端静态资源
│   ├── manifest.json
│   ├── page1.css
│   ├── page1.js
│   ├── page2.css
│   └── page2.js
├── web  //前端源码
│   ├── action //redux -action
│   │   └── count.js
│   ├── components  //组件
│   │   └── layout
│   │       └── index.jsx
│   ├── pages //主页面
│   │   ├── page
│   │   │   ├── index.jsx
│   │   │   └── index.less
│   │   └── page2
│   │       ├── index.jsx
│   │       └── index.less
│   ├── reducer //redux -reducer
│   │   ├── counter.js
│   │   └── index.js
│   ├── render  //webpack入口文件
│   │   ├── clientRouter.js
│   │   └── serverRouter.js
│   ├── router.js //前端路由
│   └── store //store
│       └── index.js
└── webpack.config.js
```
## 最后

目前这个架构目前只能手动启动`Koa`服务和启动`webpack`。  

如果需要将Koa和webpack跑在一块，这里就涉及另外一个话题了，在这里可以查看我一开始写的文章。

《[骚年，Koa和Webpack了解一下？](https://juejin.im/post/5c01f46c51882516d725ee51)》  

如果需要了解一个完整的服务器需要哪些功能，可以了解我早期的文章。

《[如何创建一个可靠稳定的Web服务器](https://juejin.im/post/5c0cf55c51882530544f22e2)》

最后`GITHUB`地址如下：  

[基于koa的react服务器渲染](https://github.com/baiyuze/koa-react-ssr-render)

参考资料：

《[React中文文档](http://react.html.cn/docs/react-dom-server.html)》   
《[Webpack中文文档](https://www.webpackjs.com/configuration/output/#output-librarytarget)》   
《[React 中同构（SSR）原理脉络梳理](https://juejin.im/post/5bc7ea48e51d450e46289eab)》   
《[Redux](https://www.redux.org.cn/docs/basics/Reducers.html)》
