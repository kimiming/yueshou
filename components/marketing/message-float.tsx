"use client";

import { Button, Modal, Tooltip } from "antd";
import { useState } from "react";

import { ContactMessageForm } from "@/components/marketing/contact-message-form";

export function MessageFloat() {
  const [open, setOpen] = useState(false);
  return <>
    <Tooltip title="Send us a message" placement="left">
      <button className="message-float" type="button" onClick={() => setOpen(true)} aria-label="Send us a message">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5v2h12V8H6Zm0 4v2h8v-2H6Z" /></svg>
      </button>
    </Tooltip>
    <Modal title="Send Us a Message" open={open} onCancel={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>Close</Button>} width={560} destroyOnHidden>
      <ContactMessageForm />
    </Modal>
  </>;
}
