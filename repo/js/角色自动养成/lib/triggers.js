// lib/triggers.js —— 脚本运行期间的 BGI 实时触发器（AutoPick / AutoSkip / AutoEat）
//
// 背景（BGI 设计文档 Docs/design/realtime-trigger.md）：
//   「任务期间停止全部用户开启的触发器，只运行任务和脚本显式启用的那些。」
// 所以脚本跑起来以后，用户自己在 BGI 里开的自动拾取/自动跳过是被停用的，
// 必须由脚本重新加入——这正是本模块的职责。
//
// 坑（v1.0.3 及更早的 bug）：
//   dispatcher.addTimer(timer) 的实现是 ClearAllTriggers() + AddTrigger(timer)，
//   连调两次的话，第二次会把第一次加的触发器清掉。
//   addTimer('AutoPick'); addTimer('AutoSkip');  → 最终只剩 AutoSkip，自动拾取=关。
//   正确做法：先清一次，之后全部用 addTrigger 追加。
export const SCRIPT_TRIGGERS = ['AutoPick', 'AutoSkip', 'AutoEat'];

/**
 * 组装本次要启用的触发器名单（纯函数，可单测）
 * @param {{autoPick?:boolean, autoSkip?:boolean, autoEat?:boolean}} want
 * @returns {Array<{name:string, config?:object}>}
 */
export function buildTriggerPlan(want = {}) {
  const plan = [];
  for (const name of SCRIPT_TRIGGERS) {
    const key = name === 'AutoPick' ? 'autoPick' : name === 'AutoSkip' ? 'autoSkip' : 'autoEat';
    if (!want[key]) continue;
    // AutoPick 需要传配置对象（BGI 会用它初始化名单）；其余用默认配置
    plan.push(name === 'AutoPick' ? { name, config: {} } : { name });
  }
  return plan;
}

/**
 * 把名单应用到 dispatcher（依赖注入 ctor，便于单测）
 * @param {object} disp dispatcher（需有 clearAllTriggers + addTrigger 或 addTimer）
 * @param {Array} plan buildTriggerPlan 的结果
 * @param {Function} RealtimeTimerCtor BGI 的 RealtimeTimer 构造器
 * @returns {{cleared:boolean, append:boolean, added:string[], failed:Array<{name:string,reason:string}>}}
 */
export function applyTriggerPlan(disp, plan, RealtimeTimerCtor) {
  const out = { cleared: false, append: false, added: [], failed: [] };
  try {
    disp.clearAllTriggers();
    out.cleared = true;
  } catch (e) { /* 旧版没有这个方法就跳过 */ }
  // addTrigger = 追加；addTimer = 先清空再加。有 addTrigger 就绝不能用 addTimer，
  // 否则后加的会把先加的顶掉（这就是自动拾取被关掉的原因）。
  out.append = typeof disp.addTrigger === 'function';
  for (const item of plan) {
    try {
      const timer = item.config === undefined
        ? new RealtimeTimerCtor(item.name)
        : new RealtimeTimerCtor(item.name, item.config);
      if (out.append) disp.addTrigger(timer);
      else disp.addTimer(timer);
      out.added.push(item.name);
    } catch (e) {
      out.failed.push({ name: item.name, reason: String((e && e.message) || e) });
    }
  }
  return out;
}
