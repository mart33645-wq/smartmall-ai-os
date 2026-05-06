import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { translations } from '../i18n/cleanTranslations';
import { getStoredLang } from '../i18n/runtimeText';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorStr: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorStr: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorStr: error.toString() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const lang = getStoredLang();
    const copy =
      lang === 'ar'
        ? {
            title: 'حدث خطأ غير متوقع',
            action: 'تحديث الصفحة',
          }
        : {
            title: 'Something went wrong',
            action: 'Refresh page',
          };

    return (
      this.props.fallback || (
        <div className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
            <AlertCircle size={32} className="text-rose-500" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">{copy.title}</h2>
          <p className="mb-6 text-sm text-slate-400">{this.state.errorStr}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white transition-all hover:bg-indigo-700"
          >
            <RefreshCw size={18} />
            {copy.action || translations[lang].refresh}
          </button>
        </div>
      )
    );
  }
}
