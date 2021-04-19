
## beginWork 阶段
### React源码系列
- [React源码解析之 Fiber结构的创建](https://juejin.cn/post/6951585684679294989)
- [React源码解析 之 Fiber的渲染（1）](https://juejin.cn/post/6951585684679294989)
> * 上一篇结尾，我们得到了一个`workInProgress`结构的双向链表树，它的`alternate`指向`FiberRootNode.current`。
> * 这一篇，主要介绍`beginWork`阶段。

### beginWork阶段
从调用的代码中来看，`beginWork`最终返回的是一个`Next`，此`next`最后赋值给`WorkInProgress`，然后继续循环调用，最终当`workInProgress === null`，时，结束循环。

```js
// 同步
function workLoopSync() {
  // Already timed out, so perform work without checking if we need to yield.
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

...
//执行任务单元
function performUnitOfWork(unitOfWork: Fiber): void {
   
  const current = unitOfWork.alternate;
  setCurrentDebugFiberInDEV(unitOfWork);

  let next;
  if (enableProfilerTimer && (unitOfWork.mode & ProfileMode) !== NoMode) {
    startProfilerTimer(unitOfWork);
    next = beginWork(current, unitOfWork, subtreeRenderLanes);
    stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);
  } else {
    next = beginWork(current, unitOfWork, subtreeRenderLanes);
  }

  resetCurrentDebugFiberInDEV();
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    // If this doesn't spawn new work, complete the current work.
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }

  ReactCurrentOwner.current = null;
}
```
对于beginWork函数来说，需要三个参数。

- `current`：当前Fiber，即`workInProgress.alterNate`
- `workInProgress`：当前工作任务单元
- `renderLanes`：优先级相关

在一开始调用beginWork时，就判断current是否为null，区分组件是否是首次渲染，首次渲染情况下current为null，也就是处于mount。

所以`beginWork`，一共有两个阶段，一个是`mount`阶段，一个`update`阶段，`update`可复用`current`阶段，就不需要重新创建`workInProgress.child`。

```js

function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
   if(current !== null) {
        const oldProps = current.memoizedProps
        const newProps = workInProgress.pendingProps
        if (
          oldProps === newProps &&
          !hasLegacyContextChanged() &&
          (updateExpirationTime === NoWork ||
            updateExpirationTime > renderExpirationTime)
        ) { 
        ...
        }
    ...
 }
```
然后定义属性`oldProps`和`newProps`，进行判断，判断`oldProps === newProps` &&
          `!hasLegacyContextChanged()`，当判断为`true`的时候。设置`didReceiveUpdate`为`true`。
 
否则，调用`bailoutOnAlreadyFinishedWork`函数，复用组件，返回`workInProgress.chilren`。

```js

function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  if (current !== null) {
    // Reuse previous dependencies
    workInProgress.dependencies = current.dependencies;
  }

  if (enableProfilerTimer) {
    // Don't update "base" render times for bailouts.
    stopProfilerTimerIfRunning(workInProgress);
  }

  markSkippedUpdateLanes(workInProgress.lanes);
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    if (enableLazyContextPropagation && current !== null) {
      lazilyPropagateParentContextChanges(current, workInProgress, renderLanes);
      if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
        return null;
      }
    } else {
      return null;
    }
  }
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}
```

根据`workInProgress`的`tag`来判断当前组件处于什么状态，调用函数，返回`workInProgress.child`。
```js
export const FunctionComponent = 0;
export const ClassComponent = 1;
export const IndeterminateComponent = 2; // Before we know whether it is function or class //未判断是否是类组件，还是函数组件
export const HostRoot = 3; // Root of a host tree. Could be nested inside another node.可以嵌套在另外节点中
export const HostPortal = 4; // A subtree. Could be an entry point to a different renderer.子树。可能是其他渲染器的入口点。
export const HostComponent = 5;
export const HostText = 6;
export const Fragment = 7;
export const Mode = 8;
export const ContextConsumer = 9;
export const ContextProvider = 10;
export const ForwardRef = 11;
export const Profiler = 12;
export const SuspenseComponent = 13;
export const MemoComponent = 14;
export const SimpleMemoComponent = 15;
export const LazyComponent = 16;
export const IncompleteClassComponent = 17;
export const DehydratedFragment = 18;
export const SuspenseListComponent = 19;
export const ScopeComponent = 21;
export const OffscreenComponent = 22;
export const LegacyHiddenComponent = 23;
export const CacheComponent = 24;

```
大概有二十四中类型，这里主要介绍其中的几种。

// 根据tag不同，创建不同的子Fiber节点
```js
  switch (workInProgress.tag) {
    case IndeterminateComponent: 
      // ...
    case LazyComponent: 
      // ...
    case FunctionComponent: 
      // ...
    case ClassComponent: 
      // ...
    case HostRoot:
      // ...
    case HostComponent:
      // ...省略
    case HostText:
      // ...
    // ...省略其他类型
  }
}
```
#### HostRoot


```js
    case HostRoot://3 rootFiber
      return updateHostRoot(current, workInProgress, renderLanes);
```
这是在初始化，第一次调用时的tag，此tag为3，即`rootFiber`节点。调用`updateHostRoot`函数。
```js
function updateHostRoot(current, workInProgress, renderLanes) {
  //...省略
  const updateQueue = workInProgress.updateQueue;
  const nextProps = workInProgress.pendingProps;
  const prevState = workInProgress.memoizedState;
  const prevChildren = prevState.element;
  cloneUpdateQueue(current, workInProgress);//克隆，赋值
  // 这个方法的主要作用是处理updateQueue里面的update，执行并获得最新的state，最后获取effect放置到Fiber对象上
  processUpdateQueue(workInProgress, nextProps, null, renderLanes);
  const nextState = workInProgress.memoizedState;

  const root: FiberRoot = workInProgress.stateNode;
  //...省略
  const nextChildren = nextState.element;
  if (nextChildren === prevChildren) {//如果children状态没发生改变，就不处理
    resetHydrationState();
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }
  // hydrate 为true时执行
  if (root.hydrate && enterHydrationState(workInProgress)) {
    //...省略
  } else {
    // root.进入diff算法
    reconcileChildren(current, workInProgress, nextChildren, renderLanes);
    resetHydrationState();//重置</any>
  }
  return workInProgress.child;
}
```
`updateHostRoot`函数，在开始执行时，初始化了`nextProps`、`prevState`、`prevChildren`，值，并放入`reconcileChildren`处理，最后返回`workInProgress.child`。
```js
export function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any,
  renderLanes: Lanes
) {
  if (current === null) {
    // 对于mount的组件
    workInProgress.child = mountChildFibers(
      workInProgress,
      null,
      nextChildren,
      renderLanes,
    );
  } else {
    // 对于update的组件
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes,
    );
  }
}
```
在上面时，有介绍过`current === null`的情况，即组件有两个状态，一个是`mount`状态，一个是`update`状态。

1. `mount`时，创建新的子`fiber`节点。
2.`update`时，与上一次的`fiber`节点，进行对比，也就是所谓的`Diff`算法。这里就不展开说了，后续会有单独文章介绍`React`的`Diff`算法。

#### IndeterminateComponent

`IndeterminateComponent`从字面理解，这是个不确定组件，调用`mountIndeterminateComponent`函数。

而什么时候才会调用`mountIndeterminateComponent`函数呢？

一般来说，在`FunctionComponent`在第一次识别的时候，会把tag设为`IndeterminateComponent`。
在之后再进行调用，区分是具体是`classComponent`还是`FunctionComponent`。

所以，在执行该函数的时候，先试判断了`current`是否存在，如果存在，清空该`current`和`workInProgress`的引用`alternate`。

```js

function mountIndeterminateComponent(
  _current,
  workInProgress,
  Component,
  renderLanes,
) {
  if (_current !== null) {
    _current.alternate = null;
    workInProgress.alternate = null;

    workInProgress.flags |= Placement;
  }

  const props = workInProgress.pendingProps;
  let context;
  if (!disableLegacyContext) {
    const unmaskedContext = getUnmaskedContext(
      workInProgress,
      Component,
      false,
    );
    context = getMaskedContext(workInProgress, unmaskedContext);
  }

  prepareToReadContext(workInProgress, renderLanes);
  let value;
  if(__DEV__)
    // ...
  } else {
    value = renderWithHooks(
      null,
      workInProgress,
      Component,
      props,
      context,
      renderLanes,
    );
  }
  workInProgress.flags |= PerformedWork;
  //判断 那个是类组件，哪个是函数组件
  if (
    !disableModulePatternComponents &&
    typeof value === 'object' &&
    value !== null &&
    typeof value.render === 'function' &&
    value.$$typeof === undefined
  ) {

    // Proceed under the assumption that this is a class instance
    workInProgress.tag = ClassComponent;

    // Throw out any hooks that were used.
    workInProgress.memoizedState = null;
    workInProgress.updateQueue = null;
    // 是否含有context
    let hasContext = false;
    if (isLegacyContextProvider(Component)) {
      hasContext = true;
      pushLegacyContextProvider(workInProgress);
    } else {
      hasContext = false;
    }
    // 判断是否含有state
    workInProgress.memoizedState =
      value.state !== null && value.state !== undefined ? value.state : null;
     //初始化updateQueue
    initializeUpdateQueue(workInProgress);
    const getDerivedStateFromProps = Component.getDerivedStateFromProps;
    if (typeof getDerivedStateFromProps === 'function') {
      applyDerivedStateFromProps(
        workInProgress,
        Component,
        getDerivedStateFromProps,
        props,
      );
    }
    
    adoptClassInstance(workInProgress, value);
    // 实例化clas组件，并调用componentWillUpdate和UNSAFE_componentWillMount
    mountClassInstance(workInProgress, Component, props, renderLanes);
    return finishClassComponent(
      null,
      workInProgress,
      Component,
      true,
      hasContext,
      renderLanes,
    );
  } else {
    
    workInProgress.tag = FunctionComponent;
    // 处理workInProgress
    reconcileChildren(null, workInProgress, value, renderLanes);

    return workInProgress.child;
  }
}

```
对于value变量，该变量，直接调用`renderWithHooks`函数，然后在函数内调用`Component(props, secondArg);`
```js
    value = renderWithHooks(
      null,
      workInProgress,
      Component,
      props,
      context,
      renderLanes,
    );
```

```js
  let children = Component(props, secondArg);
```
对于`Component`函数，该函数是`workInProgress.type`函数。也是在一开始判断`tag`时，所传入的`type`。
```js
    // 不确定组件
    case IncompleteClassComponent: {//17
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return mountIncompleteClassComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderLanes,
      );
    }
```
当判断FunctionComponent和ClassComponent处理value函数后，返回`workInProgress.child`.
```js
    reconcileChildren(null, workInProgress, value, renderLanes);
    return workInProgress.child;
```
#### FunctionComponent
```js
    // 函数式组件
    case FunctionComponent: {
      child = updateFunctionComponent(
        null,
        workInProgress,
        Component,
        resolvedProps,
        renderLanes,
      );
      return child;
```
对于`FunctionComponet`类型，`updateFunctionComponent`处理就比较简单了，先是处理`context`，创建`nextChildren`，同时处理`current !== null && !didReceiveUpdate`，判断是否是`update`阶段。

调用`bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes)`，返回`workInProgress.child`；

```js

function updateFunctionComponent(
  current,
  workInProgress,
  Component,
  nextProps: any,
  renderLanes,
) {
  // 初始化Context
  let context;
  if (!disableLegacyContext) {
    const unmaskedContext = getUnmaskedContext(workInProgress, Component, true);
    context = getMaskedContext(workInProgress, unmaskedContext);
  }
   
  let nextChildren;
  //处理context
  prepareToReadContext(workInProgress, renderLanes);
  //...
  //处理函数式组件
    nextChildren = renderWithHooks(
      current,
      workInProgress,
      Component,
      nextProps,
      context,
      renderLanes,
    );
// update状态，current != null ，并且didReceiveUpdate= false
  if (current !== null && !didReceiveUpdate) {
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  //...
  workInProgress.flags |= PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}
```


#### ClassComponent

```js
    case ClassComponent: {//1类组件
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          // const props = Object.assign({}, baseProps);
          // 如果该组件设置了defaultProps，会先合并defaultProps
          : resolveDefaultProps(Component, unresolvedProps);//合并默认props，assign props
      return updateClassComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderLanes,
      );
    }
```

对于`ClassComponent`组件，先是获取resulvedProps，创建类组件`updateClassComponent`。

```js
function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes,
) {
    //判断是否含有context
  let hasContext;
  if (isLegacyContextProvider(Component)) {
    hasContext = true;
    pushLegacyContextProvider(workInProgress);
  } else {
    hasContext = false;
  }
  prepareToReadContext(workInProgress, renderLanes);
  // 获取instance
  const instance = workInProgress.stateNode;
  let shouldUpdate;
  if (instance === null) {
    if (current !== null) {
     //没有实例的类组件只有在挂起时才会挂载
      current.alternate = null;
      workInProgress.alternate = null;
      workInProgress.flags |= Placement;
    }
    // 初始化的情况下需要实例化
    constructClassInstance(workInProgress, Component, nextProps);
    // 调用生命周期beginWork阶段
    mountClassInstance(workInProgress, Component, nextProps, renderLanes);
    shouldUpdate = true;
  } else if (current === null) {
    // 在已经instance实例化的基础上，处理context，props，和state
    shouldUpdate = resumeMountClassInstance(
      workInProgress,
      Component,
      nextProps,
      renderLanes,
    );
  } else {
    shouldUpdate = updateClassInstance(
      current,
      workInProgress,
      Component,
      nextProps,
      renderLanes,
    );
  }
  
  const nextUnitOfWork = finishClassComponent(
    current,
    workInProgress,
    Component,
    shouldUpdate,
    hasContext,
    renderLanes,
  );

  return nextUnitOfWork;
}
```

判断`instance === null`不存在时，说明组件并未实例话，`workInProgress.stateNode`为null，调用`constructClassInstance`，进行实例化组件，如下：

```js
constructClassInstance() {
//...
// 实例化类组件和状态
  const instance = new ctor(props, context);
  const state = (workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined
      ? instance.state
      : null);//传入state
      // 设置实例instance到workInProgress.stateNode，并且在instance上挂载workInProgress
  //并将instace赋值workInProgress.stateNode。
  adoptClassInstance(workInProgress, instance);//采用类实例
  //...
}
```
通过判断`current=== null`，判断该组件处于`mount`阶段。

通过调用`resumeMountClassInstance`函数，执行生命周期。


调用`componentWillReceiveProps` 函数和`UNSAFE_componentWillReceiveProps`函数，最后返回`false`。


设置`shouldUpdate = false`

当处于`update`状态时，调用`updateClassInstance`函数，处理`props`，`state`，和`context`。
```js
function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderLanes: Lanes,
): boolean {
  const instance = workInProgress.stateNode;

  cloneUpdateQueue(current, workInProgress);
   // 处理props
  const unresolvedOldProps = workInProgress.memoizedProps;
  const oldProps =
    workInProgress.type === workInProgress.elementType
      ? unresolvedOldProps
      : resolveDefaultProps(workInProgress.type, unresolvedOldProps);
  instance.props = oldProps;
  const unresolvedNewProps = workInProgress.pendingProps;
// 处理context
  const oldContext = instance.context;
  const contextType = ctor.contextType;
  let nextContext = emptyContextObject;
  if (typeof contextType === 'object' && contextType !== null) {
    nextContext = readContext(contextType);
  } else if (!disableLegacyContext) {
    const nextUnmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    nextContext = getMaskedContext(workInProgress, nextUnmaskedContext);
  }
//调用生命周期
  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
  const hasNewLifecycles =
    typeof getDerivedStateFromProps === 'function' ||
    typeof instance.getSnapshotBeforeUpdate === 'function';

  if (
    !hasNewLifecycles &&
    (typeof instance.UNSAFE_componentWillReceiveProps === 'function' ||
      typeof instance.componentWillReceiveProps === 'function')
  ) {
    if (
      unresolvedOldProps !== unresolvedNewProps ||
      oldContext !== nextContext
    ) {
    // 调用ComponentWillReceiveProps生命周期
      callComponentWillReceiveProps(
        workInProgress,
        instance,
        newProps,
        nextContext,
      );
    }
  }

//...
  const oldState = workInProgress.memoizedState;
  let newState = (instance.state = oldState);
  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  newState = workInProgress.memoizedState;
// ....
    // 调用生命周期返回getDerivedStateFromProps,静态类
  if (typeof getDerivedStateFromProps === 'function') {
  // 该函数返回partialState。
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps,
    );
    newState = workInProgress.memoizedState;
  }

  // 判断是否需要更新
  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState,
      nextContext,
    ) ||
    (enableLazyContextPropagation &&
      current !== null &&
      current.dependencies !== null &&
      checkIfContextChanged(current.dependencies));

  if (shouldUpdate) {
  // 调用生命周期，componentWillUpdate、和即将失效的componentWillUpdate和兼容版本UNSAFE_componentWillUpdate
    if (
      !hasNewLifecycles &&
      (typeof instance.UNSAFE_componentWillUpdate === 'function' ||
        typeof instance.componentWillUpdate === 'function')
    ) {
      if (typeof instance.componentWillUpdate === 'function') {
        instance.componentWillUpdate(newProps, newState, nextContext);
      }
      if (typeof instance.UNSAFE_componentWillUpdate === 'function') {
        instance.UNSAFE_componentWillUpdate(newProps, newState, nextContext);
      }
    }
    // ...
  } else {

    //...
    //赋值新旧Props和state
    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
  }
  // if shouldComponentUpdate returns false.
  instance.props = newProps;
  instance.state = newState;
  instance.context = nextContext;

  return shouldUpdate;
}
```
处理新旧`props`和`state`和`context`，调用生命周期，最后将赋值新的值给`instance`。

```js
  instance.props = newProps;
  instance.state = newState;
  instance.context = nextContext;
```

最后调用`finishClassComponent`函数。`finishClassComponent`函数判断`!shouldUpdate && !didCaptureError`，该值如果为true，调用`bailoutOnAlreadyFinishedWork`函数，克隆`cloneChildFibers`，返回`workInProgress.child`。
```js
export function cloneChildFibers(
  current: Fiber | null,
  workInProgress: Fiber,
): void {

  if (workInProgress.child === null) {
    return;
  }
  // 复用
  let currentChild = workInProgress.child;
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  workInProgress.child = newChild;

  newChild.return = workInProgress;
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps,
    );
    newChild.return = workInProgress;
  }
  newChild.sibling = null;
}
```

### 下一篇 completeWork阶段。

[React技术揭秘](https://react.iamkasong.com/process/beginWork.html)

[React源码解析](https://react.jokcy.me/book/flow/begin-work.html)







