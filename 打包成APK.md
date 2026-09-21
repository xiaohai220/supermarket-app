# 把超市客户服务终端打包成安卓 APP（APK）

本应用是纯本地网页应用。要变成可安装的安卓 APP，需要两步：**先部署成一个网址**，再用 **PWABuilder** 在线生成 APK。本仓库已打包成 PWA 所需文件（manifest、图标、service worker）。

## 一、准备好的文件

- `index.html` —— 应用本体
- `manifest.webmanifest` —— APP 名称、图标、颜色、全屏显示声明
- `icon.svg` —— 应用图标
- `sw.js` —— 离线缓存（让 APP 可离线打开）

## 二、把应用放到一个网址（任选一种）

手机和 PWABuilder 需要通过 `https://` 访问这个应用。任选一种免费方式：

### 方式 A：GitHub Pages（推荐，免费、稳定）
1. 在 GitHub 新建一个公开仓库，把 `index.html`、`manifest.webmanifest`、`icon.svg`、`sw.js` 四个文件传上去；
2. 仓库 Settings → Pages → Source 选 `main` 分支根目录 → Save；
3. 等 1 分钟，得到形如 `https://你的用户名.github.io/仓库名/` 的网址。

### 方式 B：Vercel / Netlify
把整个文件夹拖到 vercel.com 或 netlify.com 的部署页，自动得到一个 `https://xxx.vercel.app` 网址。

## 三、用 PWABuilder 生成 APK

1. 电脑浏览器打开 https://www.pwabuilder.com/
2. 在输入框粘贴上面的网址，点 **Start**；
3. 检测通过后点 **Package for store** → 平台选 **Android**；
4. 选项保持默认即可（包名可填 `com.yourstore.supermarket`），点 **Download**；
5. 下载得到一个 `.zip`，里面就是 **`.apk`**（调试版）或 Android App Bundle；
6. 把 APK 发到安卓手机，安装时允许「安装未知来源应用」即可。

## 四、说明

- 生成的 APP 打开后是**全屏独立窗口**（没有浏览器地址栏），图标显示在桌面，和普通 APP 一样；
- 数据仍保存在**手机本机浏览器**，不上传；
- 汇率仍需联网获取，离线时按红色标注使用缓存；
- 想要「正式上架应用商店」的签名版 APK，需要在 PWABuilder 流程里提供你自己的签名密钥（.keystore），调试版 APK 直接安装即可自用。
