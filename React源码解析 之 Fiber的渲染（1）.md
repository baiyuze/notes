---
theme: channing-cyan
---

#### React源码系列
- [React源码解析之 Fiber结构的创建](https://juejin.cn/post/6951585684679294989)
- [React源码解析 之 Fiber的渲染（1）](https://juejin.cn/post/6951585684679294989)
> 通过上一篇《[React Fiber结构的创建](https://juejin.cn/post/6950692243485229086)》，我们得到`fiberRoot`的结构，这一篇，主要讲述如何将得到的`fiberRoot`渲染到视图。


## 如何生成workInProgress结构

上篇通过查看调用栈生成了了一个`fiberRoot`，从调用`updateContainer`函数为入口函数，开始执行解析`fiberRoot`结构。
```js
updateContainer(children, fiberRoot, parentComponent, callback);
```
解释一下，此时的`children`为未实例化的`ReactNodeList`，`parentComponent`为`React.render`中的`container（div#root）`。


`updateContainer`处理以下几件事。

### 一、 获取当前优先级`lane`（车道）
```js
  const current = container.current;//container - fiber root
  // 获取优先级车道lane
  const lane = requestUpdateLane(current);
```
此时`lane`为1。

在`react v17`版本后，以`lane`为优先级，`lane`值越小，优先级越高，`lane`为二进制存储，一共`31`位，每个位为一个车道。点击[这里](https://github.com/facebook/react/blob/933880b4544a83ce54c8a47f348effe725a58843/packages/react-reconciler/src/ReactFiberLane.old.js)查看源码。
```js
export const TotalLanes = 31;

export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;

export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001;

// 输入框的值
const InputContinuousHydrationLane: Lane = /*           */ 0b0000000000000000000000000000010;
export const InputContinuousLane: Lanes = /*            */ 0b0000000000000000000000000000100;

export const DefaultHydrationLane: Lane = /*            */ 0b0000000000000000000000000001000;
export const DefaultLane: Lanes = /*                    */ 0b0000000000000000000000000010000;

```
在`requestUpdateLane`中在初始化渲染时，`lane`为1。
```js
export function requestUpdateLane(fiber: Fiber): Lane {
  // Special cases
  const mode = fiber.mode;
  if ((mode & ConcurrentMode) === NoMode) {
    // 0b0000000000000000000000000000001;
    // 优先级为1车道为1
    return (SyncLane: Lane);
    // ....
```

在react源码中，有一个文件，单独存放了不同种类型的优先级的`lane`的二进制值。
关于`lane`，后续会有单独文章进行解释其含义，以及使用`lane`进行权限设计的应用，此时我们只需要知道这个地方获取了`lane`作为`fiber`的优先级。

### 二、创建context。
在初始化时，通过`getContextForSubtree`函数，判断是否存在`parentComponent`，此时`parentComponet`为root的父元素，此时为null。
否则返回`parentContext`。
```js
function getContextForSubtree(
  parentComponent: ?React$Component<any, any>,
): Object {
  if (!parentComponent) {
    return emptyContextObject;
  }

  const fiber = getInstance(parentComponent);
  const parentContext = findCurrentUnmaskedContext(fiber);

  if (fiber.tag === ClassComponent) {
    const Component = fiber.type;
    if (isLegacyContextProvider(Component)) {
      return processChildContext(fiber, Component, parentContext);
    }
  }

  return parentContext;
}
```

### 三、创建update
创建update对象用来进行排队更新`enqueueUpdate`。

```js
// 创建update对象
  const update = createUpdate(eventTime, lane);
  // ...
  export function createUpdate(eventTime: number, lane: Lane): Update<*> {
  const update: Update<*> = {
    eventTime,
    lane,
    tag: UpdateState,// tag为 0|1|2|3
    payload: null,
    callback: null,

    next: null,
  };
  return update;
}
// ...
update.payload = { element };
callback = callback === undefined ? null : callback;
update.callback = callback;
}
// 队列更新
enqueueUpdate(current, update, lane);
```
`enqueueUpdate`主要用来添加一个共享队列`sharedQueue`，该队列可以和`workInProgress`和`FiberRoot`进行共享队列。
```js
export function enqueueUpdate<State>(
  fiber: Fiber,//fiberRoot
  update: Update<State>,
  lane: Lane,
) {
  const updateQueue = fiber.updateQueue;
  if (updateQueue === null) {
    // Only occurs if the fiber has been unmounted.
    return;
  }
  // 当前队列和缓存队列共享一个持久化队列
  const sharedQueue: SharedQueue<State> = (updateQueue: any).shared;
  // 比较fiber lane和lane，相同时更新
  // render初始化时不执行
  if (isInterleavedUpdate(fiber, lane)) {
    const interleaved = sharedQueue.interleaved;//交错更新
    if (interleaved === null) {
      // 如果是第一次更新，创建双向链表
      update.next = update;
      //在当前渲染结束时，将显示此队列的交错更新
      //被转移到挂起队列。
      pushInterleavedQueue(sharedQueue);
    } else {
      // interleaved.next ->  update.next   update - interleaved.next;
      // interleaved.next = update
      // update.next = interleaved.next = update
      update.next = interleaved.next;
      interleaved.next = update;
    }
    sharedQueue.interleaved = update;
  } else {
    const pending = sharedQueue.pending;
    if (pending === null) {
      //这是第一次更新。创建单向链表。
      update.next = update;
    } else {
      // 定义双向列表
      update.next = pending.next;
      pending.next = update;
    }
    sharedQueue.pending = update;
  }
}
```
### 四、调用`scheduleUpdateOnFiber`

处理`Fiber` `schedule`更新，在这里我们只看该次render函数会执行的逻辑，页面初始化时，此时只是先生成了`fiberRoot`,并未生成`workInProgressRoot`，此时`workInProgressRoot`为`null`，因此，会走一下逻辑，调用`performSyncWorkOnRoot`。
```js
export function scheduleUpdateOnFiber(
  fiber: Fiber,
  lane: Lane,//当前更新lane
  eventTime: number,
): FiberRoot | null {
    ...
  //标记root有挂起的更新。
  markRootUpdated(root, lane, eventTime);
  if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
    ...
  }
    // root为fiber,workInfoProGressRoot为null,为false
  if (root === workInProgressRoot) {
   ...
  }

  if (lane === SyncLane) {
    if (
      // 检查我们是否在unbatchedUpdates
      (executionContext & LegacyUnbatchedContext) !== NoContext &&
      // 检查我们是否还没有渲染
      (executionContext & (RenderContext | CommitContext)) === NoContext
    ) {
      // 在根目录上注册挂起的交互，以避免丢失跟踪的交互数据。
      schedulePendingInteractions(root, lane);
      performSyncWorkOnRoot(root);
    } else {
      ensureRootIsScheduled(root, eventTime);
      schedulePendingInteractions(root, lane);
      if (
        executionContext === NoContext &&
        (fiber.mode & ConcurrentMode) === NoMode
      ) {
      //重置
        resetRenderTimer();
        flushSyncCallbackQueue();
      }
    }
  } else {
    //...
    ensureRootIsScheduled(root, eventTime);
    schedulePendingInteractions(root, lane);
  }

  return root;
}
```

`performSyncWorkOnRoot`会刷新`Effects`和同步渲染`Fiber`。

```js
//...
  if (
    root === workInProgressRoot &&
    areLanesExpired(root, workInProgressRootRenderLanes)
  ) {
    lanes = workInProgressRootRenderLanes;
    exitStatus = renderRootSync(root, lanes);
  } else {
    lanes = getNextLanes(root, NoLanes);
    // 同步渲染root
    exitStatus = renderRootSync(root, lanes);
  }
 //...
```

`renderRootSync`函数，首先会创建一个`workInProgress`的双向链表树，此树通过`alternate`和fiberRoot进行关联
```js
...
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    // 创建workInProgress的tree
    prepareFreshStack(root, lanes);
    // 开始处理挂起的交互,并将有交互的，绑定到store中即root.memoizedInteractions中
    startWorkOnPendingInteractions(root, lanes);
  }
 ...
 //创建workInProgress和workInProgressRoot。
 function prepareFreshStack(root: FiberRoot, lanes: Lanes) {
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  const timeoutHandle = root.timeoutHandle;
  if (timeoutHandle !== noTimeout) {
    // The root previous suspended and scheduled a timeout to commit a fallback
    // state. Now that we have additional work, cancel the timeout.
    root.timeoutHandle = noTimeout;
    // $FlowFixMe Complains noTimeout is not a TimeoutID, despite the check above
    cancelTimeout(timeoutHandle);
  }

  if (workInProgress !== null) {
    let interruptedWork = workInProgress.return;
    while (interruptedWork !== null) {
      unwindInterruptedWork(interruptedWork, workInProgressRootRenderLanes);
      interruptedWork = interruptedWork.return;
    }
  }
  workInProgressRoot = root;
  workInProgress = createWorkInProgress(root.current, null);//根据当前节点创建workInProgess
  workInProgressRootRenderLanes = subtreeRenderLanes = workInProgressRootIncludedLanes = lanes;
  workInProgressRootExitStatus = RootIncomplete;
  workInProgressRootFatalError = null;
  workInProgressRootSkippedLanes = NoLanes;
  workInProgressRootUpdatedLanes = NoLanes;
  workInProgressRootPingedLanes = NoLanes;
  
    ... 
 }
```
执行后续代码，调用`workLoopSync`函数，开始处理`workInProgress`双向链表，进入`beginWork`阶段。
```js
  do {
    try {
      workLoopSync();//同步更新
      break;
    } catch (thrownValue) {
      handleError(root, thrownValue);
    }
  } while (true);
  
  
  ...
  ...
  
  function workLoopSync() {
      // Already timed out, so perform work without checking if we need to yield.
      while (workInProgress !== null) {
        performUnitOfWork(workInProgress);//执行工作单元
      }
}
···
```
此时workInProgress结构已经生成，它的结构和左侧结构一致，我这边省略画了，通过中间的alternate进行连接。
图如下：

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fbae5fe0f8b74a8db171e9837330a1cc~tplv-k3u1fbpfcp-watermark.image)

#### 函数调用栈如下：

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6d5d2a431ad84e96b8198236e147affd~tplv-k3u1fbpfcp-watermark.image)
## 下一篇：beginWork阶段。



