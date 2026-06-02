import { describe, it, expect, beforeEach } from 'vitest'
import { Injector, InjectionToken, BaseService } from '../src/injector'

// ---------------------------------------------------------------------------
// 测试用的 Service 类
// ---------------------------------------------------------------------------

class EmptyService extends BaseService {}

class SimpleService extends BaseService {
  value = 'hello'
  initOrder = 0

  onInit() {
    this.initOrder = 1
  }
}

class DependentService extends BaseService {
  simple = this.$inject(SimpleService)
}

class ServiceWithOnInit extends BaseService {
  initCalled = false

  onInit() {
    this.initCalled = true
  }
}

/** 继承 SimpleService 的 Mock */
class MockSimpleService extends SimpleService {
  value = 'mock'
}

/** 不继承 BaseService 的普通类 */
class PlainClass {
  injector: Injector
  constructor(injector: Injector) {
    this.injector = injector
  }
  greet = () => 'plain'
}

// ---------------------------------------------------------------------------
// InjectionToken 定义
// ---------------------------------------------------------------------------

const STRING_TOKEN = new InjectionToken<string>('STRING_TOKEN')
const NUM_TOKEN = new InjectionToken<number>('NUM_TOKEN')
const CONFIG_TOKEN = new InjectionToken<{ port: number }>('CONFIG_TOKEN')

