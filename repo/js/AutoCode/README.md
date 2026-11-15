# 原神兑换码自动兑换工具使用说明

## 准备工作
若你兑换的是自己通过某些渠道获得的专属兑换码（如联动套餐），
请在`BetterGI\User\JsScript\AutoCode\codes.txt`中按照`兑换码,截止时间`的格式填入兑换码（格式务必参考已有内容，且使用英文逗号）  
若你兑换的是公共渠道的兑换码（如前瞻直播、周年庆福利兑换码等） ，那恭喜你，不需要任何准备工作！直接点击即用！

## 使用BGI提供的兑换码列表
可在设置中选择`使用BGI提供的兑换码列表`，这将通过网络实时获取最新的前瞻兑换码，并记录你的兑换历史，不需要更新此脚本也能长久使用！  
> 此功能需要同时在调度器中右键脚本，点击`修改通用配置`，启用`JS Http权限`，否则将无法运行。

### 服务器选择
设置中可选择当前账号所在服务器：
- **不区分**：不做服务器过滤，全部尝试，与原逻辑一致
- **国服**：优先兑换国服码，国际服码作为补充尝试（无效时记录到缓存，避免重复尝试）
- **国际服（测试）**：优先兑换国际服码，国服码作为补充尝试

服务器判断逻辑与 BetterGI 本体保持一致：根据兑换码条目的 `title` 是否以 `[国际服]` 开头来区分。

<details>
<summary>查看 BetterGI 本体服务器区分代码</summary>

本体 `FeedWindowViewModel.cs` 中的核心实现：

```csharp
private const string GlobalServerTitlePrefix = "[国际服]";

public enum RedeemCodeServerType
{
    Cn,
    Global
}

public static RedeemCodeServerType GetServerType(FeedItem feed)
{
    return feed.Title?.StartsWith(GlobalServerTitlePrefix, StringComparison.OrdinalIgnoreCase) == true
        ? RedeemCodeServerType.Global
        : RedeemCodeServerType.Cn;
}

public static (List<FeedItem> CnFeeds, List<FeedItem> GlobalFeeds) SplitByServer(IEnumerable<FeedItem?> items)
{
    var cnFeeds = new List<FeedItem>();
    var globalFeeds = new List<FeedItem>();

    foreach (var feed in items)
    {
        if (feed is null) continue;
        if (GetServerType(feed) == RedeemCodeServerType.Global)
        {
            globalFeeds.Add(feed);
        }
        else
        {
            cnFeeds.Add(feed);
        }
    }

    return (cnFeeds, globalFeeds);
}
```

脚本中对应的实现：

```javascript
const codeServer = item.title && item.title.startsWith("[国际服]") ? "global" : "cn";
```

</details>

### 信任兑换码有效期
开启后，已过期的兑换码将直接跳过，不尝试兑换。
> 兑换码有效期由数据源提供，若不信任可保持关闭，过期码仍会尝试兑换并由游戏返回"已过期"。

### 兑换缓存机制
兑换码尝试后，以下结果会写入缓存，下次自动跳过：
- 兑换成功
- 已使用
- 已过期
- 非目标服务器的兑换码返回"无效"

以下结果**不会**写入缓存，下次仍会尝试：
- 目标服务器的兑换码返回"无效"
- 活动未开启

## 用户名设置（多用户使用）
添加脚本进调度器后，右键调度器内js脚本，点击 `修改js脚本自定义设置` ，在其中设置用户名  

### 用户名规则：

```json
支持中文、英文、数字

长度 1-20 个字符

如未设置或格式错误，将使用默认用户名 "default"