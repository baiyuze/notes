## 前言
相信大家经常使用`Promise`，或者使用`Generator`、`asnyc/await`等异步解决方案，网上的`Promise`原理也遍地开花。  
一直以来想抽出时间也写一写`Promise`实现，但是平常工作也是忙的不可开交，正好元旦放了3天假期，休息了2天半，抽出半天时间来看一看`Promise`。
## 如何使用Promise
```
new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve(1);
  }, 1000)
}).then((data) => {
  console.log(data);
  return new Promise((res) => {
    setTimeout(() => {
      res(2);
    },1000)
  })

}).then((res) => {
  console.log(res);
})

```
## 术语

* `Promise`是一个包含了兼容`promise`规范`then`方法的对象或函数。  
* `thenable` 是一个包含了`then`方法的对象或函数。   
* `value` 是任何`Javascript`值。 (包括 `undefined`, `thenable`, `Promise`等)。   
* `exception` 是由`throw`表达式抛出来的值。   
* `reason` 是一个用于描述`Promise`被拒绝原因的值。

**由于`Promise/A+`规范并不包括`catch`、`race`、`all`等方法的实现，所以这里也不会去详细解释。**

## 要求

一个`Promise`必须处在其中之一的状态：`pending`, `fulfilled` 或 `rejected`。
如果是`pending`状态,则`promise`：

可以转换到`fulfilled`或`rejected`状态。
如果是`fulfilled`状态,则`promise`：

* 不能转换成任何其它状态。
* 必须有一个值，且这个值不能被改变。  

如果是`rejected`状态,则`promise`可以：

* 不能转换成任何其它状态。
* 必须有一个原因，且这个值不能被改变。

```javascript
function MyPromise(callback) {

  let that = this;
  //定义初始状态
  //Promise状态
  that.status = 'pending';
  //value
  that.value = 'undefined';
  //reason 是一个用于描述Promise被拒绝原因的值。
  that.reason = 'undefined';

  //定义resolve
  function resolve(value) {
    //当status为pending时，定义Javascript值，定义其状态为fulfilled
    if(that.status === 'pending') {
      that.value = value;
      that.status = 'resolved';
    }
  }

  //定义reject
  function reject(reason) {
    //当status为pending时，定义reason值，定义其状态为rejected
    if(that.status === 'pending') {
      that.reason = reason;
      that.status = 'rejected';
    }
  }

  //捕获callback是否报错
  try {
    callback(resolve, reject);
  } catch (error) {
    reject(error);
  }
}
```
`Promise`对象有一个`then`方法，用来注册在这个`Promise`状态确定后的回调，`then`方法接受两个参数：
`Promise.then(onFulfilled,onRejected)`。
`我们把then函数写在原型上`。

```javascript
MyPromise.prototype.then = function(onFulfilled, onRejected) {
  let that = this;

  if(that.status === 'resolved') {
    onFulfilled(that.value);
  }

  if(that.status === 'rejected') {
    onRejected(that.reason);
  }
}
```
上述代码只是实现了`Promise的`最基本逻辑，如果直接调用`then`是可以执行的，但是并不支持异步，而`Promise`最大的特点就是解决`callback`异步回调地狱的问题。  
所以我们来改造下。
```javascript
function MyPromise(callback) {

  let that = this;
  //定义初始状态
  //Promise状态
  that.status = 'pending';
  //value
  that.value = 'undefined';
  //reason 是一个用于描述Promise被拒绝原因的值。
  that.reason = 'undefined';
  //用来解决异步问题的数组
  that.onFullfilledArray = [];
  that.onRejectedArray = [];

  //定义resolve
  function resolve(value) {
    //当status为pending时，定义Javascript值，定义其状态为fulfilled
    if(that.status === 'pending') {
      that.value = value;
      that.status = 'resolved';
      that.onFullfilledArray.forEach((func) => {
        func(that.value);
      });
    }
  }

  //定义reject
  function reject(reason) {
    //当status为pending时，定义reason值，定义其状态为rejected
    if(that.status === 'pending') {
      that.reason = reason;
      that.status = 'rejected';
      that.onRejectedArray.forEach((func) => {
        func(that.reason);
      });
    }
  }

  //捕获callback是否报错
  try {
    callback(resolve, reject);
  } catch (error) {
    reject(error);
  }
}
```

