
# 健康可见｜UI优化专用 uni-app 工程

这是把 `ab端移动端原型_v_0_UI优化专用.html` 转成 **uni-app（HBuilder X 可直接打开编辑）** 的版本。

## 目录说明

- `pages/index/index.vue`：当前 UI 优化主页面
- `common/mock-data.js`：场景流数据、按钮关系、示意数据
- `pages.json`：页面注册与窗口配置
- `manifest.json`：应用名称与基础配置
- `App.vue / main.js`：uni-app 入口文件

## 使用方法

1. 解压本项目 zip
2. 用 **HBuilder X** 选择“打开目录”
3. 打开项目根目录
4. 运行到浏览器或运行到手机模拟器开始编辑

## 当前工程定位

- 这是 **UI 优化工程**，不是正式业务工程
- 当前保留了 **A/B 端页面切换器**
- 已按当前实际计划接好了关键按钮跳转关系
- 适合先在 HBuilder X / Figma 并行做视觉与交互收束

## 下一步建议

- 把 `common/mock-data.js` 继续拆成 A / B 两份数据
- 将 `pages/index/index.vue` 再拆成 `components/*` 组件
- UI 稳定后，再迁移到真正的 demo 业务工程
