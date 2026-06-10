# @amriogit/injector

轻量 DI（依赖注入）容器。零外部依赖，可在 Node.js、浏览器、SSR 中运行。

## 安装

```bash
npm install @amriogit/injector
```

## 使用

### 核心 DI

```ts
import { Injector, BaseService, InjectionToken } from '@amriogit/injector'

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
import { ServicePlugin, useInject, useProvide } from '@amriogit/injector/vue'

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

## 生命周期

### onInit — 初始化

`onInit()` 在 Service 构造完成、所有 `$inject()` 依赖就绪后自动调用。不要在构造函数中做初始化逻辑。

```ts
import { BaseService } from '@amriogit/injector'

class TimerService extends BaseService {
  private logger = this.$inject(LoggerService)
  private intervalId?: ReturnType<typeof setInterval>

  state = reactive({ ticks: 0 })

  onInit() {
    // 依赖已就绪，可以安全使用 this.logger
    this.intervalId = setInterval(() => {
      this.state.ticks++
      this.logger.log(`tick ${this.state.ticks}`)
    }, 1000)
  }
}
```

### onDestroy — 清理

`onDestroy()` 在 Service 被销毁时调用，用于清理定时器、取消订阅、关闭连接等。

触发方式：

- **`injector.destroy(Token)`** — 销毁指定 Service 实例
- **`injector.reset()`** — 销毁所有 Service 实例

```ts
import { BaseService, Injector, InjectionToken } from '@amriogit/injector'

// WebSocket 连接示例
class ConnectionService extends BaseService {
  private ws?: WebSocket

  connect = (url: string) => {
    this.ws = new WebSocket(url)
  }

  onDestroy() {
    this.ws?.close()
    this.ws = undefined
  }
}

// 定时器清理示例
class PollingService extends BaseService {
  private timer?: ReturnType<typeof setInterval>

  onInit() {
    this.timer = setInterval(() => this.poll(), 5000)
  }

  private poll = () => { /* ... */ }

  onDestroy() {
    clearInterval(this.timer)
  }
}

const injector = new Injector()

const polling = injector.inject(PollingService)

// 需要替换实现时，先销毁旧实例
injector.destroy(PollingService)
// polling.onDestroy() 已调用，定时器已清理
// 下次 inject(PollingService) 返回新实例

// 或者一次性清理所有
injector.reset()
```

`onDestroy` 与 `onInit` 配对使用，确保 Service 的资源生命周期可管理，防止内存泄漏。

## 测试

```bash
npm test
```
