"use client";

import { EnvironmentOutlined, GlobalOutlined, MailOutlined, PhoneOutlined } from "@ant-design/icons";
import { Card, Typography } from "antd";

import { ContactMessageForm } from "@/components/marketing/contact-message-form";

export function ContactPanels() {
  return <section className="contact-panels" aria-label="Contact Yueshou">
    <Card className="contact-panel" title="Get In Touch">
      <div className="contact-details-list">
        <div className="contact-detail-item"><div className="contact-detail-item__label"><EnvironmentOutlined /><strong>Address</strong></div><Typography.Paragraph>Room 332, 3rd Floor, No. 55 Guangcong 3rd Road, Taihe Town, Baiyun District, Guangzhou</Typography.Paragraph></div>
        <div className="contact-detail-item"><div className="contact-detail-item__label"><PhoneOutlined /><strong>Tel</strong></div><Typography.Paragraph><a href="tel:+8613435855558">+86 134 3585 5558</a></Typography.Paragraph></div>
        <div className="contact-detail-item"><div className="contact-detail-item__label"><MailOutlined /><strong>Email</strong></div><Typography.Paragraph><a href="mailto:business@yueshou-peptide.com">business@yueshou-peptide.com</a></Typography.Paragraph></div>
        <div className="contact-detail-item"><div className="contact-detail-item__label"><GlobalOutlined /><strong>Website</strong></div><Typography.Paragraph><a href="https://www.yueshou-peptide.com" target="_blank" rel="noopener noreferrer">www.yueshou-peptide.com</a></Typography.Paragraph></div>
      </div>
    </Card>
    <Card className="contact-panel" title="Send Us a Message"><ContactMessageForm /></Card>
  </section>;
}
