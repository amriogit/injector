/**
 * Vue 2 集成层，用于对接共享 DI 核心。
 * 与 injector.ts 分离，使服务端不打包 Vue。
 *
 * 通过 `Vue.use(ServicePlugin)` 安装后，所有组件实例
 * 可使用 `this.$inject(Token)` 注入 Service。
 *
 * @module injector-vue2
 */
/**
 * Vue 2 插件预期 `import Vue from 'vue'` 得到 Vue 2 构造函数。
 * 当前项目 devDep 为 Vue 3（与 ./injector-vue.ts 共享），Vue 3 的 ESM
 * 无 default export，因此需要 @ts-expect-error。
 * 在消费方（Vue 2 项目）中，这行能正确解析。
 */
import VueConstructor from 'vue';
import { Injector, InjectionToken, type Token } from './injector';
type ClassToken<T> = {
    new (...args: any[]): T;
};
type Resolved<T> = T extends InjectionToken<infer V> ? V : T extends ClassToken<infer V> ? V : never;
/** 将 PascalCase / SCREAMING_SNAKE 转为 camelCase */
type CamelCase<S extends string, FromSnake extends boolean = false> = S extends `${infer A}_${infer B}` ? `${Lowercase<A>}${Capitalize<CamelCase<B, true>>}` : FromSnake extends true ? Capitalize<Lowercase<S>> : Uncapitalize<S>;
/** mapInject 的返回类型 */
type MapInjectResult<T extends Record<string, Token<any>>> = {
    [K in keyof T as CamelCase<K & string>]: Resolved<T[K]>;
};
/** 计算属性定义的类型（每个 key 对应一个 getter） */
type ComputedGetters<T> = {
    [K in keyof T]: (this: any) => T[K];
};
/**
 * Vue 2 插件。
 *
 * 安装后，所有组件实例可通过 `this.$inject(Token)` 访问 Service。
 *
 * 通过 mixin 在根组件销毁时自动清理所有 Service 实例的 onDestroy。
 *
 * @example
 * ```ts
 * import Vue from 'vue'
 * import { ServicePlugin } from '@amriogit/injector/vue2'
 *
 * Vue.use(ServicePlugin, {
 *   setup(injector) {
 *     injector.provide(API_BASE, '/api')
 *   },
 * })
 * ```
 *
 * 在组件中使用（推荐 `mapInject`）：
 * ```ts
 * import { mapInject } from '@amriogit/injector/vue2'
 *
 * export default {
 *   computed: {
 *     ...mapInject({ UserService }),
 *   },
 *   created() {
 *     this.userService.fetchUsers()
 *   },
 * }
 * ```
 */
export declare const ServicePlugin: {
    install(VueInstance: typeof VueConstructor, options?: {
        setup?: (injector: Injector) => void;
    }): void;
};
/**
 * 批量声明 Service 注入，返回计算属性定义对象。
 *
 * 键名自动转换：`ChannelService` → `channelService`，`API_TOKEN` → `apiToken`。
 * 配合 `...` 展开到 `computed` 中使用。
 *
 * @example
 * ```ts
 * export default {
 *   computed: {
 *     ...mapInject({ ChannelService, UserService, API_TOKEN }),
 *     // 展开后等价于：
 *     // channelService() { return this.$inject(ChannelService) },
 *     // userService()    { return this.$inject(UserService) },
 *     // apiToken()       { return this.$inject(API_TOKEN) },
 *   },
 *   created() {
 *     this.channelService.fetchChannels()
 *     console.log(this.apiToken)
 *   },
 * }
 * ```
 */
export declare function mapInject<T extends Record<string, Token<any>>>(tokens: T): ComputedGetters<MapInjectResult<T>>;
export {};
