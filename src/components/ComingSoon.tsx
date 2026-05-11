import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ComingSoonProps {
  /** 页面标题 i18n key,例如 "calendar.title" */
  titleKey: string;
  /** 文案 i18n key,例如 "calendar.comingSoon" */
  bodyKey: string;
}

/**
 * 占位空页 — 给 Calendar/Reflect/Chat/Telos 这些 P1 还没实现的 tab 用
 */
export function ComingSoon({ titleKey, bodyKey }: ComingSoonProps) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col">
      <header className="h-14 px-6 flex items-center border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t(titleKey)}
        </h1>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-5">
            <Construction className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            {t("common.comingSoon")}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {t(bodyKey)}
          </p>
        </div>
      </div>
    </div>
  );
}
