import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RotateCw } from "lucide-react";

/**
 * 顶层错误边界
 *
 * 抓 React 渲染中未捕获的异常,显示友好错误页(代替白屏)。
 * 用户能看到错误摘要 + 一个"重新加载"按钮。
 *
 * 注:async / promise 抛出不会被 ErrorBoundary 抓(那是 React 限制)。
 * 我们的 store/db/LLM async 错都在 try/catch + console 处理,UI 通过 toast(P3)+ confirm 提示。
 */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4 text-red-500">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              页面出错了
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              错误信息已记录到 console。你可以重新加载继续使用。
            </p>
            <pre className="text-xs text-left bg-zinc-100 dark:bg-zinc-900 rounded-lg p-3 mb-4 overflow-x-auto text-red-600 dark:text-red-400 max-h-32 overflow-y-auto">
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:text-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white rounded-lg transition-colors"
            >
              <RotateCw className="w-4 h-4" />
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
