"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Folder,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  Pin,
  PinOff,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";

type Stage = "idle" | "thinking" | "collecting" | "ready" | "generating" | "generated";
type GroupId = "assay" | "animal" | "analysis" | "delivery";
type SecondaryTopic = "process" | "artifacts" | "evidence" | null;
type WorkbenchView = "tasks" | "library" | "quotation";
type DigitalCoworkerId = "helper" | "dmpk" | "report" | "qa";

type Field = {
  id: string;
  label: string;
  value: string;
  required: boolean;
  group: GroupId;
};

type DraftTab = { fieldId: string; label: string; value: string };
type ChatMessage = { id: string; role: "user" | "agent"; text: string };

const groups: Array<{ id: GroupId; title: string }> = [
  { id: "assay", title: "检测类型" },
  { id: "animal", title: "动物实验" },
  { id: "analysis", title: "生物分析" },
  { id: "delivery", title: "报告与报价" },
];

const initialFields: Field[] = [
  { id: "assayType", label: "检测类型", value: "", required: true, group: "assay" },
  { id: "molecule", label: "分子类型", value: "", required: true, group: "assay" },
  { id: "species", label: "动物种属", value: "", required: true, group: "animal" },
  { id: "animalsPerGroup", label: "每组动物数", value: "", required: true, group: "animal" },
  { id: "groupCount", label: "组数", value: "", required: true, group: "animal" },
  { id: "cycle", label: "试验周期", value: "", required: true, group: "animal" },
  { id: "compoundType", label: "化合物类别", value: "", required: true, group: "analysis" },
  { id: "method", label: "分析方法", value: "", required: true, group: "analysis" },
  { id: "sampleType", label: "样品类型", value: "", required: true, group: "analysis" },
  { id: "bloodPoints", label: "采血点数", value: "", required: true, group: "analysis" },
  { id: "analyteCount", label: "待测物数量", value: "", required: true, group: "analysis" },
  { id: "format", label: "报告格式", value: "", required: true, group: "delivery" },
  { id: "language", label: "报告语言", value: "", required: true, group: "delivery" },
  { id: "region", label: "报价区域", value: "", required: true, group: "delivery" },
];

const options: Record<string, string[]> = {
  compoundType: ["普通小分子", "寡核苷酸", "多肽", "抗体"],
  method: ["LC-MS/MS", "ELISA", "qPCR", "LBA"],
  sampleType: ["血浆", "血清", "组织匀浆", "尿液"],
  analyteCount: ["1", "2", "3", "自定义"],
  format: ["Word + Excel", "Word", "Excel"],
  language: ["中文", "英文", "中英双语"],
  region: ["国内", "欧美", "亚太"],
};

const descriptions: Record<GroupId, string> = {
  assay: "确认 DMPK 下的检测业务线与分子类型。",
  animal: "动物数量、组数和周期会直接影响报价规则。",
  analysis: "请补齐分析方法、样品和待测物参数。",
  delivery: "确认交付格式、语言、区域和管理费规则。",
};

const digitalCoworkers: Record<DigitalCoworkerId, { label: string; hint: string; scope: string; owner: string }> = {
  helper: {
    label: "BioAZ Helper",
    hint: "自动识别意图并分配给合适的数字同事",
    scope: "自动识别",
    owner: "全局",
  },
  dmpk: {
    label: "DMPK报价同事",
    hint: "收集报价参数、匹配规则、生成 Word/Excel 报价产物",
    scope: "报价",
    owner: "SD助理可调用",
  },
  report: {
    label: "药效报告同事",
    hint: "撰写批次报告、对齐原始数据、标注异常波动",
    scope: "报告",
    owner: "SD助理可调用",
  },
  qa: {
    label: "QA审核同事",
    hint: "检查交付包完整性、追溯证据、生成复核清单",
    scope: "复核",
    owner: "QA助理可调用",
  },
};

function groupTitle(id: GroupId) {
  return groups.find((group) => group.id === id)?.title ?? "";
}

