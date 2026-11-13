export const gmailThreadUrl = (mailbox: string, threadId: string | null) =>
  threadId ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(mailbox)}#all/${threadId}` : null;
export const mailboxLabel = (mailbox: string) => mailbox.split('@')[0] + '@';
