/**
 * Vue 3 集成层，用于对接共享 DI 核心。
 * 与 injector.ts 分离，使服务端不打包 Vue。
 *
 * SSR 行为：
 * - ServicePlugin 通过 app.provide/use 创建每个应用的 Injector（无全局状态）
 * - SSR 中每个 createApp() 调用获得独立的 Injector
 * - useInject() 和 useProvide() 仅在 Vue setup() 内可用 —
 *   在组件上下文外调用将抛出明确错误
 *
 * @module injector-vue
 */
import { inject } from 'vue';
import { Injector } from './injector';
/** 从 Vue DI 树中访问 Injector 的注入 key */
const INJECTOR_KEY = Symbol('injector');
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
export const ServicePlugin = (app, options) => {
    const injector = new Injector();
    options?.setup?.(injector);
    app.provide(INJECTOR_KEY, injector);
    app.config.globalProperties.$inject = injector.inject.bind(injector);
};
/** 从 Vue 作用域 Injector 中注入 Service 实例 */
export function useInject(token) {
    const injector = inject(INJECTOR_KEY);
    if (!injector)
        throw new Error('[injector] ServicePlugin not installed — call app.use(ServicePlugin)');
    return injector.inject(token);
}
export function useProvide(token, implementation) {
    const injector = inject(INJECTOR_KEY);
    if (!injector)
        throw new Error('[injector] ServicePlugin not installed — call app.use(ServicePlugin)');
    injector.provide(token, implementation);
}
