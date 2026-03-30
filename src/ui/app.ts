import blessed from "blessed";

import { BackupMode, CandidateEntry, CandidateGroup, ExecutionResult, ReplaceMode, ScanResult, SwitchPlan } from "../models/types";
import { ConfigScanner } from "../services/configScanner";
import { ContentViewer } from "../services/contentViewer";
import { CurrentConfigMatcher } from "../services/currentConfigMatcher";
import { SelectionPlanner } from "../services/selectionPlanner";
import { SwitchExecutor } from "../services/switchExecutor";
import { SwitchPlanner } from "../services/switchPlanner";
import { TransactionRecovery } from "../services/transactionRecovery";
import { getReplaceModeLabel, getViewAfterExecution } from "./viewState";

type View = "groups" | "result";

interface AppOptions {
  initialDirectory: string;
  initialBasenames: string[];
}

export class ConfigSwitcherApp {
  private readonly scanner = new ConfigScanner();
  private readonly planner = new SwitchPlanner();
  private readonly executor = new SwitchExecutor();
  private readonly viewer = new ContentViewer();
  private readonly matcher = new CurrentConfigMatcher(this.viewer);
  private readonly selectionPlanner = new SelectionPlanner();
  private readonly recovery = new TransactionRecovery();

  private readonly screen = blessed.screen({
    smartCSR: true,
    title: "Config Switcher TUI",
    fullUnicode: true,
  });

