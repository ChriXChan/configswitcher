# configswitcher

[中文](./README.md) | [English](./README.en.md)

一个用于本地配置文件切换的交互式终端工具。

适用场景：

- 同一目录下维护多套配置文件
- 需要在正式配置和候选配置之间快速切换
- 希望失败时自动恢复，避免文件内容丢失
- 希望用 TUI 方式预览差异并手动确认切换

当前实现基于“内容交换”而不是“多文件互相改名”：

- 切换前先复制快照到临时目录
- 再按映射关系把快照内容写回目标文件
- 任一步失败就用快照恢复

这比直接做多文件 rename 更适合这个场景。

## 功能特性

- 自动扫描指定目录中的正式文件和候选文件
- 支持按文件名前缀识别候选配置
- 支持“优先成组，剩余单文件兜底”的替换方案生成
- 支持逐文件差异对比
- 支持按前缀勾选是否参与本次替换
- 执行前自动刷新当前目录状态
- 切换失败时自动按快照恢复
- 启动扫描前自动清理遗留事务目录和快照文件

## 工作方式

假设目录中有这些文件：

```text
auth.json
auth_2.json
config.toml
config_2.toml
```

切换到候选配置时，工具会：

1. 创建事务临时目录，例如 `change-config-temp-xxxx`
2. 复制本次涉及的源文件到该目录
3. 使用快照内容覆盖目标文件
4. 如果全部成功，清理临时目录
5. 如果中途失败，使用快照把原始内容恢复回去

这意味着：

- `auth.json` 和 `auth_2.json` 都会保留
- 成功后两者内容互换
- 失败时尽量回到执行前状态

## 安装

### 本地开发

```bash
npm install
npm run dev
```

### 构建

```bash
npm run build
npm start
```

### 发布到 npm 后的使用方式

如果你把它发布为 CLI 包，安装后可以直接运行：

```bash
npx configswitcher
```

或者全局安装后：

```bash
cs
```

发布后的命令支持直接带目录和基名：

```bash
cs .
cs . auth config
cs C:\\your\\config\\dir auth config
```

## 使用说明

### 启动

默认在当前目录启动：

```bash
npm run dev
```

也可以显式传入目录和配置基名：

```bash
npm run dev -- . auth config
```

PowerShell 下如果你要用逗号写多个基名，建议加引号：

```powershell
npm run dev -- . "auth,config"
```

### 操作界面示例

首次进入后，可以在左侧看到候选替换方案，右侧看到当前文件与候选文件的对比：

![首次进入界面](./assets/p1-first-view.png)

按 `Tab` / `Right` 可以切换到下一个文件进行对比：

![切换到下一个文件](./assets/p2-right-switch-next-file.png)

按 `Space` 可以取消或重新选中当前前缀是否参与本次替换：

![取消当前前缀](./assets/p3-space-to-unselect.png)

确认无误后按 `Enter` 执行替换：

![执行替换](./assets/p4-enter-to-replace-content.png)

## 候选文件识别规则

正式文件：

- 文件名与配置基名完全一致
- 例如 `auth.json`、`config.toml`

候选文件：

- 只要文件名以前缀开头，并且不等于正式文件本身，就会被视为候选
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

会生成一套组合方案：

```text
auth_2.json  config_2.toml
```

如果某个候选文件没有可成组的同后缀伙伴，则会作为单文件方案单独出现。

## 交互快捷键

首页：

- `Left`：上一个文件
- `Tab` / `Right`：下一个文件
- `Space`：选中/取消当前前缀
- `PgUp` / `PgDn`：翻页
- `R`：刷新当前目录状态
- `Enter`：执行替换
- `Esc`：从结果页返回
- `Q`：退出

结果页：

- `R`：刷新当前目录状态
- `Enter`：重新扫描
- `Esc`：返回候选组

## 结果页说明

失败时会显示：

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

当前测试覆盖：

- 内容交换成功路径
- 写入失败时的恢复路径
- 真实文件系统下的基本交换行为
- 遗留快照与事务目录的恢复逻辑

## 发布建议

发布到 GitHub 前建议执行：

```bash
npm test
npm run build
```

发布到 npm 前建议执行：

```bash
npm test
npm run build
npm publish
```

当前 `package.json` 已包含：

- `bin`
- `files`
- `prepublishOnly`

因此 npm 发布时会自动先测试和构建。

## 已知边界

- 这是“尽量安全恢复”的实现，不是操作系统级多文件原子事务
- 如果外部程序在执行过程中持续修改同一批文件，仍可能导致切换失败
- 当前更适合人工触发式切换，不适合高频并发自动切换

## 开源许可

本项目使用 [MIT License](./LICENSE)。
