 

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

// 定义then
// 一个promise必须有一个then方法，then方法接受两个参数：
// promise.then(onFulfilled,onRejected)
//观察者模式解决异步调用问题
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

// 如果没有异步，此时status状态肯定为三种状态之一，一般为resolved，反之，为pending。

// 测试
new MyPromise((resolve, reject) => {
  setTimeout(() => {
    resolve(1);
  }, 1000)
}).then((data) => {
  console.log(data);
})