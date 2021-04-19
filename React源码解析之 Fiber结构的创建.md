

### React源码系列
- [React源码解析之 Fiber结构的创建](https://juejin.cn/post/6951585684679294989)
- [React源码解析 之 Fiber的渲染（1）](https://juejin.cn/post/6951585684679294989)
## React Fiber的创建
当前React版本基于V17.0.2版本，本篇主要介绍fiber结构的创建。

#### 一、开始之前
> 个人理解，如有不对，请指出。

> 首先需要配置好React的debugger开发环境，入口在这里[：github](https://github.com/baiyuze/debug-react)

执行`npm run i`，安装依赖，`npm start`运行环境。

#### 二、从React.render开始

通过在项目入口处调用React.render，打上Debug，查看React调用栈。
```jsx
const root = document.getElementById('root');
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  root
);
```

在`Reac`t调用`render`之后，在传入基础的配置后，调用`legacyRenderSubtreeIntoContainer`。
```jsx
export function render(
  element: React$Element<any>,
  container: Container,
  callback: ?Function,
) {
  // 删除一些环境代码
  // ...
  return legacyRenderSubtreeIntoContainer(
    null,
    element,
    container,
    false,
    callback,
  );
}
```

`legacyRenderSubtreeIntoContainer`一共做了两件事情，一个是生成了`fiberRoot`，一个是调用`updateContainer`。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5339a4c530324144aec8a11c51e1359e~tplv-k3u1fbpfcp-watermark.image)

进入`legacyCreateRootFromDOMContainer`函数，查看如何生成fiberRoot。
在函数内部，调用了`createLegacyRoot`，在这里区分了下，是否使用`hydrate`，如下：
```jsx
  return createLegacyRoot(
    container,
    shouldHydrate
      ? {
        hydrate: true,
      }
      : undefined,
  );
```

对于`createLegacyRoot`来说，是用来实例化`ReactDOMLegacyRoot`函数的，通过后续调用，终于进入到`root`的生成,调用`createRootImpl`函数，实例化`root`。

进入`createFiberRoot`函数，初始化`FiberRootNode`。
```js
function FiberRootNode(containerInfo, tag, hydrate) {
  this.tag = tag; // 类型
  this.containerInfo = containerInfo; // container
  this.pendingChildren = null; 
  this.current = null;
  this.pingCache = null;
  this.finishedWork = null;
  this.timeoutHandle = noTimeout;
  this.context = null;
  this.pendingContext = null;
  this.hydrate = hydrate;
  this.callbackNode = null;
  this.callbackPriority = NoLanePriority;
  this.eventTimes = createLaneMap(NoLanes);
  this.expirationTimes = createLaneMap(NoTimestamp);

  this.pendingLanes = NoLanes;
  this.suspendedLanes = NoLanes;
  this.pingedLanes = NoLanes;
  this.mutableReadLanes = NoLanes;
  this.finishedLanes = NoLanes;

  this.entangledLanes = NoLanes;
  this.entanglements = createLaneMap(NoLanes);

  // ....


}
```
这里的tag，有以下几种类型。
```js
export type RootTag = 0 | 1;
```
上述的结构是fiberRootNode节点。

`rootTag` 等于**0** 时，代表`legacy`渲染模式，等于1时，代表`Concurrent mode`渲染，也就是说，传统我们使用`React.render`进行渲染，当调用`React.createRoot`时，进入`Concurrent mode`渲染模式，即**并行渲染**。

现在我们一起看看`fiber`的结构。
```js
  const uninitializedFiber = createHostRootFiber(tag, strictModeLevelOverride);
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;
```
`uninitializedFiber`为创建的`FiberNode`的创建的实例。

```js
const createFiber = function(
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode,
): Fiber {
  // $FlowFixMe: the shapes are exact here but Flow doesn't like constructors
  return new FiberNode(tag, pendingProps, key, mode);
};
```
通过基础的创建，生成`FiberNode`结构，如下
```js

function FiberNode(
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode,
) {
  // Instance
  this.tag = tag;//组件类型
  this.key = key;//key属性
  this.elementType = null;//元素类型，类函数，显示类，div显示div
  this.type = null;//func或者class
  this.stateNode = null;//dom节点

  // Fiber
  this.return = null;//指向父节点
  this.child = null;//指向子节点
  this.sibling = null;//兄弟节点
  this.index = 0;//

  this.ref = null;

  this.pendingProps = pendingProps;//等待中的属性pendingProps
  this.memoizedProps = null; //记忆属性，一般存放props
  this.updateQueue = null;//更新队列
  this.memoizedState = null;// 一般存放state
  this.dependencies = null;

  this.mode = mode;

  // Effects相关
  this.flags = NoFlags;
  this.subtreeFlags = NoFlags;
  this.deletions = null;

  this.lanes = NoLanes;
  this.childLanes = NoLanes;

  this.alternate = null;//指向workInProgress
}
```


![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/72a68e717cbf4da4be2b32a208f834f8~tplv-k3u1fbpfcp-watermark.image)
`FiberNode`基本显示如上，`elementType`和`type`的基础类型为`function、class`。

通过对比`fiberRootNode`结构，和下面的代码，生成最终的`FiberNode` 结构。

```js
render() {
    const { name, count } = this.state;
    return (
      <div className="App">
          <Button name={name} />
        {
          count
        }
      </div>
    );
  }
```
```js
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  root
);
```

通过最后执行，生成`fiberRoot`链表结构。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/514f6a846c3c40ff81ec87850e598eaf~tplv-k3u1fbpfcp-watermark.image)


最后，调用`unbatchedUpdates`，进行渲染。

进入`updateContainer`函数。
```jsx
unbatchedUpdates(() => {
  // 更新container
  updateContainer(children, fiberRoot, parentComponent, callback);
});
```

#### 三、结束

下一篇：`fiberRoot`的渲染

- 阶段一：生成`workInProgress`。
- 阶段二：调用`workLoopSync`，执行`beginWork`。
- 阶段三：执行`completeWork`。







