# 腾讯云人机验证

## 场景划分

- **发送邮件/手机验证码**：点击发送后触发普通图形验证，后台验证成功后才调用SMTP或短信网关。
- **注册/登录/找回密码**：点击操作后触发无感验证，后台同时检查 `CaptchaCode=1` 与 `EvilLevel=0`。
- **二次认证**：先通过人机验证并校验密码/手机验证码，再判断账号是否启用2FA；启用时弹独立窗口输入认证码或恢复码。窗口确认须重新通过无感验证，完成之前不发放登录会话。
- **已登录账号安全操作**：选择已有邮箱/手机/Authenticator/恢复码验证；发验证码使用普通验证，确认身份使用无感验证。
- **无感高风险回退**：如果腾讯无感验证返回成功票据但风险等级不满足通过条件，前端自动打开普通图形验证；普通验证票据仍由服务端校验，不能通过前端结果绕过。
- **新密码与Authenticator设备确认**：身份验证后再打开独立窗口，最终确认再次使用无感验证。

账号设置内联系方式验证码发送同样要求普通人机验证。后台已认证系统管理员的SMTP连接测试用于配置诊断，不是公开验证码发送接口。

## 环境配置

```dotenv
CAPTCHA_ENABLED=true
CAPTCHA_NORMAL_APP_ID=your-regular-app-id
CAPTCHA_NORMAL_SECRET=your-regular-app-secret
CAPTCHA_INVISIBLE_APP_ID=your-invisible-app-id
CAPTCHA_INVISIBLE_SECRET=your-invisible-app-secret
TENCENT_CAPTCHA_SECRET_ID=your-cloud-api-secret-id
TENCENT_CAPTCHA_SECRET_KEY=your-cloud-api-secret-key
```

后台“全站配置中心→人机验证”可修改以上设置。AppId可公开，应用密钥及云API凭据仅保存在服务器，加密存库且不回显。建议使用仅拥有验证码服务权限的云API子账号。

在腾讯控制台为两个应用分别选择普通验证和无感验证，Web域名应包含实际部署域名。前端动态加载腾讯SDK；1.0版 `TCaptcha.js` 仍由腾讯官方支持，使用 `TencentCaptcha` 构造及 `show()`。无感验证的差别由应用配置及服务端风险结果决定，不能伪造前端标志代替服务端判断。

后端使用腾讯官方SDK的 `DescribeCaptchaResult`：CaptchaType固定9，Ticket/Randstr来自前端，UserIp由本站可信Nginx代理获取，分别传入正确的CaptchaAppId/AppSecretKey。

不接受前端ret直接放行；不接受容灾票据、高风险结果、过期或重复票据。启用时缺少服务配置或供应商不可用会返回明确错误。

## 防止接口绕过

登录主凭据和人机验证通过后发放五分钟有效的随机许可，服务端保存散列并绑定账号、认证版本、登录方式与客户端IP。2FA窗口的无感验证成功后签发login_factor许可，开启2FA的账号不能用只有第一阶段的login许可调用回调。NextAuth同时校验许可、原登录凭据和第二因子后才建立会话；直接提交密码绕过人机验证会被拒绝。许可单次消费，二次验证最多5次尝试。

找回密码的临时许可还绑定本次目标、验证码和新密码内容，防止将一次验证用于其他账号或修改操作。取消2FA弹窗后重新开始需要新的无感验证。

个人设置的身份许可绑定账号、认证版本、操作及变更目标，只在对应动作消费。改密许可允许身份验证后进入新密码窗口，最终提交新密码必须重新通过无感验证；Authenticator绑定许可关联本次待绑定密钥，不能换设备或跨账号使用。原生dialog中的腾讯挑战期间暂停业务窗口并禁用底层页面，挑战结束恢复；自定义菜单挂在所属dialog，保证可操作。

## 验收

1. 点击发送验证码，完成普通腾讯验证后才发送。
2. 点击登录，检查无感验证的后台结果；开启2FA时在主凭据通过后显示独立窗口。
3. 错误密码不能显示2FA账号状态，也不能创建会话。
4. 无票据直接请求发送/注册/登录检查接口应失败。
5. 无感回调返回ticket但EvilLevel=100时必须拒绝。
6. API诊断可确认云API凭据有效及无效票据被拒绝；这不是一次合法人机验证通过的证据。真实完整验收仍需浏览器产生正确票据并获得后台接受。

## 官方文档

- [Web客户端接入](https://cloud.tencent.com/document/product/1110/36841)
- [服务端票据校验](https://cloud.tencent.com/document/product/1110/75489)
- [无感验证接入](https://cloud.tencent.com/document/product/1110/83666)