  private readonly header = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: 3,
    tags: true,
    padding: { left: 1, right: 1 },
    style: {
      fg: "white",
      bg: "blue",
    },
  });

  private readonly footer = blessed.box({
    bottom: 0,
    left: 0,
    width: "100%",
    height: 3,
    tags: true,
    padding: { left: 1, right: 1 },
    style: {
      fg: "white",
      bg: "gray",
    },
  });

  private readonly leftList = blessed.list({
    top: 3,
    left: 0,
    width: "28%",
    bottom: 3,
    keys: true,
    mouse: true,
    vi: true,
    tags: true,
    border: "line",
    label: " 列表 ",
    style: {
      selected: {
        bg: "green",
        fg: "black",
      },
      item: {
        hover: {
          bg: "green",
          fg: "black",
        },
      },
    },
    scrollbar: {
      ch: " ",
      style: {
        bg: "gray",
      },
    },
  });

  private readonly compareLeft = blessed.box({
    top: 3,
    left: "28%",
    width: "36%",
    bottom: 3,
    tags: true,
    border: "line",
    label: " 当前正式文件 ",
    keys: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: " ",
      style: {
        bg: "gray",
      },
    },
    padding: { left: 1, right: 1 },
  });

  private readonly compareRight = blessed.box({
    top: 3,
    left: "64%",
    width: "36%",
    bottom: 3,
    tags: true,
    border: "line",
    label: " 候选文件 ",
    keys: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: " ",
      style: {
        bg: "gray",
      },
    },
    padding: { left: 1, right: 1 },
  });

  private readonly message = blessed.message({
    parent: this.screen,
    border: "line",
    height: 9,
    width: "60%",
    top: "center",
    left: "center",
    tags: true,
    keys: true,
    vi: true,
    hidden: true,
    label: " 消息 ",
  });

  private view: View = "groups";
  private directory: string;
  private basenames: string[];
  private scanResult?: ScanResult;
  private selectedGroupIndex = 0;
  private selectedEntryIndex = 0;
  private selectedGroupSuffix?: string;
  private selectedBasenames = new Set<string>();
  private backupMode: BackupMode = { type: "auto" };
  private replaceMode: ReplaceMode = "copy";
  private currentPlan?: SwitchPlan;
  private lastExecutionResult?: ExecutionResult;
  private suppressListSelectionEvent = false;
  private compareScrollOffset = 0;

  public constructor(options: AppOptions) {
    this.directory = options.initialDirectory;
    this.basenames = options.initialBasenames;

    this.screen.append(this.header);
    this.screen.append(this.leftList);
    this.screen.append(this.compareLeft);
    this.screen.append(this.compareRight);
    this.screen.append(this.footer);

    this.bindEvents();
  }

  public async start(): Promise<void> {
    this.screen.program.hideCursor();

    if (this.basenames.length === 0) {
      try {
        this.basenames = await this.scanner.inferBasenames(this.directory);
      } catch {
        this.basenames = [];
      }
    }

    if (this.basenames.length > 0) {
      await this.scanDirectory();
    } else {
      this.render();
    }

    this.leftList.focus();
    this.screen.render();
  }

  private bindEvents(): void {
    this.bindShortcut(["q", "Q", "C-c"], () => {
      this.screen.destroy();
      process.exit(0);
    });

    this.bindShortcut(["enter"], async () => {
      await this.handleEnter();
    });

    this.bindShortcut(["escape"], async () => {
      this.handleEscape();
    });

    this.bindShortcut(["pagedown", "C-d"], async () => {
      this.handleComparePaging(10);
    });

    this.bindShortcut(["pageup", "C-u"], async () => {
      this.handleComparePaging(-10);
    });

    this.leftList.on("select item", async (_, index) => {
      this.handleListSelection(index);
    });

    this.screen.on("keypress", async (_, key) => {
      await this.handleGlobalKeypress(key?.full ?? key?.name ?? "");
    });
  }

  private async scanDirectory(): Promise<void> {
    try {
      await this.recovery.recoverDirectory(this.directory);
      const scanResult = await this.scanner.scan(this.directory, this.basenames);
      this.enterGroupsView(scanResult);
      this.render();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.showMessage(`扫描失败：${message}`);
    }
  }

  private async executeCurrentPlan(): Promise<void> {
    if (!this.currentPlan) {
      await this.showMessage("当前没有可执行的切换计划。");
      return;
    }

    if (this.currentPlan.issues.length > 0) {
      await this.showMessage("当前计划仍有问题，请先修复后再执行。");
      return;
    }

    this.lastExecutionResult = await this.executor.execute(this.currentPlan);
    this.view = getViewAfterExecution(this.lastExecutionResult.success);

    if (this.lastExecutionResult.success) {
      await this.scanDirectory();
      return;
    }

    this.render();
  }

  private async executeSelectedGroup(): Promise<void> {
    const currentGroupId = this.currentGroup()?.id;
    const previousSelection = new Set(this.selectedBasenames);
    await this.scanDirectory();

    const group = currentGroupId
      ? this.scanResult?.groups.find((item) => item.id === currentGroupId)
      : this.currentGroup();

    if (!group || !this.scanResult) {
      await this.showMessage("当前没有可执行的替换方案。");
      return;
    }

    this.selectedGroupIndex = this.scanResult.groups.findIndex((item) => item.id === group.id);
    if (this.selectedGroupIndex < 0) {
      this.selectedGroupIndex = 0;
    }
    this.selectedBasenames = new Set(
      Array.from(previousSelection).filter((basename) =>
        this.scanResult?.basenames.includes(basename),
      ),
    );
    if (this.selectedBasenames.size === 0) {
      this.selectedBasenames = new Set(this.scanResult.basenames);
    }

    const selectedEntries = group.entries.filter((entry) =>
      this.selectedBasenames.has(entry.basename),
    );

    if (selectedEntries.length === 0) {
      await this.showMessage("请先选择至少一个要替换的前缀。");
      return;
    }

    this.selectedGroupSuffix = group.id;
    const selectedBasenames = this.selectionPlanner.extractSelectedBasenames(
      this.scanResult,
      group.id,
      this.selectedBasenames,
    );
    const effectiveScanResult = this.selectionPlanner.filterScanResult(
      this.scanResult,
      selectedBasenames,
    );
    this.currentPlan = await this.planner.createPlan(
      effectiveScanResult,
      group.id,
      this.backupMode,
      this.replaceMode,
    );

    if (this.currentPlan.issues.length > 0) {
      await this.showMessage(this.currentPlan.issues.join("\n"));
      return;
    }

    await this.executeCurrentPlan();
  }

  private currentGroup(): CandidateGroup | undefined {
    return this.scanResult?.groups[this.selectedGroupIndex];
  }

  private currentEntry(): CandidateEntry | undefined {
    const entries = this.currentGroup()?.entries ?? [];
    if (entries.length === 0) {
      return undefined;
    }

    const safeIndex = Math.min(this.selectedEntryIndex, entries.length - 1);
    this.selectedEntryIndex = Math.max(safeIndex, 0);
    return entries[this.selectedEntryIndex];
  }

  private async handleEnter(): Promise<void> {
    if (this.view === "groups") {
      await this.executeSelectedGroup();
      return;
    }

    if (this.view === "result") {
      await this.scanDirectory();
    }
  }

  private handleEscape(): void {
    if (this.view !== "result") {
      return;
    }

    this.view = "groups";
    this.render();
  }

  private handleComparePaging(delta: number): void {
    if (this.view !== "groups") {
      return;
    }

    this.scrollCompare(delta);
  }

  private handleListSelection(index: number): void {
    if (this.suppressListSelectionEvent || this.view !== "groups") {
      return;
    }

    this.selectedGroupIndex = index;
    this.selectedEntryIndex = 0;
    this.compareScrollOffset = 0;
    this.render();
  }

  private async handleGlobalKeypress(keyName: string): Promise<void> {
    if (keyName === "r" || keyName === "R") {
      await this.scanDirectory();
      return;
    }

    if (this.view !== "groups") {
      return;
    }

    if (keyName === "tab" || keyName === "right") {
      this.selectNextEntry();
      return;
    }

    if (keyName === "left") {
      this.selectPreviousEntry();
      return;
    }

    if (keyName === "space") {
      this.toggleCurrentEntrySelection();
      return;
    }

    if (keyName === "m" || keyName === "M") {
      this.toggleReplaceMode();
    }
  }

  private enterGroupsView(scanResult: ScanResult): void {
    this.scanResult = scanResult;
    this.view = "groups";
    this.selectedGroupIndex = 0;
    this.selectedEntryIndex = 0;
    this.selectedGroupSuffix = scanResult.groups[0]?.id;
    this.selectedBasenames = new Set(scanResult.basenames);
    this.currentPlan = undefined;
    this.lastExecutionResult = undefined;
    this.compareScrollOffset = 0;
  }

  private render(): void {
    this.renderHeader();
    this.renderFooter();

    if (this.view === "groups") {
      this.renderGroupList();
      this.renderGroupCompare();
      this.leftList.focus();
    } else {
      this.renderResultView();
    }

    this.screen.render();
  }

  private renderHeader(): void {
    const modeLabel =
      this.view === "groups"
        ? "候选组"
        : "执行结果";
    const replaceModeLabel = getReplaceModeLabel(this.replaceMode);

    const pendingTargets = this.currentGroup()
      ?.entries.filter((entry) => this.selectedBasenames.has(entry.basename))
      .map((entry) =>
        entry.candidateFile
          ? `${entry.basename}${entry.candidateFile.extension}`
          : `${entry.basename}(缺失)`,
      )
      .join(", ");
    this.header.setContent(
      ` Config Switcher TUI | 当前视图: ${modeLabel} | 目录: ${this.directory} | 基名: ${
        this.basenames.length > 0 ? this.basenames.join(", ") : "未设置"
      } | 当前模式: ${replaceModeLabel} | 当前待替换文件: ${pendingTargets || "未选择"} `,
    );
  }

  private renderFooter(): void {
    let content = " Left:上一个文件  Tab/Right:下一个文件  Space:选中/取消  M:切换模式  PgUp/PgDn:翻页  R:刷新  Enter:直接替换  Esc:返回  Q:退出 ";

    if (this.view === "result") {
      content = " R:刷新  Enter:重新扫描  Esc:返回候选组  Q:退出 ";
    }

    this.footer.setContent(content);
  }

  private renderGroupList(): void {
    const groups = this.scanResult?.groups ?? [];
    const items =
      groups.length > 0
        ? groups.map((group) => {
            const label = `${this.matcher.matchesGroup(group) ? "☑ " : ""}${group.label}`;

            if (group.isExecutable) {
              return `{green-fg}${label}{/green-fg}`;
            }

            if (group.isComplete) {
              return `{yellow-fg}${label}{/yellow-fg}`;
            }

            return `{red-fg}${label}{/red-fg}`;
          })
        : ["暂无候选配置组"];

    this.leftList.setLabel(" 替换方案 ");
    this.withSuppressedListSelection(() => {
      this.leftList.setItems(items);

      if (groups.length > 0) {
        const safeIndex = Math.min(this.selectedGroupIndex, groups.length - 1);
        this.selectedGroupIndex = Math.max(safeIndex, 0);
        this.leftList.select(this.selectedGroupIndex);
      }
    });
  }

  private renderGroupCompare(): void {
    const group = this.currentGroup();
    const currentEntry = this.currentEntry();

    this.compareLeft.show();
    this.compareRight.show();

    if (!group || !currentEntry) {
      this.compareLeft.setLabel(" 当前正式文件 ");
      this.compareRight.setLabel(" 候选文件 ");
      this.compareLeft.setContent("未找到可对比文件。");
      this.compareRight.setContent("未找到可对比文件。");
      return;
    }

    const leftContent = this.renderEntryComparison("active", currentEntry);
    const rightContent = this.renderEntryComparison("candidate", currentEntry);
    const compareIndex = `${this.selectedEntryIndex + 1}/${group.entries.length}`;
    const selectionLabel = this.selectedBasenames.has(currentEntry.basename)
      ? "[已选]"
      : "[未选]";

    this.compareLeft.setLabel(
      ` 当前正式文件 ${currentEntry.activeFile?.fullName ? `(${currentEntry.activeFile.fullName})` : "(无)"} ${selectionLabel} [${compareIndex}] `,
    );
    this.compareRight.setLabel(
      ` 候选文件 ${currentEntry.candidateFile?.fullName ? `(${currentEntry.candidateFile.fullName})` : "(无)"} ${selectionLabel} [${compareIndex}] `,
    );
    this.compareLeft.setContent(leftContent);
    this.compareRight.setContent(rightContent);
    this.compareLeft.setScroll(this.compareScrollOffset);
    this.compareRight.setScroll(this.compareScrollOffset);
  }

  private renderEntryComparison(side: "active" | "candidate", entry: CandidateEntry): string {
    const file = side === "active" ? entry.activeFile : entry.candidateFile;
    const otherFile = side === "active" ? entry.candidateFile : entry.activeFile;
    const currentText = this.viewer.readRawTextSync(file?.path);
    const otherText = this.viewer.readRawTextSync(otherFile?.path);

    return this.viewer.formatComparedText(currentText, otherText);
  }

  private renderResultView(): void {
    const result = this.lastExecutionResult;
    const lines: string[] = [];

    this.compareLeft.hide();
    this.compareRight.hide();
    this.leftList.setLabel(" 日志列表 ");
    this.withSuppressedListSelection(() => {
      this.leftList.setItems(
        result?.logs.map((log, index) => `${index + 1}. ${log.stage}/${log.status}`) ?? ["无"],
      );
      if ((result?.logs.length ?? 0) > 0) {
        this.leftList.select(0);
      }
    });

    if (!result) {
      this.compareLeft.setContent("暂无执行结果。");
      return;
    }

    lines.push(`执行结果: ${result.success ? "成功" : "失败"}`);
    if (result.error) {
      lines.push(`失败原因: ${result.error}`);
    }
    lines.push(`是否尝试回滚: ${result.rollbackAttempted ? "是" : "否"}`);
    lines.push(`回滚是否成功: ${result.rollbackSucceeded ? "是" : "否"}`);
    const failedLog = result.logs.find(
      (log) => log.stage === "execute" && log.status === "failed",
    );
    const failedPhase = failedLog?.message.includes("预检查")
      ? "预检查阶段"
      : failedLog?.message.includes("创建快照")
        ? "快照阶段"
        : failedLog?.message.includes("暂存")
          ? "暂存阶段"
          : failedLog?.message.includes("提交")
            ? "提交阶段"
            : undefined;
    const rollbackSuccessCount = result.logs.filter(
      (log) => log.stage === "rollback" && log.status === "success",
    ).length;
    const rollbackTotalCount = result.logs.filter(
      (log) => log.stage === "rollback",
    ).length;
    if (failedLog) {
      if (failedPhase) {
        lines.push(`失败阶段: ${failedPhase}`);
      }
      lines.push(`失败于: ${failedLog.action.description}`);
    }
    if (result.rollbackAttempted) {
      lines.push(`已恢复: ${rollbackSuccessCount}/${rollbackTotalCount}`);
    }
    lines.push("");
    lines.push("日志:");
    result.logs.forEach((log) => {
      lines.push(`- [${log.stage}/${log.status}] ${log.message}`);
    });

    if (result.success) {
      lines.push("");
      lines.push("按 Enter 重新扫描目录，刷新当前状态。");
    }

    this.compareLeft.show();
    this.compareLeft.setLabel(" 执行结果 ");
    this.compareLeft.setContent(lines.join("\n"));
    this.compareLeft.setScroll(0);
  }

  private bindShortcut(keys: string[], handler: () => void | Promise<void>): void {
    const widgets = [
      this.screen,
      this.leftList,
      this.compareLeft,
      this.compareRight,
    ];

    widgets.forEach((widget) => {
      widget.key(keys, async () => {
        await handler();
      });
    });
  }

  private withSuppressedListSelection(action: () => void): void {
    this.suppressListSelectionEvent = true;
    try {
      action();
    } finally {
      this.suppressListSelectionEvent = false;
    }
  }

  private scrollCompare(delta: number): void {
    this.compareScrollOffset = Math.max(0, this.compareScrollOffset + delta);
    this.compareLeft.setScroll(this.compareScrollOffset);
    this.compareRight.setScroll(this.compareScrollOffset);
    this.screen.render();
  }

  private selectNextEntry(): void {
    const entries = this.currentGroup()?.entries ?? [];
    if (entries.length === 0) {
      return;
    }

    this.selectedEntryIndex = (this.selectedEntryIndex + 1) % entries.length;
    this.compareScrollOffset = 0;
    this.render();
  }

  private selectPreviousEntry(): void {
    const entries = this.currentGroup()?.entries ?? [];
    if (entries.length === 0) {
      return;
    }

    this.selectedEntryIndex =
      (this.selectedEntryIndex - 1 + entries.length) % entries.length;
    this.compareScrollOffset = 0;
    this.render();
  }

  private toggleCurrentEntrySelection(): void {
    const entry = this.currentEntry();
    if (!entry) {
      return;
    }

    if (this.selectedBasenames.has(entry.basename)) {
      this.selectedBasenames.delete(entry.basename);
    } else {
      this.selectedBasenames.add(entry.basename);
    }

    this.render();
  }

  private toggleReplaceMode(): void {
    this.replaceMode = this.replaceMode === "copy" ? "swap" : "copy";
    this.render();
  }

  private async showMessage(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.message.display(text, 0, () => resolve());
    });
  }
}
