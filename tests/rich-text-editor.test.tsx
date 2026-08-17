import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { RichTextEditor } from "@/components/admin/rich-text-editor";

function ControlledEditor({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <RichTextEditor label="正文" value={value} onChange={setValue} />;
}

describe("RichTextEditor", () => {
  it("does not rewrite the editable DOM or move the caret after input", () => {
    render(<ControlledEditor initialValue="<p>已有内容</p>" />);
    const editor = screen.getByRole("textbox", { name: "正文" });
    const paragraph = editor.querySelector("p");
    const text = paragraph?.firstChild;
    expect(text).toBeInstanceOf(Text);

    text!.textContent = "已有内容a";
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(text!, 5);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    fireEvent.input(editor);

    expect(editor).toHaveTextContent("已有内容a");
    expect(window.getSelection()?.anchorNode).toBe(text);
    expect(window.getSelection()?.anchorOffset).toBe(5);
  });

  it("still applies a genuinely new external value", () => {
    const { getByRole, rerender } = render(<RichTextEditor label="外部正文" value="<p>旧内容</p>" />);
    const editor = getByRole("textbox", { name: "外部正文" });

    rerender(<RichTextEditor label="外部正文" value="<p>新内容</p>" />);

    expect(editor).toHaveTextContent("新内容");
  });
});
