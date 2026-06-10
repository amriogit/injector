# @amrio/injector

轻量 DI（依赖注入）容器。零外部依赖，可在 Node.js、浏览器、SSR 中运行。

## 安装

```bash
npm install @amrio/injector
```

## 使用

### 核心 DI

```ts
import { Injector, BaseService, InjectionToken } from '@amrio/injector'

// 定义 Service
class Logger extends BaseService {
  log = (msg: string) => console.log(msg)
}

class UserService extends BaseService {
  private logger = this.$inject(Logger)  // 声明依赖
  private db = this.$inject(DB_POOL)     // InjectionToken 也支持

  state = reactive({ users: [] as User[] })

  onInit() {
    // 依赖已就绪，做初始化
  }

  fetchUsers = async () => { /* ... */ }
}

// 创建容器
const injector = new Injector()

// 覆写实现
injector.provide(Logger, MockLogger)

// 获取实例（自动实例化 + 单例）
const userService = injector.inject(UserService)
```

### Vue 3 集成

```ts
import { createApp } from 'vue'
import { ServicePlugin, useInject, useProvide } from '@amrio/injector/vue'

// 安装插件
createApp(App)
  .use(ServicePlugin)
  .mount('#app')

// 组件中注入 Service
const userService = useInject(UserService)

// 为子树覆写实现
useProvide(UserService, MockUserService)
```

## 特性

- **零依赖** — 纯 TypeScript，无运行时依赖
- **无全局单例** — 每个应用/请求创建独立 Injector
- **自动实例化** — 类 token 首次 `inject()` 时自动创建，无需手动注册
- **类型安全** — `provide()` 函数重载在编译期防止错误的实现类型
- **InjectionToken** — 为非类注入（配置、缓存等）提供类型安全
- **生命周期** — `onInit()` 钩子在依赖就绪后调用
- **SSR 兼容** — 无 DOM 依赖，InjectionToken 可序列化

## 测试

```bash
npm test
```
