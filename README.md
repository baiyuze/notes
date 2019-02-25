# 博客

## 写博客的初衷

自从上班以来，陆陆续续发生很多事，成长了很多。我一直也没有记录笔记的习惯，总觉得写着用处不大，有需要用到的东西，直接搜索就能解决问题。但是，到18年的6月份的求职，我才发现，一份好的简历也许能为自己瑞色不少，也就想着自己也做一些开源项目吧。

## 开源项目  


自7月中旬开始，我往`github`正式提交了第一份前端开发模板[`egg-dva`](https://github.com/baiyuze),后面又陆续提交了[`mobile-app-tamplate`](https://github.com/baiyuze/mobile-app-tamplate)、[`pc-app-tamplate`](https://github.com/baiyuze/pc-app-tamplate)、[`egg-ssr-mobile-react`](https://github.com/baiyuze/egg-ssr-mobile-react)、[`easywebpack-template-pc`](https://github.com/baiyuze/easywebpack-template-pc)、[`pc-react-tamplate`](https://github.com/baiyuze/pc-react-tamplate)，后来提的模板越来越多，就有了整合这些模板的心思，把他们做成一个脚手架，直接在命令行里选择某种模板，拉下来就能开发。  
后来由于一些事耽误了，也就搁置了。

## 版本控制系统

这个项目也是一拍脑袋就做的项目，从一开始的需求分析，后面的技术评估，再到前端页面的搭建，后端服务`Node`和`MongoDB`的使用，林林总总利用闲暇时间花了近三个月的时间，中间也遇到了一些困难，比如一开始使用的后端服务框架是`Egg`，但是最后部署的时候，总会提示`don't fork work`，项目没法继续下去，只能换框架，采用`Koa`来进行搭建，重新改造了后端架构，终于完成了第一版的[`version-control-system`](https://github.com/baiyuze/version-control-system)，后来发现，此类部署只能一次部署一个系统，缺陷太大，需要重新整改，需要重新去找一个合理的技术方案。

## 博客

写第一篇博客是在掘金，分享了第一篇文章[骚年，koa和webpack了解一下.md](https://github.com/baiyuze/notes/blob/master/骚年，koa和webpack了解一下.md)，看着一个个点赞，自己心中还是小有成就的，毕竟每写一篇文章，就得花费自己好几天的时间去寻找答案，归纳总结，才能汇总成一篇文章。可能一篇文章只是寥寥的近3000字，也是付出了极大的心血。  

第二篇文章是讲服务器的，[如何创建一个可靠稳定的Web服务器](https://github.com/baiyuze/notes/blob/master/如何创建一个可靠稳定的Web服务器.md)，这篇文章花费了5个晚上，每个晚上都到2点多，自己抱着《NodeJs深入浅出》一遍一遍的看，涉及建立服务器，就和进程挂钩，之前对于进程也是一知半解，通过这次学习，极大了解服务器的机制，短短的一篇文章2000多字，写的也只是我学习内容的1/5。

这里汇总下文章。

### NODE相关

* [骚年，koa和webpack了解一下](https://github.com/baiyuze/notes/blob/master/骚年，koa和webpack了解一下.md)
* [如何创建一个可靠稳定的Web服务器](https://github.com/baiyuze/notes/blob/master/如何创建一个可靠稳定的Web服务器.md)
* [从源码上理解express中间件](https://github.com/baiyuze/notes/blob/master/从源码上理解express中间件.md)
* [Koa上下文Context的数据劫持](https://github.com/baiyuze/notes/blob/master/Koa上下文Context的数据劫持.md)

### 浏览器相关

* [浏览器地址栏里输入URL后的全过程](https://github.com/baiyuze/notes/blob/master/浏览器地址栏里输入URL后的全过程.md)
* [浏览器渲染原理（处理重排和重绘）](https://github.com/baiyuze/notes/blob/master/浏览器渲染原理（处理重排和重绘）.md)

### 前端相关

* [Promise/A+规范](https://github.com/baiyuze/notes/tree/master/Promise)
* [一次弄懂Event Loop（彻底解决此类面试问题）](https://github.com/baiyuze/notes/blob/master/%E4%B8%80%E6%AC%A1%E5%BC%84%E6%87%82Event%20Loop%EF%BC%88%E5%BD%BB%E5%BA%95%E8%A7%A3%E5%86%B3%E6%AD%A4%E7%B1%BB%E9%9D%A2%E8%AF%95%E9%97%AE%E9%A2%98%EF%BC%89.md)
* [原来我正则表达式会的这么少](https://github.com/baiyuze/notes/blob/master/%E5%8E%9F%E6%9D%A5%E6%AD%A3%E5%88%99%E8%A1%A8%E8%BE%BE%E5%BC%8F%E6%88%91%E8%AE%B0%E5%BE%97%E8%BF%99%E4%B9%88%E5%B0%91.md)
* [从零开始React服务器渲染（SSR）同构😏（基于Koa）](https://github.com/baiyuze/notes/blob/master/%E4%BB%8E%E9%9B%B6%E5%BC%80%E5%A7%8BReact%E6%9C%8D%E5%8A%A1%E5%99%A8%E6%B8%B2%E6%9F%93%EF%BC%88SSR%EF%BC%89%E5%90%8C%E6%9E%84%F0%9F%98%8F%EF%BC%88%E5%9F%BA%E4%BA%8EKoa%EF%BC%89.md)

## 写在最后

从写文章到现在也过去了大概一个月半的时间，每周至少输出一篇文章，从一开始只是为了写文章而写文章，到现在为了提升个人能力而写文章，我想我应该会坚持下去的。  

愿我出走半生，归来仍是少年！

2019年，记录点点滴滴。