export default function DmpkQuotationWorkbench() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<WorkbenchView>("quotation");
  const [activeCoworker, setActiveCoworker] = useState<DigitalCoworkerId>("helper");
  const [fields, setFields] = useState<Field[]>(initialFields);
  const [activeGroup, setActiveGroup] = useState<GroupId>("assay");
  const [openGroups, setOpenGroups] = useState<Record<GroupId, boolean>>({
    assay: true,
    animal: false,
    analysis: false,
    delivery: false,
  });
  const [draftTabs, setDraftTabs] = useState<DraftTab[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "hello",
      role: "agent",
      text: "你好，我是 BioAZ Helper。你可以直接描述任务，我会自动识别应交给哪位数字同事；当前这个 DMPK 报价任务会进入 DMPK报价数字同事处理。",
    },
  ]);
  const [composerText, setComposerText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [artifactPreview, setArtifactPreview] = useState<"word" | "excel" | null>(null);
  const [hoverTopic, setHoverTopic] = useState<SecondaryTopic>(null);
  const [pinnedTopic, setPinnedTopic] = useState<SecondaryTopic>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [pendingDispatchText, setPendingDispatchText] = useState<string | null>(null);

  const missingFields = useMemo(() => fields.filter((field) => field.required && !field.value), [fields]);
  const visibleCardFields = missingFields.filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id));
  const editingField = fields.find((field) => field.id === editingFieldId) ?? null;
  const composerFields = editingField ? [editingField].filter((field) => !draftTabs.some((tab) => tab.fieldId === field.id)) : visibleCardFields;
  const completedCount = fields.filter((field) => field.value).length;
  const totalRequired = fields.filter((field) => field.required).length;
  const secondaryTopic = pinnedTopic ?? hoverTopic;

  const appendMessage = (role: ChatMessage["role"], text: string) => {
    setMessages((items) => [...items, { id: `${role}-${Date.now()}-${items.length}`, role, text }]);
  };

  const patchFields = (patch: Record<string, string>) => {
    setFields((items) => items.map((field) => (patch[field.id] ? { ...field, value: patch[field.id] } : field)));
  };

  const handleInitialRequest = (text: string, options: { skipUserMessage?: boolean } = {}) => {
    if (!options.skipUserMessage) appendMessage("user", text);
    setComposerText("");
    setStage("thinking");
    setHoverTopic(null);
    window.setTimeout(() => {
      patchFields(parseRequest(text));
      setActiveGroup("analysis");
      setOpenGroups({ assay: false, animal: false, analysis: true, delivery: false });
      setStage("collecting");
      appendMessage(
        "agent",
        "已识别 DMPK / PK 检测、小分子、SD 大鼠、每组 2 只、2 组、试验周期 1 周和 3 个非加班采血点。还需要补充生物分析和报告与报价参数。",
      );
    }, 900);
  };

  const addDraft = (field: Field, value: string) => {
    setDraftTabs((items) => [...items.filter((item) => item.fieldId !== field.id), { fieldId: field.id, label: field.label, value }]);
  };

  const requestFieldEdit = (fieldId: string) => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return;
    setEditingFieldId(field.id);
    setDraftTabs((items) => items.filter((item) => item.fieldId !== field.id));
    setActiveGroup(field.group);
    setOpenGroups((current) => ({ ...current, [field.group]: true }));
    setStage("collecting");
    appendMessage("agent", `请问您希望将${field.label}修改为什么？请在下方选择一个新值，发送后我会更新右侧参数。`);
  };

  const sendDraft = () => {
    if (!draftTabs.length) return;
    const sentTabs = draftTabs;
    appendMessage("user", `补充报价参数：\n${sentTabs.map((tab) => `${tab.label}：${tab.value}`).join("\n")}`);
    setStage("thinking");
    setHoverTopic(null);

    window.setTimeout(() => {
      setFields((items) =>
        items.map((field) => {
          const draft = sentTabs.find((tab) => tab.fieldId === field.id);
          return draft ? { ...field, value: draft.value } : field;
        }),
      );

      const remaining = fields.filter((field) => field.required && !field.value && !sentTabs.some((tab) => tab.fieldId === field.id));
      const nextGroup = groups.find((group) => remaining.some((field) => field.group === group.id))?.id;
      setDraftTabs([]);
      setEditingFieldId(null);
      if (nextGroup) {
        setActiveGroup(nextGroup);
        setOpenGroups((current) => ({ ...current, [nextGroup]: true }));
        setStage("collecting");
        appendMessage("agent", `已更新报价参数。还需补充 ${remaining.length} 项参数，请继续在下方补全卡中选择。`);
      } else {
        setStage("ready");
        appendMessage("agent", "计价关键字段已齐全。请进行报价前确认，确认后生成 Word 报价单和 Excel 报价明细。");
      }
    }, 700);
  };

  const submitComposer = () => {
    const text = composerText.trim();
    if (draftTabs.length) {
      if (stage === "collecting" && composerFields.length) return;
      sendDraft();
      return;
    }
    if (!text || stage === "thinking" || stage === "generating") return;
    if (stage === "idle" && activeCoworker === "helper" && /dmpk|报价|pk/i.test(text)) {
      appendMessage("user", text);
      appendMessage("agent", "我识别这是一个 DMPK 报价任务，可以交给 DMPK报价同事继续收集参数并生成报价产物。");
      setPendingDispatchText(text);
      setComposerText("");
      return;
    }
    handleInitialRequest(text);
  };

  const confirmDispatch = () => {
    if (!pendingDispatchText) return;
    const text = pendingDispatchText;
    setPendingDispatchText(null);
    setActiveCoworker("dmpk");
    handleInitialRequest(text, { skipUserMessage: true });
  };

  const startGeneration = () => {
    setPreviewOpen(false);
    setStage("generating");
    setHoverTopic(null);
    appendMessage("user", "确认参数，生成正式报价单。");
    window.setTimeout(() => {
      setStage("generated");
      setHoverTopic("artifacts");
      appendMessage("agent", "报价单已生成。Word 与 Excel 金额校验一致。");
    }, 1800);
  };

  return (
    <main className={`dmpkShell ${collapsed ? "sidebarCollapsed" : ""} ${activeView !== "quotation" ? "workbenchShell" : ""}`}>
      <WorkspaceSidebar collapsed={collapsed} activeView={activeView} onViewChange={setActiveView} onToggleCollapsed={() => setCollapsed((value) => !value)} />
      <section className={`dmpkWorkspace ${activeView !== "quotation" ? "workbenchMode" : ""}`}>
        <header className="topbar">
          <div className="breadcrumb">
            <span>{activeView === "library" ? "文件管理系统" : activeView === "tasks" ? "我的任务" : "DMPK 报价"}</span>
            <ChevronRight size={15} />
            <strong>{activeView === "library" ? "知识库" : activeView === "tasks" ? "待处理" : "新建报价任务"}</strong>
          </div>
        </header>
        {activeView === "library" ? <KnowledgeBase /> : activeView === "tasks" ? <TaskWorkbench onOpenQuotation={() => setActiveView("quotation")} /> : <>
        <header className="agentHeader">
          <div className="agentTitle">
            <span className="agentIcon pending">
              <FileSpreadsheet size={18} />
            </span>
          <span>{digitalCoworkers[activeCoworker].label} · DMPK报价任务</span>
          </div>
        </header>

        <div className="dmpkChatScroller">
          <Conversation
            messages={messages}
            stage={stage}
            activeGroup={activeGroup}
            currentMissing={missingFields}
            onTopicHover={setHoverTopic}
            onTopicPin={setPinnedTopic}
            onArtifactPreview={setArtifactPreview}
          />
        </div>

        <Composer
          stage={stage}
          text={composerText}
          setText={setComposerText}
          activeGroup={activeGroup}
          fields={composerFields}
          mode={editingField ? "edit" : "collect"}
          draftTabs={draftTabs}
          onSelect={addDraft}
          onRemove={(fieldId) => setDraftTabs((items) => items.filter((item) => item.fieldId !== fieldId))}
          onSend={submitComposer}
          onPreview={() => setPreviewOpen(true)}
          onGenerate={startGeneration}
          onTopicHover={setHoverTopic}
          onTopicPin={setPinnedTopic}
          activeCoworker={activeCoworker}
          onCoworkerChange={setActiveCoworker}
          pendingDispatchText={pendingDispatchText}
          onConfirmDispatch={confirmDispatch}
          onCancelDispatch={() => setPendingDispatchText(null)}
          disabled={
            stage === "thinking" ||
            stage === "generating" ||
            (stage === "collecting" && composerFields.length > 0) ||
            (!draftTabs.length && !composerText.trim())
          }
        />
        </>}
      </section>

      {activeView === "quotation" ? <ParameterPanel
        fields={fields}
        activeGroup={activeGroup}
        openGroups={openGroups}
        completedCount={completedCount}
        totalRequired={totalRequired}
        stage={stage}
        secondaryTopic={secondaryTopic}
        pinnedTopic={pinnedTopic}
        onToggle={(id) => setOpenGroups((current) => ({ ...current, [id]: !current[id] }))}
        onEdit={(id) => {
          requestFieldEdit(id);
        }}
        onArtifactPreview={setArtifactPreview}
        onPinTopic={(topic) => setPinnedTopic((current) => (current === topic ? null : topic))}
        onHoverLeave={() => {
          if (!pinnedTopic) setHoverTopic(null);
        }}
      /> : null}

      {previewOpen ? <QuotationPreviewModal fields={fields} onClose={() => setPreviewOpen(false)} /> : null}
      {artifactPreview ? <ArtifactPreviewModal kind={artifactPreview} onClose={() => setArtifactPreview(null)} /> : null}
    </main>
  );
}