/** 带默认工厂的 token */ const CACHE_TOKEN = new InjectionToken<Map<string, string>>('CACHE_TOKEN', () => new Map())

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('Injector', () => {
  let injector: Injector

  beforeEach(() => {
    injector = new Injector()
  })

  describe('inject() — 基础实例化', () => {
    it('返回请求的 Service 实例', () => {
      const svc = injector.inject(SimpleService)
      expect(svc).toBeInstanceOf(SimpleService)
      expect(svc).toBeInstanceOf(BaseService)
    })

    it('无需 provide() 自动实例化', () => {
      const svc = injector.inject(EmptyService)
      expect(svc).toBeInstanceOf(EmptyService)
    })

    it('将 injector 作为构造函数的第一个参数传入', () => {
      const svc = injector.inject(PlainClass)
      expect(svc.injector).toBe(injector)
    })

    it('重复调用返回同一实例（单例）', () => {
      const a = injector.inject(SimpleService)
      const b = injector.inject(SimpleService)
      expect(a).toBe(b)
    })

    it('依赖链中也能共享单例', () => {
      const dep = injector.inject(DependentService)
      expect(dep.simple).toBe(injector.inject(SimpleService))
    })
  })

  describe('provide() — 类 token 覆写', () => {
    it('返回 provided 的实现而非 token 本身', () => {
      injector.provide(SimpleService, MockSimpleService)
      const svc = injector.inject(SimpleService)
      expect(svc).toBeInstanceOf(MockSimpleService)
      expect(svc.value).toBe('mock')
    })

    it('provide() 必须在 inject() 之前调用才生效', () => {
      const original = injector.inject(SimpleService)
      injector.provide(SimpleService, MockSimpleService)
      // 实例已缓存，provide 不再生效
      expect(injector.inject(SimpleService)).toBe(original)
      expect(injector.inject(SimpleService).value).toBe('hello')
    })

    it('多个独立 token 互不干扰', () => {
      class ServiceA extends BaseService { tag = 'a' }
      class ServiceB extends BaseService { tag = 'b' }
      class MockA extends ServiceA { tag = 'mock-a' }

      injector.provide(ServiceA, MockA)
      const a = injector.inject(ServiceA)
      const b = injector.inject(ServiceB)
      expect(a.tag).toBe('mock-a')
      expect(b.tag).toBe('b')
    })
  })

  describe('provide() — InjectionToken', () => {
    it('返回 InjectionToken 对应的值', () => {
      injector.provide(STRING_TOKEN, 'test-value')
      expect(injector.inject(STRING_TOKEN)).toBe('test-value')
    })

    it('支持对象类型的值', () => {
      const config = { port: 4000 }
      injector.provide(CONFIG_TOKEN, config)
      expect(injector.inject(CONFIG_TOKEN)).toBe(config)
      expect(injector.inject(CONFIG_TOKEN).port).toBe(4000)
    })

    it('多个值 token 独立工作', () => {
      injector.provide(STRING_TOKEN, 'hello')
      injector.provide(NUM_TOKEN, 42)
      expect(injector.inject(STRING_TOKEN)).toBe('hello')
      expect(injector.inject(NUM_TOKEN)).toBe(42)
    })
  })

  describe('onInit() 生命周期', () => {
    it('实例化后自动调用 onInit()', () => {
      const svc = injector.inject(ServiceWithOnInit)
      expect(svc.initCalled).toBe(true)
    })

    it('未定义 onInit() 时不会报错', () => {
      const svc = injector.inject(EmptyService)
      expect(svc).toBeInstanceOf(EmptyService)
    })

    it('Mock 的 onInit() 也会被调用', () => {
      class MockWithInit extends ServiceWithOnInit {
        mockOnly = true
      }
      injector.provide(ServiceWithOnInit, MockWithInit)
      const svc = injector.inject(ServiceWithOnInit) as MockWithInit
      expect(svc.initCalled).toBe(true)
      expect(svc.mockOnly).toBe(true)
    })
  })

  describe('$inject() — 服务间依赖', () => {
    it('解析 $inject() 声明的依赖', () => {
      const dep = injector.inject(DependentService)
      expect(dep.simple).toBeInstanceOf(SimpleService)
      expect(dep.simple.value).toBe('hello')
    })

    it('使用覆写后的实现', () => {
      injector.provide(SimpleService, MockSimpleService)
      const dep = injector.inject(DependentService)
      expect(dep.simple.value).toBe('mock')
    })

    it('依赖在不同服务间共享单例', () => {
      class AnotherDependent extends BaseService {
        simple = this.$inject(SimpleService)
      }
      const dep1 = injector.inject(DependentService)
      const dep2 = injector.inject(AnotherDependent)
      expect(dep1.simple).toBe(dep2.simple)
    })
  })

  describe('has()', () => {
    it('provided 的类 token 返回 true', () => {
      injector.provide(SimpleService, MockSimpleService)
      expect(injector.has(SimpleService)).toBe(true)
    })

    it('provided 的 InjectionToken 返回 true', () => {
      injector.provide(STRING_TOKEN, 'x')
      expect(injector.has(STRING_TOKEN)).toBe(true)
    })

    it('未注册的 token 返回 false', () => {
      expect(injector.has(SimpleService)).toBe(false)
      expect(injector.has(STRING_TOKEN)).toBe(false)
    })
  })

  describe('reset()', () => {
    it('清除所有绑定', () => {
      injector.provide(STRING_TOKEN, 'x')
      injector.reset()
      expect(injector.has(STRING_TOKEN)).toBe(false)
    })

    it('清除缓存的实例，下次 inject 重新创建', () => {
      const a = injector.inject(SimpleService)
      injector.reset()
      const b = injector.inject(SimpleService)
      expect(b).not.toBe(a)
      expect(b).toBeInstanceOf(SimpleService)
    })

    it('绑定也被清除，从类 token 自动重新实例化', () => {
      injector.provide(SimpleService, MockSimpleService)
      injector.reset()
      const svc = injector.inject(SimpleService)
      // reset 后绑定消失，从 token 类自动实例化
      expect(svc).toBeInstanceOf(SimpleService)
      expect(svc.value).toBe('hello')
    })
  })

  describe('错误处理', () => {
    it('未 provide 的 InjectionToken 调用 inject() 抛出异常', () => {
      expect(() => injector.inject(STRING_TOKEN)).toThrow('Service not registered')
    })

    it('BaseService 构造函数缺少 injector 时抛出异常', () => {
      expect(() => new EmptyService(null as any)).toThrow('BaseService requires an Injector instance')
      expect(() => new EmptyService(undefined as any)).toThrow('BaseService requires an Injector instance')
    })

    it('可自动实例化的类调用 inject() 不会抛异常', () => {
      expect(() => injector.inject(SimpleService)).not.toThrow()
    })
  })

  describe('SSR / 隔离', () => {
    it('两个 injector 完全独立', () => {
      const i1 = new Injector()
      const i2 = new Injector()

      i1.provide(STRING_TOKEN, 'from-i1')
      i2.provide(STRING_TOKEN, 'from-i2')

      expect(i1.inject(STRING_TOKEN)).toBe('from-i1')
      expect(i2.inject(STRING_TOKEN)).toBe('from-i2')
    })

    it('实例不跨 injector 共享', () => {
      const i1 = new Injector()
      const i2 = new Injector()

      const s1 = i1.inject(SimpleService)
      const s2 = i2.inject(SimpleService)
      expect(s1).not.toBe(s2)
    })

    it('InjectionToken 可序列化（toString）', () => {
      const token = new InjectionToken<number>('MY_TOKEN')
      expect(token.toString()).toBe('InjectionToken(MY_TOKEN)')
      expect(String(token)).toBe('InjectionToken(MY_TOKEN)')
    })
  })

  describe('provide() — 链式调用', () => {
    it('返回 this 支持链式', () => {
      const result = injector.provide(SimpleService, MockSimpleService)
      expect(result).toBe(injector)
    })

    it('多次 provide 可以链式', () => {
      injector
        .provide(STRING_TOKEN, 'hello')
        .provide(NUM_TOKEN, 42)

      expect(injector.inject(STRING_TOKEN)).toBe('hello')
      expect(injector.inject(NUM_TOKEN)).toBe(42)
    })
  })

  describe('普通类注入（不继承 BaseService）', () => {
    it('自动实例化普通类', () => {
      const instance = injector.inject(PlainClass)
      expect(instance).toBeInstanceOf(PlainClass)
      expect(instance.greet()).toBe('plain')
    })

    it('普通类也能收到 injector 参数', () => {
      const instance = injector.inject(PlainClass)
      expect(instance.injector).toBe(injector)
    })
  })

  describe('InjectionToken 默认值', () => {
    it('未 provide 时使用默认工厂创建', () => {
      const val = injector.inject(CACHE_TOKEN)
      expect(val).toBeInstanceOf(Map)
    })

    it('默认值在同 injector 内是单例', () => {
      const a = injector.inject(CACHE_TOKEN)
      const b = injector.inject(CACHE_TOKEN)
      expect(a).toBe(b)
    })

    it('provide 可覆盖默认值', () => {
      const custom = new Map([['k', 'v']])
      injector.provide(CACHE_TOKEN, custom)
      expect(injector.inject(CACHE_TOKEN)).toBe(custom)
    })

    it('两个 injector 的默认值相互独立', () => {
      const i1 = new Injector()
      const i2 = new Injector()
      expect(i1.inject(CACHE_TOKEN)).not.toBe(i2.inject(CACHE_TOKEN))
    })
  })
})
