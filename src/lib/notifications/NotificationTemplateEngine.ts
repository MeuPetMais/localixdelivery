// TemplateEngine — carrega templates e faz interpolação {{var}}.
import type { NotificationChannel, NotificationRenderResult, NotificationTemplate } from "./types";

export interface TemplateRepo {
  find(code: string, channel: NotificationChannel, language: string): Promise<NotificationTemplate | null>;
}

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function renderString(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(VAR_RE, (_, key: string) => {
    const parts = key.split(".");
    let v: unknown = vars;
    for (const p of parts) {
      if (v && typeof v === "object" && p in (v as any)) v = (v as any)[p];
      else return "";
    }
    return v == null ? "" : String(v);
  });
}

export class NotificationTemplateEngine {
  constructor(private readonly repo: TemplateRepo) {}

  async render(
    code: string,
    channel: NotificationChannel,
    language: string,
    vars: Record<string, unknown>,
  ): Promise<NotificationRenderResult> {
    const tpl = await this.repo.find(code, channel, language);
    if (!tpl) throw new Error(`template_not_found:${code}:${channel}:${language}`);
    if (!tpl.enabled) throw new Error(`template_disabled:${code}`);
    return {
      subject: tpl.subject ? renderString(tpl.subject, vars) : null,
      title: tpl.title ? renderString(tpl.title, vars) : null,
      body: renderString(tpl.body, vars),
    };
  }
}