function parseRequest(text: string): Record<string, string> {
  const patch: Record<string, string> = {};
  if (/pk/i.test(text)) patch.assayType = "PK检测";
  if (/小分子/.test(text)) patch.molecule = "小分子";
  if (/SD\s*大鼠|SD大鼠/i.test(text)) patch.species = "SD大鼠";
  if (/每组\s*2\s*只/.test(text)) patch.animalsPerGroup = "2";
  if (/2\s*组/.test(text)) patch.groupCount = "2";
  if (/1\s*周|一周/.test(text)) patch.cycle = "1周";
  if (/3\s*个/.test(text)) patch.bloodPoints = "3个非加班时间点";
  return patch;
}

function WorkspaceSidebar({ collapsed, activeView, onViewChange, onToggleCollapsed }: { collapsed: boolean; activeView: WorkbenchView; onViewChange: (view: WorkbenchView) => void; onToggleCollapsed: () => void }) {
  const [open, setOpen] = useState({ oncology: true, dmpk: true, qa: false });
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinnedQuotation, setPinnedQuotation] = useState(true);
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo/bioaz-logo.svg" alt="" />
        <span>BioAZ</span>
        <button className="sidebarCollapseButton" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}>
          <PanelRight size={17} />
        </button>
      </div>
      <div className="sidebarActions">
        {searchOpen ? (
          <div className="sidebarSearch">
            <Search size={15} />
            <input autoFocus placeholder="搜索任务、项目" />
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="关闭搜索">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="newChatWrap">
              <button className="newChat" type="button">
                <span>+</span>
                新建任务
              </button>
              <div className="newChatMenu">
                <span className="newChatMenuLabel">挂靠到</span>
                <button type="button" onClick={() => onViewChange("quotation")}>
                  <Folder size={16} />
                  XX药业-PD1临床前评价
                  <small>常用</small>
                </button>
                <button type="button" onClick={() => onViewChange("quotation")}>
                  <Folder size={16} />
                  YY药业-Balb/c nude评价
                </button>
                <button type="button" onClick={() => onViewChange("quotation")}>
                  <Folder size={16} />
                  ZZ药业-CT26模型评价
                </button>
                <button type="button" onClick={() => onViewChange("quotation")}>
                  <MessageSquare size={16} />
                  临时任务
                </button>
              </div>
            </div>
            <button className="sidebarSearchButton" type="button" onClick={() => setSearchOpen(true)} aria-label="搜索">
              <Search size={17} />
            </button>
          </>
        )}
      </div>
      <nav className="navBlock workspaceViews" aria-label="工作区">
        <button className={`workspaceViewRow ${activeView === "tasks" ? "active" : ""}`} type="button" onClick={() => onViewChange("tasks")}>
          <FileText size={15} strokeWidth={1.8} />
          <span>我的任务</span>
          <small>3</small>
        </button>
        <button className={`workspaceViewRow ${activeView === "library" ? "active" : ""}`} type="button" onClick={() => onViewChange("library")}>
          <Folder size={15} strokeWidth={1.8} />
          <span>文件管理系统</span>
          <small>知识库</small>
        </button>
      </nav>
      {pinnedQuotation ? (
        <section className="navBlock pinnedBlock" aria-label="置顶">
          <p>置顶</p>
          <SidebarChat title="新建报价任务" time="刚刚" status="running" active={activeView === "quotation"} pinned onClick={() => onViewChange("quotation")} onPinToggle={() => setPinnedQuotation(false)} />
        </section>
      ) : null}
      <nav className="navBlock projectTree" aria-label="项目">
        <p>项目</p>
        <SidebarProject title="XX药业-PD1临床前评价" open={open.oncology} onToggle={() => setOpen({ ...open, oncology: !open.oncology })}>
          <SidebarChat title="样本 9 双批次报告" time="36 分钟前" status="pending" onClick={() => onViewChange("quotation")} />
          <SidebarChat title="Balb/c nude 报价" time="3 天前" status="done" onClick={() => onViewChange("quotation")} />
          <SidebarChat title="报告交付包 QA复核" time="1 小时前" status="done" onClick={() => onViewChange("quotation")} />
        </SidebarProject>
        <SidebarProject title="YY药业-Balb/c nude评价" open={open.dmpk} onToggle={() => setOpen({ ...open, dmpk: !open.dmpk })}>
          <SidebarChat title="新建报价任务" time="刚刚" status="running" active={activeView === "quotation"} onClick={() => onViewChange("quotation")} onPinToggle={() => setPinnedQuotation((value) => !value)} pinned={pinnedQuotation} />
          <SidebarChat title="Balb/c nude BA 报价" time="3 天前" status="done" onClick={() => onViewChange("quotation")} />
        </SidebarProject>
        <SidebarProject title="ZZ药业-CT26模型评价" open={open.qa} onToggle={() => setOpen({ ...open, qa: !open.qa })}>
          <SidebarChat title="报价交付包复核" time="1 周" status="done" onClick={() => onViewChange("quotation")} />
        </SidebarProject>
        <div className="temporaryTasks">
          <p>临时任务</p>
          <SidebarChat title="内部试跑报价模型对比" time="今天" status="running" archiveable onClick={() => onViewChange("quotation")} />
        </div>
      </nav>
      <div className="account">
        <div className="avatar">A</div>
        <div>
          <strong>Admin</strong>
          <span>admin@example.com</span>
        </div>
        <button type="button" aria-label="账户更多操作">
          <MoreHorizontal size={17} />
        </button>
      </div>
    </aside>
  );
}

