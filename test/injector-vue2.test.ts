import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vitest'
import { Injector, InjectionToken, BaseService } from '../src/injector'

// ─── 模拟 Vue 2 构造函数 ──────────────────────────────────

const mockState = {
  prototype: {} as Record<string, any>,
  mixin: vi.fn(),
  use: vi.fn(),
  util: {},
}

vi.mock('vue', () => ({
  default: mockState,
}))

// ─── 测试用 Service ────────────────────────────────────────

class SimpleService extends BaseService {
  value = 'hello'
}

class MockSimpleService extends SimpleService {
  value = 'mock'
}

class DependentService extends BaseService {
  simple = this.$inject(SimpleService)
}

class ServiceWithLifecycle extends BaseService {
  destroyed = false

  onDestroy() {
    this.destroyed = true
  }
}

const STRING_TOKEN = new InjectionToken<string>('VUE2_STRING_TOKEN')

// ─── 测试 ──────────────────────────────────────────────────

describe('ServicePlugin (Vue 2)', () => {
  beforeEach(() => {
    mockState.prototype = {}
    vi.clearAllMocks()
  })

  it('向 Vue.prototype 注入 $injector', async () => {
    const { ServicePlugin } = await import('../src/injector-vue2')
    ServicePlugin.install(mockState as any)
    expect(mockState.prototype.$injector).toBeInstanceOf(Injector)
  })

  it('向 Vue.prototype 注入 $inject 方法', async () => {
    const { ServicePlugin } = await import('../src/injector-vue2')
    ServicePlugin.install(mockState as any)
    expect(typeof mockState.prototype.$inject).toBe('function')
  })

  it('注册全局 mixin 用于清理', async () => {
    const { ServicePlugin } = await import('../src/injector-vue2')
    ServicePlugin.install(mockState as any)
    expect(mockState.mixin).toHaveBeenCalledTimes(1)
    const mixinArg = mockState.mixin.mock.calls[0][0]
    expect(mixinArg).toHaveProperty('beforeDestroy')
    expect(typeof mixinArg.beforeDestroy).toBe('function')
  })

  it('通过 setup 回调初始化基础设施', async () => {
    const setup = vi.fn((injector: Injector) => {
      injector.provide(STRING_TOKEN, 'from-setup')
    })
    const { ServicePlugin } = await import('../src/injector-vue2')
    ServicePlugin.install(mockState as any, { setup })
    expect(setup).toHaveBeenCalledTimes(1)
    expect(mockState.prototype.$injector.inject(STRING_TOKEN)).toBe('from-setup')
  })

  it('根组件 beforeDestroy 时触发 injector.reset', async () => {
    const { ServicePlugin } = await import('../src/injector-vue2')
    ServicePlugin.install(mockState as any)

    const injector: Injector = mockState.prototype.$injector
    const svc = injector.inject(ServiceWithLifecycle)

    const mixinArg = mockState.mixin.mock.calls[0][0]
    const { beforeDestroy } = mixinArg

    // 模拟根组件（this.$root === this）
    const rootVm = { $root: {} as any, $injector: injector }
    rootVm.$root = rootVm

    beforeDestroy.call(rootVm)

    expect(svc.destroyed).toBe(true)
  })

  it('非根组件 beforeDestroy 不触发 injector.reset', async () => {
    const { ServicePlugin } = await import('../src/injector-vue2')
    ServicePlugin.install(mockState as any)

    const injector: Injector = mockState.prototype.$injector
    const svc = injector.inject(ServiceWithLifecycle)

    const mixinArg = mockState.mixin.mock.calls[0][0]
    const { beforeDestroy } = mixinArg

    // 模拟子组件（this.$root !== this）
    const childVm = { $root: {} as any, $injector: injector }
    childVm.$root = { $injector: injector }

    beforeDestroy.call(childVm)

    expect(svc.destroyed).toBe(false)
  })
})

describe('Options API — this.$inject', () => {
  beforeEach(async () => {
    mockState.prototype = {}
    vi.clearAllMocks()
    const { ServicePlugin } = await import('../src/injector-vue2')
    ServicePlugin.install(mockState as any)
  })

  it('解析 Service 实例', () => {
    const svc = mockState.prototype.$inject(SimpleService)
    expect(svc).toBeInstanceOf(SimpleService)
    expect(svc.value).toBe('hello')
  })

  it('多次调用返回同一单例', () => {
    const a = mockState.prototype.$inject(SimpleService)
    const b = mockState.prototype.$inject(SimpleService)
    expect(a).toBe(b)
  })

  it('解析 InjectionToken 值', () => {
    mockState.prototype.$injector.provide(STRING_TOKEN, 'test-value')
    expect(mockState.prototype.$inject(STRING_TOKEN)).toBe('test-value')
  })

  it('解析服务间依赖', () => {
    const dep = mockState.prototype.$inject(DependentService)
    expect(dep.simple).toBeInstanceOf(SimpleService)
    expect(dep.simple.value).toBe('hello')
  })

  it('provide 覆写后返回 Mock', () => {
    mockState.prototype.$injector.provide(SimpleService, MockSimpleService)
    const svc = mockState.prototype.$inject(SimpleService)
    expect(svc).toBeInstanceOf(MockSimpleService)
    expect(svc.value).toBe('mock')
  })
})

