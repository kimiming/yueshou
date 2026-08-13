"use client";

import { Button, Divider, Input, Select, Space, Tooltip } from "antd";
import { useEffect, useRef, useState } from "react";

type RichTextEditorProps = {
  id?: string;
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
};

const blockOptions = [
  { value: "p", label: "正文" },
  { value: "h2", label: "标题 2" },
  { value: "h3", label: "标题 3" },
  { value: "h4", label: "标题 4" },
  { value: "blockquote", label: "引用" },
  { value: "pre", label: "代码块" },
];

function sanitizeEditorHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, "")
    .replace(/<style[\s\S]*?<\/style>/giu, "");
}

export function RichTextEditor({ id, label, value = "", onChange, placeholder = "输入产品内容" }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    if (!editorRef.current || value === lastValueRef.current) return;
    editorRef.current.innerHTML = value;
    lastValueRef.current = value;
  }, [value]);

  const emitChange = () => {
    const html = sanitizeEditorHtml(editorRef.current?.innerHTML ?? "");
    lastValueRef.current = html;
    onChange?.(html);
  };

  const focusEditor = () => editorRef.current?.focus();
  const command = (name: string, commandValue?: string) => {
    focusEditor();
    document.execCommand(name, false, commandValue);
    emitChange();
  };

  const insertTable = () => {
    command("insertHTML", "<table><tbody><tr><th scope=\"col\">标题</th><th scope=\"col\">内容</th></tr><tr><td>项目</td><td>说明</td></tr></tbody></table><p><br></p>");
  };

  const applyLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) return;
    command("createLink", trimmed);
    setLinkUrl("");
  };

  return (
    <div className="admin-rich-editor">
      <div className="admin-rich-editor__toolbar" aria-label="富文本工具栏">
        <Select aria-label="段落格式" defaultValue="p" options={blockOptions} onChange={(tag) => command("formatBlock", tag)} style={{ width: 112 }} />
        <Space.Compact>
          <Tooltip title="加粗"><Button htmlType="button" onClick={() => command("bold")}><strong>B</strong></Button></Tooltip>
          <Tooltip title="斜体"><Button htmlType="button" onClick={() => command("italic")}><em>I</em></Button></Tooltip>
          <Tooltip title="下划线"><Button htmlType="button" onClick={() => command("underline")}><u>U</u></Button></Tooltip>
        </Space.Compact>
        <Space.Compact>
          <Tooltip title="黄色高亮"><Button htmlType="button" onClick={() => command("backColor", "#fff3a3")}>高亮</Button></Tooltip>
          <Tooltip title="蓝色字体"><Button htmlType="button" onClick={() => command("foreColor", "#0b63ce")}>蓝字</Button></Tooltip>
        </Space.Compact>
        <Space.Compact>
          <Tooltip title="左对齐"><Button htmlType="button" onClick={() => command("justifyLeft")}>左</Button></Tooltip>
          <Tooltip title="居中"><Button htmlType="button" onClick={() => command("justifyCenter")}>中</Button></Tooltip>
          <Tooltip title="右对齐"><Button htmlType="button" onClick={() => command("justifyRight")}>右</Button></Tooltip>
        </Space.Compact>
        <Space.Compact>
          <Tooltip title="无序列表"><Button htmlType="button" onClick={() => command("insertUnorderedList")}>列表</Button></Tooltip>
          <Tooltip title="有序列表"><Button htmlType="button" onClick={() => command("insertOrderedList")}>编号</Button></Tooltip>
        </Space.Compact>
        <Tooltip title="插入表格"><Button htmlType="button" onClick={insertTable}>表格</Button></Tooltip>
        <Space.Compact className="admin-rich-editor__link">
          <Input aria-label="链接地址" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://..." />
          <Button htmlType="button" onClick={applyLink}>链接</Button>
        </Space.Compact>
        <Divider orientation="vertical" />
        <Tooltip title="清除格式"><Button htmlType="button" onClick={() => command("removeFormat")}>清除格式</Button></Tooltip>
      </div>
      <div
        id={id}
        ref={editorRef}
        className="admin-rich-editor__surface"
        contentEditable
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={emitChange}
        onBlur={emitChange}
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        suppressContentEditableWarning
      />
    </div>
  );
}