`then`函数的改造
```javascript
MyPromise.prototype.then = function(onFulfilled, onRejected) {
  let that = this;
  //需要修改下，解决异步问题，即当Promise调用resolve之后再调用then执行onFulfilled(that.value)。
  //用两个数组保存下onFulfilledArray
  if(that.status === 'pending') {
    that.onFullfilledArray.push((value) => {
      onFulfilled(value);
    });

    that.onRejectedArray.push((reason) => {
      onRejected(reason);
    });
  }

  if(that.status === 'resolved') {
    onFulfilled(that.value);
  }

  if(that.status === 'rejected') {
    onRejected(that.reason);
  }
}
```
由于`Promise/A+`规范规定一个`Promise`必须处在其中之一的状态：`pending`, `fulfilled` 或 `rejected`，所以在用户使用`Promise`时，写的是异步代码的话，那么此时`Promise`一定是处于`pending`状态，反之正常调用。  
因此，初始化`Promise`时，定义两个数组为`onFullfilledArray`，`onRejectedArray`，用来保存`then`函数的两个回调函数`onFulfilled`和`onRejected`。同时我们在`then`函数中判断`status`是否是`pending`，然后将`onFulfilled`和`onRejected`分别传入对应数组中。当用户调用`resolve`或`reject`时，更改状态，遍历数组，执行`onFulfilled`或者`onRejected`,从而异步调用。  

## then函数的链式调用
在`Promise/A+`规范中：    

**对于一个promise，它的then方法可以调用多次**
* 当`promise` `fulfilled`后，所有`onFulfilled`都必须按照其注册顺序执行。
* 当`promise` `rejected`后，所有`OnRejected`都必须按照其注册顺序执行。  

**then 必须返回一个promise**

* 如果`onFulfilled` 或 `onRejected` 返回了值`x`, 则执行`Promise` 解析流程`[[Resolve]](promise2, x)`。
* 如果`onFulfilled` 或 `onRejected`抛出了异常`e`, 则`promise2`应当以`e`为`reason`被拒绝。
* 如果 `onFulfilled` 不是一个函数且`promise1`已经`fulfilled`，则`promise2`必须以`promise1`的值`fulfilled`。
* 如果`OnReject` 不是一个函数且`promise1`已经`rejected`, 则`promise2`必须以相同的`reason`被拒绝。


```js
MyPromise.prototype.then = function(onFulfilled, onRejected) {
  let that = this;
  let promise2;

  // 根据标准，如果then的参数不是function，则我们需要忽略它
  onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : function(f) {};
  onRejected = typeof onRejected === 'function' ? onRejected : function(r) {};
  //需要修改下，解决异步问题，即当Promise调用resolve之后再调用then执行onFulfilled(that.value)。
  //用两个数组保存下onFulfilledArray
  if(that.status === 'pending') {

    return promise2 = new Promise(function(resolve, reject) {
      that.onFullfilledArray.push((value) => {
      try {
        let x = onFulfilled(that.value);
        //判断onFulfilled是否是一个Promise，如果是，那么就直接把MyPromise中的resolve和reject传给then;
        //返回值是一个Promise对象，直接取它的结果做为promise2的结果
        if(x instanceof MyPromise) {
          x.then(resolve, reject);
        }
        //否则，以它的返回值做为promise2的结果
        resolve(x);
      } catch (error) {
        reject(error);
      }
      });

      that.onRejectedArray.push((value) => {
          try {
            let x = onRejected(that.value);
            //判断onRejected是否是一个Promise，如果是，那么就直接把MyPromise中的resolve和reject传给then;
            //返回值是一个Promise对象，直接取它的结果做为promise2的结果
            if(x instanceof MyPromise) {
              x.then(resolve, reject);
            }
            //否则，以它的返回值做为promise2的结果
            resolve(x);
          } catch (error) {
            reject(error);
          }
      });

    })
  }

  if(that.status === 'fulfilled') {
    return promise2 = new MyPromise(function(resolve, reject) {
      try {
        let x = onFulfilled(that.value);
        //判断onFulfilled是否是一个Promise，如果是，那么就直接把MyPromise中的resolve和reject传给then;
        //返回值是一个Promise对象，直接取它的结果做为promise2的结果
        if(x instanceof MyPromise) {
          x.then(resolve, reject);
        }
        //否则，以它的返回值做为promise2的结果
        resolve(x);
      } catch (error) {
        reject(error);
      }
      
    })
  }

  if(that.status === 'rejected') {
    return new MyPromise(function(resolve, reject) {
      try {
        let x = onRejected(that.value);
        //判断onRejected是否是一个Promise，如果是，那么就直接把MyPromise中的resolve和reject传给then;
        //返回值是一个Promise对象，直接取它的结果做为promise2的结果
        if(x instanceof MyPromise) {
          x.then(resolve, reject);
        }
        //否则，以它的返回值做为promise2的结果
        resolve(x);
      } catch (error) {
        reject(error);
      }
      
    })
    
  }
}

```