describe('mapInject — Vue 2', () => {
  beforeEach(async () => {
    mockState.prototype = {}
    vi.clearAllMocks()
    const { ServicePlugin } = await import('../src/injector-vue2')
    ServicePlugin.install(mockState as any)
  })

  it('PascalCase → camelCase 转换', async () => {
    const { mapInject } = await import('../src/injector-vue2')
    const getters = mapInject({ SimpleService })
    expect(getters).toHaveProperty('simpleService')
    expect(typeof getters.simpleService).toBe('function')
  })

  it('SCREAMING_SNAKE → camelCase 转换', async () => {
    mockState.prototype.$injector.provide(STRING_TOKEN, 'token-val')
    const { mapInject } = await import('../src/injector-vue2')
    const getters = mapInject({ STRING_TOKEN })
    expect(getters).toHaveProperty('stringToken')
    expect(typeof getters.stringToken).toBe('function')
  })

  it('getter 通过 this.$inject 解析实例', async () => {
    const { mapInject } = await import('../src/injector-vue2')
    const getters = mapInject({ SimpleService })

    // 模拟组件实例上下文
    const vm = { $inject: mockState.prototype.$inject }
    const svc = getters.simpleService.call(vm)

    expect(svc).toBeInstanceOf(SimpleService)
    expect(svc.value).toBe('hello')
  })

  it('getter 多次调用返回同一单例', async () => {
    const { mapInject } = await import('../src/injector-vue2')
    const getters = mapInject({ SimpleService })
    const vm = { $inject: mockState.prototype.$inject }

    const a = getters.simpleService.call(vm)
    const b = getters.simpleService.call(vm)
    expect(a).toBe(b)
  })

  it('同时注入多个 Service 和 InjectionToken', async () => {
    mockState.prototype.$injector.provide(STRING_TOKEN, 'multi-value')
    const { mapInject } = await import('../src/injector-vue2')
    const getters = mapInject({
      SimpleService,
      DependentService,
      STRING_TOKEN,
    })

    expect(getters).toHaveProperty('simpleService')
    expect(getters).toHaveProperty('dependentService')
    expect(getters).toHaveProperty('stringToken')

    const vm = { $inject: mockState.prototype.$inject }

    expect(getters.simpleService.call(vm).value).toBe('hello')
    expect(getters.dependentService.call(vm).simple).toBeInstanceOf(SimpleService)
    expect(getters.stringToken.call(vm)).toBe('multi-value')
  })

  it('展开到 computed 中可用', async () => {
    const { mapInject } = await import('../src/injector-vue2')
    const getters = mapInject({ SimpleService })

    // 模拟 Vue 2 组件的 computed 合并
    const computed = {
      ...getters,
      customComp() {
        return 'custom'
      },
    }

    expect(computed).toHaveProperty('simpleService')
    expect(computed).toHaveProperty('customComp')
    expect(typeof computed.simpleService).toBe('function')
    expect(computed.customComp()).toBe('custom')
  })

  // ─── 类型检查 ───────────────────────────────────────────

  it('类型：PascalCase 转为 camelCase 的 getter', async () => {
    const { mapInject } = await import('../src/injector-vue2')
    const r = mapInject({ SimpleService, DependentService })
    expectTypeOf(r).toHaveProperty('simpleService')
    expectTypeOf(r).toHaveProperty('dependentService')
    expectTypeOf(r.simpleService).toEqualTypeOf<() => SimpleService>()
    expectTypeOf(r.dependentService).toEqualTypeOf<() => DependentService>()
  })

  it('类型：SCREAMING_SNAKE 转为 camelCase 的 getter', async () => {
    const { mapInject } = await import('../src/injector-vue2')
    mockState.prototype.$injector.provide(STRING_TOKEN, 'val')
    const r = mapInject({ STRING_TOKEN })
    expectTypeOf(r).toHaveProperty('stringToken')
    expectTypeOf(r.stringToken).toEqualTypeOf<() => string>()
  })

  it('类型：混合 class 和 InjectionToken 保留各自类型', async () => {
    const { mapInject } = await import('../src/injector-vue2')
    mockState.prototype.$injector.provide(STRING_TOKEN, 'mix')
    const r = mapInject({ SimpleService, STRING_TOKEN })
    expectTypeOf(r.simpleService).toEqualTypeOf<() => SimpleService>()
    expectTypeOf(r.stringToken).toEqualTypeOf<() => string>()
    expectTypeOf(r).toMatchTypeOf<{
      simpleService: () => SimpleService
      stringToken: () => string
    }>()
  })

  it('类型：多个 token 同时注入', async () => {
    const { mapInject } = await import('../src/injector-vue2')
    mockState.prototype.$injector.provide(STRING_TOKEN, 'x')
    const r = mapInject({ SimpleService, DependentService, STRING_TOKEN })
    expectTypeOf(r.simpleService).toEqualTypeOf<() => SimpleService>()
    expectTypeOf(r.dependentService).toEqualTypeOf<() => DependentService>()
    expectTypeOf(r.stringToken).toEqualTypeOf<() => string>()
  })
})
