import React from 'react';
import { AlertCircle } from 'lucide-react';

class UniversalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null,
            errorId: null
        };
    }

    static getDerivedStateFromError(error) {
        // 更新 state，使下一次渲染显示错误 UI
        return {
            hasError: true,
            error,
            errorId: Date.now()
        };
    }

    componentDidCatch(error, errorInfo) {
        // 记录错误详情
        console.error('全局错误边界捕获到错误:', error);
        console.error('错误详情:', errorInfo);
        
        // 更新状态以包含错误信息
        this.setState({
            error,
            errorInfo,
            errorId: Date.now()
        });
        
        // 这里可以将错误发送到错误报告服务
        // 例如: logErrorToService(error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                    <div className="max-w-lg w-full">
                        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                            <AlertCircle className="mx-auto mb-6 text-red-500" size={64} />
                            
                            <h1 className="text-2xl font-bold text-gray-800 mb-4">
                                应用出现异常
                            </h1>
                            
                            <p className="text-gray-600 mb-6">
                                很抱歉，应用遇到了一些技术问题。请尝试以下操作来解决：
                            </p>
                            
                            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                                <h3 className="font-semibold mb-3 text-gray-800">建议操作：</h3>
                                <ul className="space-y-2 text-sm text-gray-700">
                                    <li className="flex items-start">
                                        <span className="font-medium mr-2">1.</span>
                                        <span>点击"刷新页面"重新加载应用</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="font-medium mr-2">2.</span>
                                        <span>如果问题持续，请清除浏览器缓存后重试</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="font-medium mr-2">3.</span>
                                        <span>检查网络连接是否正常</span>
                                    </li>
                                </ul>
                            </div>
                            
                            <div className="flex gap-3 mb-6">
                                <button
                                    onClick={this.handleReload}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                                >
                                    刷新页面
                                </button>
                                <button
                                    onClick={this.handleReset}
                                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                                >
                                    重试
                                </button>
                            </div>
                            
                            {/* 开发环境下显示详细错误信息 */}
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <details className="text-left mt-6">
                                    <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                                        查看详细错误信息 (开发模式)
                                    </summary>
                                    <div className="bg-red-50 border border-red-200 rounded p-3">
                                        <pre className="text-xs text-red-800 whitespace-pre-wrap break-words">
                                            {this.state.error.toString()}
                                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                                        </pre>
                                    </div>
                                </details>
                            )}
                            
                            <div className="mt-6 pt-4 border-t border-gray-200">
                                <p className="text-xs text-gray-500">
                                    错误ID: {this.state.errorId}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    如果问题持续出现，请联系技术支持并提供上述错误ID
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default UniversalErrorBoundary;