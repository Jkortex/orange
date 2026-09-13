---
title: TDD 基础
date: 2026-09-14
name: tdd-basics
version: 1.0.0
author: Orange
category: workflow
tags: [testing]
description: 写代码先写测试时查阅：红-绿-重构循环的触发条件与断言约定。
---

# TDD 基础

先写失败的测试，再写最少的实现让它通过，最后清理重复。

## 红

测试定义行为边界：正常渲染与异常渲染各至少一例。

## 绿

一次只让一个测试通过；不写测试之外的功能。

## 重构

全绿后提炼重复，以测试为安全网。