function SidebarProject({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="projectGroup">
      <div className="projectRowWrap">
        <button className="projectRow" type="button" onClick={onToggle}>
          <Folder size={15} strokeWidth={1.8} />
          <strong>{title}</strong>
          <ChevronRight className={open ? "isOpen" : ""} size={14} strokeWidth={1.8} />
        </button>
        <div className="projectHoverActions">
          <button type="button" aria-label="项目操作">
            <MoreHorizontal size={14} strokeWidth={1.8} />
          </button>
          <button type="button" aria-label="重命名项目">
            <Edit3 size={14} strokeWidth={1.8} />
          </button>
          <div className="sidebarMenu">
            <button type="button">置顶项目</button>
            <button type="button">新建任务</button>
            <button type="button">成员与权限</button>
            <button type="button">重命名项目</button>
            <button type="button">查看操作记录</button>
            <button type="button">归入回收站</button>
          </div>
        </div>
      </div>
      {open ? <div className="chatTree">{children}</div> : null}
    </div>
  );
}

function SidebarChat({ title, time, status, active = false, pinned = false, archiveable = false, onClick, onPinToggle }: { title: string; time: string; status: string; active?: boolean; pinned?: boolean; archiveable?: boolean; onClick?: () => void; onPinToggle?: () => void }) {
  return (
    <button className={`chatRow status-${status} ${active ? "active" : ""} ${pinned ? "isPinnedShortcut" : ""} ${archiveable ? "isArchiveable" : ""}`} type="button" onClick={onClick}>
      <FileText className="sidebarIcon" size={15} strokeWidth={1.8} />
      <strong>{title}</strong>
      <small>{time}</small>
      <span
        className="chatHoverActions"
        onClick={(event) => {
          event.stopPropagation();
          onPinToggle?.();
        }}
      >
        {pinned ? <PinOff size={14} strokeWidth={1.8} /> : <Pin size={14} strokeWidth={1.8} />}
        <MoreHorizontal size={14} strokeWidth={1.8} />
      </span>
      {archiveable ? (
        <span className="archiveMenu">
          <em>归档到项目</em>
          <i>XX药业-PD1临床前评价</i>
          <i>YY药业-Balb/c nude评价</i>
          <i>ZZ药业-CT26模型评价</i>
        </span>
      ) : null}
    </button>
  );
}

function Conversation({
  messages,
  stage,
  activeGroup,
  currentMissing,
  onTopicHover,
  onTopicPin,
  onArtifactPreview,
}: {
  messages: ChatMessage[];
  stage: Stage;
  activeGroup: GroupId;
  currentMissing: Field[];
  onTopicHover: (topic: SecondaryTopic) => void;
  onTopicPin: (topic: SecondaryTopic) => void;
  onArtifactPreview: (kind: "word" | "excel") => void;
}) {
  return (
    <div className="dmpkConversation">
      {messages.map((message) => (message.role === "agent" ? <AgentReply key={message.id}>{message.text}</AgentReply> : <UserBubble key={message.id} text={message.text} />))}
      {stage !== "idle" ? (
        <ActivityChain
          title={stage === "generated" ? "已完成报价生成过程" : stage === "thinking" ? "正在处理报价参数" : "已更新报价参数"}
          steps={
            stage === "generating" || stage === "generated"
              ? ["检查计价关键字段", "匹配 PK 动物实验价格规则", "匹配生物分析价格规则", "生成 Word / Excel 报价单", "校验页面与文件金额一致"]
              : ["读取用户输入", "识别 DMPK / PK 业务线", currentMissing.length ? `还缺 ${currentMissing.length} 项报价参数` : "当前阶段参数已齐全"]
          }
          running={stage === "thinking" || stage === "generating"}
          onTopicHover={onTopicHover}
          onTopicPin={onTopicPin}
        />
      ) : null}
      {stage === "generated" ? <ArtifactCards onPreview={onArtifactPreview} onTopicHover={onTopicHover} onTopicPin={onTopicPin} /> : null}
    </div>
  );
}

