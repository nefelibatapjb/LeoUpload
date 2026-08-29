# @leoupload/core

## 0.2.0

### Minor Changes

- 0.2.0：网络状态感知、五个框架官方封装、五种后端演示、完整测试与文档

  - **core**: 新增 `autoResumeOnReconnect` 配置（默认开启）——监听 window online/offline 事件，断网自动暂停、联网自动续传；新增 `offline` / `online` 事件；修复 error 事件重复触发两次的问题
  - **svelte / solid / angular**: 新增官方封装（store composable + 插槽组件 / signal primitive + render-props 组件 / signals service + `<leo-upload>` standalone 组件），API 与 Vue/React 封装对齐
  - **vue**: 修复 LeoUpload.vue 中 status/progress Ref 未解包导致的类型错误
  - 补充 26 个核心单元测试、Svelte/Solid/Angular 示例页面、Node.js/Python/Go/Java/Rust 五种后端演示、事件与协议字段文档
