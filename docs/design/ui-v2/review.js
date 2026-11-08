/* Standalone design review; never loaded by the product. No network or persistence. */
"use strict";
const tools = window.DESIGN_TOOLS;
const app = document.getElementById("app");
const dialog = document.getElementById("dialog");
const objectUrls = new Set();
const groups = ["全部工具", "图片处理", "视频与内容", "音频工具", "开发工具", "文件协作"];
let category = "全部工具";
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
const img = (tool, cls = "") =>
  '<img class="' + cls + '" src="icons/' + tool.id + '.png" alt="' + esc(tool.title) + '">';
const button = (label, cls = "", attrs = "") => '<button class="' + cls + '" ' + attrs + ">" + label + "</button>";
const demo = (label, cls = "") => button(label, cls, 'data-demo="' + esc(label) + '"');
const select = (options, id = "") =>
  "<select" +
  (id ? ' id="' + id + '"' : "") +
  ">" +
  options.map((x) => "<option>" + esc(x) + "</option>").join("") +
  "</select>";
function message(title, text) {
  document.getElementById("dialog-title").textContent = title;
  document.getElementById("dialog-body").textContent = text;
  if (!dialog.open) dialog.showModal();
}
document.getElementById("close-dialog").onclick = () => dialog.close();
document.addEventListener("click", (event) => {
  const b = event.target.closest("[data-demo]");
  if (b) message(b.dataset.demo, "这是设计样机中的操作入口。不会启动任务、修改数据、导入、删除或连接真实业务服务。");
});
function home() {
  app.innerHTML =
    '<section class="hero"><div><h1>让素材工作，更简单。</h1><p>图片、视频、音频与开发工具，一站直达。</p><a href="#video-ai">继续上次使用：视频去字幕 →</a></div><img class="hero-art" src="hero.png" alt="素材工具箱插画"></section>' +
    '<input id="search" class="search" aria-label="搜索工具" placeholder="搜索工具名称或用途，例如：提取音频、视频去字幕">' +
    '<nav class="categories" aria-label="工具分类">' +
    groups
      .map((g) =>
        button(
          esc(g) + " " + (g === "全部工具" ? tools.length : tools.filter((t) => t.group === g).length),
          g === category ? "active" : "",
          'data-group="' + g + '"'
        )
      )
      .join("") +
    '</nav><section class="tool-grid" id="tool-grid"></section>';
  document.getElementById("search").oninput = fillTools;
  app.querySelectorAll("[data-group]").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.group;
        app.querySelectorAll("[data-group]").forEach((el) => el.classList.toggle("active", el === b));
        fillTools();
      })
  );
  fillTools();
}
function fillTools() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const found = tools.filter(
    (t) =>
      (category === "全部工具" || t.group === category) && (t.title + t.desc + t.group).toLowerCase().includes(query)
  );
  document.getElementById("tool-grid").innerHTML =
    found
      .map(
        (t) =>
          '<a class="tool-card ' +
          (t.id === "lan-transfer" ? "wide" : "") +
          '" href="#' +
          t.id +
          '"><span class="icon-frame">' +
          img(t) +
          '</span><div class="card-copy"><h2>' +
          t.title +
          "</h2><p>" +
          t.desc +
          '</p><div class="card-bottom"><span class="tag">' +
          t.group +
          '</span><span class="arrow">打开工具 →</span></div></div></a>'
      )
      .join("") || '<div class="empty">未找到匹配的工具，请清除关键词或切换分类。</div>';
}
function heading(t) {
  return (
    '<nav class="breadcrumb"><a href="#home">返回首页</a><span>' +
    t.group +
    "</span><span>" +
    t.title +
    '</span></nav><header class="page-title"><span class="icon-frame">' +
    img(t) +
    "</span><div><h1>" +
    t.title +
    "</h1><p>" +
    t.desc +
    '</p></div><a class="screen-link" href="#screens:' +
    t.id +
    '">查看本模块效果图</a></header>'
  );
}
function drop(title, accept, multiple = false) {
  return (
    '<div class="drop"><h3>' +
    title +
    '</h3><p>选择本机文件查看输入状态；样机不会上传或处理文件。</p><input id="file" type="file" aria-label="' +
    title +
    '" accept="' +
    accept +
    '" ' +
    (multiple ? "multiple" : "") +
    '><small id="file-info">尚未选择文件</small></div>'
  );
}
function history(title, note) {
  return (
    '<section class="panel"><div class="section-head"><div><h2>' +
    title +
    "</h2><p>共 0 条 · 设计样机不读取真实记录</p></div>" +
    demo("刷新") +
    '</div><div class="empty">记录区空状态 · 完成任务后在此查看结果</div><div class="pagination"><span>共 0 条</span><button disabled>上一页</button><button disabled>1</button><button disabled>下一页</button></div><p class="design-help">' +
    note +
    "</p></section>"
  );
}
function uploadPage(t) {
  const image = t.id === "image-compress";
  const extract = t.id === "audio-extract";
  const label = image ? "添加图片" : extract ? "上传视频" : "选择音频";
  const options = image
    ? "<label><span>压缩预设</span>" +
      select(["均衡", "高清", "极小"]) +
      "</label><label><span>输出格式</span>" +
      select(["JPEG", "PNG", "WebP"]) +
      '</label><label><span>图片质量</span><input type="range" min="1" max="100" value="78"></label><label><span>宽度限制</span><input type="number" placeholder="保持原始宽度"></label>'
    : "<label><span>输出格式</span>" +
      select(["MP3"]) +
      "</label><label><span>音质 / 码率</span>" +
      select(["192 kbps · 均衡", "128 kbps", "256 kbps", "320 kbps"]) +
      "</label><p>码率影响音质与体积；提高码率不能恢复已丢失的音频细节。</p>";
  app.innerHTML =
    heading(t) +
    '<div class="workspace"><section class="panel">' +
    drop(label, image ? "image/*" : extract ? "video/*,.mkv,.avi" : "audio/*,.ogg,.flac,.mgg,.mflac", true) +
    (extract
      ? '<div class="toolbar" style="margin-top:16px"><label>识别音轨 ' +
        select(["选择视频后读取音轨"]) +
        "</label></div>"
      : "") +
    '</section><aside class="panel settings"><h2>处理设置</h2>' +
    options +
    demo(image ? "开始压缩" : extract ? "开始提取" : "开始转换", "primary") +
    "</aside></div>" +
    history(
      image ? "压缩记录" : extract ? "提取记录" : "转换记录",
      "保留、过期与删除规则沿用现有模块；本次只调整呈现方式。"
    );
}
function imageAI(t) {
  app.innerHTML =
    heading(t) +
    '<nav class="tabs" id="image-tabs">' +
    ["去水印", "变清晰", "抠图", "处理记录"]
      .map((s, i) => button(s, i === 0 ? "active" : "", 'data-tab="' + s + '"'))
      .join("") +
    '</nav><div class="workspace"><section class="panel">' +
    drop("添加待处理图片", "image/*", true) +
    '<div class="empty" id="image-mode">去水印：上传图片后确认修复区域</div></section><aside class="panel settings"><h2>处理设置</h2><div class="model-panel">本地处理 · 模型状态由正式应用提供</div><p id="image-config">支持区域确认与手动调整。</p>' +
    demo("开始处理", "primary") +
    "</aside></div>" +
    history("处理记录", "成功与部分成功结果长期保留，手动删除；编辑结果保持独立快照。");
  app.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        app.querySelectorAll("[data-tab]").forEach((e) => e.classList.toggle("active", e === b));
        document.getElementById("image-mode").textContent =
          b.dataset.tab === "处理记录"
            ? "历史区布局：分页、筛选、选择与批量删除。"
            : b.dataset.tab + "：上传图片后继续配置";
        document.getElementById("image-config").textContent =
          b.dataset.tab === "变清晰"
            ? "增强倍率：2× / 4×。"
            : b.dataset.tab === "抠图"
              ? "抠图结果可进入商品图编辑器，调整背景与主图布局。"
              : "按当前功能显示参数，不混用不同任务状态。";
      })
  );
}
function video(t) {
  app.innerHTML =
    heading(t) +
    '<div class="workspace"><section class="panel"><div class="toolbar"><label class="primary">上传视频 <input id="file" type="file" accept="video/*,.mkv,.avi"></label><small id="file-info">尚未选择文件</small></div><div class="video-stage" id="video-stage"><h3>选择视频后在这里预览</h3><p>按实际比例显示，框选与时间线共享当前帧。</p></div><section class="timeline"><div class="toolbar"><h3>字幕时间线</h3>' +
    button("添加区间", "primary", 'id="add-interval"') +
    '<label><input type="checkbox" checked>自动吸附</label></div><label>指针 <output id="time-output">0.00</output> 秒<input id="time" type="range" min="0" max="24" step="0.01" value="0" aria-label="视频指针"></label><div class="timeline-ruler"><span>0s</span><span>6s</span><span>12s</span><span>18s</span><span>24s · 示例刻度</span></div><div class="intervals" id="intervals"></div><p class="design-help">区间拖动、吸附、缩放和快捷键沿用正式模块；样机仅演示指针与添加区间。</p></section></section><aside class="panel settings"><h2>修复档位</h2><div class="mode-grid">' +
    ["极速", "快速", "均衡", "极致"].map((s, i) => button(s, i === 2 ? "active" : "", "data-mode")).join("") +
    '</div><p>使用现有引擎，不新增模型或能力包。</p><hr><h3>字幕区域</h3><p>当前区间：尚未框选</p><div class="toolbar">' +
    demo("自动识别字幕") +
    demo("手动框选") +
    "</div>" +
    demo("开始处理", "primary") +
    "</aside></div>" +
    history("处理历史", "保留原片、处理结果、区间与框选信息，支持选择原片或结果再次编辑。");
  app.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        app.querySelectorAll("[data-mode]").forEach((e) => e.classList.toggle("active", e === b));
      })
  );
  const time = document.getElementById("time");
  time.oninput = () => {
    document.getElementById("time-output").textContent = Number(time.value).toFixed(2);
    const v = document.getElementById("local-video");
    if (v && Number.isFinite(v.duration)) v.currentTime = Math.min(Number(time.value), v.duration);
  };
  document.getElementById("add-interval").onclick = () => {
    const b = document.createElement("button");
    b.className = "interval";
    b.textContent = "区间起点 " + Number(time.value).toFixed(2) + "s";
    b.onclick = () => message("区间示意", "正式模块沿用现有区间与框选编辑能力；此处展示起点取指针位置。");
    document.getElementById("intervals").append(b);
  };
}
function archive(t) {
  app.innerHTML =
    heading(t) +
    '<section class="panel"><div class="toolbar"><input class="grow" placeholder="粘贴小红书、抖音或 TikTok 作品链接" aria-label="作品链接">' +
    demo("获取并存档", "primary") +
    demo("批量上传视频") +
    demo("表格批量归档") +
    demo("TikTok 主页归档") +
    '</div><div class="toolbar"><label>来源平台 ' +
    select(["自动识别", "小红书", "抖音", "TikTok"]) +
    "</label><label>归档分组 " +
    select(["不指定分组", "示例分组"]) +
    '</label></div></section><div class="toolbar"><label>作品分组 ' +
    select(["全部分组", "未分组", "示例分组"]) +
    "</label>" +
    demo("新建分组") +
    demo("管理分组") +
    '</div><section class="panel"><div class="toolbar"><input class="grow" placeholder="搜索标题、正文或作者" aria-label="搜索归档">' +
    select(["全部类型", "视频", "图文"]) +
    select(["全部平台", "本地上传", "TikTok", "抖音", "小红书"]) +
    select(["全部发布状态", "已发布", "未发布"]) +
    select(["发布时间：从新到旧", "发布时间：从旧到新", "归档时间：从新到旧", "归档时间：从旧到新"]) +
    '</div><div class="toolbar"><label><input type="checkbox">全选本页</label><span>共 0 条</span><span class="count"></span>' +
    demo("刷新") +
    demo("补全未翻译内容") +
    button("卡片", "active", "data-view") +
    button("列表", "", "data-view") +
    '</div><div class="empty" id="archive-empty">卡片视图 · 样机没有读取您的归档内容</div><div class="pagination"><span>共 0 条</span><label>每页 ' +
    select(["50", "100", "200", "500"]) +
    '</label><button disabled>上一页</button><button disabled>1</button><button disabled>下一页</button></div></section><section class="panel"><h2>详情与视频编辑的布局落点</h2><p>详情保持居中弹窗；保留发布标记、下载、截帧、配乐、水印及图集生成视频入口。</p><div class="toolbar" style="margin-top:14px">' +
    demo("查看详情布局") +
    demo("编辑配乐布局") +
    demo("编辑水印布局") +
    '</div><p class="design-help">正式实施时沿用任务及数据机制；取消发布标记、删除等确认流程保持不变。</p></section>';
  app.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        app.querySelectorAll("[data-view]").forEach((e) => e.classList.toggle("active", e === b));
        document.getElementById("archive-empty").textContent = b.textContent + "视图 · 样机没有读取您的归档内容";
      })
  );
}
function speech(t) {
  app.innerHTML =
    heading(t) +
    '<nav class="tabs">' +
    button("在线配音", "active", "data-engine") +
    button("参考音色克隆", "", "data-engine") +
    '</nav><div class="workspace"><section class="panel"><h2>有序文案</h2><div class="toolbar" style="margin-top:14px"><input class="grow" placeholder="批次名称（可选）">' +
    demo("智能识别分段") +
    '</div><textarea rows="7" aria-label="配音原文" placeholder="输入目标语言原文"></textarea><textarea rows="3" aria-label="中文翻译" placeholder="中文翻译（可选，不参与配音）"></textarea><div class="toolbar" style="margin-top:12px">' +
    demo("添加分段") +
    demo("参考音色库") +
    '</div></section><aside class="panel settings"><h2>生成设置</h2><label><span>目标语言</span>' +
    select(["Bahasa Melayu", "English", "Português BR"]) +
    "</label><label><span>音色 / 参考音色</span>" +
    select(["选择音色"]) +
    "</label><label><span>运行设备（克隆引擎）</span>" +
    select(["按已安装能力选择 CPU / GPU"]) +
    "</label>" +
    demo("添加到生成队列", "primary") +
    '<p class="design-help">队列、语言、取消边界及字幕规则保持现状。</p></aside></div>' +
    history("配音批次", "配音产物和参考音色的现有保留规则不因视觉改造变化。");
  app
    .querySelectorAll("[data-engine]")
    .forEach(
      (b) =>
        (b.onclick = () => app.querySelectorAll("[data-engine]").forEach((e) => e.classList.toggle("active", e === b)))
    );
}
function library(t) {
  app.innerHTML =
    heading(t) +
    '<section class="panel"><div class="toolbar"><input class="grow" placeholder="搜索音频名称" aria-label="搜索音频">' +
    select(["全部素材", "背景音乐", "配音素材"]) +
    select(["全部分组", "未分组"]) +
    demo("上传音频", "primary") +
    demo("管理分组") +
    '</div><div class="toolbar">' +
    demo("回收站") +
    demo("播放预设") +
    demo("备份与恢复") +
    '</div><div class="empty">音频素材列表 · 共 0 条<br>点击试听后在此展开波形，播放器保持应用级生命周期。</div><div class="pagination"><span>共 0 条</span><button disabled>1</button></div></section><section class="panel"><h2>播放区</h2><p>尚未选择素材。正式页面复用现有波形与播放器，不另建播放器状态。</p></section>';
}
function lan(t) {
  app.innerHTML =
    heading(t) +
    '<section class="panel"><div class="section-head"><h2>局域网访问</h2>' +
    demo("查看地址与二维码") +
    '</div><p>地址从运行中的应用读取；样机不显示伪造的局域网地址。</p></section><nav class="tabs">' +
    button("文件传输", "active", "data-lan") +
    button("图文快传", "", "data-lan") +
    '</nav><section class="panel">' +
    drop("选择要传输的文件", "*", true) +
    '<div class="toolbar" style="margin-top:16px">' +
    demo("发送文件", "primary") +
    "</div></section>" +
    history("传输记录", "访客权限、分片、续传、延期、配额与过期规则保持现状。");
  app
    .querySelectorAll("[data-lan]")
    .forEach(
      (b) =>
        (b.onclick = () => app.querySelectorAll("[data-lan]").forEach((e) => e.classList.toggle("active", e === b)))
    );
}
function developer(t) {
  const uuid = t.id === "uuid-generator",
    json = t.id === "json-format";
  app.innerHTML =
    heading(t) +
    '<section class="panel"><div class="toolbar">' +
    (uuid
      ? '<label>生成数量 <input id="quantity" type="number" min="1" max="1000" value="5"></label>'
      : json
        ? select(["2 空格", "4 空格", "Tab"], "indent")
        : select(["编码", "解码"], "operation")) +
    button(uuid ? "生成 UUID" : json ? "格式化" : "开始处理", "primary", 'id="run"') +
    (json ? button("压缩", "", 'id="minify"') : "") +
    button("清空", "", 'id="clear"') +
    '<span class="count">内容仅在本页内存中处理，不上传、不保存历史。</span></div>' +
    (uuid
      ? '<label>生成结果<textarea id="output" class="editor" readonly aria-label="生成结果"></textarea></label>'
      : '<div class="two-up"><label><h3>输入</h3><textarea id="input" class="editor" spellcheck="false" aria-label="输入文本"></textarea></label><label><div class="section-head"><h3>输出</h3>' +
        button("复制结果", "", 'id="copy"') +
        '</div><textarea id="output" class="editor" readonly spellcheck="false" aria-label="输出文本"></textarea></label></div>') +
    (uuid ? '<div class="toolbar">' + button("复制结果", "", 'id="copy"') + "</div>" : "") +
    '<div class="feedback" id="feedback" role="status">准备就绪</div><p class="design-help">此处仅演示小文本交互。文件模式、格式选项、限额和完整校验继续以现有模块实现为准。</p></section>';
  if (json) document.getElementById("input").value = '{"product":"草本茶","platform":"TikTok","published":true}';
  const output = document.getElementById("output"),
    feedback = document.getElementById("feedback");
  const run = (minify) => {
    try {
      let result = "";
      const input = document.getElementById("input");
      if (uuid) {
        const n = Number(document.getElementById("quantity").value);
        if (!Number.isInteger(n) || n < 1 || n > 1000) throw Error("请输入 1–1000 的整数");
        result = Array.from({ length: n }, () => {
          const b = crypto.getRandomValues(new Uint8Array(16));
          b[6] = (b[6] & 15) | 64;
          b[8] = (b[8] & 63) | 128;
          const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
          return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join("-");
        }).join("\n");
      } else if (json) {
        const indent = document.getElementById("indent").value;
        result = JSON.stringify(
          JSON.parse(input.value),
          null,
          minify ? 0 : indent === "Tab" ? "\t" : indent === "4 空格" ? 4 : 2
        );
      } else {
        const decode = document.getElementById("operation").value === "解码";
        if (t.id === "url-codec") result = decode ? decodeURIComponent(input.value) : encodeURIComponent(input.value);
        else if (decode)
          result = new TextDecoder("utf-8", { fatal: true }).decode(
            Uint8Array.from(atob(input.value), (c) => c.charCodeAt(0))
          );
        else {
          const bytes = new TextEncoder().encode(input.value);
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          result = btoa(binary);
        }
      }
      output.value = result;
      feedback.textContent = "处理完成 · " + result.length + " 个字符";
    } catch (error) {
      output.value = "";
      feedback.textContent = "输入错误：" + error.message;
    }
  };
  document.getElementById("run").onclick = () => run(false);
  if (json) document.getElementById("minify").onclick = () => run(true);
  document.getElementById("clear").onclick = () => {
    output.value = "";
    const input = document.getElementById("input");
    if (input) input.value = "";
    feedback.textContent = "已清空当前页内容";
  };
  document.getElementById("copy").onclick = async () => {
    try {
      if (!navigator.clipboard) throw Error("当前本地页面不支持剪贴板接口，请选中文本复制");
      await navigator.clipboard.writeText(output.value);
      feedback.textContent = "已复制";
    } catch (e) {
      feedback.textContent = e.message;
    }
  };
}
function icons() {
  app.innerHTML =
    '<div class="breadcrumb"><a href="#home">返回首页</a></div><h1>13 个独立图标</h1><p>原始透明 PNG；下方按 48px 与 32px 图片框展示，保留原始透明留白。生成资产未裁切或重采样。</p><section class="gallery" style="margin-top:24px">' +
    tools
      .map(
        (t) =>
          "<figure>" +
          img(t, "icon-large") +
          "<h3>" +
          t.title +
          "</h3><p>" +
          t.id +
          '.png</p><div class="small-sizes">' +
          img(t, "").replace("<img ", '<img width="48" height="48" ') +
          img(t, "").replace("<img ", '<img width="32" height="32" ') +
          '</div><a href="icons/' +
          t.id +
          '.png" download>下载原图</a></figure>'
      )
      .join("") +
    "</section>";
}
function screens(moduleId = "") {
  const inventory = window.DESIGN_SCREENS;
  const current = inventory.some((screen) => screen.moduleId === moduleId) ? moduleId : "";
  const list = current ? inventory.filter((screen) => screen.moduleId === current) : inventory;
  app.innerHTML =
    '<div class="breadcrumb"><a href="#home">返回首页</a></div><h1>同风格效果图</h1><p>首页 + 13 个模块的独立主页面。图中文字、数值与细节不作为业务契约；实际图标以独立 PNG 为准。</p>' +
    '<div class="toolbar screen-filter"><label>查看页面 <select id="screen-filter"><option value="">全部 14 张</option>' +
    inventory
      .map(
        (screen) =>
          '<option value="' +
          esc(screen.moduleId) +
          '"' +
          (screen.moduleId === current ? " selected" : "") +
          ">" +
          esc(screen.title) +
          "</option>"
      )
      .join("") +
    '</select></label><span class="muted">当前显示 ' +
    list.length +
    " 张</span></div>" +
    list
      .map(
        ({ file, title, moduleId: target }) =>
          '<section class="screen-section"><h2>' +
          esc(title) +
          '</h2><div class="toolbar"><a href="' +
          esc(file) +
          '" target="_blank" rel="noopener">打开原图</a><a href="#' +
          esc(target) +
          '">查看布局样机</a></div><img class="reference-screen" loading="lazy" src="' +
          esc(file) +
          '" alt="' +
          esc(title) +
          '设计效果图"></section>'
      )
      .join("");
  const screenFilter = document.getElementById("screen-filter");
  screenFilter.value = current;
  screenFilter.onchange = (event) => {
    location.hash = event.target.value ? "screens:" + event.target.value : "screens";
  };
}
function wireFile() {
  const input = document.getElementById("file");
  if (!input) return;
  input.onchange = () => {
    const files = Array.from(input.files || []);
    const info = document.getElementById("file-info");
    if (info) info.textContent = files.length ? files.map((f) => f.name).join("、") : "尚未选择文件";
    const stage = document.getElementById("video-stage");
    if (stage && files[0]) {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
      const url = URL.createObjectURL(files[0]);
      objectUrls.add(url);
      const v = document.createElement("video");
      v.id = "local-video";
      v.controls = true;
      v.src = url;
      stage.replaceChildren(v);
      v.onloadedmetadata = () => {
        if (Number.isFinite(v.duration)) document.getElementById("time").max = String(v.duration);
      };
      v.ontimeupdate = () => {
        document.getElementById("time").value = String(v.currentTime);
        document.getElementById("time-output").textContent = v.currentTime.toFixed(2);
      };
    }
  };
}
function render() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
  if (dialog.open) dialog.close();
  const id = location.hash.slice(1) || "home";
  if (id === "home") home();
  else if (id === "icons") icons();
  else if (id === "screens") screens();
  else if (id.startsWith("screens:")) screens(id.slice("screens:".length));
  else {
    const t = tools.find((t) => t.id === id);
    if (!t) {
      app.innerHTML = '<div class="empty">未找到设计页。<a href="#home">返回首页</a></div>';
      return;
    }
    if (t.group === "开发工具") developer(t);
    else if (t.id === "content-archive") archive(t);
    else if (t.id === "video-ai") video(t);
    else if (t.id === "image-ai") imageAI(t);
    else if (t.id === "speech") speech(t);
    else if (t.id === "audio-library") library(t);
    else if (t.id === "lan-transfer") lan(t);
    else uploadPage(t);
    wireFile();
  }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);
window.addEventListener("pagehide", () => {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.isComposing &&
    !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) &&
    !event.target.isContentEditable
  ) {
    const search = document.getElementById("search");
    if (search) {
      event.preventDefault();
      search.focus();
    }
  }
});
render();