function AgentReply({ children }: { children: React.ReactNode }) {
  return (
    <div className="agentReply">
      <span className="replyLogoMark">
        <img src="/logo/bioaz-logo.svg" alt="" />
      </span>
      <p>{children}</p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return <div className="userBubble">{text}</div>;
}

function BluePanelLink({ topic, children, onTopicHover, onTopicPin }: { topic: Exclude<SecondaryTopic, null>; children: React.ReactNode; onTopicHover: (topic: SecondaryTopic) => void; onTopicPin: (topic: SecondaryTopic) => void }) {
  return (
    <button className="bluePanelLink" type="button" onMouseEnter={() => onTopicHover(topic)} onFocus={() => onTopicHover(topic)} onClick={() => onTopicPin(topic)}>
      {children}
    </button>
  );
}

function ActivityChain({ title, steps, running, onTopicHover, onTopicPin }: { title: string; steps: string[]; running: boolean; onTopicHover: (topic: SecondaryTopic) => void; onTopicPin: (topic: SecondaryTopic) => void }) {
  return (
    <details className="activityChain" open={running}>
      <summary>
        <span className={running ? "agentLogoMark isThinking" : "agentLogoMark isMuted"}>
          <img src="/logo/bioaz-logo.svg" alt="" />
        </span>
        <strong>{title}</strong>
        <span>·</span>
        <BluePanelLink topic="process" onTopicHover={onTopicHover} onTopicPin={onTopicPin}>查看过程</BluePanelLink>
        <em>{running ? "处理中" : "4s"}</em>
      </summary>
      <div className="activityChainPanel">
        <header>
          <span className={running ? "agentLogoMark isThinking" : "agentLogoMark"}>
            <img src="/logo/bioaz-logo.svg" alt="" />
          </span>
          <strong>{title.replace("已完成", "")}</strong>
          <em>{running ? "处理中" : "4s"}</em>
        </header>
        <div className="activitySteps">
        {steps.map((step, index) => (
          <p key={step} style={{ animationDelay: `${index * 70}ms` }}>
            <i />
            <span>
              <strong>{step}</strong>
              <small>{processStepDetail(step)}</small>
            </span>
          </p>
        ))}
        </div>
      </div>
    </details>
  );
}

function processStepDetail(step: string) {
  if (step.includes("读取")) return "解析自然语言中的检测类型、动物信息、周期和采血点。";
  if (step.includes("识别")) return "匹配 DMPK / PK 业务线，并定位需要补齐的字段组。";
  if (step.includes("检查")) return "确认必填计价字段是否齐全，拦截缺字段出报价。";
  if (step.includes("匹配 PK")) return "根据动物种属、数量、周期和采样点匹配动物实验规则。";
  if (step.includes("匹配生物")) return "根据分析方法、样品类型和待测物数量匹配生物分析规则。";
  if (step.includes("生成")) return "生成 Word 报价单和 Excel 报价明细。";
  if (step.includes("校验")) return "校验页面、Word 和 Excel 的金额一致性。";
  return "同步结构化报价参数台账。";
}

function ParameterTaskCard({ activeGroup, fields, draftTabs, mode, onSelect }: { activeGroup: GroupId; fields: Field[]; draftTabs: DraftTab[]; mode: "collect" | "edit"; onSelect: (field: Field, value: string) => void }) {
  const [editingCustom, setEditingCustom] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(() => Math.max(0, groups.findIndex((group) => group.id === activeGroup)));
  const pageCount = groups.length;
  const safePage = Math.min(page, pageCount - 1);
  const pageGroup = groups[safePage];
  const pageFields = mode === "edit" ? fields : fields.filter((field) => field.group === pageGroup.id);

  const commitCustom = (field: Field) => {
    const value = customValues[field.id]?.trim();
    if (!value) {
      setEditingCustom(null);
      return;
    }
    onSelect(field, value);
    setEditingCustom(null);
  };

  if (!fields.length) return null;
  return (
    <section className="warningDecision parameterTaskCard">
      <header className="warningDecisionHeader">
        <div>
          <span>参数补全</span>
          <strong>{mode === "edit" ? `修改${fields[0]?.label ?? "参数"}` : "请一次补全报价参数"}</strong>
          <p>{mode === "edit" ? "选择新值后会写入下方参数 tab，发送后更新右侧参数。" : "按检测类型、动物实验、生物分析、报告与报价分页选择；全部补齐后统一发送给 Agent。"}</p>
        </div>
        <small>还需 {fields.length} 项</small>
      </header>
      {mode === "collect" ? (
        <div className="parameterPages">
          {groups.map((group, index) => (
            <button className={index === safePage ? "active" : ""} type="button" key={group.id} onClick={() => setPage(index)}>
              {group.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="warningDecisionList">
        {pageFields.length ? pageFields.map((field, index) => {
          const selected = draftTabs.find((tab) => tab.fieldId === field.id);
          return (
            <article className={`decisionRow ${selected ? "done" : ""}`} key={field.id}>
              <span className="decisionIndex">{selected ? <Check size={17} /> : index + 1}</span>
              <div className="decisionCopy">
                <span>{field.required ? "必填 · 计价关键字段" : "可选"}</span>
                <strong>{field.label}</strong>
                <div className="optionGrid">
                  {(options[field.id] ?? ["1", "2", "3"]).map((option) =>
                    option === "自定义" && editingCustom === field.id ? (
                      <input
                        autoFocus
                        className="customOptionInput"
                        key={option}
                        onBlur={() => commitCustom(field)}
                        onChange={(event) => setCustomValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitCustom(field);
                          if (event.key === "Escape") setEditingCustom(null);
                        }}
                        placeholder="输入"
                        value={customValues[field.id] ?? ""}
                      />
                    ) : (
                      <button
                        className={selected?.value === option ? "selected" : ""}
                        type="button"
                        key={option}
                        onClick={() => {
                          if (option === "自定义") {
                            setEditingCustom(field.id);
                            return;
                          }
                          onSelect(field, option);
                        }}
                      >
                        {option}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </article>
          );
        }) : <p className="emptyPageNote">{pageGroup.title}参数已齐全，可切换下一页继续补全。</p>}
      </div>
      <div className="parameterPager">
        <p className="responsibilityNote">选择会先写入下方参数 tab，全部补齐后才正式更新右侧参数台账。</p>
        {mode === "collect" ? (
          <div>
            <span>{safePage + 1}/{pageCount}</span>
            <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={safePage === 0}>
              上一页
            </button>
            <button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={safePage >= pageCount - 1}>
              下一页
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TaskWorkbench({ onOpenQuotation }: { onOpenQuotation: () => void }) {
  const actionTasks = [
    { title: "报告交付包 QA复核 · 等你审核", project: "XX药业-PD1临床前评价", coworker: "QA审核数字同事", time: "2小时前流转至你", status: "待我处理" },
    { title: "Balb/c nude 报价 · 需要补充参数", project: "YY药业-Balb/c nude评价", coworker: "DMPK报价数字同事", time: "昨天", status: "待补充" },
    { title: "CT26 交付包 · 待确认最终版", project: "ZZ药业-CT26模型评价", coworker: "QA审核数字同事", time: "3天前", status: "待确认" },
  ];
  const allTasks = [
    { title: "样本9 双批次报告", project: "XX药业-PD1临床前评价", coworker: "药效报告数字同事", time: "36分钟前", status: "Agent处理中" },
    { title: "Balb/c nude 报价", project: "YY药业-Balb/c nude评价", coworker: "DMPK报价数字同事", time: "3天前", status: "已完成" },
    { title: "报告交付包 QA复核", project: "XX药业-PD1临床前评价", coworker: "QA审核数字同事", time: "1小时前", status: "待审核" },
    { title: "内部试跑报价模型对比", project: "临时任务", coworker: "BioAZ Helper", time: "今天", status: "临时任务" },
  ];
  return (
    <section className="workbenchView taskWorkbenchView">
      <header>
        <div>
          <span>任务中心</span>
          <h1>我的任务</h1>
          <p>先处理需要你介入的事项，其余工作按最近更新时间排列。</p>
        </div>
        <button className="primaryButton compact" type="button" onClick={onOpenQuotation}>进入 DMPK 报价</button>
      </header>
      <div className="taskQueueShell">
        <section className="taskQueueSection">
          <h2>待我处理 · 3</h2>
          <div className="workbenchTaskList">
            {actionTasks.map((task) => (
              <button className="workbenchTaskCard actionRequired" type="button" key={task.title} onClick={task.title.includes("报价") ? onOpenQuotation : undefined}>
                <FileText size={16} strokeWidth={1.8} />
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.project} · {task.coworker} · {task.time}</small>
                </span>
                <em>{task.status}</em>
              </button>
            ))}
          </div>
        </section>
        <section className="taskQueueSection">
          <div className="taskSectionHeader">
            <h2>全部任务</h2>
            <div className="taskFilters">
              <button type="button">项目 <ChevronDown size={13} /></button>
              <button type="button">数字同事 <ChevronDown size={13} /></button>
              <button type="button">状态 <ChevronDown size={13} /></button>
            </div>
          </div>
          <div className="workbenchTaskList allTaskList">
            {allTasks.map((task) => (
              <button className="workbenchTaskCard" type="button" key={task.title} onClick={task.title.includes("报价") ? onOpenQuotation : undefined}>
                <FileText size={16} strokeWidth={1.8} />
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.project} · {task.coworker} · {task.time}</small>
                </span>
                <em>{task.status}</em>
              </button>
            ))}
          </div>
        </section>
      </div>
      <WorkspaceAssistant context="tasks" onOpenQuotation={onOpenQuotation} />
    </section>
  );
}

function KnowledgeBase() {
  const groups = [
    {
      title: "给人看的产出物",
      files: [
        { title: "Balbc_nude_报价单.xlsx", meta: "YY药业-Balb/c nude评价 · 报价明细 · 已完成", source: "DMPK报价数字同事" },
        { title: "样本9_双批次报告_v3.docx", meta: "XX药业-PD1临床前评价 · 报告产物 · 进行中", source: "药效报告数字同事" },
      ],
    },
    {
      title: "给数字同事调用的知识",
      files: [
        { title: "DMPK_报价规则_2026.docx", meta: "规则与模板 · 参数抽取和报价依据", source: "知识库规则" },
        { title: "QA_交付包检查清单.xlsx", meta: "审核记录 · 放行前复核依据", source: "QA审核数字同事" },
      ],
    },
    {
      title: "原始数据与说明",
      files: [
        { title: "batch9_raw.xlsx", meta: "XX药业-PD1临床前评价 · 原始数据 · 已归档", source: "用户上传" },
      ],
    },
  ];
  return (
    <section className="workbenchView knowledgeBaseView">
      <header>
        <div>
          <span>文件管理系统</span>
          <h1>知识库与产物库</h1>
          <p>统一查看项目产物、可供数字同事调用的知识，以及原始数据。</p>
        </div>
        <label className="secondaryButton compact" htmlFor="knowledge-file-upload"><FileText size={14} /> 上传文件</label>
        <input className="visuallyHidden" id="knowledge-file-upload" type="file" multiple />
      </header>
      <div className="taskFilters libraryFilters">
        <button type="button">项目 <ChevronDown size={13} /></button>
        <button type="button">用途 <ChevronDown size={13} /></button>
        <button type="button">可见对象 <ChevronDown size={13} /></button>
        <button type="button">状态 <ChevronDown size={13} /></button>
      </div>
      <div className="knowledgeSections">
        {groups.map((group) => (
          <section className="knowledgeSection" key={group.title}>
            <h2>{group.title}</h2>
            <div className="knowledgeGrid">
              {group.files.map((file) => (
                <article className="knowledgeCard" key={file.title}>
                  <FileText size={16} strokeWidth={1.8} />
                  <div>
                    <strong>{file.title}</strong>
                    <p>{file.meta}</p>
                    <small>{file.source}</small>
                  </div>
                  <button type="button" aria-label="预览"><Eye size={15} strokeWidth={1.8} /></button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <WorkspaceAssistant context="library" />
    </section>
  );
}

function WorkspaceAssistant({ context, onOpenQuotation }: { context: "tasks" | "library"; onOpenQuotation?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const suggestions = context === "tasks"
    ? ["列出我待处理的任务", "按项目整理当前任务", "发起一份 DMPK 报价"]
    : ["查找样本9相关文件", "找到最新 DMPK 报价规则", "整理当前项目交付物"];

  const submit = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setQuestion(next);
    setText("");
    if (next.includes("DMPK") && next.includes("报价")) onOpenQuotation?.();
  };

  return (
    <div className={`workspaceAssistant ${open ? "isOpen" : ""}`}>
      {open ? (
        <section className="workspaceAssistantPanel" aria-label="BioAZ Helper">
          <header>
            <div>
              <span className="assistantMark"><Sparkles size={15} /></span>
              <strong>BioAZ Helper</strong>
            </div>
            <button type="button" aria-label="关闭" onClick={() => setOpen(false)}><X size={16} /></button>
          </header>
          <div className="workspaceAssistantBody">
            {question ? (
              <div className="assistantExchange">
                <p>{question}</p>
                <div><Sparkles size={14} /><span>{context === "tasks" ? "我已经按最近更新时间检查了任务，可先处理顶部 3 项待办。" : "我已经在知识库中检索相关产物、规则和原始数据。"}</span></div>
              </div>
            ) : (
              <div className="assistantWelcome">
                <strong>你好，我是 BioAZ Helper</strong>
                <p>{context === "tasks" ? "我可以帮你找任务、查进度或发起新工作。" : "我可以帮你查找文件、规则和项目产物。"}</p>
              </div>
            )}
            <div className="assistantSuggestions">
              {suggestions.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => submit(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>
          <form className="workspaceAssistantComposer" onSubmit={(event) => { event.preventDefault(); submit(text); }}>
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="给 BioAZ Helper 发消息..." aria-label="给 BioAZ Helper 发消息" />
            <button type="submit" aria-label="发送" disabled={!text.trim()}><Send size={16} /></button>
          </form>
        </section>
      ) : null}
      <button className="workspaceAssistantLauncher" type="button" aria-label={open ? "收起 BioAZ Helper" : "打开 BioAZ Helper"} onClick={() => setOpen((value) => !value)}>
        {open ? <X size={19} /> : <MessageSquare size={19} />}
      </button>
    </div>
  );
}

function CoworkerSelector({ activeCoworker, onCoworkerChange }: { activeCoworker: DigitalCoworkerId; onCoworkerChange: (coworker: DigitalCoworkerId) => void }) {
  const coworker = digitalCoworkers[activeCoworker];
  const coworkerIcons: Record<DigitalCoworkerId, React.ReactNode> = {
    helper: <Sparkles size={16} strokeWidth={1.9} />,
    report: <FileText size={16} strokeWidth={1.9} />,
    dmpk: <FileSpreadsheet size={16} strokeWidth={1.9} />,
    qa: <Check size={16} strokeWidth={1.9} />,
  };
  return (
    <div className="roleSelector">
      <div className="roleSelectorCurrent">
        {coworkerIcons[activeCoworker]}
        <span>{coworker.label}</span>
        <small>{activeCoworker === "helper" ? "（自动识别）" : ""}</small>
        <ChevronDown size={14} strokeWidth={1.8} />
      </div>
      <div className="roleSelectorMenu">
        {(["helper", "report", "dmpk", "qa"] as DigitalCoworkerId[]).map((coworkerId) => {
          const item = digitalCoworkers[coworkerId];
          return (
            <button className={coworkerId === activeCoworker ? "active" : ""} type="button" key={coworkerId} onClick={() => onCoworkerChange(coworkerId)}>
              {coworkerIcons[coworkerId]}
              <strong>{item.label}</strong>
              {coworkerId === "helper" ? <span>自动识别</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function Composer({
  stage,
  text,
  setText,
  activeGroup,
  fields,
  mode,
  draftTabs,
  onSelect,
  onRemove,
  onSend,
  onPreview,
  onGenerate,
  onTopicHover,
  onTopicPin,
  activeCoworker,
  onCoworkerChange,
  pendingDispatchText,
  onConfirmDispatch,
  onCancelDispatch,
  disabled,
}: {
  stage: Stage;
  text: string;
  setText: (value: string) => void;
  activeGroup: GroupId;
  fields: Field[];
  mode: "collect" | "edit";
  draftTabs: DraftTab[];
  onSelect: (field: Field, value: string) => void;
  onRemove: (fieldId: string) => void;
  onSend: () => void;
  onPreview: () => void;
  onGenerate: () => void;
  onTopicHover: (topic: SecondaryTopic) => void;
  onTopicPin: (topic: SecondaryTopic) => void;
  activeCoworker: DigitalCoworkerId;
  onCoworkerChange: (coworker: DigitalCoworkerId) => void;
  pendingDispatchText: string | null;
  onConfirmDispatch: () => void;
  onCancelDispatch: () => void;
  disabled: boolean;
}) {
  return (
    <footer className="dmpkComposerWrap">
      {stage === "collecting" ? <ParameterTaskCard activeGroup={activeGroup} fields={fields} draftTabs={draftTabs} mode={mode} onSelect={onSelect} /> : null}
      {stage === "ready" ? <FinalConfirmCard onPreview={onPreview} onGenerate={onGenerate} onTopicHover={onTopicHover} onTopicPin={onTopicPin} /> : null}
      {pendingDispatchText ? <DispatchConfirmCard onConfirm={onConfirmDispatch} onCancel={onCancelDispatch} /> : null}
      <CoworkerSelector activeCoworker={activeCoworker} onCoworkerChange={onCoworkerChange} />
      <div className="dmpkComposer">
        <div className="composerInputStack">
          {draftTabs.length ? (
            <div className="draftTabs">
              {draftTabs.map((tab) => (
                <button type="button" key={tab.fieldId} onClick={() => onRemove(tab.fieldId)}>
                  {tab.label}：{tab.value}
                  <X size={13} />
                </button>
              ))}
            </div>
          ) : null}
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSend();
            }}
            placeholder={draftTabs.length ? "" : stage === "idle" ? "例如：PK小分子，SD大鼠，每组2只，2组，试验周期1周，周期内3个非加班时间点" : ""}
          />
        </div>
        <button className="sendIconButton" type="button" onClick={onSend} disabled={disabled} aria-label="发送">
          <Send size={18} />
        </button>
      </div>
    </footer>
  );
}

function DispatchConfirmCard({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <section className="dispatchConfirmCard">
      <div>
        <span>BioAZ Helper 已识别</span>
        <strong>将任务交给 DMPK报价同事处理？</strong>
        <p>确认后继续收集 DMPK 报价参数，并生成 Word / Excel 报价产物。</p>
      </div>
      <button type="button" onClick={onCancel}>换一个数字同事</button>
      <button className="primaryButton compact" type="button" onClick={onConfirm}>确认分派</button>
    </section>
  );
}

function FinalConfirmCard({ onPreview, onGenerate, onTopicHover, onTopicPin }: { onPreview: () => void; onGenerate: () => void; onTopicHover: (topic: SecondaryTopic) => void; onTopicPin: (topic: SecondaryTopic) => void }) {
  return (
    <section className="warningDecision">
      <header className="warningDecisionHeader">
        <div>
          <span>报价前确认</span>
          <strong>参数已齐全，可以生成正式报价单</strong>
          <p>
            请先预览完整参数和计价规则，也可以
            <BluePanelLink topic="evidence" onTopicHover={onTopicHover} onTopicPin={onTopicPin}>查看规则证据</BluePanelLink>
            。确认后将生成 Word 报价单与 Excel 报价明细。
          </p>
        </div>
        <small>待确认</small>
      </header>
      <div className="warningActions">
        <button className="previewIconOnlyButton" type="button" onClick={onPreview} aria-label="预览全部参数">
          <Eye size={16} />
        </button>
        <button className="primaryButton compact" type="button" onClick={onGenerate}>
          生成报价单
        </button>
      </div>
    </section>
  );
}

function ArtifactCards({ onPreview, onTopicHover, onTopicPin }: { onPreview: (kind: "word" | "excel") => void; onTopicHover: (topic: SecondaryTopic) => void; onTopicPin: (topic: SecondaryTopic) => void }) {
  return (
    <section className="artifactCards">
      <div className="agentReply artifactReply">
        <span className="replyLogoMark"><img src="/logo/bioaz-logo.svg" alt="" /></span>
        <p>
          报价单已生成。你可以
          <BluePanelLink topic="artifacts" onTopicHover={onTopicHover} onTopicPin={onTopicPin}>查看产物列表</BluePanelLink>
          ，或直接预览下方文件。
        </p>
      </div>
      {(["word", "excel"] as const).map((kind) => (
        <article className="artifactCard" key={kind}>
          <span className="artifactFileIcon">{kind === "word" ? <FileText size={24} /> : <FileSpreadsheet size={24} />}</span>
          <div>
            <strong>{kind === "word" ? "中文 Word 报价单" : "Excel 报价明细"}</strong>
            <p>{kind === "word" ? "DMPK PK 检测正式报价单，包含项目范围、报价条目、管理费和交付说明。" : "报价明细表，包含计价项、数量、单价、管理费和金额一致性校验。"}</p>
            <span>{kind === "word" ? "Document · DOCX · 管理费 30%" : "Spreadsheet · XLSX · 管理费 15%"}</span>
          </div>
          <button className="artifactActionButton" type="button" onClick={() => onPreview(kind)} aria-label="预览">
            <Eye size={16} />
            <span>预览</span>
          </button>
          <button className="artifactActionButton" type="button" aria-label="下载">
            <Download size={16} />
            <span>下载</span>
          </button>
          <button className="artifactMoreButton" type="button" aria-label="更多">
            <MoreHorizontal size={16} />
          </button>
        </article>
      ))}
    </section>
  );
}

function ParameterPanel({ fields, activeGroup, openGroups, completedCount, totalRequired, stage, secondaryTopic, pinnedTopic, onToggle, onEdit, onArtifactPreview, onPinTopic, onHoverLeave }: { fields: Field[]; activeGroup: GroupId; openGroups: Record<GroupId, boolean>; completedCount: number; totalRequired: number; stage: Stage; secondaryTopic: SecondaryTopic; pinnedTopic: SecondaryTopic; onToggle: (id: GroupId) => void; onEdit: (id: string) => void; onArtifactPreview: (kind: "word" | "excel") => void; onPinTopic: (topic: SecondaryTopic) => void; onHoverLeave: () => void }) {
  const hasArtifacts = stage === "generated";
  return (
    <aside className="dmpkPanel" onMouseLeave={onHoverLeave}>
      <section className="rightPanelCard pinnedParamCard">
        <header>
          <div>
            <FileSpreadsheet size={22} />
            <strong>报价参数收集</strong>
          </div>
          <span>{completedCount}/{totalRequired}</span>
        </header>
        <div className={hasArtifacts ? "paramGroups compact" : "paramGroups"}>
          {groups.map((group) => {
            const groupFields = fields.filter((field) => field.group === group.id);
            const missing = groupFields.filter((field) => !field.value).length;
            const done = missing === 0;
            const shouldOpen = hasArtifacts ? false : openGroups[group.id];
            return (
              <section className="paramGroup" key={group.id}>
                <button className="paramGroupHeader" type="button" onClick={() => onToggle(group.id)}>
                  <i className={done ? "done" : group.id === activeGroup ? "active" : ""} />
                  <strong>{group.title}</strong>
                  <span>{done ? "已完成" : group.id === activeGroup ? "进行中" : "未开始"}</span>
                  <ChevronDown size={16} />
                </button>
                {shouldOpen ? (
                  <div className="paramRows">
                    {groupFields.map((field) => (
                      <div className="paramRow" key={field.id}>
                        <span>{field.label}</span>
                        <strong className={field.value ? "" : "empty"}>{field.value || "待填写"}</strong>
                        <button type="button" onClick={() => onEdit(field.id)} aria-label={`修改${field.label}`}>
                          <Edit3 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </section>
      {secondaryTopic ? (
        <SecondaryPanel topic={secondaryTopic} pinned={pinnedTopic === secondaryTopic} onPin={() => onPinTopic(secondaryTopic)} onArtifactPreview={onArtifactPreview} />
      ) : null}
    </aside>
  );
}

function SecondaryPanel({ topic, pinned, onPin, onArtifactPreview }: { topic: Exclude<SecondaryTopic, null>; pinned: boolean; onPin: () => void; onArtifactPreview: (kind: "word" | "excel") => void }) {
  return (
    <section className="rightPanelCard secondaryPanel">
      <header>
        <div>
          <strong>{topic === "process" ? "处理过程" : topic === "artifacts" ? "产物与版本" : "规则证据"}</strong>
        </div>
        <button type="button" onClick={onPin} aria-label={pinned ? "取消固定" : "固定面板"}>
          {pinned ? <PinOff size={15} /> : <Pin size={15} />}
        </button>
      </header>
      {topic === "process" ? <ProcessContent /> : null}
      {topic === "artifacts" ? <ArtifactsContent onArtifactPreview={onArtifactPreview} /> : null}
      {topic === "evidence" ? <EvidenceContent /> : null}
    </section>
  );
}

function ProcessContent() {
  const steps = ["读取用户输入", "识别 DMPK / PK 业务线", "检查计价关键字段", "同步报价参数台账"];
  return (
    <div className="sideProcessChain">
      {steps.map((item, index) => (
        <p key={item} style={{ animationDelay: `${index * 70}ms` }}>
          <i />
          <span>
            <strong>{item}</strong>
            <small>{processStepDetail(item)}</small>
          </span>
        </p>
      ))}
    </div>
  );
}

function EvidenceContent() {
  return (
    <div className="sidePanelRows">
      <p><i />动物种属、组数、周期用于匹配动物实验规则。</p>
      <p><i />分析方法、样品类型、待测物数量用于匹配生物分析规则。</p>
      <p><i />Word 管理费 30%，Excel 管理费 15%，生成后校验金额一致。</p>
    </div>
  );
}

function ArtifactsContent({ onArtifactPreview }: { onArtifactPreview: (kind: "word" | "excel") => void }) {
  return (
    <div className="artifactList">
      <VersionCard title="v1 中文 Word / Excel" status="已生成" />
      <VersionCard title="v2 英文报价单" status="未开始" />
      <ArtifactRow title="中文 Word 报价单" meta="30% 管理费 · 金额一致" onPreview={() => onArtifactPreview("word")} />
      <ArtifactRow title="Excel 报价明细" meta="15% 管理费 · 金额一致" onPreview={() => onArtifactPreview("excel")} />
    </div>
  );
}

function VersionCard({ title, status }: { title: string; status: string }) {
  return (
    <article className="versionCard">
      <strong>{title}</strong>
      <span>{status}</span>
    </article>
  );
}

function ArtifactRow({ title, meta, onPreview }: { title: string; meta: string; onPreview: () => void }) {
  return (
    <article className="panelArtifactRow">
      <FileText size={17} />
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      <button type="button" onClick={onPreview}>
        <Eye size={15} />
      </button>
    </article>
  );
}

function QuotationPreviewModal({ fields, onClose }: { fields: Field[]; onClose: () => void }) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <section className="previewModal">
        <header>
          <div>
            <span>报价前确认</span>
            <h2>完整参数与计价规则预览</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="previewBody">
          <div className="previewContent">
            <PreviewTable title="报价参数" rows={fields.map((field) => [groupTitle(field.group), field.label, field.value])} />
            <div className="previewNotice">
              <Check size={17} />
              <span>计价关键字段已齐全。Word 报价单使用 30% 管理费，Excel 报价明细使用 15% 管理费，生成后将进行金额一致性校验。</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ArtifactPreviewModal({ kind, onClose }: { kind: "word" | "excel"; onClose: () => void }) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <section className="previewModal artifactPreviewModal">
        <header>
          <div>
            <span>产物预览</span>
            <h2>{kind === "word" ? "中文 Word 报价单" : "Excel 报价明细"}</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="previewContent">
          <PreviewTable
            title={kind === "word" ? "Word 报价单预览" : "Excel 报价明细预览"}
            rows={[
              ["检测类型", "PK检测", "DMPK 业务线已确认"],
              ["动物实验", "SD大鼠 · 2组 · 每组2只 · 1周", "已匹配动物实验计价规则"],
              ["生物分析", "LC-MS/MS · 血浆 · 3点 · 1个待测物", "已匹配生物分析计价规则"],
              ["金额校验", "页面 / Word / Excel 一致", kind === "word" ? "中文编码与表格边框已校验" : "管理费 15% 已应用"],
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function PreviewTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="previewTableWrap">
      <h3>{title}</h3>
      <table className="previewTable">
        <thead>
          <tr>
            <th>类别</th>
            <th>项目</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")}>
              <td>{row[0]}</td>
              <td>{row[1]}</td>
              <td>{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
