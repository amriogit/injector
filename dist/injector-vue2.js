/**
 * Vue 2 集成层，用于对接共享 DI 核心。
 * 与 injector.ts 分离，使服务端不打包 Vue。
 *
 * 通过 `Vue.use(ServicePlugin)` 安装后，所有组件实例
 * 可使用 `this.$inject(Token)` 注入 Service。
 *
 * @module injector-vue2
 */
import { Injector } from './injector';
// ─── 工具函数 ──────────────────────────────────────────────
function toCamelCase(key) {
    // SCREAMING_SNAKE_CASE → camelCase
    if (key.includes('_')) {
        return key
            .toLowerCase()
            .split('_')
            .filter(Boolean)
            .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
            .join('');
    }
    // PascalCase → camelCase
    return key[0].toLowerCase() + key.slice(1);
}
// ─── Vue 2 Plugin ──────────────────────────────────────────
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
export const ServicePlugin = {
    install(VueInstance, options) {
        const injector = new Injector();
        options?.setup?.(injector);
        // 全局可访问：this.$injector 和 this.$inject 在所有组件实例上可用
        VueInstance.prototype.$injector = injector;
        VueInstance.prototype.$inject = injector.inject.bind(injector);
        // 全局 mixin：根组件销毁时自动清理所有 Service
        VueInstance.mixin({
            beforeDestroy() {
                if (this.$root === this) {
                    injector.reset();
                }
            },
        });
    },
};
// ─── mapInject ─────────────────────────────────────────────
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
export function mapInject(tokens) {
    const result = {};
    for (const key of Object.keys(tokens)) {
        const camelKey = toCamelCase(key);
        const token = tokens[key];
        result[camelKey] = function () {
            return this.$inject(token);
        };
    }
    return result;
}