在调用`then`时，判断`onFulfilled`和`onRejected`是否是一个函数，如果不是，返回一个匿名函数，同时必须返回各参数的值,用来解决链式调用时`Promise`值的穿透问题。  
例如：
```js
new MyPromise(resolve=>resolve(8))
  .then()
  .then()
  .then(function foo(value) {
    alert(value)
  })
```

所以我们把这块改成这样：

```js
  onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : function(f) { return f};
  onRejected = typeof onRejected === 'function' ? onRejected : function(r) {throw r};
```

但是这样每次判断都需要重新写这个`x`和`MyPromise`的关系，所以，我们需要将这块代码给抽象出来，这块代码在`Promise/A+`规范中叫做`resolvePromise`。

```js
function resolvePromise(promise, x, resolve, reject) {
  let then,thenCalledOrThrow = false
  //如果promise 和 x 指向相同的值, 使用 TypeError做为原因将promise拒绝。
  if (promise === x) {
    return reject(new TypeError('Chaining cycle detected for promise!'))
  }

  //判断x是否是一个Promise，如果是，那么就直接把MyPromise中的resolve和reject传给then;
  //返回值是一个Promise对象，直接取它的结果做为promise2的结果
  if ((x !== null) && ((typeof x === 'object') || (typeof x === 'function'))) {
    try {
      then = x.then
      if (typeof then === 'function') { // typeof 

        //x.then(resolve, reject);
        then.call(x, function rs(y) {

          if (thenCalledOrThrow) return

          thenCalledOrThrow = true

          return resolvePromise(promise, y, resolve, reject)

        }, function rj(r) {

          if (thenCalledOrThrow) return

          thenCalledOrThrow = true

          return reject(r)

        })
      } else {

        return resolve(x)
      }
    } catch(e) {
      if (thenCalledOrThrow) return

      thenCalledOrThrow = true

      return reject(e)
    }
  } else {

    return resolve(x)
  }

}
```

`then`函数最后修改为：

```js
MyPromise.prototype.then = function(onFulfilled, onRejected) {
  let that = this;
  let promise2;
  // 根据标准，如果then的参数不是function，则我们需要忽略它
  onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : function(f) { return f};
  onRejected = typeof onRejected === 'function' ? onRejected : function(r) {throw r};
  //需要修改下，解决异步问题，即当Promise调用resolve之后再调用then执行onFulfilled(that.value)。
  //用两个数组保存下onFulfilledArray
  if(that.status === 'pending') {
    return promise2 = new Promise(function(resolve, reject) {
      that.onFullfilledArray.push((value) => {
        try {
          let x = onFulfilled(value);
          resolvePromise(promise2, x, resolve, reject)
        } catch(e) {
          return reject(e)
        }
      });
      
      that.onRejectedArray.push((value) => {
        try {
          let x = onRejected(value);
          resolvePromise(promise2, x, resolve, reject)
        } catch(e) {
          return reject(e)
        }
      });
    })
  }

  if(that.status === 'fulfilled') {
    return promise2 = new MyPromise(function(resolve, reject) {
      try {
        let x = onFulfilled(that.value);
        //处理then的多种情况
        resolvePromise(promise2, x, resolve, reject)
      } catch (error) {
        reject(error);
      }
    })
  }

  if(that.status === 'rejected') {
    return new MyPromise(function(resolve, reject) {
      try {
        let x = onRejected(that.value);
        //处理then的多种情况
        resolvePromise(promise2, x, resolve, reject);
      } catch (error) {
        reject(error)
      }
      
    })
    
  }
}
```

测试一下：
```js
new MyPromise((resolve, reject) => {
  setTimeout(() => {
    resolve(1);
  }, 1000)
}).then((data) => {
  console.log(data);
  return new MyPromise((res) => {
    setTimeout(() => {
      res(2);
    },1000)
  })
}).then((res) => {
  console.log(res);
})
//1
//2
```

## 最后

[Promise GITHUB地址](https://github.com/baiyuze/notes/blob/master/Promise/myPromise.js)。  
参考资料：  

[《实现一个完美符合Promise/A+规范的Promise》](https://juejin.im/post/5b3994eff265da596e4cf325)  
[《Promise/A+规范》](https://segmentfault.com/a/1190000002452115)  
[《Promise3》](https://github.com/xieranmaya/Promise3/blob/master/Promise3.js)  
[《剖析Promise内部结构，一步一步实现一个完整的、能通过所有Test case的Promise类》](https://github.com/xieranmaya/blog/issues/3)




