import { Injector, InjectionToken, type Token } from './injector';
/**
 * Vue 3 插件。创建作用域 Injector 并通过 provide/inject
 * 使其对所有后代组件可用。
 *
 * 用法：
 * ```ts
 * createApp(App).use(ServicePlugin).mount('#app')
 * ```
 *
 * 可通过第二个参数传入 setup 回调，在 Service 自动实例化前
 * 为 Injector 提供基础设施 token（如拦截器集合）：
 * ```ts
 * app.use(ServicePlugin, {
 *   setup(injector) {
 *     injector.provide(RESPONSE_INTERCEPTORS, new Set())
 *   }
 * })
 * ```
 *
 * Service 在首次 useInject() 时自动实例化。
 * useProvide() 仅用于为某个子树覆写实现。
 */
export declare const ServicePlugin: (app: any, options?: {
    setup?: (injector: Injector) => void;
}) => void;
/** 从 Vue 作用域 Injector 中注入 Service 实例 */
export declare function useInject<T>(token: Token<T>): T;
/**
 * 为组件子树提供/覆写 Service 绑定。
 *
 * 重载与 injector.provide() 保持一致，提供编译期类型安全：
 * - 类 token 需要构造器（子类）实现
 * - InjectionToken token 接受值类型
 */
export declare function useProvide<T>(token: {
    new (...args: any[]): T;
}, implementation: {
    new (...args: any[]): T;
}): void;
export declare function useProvide<T>(token: InjectionToken<T>, implementation: T): void;
