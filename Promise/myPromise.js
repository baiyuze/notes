 

// 1. 术语
// promise是一个包含了兼容promise规范then方法的对象或函数，
// thenable 是一个包含了then方法的对象或函数。
// value 是任何Javascript值。 (包括 undefined, thenable, promise等).
// exception 是由throw表达式抛出来的值。
// reason 是一个用于描述Promise被拒绝原因的值。

// 要求
// 2 Promise状态
// 一个Promise必须处在其中之一的状态：pending, fulfilled 或 rejected.

// 如果是pending状态,则promise：

// 可以转换到fulfilled或rejected状态。
// 如果是fulfilled状态,则promise：

// 不能转换成任何其它状态。
// 必须有一个值，且这个值不能被改变。
// 如果是rejected状态,则promise可以：

// 不能转换成任何其它状态。
// 必须有一个原因，且这个值不能被改变。
// ”值不能被改变”指的是其identity不能被改变，而不是指其成员内容不能被改变。
// x 是then中的回调函数的返回值。可能的值为Promise，value， 和undefined。
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

function MyPromise(callback) {

  let that = this;
  //定义初始状态
  //Promise状态
  that.status = 'pending';
  //value
  that.value = '1';
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
      that.status = 'fulfilled';
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

// 定义then
// 一个promise必须有一个then方法，then方法接受两个参数：
// promise.then(onFulfilled,onRejected)
//观察者模式解决异步调用问题

// 如果onFulfilled是一个函数:
// 它必须在promise fulfilled后调用， 且promise的value为其第一个参数。
// 它不能在promise fulfilled前调用。
// 不能被多次调用。

// 如果onRejected是一个函数,
// 它必须在promise rejected后调用， 且promise的reason为其第一个参数。
// 它不能在promise rejected前调用。
// 不能被多次调用。
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
          let x = onFulfilled(value);
          resolvePromise(promise2, x, resolve, reject)
        } catch(e) {
          return reject(e)
        }
      });

      // that.onFullfilledArray.push((reason) => {
      //   onFulfilled(reason);
      // });

      // that.onRejectedArray.push((reason) => {
      //   onRejected(reason);
      // });

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
      
      // try {
      //   let x = onFulfilled(that.value);
      //   //判断onFulfilled是否是一个Promise，如果是，那么就直接把MyPromise中的resolve和reject传给then;
      //   //返回值是一个Promise对象，直接取它的结果做为promise2的结果
      //   if(x instanceof MyPromise) {
      //     x.then(resolve, reject);
      //   }
      //   //否则，以它的返回值做为promise2的结果
      //   resolve(x);
      // } catch (error) {
      //   reject(error);
      // }
      
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

module.exports = MyPromise;

// 如果没有异步，此时status状态肯定为三种状态之一，一般为resolved，反之，为pending。

// 测试
// new MyPromise((resolve, reject) => {
//   setTimeout(() => {
//     resolve(1);
//   }, 1000)
// }).then((data) => {
//   console.log(data);
//   return new Promise((res) => {
//     setTimeout(() => {
//       res(2);
//     },1000)
//   })


// }).then((res) => {
//   console.log(res);
// })