# configswitcher

[中文](https://github.com/ChriXChan/configswitcher/blob/main/README.md) | [English](https://github.com/ChriXChan/configswitcher/blob/main/README.en.md)

![License](https://img.shields.io/badge/license-MIT-1f6feb)
![Node](https://img.shields.io/badge/node-%3E%3D18-0a7f5a)
![TUI](https://img.shields.io/badge/interface-terminal%20ui-c46b00)

安全切换本地多套配置文件的交互式终端工具。

`configswitcher` 用来解决一个很具体、但经常被低估的问题：同一目录里维护多套配置时，如何在切换过程中尽量避免内容丢失、错配和半成功状态。

```bash
npx @chrixc/configswitcher
cs .
cs /your/config/dir auth config
```

## 适用场景

- 同一个目录下维护多套 `json`、`toml`、`yaml` 等配置文件
- 需要在当前正式配置和候选配置之间快速切换
- 希望先看差异，再决定是否执行
- 希望失败时可以自动恢复，而不是把文件名链式改乱

## 为什么不是简单 rename

很多“配置切换”脚本本质上只是做多次文件重命名。

这种方式在单文件场景下看起来简单，但一旦涉及多文件联动，就很容易出现中间状态失败、文件被覆盖、回滚不完整的问题。`configswitcher` 使用的是更稳妥的内容交换模型：

- 执行前创建事务临时目录
- 把涉及文件复制到快照目录
- 基于快照内容写回目标文件
- 任一步失败时自动从快照恢复
- 启动和刷新时自动清理遗留事务目录

它不是操作系统级事务，但对于“本地人工切换多套配置”这个场景，比链式 rename 更稳。

## 功能特性

- 扫描指定目录中的正式文件和候选文件
- 只按文件名前缀匹配候选文件，不强制要求 `_` 命名风格
- 优先生成成组方案，剩余候选自动退化为单文件方案
- 左侧方案列表 + 右侧逐文件彩色差异对比
- 支持按前缀勾选是否参与本次替换
- 执行前可随时刷新当前目录状态
- 执行失败后自动恢复，并展示失败原因、阶段和恢复结果

## 界面预览

首次进入后，左侧显示候选替换方案，右侧显示当前文件与候选文件的差异：

![首次进入界面](https://raw.githubusercontent.com/ChriXChan/configswitcher/main/assets/p1-first-view.png)

按 `Tab` / `Right` 切到下一个文件继续对比：

![切换到下一个文件](https://raw.githubusercontent.com/ChriXChan/configswitcher/main/assets/p2-right-switch-next-file.png)

按 `Space` 可以取消或重新选中当前前缀是否参与本次替换：

![取消当前前缀](https://raw.githubusercontent.com/ChriXChan/configswitcher/main/assets/p3-space-to-unselect.png)

确认无误后按 `Enter` 直接执行内容替换：

![执行替换](https://raw.githubusercontent.com/ChriXChan/configswitcher/main/assets/p4-enter-to-replace-content.png)

## 快速开始

### 本地开发

```bash
npm install
npm run dev
```

### 构建后运行

```bash
npm run build
npm start
```

### 作为 CLI 使用

```bash
npx @chrixc/configswitcher
```

或全局安装后：

```bash
cs
```

## 启动方式

默认在当前目录启动：

```bash
npm run dev
```

显式传入目录和配置基名：

```bash
npm run dev -- . auth config
```

发布后的 CLI 同样支持：

```bash
cs .
cs . auth config
cs /your/config/dir auth config
```

PowerShell 下如果使用逗号传多个基名，建议加引号：

```powershell
npm run dev -- . "auth,config"
```

## 交互快捷键

主界面：

- `Left`：上一个文件
- `Tab` / `Right`：下一个文件
- `Space`：选中/取消
- `PgUp` / `PgDn`：翻页
- `R`：刷新当前目录状态
- `Enter`：执行替换
- `Esc`：从结果页返回
- `Q`：退出

结果页：

- `R`：刷新当前目录状态
- `Enter`：重新扫描
- `Esc`：返回候选组

## 工作方式

假设目录中有：

```text
auth.json
auth_2.json
config.toml
config_2.toml
```

当你选择 `auth_2.json + config_2.toml` 这套方案时，工具会：

1. 创建事务临时目录，例如 `change-config-temp-xxxx`
2. 把本次涉及的文件复制进去做快照
3. 用快照中的内容写回正式文件和候选文件
4. 成功后删除事务临时目录
5. 失败时按快照恢复执行前内容

结果不是“把文件名改来改去”，而是“保留文件本体、交换内容”：

- `auth.json` 和 `auth_2.json` 都仍然存在
- 成功后两者内容互换
- 失败时尽量恢复到执行前状态

## 候选识别规则

正式文件：

- 文件名与配置基名完全一致
- 例如 `auth.json`、`config.toml`

候选文件：

- 只要文件名以前缀开头，且不等于正式文件本身，就会被识别为候选
- 例如：
  - `auth_2.json`
  - `auth - x.json`
  - `auth测试.json`

## 替换方案规则

工具会优先把“同一后缀且覆盖多个前缀”的候选文件组合成一套方案。

例如：

```text
auth.json
auth_2.json
config.toml
config_2.toml
```

会优先显示成组方案：

```text
auth_2.json  config_2.toml
```

如果某个候选文件没有同后缀伙伴，则会作为单文件方案单独显示。

## 失败信息

执行失败时，结果页会显示：

- 失败原因
- 失败阶段
  - 预检查阶段
  - 快照阶段
  - 暂存阶段
  - 提交阶段
- 失败于哪一步
- 已恢复条目数

## 测试

运行测试：

```bash
npm test
```

当前覆盖：

- 内容交换成功路径
- 写入失败后的恢复路径
- 真实文件系统下的基本执行路径
- 遗留事务目录与快照的恢复逻辑

## 发布

发布到 GitHub 前：

```bash
npm test
npm run build
```

发布到 npm 前：

```bash
npm test
npm run build
npm publish
```

当前 `package.json` 已包含：

- `bin`
- `files`
- `prepublishOnly`

## 已知边界

- 这是“尽量安全恢复”的实现，不是操作系统级多文件原子事务
- 如果外部程序在执行过程中持续修改同一批文件，切换仍可能失败
- 更适合人工触发式本地切换，不适合高频并发自动切换

## License

本项目使用 [MIT License](https://github.com/ChriXChan/configswitcher/blob/main/LICENSE)。
