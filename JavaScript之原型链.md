## 前言

> 距离上次写文章，时隔一年。此次的目的，整理文章，强化记忆，为以后巩固留下笔记。

## 构造函数

构造函数与其他函数的唯一区别，就在于他们调用的方式不同。

任何函数只要通过`new`操作符来调用，那他就可以称之为**构造函数**。

下面来创建一个构造函数：

```js

function Animal() {
}

var animal = new Animal();

console.log(animal.name); // undefined

```

上述代码中，我们通过`new`操作符创建了一个实例对象animal。

```js
Animal.prototype.name = 'jerry';

var animal1 = new Animal();
var animal2 = new Animal();
console.log(animal1.name,animal2.name);// jerry,jerry
```
## 原型

什么是原型？

我们创建的每一个函数，都有一个`prototype`属性，这个属性是一个指针，指向一个对象，而这个对象的用途是包含可以由特定类型的所有实例共享的属性和方法。

简单来说，就是通过构造函数而创建的那个对象实例的`原型对象`。


![](https://user-gold-cdn.xitu.io/2020/2/23/17070eb7c472f4d4?w=1000&h=434&f=png&s=290082)

## __ proto __

```js

Animal.prototype.name = 'jerry';

console.log(animal.name); // 'jerry';

```
上述代码中，我们对`prototype`进行赋值，打印`animal`得到`jerry`。

那么`animal`和`Animal`是什么关系呢？

```js
console.log(animal.__proto__ === Animal.prototype)// true
```
从而我们可以得知下图关系


![](https://user-gold-cdn.xitu.io/2020/2/23/17070f23099965de?w=1000&h=440&f=png&s=311110)

为什么我们没有给animal.name 进行赋值，也能得到值呢？

```js

Animal.prototype.name = 'jerry';

animal.name = 'tom';

console.log(animal.name); // 'tom';

delete animal.name;

console.log(animal.name);//jerry;

```

当我们给`animal.name`进行赋值，得到tom，当我们删除了`animal.name`，得到了jerry。

它们之间是不是还含有更深的关联关系呢。

```js

Animal.prototype.name = 'jerry';
Object.prototype.name = 'person';
animal.name = 'tom';

console.log(animal.name); // 'tom';

delete animal.name;

console.log(animal.name);//jerry;

delete Animal.prototype.name;

console.log(animal.name);//person;

```

## 原型的原型

```js
console.log(animal.__proto__.__proto__ === Object.prototype);//true
```
由此我们可以得知为什么当没有对animal进行赋值时，同样可以获取到值。
这里通过一层一层的隐式原型去查找`animal.name`返回，否则返回`undefined`。

![](https://user-gold-cdn.xitu.io/2020/2/23/1707105ddb7989fe?w=1000&h=676&f=png&s=968140)

## constructor

现在我们已经知道Animal的原型是Animal的原型对象，那我们可以从原型对像中得到其构造函数吗？

```js

console.log(Animal.prototype.constructor === Animal);//true

console.log(Object.prototype.constructor === Object) //true

```
由于构造函数都可以通过new得到多个实例对象，所以只能通过`constructor`得到构造函数，无法获取其他实例对象，因此我们来补充其关系图。

![](https://user-gold-cdn.xitu.io/2020/2/23/170710b200930544?w=1000&h=684&f=png&s=644692)

## 原型链

此时我们已经知道了Object的原型是Object.prototype的原型对象，那么，Object.prototype的隐式原型__proto__是什么？
```js
Object.prototype.__proto__ === null //true
```
现在我们已经可以总结出原型链的具体关系了。

![](https://user-gold-cdn.xitu.io/2020/2/23/170711108f36461e?w=1000&h=892&f=png&s=1363113)

上图的红色线条所关联的链路就是**原型链**

## 相关资料
《JavaScript高级程序设计》

[《JavaScript深入之从原型到原型链
》](https://github.com/mqyqingfeng/Blog/issues/2)





