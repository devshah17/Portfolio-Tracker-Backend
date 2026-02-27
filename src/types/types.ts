export type SendMail = {
  subject: string;
  body: string;
  to: string;
  templateName?: string;
  replacements?: object;
  consoleMessage?: string;
};
