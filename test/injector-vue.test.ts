import { describe, it, expect } from 'vitest'
import { createApp } from 'vue'
import { Injector, InjectionToken, BaseService } from '../src/injector'
import { ServicePlugin, useInject, useProvide } from '../src/injector-vue'

// ---------------------------------------------------------------------------
// 测试用的 Service 类
// ---------------------------------------------------------------------------

class SimpleService extends BaseService {
  value = 'hello'
}

class MockSimpleService extends SimpleService {
  value = 'mock'
}

class DependentService extends BaseService {
  simple = this.$inject(SimpleService)
}

const STRING_TOKEN = new InjectionToken<string>('VUE_STRING_TOKEN')

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('ServicePlugin', () => {
  it('向 app 注入 Injector 实例', () => {
    let capturedValue: unknown

    const app = {
      provide(key: unknown, value: unknown) {
        capturedValue = value
      },
      config: { globalProperties: {} as Record<string, unknown> },
    }

    ServicePlugin(app as any)
    expect(capturedValue).toBeInstanceOf(Injector)
  })

  it('将 $inject 绑定到 app.config.globalProperties', () => {
    const app = {
      provide() {},
      config: { globalProperties: {} as Record<string, unknown> },
    }

    ServicePlugin(app as any)
    expect(typeof app.config.globalProperties.$inject).toBe('function')
  })
})

describe('useInject — 未安装 ServicePlugin', () => {
  it('在 Vue 注入上下文外调用时抛出异常', () => {
    expect(() => useInject(SimpleService)).toThrow('ServicePlugin not installed')
  })
})

describe('useProvide — 未安装 ServicePlugin', () => {
  it('在 Vue 注入上下文外调用时抛出异常', () => {
    expect(() => useProvide(SimpleService, MockSimpleService)).toThrow('ServicePlugin not installed')
  })
})

describe('useInject 搭配 ServicePlugin（通过 runWithContext）', () => {
  it('解析 Service 实例', () => {
    const app = createApp({})
    app.use(ServicePlugin)

    app.runWithContext(() => {
      const svc = useInject(SimpleService)
      expect(svc).toBeInstanceOf(SimpleService)
      expect(svc.value).toBe('hello')
    })
  })

  it('多次调用返回同一单例', () => {
    const app = createApp({})
    app.use(ServicePlugin)

    app.runWithContext(() => {
      const a = useInject(SimpleService)
      const b = useInject(SimpleService)
      expect(a).toBe(b)
    })
  })

  it('解析 InjectionToken 值', () => {
    const app = createApp({})
    app.use(ServicePlugin)

    app.runWithContext(() => {
      useProvide(STRING_TOKEN, 'from-vue')
      expect(useInject(STRING_TOKEN)).toBe('from-vue')
    })
  })

  it('解析服务间依赖', () => {
    const app = createApp({})
    app.use(ServicePlugin)

    app.runWithContext(() => {
      const dep = useInject(DependentService)
      expect(dep.simple).toBeInstanceOf(SimpleService)
      expect(dep.simple.value).toBe('hello')
    })
  })

  it('与根 injector 共享依赖单例', () => {
    const app = createApp({})
    app.use(ServicePlugin)

    app.runWithContext(() => {
      const dep = useInject(DependentService)
      const direct = useInject(SimpleService)
      expect(dep.simple).toBe(direct)
    })
  })
})

describe('useProvide 搭配 ServicePlugin（通过 runWithContext）', () => {
  it('为组件子树覆写 token', () => {
    const app = createApp({})
    app.use(ServicePlugin)

    app.runWithContext(() => {
      useProvide(SimpleService, MockSimpleService)
      const svc = useInject(SimpleService)
      expect(svc).toBeInstanceOf(MockSimpleService)
      expect(svc.value).toBe('mock')
    })
  })

  it('覆写会影响依赖该服务的其他服务', () => {
    const app = createApp({})
    app.use(ServicePlugin)

    app.runWithContext(() => {
      useProvide(SimpleService, MockSimpleService)
      const dep = useInject(DependentService)
      expect(dep.simple.value).toBe('mock')
    })
  })

  it('第一次 inject 之前 provide 才生效', () => {
    const app = createApp({})
    app.use(ServicePlugin)

    app.runWithContext(() => {
      useProvide(SimpleService, MockSimpleService)
      const svc = useInject(SimpleService)
      expect(svc.value).toBe('mock')
    })
  })
})
