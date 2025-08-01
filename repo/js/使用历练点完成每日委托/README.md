# 使用历练点完成每日委托脚本使用指南

## 功能概述

1. **队伍管理**：
   - 自动切换到指定队伍
   - 可选择是否传送至七天神像切换队伍

2. **历练点使用**：
   - 自动领取历练点奖励
   - 支持直接使用历练点（不获取双倍好感）

3. **灵活执行时间设置**：
   - 可设置为每天执行
   - 或指定每周的特定几天执行（如只在周一、周三、周五执行）

4. **双倍好感度获取**：
   - **在好友的尘歌壶内，队伍人数≤2人时使用历练点完成每日委托才能获取双倍好感度**
   - 自动进入好友的尘歌壶
   - 支持指定特定好友
   - 可让指定角色离队，确保队伍人数≤2人（双倍好感度必要条件）



## 参数设置说明

### 基本设置
| 说明 | 默认值 | 示例 |
|------|--------|------|
|需要领取好感的队伍名称（不填则不切换队伍） | 无 | "好感队" |
|关闭前往七天神像切换队伍 | 未勾选 | 勾选后不传送到神像 |
|指定星期几执行（","分隔）<br>输入"0"为每天执行 | "0" | "1,3,5"（周一、三、五执行） |
|直接使用历练点完成每日委托<br>（全角色满好感时推荐启用） | 已勾选 | 勾选后不获取双倍好感 |

### 尘歌壶双倍好感设置
|说明 | 示例 |
|------|------|
| (选填)指定好友名称 | "旅行者123" |
| (选填)申请好友数(≤7) | "5" |
|让1号位角色离队 | 勾选 |
| 让2号位角色离队 | 勾选 |
| 让3号位角色离队 | 勾选 |
| 让4号位角色离队 | 勾选 |


## 使用建议

### 双倍好感度获取流程
0. 先自行消耗120体力
1. 自动进入好友尘歌壶
2. 让指定位置角色离队（确保队伍≤2人）
3. 打开冒险之证领取历练点奖励
4. 返回大世界

### 角色离队策略
- 当需要获取双倍好感时，建议保留2个需要提升好感的角色
- 勾选需要离队的角色位置（1号位为最左侧角色）
- **注意**：不能同时让所有角色离队（至少保留1个角色）

### 时间设置技巧
- 使用"0"设置为每天执行
- 使用"1,3,5"设置为周一、三、五执行
- 脚本会自动处理凌晨时段（00:00-04:00视为前一天）

## 常见问题

**Q：为什么没有进入好友尘歌壶？**  
A：请检查：
1. 是否已禁用双倍好感 (**直接使用历练点完成每日委托** 被勾选)
2. 好友名称是否正确（区分大小写和空格）
3. 好友尘歌壶权限是否设置为"允许直接加入"

**Q：角色没有离队怎么办？**  
A：请检查：
1. 是否正确勾选了角色位置
2. 游戏是否处于可切换队伍状态


**Q：如何知道今天是否会执行脚本？**  
A：脚本日志会显示：
- "今天是星期X，开始使用历练点完成每日委托"
- 或"今天是星期X，不使用历练点"

**Q：为什么切换队伍失败？**  
A：可能因为：
1. 处于联机模式
2. 队伍名称设置错误

## 注意事项

1. 游戏需运行在**1920×1080分辨率**下
2. 进入好友尘歌壶需要**网络连接良好**
3. 双倍好感度需要队伍中**不超过2个角色**
4. 若使用指定好友功能，请确保**好友名称完全匹配**
