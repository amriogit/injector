/**
 * 轻量 DI（依赖注入）容器。
 *
 * 架构决策：
 * - 零外部依赖 — 可在 Node.js、浏览器、SSR 中运行
 * - 无全局单例 — 每个应用或每个请求创建一个 Injector
 * - 类 token 首次 inject() 时自动实例化 — 无需手动注册
 * - provide() 使用函数重载：编译期防止非构造器实现传入类 token
 * - InjectionToken<T> 为非类注入（值、缓存、配置）提供类型安全
 * - onInit() 生命周期钩子在构造器注入的依赖就绪后调用
 *
 * SSR / Node.js 兼容：
 * - 无 DOM、无 Node 内置模块导入
 * - 全部同步逻辑 — 无异步初始化
 * - InjectionToken 可完全序列化（toString()），支持 SSR 水合
 * - 每个 Injector 实例完全隔离 — 无跨请求污染
 */
export class InjectionToken {
    constructor(description, defaultFactory) {
        this.description = description;
        this.defaultFactory = defaultFactory;
    }
    hasDefault() {
        return this.defaultFactory !== undefined;
    }
    createDefault() {
        return this.defaultFactory();
    }
    toString() {
        return `InjectionToken(${this.description})`;
    }
}
export class Injector {
    constructor() {
        this.bindings = new Map();
        this.instances = new Map();
    }
    provide(token, implementation) {
        this.bindings.set(token, implementation);
        return this;
    }
    /**
     * 根据 token 解析服务或值。
     *
     * 按 token 类型不同行为：
     * - 类 token 无 provide() → 自动实例化并缓存
     * - 类 token 有 provide() → 实例化 provided 的实现并缓存（每个 Injector 单例）
     * - InjectionToken 无 provide() → 使用默认值（如有），否则抛出 Error
     * - InjectionToken 有 provide() → 返回 provided 的值
     *
     * 返回值在当前 Injector 内始终是单例，后续调用返回缓存实例。
     */
    inject(token) {
        const existing = this.instances.get(token);
        if (existing !== undefined)
            return existing;
        const binding = this.bindings.get(token);
        if (binding === undefined) {
            if (typeof token === 'function') {
                return this._instantiate(token, token);
            }
            // InjectionToken — 有默认值则使用，否则抛异常
            if (token.hasDefault()) {
                const val = token.createDefault();
                this.instances.set(token, val);
                return val;
            }
            throw new Error(`Service not registered: ${token}`);
        }
        if (typeof binding !== 'function' || !binding.prototype) {
            this.instances.set(token, binding);
            return binding;
        }
        return this._instantiate(token, binding);
    }
    _instantiate(token, Class) {
        const instance = new Class(this);
        this.instances.set(token, instance);
        if (typeof instance.onInit === 'function') {
            ;
            instance.onInit();
        }
        return instance;
    }
    /** 检查 token 是否有绑定（不检查实例缓存） */
    has(token) {
        return this.bindings.has(token);
    }
    /** 清除所有绑定和缓存实例（会先调用所有缓存实例的 onDestroy） */
    reset() {
        for (const [, instance] of this.instances) {
            if (typeof instance === 'object' && instance !== null && typeof instance.onDestroy === 'function') {
                ;
                instance.onDestroy();
            }
        }
        this.bindings.clear();
        this.instances.clear();
    }
    /** 销毁指定 token 的缓存实例（调用 onDestroy 后移出缓存，下次 inject 重新创建） */
    destroy(token) {
        const instance = this.instances.get(token);
        if (instance !== undefined && typeof instance === 'object' && instance !== null && typeof instance.onDestroy === 'function') {
            ;
            instance.onDestroy();
        }
        this.instances.delete(token);
    }
}
/**
 * 所有可注入 Service 的基类。
 *
 * - 构造函数唯一参数为 Injector
 * - 子类通过箭头函数字段声明依赖：`svc = this.$inject(Dep)`
 * - onInit() 由 Injector 在实例构造并缓存后调用（而非构造函数内）
 *
 * @example
 * ```ts
 * class UserService extends BaseService {
 *   private api = this.$inject(ApiService)
 *   private db = this.$inject(DB_POOL)
 *   state = reactive({ ... })
 *   fetchUsers = async () => { ... }
 * }
 * ```
 */
export class BaseService {
    constructor(injector) {
        if (!injector)
            throw new Error('BaseService requires an Injector instance');
        this.$injector = injector;
    }
    /** 从父级 Injector 解析依赖 */
    $inject(token) {
        return this.$injector.inject(token);
    }
}
