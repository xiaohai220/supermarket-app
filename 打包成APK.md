# 把超市客户服务终端打包成安卓 APP（APK）

本应用是纯前端单文件网页应用 + Node 数据接口，已部署在自有服务器（https://xxhrcs.com）。要变成可安装的安卓 APP，直接用 **PWABuilder** 对线上网址生成 APK 即可。本仓库已包含 PWA 所需文件（manifest、图标、service worker）。

## 一、已准备好的文件

- `index.html` —— 应用本体
- `manifest.webmanifest` —— APP 名称、图标、颜色、全屏显示声明
- `icon.svg` —— 应用图标
- `sw.js` —— 离线缓存（让 APP 外壳可离线打开）

## 二、直接用线上地址生成 APK

应用已部署在 https://xxhrcs.com，手机和 PWABuilder 都能直接访问，无需再另找托管。

1. 电脑浏览器打开 https://www.pwabuilder.com/
2. 在输入框粘贴 `https://xxhrcs.com`，点 **Start**；
3. 检测通过后点 **Package for store** → 平台选 **Android**；
4. 选项保持默认即可（包名可填 `com.xiang.supermarket`），点 **Download**；
5. 下载得到一个 `.zip`，里面就是 **`.apk`**（调试版）或 Android App Bundle；
6. 把 APK 发到安卓手机，安装时允许「安装未知来源应用」即可。

## 三、说明

- 生成的 APP 打开后是**全屏独立窗口**（没有浏览器地址栏），图标显示在桌面，和普通 APP 一样；
- **数据不集中在本机**：顾客发布寄售、发起取件、管理员修改等写入操作，都通过服务器 `data.json` 保存，手机/电脑实时互通；APP 首次打开和每次写入需要联网，纯浏览有 service worker 缓存兜底；
- 想要「正式上架应用商店」的签名版 APK，需要在 PWABuilder 流程里提供你自己的签名密钥（.keystore），调试版 APK 直接安装即可自用。
